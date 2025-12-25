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
    
    // Early validation - return 500 if credentials are missing (prevents 502 timeout)
    if (!siteID || !token) {
      console.error('[get-uploaded-image] Missing credentials', { hasSiteID: !!siteID, hasToken: !!token });
      return {
        statusCode: 500,
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ 
          error: "Storage configuration error",
          message: "Missing NETLIFY_SITE_ID or NETLIFY_BLOB_READ_WRITE_TOKEN"
        }),
      };
    }
    
    // Try multiple stores: post-media (new), newsletter-images, uploaded-images (legacy)
    const storeNames = ["post-media", "newsletter-images", "uploaded-images"];
    let store = null;
    let foundStore = null;
    
    // Try to find the media in any of the stores
    // Note: siteID and token are guaranteed to exist after early validation above
    for (const name of storeNames) {
      try {
        const testStore = getStore({
          name: name,
          siteID: siteID,
          token: token,
        });
        
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
    // Note: siteID and token are guaranteed to exist after early validation above
    if (!store) {
      try {
        store = getStore({
          name: storeNames[0],
          siteID: siteID,
          token: token,
        });
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
        console.warn('[get-uploaded-image] Image not found', { imageKey, foundStore });
        return {
          statusCode: 404,
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Media not found", key: imageKey }),
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
      // Handle both ArrayBuffer and Buffer types
      let imageBuffer;
      if (imageData instanceof ArrayBuffer) {
        imageBuffer = Buffer.from(imageData);
      } else if (Buffer.isBuffer(imageData)) {
        imageBuffer = imageData;
      } else {
        // Try to convert whatever we got
        imageBuffer = Buffer.from(imageData);
      }

      // Check buffer size to prevent timeout (Netlify has 10s timeout for free tier, 26s for pro)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (imageBuffer.length > maxSize) {
        console.warn('[get-uploaded-image] Image too large', { size: imageBuffer.length, key: imageKey });
        return {
          statusCode: 413,
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Image too large" }),
        };
      }

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
      console.error('[get-uploaded-image] Error retrieving image:', err, { imageKey, foundStore });
      return {
        statusCode: 500,
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ 
          error: "Failed to retrieve image",
          message: err.message,
          key: imageKey
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

