if (process.env.NETLIFY_DEV) {
  try {
    require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  } catch (e) {}
}

const {
  getPostStore,
  readIndex,
  readPost,
} = require("./lib/postStore");

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
    "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    "Netlify-CDN-Cache-Control": "public, max-age=60, stale-while-revalidate=300",
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
    const limit = parseInt(event.queryStringParameters?.limit || "30", 10);
    const maxLimit = Math.min(limit, 200);

    const store = getPostStore();

    // Direct lookup by ID
    const requestedId = event.queryStringParameters?.id;
    if (requestedId && requestedId.trim()) {
      const blobId = requestedId.trim().replace(/^post-/, "");
      const post = await readPost(store, blobId);
      if (post) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify([post]),
        };
      }
      // Legacy fallback: eq- prefix may still exist for older earthquake posts
      if (blobId.startsWith("usgs-")) {
        const eqPost = await readPost(store, `eq-${blobId.substring(5)}`);
        if (eqPost) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify([eqPost]),
          };
        }
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify([]),
      };
    }

    const ids = await readIndex(store);
    if (ids.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify([]),
      };
    }

    const idsToFetch = ids.slice(0, 200);

    console.log(`[posts-read] Fetching ${idsToFetch.length} posts (returning top ${maxLimit})`);

    const posts = await Promise.all(
      idsToFetch.map((id) => readPost(store, id))
    );

    const validPosts = posts.filter((post) => post !== null);

    validPosts.sort((a, b) => {
      const dateA = new Date(a.datePosted || a.createdAt || a.created_at || a.Date || 0);
      const dateB = new Date(b.datePosted || b.createdAt || b.created_at || b.Date || 0);
      return dateB.getTime() - dateA.getTime();
    });

    const topPosts = validPosts.slice(0, maxLimit);

    console.log(`[posts-read] Returning ${topPosts.length} of ${validPosts.length} valid posts`);

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

