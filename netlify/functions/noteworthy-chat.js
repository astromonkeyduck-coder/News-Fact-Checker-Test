// Rate limiting: 10 messages per 30 minutes
const RATE_LIMIT_MESSAGES = 10;
const RATE_LIMIT_WINDOW = 30 * 60 * 1000; // 30 minutes in milliseconds

// Import Netlify Blobs for rate limit tracking
let getStore;
try {
  getStore = require('@netlify/blobs').getStore;
} catch (e) {
  console.warn('@netlify/blobs not available, rate limiting will be disabled');
}

/**
 * Get user identifier (IP address)
 */
function getUserIdentifier(event) {
  // Try various headers for IP (handles proxies, Cloudflare, etc.)
  return event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         event.headers['x-real-ip'] ||
         event.headers['cf-connecting-ip'] ||
         event.requestContext?.identity?.sourceIp ||
         'unknown';
}

/**
 * Check if user has exceeded rate limit
 */
async function checkRateLimit(userId) {
  if (!getStore) {
    // Blobs not available, allow request (for local dev)
    return { allowed: true };
  }

  try {
    const store = getStore({ name: 'ai-rate-limits' });
    const key = `user-${userId}`;
    
    // Get existing timestamps
    let timestamps = [];
    try {
      const data = await store.get(key, { type: 'json' });
      if (Array.isArray(data)) {
        timestamps = data;
      }
    } catch (e) {
      // No existing data
    }

    const now = Date.now();
    // Filter out timestamps older than 30 minutes
    const recentTimestamps = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW);

    // Check if limit exceeded
    if (recentTimestamps.length >= RATE_LIMIT_MESSAGES) {
      const oldestTimestamp = Math.min(...recentTimestamps);
      const timeUntilReset = RATE_LIMIT_WINDOW - (now - oldestTimestamp);
      const minutesUntilReset = Math.ceil(timeUntilReset / 60000);
      
      return {
        allowed: false,
        remaining: 0,
        resetIn: minutesUntilReset,
      };
    }

    // Add current timestamp
    recentTimestamps.push(now);
    
    // Store updated timestamps (with expiry after 30 minutes)
    await store.set(key, JSON.stringify(recentTimestamps), {
      contentType: 'application/json',
      expiry: Math.floor((now + RATE_LIMIT_WINDOW) / 1000), // TTL in seconds
    });

    return {
      allowed: true,
      remaining: RATE_LIMIT_MESSAGES - recentTimestamps.length,
      resetIn: null,
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // On error, allow request (fail open)
    return { allowed: true };
  }
}

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
    // Rate limiting check (only for POST requests)
    if (event.httpMethod === "POST") {
      const userId = getUserIdentifier(event);
      const rateLimit = await checkRateLimit(userId);
      
      if (!rateLimit.allowed) {
        return {
          statusCode: 429,
          headers,
          body: JSON.stringify({
            error: "Rate limit exceeded",
            message: `You've reached the limit of ${RATE_LIMIT_MESSAGES} messages per 30 minutes. Please try again in ${rateLimit.resetIn} minute(s).`,
            resetIn: rateLimit.resetIn,
          }),
        };
      }
      
      // Add rate limit info to response headers (optional)
      if (rateLimit.remaining !== undefined) {
        headers['X-RateLimit-Remaining'] = rateLimit.remaining.toString();
        headers['X-RateLimit-Limit'] = RATE_LIMIT_MESSAGES.toString();
      }
    }
    // Debug: Log the method we received
    console.log("Received request:", {
      method: event.httpMethod,
      path: event.path,
      hasBody: !!event.body
    });
    
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

    const { message } = requestBody;

    if (!message || !message.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing message" }),
      };
    }

    // Get API key
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      // Debug info for local development
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
    
    console.log("API key found:", apiKey.substring(0, 7) + "...");

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.4,
        max_tokens: 450,
        messages: [
          {
            role: "system",
            content: `You are Noteworthy AI, the intelligent assistant for Noteworthy News. You are designed to help users with fact-checking, media literacy, and staying informed with verified news.

ABOUT NOTEWORTHY NEWS:
- Noteworthy News is committed to delivering accurate, fact-checked journalism in an era of information overload
- Mission: Reliable news is the foundation of an informed democracy
- Approach: Combines traditional journalistic standards with modern fact-checking tools
- Focus Areas: Breaking news, in-depth analysis, media literacy education, fact-checking games
- Tagline: "Trusted Journalism & Media Literacy"
       - Values: Fast, factual, Truth-Seeking

WHAT NOTEWORTHY NEWS OFFERS:
- Interactive fact-checking games to test media literacy skills
- Verified, trustworthy journalism and news stories
- Educational content on media literacy and digital literacy
- Fact-checking tools and verification resources
- Breaking news coverage with fact-checking
- Critical thinking skills development

YOUR ROLE:
- Help users understand current news stories and headlines
- Provide fact-checking assistance and verification tips
- Answer questions about media literacy and critical thinking
- Explain Noteworthy News' mission and services
       - Be concise, neutral, and always Truth-Seeking
- When discussing news, emphasize the importance of multiple sources and verification
- If you don't know something, say so rather than speculate

RESPONSE STYLE:
- Keep responses concise but informative (target: 2-4 sentences per point)
- Use clear, accessible language
- Cite principles of fact-checking when relevant
- Maintain a professional but approachable tone`,
          },
          { role: "user", content: message },
        ],
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
      
      console.error("OpenAI API error:", r.status, errorData);
      return {
        statusCode: r.status,
        headers,
        body: JSON.stringify({ 
          error: errorData.error?.message || errorData.message || `OpenAI API error (${r.status})` 
        }),
      };
    }

    const data = await r.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || "No response generated.";
    const usage = data?.usage || null;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply, usage }),
    };
  } catch (e) {
    console.error("Noteworthy chat function error:", e);
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

