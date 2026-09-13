// OpenAI Realtime API integration for voice conversations.
// Mints a GA ephemeral client secret so the widget can open a WebSocket
// directly to OpenAI. Instructions are grounded in the same data as text chat
// (recent posts, live stories, and the page the listener is on).

const aiGrounding = require("./lib/aiGrounding");

const SUPPORTED_VOICES = ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"];

const TOOLS = [
  {
    type: "function",
    name: "generate_image",
    description: "Generate an image using DALL-E based on a text description. Use this when the user asks for an image, picture, illustration, or visual.",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "A detailed description of the image to generate",
        },
      },
      required: ["prompt"],
    },
  },
  {
    type: "function",
    name: "search_web",
    description: "Search the web for real-time breaking news, current events, or any information that happened recently. Use this when the user asks about current events, breaking news, recent developments, or anything that requires up-to-date information beyond your training data. Use specific queries with location, event type, and date.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "A specific, detailed search query (e.g. 'earthquake Japan July 2026' or 'latest developments in [topic]')",
        },
      },
      required: ["query"],
    },
  },
  {
    type: "function",
    name: "send_email",
    description: "Send an email to someone. When the user asks to send an email, extract the recipient email address, subject, and message content. ALWAYS repeat back both the email address and message to confirm before actually sending. The user must confirm before the email is sent.",
    parameters: {
      type: "object",
      properties: {
        recipient_email: {
          type: "string",
          description: "The email address of the recipient (e.g., 'john@example.com')",
        },
        subject: {
          type: "string",
          description: "The subject line of the email",
        },
        message: {
          type: "string",
          description: "The message content to send in the email body",
        },
      },
      required: ["recipient_email", "subject", "message"],
    },
  },
];

function buildInstructions(groundingContext) {
  const todayStr = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  return `You are Noteworthy News AI, the voice briefing assistant for Noteworthy News (noteworthynews.co) - a fact-first breaking news site. Motto: "Developing means developing. Confirmed means confirmed."

TODAY'S DATE: ${todayStr}${aiGrounding.buildKnowledgeCorrections()}${aiGrounding.buildCutoffRules()}

You are SPEAKING out loud, so:
- Keep answers short: a couple of sentences per point, no lists, no markdown, no URLs
- Sound like a calm newsroom anchor: clear, neutral, plain language, no hype
- Attribute out loud instead of citing links: say "according to our reporting", "our live story on ...", or name the outlet from search results
- It's fine to pause a beat and offer to go deeper: "Want the full rundown?"

WHAT YOU CAN DO:
- Brief the listener on the news, explain context, and fact-check claims
- Ground answers in Noteworthy News reporting (verified articles and live stories below)
- Use the search_web function for breaking news or anything not covered below - tell the listener you're checking, then summarize what you found and name the sources
- Generate images with the generate_image function when asked (acknowledge it out loud)
- Send an email with the send_email function - always read back the address and message and get a spoken confirmation first

ACCURACY RULES:
- NEVER make up events, quotes, numbers, or details
- Clearly separate what is confirmed from what is developing or unverified
- If search finds nothing, say plainly: "I couldn't find verified information on that yet."
- If your answer relies on general knowledge that may be out of date, say so${groundingContext}

When the conversation starts, greet the listener briefly: "Hey, it's Noteworthy News AI." Then let them talk.`;
}

/**
 * Sanitize the optional pageContext sent by the widget.
 */
function parsePageContext(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    url: String(raw.url || "").substring(0, 300),
    title: String(raw.title || "").substring(0, 300),
    articleId: String(raw.articleId || "").substring(0, 100),
    storySlug: String(raw.storySlug || "").substring(0, 100),
  };
}

/**
 * Create a GA ephemeral client secret for a realtime session.
 * Returns a Netlify-style response object.
 */
