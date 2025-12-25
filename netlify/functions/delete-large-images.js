/**
 * Delete old large earthquake images that exceed size limit
 * This removes images that were generated before compression was enabled
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
    // Get credentials
    const siteID = process.env.NETLIFY_SITE_ID || event.headers['x-nf-site-id'];
    const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN || event.headers['x-nf-token'];

    let store;
    try {
      if (siteID && token) {
        store = getStore({
          name: "post-media",
          siteID: siteID,
          token: token,
        });
      } else {
        store = getStore({ name: "post-media" });
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

    // List all earthquake images
    const maxSize = 4.5 * 1024 * 1024; // 4.5MB limit
    const deleted = [];
    const kept = [];

    // Note: Netlify Blobs doesn't have a direct list method
    // We'll need to track images differently or delete them from posts
    // For now, this function will need to be called with specific image keys
    // or we can delete all earthquake images and let them regenerate

    const imageKeys = event.queryStringParameters?.keys;
    if (imageKeys) {
      // Delete specific images
      const keys = imageKeys.split(',');
      for (const key of keys) {
        try {
          const imageData = await store.get(key, { type: "arrayBuffer" });
          if (imageData && imageData.byteLength > maxSize) {
            await store.delete(key);
            deleted.push({ key, size: imageData.byteLength });
          } else {
            kept.push({ key, size: imageData?.byteLength || 0 });
          }
        } catch (err) {
          // Image doesn't exist or error
          console.error(`Error processing ${key}:`, err);
        }
      }
    } else {
      // Delete all earthquake images (they'll regenerate with compression)
      // This is a nuclear option - use with caution
      const deleteAll = event.queryStringParameters?.deleteAll === 'true';
      if (deleteAll) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: "Bulk delete not supported. Use ?keys=key1,key2,key3 to delete specific images",
            message: "To delete all, you'll need to list them first or delete posts which will remove image references"
          }),
        };
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: `Processed ${deleted.length + kept.length} images`,
        deleted: deleted.length,
        kept: kept.length,
        deletedImages: deleted,
      }),
    };
  } catch (error) {
    console.error("Error deleting large images:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || "Internal server error",
      }),
    };
  }
};

