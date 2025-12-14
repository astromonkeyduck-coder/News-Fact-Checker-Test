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
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
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
      const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview-2024-12-17',
          voice: voice,
          instructions: `You are Noteworthy AI, the intelligent assistant for Noteworthy News. You help users with fact-checking, media literacy, and staying informed with verified news. Be concise, helpful, and always truth-seeking.

You have access to tools that allow you to:
- Generate images when users ask for pictures or images
- Search the web for breaking news and current information
- Verify facts and claims using real-time information

When a user asks you to generate an image, create a picture, or make an image, use the image_generation tool.
When a user asks you to research breaking news, search for information, or verify something, use the web_search tool.

Always inform the user when you're using these tools during the conversation.`,
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
              name: 'generate_image',
              description: 'Generate or edit images based on text prompts. Use this when users ask to create, generate, make, or draw an image or picture.',
            },
            {
              type: 'web_search',
              name: 'search_web',
              description: 'Search the web for real-time information, breaking news, current events, and to verify facts. Use this when users ask to research, search, find information, or verify something.',
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
      
      // Generate ephemeral token for client-side connection
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
            details: errorData 
          }),
        };
      }

      const tokenData = await tokenResponse.json();
      
      // Return session details with ephemeral token
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          session_id: sessionData.id,
          expires_at: sessionData.expires_at,
          ephemeral_token: tokenData.token,
          websocket_url: `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17&session_id=${sessionData.id}`,
        }),
      };
    }

    // Handle POST request - create session with custom voice
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || '{}');
      const voice = body.voice || 'cove';
      
      const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview-2024-12-17',
          voice: voice,
          instructions: `You are Noteworthy AI, the intelligent assistant for Noteworthy News. You help users with fact-checking, media literacy, and staying informed with verified news. Be concise, helpful, and always truth-seeking.

You have access to tools that allow you to:
- Generate images when users ask for pictures or images
- Search the web for breaking news and current information
- Verify facts and claims using real-time information

When a user asks you to generate an image, create a picture, or make an image, use the image_generation tool.
When a user asks you to research breaking news, search for information, or verify something, use the web_search tool.

Always inform the user when you're using these tools during the conversation.`,
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
              name: 'generate_image',
              description: 'Generate or edit images based on text prompts. Use this when users ask to create, generate, make, or draw an image or picture.',
            },
            {
              type: 'web_search',
              name: 'search_web',
              description: 'Search the web for real-time information, breaking news, current events, and to verify facts. Use this when users ask to research, search, find information, or verify something.',
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
      
      // Generate ephemeral token for client-side connection
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
            details: errorData 
          }),
        };
      }

      const tokenData = await tokenResponse.json();
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          session_id: sessionData.id,
          expires_at: sessionData.expires_at,
          ephemeral_token: tokenData.token,
          websocket_url: `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17&session_id=${sessionData.id}`,
          voice: voice,
        }),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };

  } catch (error) {
    console.error('Realtime voice function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: "Internal server error",
        message: error.message 
      }),
    };
  }
};

