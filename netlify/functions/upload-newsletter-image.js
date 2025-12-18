/**
 * Upload images for newsletter templates
 * POST /.netlify/functions/upload-newsletter-image
 * Body: { image: base64DataUrl, fileName?: string }
 * Returns: { success: true, url: string, key: string, contentType: string, size: number }
 */

const { getStore } = require("@netlify/blobs");

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

exports.handler = async (event, context) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const siteID = process.env.NETLIFY_SITE_ID || event.headers['x-nf-site-id'];
    const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN || event.headers['x-nf-token'];
    
    let store;
    try {
      if (siteID && token) {
        store = getStore({
          name: "newsletter-images",
          siteID: siteID,
          token: token,
        });
      } else {
        store = getStore({ name: "newsletter-images" });
      }
    } catch (storeErr) {
      console.error('[upload-newsletter-image] Failed to create store:', storeErr);
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({
          error: "Storage configuration error",
          message: storeErr.message,
        }),
      };
    }

    const body = JSON.parse(event.body || '{}');
    const base64Data = body.image || body.data;
    
    if (!base64Data) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing 'image' or 'data' field with base64 data" }),
      };
    }

    // Extract content type and data
    const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid base64 data format. Expected data:image/...;base64,..." }),
      };
    }

    const contentType = matches[1];
    const base64Content = matches[2];
    
    // Determine file extension
    let fileExtension = 'png';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) {
      fileExtension = 'jpg';
    } else if (contentType.includes('png')) {
      fileExtension = 'png';
    } else if (contentType.includes('gif')) {
      fileExtension = 'gif';
    } else if (contentType.includes('webp')) {
      fileExtension = 'webp';
    }

    const imageData = Buffer.from(base64Content, 'base64');
    const fileName = body.fileName || `newsletter-${Date.now()}.${fileExtension}`;

    // Check file size (max 10MB for newsletter images)
    if (imageData.length > 10 * 1024 * 1024) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "File too large. Maximum size is 10MB." }),
      };
    }

    // Generate unique key for the image
    const timestamp = Date.now();
    const fileHash = Buffer.from(fileName).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    const imageKey = `newsletter-${timestamp}-${fileHash}.${fileExtension}`;

    console.log(`[upload-newsletter-image] Storing image: ${fileName}, size: ${imageData.length} bytes, key: ${imageKey}, type: ${contentType}`);

    // Store image in Netlify Blobs
    await store.set(imageKey, imageData, {
      contentType: contentType,
    });

    console.log(`[upload-newsletter-image] ✅ Image stored successfully: ${imageKey}`);

    // Generate URL to retrieve the stored image
    const storedImageUrl = `/.netlify/functions/get-uploaded-image?key=${encodeURIComponent(imageKey)}`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        url: storedImageUrl,
        key: imageKey,
        contentType: contentType,
        size: imageData.length,
      }),
    };
  } catch (error) {
    console.error('[upload-newsletter-image] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Failed to upload image",
        message: error.message,
      }),
    };
  }
};




