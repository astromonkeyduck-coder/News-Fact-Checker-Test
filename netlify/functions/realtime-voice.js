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

    // Handle GET request - create a new session with ephemeral token
    if (event.httpMethod === "GET") {
      let voice = event.queryStringParameters?.voice || 'alloy';
      
      // Validate voice is supported
      const SUPPORTED_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];
      if (!SUPPORTED_VOICES.includes(voice)) {
        console.warn(`Unsupported voice "${voice}" requested, defaulting to "alloy"`);
        voice = 'alloy';
      }
      
      // Create a session with OpenAI Realtime API
      const requestBody = {
          model: 'gpt-4o-realtime-preview',
          voice: voice,
          instructions: `You are Noteworthy AI, the intelligent assistant for Noteworthy News. You help users with fact-checking, media literacy, and staying informed with verified news. Be concise, helpful, and always truth-seeking.

You help users understand news, fact-check claims, and stay informed with accurate information.`,
          temperature: 0.6,
          max_response_output_tokens: 4096,
          modalities: ['text', 'audio'],
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500,
          },
          // Tools removed - Realtime API requires 'function' or 'mcp' type, not 'image_generation'/'web_search'
          // Will add proper function definitions later if needed
        };
      
      console.log('Creating Realtime API session (GET) with body:', JSON.stringify(requestBody, null, 2));
      
      const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('OpenAI Realtime API error:', errorData);
        return {
          statusCode: response.status,
          headers,
          body: JSON.stringify({ 
            error: errorData.error?.message || 'Failed to create Realtime API session',
            details: errorData 
          }),
        };
      }

      const sessionData = await response.json();
      
      // Check if session response includes client_secret (ephemeral token)
      // New API format includes it directly in session response
      let ephemeralToken;
      let expiresAt;
      
      if (sessionData.client_secret && sessionData.client_secret.value) {
        // New format: token is in client_secret.value
        ephemeralToken = sessionData.client_secret.value;
        expiresAt = sessionData.client_secret.expires_at || sessionData.expires_at;
        console.log('Using ephemeral token from client_secret');
      } else {
        // Fallback: Try to generate token via separate endpoint (older API format)
        console.log('No client_secret found, trying token endpoint...');
        const tokenResponse = await fetch(`https://api.openai.com/v1/realtime/sessions/${sessionData.id}/tokens`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            expires_in: 600, // 10 minutes
          }),
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json().catch(() => ({}));
          console.error('OpenAI token generation error:', errorData);
          return {
            statusCode: tokenResponse.status,
            headers,
            body: JSON.stringify({ 
              error: errorData.error?.message || 'Failed to generate ephemeral token',
              details: errorData,
              note: 'Session created but token generation failed. Check if client_secret is in session response.'
            }),
          };
        }

        const tokenData = await tokenResponse.json();
        ephemeralToken = tokenData.token || tokenData.value;
        expiresAt = tokenData.expires_at || sessionData.expires_at;
      }
      
      if (!ephemeralToken) {
        console.error('No ephemeral token found in response:', sessionData);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: 'No ephemeral token found in session response',
            sessionData: sessionData
          }),
        };
      }
      
      // Return session details with ephemeral token
      // CRITICAL: Return format must be: { "ephemeralToken": "ek_...", "model": "...", "voice": "..." }
      // Return the string token value, not the whole object
      // Never return the real API key
      const tokenPreview = ephemeralToken.substring(0, 8) + '...';
      console.log('✅ [GET] Returning session with token (redacted):', tokenPreview);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ephemeralToken: ephemeralToken, // String token value from client_secret.value
          model: 'gpt-4o-realtime-preview',
          voice: voice,
          // Optional: include session_id for internal tracking/logging only
          session_id: sessionData.id,
          expires_at: expiresAt || sessionData.expires_at
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
      
      // EXPERT FIX: Use /v1/realtime/sessions endpoint which returns client_secret
      // This is the correct endpoint for WebSocket connections
      // The client_secret.value is the ephemeral token needed for browser authentication
      const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview',
          voice: voice,
          instructions: `You are Noteworthy AI, the intelligent assistant for Noteworthy News. You help users with fact-checking, media literacy, and staying informed with verified news. Be concise, helpful, and always truth-seeking.

You help users understand news, fact-check claims, and stay informed with accurate information.`,
          temperature: 0.6,
          max_response_output_tokens: 4096,
          modalities: ['text', 'audio'],
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500,
          },
          // Tools removed - Realtime API requires 'function' or 'mcp' type, not 'image_generation'/'web_search'
          // Will add proper function definitions later if needed
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ [POST] OpenAI Realtime API error:', errorData);
        console.error('❌ [POST] Response status:', response.status, response.statusText);
        return {
          statusCode: response.status,
          headers,
          body: JSON.stringify({ 
            error: errorData.error?.message || 'Failed to create Realtime API session',
            details: errorData 
          }),
        };
      }

      const sessionData = await response.json();
      console.log('✅ [POST] Session created successfully');
      console.log('📋 [POST] Session ID:', sessionData.id);
      
      // Check if session response includes client_secret (ephemeral token)
      // New API format includes it directly in session response
      let ephemeralToken;
      let expiresAt;
      
      console.log('📋 [POST] Session response keys:', Object.keys(sessionData));
      console.log('📋 [POST] Has client_secret:', !!sessionData.client_secret);
      if (sessionData.client_secret) {
        console.log('📋 [POST] client_secret keys:', Object.keys(sessionData.client_secret));
        console.log('📋 [POST] client_secret.value exists:', !!sessionData.client_secret.value);
      }
      
      if (sessionData.client_secret && sessionData.client_secret.value) {
        // New format: token is in client_secret.value
        ephemeralToken = sessionData.client_secret.value;
        expiresAt = sessionData.client_secret.expires_at || sessionData.expires_at;
        console.log('✅ [POST] Using ephemeral token from client_secret');
        console.log('📋 [POST] Token length:', ephemeralToken.length);
        console.log('📋 [POST] Token preview (first 30 chars):', ephemeralToken.substring(0, 30) + '...');
        
        // CRITICAL: Validate token format immediately
        if (!ephemeralToken.startsWith('ek_')) {
          console.error('❌ [POST] CRITICAL: Token from client_secret.value does not start with "ek_"!');
          console.error('❌ [POST] This indicates a problem with the API response format');
          console.error('❌ [POST] Full client_secret object:', JSON.stringify(sessionData.client_secret, null, 2));
          // Continue anyway - might be a false alarm, but log it
        } else {
          console.log('✅ [POST] Token format validated: starts with "ek_"');
        }
      } else {
        // Fallback: Try to generate token via separate endpoint (older API format)
        console.log('⚠️ [POST] No client_secret found, trying token endpoint...');
        const tokenResponse = await fetch(`https://api.openai.com/v1/realtime/sessions/${sessionData.id}/tokens`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            expires_in: 600, // 10 minutes
          }),
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json().catch(() => ({}));
          console.error('❌ [POST] OpenAI token generation error:', errorData);
          return {
            statusCode: tokenResponse.status,
            headers,
            body: JSON.stringify({ 
              error: errorData.error?.message || 'Failed to generate ephemeral token',
              details: errorData,
              note: 'Session created but token generation failed. Check if client_secret is in session response.'
            }),
          };
        }

        const tokenData = await tokenResponse.json();
        console.log('📋 [POST] Token endpoint response keys:', Object.keys(tokenData));
        ephemeralToken = tokenData.token || tokenData.value || tokenData.client_secret?.value;
        expiresAt = tokenData.expires_at || sessionData.expires_at;
        
        if (ephemeralToken) {
          console.log('✅ [POST] Using ephemeral token from token endpoint');
          console.log('📋 [POST] Token length:', ephemeralToken.length);
          console.log('📋 [POST] Token preview (first 30 chars):', ephemeralToken.substring(0, 30) + '...');
          
          // Validate format
          if (!ephemeralToken.startsWith('ek_')) {
            console.error('❌ [POST] CRITICAL: Token from token endpoint does not start with "ek_"!');
            console.error('❌ [POST] Full token endpoint response:', JSON.stringify(tokenData, null, 2));
          } else {
            console.log('✅ [POST] Token format validated: starts with "ek_"');
          }
        } else {
          console.error('❌ [POST] No token found in token endpoint response');
          console.error('❌ [POST] Token endpoint response keys:', Object.keys(tokenData));
          console.error('❌ [POST] Full response:', JSON.stringify(tokenData, null, 2));
        }
      }
      
      // ENHANCED FALLBACK: If no token found, try /v1/realtime/client_secrets endpoint
      // This is an alternative method that generates tokens separately
      if (!ephemeralToken) {
        console.error('❌ [POST] No ephemeral token found in session response');
        console.log('🔄 [POST] Attempting fallback: /v1/realtime/client_secrets endpoint...');
        
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
                instructions: `You are Noteworthy AI, the intelligent assistant for Noteworthy News. You help users with fact-checking, media literacy, and staying informed with verified news. Be concise, helpful, and always truth-seeking.`,
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
                }
              }
            }),
          });

          if (clientSecretResponse.ok) {
            const clientSecretData = await clientSecretResponse.json();
            console.log('✅ [POST] client_secrets endpoint response keys:', Object.keys(clientSecretData));
            
            // Extract token from client_secrets response
            if (clientSecretData.value) {
              ephemeralToken = clientSecretData.value;
              expiresAt = clientSecretData.expires_at;
              console.log('✅ [POST] Using ephemeral token from client_secrets endpoint (fallback)');
              console.log('📋 [POST] Token length:', ephemeralToken.length);
              console.log('📋 [POST] Token preview (first 30 chars):', ephemeralToken.substring(0, 30) + '...');
              
              // Validate format
              if (!ephemeralToken.startsWith('ek_')) {
                console.error('❌ [POST] CRITICAL: Token from client_secrets does not start with "ek_"!');
              } else {
                console.log('✅ [POST] Token format validated: starts with "ek_"');
              }
              
              // Use the session from client_secrets response if available
              if (clientSecretData.session && clientSecretData.session.id) {
                sessionData.id = clientSecretData.session.id;
                console.log('📋 [POST] Using session ID from client_secrets response:', sessionData.id);
              }
            } else {
              console.error('❌ [POST] client_secrets endpoint did not return token in "value" field');
              console.error('❌ [POST] Response:', JSON.stringify(clientSecretData, null, 2));
            }
          } else {
            const errorData = await clientSecretResponse.json().catch(() => ({}));
            console.error('❌ [POST] client_secrets endpoint failed:', clientSecretResponse.status, errorData);
          }
        } catch (clientSecretError) {
          console.error('❌ [POST] Error calling client_secrets endpoint:', clientSecretError);
        }
      }
      
      // Final check - if still no token, return error
      if (!ephemeralToken) {
        console.error('❌ [POST] No ephemeral token found after all attempts:', {
          triedSessions: true,
          triedTokensEndpoint: true,
          triedClientSecrets: true,
          sessionResponse: sessionData
        });
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: 'No ephemeral token found after all fallback attempts',
            details: 'Tried: /sessions, /sessions/{id}/tokens, and /client_secrets endpoints',
            sessionData: sessionData
          }),
        };
      }
      
      console.log('✅ [POST] Returning session with token to client');
      
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
      
      console.log('✅ [POST] Token format validated: starts with "ek_" (correct format)');
      
      // Return response in required format: { "ephemeralToken": "ek_...", "model": "...", "voice": "..." }
      // Note: Return the string token value, not the whole object
      // Never return the real API key
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ephemeralToken: ephemeralToken, // String token value from client_secret.value
          model: 'gpt-4o-realtime-preview',
          voice: voice,
          // Optional: include session_id for internal tracking/logging only
          session_id: sessionData.id,
          expires_at: expiresAt || sessionData.expires_at
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

