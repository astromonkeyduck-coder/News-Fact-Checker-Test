// Streaming ChatGPT endpoint for better UX (shows response as it's generated)
exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'API key not configured' 
        }),
      };
    }

    const { message, model = 'gpt-3.5-turbo' } = JSON.parse(event.body);

    if (!message || typeof message !== 'string') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Message is required' }),
      };
    }

    // For Netlify Functions, streaming is complex, so we'll use regular response
    // For true streaming, consider using Vercel Edge Functions
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant for Noteworthy News.'
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: data.error?.message || 'Failed to get AI response' }),
      };
    }

    const aiResponse = data.choices[0]?.message?.content || 'No response generated';
    const usage = data.usage;

    // Log AI chat interaction (non-blocking - don't wait for it)
    const { logData } = require("./log-data");
    logData("ai-chat", {
      userMessage: message,
      aiResponse: aiResponse,
      usage: usage,
      model: model,
      temperature: 0.7,
      maxTokens: 500,
      endpoint: "chatgpt-stream",
    }, event).catch(err => {
      console.error("[ChatGPT Stream] Failed to log data:", err);
      // Don't fail the request if logging fails
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: aiResponse,
      }),
    };

  } catch (error) {
    console.error('ChatGPT streaming error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    };
  }
};

