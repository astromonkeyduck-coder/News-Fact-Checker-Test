// Secure ChatGPT API endpoint - API key is never exposed to the client
exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle OPTIONS request for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Get API key from environment variable (never exposed to client)
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'API key not configured. Please add OPENAI_API_KEY to Netlify environment variables.' 
        }),
      };
    }

    const { message, model = 'gpt-3.5-turbo', temperature = 0.7 } = JSON.parse(event.body);

    // Validate input
    if (!message || typeof message !== 'string') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Message is required' }),
      };
    }

    // Call OpenAI API (API key is secure on the server side)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`, // API key stays on server, never sent to client
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant for Noteworthy News, a fact-checking and media literacy website. Be concise, informative, and helpful.'
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: temperature,
        max_tokens: 500,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenAI API error:', data);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          error: data.error?.message || 'Failed to get AI response',
          details: data.error 
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: data.choices[0]?.message?.content || 'No response generated',
        usage: data.usage,
      }),
    };

  } catch (error) {
    console.error('ChatGPT function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
    };
  }
};

