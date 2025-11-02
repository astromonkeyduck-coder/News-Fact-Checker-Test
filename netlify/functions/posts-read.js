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

    // Get IDs to fetch (first N)
    const idsToFetch = indexData.ids.slice(0, maxLimit);

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
    
    // Filter out nulls and return
    const validPosts = posts.filter(post => post !== null);

    console.log(`[posts-read] Returning ${validPosts.length} posts out of ${idsToFetch.length} requested`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(validPosts),
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

