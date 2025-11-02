/**
 * Simple tweet fetcher using X oEmbed API
 * Free, no authentication required
 * Fetches tweets from a list of URLs and stores them
 */

import { Handler } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { fetchTweetOEmbed, extractTweetId, extractUsername } from "../../src/lib/posts/oembed-fetch";
import { normalizeTweetToCard, toTitle, readTimeFromText } from "../../src/lib/posts/normalize";
import { extractEnhancedData } from "../../src/lib/posts/enhanced-extract";

interface IndexData {
  ids: string[];
  urls: string[]; // Store URLs since we're using oEmbed
}

/**
 * Convert oEmbed response to our Card format with enhanced data
 */
function oEmbedToCard(oembed: any, tweetUrl: string): any {
  const tweetId = extractTweetId(tweetUrl);
  const username = extractUsername(tweetUrl);
  
  if (!tweetId) {
    throw new Error("Could not extract tweet ID from URL");
  }

  // Extract text from HTML
  const textMatch = oembed.html.match(/<p[^>]*>(.*?)<\/p>/s);
  const text = textMatch ? textMatch[1].replace(/<[^>]+>/g, '') : '';
  
  // Extract enhanced data (images, videos, date, stats)
  const enhanced = extractEnhancedData(tweetId, oembed.html);
  
  // Determine post type based on media
  let postType: "text" | "photo" | "video" = "text";
  if (enhanced.videos && enhanced.videos.length > 0) {
    postType = "video";
  } else if (enhanced.images && enhanced.images.length > 0) {
    postType = "photo";
  }
  
  // Use first image as main image for backward compatibility
  const mainImage = enhanced.images && enhanced.images.length > 0 ? enhanced.images[0] : null;
  
  return {
    id: tweetId,
    image: mainImage,
    images: enhanced.images.length > 0 ? enhanced.images : undefined,
    videos: enhanced.videos.length > 0 ? enhanced.videos : undefined,
    title: toTitle(text) || text.substring(0, 80) + (text.length > 80 ? '...' : ''),
    story: text,
    datePosted: enhanced.datePosted,
    link: tweetUrl,
    postType,
    readTime: readTimeFromText(text),
    views: enhanced.views,
    likes: enhanced.likes,
    reposts: enhanced.reposts,
    replies: enhanced.replies,
    author: oembed.author_name || username || 'Noteworthy News',
    authorUrl: oembed.author_url || (username ? `https://x.com/${username}` : undefined),
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

