const { getStore } = require("@netlify/blobs");

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { postId } = JSON.parse(event.body || "{}");
    
    if (!postId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "postId is required" }),
      };
    }

    const siteID = process.env.NETLIFY_SITE_ID;
    const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN;
    
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
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({
          error: "Storage configuration error",
          message: storeErr.message,
        }),
      };
    }

    // Get current index
    let indexData = { ids: [], urls: [] };
    try {
      const indexBlob = await store.get("index.json", { type: "json" });
      if (indexBlob) {
        indexData = indexBlob;
      }
    } catch (err) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Index not found" }),
      };
    }

    // Check if post is in index
    if (!indexData.ids || !indexData.ids.includes(postId)) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: `Post ${postId} is not in the index`,
          removed: false
        }),
      };
    }

    // Delete post from storage (if it exists)
    const postKey = `post-${postId}.json`;
    let deletedFromStorage = false;
    try {
      const postExists = await store.get(postKey);
      if (postExists) {
        await store.delete(postKey);
        deletedFromStorage = true;
        console.log(`[remove-post] Deleted post ${postId} from storage`);
      }
    } catch (err) {
      // Post doesn't exist in storage, that's okay
      console.log(`[remove-post] Post ${postId} not found in storage (may have been deleted already)`);
    }

    // Remove post from index
    const existingIds = indexData.ids || [];
    const existingUrls = indexData.urls || [];
    
    // Filter out the post ID (remove all instances to prevent duplicates)
    const filteredIds = existingIds.filter(id => id !== postId);
    const filteredUrls = existingUrls.filter((url, idx) => existingIds[idx] !== postId);
    
    let removedFromIndex = false;
    if (filteredIds.length < existingIds.length) {
      // Save updated index
      await store.set("index.json", JSON.stringify({ ids: filteredIds, urls: filteredUrls }), {
        contentType: "application/json",
      });
      removedFromIndex = true;
      console.log(`[remove-post] Removed post ${postId} from index`);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: `Post ${postId} deleted${removedFromIndex ? ' from index' : ''}${deletedFromStorage ? ' and storage' : ''}`,
        removed: removedFromIndex || deletedFromStorage,
        deletedFromStorage: deletedFromStorage,
        removedFromIndex: removedFromIndex,
        previousCount: existingIds.length,
        newCount: filteredIds.length
      }),
    };
  } catch (error) {
    console.error('[remove-post] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error?.message || "Failed to remove post",
      }),
    };
  }
};









