// OpenAI Realtime API integration for voice conversations
// Creates a session token for the client to connect directly to OpenAI's WebSocket

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: "",
    };
  }

  try {
    // Log request details for debugging
    console.log('Realtime voice request:', {
      method: event.httpMethod,
      path: event.path,
      body: event.body,
      queryString: event.queryStringParameters
    });

    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('OPENAI_API_KEY not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: "API key not configured. Please set OPENAI_API_KEY in environment variables." 
        }),
      };
    }

    // Handle GET request - create a new session with ephemeral token (GA API)
    if (event.httpMethod === "GET") {
      let voice = event.queryStringParameters?.voice || 'alloy';
      
      // Validate voice is supported
      const SUPPORTED_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];
      if (!SUPPORTED_VOICES.includes(voice)) {
        console.warn(`Unsupported voice "${voice}" requested, defaulting to "alloy"`);
        voice = 'alloy';
      }
      
      console.log('🔄 [GET] Using GA endpoint: /v1/realtime/client_secrets');
      
      let ephemeralToken;
      let expiresAt;
      let sessionId;
      
      try {
        const clientSecretResponse = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            expires_after: {
              anchor: 'created_at',
              seconds: 600 // 10 minutes
            },
            session: {
              type: 'realtime',
              model: 'gpt-4o-realtime-preview',
              voice: voice,
              instructions: `You are Noteworthy AI, the intelligent assistant for Noteworthy News. You help users with fact-checking, media literacy, and staying informed with verified news. Be concise, helpful, and always truth-seeking.

You help users understand news, fact-check claims, and stay informed with accurate information.`,
              audio: {
                input: {
                  format: {
                    type: 'audio/pcm',
                    rate: 24000
                  }
                },
                output: {
                  format: {
                    type: 'audio/pcm',
                    rate: 24000
                  },
                  voice: voice,
                  speed: 1.0
                }
              },
              temperature: 0.6,
              max_response_output_tokens: 4096,
              turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500,
              }
            }
          }),
        });

        if (!clientSecretResponse.ok) {
          const errorData = await clientSecretResponse.json().catch(() => ({}));
          console.error('❌ [GET] client_secrets endpoint failed:', clientSecretResponse.status, errorData);
          return {
            statusCode: clientSecretResponse.status,
            headers,
            body: JSON.stringify({ 
              error: errorData.error?.message || 'Failed to create GA client secret',
              details: errorData,
              note: 'Using /v1/realtime/client_secrets endpoint for GA API compatibility'
            }),
          };
        }

        const clientSecretData = await clientSecretResponse.json();
        console.log('✅ [GET] GA client_secrets endpoint response received');
        
        // Extract token from client_secrets response
        if (clientSecretData.value) {
          ephemeralToken = clientSecretData.value;
          expiresAt = clientSecretData.expires_at;
          console.log('✅ [GET] Using ephemeral token from GA client_secrets endpoint');
          
          // Validate format
          if (!ephemeralToken.startsWith('ek_')) {
            console.error('❌ [GET] CRITICAL: Token from client_secrets does not start with "ek_"!');
            throw new Error('Invalid token format from GA client_secrets endpoint');
          } else {
            console.log('✅ [GET] Token format validated: starts with "ek_" (GA token)');
          }
          
          // Extract session ID from client_secrets response if available
          if (clientSecretData.session && clientSecretData.session.id) {
            sessionId = clientSecretData.session.id;
            console.log('📋 [GET] Session ID from client_secrets response:', sessionId);
          }
        } else {
          console.error('❌ [GET] client_secrets endpoint did not return token in "value" field');
          throw new Error('No token value in GA client_secrets response');
        }
      } catch (clientSecretError) {
        console.error('❌ [GET] Error calling GA client_secrets endpoint:', clientSecretError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: 'Failed to create GA client secret',
            message: clientSecretError.message,
            details: 'Using /v1/realtime/client_secrets for GA API compatibility'
          }),
        };
      }
      
      if (!ephemeralToken) {
        console.error('❌ [GET] No ephemeral token found after GA client_secrets call');
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: 'No ephemeral token found from GA client_secrets endpoint',
            details: 'This should not happen - token extraction failed'
          }),
        };
      }
      
      // Return session details with ephemeral token
      // CRITICAL: Return format must be: { "ephemeralToken": "ek_...", "model": "...", "voice": "..." }
      // Return the string token value, not the whole object
      // Never return the real API key
      // This is a GA-compatible token that works with GA WebSocket endpoint
      const tokenPreview = ephemeralToken.substring(0, 8) + '...';
      console.log('✅ [GET] Returning GA session with token (redacted):', tokenPreview);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ephemeralToken: ephemeralToken, // GA-compatible token from client_secrets.value
          model: 'gpt-4o-realtime-preview',
          voice: voice,
          // Optional: include session_id for internal tracking/logging only
          session_id: sessionId, // From client_secrets response if available
          expires_at: expiresAt
        }),
      };
    }

    // Handle POST request - create session with custom voice
    if (event.httpMethod === "POST") {
      let body = {};
      
      // Handle different body formats from Netlify Functions
      if (event.body) {
        try {
          let bodyStr = event.body;
          
          // Handle base64 encoded body (Netlify Functions can send this)
          if (event.isBase64Encoded && typeof bodyStr === 'string') {
            bodyStr = Buffer.from(bodyStr, 'base64').toString('utf-8');
            console.log('Decoded base64 body:', bodyStr.substring(0, 100));
          }
          
          if (typeof bodyStr === 'string') {
            // Empty string or whitespace only
            if (bodyStr.trim() === '') {
              body = {};
            } else {
              body = JSON.parse(bodyStr);
            }
          } else if (typeof bodyStr === 'object') {
            // Already parsed (shouldn't happen in Netlify but handle it)
            body = bodyStr;
          }
          
          console.log('Parsed body:', body);
        } catch (e) {
          console.error('Error parsing request body:', e);
          console.error('Raw body type:', typeof event.body);
          console.error('Raw body value:', typeof event.body === 'string' ? event.body.substring(0, 200) : event.body);
          console.error('isBase64Encoded:', event.isBase64Encoded);
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
              error: 'Invalid JSON in request body', 
              details: e.message,
              receivedBodyType: typeof event.body,
              isBase64Encoded: event.isBase64Encoded,
              receivedBody: typeof event.body === 'string' ? event.body.substring(0, 200) : 'Not a string'
            }),
          };
        }
      }
      
      let voice = body.voice || 'alloy';
      
      // Validate voice is supported
      const SUPPORTED_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];
      if (!SUPPORTED_VOICES.includes(voice)) {
        console.warn(`Unsupported voice "${voice}" requested, defaulting to "alloy"`);
        voice = 'alloy';
      }
      console.log('Creating session with voice:', voice, 'from body:', body);
      
      // CRITICAL FIX: Use /v1/realtime/client_secrets endpoint (GA API)
      // The /v1/realtime/sessions endpoint creates BETA sessions which are incompatible with GA WebSocket
      // Error: "API version mismatch. You cannot start a Realtime GA session with a beta client secret."
      // Solution: Use /v1/realtime/client_secrets to create GA-compatible client secrets
      console.log('🔄 [POST] Using GA endpoint: /v1/realtime/client_secrets');
      
      let ephemeralToken;
      let expiresAt;
      let sessionId;
      
      try {
        const clientSecretResponse = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            expires_after: {
              anchor: 'created_at',
              seconds: 600 // 10 minutes
            },
            session: {
              type: 'realtime',
              model: 'gpt-4o-realtime-preview',
              voice: voice,
              instructions: `You are Noteworthy AI, the intelligent assistant for Noteworthy News. You help users with fact-checking, media literacy, and staying informed with verified news. Be concise, helpful, and always truth-seeking.

You help users understand news, fact-check claims, and stay informed with accurate information.`,
              audio: {
                input: {
                  format: {
                    type: 'audio/pcm',
                    rate: 24000
                  }
                },
                output: {
                  format: {
                    type: 'audio/pcm',
                    rate: 24000
                  },
                  voice: voice,
                  speed: 1.0
                }
              },
              temperature: 0.6,
              max_response_output_tokens: 4096,
              turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500,
              }
            }
          }),
        });

        if (!clientSecretResponse.ok) {
          const errorData = await clientSecretResponse.json().catch(() => ({}));
          console.error('❌ [POST] client_secrets endpoint failed:', clientSecretResponse.status, errorData);
          return {
            statusCode: clientSecretResponse.status,
            headers,
            body: JSON.stringify({ 
              error: errorData.error?.message || 'Failed to create GA client secret',
              details: errorData,
              note: 'Using /v1/realtime/client_secrets endpoint for GA API compatibility'
            }),
          };
        }

        const clientSecretData = await clientSecretResponse.json();
        console.log('✅ [POST] GA client_secrets endpoint response received');
        console.log('📋 [POST] Response keys:', Object.keys(clientSecretData));
        
        // Extract token from client_secrets response
        if (clientSecretData.value) {
          ephemeralToken = clientSecretData.value;
          expiresAt = clientSecretData.expires_at;
          console.log('✅ [POST] Using ephemeral token from GA client_secrets endpoint');
          console.log('📋 [POST] Token length:', ephemeralToken.length);
          console.log('📋 [POST] Token preview (first 30 chars):', ephemeralToken.substring(0, 30) + '...');
          
          // Validate format
          if (!ephemeralToken.startsWith('ek_')) {
            console.error('❌ [POST] CRITICAL: Token from client_secrets does not start with "ek_"!');
            console.error('❌ [POST] Full response:', JSON.stringify(clientSecretData, null, 2));
            throw new Error('Invalid token format from GA client_secrets endpoint');
          } else {
            console.log('✅ [POST] Token format validated: starts with "ek_" (GA token)');
          }
          
          // Extract session ID from client_secrets response if available
          if (clientSecretData.session && clientSecretData.session.id) {
            sessionId = clientSecretData.session.id;
            console.log('📋 [POST] Session ID from client_secrets response:', sessionId);
          } else {
            console.log('⚠️ [POST] No session ID in client_secrets response (optional)');
          }
        } else {
          console.error('❌ [POST] client_secrets endpoint did not return token in "value" field');
          console.error('❌ [POST] Response:', JSON.stringify(clientSecretData, null, 2));
          throw new Error('No token value in GA client_secrets response');
        }
      } catch (clientSecretError) {
        console.error('❌ [POST] Error calling GA client_secrets endpoint:', clientSecretError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: 'Failed to create GA client secret',
            message: clientSecretError.message,
            details: 'Using /v1/realtime/client_secrets for GA API compatibility'
          }),
        };
      }
      
      // Final validation - token should already be set from client_secrets endpoint
      if (!ephemeralToken) {
        console.error('❌ [POST] CRITICAL: No ephemeral token after GA client_secrets call');
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: 'No ephemeral token found from GA client_secrets endpoint',
            details: 'This should not happen - token extraction failed'
          }),
        };
      }
      
      console.log('✅ [POST] Returning GA session with token to client');
      
      // Redact token in logs (show only first 8 chars)
      const tokenPreview = ephemeralToken.substring(0, 8) + '...';
      console.log('📋 [POST] Token being sent (redacted):', tokenPreview);
      console.log('📋 [POST] Token length:', ephemeralToken.length);
      
      // CRITICAL VALIDATION: Verify token format - MUST start with 'ek_' for ephemeral tokens
      if (!ephemeralToken.startsWith('ek_')) {
        console.error('❌ [POST] CRITICAL: Token does not start with "ek_" - INVALID FORMAT!');
        console.error('❌ [POST] Token preview:', tokenPreview);
        throw new Error('Invalid token format - token must start with "ek_"');
      }
      
      console.log('✅ [POST] Token format validated: starts with "ek_" (GA token format)');
      
      // Return response in required format: { "ephemeralToken": "ek_...", "model": "...", "voice": "..." }
      // Note: Return the string token value, not the whole object
      // Never return the real API key
      // This is a GA-compatible token that works with GA WebSocket endpoint
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ephemeralToken: ephemeralToken, // GA-compatible token from client_secrets.value
          model: 'gpt-4o-realtime-preview',
          voice: voice,
          // Optional: include session_id for internal tracking/logging only
          session_id: sessionId, // From client_secrets response if available
          expires_at: expiresAt
        }),
      };
    }

    // If we get here, the method is not GET or POST
    console.error('Unsupported HTTP method:', event.httpMethod);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ 
        error: "Method not allowed",
        receivedMethod: event.httpMethod,
        allowedMethods: ["GET", "POST", "OPTIONS"]
      }),
    };

  } catch (error) {
    console.error('Realtime voice function error:', error);
    console.error('Error stack:', error.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: "Internal server error",
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }),
    };
  }
};

