// JavaScript version of posts-read function for better compatibility
// Load environment variables if needed
if (process.env.NETLIFY_DEV) {
  try {
    require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  } catch (e) {
    // dotenv not needed if not available
  }
}

const { getStore } = require("@netlify/blobs");

/**
 * Read latest posts from blob storage
 */
exports.handler = async (event) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
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
    // Get limit from query (default 30)
    const limit = parseInt(event.queryStringParameters?.limit || "30", 10);
    const maxLimit = Math.min(limit, 200); // Cap at 200

    // Get siteID and token from environment (Netlify automatically sets these)
    // For Functions, we need to explicitly pass them if auto-detection fails
    const siteID = process.env.NETLIFY_SITE_ID || event.headers['x-nf-site-id'];
    const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN || event.headers['x-nf-token'];
    
    let store;
    try {
      // Try with explicit siteID and token if available
      if (siteID && token) {
        console.log('[posts-read] Using explicit siteID and token');
        store = getStore({
          name: "x-posts",
          siteID: siteID,
          token: token,
        });
      } else {
        // Fallback: try automatic detection (works in most Netlify environments)
        console.log('[posts-read] Using automatic detection');
        store = getStore({ name: "x-posts" });
      }
    } catch (storeErr) {
      console.error('[posts-read] Failed to create store:', storeErr);
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({
          error: "Storage configuration error",
          message: storeErr.message,
        }),
      };
    }

    // Read index
    let indexData = { ids: [] };
    try {
      const indexBlob = await store.get("index.json", { type: "json" });
      if (indexBlob && Array.isArray(indexBlob.ids)) {
        indexData = indexBlob;
      }
    } catch (err) {
      // Index doesn't exist yet - return empty array
      console.log('[posts-read] No index found, returning empty array');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify([]),
      };
    }

    // For small requests (<=10), only fetch what's needed. For larger requests, fetch a bit more for sorting.
    // This prevents fetching 1000 posts when only 5 are needed!
    let fetchLimit;
    if (maxLimit <= 10) {
      // For small requests, fetch 2x to ensure we have enough for sorting, but cap at 50
      fetchLimit = Math.min(maxLimit * 2, 50);
    } else if (maxLimit <= 50) {
      // For medium requests, fetch 1.5x, cap at 100
      fetchLimit = Math.min(Math.ceil(maxLimit * 1.5), 100);
    } else {
      // For large requests, fetch 1.2x, cap at 200
      fetchLimit = Math.min(Math.ceil(maxLimit * 1.2), 200);
    }
    const idsToFetch = indexData.ids.slice(0, fetchLimit);
    
    console.log(`[posts-read] Fetching ${idsToFetch.length} posts from index (requested ${maxLimit}, will sort and return top ${maxLimit})`);

    // Fetch all posts in parallel
    const postPromises = idsToFetch.map(async (id) => {
      const postKey = `post-${id}.json`;
      try {
        const postBlob = await store.get(postKey, { type: "json" });
        return postBlob;
      } catch (err) {
        // Post doesn't exist (maybe was deleted or index is stale)
        console.log(`[posts-read] Post ${id} not found`);
        return null;
      }
    });

    const posts = await Promise.all(postPromises);
    
    // Filter out nulls
    const validPosts = posts.filter(post => post !== null);
    
    // Sort by date (newest first) - this ensures recent posts appear first
    validPosts.sort((a, b) => {
      const dateA = new Date(a.datePosted || a.createdAt || a.created_at || a.Date || 0);
      const dateB = new Date(b.datePosted || b.createdAt || b.created_at || b.Date || 0);
      // Newest first (descending order)
      return dateB.getTime() - dateA.getTime();
    });
    
    // Return only the requested number of most recent posts
    const topPosts = validPosts.slice(0, maxLimit);

    console.log(`[posts-read] Fetched ${validPosts.length} valid posts, returning top ${topPosts.length} (newest first)`);
    
    // Log date range for debugging
    if (topPosts.length > 0) {
      const newestDate = new Date(topPosts[0].datePosted || topPosts[0].createdAt || topPosts[0].created_at || topPosts[0].Date || 0);
      const oldestDate = new Date(topPosts[topPosts.length - 1].datePosted || topPosts[topPosts.length - 1].createdAt || topPosts[topPosts.length - 1].created_at || topPosts[topPosts.length - 1].Date || 0);
      console.log(`[posts-read] Date range: ${oldestDate.toISOString()} to ${newestDate.toISOString()}`);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(topPosts),
    };
  } catch (error) {
    console.error('[posts-read] Error:', error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: error?.message || "Internal server error",
      }),
    };
  }
};