async function createSession({ apiKey, voice, pageContext, headers }) {
  // ElevenLabs voices are synthesized on the frontend; the session itself
  // still needs a valid OpenAI voice.
  const isElevenLabsVoice = typeof voice === "string" && voice.startsWith("elevenlabs:");
  if (!SUPPORTED_VOICES.includes(voice) && !isElevenLabsVoice) {
    console.warn(`[Realtime Voice] Unsupported voice "${voice}", defaulting to "marin"`);
    voice = "marin";
  }
  const openAIVoiceForSession = isElevenLabsVoice ? "marin" : voice;

  // Grounding: same sources as text chat, formatted for speech.
  let groundingContext = "";
  try {
    const grounding = await aiGrounding.loadGrounding({ pageContext, postsLimit: 8, storiesLimit: 4 });
    groundingContext = aiGrounding.buildVoiceContext(grounding, pageContext);
    console.log(`[Realtime Voice] Grounding: ${grounding.recentPosts.length} posts, ${grounding.liveStories.length} live stories, article=${!!grounding.currentArticle}, liveStory=${!!grounding.currentLiveStory}`);
  } catch (error) {
    console.error("[Realtime Voice] Error building grounding:", error);
  }

  const instructions = buildInstructions(groundingContext);

  // 12s timeout - leave buffer under Netlify's function cap
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  let clientSecretResponse;
  try {
    clientSecretResponse = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        expires_after: {
          anchor: "created_at",
          seconds: 600, // 10 minutes
        },
        session: {
          type: "realtime",
          model: "gpt-realtime",
          instructions,
          tools: TOOLS,
          audio: {
            input: {
              format: { type: "audio/pcm", rate: 24000 },
              turn_detection: { type: "server_vad" },
            },
            output: {
              format: { type: "audio/pcm", rate: 24000 },
              voice: openAIVoiceForSession,
              speed: 1.0,
            },
          },
        },
      }),
    });
  } catch (fetchError) {
    clearTimeout(timeoutId);
    if (fetchError.name === "AbortError") {
      console.error("[Realtime Voice] OpenAI API request timed out after 12 seconds");
      return {
        statusCode: 504,
        headers,
        body: JSON.stringify({
          error: "Request timeout - OpenAI API took too long to respond",
          message: "The server request timed out. Please try again.",
          retryable: true,
        }),
      };
    }
    throw fetchError;
  }
  clearTimeout(timeoutId);

  if (!clientSecretResponse.ok) {
    const errorData = await clientSecretResponse.json().catch(() => ({}));
    console.error("[Realtime Voice] client_secrets endpoint failed:", clientSecretResponse.status, errorData);
    return {
      statusCode: clientSecretResponse.status,
      headers,
      body: JSON.stringify({
        error: errorData.error?.message || "Failed to create GA client secret",
        details: errorData,
      }),
    };
  }

  const clientSecretData = await clientSecretResponse.json();
  const ephemeralToken = clientSecretData.value;

  if (!ephemeralToken) {
    console.error("[Realtime Voice] client_secrets response missing token value");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "No ephemeral token in GA client_secrets response" }),
    };
  }
  // GA tokens start with "ek_"; anything else won't work with the GA WebSocket.
  if (!ephemeralToken.startsWith("ek_")) {
    console.error("[Realtime Voice] Token is not a GA ephemeral token (missing ek_ prefix)");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Invalid token format from GA client_secrets endpoint" }),
    };
  }

  const sessionId = clientSecretData.session?.id || undefined;
  console.log(`[Realtime Voice] Session created (token ${ephemeralToken.substring(0, 8)}..., voice ${voice})`);

  // Never return the real API key - only the short-lived ephemeral token.
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      ephemeralToken,
      model: "gpt-realtime",
      voice,
      session_id: sessionId,
      expires_at: clientSecretData.expires_at,
    }),
  };
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("[Realtime Voice] OPENAI_API_KEY not configured");
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "API key not configured. Please set OPENAI_API_KEY in environment variables." }),
      };
    }

    if (event.httpMethod === "GET") {
      const voice = event.queryStringParameters?.voice || "marin";
      return await createSession({ apiKey, voice, pageContext: null, headers });
    }

    if (event.httpMethod === "POST") {
      let body = {};
      if (event.body) {
        try {
          let bodyStr = event.body;
          if (event.isBase64Encoded && typeof bodyStr === "string") {
            bodyStr = Buffer.from(bodyStr, "base64").toString("utf-8");
          }
          if (typeof bodyStr === "string") {
            body = bodyStr.trim() === "" ? {} : JSON.parse(bodyStr);
          } else if (typeof bodyStr === "object") {
            body = bodyStr;
          }
        } catch (e) {
          console.error("[Realtime Voice] Error parsing request body:", e.message);
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "Invalid JSON in request body", details: e.message }),
          };
        }
      }

      return await createSession({
        apiKey,
        voice: body.voice || "marin",
        pageContext: parsePageContext(body.pageContext),
        headers,
      });
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        error: "Method not allowed",
        receivedMethod: event.httpMethod,
        allowedMethods: ["GET", "POST", "OPTIONS"],
      }),
    };
  } catch (error) {
    console.error("[Realtime Voice] Function error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error", message: error.message }),
    };
  }
};
