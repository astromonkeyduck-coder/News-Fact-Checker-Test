/**
 * Remove old alert posts (earthquake, weather, volcano, etc.)
 * This function removes alert posts that are older than a specified date
 */

const { getStore } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    // Get credentials (try multiple sources)
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
        // Fallback: try automatic detection
        store = getStore({ name: "x-posts" });
      }
    } catch (storeErr) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: "Storage configuration error",
          message: storeErr.message 
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
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: "No index found", removed: 0 }),
      };
    }

    // Get cutoff date (default: remove posts older than 7 days)
    const daysOld = parseInt(event.queryStringParameters?.days || "7", 10);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffTimestamp = cutoffDate.getTime();

    const removed = [];
    const kept = [];

    // Check each post
    for (const postId of indexData.ids) {
      const postKey = `post-${postId}.json`;
      let post = null;
      let shouldRemove = false;
      
      try {
        // Try to read the post
        post = await store.get(postKey, { type: "json" });
        
        if (!post) {
          // Post doesn't exist in blob storage, but is in index - keep it in index for now
          kept.push(postId);
          continue;
        }

        // Check if it's an alert post
        const isAlertPost = 
          post.category === 'Earthquake' ||
          post.category === 'Weather Alert' ||
          post.category === 'Volcano Alert' ||
          post.category === 'Embassy Alert' ||
          post.source === 'USGS' ||
          post.source === 'NWS' ||
          post.event_type === 'earthquake' ||
          post.event_type === 'weather' ||
          post.event_type === 'volcano' ||
          post.event_type === 'embassy';

        if (isAlertPost) {
          // Check if post is older than cutoff date
          const postDate = post.datePosted || post.createdAt || post.created_at;
          if (postDate) {
            const postTimestamp = new Date(postDate).getTime();
            if (postTimestamp < cutoffTimestamp) {
              shouldRemove = true;
            }
          }
        }

        if (shouldRemove) {
          try {
            // Only remove from index if deletion succeeds
            await store.delete(postKey);
            removed.push({
              id: postId,
              category: post.category,
              source: post.source,
              datePosted: post.datePosted,
              title: post.title,
            });
            // Don't add to kept - it's been successfully removed
          } catch (deleteErr) {
            // Deletion failed - keep the post in the index to prevent orphaned data
            console.error(`Error deleting post ${postId}:`, deleteErr);
            kept.push(postId);
          }
        } else {
          // Post should be kept
          kept.push(postId);
        }
      } catch (err) {
        // Error reading post - keep it in index to be safe (prevents orphaned data)
        console.error(`Error processing post ${postId}:`, err);
        kept.push(postId);
      }
    }

    // Update index to only include kept posts
    await store.set("index.json", JSON.stringify({ ids: kept }), {
      contentType: "application/json",
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: `Removed ${removed.length} old alert posts (older than ${daysOld} days)`,
        removed: removed.length,
        kept: kept.length,
        cutoffDate: cutoffDate.toISOString(),
        details: removed,
      }),
    };
  } catch (error) {
    console.error("Error removing old alert posts:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || "Internal server error",
      }),
    };
  }
};

