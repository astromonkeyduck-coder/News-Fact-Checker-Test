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
      const voice = event.queryStringParameters?.voice || 'cove';
      
      // Create a session with OpenAI Realtime API
      const requestBody = {
          model: 'gpt-4o-realtime-preview',
          voice: voice,
          instructions: `You are Noteworthy AI, the intelligent assistant for Noteworthy News. You help users with fact-checking, media literacy, and staying informed with verified news. Be concise, helpful, and always truth-seeking.

You help users understand news, fact-check claims, and stay informed with accurate information.`,
          temperature: 0.4,
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
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          session_id: sessionData.id,
          expires_at: expiresAt || sessionData.expires_at,
          ephemeral_token: ephemeralToken,
          websocket_url: `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview&session_id=${sessionData.id}`,
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
      
      const voice = body.voice || 'cove';
      console.log('Creating session with voice:', voice, 'from body:', body);
      
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
          temperature: 0.4,
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
          tools: [
            {
              type: 'image_generation',
            },
            {
              type: 'web_search',
            },
          ],
        }),
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
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          session_id: sessionData.id,
          expires_at: expiresAt || sessionData.expires_at,
          ephemeral_token: ephemeralToken,
          websocket_url: `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview&session_id=${sessionData.id}`,
          voice: voice,
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

