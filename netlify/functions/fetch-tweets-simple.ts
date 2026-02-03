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
// XIRI METHOD: Try to extract media using photo page approach (like Discord bots)
import { extractTwitterMedia } from "../../src/lib/posts/twitter-media-extract";

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
  
  // XIRI METHOD: Also try scraping photo pages for media (like Discord bots do)
  // This gets media that oEmbed doesn't provide
  // Try headless browser first (if available), then fall back to static methods
  let scrapedMedia = { images: [], videos: [] };
  try {
    // Try headless browser first (for dynamically loaded media)
    // Set useHeadless=true to enable Puppeteer (requires puppeteer package)
    const useHeadless = process.env.ENABLE_HEADLESS_BROWSER === 'true';
    scrapedMedia = await extractTwitterMedia(tweetUrl, text, useHeadless);
    console.log(`[fetch-tweets-simple] Scraped media for ${tweetId}:`, {
      images: scrapedMedia.images.length,
      videos: scrapedMedia.videos.length,
      method: useHeadless ? 'headless' : 'static'
    });
  } catch (error) {
    console.warn(`[fetch-tweets-simple] Failed to scrape media for ${tweetId}:`, error);
  }
  
  // Combine oEmbed media with scraped media (scraped takes priority)
  const allImages = [...(scrapedMedia.images || []), ...(enhanced.images || [])];
  const allVideos = [...(scrapedMedia.videos || []), ...(enhanced.videos || [])];
  
  // Remove duplicates
  const uniqueImages = Array.from(new Set(allImages));
  const uniqueVideos = Array.from(new Set(allVideos));
  
  // Determine post type based on media
  let postType: "text" | "photo" | "video" = "text";
  if (uniqueVideos.length > 0) {
    postType = "video";
  } else if (uniqueImages.length > 0) {
    postType = "photo";
  }
  
  // Use first image as main image for backward compatibility
  const mainImage = uniqueImages.length > 0 ? uniqueImages[0] : null;
  
  // If date extraction failed, we need a fallback, but log a warning
  // The Snowflake extraction should work for all valid tweet IDs, so this is rare
  let datePosted = enhanced.datePosted;
  if (!datePosted) {
    console.warn('[fetch-tweets-simple] Date extraction failed for tweet:', tweetId, '- using current time as fallback');
    datePosted = new Date().toISOString();
  }
  
  return {
    id: tweetId,
    image: mainImage,
    primary_image_url: mainImage, // New field for hero module
    images: uniqueImages.length > 0 ? uniqueImages : undefined,
    videos: uniqueVideos.length > 0 ? uniqueVideos : undefined,
    video_url: uniqueVideos.length > 0 ? uniqueVideos[0] : undefined, // New field for hero module
    title: toTitle(text) || text.substring(0, 80) + (text.length > 80 ? '...' : ''),
    story: text,
    datePosted,
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

      // Check for duplicates in storage
      let postExists = false;
      try {
        const existing = await store.get(`post-${tweetId}.json`);
        if (existing) {
          postExists = true;
        }
      } catch {}
      
      // If post doesn't exist, fetch and create it
      if (!postExists) {
        // Convert to Card format
        const card = oEmbedToCard(oembed, tweetUrl);

        // Store post
        await store.set(`post-${tweetId}.json`, JSON.stringify(card), {
          contentType: "application/json",
        });
      } else {
        // Post already exists - preserve its existing datePosted if we're just re-adding to index
        // Don't overwrite with potentially incorrect date from oEmbed
        console.log('[fetch-tweets-simple] Post already exists, preserving existing data:', tweetId);
      }

      // Always update index (even if post already existed in storage)
      // This ensures posts are added to index if they were missing
      let indexData: IndexData = { ids: [], urls: [] };
      try {
        const indexBlob = await store.get("index.json", { type: "json" });
        if (indexBlob) {
          indexData = indexBlob as IndexData;
        }
      } catch {}

      // Smart index update: keep top-performing posts
      // Strategy: Always include top 50 by views, then add newest
      const existingIds = indexData.ids || [];
      const existingUrls = indexData.urls || [];
      
      // If post already exists in index, remove it first (will re-add at correct position)
      const filteredIds = existingIds.filter(id => id !== tweetId);
      const filteredUrls = existingUrls.filter((url, idx) => existingIds[idx] !== tweetId);
      
      // Prepend new post
      const newIds = [tweetId, ...filteredIds];
      const newUrls = [tweetUrl, ...filteredUrls];
      
      // If we have stats, prioritize high-view posts
      // For now, just cap at 200 and let rebuild-index handle optimization
      const updatedIds = newIds.slice(0, 200);
      const updatedUrls = newUrls.slice(0, 200);
      
      await store.set("index.json", JSON.stringify({ ids: updatedIds, urls: updatedUrls }), {
        contentType: "application/json",
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          id: tweetId,
          message: postExists ? "Tweet already existed, added to index" : "Tweet added successfully"
        }),
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

