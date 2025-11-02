/**
 * Simple tweet fetcher using X oEmbed API
 * Free, no authentication required
 * Fetches tweets from a list of URLs and stores them
 */

import { Handler } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { fetchTweetOEmbed, extractTweetId, extractUsername } from "../../src/lib/posts/oembed-fetch";
import { normalizeTweetToCard } from "../../src/lib/posts/normalize";

interface IndexData {
  ids: string[];
  urls: string[]; // Store URLs since we're using oEmbed
}

/**
 * Convert oEmbed response to our Card format
 */
function oEmbedToCard(oembed: any, tweetUrl: string): any {
  const tweetId = extractTweetId(tweetUrl);
  const username = extractUsername(tweetUrl);
  
  if (!tweetId) {
    throw new Error("Could not extract tweet ID from URL");
  }

  // Extract text from HTML (basic, can be improved)
  const textMatch = oembed.html.match(/<p[^>]*>(.*?)<\/p>/s);
  const text = textMatch ? textMatch[1].replace(/<[^>]+>/g, '') : '';
  
  // Extract image if present (oEmbed doesn't always include media)
  // We'd need to parse the HTML or use a different approach
  
  return {
    id: tweetId,
    image: null, // oEmbed doesn't provide images directly
    title: text.substring(0, 80) + (text.length > 80 ? '...' : ''),
    story: text,
    datePosted: new Date().toISOString(), // oEmbed doesn't provide date
    link: tweetUrl,
    postType: 'text' as const,
    readTime: Math.ceil((text.split(/\s+/).length) / 200) || 1,
  };
}

export const handler: Handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    // Get siteID and token from environment
    const siteID = process.env.NETLIFY_SITE_ID || (event as any).headers?.['x-nf-site-id'];
    const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN || (event as any).headers?.['x-nf-token'];
    
    let store;
    try {
      if (siteID && token) {
        store = getStore({
          name: "x-posts",
          siteID: siteID,
          token: token,
        });
      } else {
        store = getStore({ name: "x-posts" });
      }
    } catch (storeErr: any) {
      console.error('[fetch-tweets-simple] Failed to create store:', storeErr);
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({
          error: "Storage configuration error",
          message: storeErr.message,
        }),
      };
    }

    // GET: Read posts
    if (event.httpMethod === "GET") {
      let indexData: IndexData = { ids: [], urls: [] };
      try {
        const indexBlob = await store.get("index.json", { type: "json" });
        if (indexBlob && Array.isArray((indexBlob as any).ids)) {
          indexData = indexBlob as IndexData;
        }
      } catch (err) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify([]),
        };
      }

      const limit = parseInt(event.queryStringParameters?.limit || "30", 10);
      const idsToFetch = indexData.ids.slice(0, Math.min(limit, 200));

      const posts = await Promise.all(
        idsToFetch.map(async (id) => {
          try {
            const post = await store.get(`post-${id}.json`, { type: "json" });
            return post;
          } catch {
            return null;
          }
        })
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(posts.filter(p => p !== null)),
      };
    }

    // POST: Add tweet URL to fetch
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { tweetUrl } = body;

      if (!tweetUrl || typeof tweetUrl !== "string") {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "tweetUrl is required" }),
        };
      }

      // Fetch via oEmbed
      const oembed = await fetchTweetOEmbed(tweetUrl);
      const tweetId = extractTweetId(tweetUrl);
      
      if (!tweetId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Invalid tweet URL" }),
        };
      }

      // Check for duplicates
      try {
        const existing = await store.get(`post-${tweetId}.json`);
        if (existing) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: "Tweet already exists", id: tweetId }),
          };
        }
      } catch {}

      // Convert to Card format
      const card = oEmbedToCard(oembed, tweetUrl);

      // Store post
      await store.set(`post-${tweetId}.json`, JSON.stringify(card), {
        contentType: "application/json",
      });

      // Update index
      let indexData: IndexData = { ids: [], urls: [] };
      try {
        const indexBlob = await store.get("index.json", { type: "json" });
        if (indexBlob) {
          indexData = indexBlob as IndexData;
        }
      } catch {}

      const updatedIds = [tweetId, ...indexData.ids].slice(0, 200);
      const updatedUrls = [tweetUrl, ...indexData.urls].slice(0, 200);
      
      await store.set("index.json", JSON.stringify({ ids: updatedIds, urls: updatedUrls }), {
        contentType: "application/json",
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, id: tweetId }),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error?.message || "Internal server error" }),
    };
  }
};

