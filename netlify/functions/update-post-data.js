/**
 * Update individual post data (dates, stats)
 * This function allows updating existing posts with correct dates and engagement stats
 */

const { getStore } = require("@netlify/blobs");

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "PATCH, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    const siteID = process.env.NETLIFY_SITE_ID || event.headers['x-nf-site-id'];
    const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN || event.headers['x-nf-token'];
    
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
    } catch (storeErr) {
      console.error('[update-post-data] Failed to create store:', storeErr);
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({
          error: "Storage configuration error",
          message: storeErr.message,
        }),
      };
    }

    if (event.httpMethod === "POST" || event.httpMethod === "PATCH") {
      const body = JSON.parse(event.body || "{}");
      const { postId, datePosted, views, likes, reposts, replies, engagements, bookmarks, shares } = body;

      if (!postId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "postId is required" }),
        };
      }

      try {
        // Get existing post
        const postKey = `post-${postId}.json`;
        let post = null;
        
        try {
          const existing = await store.get(postKey, { type: "json" });
          post = existing;
        } catch (err) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: `Post ${postId} not found` }),
          };
        }

        // Update post with new data
        // Ensure ID and link are preserved (they might be missing in corrupted posts)
        const updatedPost = {
          ...post,
          id: post.id || postId, // Ensure ID is always set
          link: post.link || `https://x.com/newsnoteworthy/status/${postId}`, // Ensure link is always set
          ...(datePosted && { datePosted }),
          ...(views !== undefined && { views }),
          ...(likes !== undefined && { likes }),
          ...(reposts !== undefined && { reposts }),
          ...(replies !== undefined && { replies }),
          ...(engagements !== undefined && { engagements }),
          ...(bookmarks !== undefined && { bookmarks }),
          ...(shares !== undefined && { shares }),
        };

        // Save updated post
        await store.setJSON(postKey, updatedPost);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, post: updatedPost }),
        };
      } catch (error) {
        console.error('[update-post-data] Error:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: error?.message || "Failed to update post",
          }),
        };
      }
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  } catch (error) {
    console.error('[update-post-data] Fatal error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error?.message || "Internal server error",
      }),
    };
  }
};

