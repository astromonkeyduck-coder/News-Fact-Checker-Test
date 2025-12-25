/**
 * Remove long posts from volcano and weather alerts
 * This function removes posts that are too verbose
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
    const siteID = process.env.NETLIFY_SITE_ID;
    const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN;

    if (!siteID || !token) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Missing credentials" }),
      };
    }

    const store = getStore({
      name: "x-posts",
      siteID: siteID,
      token: token,
    });

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
          // (it might be a transient issue, or already deleted)
          kept.push(postId);
          continue;
        }

        // Remove volcano and weather posts that are too long
        const isVolcano = post.category === 'Volcano Alert' || post.source === 'USGS' && post.event_type === 'volcano';
        const isWeather = post.category === 'Weather Alert' || post.source === 'NWS' || post.event_type === 'weather';
        
        // Check if post is too long (more than 300 characters in story/text)
        const storyLength = (post.story || post.text || '').length;
        const isTooLong = storyLength > 300;

        if ((isVolcano || isWeather) && isTooLong) {
          shouldRemove = true;
        } else {
          // Post should be kept
          kept.push(postId);
          continue;
        }
        
        // If we determined the post should be removed, try to delete it
        if (shouldRemove) {
          try {
            // Only remove from index if deletion succeeds
            await store.delete(postKey);
            removed.push({
              id: postId,
              category: post.category,
              source: post.source,
              length: storyLength,
              title: post.title,
            });
            // Don't add to kept - it's been successfully removed
          } catch (deleteErr) {
            // Deletion failed - keep the post in the index to prevent orphaned data
            console.error(`Error deleting post ${postId}:`, deleteErr);
            kept.push(postId);
          }
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
        message: `Removed ${removed.length} long posts`,
        removed: removed.length,
        kept: kept.length,
        details: removed,
      }),
    };
  } catch (error) {
    console.error("Error removing posts:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || "Internal server error",
      }),
    };
  }
};

