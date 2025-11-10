/**
 * Retrieve and serve DALL-E images stored in Netlify Blobs
 * GET /.netlify/functions/get-dalle-image?key=image-1234567890-abc123.png
 */

const { getStore } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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
        headers,
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
          usage: "GET /.netlify/functions/get-dalle-image?key=image-1234567890-abc123.png"
        }),
      };
    }

    // Get siteID and token from environment
    const siteID = process.env.NETLIFY_SITE_ID || event.headers['x-nf-site-id'];
    const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN || event.headers['x-nf-token'];
    
    let store;
    try {
      if (siteID && token) {
        store = getStore({
          name: "dalle-images",
          siteID: siteID,
          token: token,
        });
      } else {
        store = getStore({ name: "dalle-images" });
      }
    } catch (storeErr) {
      console.error('[get-dalle-image] Failed to create store:', storeErr);
      return {
        statusCode: 503,
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Storage configuration error",
          message: storeErr.message,
        }),
      };
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
        console.error('[get-dalle-image] Error retrieving metadata:', err);
        return {
          statusCode: 500,
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Failed to retrieve metadata" }),
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
          body: JSON.stringify({ error: "Image not found" }),
        };
      }

      // Determine content type from key extension
      let contentType = "image/png";
      if (imageKey.endsWith('.jpg') || imageKey.endsWith('.jpeg')) {
        contentType = "image/jpeg";
      } else if (imageKey.endsWith('.webp')) {
        contentType = "image/webp";
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
      console.error('[get-dalle-image] Error retrieving image:', err);
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
    console.error("get-dalle-image function error:", e);
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

