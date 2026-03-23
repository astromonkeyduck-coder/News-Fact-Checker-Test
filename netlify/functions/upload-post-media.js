/**
 * Upload images and videos for posts
 * POST /.netlify/functions/upload-post-media
 * Body: { image: base64DataUrl } or FormData with file
 */

const { getStore } = require("@netlify/blobs");
const { requireAdminAuth } = require("./middleware/requireAuth");

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

exports.handler = async (event, context) => {
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

  const auth = await requireAdminAuth(event);
  if (auth.statusCode) return auth;

  try {
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
      console.error('[upload-post-media] Failed to create store:', storeErr);
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({
          error: "Storage configuration error",
          message: storeErr.message,
        }),
      };
    }

    let imageData, contentType, fileExtension, fileName;

    // Handle JSON body with base64 image
    if (event.headers['content-type']?.includes('application/json')) {
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

      contentType = matches[1];
      const base64Content = matches[2];
      
      // Determine file extension
      if (contentType.includes('jpeg') || contentType.includes('jpg')) {
        fileExtension = 'jpg';
      } else if (contentType.includes('png')) {
        fileExtension = 'png';
      } else if (contentType.includes('gif')) {
        fileExtension = 'gif';
      } else if (contentType.includes('webp')) {
        fileExtension = 'webp';
      } else if (contentType.includes('video')) {
        if (contentType.includes('mp4')) {
          fileExtension = 'mp4';
        } else if (contentType.includes('webm')) {
          fileExtension = 'webm';
        } else if (contentType.includes('mov')) {
          fileExtension = 'mov';
        } else {
          fileExtension = 'mp4';
        }
      } else {
        fileExtension = 'png';
      }

      imageData = Buffer.from(base64Content, 'base64');
      fileName = body.fileName || `upload-${Date.now()}.${fileExtension}`;
    } 
    // Handle FormData (multipart/form-data)
    else if (event.headers['content-type']?.includes('multipart/form-data')) {
      // Netlify Functions automatically parses multipart/form-data
      // But we need to handle it differently - check if body is already parsed
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "FormData upload not yet supported. Please use JSON with base64 data." }),
      };
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Unsupported content type. Use application/json with base64 data." }),
      };
    }

    // Check file size (max 20MB)
    if (imageData.length > 20 * 1024 * 1024) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "File too large. Maximum size is 20MB." }),
      };
    }

    // Generate unique key for the media
    const timestamp = Date.now();
    const fileHash = Buffer.from(fileName || 'upload').toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    const mediaKey = `post-media-${timestamp}-${fileHash}.${fileExtension}`;

    console.log(`[upload-post-media] Storing media: ${fileName}, size: ${imageData.length} bytes, key: ${mediaKey}, type: ${contentType}`);

    // Store media in Netlify Blobs
    await store.set(mediaKey, imageData, {
      contentType: contentType,
    });

    console.log(`[upload-post-media] ✅ Media stored successfully: ${mediaKey}`);

    // Generate URL to retrieve the stored media
    const storedMediaUrl = `/.netlify/functions/get-uploaded-image?key=${encodeURIComponent(mediaKey)}`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        url: storedMediaUrl,
        key: mediaKey,
        contentType: contentType,
        size: imageData.length,
      }),
    };
  } catch (error) {
    console.error('[upload-post-media] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Failed to upload media",
        message: error.message,
      }),
    };
  }
};

