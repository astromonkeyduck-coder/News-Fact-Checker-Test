exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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
    if (event.httpMethod !== "POST" && event.httpMethod !== "OPTIONS") {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ 
          error: "Method Not Allowed",
          receivedMethod: event.httpMethod,
          expectedMethod: "POST"
        }),
      };
    }

    let requestBody;
    try {
      requestBody = JSON.parse(event.body || "{}");
    } catch (parseError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid JSON in request body" }),
      };
    }

    const { prompt, size = "1024x1024", quality = "standard", style = "vivid" } = requestBody;

    if (!prompt || !prompt.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing prompt" }),
      };
    }

    // Get API key
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      const debugInfo = process.env.NETLIFY_DEV ? {
        availableEnvVars: Object.keys(process.env).filter(k => 
          k.toUpperCase().includes('OPENAI') || 
          k.toUpperCase().includes('CHATGPT') ||
          k.toUpperCase().includes('API')
        ),
        netlifyDev: process.env.NETLIFY_DEV
      } : undefined;
      
      console.error("OPENAI_API_KEY is not configured", debugInfo);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: "API key not configured. Please set OPENAI_API_KEY in Netlify environment variables or .env file for local development.",
          debug: debugInfo
        }),
      };
    }
    
    console.log("Generating image with prompt:", prompt.substring(0, 100) + "...");

    // Call OpenAI DALL-E API
    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: prompt.trim(),
        size: size,
        quality: quality,
        style: style,
        n: 1,
      }),
    });

    if (!r.ok) {
      let errorData;
      try {
        errorData = await r.json();
      } catch {
        const errorText = await r.text();
        errorData = { message: errorText || `HTTP ${r.status}` };
      }
      
      console.error("OpenAI DALL-E API error:", r.status, errorData);
      return {
        statusCode: r.status,
        headers,
        body: JSON.stringify({ 
          error: errorData.error?.message || errorData.message || `OpenAI API error (${r.status})`,
          details: errorData
        }),
      };
    }

    const data = await r.json();
    const imageUrl = data?.data?.[0]?.url || null;
    const revisedPrompt = data?.data?.[0]?.revised_prompt || null;

    if (!imageUrl) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: "No image URL returned from API"
        }),
      };
    }

    // Log image generation (non-blocking - don't wait for it)
    try {
      const { logData } = require("./log-data");
      console.log("[Generate Image] Attempting to log image generation...");
      const logResult = await logData("image-generation", {
        userPrompt: prompt.trim(),
        revisedPrompt: revisedPrompt,
        imageUrl: imageUrl,
        size: size,
        quality: quality,
        style: style,
        model: "dall-e-3",
      }, event);
      
      if (logResult.success) {
        console.log("[Generate Image] Successfully logged image generation:", logResult.id);
      } else {
        console.error("[Generate Image] Logging failed:", logResult.error);
      }
    } catch (err) {
      console.error("[Generate Image] Error logging data:", err);
      // Don't fail the request if logging fails
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        imageUrl,
        revisedPrompt,
        prompt: prompt.trim()
      }),
    };
  } catch (e) {
    console.error("Image generation function error:", e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: "Internal server error",
        message: e.message || "An unexpected error occurred"
      }),
    };
  }
};

