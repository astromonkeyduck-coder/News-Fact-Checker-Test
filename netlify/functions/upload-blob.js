/**
 * Netlify Function: Upload Blob for Clemens Converter
 * 
 * Handles direct file uploads to Netlify Blobs storage.
 * Used when R2 is not configured or for smaller files.
 * 
 * Security: Uses token-based authentication from get-upload-url.
 */

const { getStore } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Clems-Token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Blob storage not configured" }),
      };
    }

    // Get upload token from query
    const uploadToken = event.queryStringParameters?.token;
    if (!uploadToken) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing upload token" }),
      };
    }

    const store = getStore({
      name: "clemens-uploads",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
    });

    // Retrieve token info
    const tokenDataStr = await store.get(`token:${uploadToken}`);
    if (!tokenDataStr) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Invalid or expired upload token" }),
      };
    }

    const tokenData = JSON.parse(tokenDataStr);
    
    // Check expiration
    if (Date.now() > tokenData.expiresAt) {
      await store.delete(`token:${uploadToken}`);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Upload token expired" }),
      };
    }

    // Get file data from body
    // Handle multipart/form-data (FormData uploads)
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    let fileBuffer;

    if (contentType.includes('multipart/form-data')) {
      // Parse multipart form data
      const boundaryMatch = contentType.match(/boundary=([^;\s]+)/);
      if (!boundaryMatch) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Invalid multipart form data" }),
        };
      }

      const boundary = boundaryMatch[1].trim();
      let bodyText = event.body;

      // Decode if base64 encoded
      if (event.isBase64Encoded && bodyText) {
        bodyText = Buffer.from(bodyText, 'base64').toString('binary');
      }

      // Split by boundary and find file part
      const parts = bodyText.split(`--${boundary}`);
      let foundFile = false;

      for (const part of parts) {
        // Look for the file field (name="file")
        if (part.includes('Content-Disposition') && (part.includes('name="file"') || part.includes("name='file'"))) {
          // Extract content after headers (look for double CRLF or double LF)
          const contentMatch = part.match(/(?:\r\n\r\n|\n\n)([\s\S]+?)(?:\r\n--|\n--|$)/);
          if (contentMatch) {
            const fileContent = contentMatch[1];
            // Remove trailing boundary markers if present
            const cleanContent = fileContent.replace(/--\s*$/, '').trim();
            fileBuffer = Buffer.from(cleanContent, 'binary');
            foundFile = true;
            break;
          }
        }
      }

      if (!foundFile) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "No file found in form data" }),
        };
      }
    } else {
      // Handle raw binary or base64 encoded body
      const fileData = event.body;
      if (!fileData) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "No file data provided" }),
        };
      }

      // Convert base64 to buffer if needed, or use raw body
      if (event.isBase64Encoded) {
        fileBuffer = Buffer.from(fileData, "base64");
      } else {
        fileBuffer = Buffer.from(fileData, "binary");
      }
    }

    // Validate file size
    if (fileBuffer.length > tokenData.fileSize * 1.1) {
      // Allow 10% tolerance
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "File size mismatch" }),
      };
    }

    // Store file in Blobs
    await store.set(tokenData.objectKey, fileBuffer, {
      metadata: {
        fileName: tokenData.fileName,
        uploadedAt: Date.now(),
        fileSize: fileBuffer.length,
      },
    });

    // Clean up token
    await store.delete(`token:${uploadToken}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        objectKey: tokenData.objectKey,
        fileName: tokenData.fileName,
        fileSize: fileBuffer.length,
      }),
    };
  } catch (error) {
    console.error("[upload-blob] Error:", error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: "Failed to upload file",
        message: error.message,
      }),
    };
  }
};
