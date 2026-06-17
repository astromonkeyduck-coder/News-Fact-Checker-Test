import { Handler } from "@netlify/functions";
import { createHmac } from "crypto";
import { normalizeTweetToCard } from "../../src/lib/posts/normalize";

const {
  getPostStore,
  readPost,
  writePost,
  addToIndex,
} = require("./lib/postStore");

const SKIP_REPLIES_AND_RTS = true;

/**
 * Handle CRC challenge (GET request with crc_token)
 */
async function handleCRC(crcToken: string): Promise<{ response_token: string }> {
  const consumerSecret = process.env.X_CONSUMER_SECRET;
  
  if (!consumerSecret) {
    throw new Error("X_CONSUMER_SECRET not configured");
  }

  // Generate HMAC SHA256
  const hmac = createHmac("sha256", consumerSecret)
    .update(crcToken)
    .digest("base64");

  return {
    response_token: `sha256=${hmac}`,
  };
}

/**
 * Handle webhook events (POST request)
 */
async function handleWebhookEvent(body: any): Promise<{ status: string; processed: number }> {
  const userId = process.env.X_USER_ID;
  
  if (!userId) {
    throw new Error("X_USER_ID not configured");
  }

  if (!body || typeof body !== "object") {
    throw new Error("Invalid webhook payload");
  }

  const tweetCreateEvents = body.tweet_create_events || [];
  
  if (!Array.isArray(tweetCreateEvents)) {
    return { status: "no events", processed: 0 };
  }

  const store = getPostStore();

  let processed = 0;
  const newIds: string[] = [];

  for (const event of tweetCreateEvents) {
    if (!event?.user || event.user.id_str !== userId) {
      continue;
    }

    if (SKIP_REPLIES_AND_RTS) {
      if (event.retweeted_status || event.in_reply_to_status_id) {
        continue;
      }
    }

    const tweetId = event.id_str;
    if (!tweetId) {
      continue;
    }

    const existing = await readPost(store, tweetId);
    if (existing) {
      continue;
    }

    try {
      const card = normalizeTweetToCard(event, event.user?.screen_name);
      await writePost(store, tweetId, card);
      newIds.push(tweetId);
      processed++;

      try {
        const { notifyXPostLiveActivity } = require("./lib/xPostLiveActivityNotify");
        await notifyXPostLiveActivity({
          post: {
            id: tweetId,
            slug: card.slug,
            title: card.title,
            text: card.text || card.story,
            story: card.story,
          },
          logger: console,
        });
      } catch (laErr: any) {
        console.warn(`[x-webhook] Live Activity skipped for ${tweetId}:`, laErr?.message);
      }
    } catch (err) {
      console.error(`Error processing tweet ${tweetId}:`, err);
    }
  }

  if (newIds.length > 0) {
    await addToIndex(store, newIds);
  }

  return { status: "ok", processed };
}

/**
 * Main handler
 */
export const handler: Handler = async (event, context) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };

  // Handle OPTIONS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: "",
    };
  }

  try {
    // Handle GET (CRC challenge)
    if (event.httpMethod === "GET") {
      const crcToken = event.queryStringParameters?.crc_token;
      
      if (!crcToken) {
        // Plain GET without crc_token - return ok status for health check
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ ok: true }),
        };
      }

      const response = await handleCRC(crcToken);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(response),
      };
    }

    // Handle POST (webhook events)
    if (event.httpMethod === "POST") {
      let body: any;
      try {
        body = JSON.parse(event.body || "{}");
      } catch (parseError) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Invalid JSON" }),
        };
      }

      const result = await handleWebhookEvent(body);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result),
      };
    }

    // Method not allowed
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error?.message || "Internal server error",
      }),
    };
  }
};

