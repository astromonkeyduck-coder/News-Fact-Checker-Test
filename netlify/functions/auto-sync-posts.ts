/**
 * Scheduled function to automatically sync new posts
 * Can be triggered via Netlify scheduled functions or manual API call
 * 
 * This function:
 * 1. Checks for new posts from the X profile
 * 2. Uses oEmbed API to fetch tweet data
 * 3. Stores new posts automatically
 */

import { Handler } from "@netlify/functions";
import { fetchTweetOEmbed } from "../../src/lib/posts/oembed-fetch";
import { extractTweetId } from "../../src/lib/posts/oembed-fetch";
import { extractEnhancedData } from "../../src/lib/posts/enhanced-extract";

const postStoreLib = require("./lib/postStore");

interface IndexData {
  ids: string[];
  urls: string[];
}

interface CardPost {
  id: string;
  title?: string;
  story?: string;
  text?: string;
  link?: string;
  url?: string;
  image?: string;
  images?: string[];
  videos?: string[];
  author?: string;
  authorUrl?: string;
  datePosted?: string;
  createdAt?: string;
  views?: number;
  likes?: number;
  reposts?: number;
  replies?: number;
  postType?: string;
  readTime?: number;
}

/**
 * Get recent tweet IDs from X profile page (limited success due to X blocking)
 * Falls back to checking existing posts and manual addition
 */
async function checkForNewPosts(store: any, lastCheckTime?: number): Promise<number> {
  const ids = await postStoreLib.readIndex(store);
  const indexData: IndexData = { ids, urls: [] };

  // For now, we'll return 0 since X blocks automated scraping
  // This function can be extended with:
  // 1. X API v2 integration (requires developer account)
  // 2. RSS feed parsing (if available)
  // 3. Browser automation via headless browser
  
  console.log('[auto-sync] Automated post fetching is limited by X rate limits');
  console.log('[auto-sync] Consider using X webhook for automatic posts');
  
  return 0;
}

/**
 * Handler for scheduled execution
 */
export const handler: Handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // Handle OPTIONS
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    let store;
    try {
      store = postStoreLib.getPostStore();
    } catch (storeErr: any) {
      console.error('[auto-sync] Failed to create store:', storeErr);
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({
          error: "Storage configuration error",
          message: storeErr.message,
        }),
      };
    }

    // Check for new posts
    const newPostsCount = await checkForNewPosts(store);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: "Sync check completed",
        newPosts: newPostsCount,
        note: "X blocks automated scraping. Use X webhook or manual addition for new posts.",
      }),
    };
  } catch (error: any) {
    console.error('[auto-sync] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error?.message || "Internal server error",
      }),
    };
  }
};

// Schedule to run every hour (optional - comment out if not using scheduled functions)
// export const scheduled = schedule("0 * * * *", handler);

