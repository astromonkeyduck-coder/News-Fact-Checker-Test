import { Handler } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { createHmac } from "crypto";
import { normalizeTweetToCard } from "../../src/lib/posts/normalize";

const SKIP_REPLIES_AND_RTS = true;

interface IndexData {
  ids: string[];
}

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

  // Validate body structure
  if (!body || typeof body !== "object") {
    throw new Error("Invalid webhook payload");
  }

  // Check for tweet_create_events
  const tweetCreateEvents = body.tweet_create_events || [];
  
  if (!Array.isArray(tweetCreateEvents)) {
    return { status: "no events", processed: 0 };
  }

  // Get blob store
  const store = getStore({ name: "x-posts" });
  
  // Read current index
  let indexData: IndexData = { ids: [] };
  try {
    const indexBlob = await store.get("index.json", { type: "json" });
    if (indexBlob && Array.isArray((indexBlob as any).ids)) {
      indexData = indexBlob as IndexData;
    }
  } catch (err) {
    // Index doesn't exist yet, start fresh
    indexData = { ids: [] };
  }

  let processed = 0;
  const newIds: string[] = [];

  // Process each event
  for (const event of tweetCreateEvents) {
    // Skip if not from our user
    if (!event?.user || event.user.id_str !== userId) {
      continue;
    }

    // Skip retweets and replies if configured
    if (SKIP_REPLIES_AND_RTS) {
      if (event.retweeted_status || event.in_reply_to_status_id) {
        continue;
      }
    }

    const tweetId = event.id_str;
    if (!tweetId) {
      continue;
    }

    // Check for duplicates
    const postKey = `post-${tweetId}.json`;
    try {
      const existing = await store.get(postKey);
      if (existing) {
        // Already exists, skip
        continue;
      }
    } catch (err) {
      // Doesn't exist, continue
    }

    // Normalize tweet to Card
    try {
      const card = normalizeTweetToCard(event, event.user?.screen_name);
      
      // Store post
      await store.set(postKey, JSON.stringify(card), {
        contentType: "application/json",
      });

      // Add to index (prepend)
      newIds.push(tweetId);
      processed++;
    } catch (err) {
      // Log error but continue processing other events
      console.error(`Error processing tweet ${tweetId}:`, err);
    }
  }

  // Update index if we have new posts
  if (newIds.length > 0) {
    // Prepend new IDs and cap at 200
    const updatedIds = [...newIds, ...indexData.ids].slice(0, 200);
    await store.set("index.json", JSON.stringify({ ids: updatedIds }), {
      contentType: "application/json",
    });
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

