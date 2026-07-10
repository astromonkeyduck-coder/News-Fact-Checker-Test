/**
 * Simple tweet fetcher using X oEmbed API
 * Free, no authentication required
 * Fetches tweets from a list of URLs and stores them
 */

import { Handler } from "@netlify/functions";
import { fetchTweetOEmbed, extractTweetId, extractUsername } from "../../src/lib/posts/oembed-fetch";
import { normalizeTweetToCard, toTitle, readTimeFromText } from "../../src/lib/posts/normalize";
import { extractEnhancedData } from "../../src/lib/posts/enhanced-extract";
import { extractTwitterMedia, type TwitterMedia } from "../../src/lib/posts/twitter-media-extract";

const {
  getPostStore,
  readIndex,
  readPost,
  writePost,
  addToIndex,
} = require("./lib/postStore");

/**
 * Convert oEmbed response to our Card format with enhanced data
 */
async function oEmbedToCard(oembed: any, tweetUrl: string): Promise<any> {
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
  let scrapedMedia: TwitterMedia = { images: [], videos: [] };
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

const { requireAdminAuth } = require("./middleware/requireAuth");

export const handler: Handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  // POST writes new tweets - require admin auth
  if (event.httpMethod === "POST") {
    const auth = await requireAdminAuth(event);
    if (auth.statusCode) return auth;
  }

  try {
    const store = getPostStore();

    // GET: Read posts
    if (event.httpMethod === "GET") {
      const ids = await readIndex(store);

      const limit = parseInt(event.queryStringParameters?.limit || "30", 10);
      const idsToFetch = ids.slice(0, Math.min(limit, 200));

      const posts = await Promise.all(
        idsToFetch.map((id: string) => readPost(store, id))
      );

      return {
        statusCode: 200,
        headers: {
          ...headers,
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
          "Netlify-CDN-Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
        body: JSON.stringify(posts.filter((p: any) => p !== null)),
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

      const existingPost = await readPost(store, tweetId);
      const postExists = !!existingPost;

      const card = await oEmbedToCard(oembed, tweetUrl);

      if (postExists && existingPost) {
        card.datePosted = existingPost.datePosted || card.datePosted;
        if (existingPost.views && (!card.views || existingPost.views > card.views)) {
          card.views = existingPost.views;
        }
        if (existingPost.likes && (!card.likes || existingPost.likes > card.likes)) {
          card.likes = existingPost.likes;
        }
        if (existingPost.reposts && (!card.reposts || existingPost.reposts > card.reposts)) {
          card.reposts = existingPost.reposts;
        }
        if (existingPost.replies && (!card.replies || existingPost.replies > card.replies)) {
          card.replies = existingPost.replies;
        }
        if (existingPost.story && !card.story) {
          card.story = existingPost.story;
          card.text = existingPost.story;
        }
        console.log('[fetch-tweets-simple] Post already exists, updating with fresh media extraction:', tweetId);
      }

      await writePost(store, tweetId, card);
      await addToIndex(store, tweetId);

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

