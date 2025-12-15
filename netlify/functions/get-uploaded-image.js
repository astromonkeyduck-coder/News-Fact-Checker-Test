/**
 * Retrieve and serve uploaded images and videos stored in Netlify Blobs
 * GET /.netlify/functions/get-uploaded-image?key=upload-1234567890-abc123.png
 * Supports both "post-media" and "uploaded-images" stores
 */

const { getStore } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: "",
    };
  }

  try {
    if (event.httpMethod !== "GET") {
      return {
        statusCode: 405,
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ 
          error: "Method Not Allowed",
          receivedMethod: event.httpMethod,
          expectedMethod: "GET"
        }),
      };
    }

    const imageKey = event.queryStringParameters?.key;
    
    if (!imageKey) {
      return {
        statusCode: 400,
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ 
          error: "Missing 'key' query parameter",
          usage: "GET /.netlify/functions/get-uploaded-image?key=upload-1234567890-abc123.png"
        }),
      };
    }

    // Get siteID and token from environment
    const siteID = process.env.NETLIFY_SITE_ID || event.headers['x-nf-site-id'];
    const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN || event.headers['x-nf-token'];
    
    // Try multiple stores: post-media (new), newsletter-images, uploaded-images (legacy)
    const storeNames = ["post-media", "newsletter-images", "uploaded-images"];
    let store = null;
    let foundStore = null;
    
    // Try to find the media in any of the stores
    for (const name of storeNames) {
      try {
        let testStore;
        if (siteID && token) {
          testStore = getStore({
            name: name,
            siteID: siteID,
            token: token,
          });
        } else {
          testStore = getStore({ name: name });
        }
        
        // Try to get the item to see if it exists in this store
        try {
          const testData = await testStore.get(imageKey, { type: "arrayBuffer" });
          if (testData) {
            store = testStore;
            foundStore = name;
            break;
          }
        } catch (getErr) {
          // Item doesn't exist in this store, try next
          continue;
        }
      } catch (storeErr) {
        // Store creation failed, try next
        continue;
      }
    }
    
    // If not found in any store, use the first one as default (will return 404 later)
    if (!store) {
      try {
        if (siteID && token) {
          store = getStore({
            name: storeNames[0],
            siteID: siteID,
            token: token,
          });
        } else {
          store = getStore({ name: storeNames[0] });
        }
      } catch (storeErr) {
        console.error('[get-uploaded-image] Failed to create store:', storeErr);
        return {
          statusCode: 500,
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ 
            error: "Storage configuration error",
            message: storeErr.message 
          }),
        };
      }
    }

    // Check if requesting metadata
    if (imageKey.startsWith('metadata-')) {
      try {
        const metadata = await store.get(imageKey, { type: "json" });
        
        if (!metadata) {
          return {
            statusCode: 404,
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ error: "Metadata not found" }),
          };
        }

        return {
          statusCode: 200,
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(metadata),
        };
      } catch (err) {
        console.error('[get-uploaded-image] Error retrieving metadata:', err);
        return {
          statusCode: 500,
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ 
            error: "Failed to retrieve metadata",
            message: err.message 
          }),
        };
      }
    }

    // Retrieve image from Blobs
    try {
      const imageData = await store.get(imageKey, { type: "arrayBuffer" });
      
      if (!imageData) {
        return {
          statusCode: 404,
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Media not found" }),
        };
      }

      // Determine content type from key extension
      let contentType = "image/png";
      if (imageKey.endsWith('.jpg') || imageKey.endsWith('.jpeg')) {
        contentType = "image/jpeg";
      } else if (imageKey.endsWith('.gif')) {
        contentType = "image/gif";
      } else if (imageKey.endsWith('.webp')) {
        contentType = "image/webp";
      } else if (imageKey.endsWith('.svg')) {
        contentType = "image/svg+xml";
      } else if (imageKey.endsWith('.mp4')) {
        contentType = "video/mp4";
      } else if (imageKey.endsWith('.webm')) {
        contentType = "video/webm";
      } else if (imageKey.endsWith('.mov')) {
        contentType = "video/quicktime";
      }

      // Convert ArrayBuffer to Buffer for response
      const imageBuffer = Buffer.from(imageData);

      return {
        statusCode: 200,
        headers: {
          ...headers,
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable", // Cache for 1 year
        },
        body: imageBuffer.toString('base64'),
        isBase64Encoded: true,
      };
    } catch (err) {
      console.error('[get-uploaded-image] Error retrieving image:', err);
      return {
        statusCode: 500,
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ 
          error: "Failed to retrieve image",
          message: err.message 
        }),
      };
    }
  } catch (e) {
    console.error("get-uploaded-image function error:", e);
    return {
      statusCode: 500,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ 
        error: "Internal server error",
        message: e.message || "An unexpected error occurred"
      }),
    };
  }
};

