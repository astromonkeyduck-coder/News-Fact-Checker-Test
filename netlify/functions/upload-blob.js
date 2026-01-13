/**
 * Netlify Function: Upload Blob for Clemens Converter
 * 
 * Handles direct file uploads to Netlify Blobs storage.
 * Used when R2 is not configured or for smaller files.
 * 
 * Security: Uses token-based authentication from get-upload-url.
 */

// CRITICAL: Log immediately to verify function is loading
console.log('[upload-blob] 🔄 Function module loading...');

let getStore;
try {
  const blobs = require("@netlify/blobs");
  getStore = blobs.getStore;
  console.log('[upload-blob] ✅ @netlify/blobs loaded successfully');
} catch (error) {
  console.error('[upload-blob] ❌ Failed to load @netlify/blobs:', error);
  // Continue anyway - will fail later with better error
}

exports.handler = async (event, context) => {
  // CRITICAL: Log function invocation immediately
  console.log('[upload-blob] 🚀 FUNCTION INVOKED', {
    httpMethod: event.httpMethod,
    hasBody: !!event.body,
    bodyLength: event.body?.length || 0,
    hasToken: !!event.queryStringParameters?.token,
    timestamp: new Date().toISOString()
  });

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Clems-Token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    console.log('[upload-blob] ⚙️ OPTIONS request - returning 204');
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
    console.log('[upload-blob] 📋 Checking environment variables...');
    console.log('[upload-blob] NETLIFY_SITE_ID:', process.env.NETLIFY_SITE_ID ? 'SET' : 'MISSING');
    console.log('[upload-blob] NETLIFY_BLOB_READ_WRITE_TOKEN:', process.env.NETLIFY_BLOB_READ_WRITE_TOKEN ? 'SET' : 'MISSING');
    
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
      console.error('[upload-blob] ❌ Blob storage not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: "Blob storage not configured",
          hint: "Set NETLIFY_SITE_ID and NETLIFY_BLOB_READ_WRITE_TOKEN environment variables"
        }),
      };
    }
    
    if (!getStore) {
      console.error('[upload-blob] ❌ getStore function not available');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: "Blob storage module not loaded",
          hint: "Check that @netlify/blobs is installed"
        }),
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

    console.log("[upload-blob] Content-Type:", contentType);
    console.log("[upload-blob] isBase64Encoded:", event.isBase64Encoded);
    console.log("[upload-blob] Body length:", event.body ? event.body.length : 0);

    if (contentType.includes('multipart/form-data')) {
      // Parse multipart form data
      const boundaryMatch = contentType.match(/boundary=([^;\s]+)/);
      if (!boundaryMatch) {
        console.error("[upload-blob] No boundary found in Content-Type");
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Invalid multipart form data: no boundary" }),
        };
      }

      const boundary = boundaryMatch[1].trim();
      let bodyBuffer;

      // Get body as buffer
      if (event.isBase64Encoded && event.body) {
        bodyBuffer = Buffer.from(event.body, 'base64');
      } else if (event.body) {
        // If body is a string, convert to buffer
        if (typeof event.body === 'string') {
          bodyBuffer = Buffer.from(event.body, 'binary');
        } else {
          bodyBuffer = Buffer.from(event.body);
        }
      } else {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "No body data provided" }),
        };
      }

      // Convert buffer to string for parsing (multipart uses text boundaries)
      const bodyText = bodyBuffer.toString('binary');
      
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
            // Convert back to buffer from binary string
            fileBuffer = Buffer.from(cleanContent, 'binary');
            foundFile = true;
            console.log("[upload-blob] Found file in multipart, size:", fileBuffer.length);
            break;
          }
        }
      }

      if (!foundFile) {
        console.error("[upload-blob] File not found in multipart data");
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
      } else if (typeof fileData === 'string') {
        fileBuffer = Buffer.from(fileData, "binary");
      } else {
        fileBuffer = Buffer.from(fileData);
      }
      
      console.log("[upload-blob] File buffer size:", fileBuffer.length);
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
    // Log full error details
    console.error("[upload-blob] Error:", error);
    console.error("[upload-blob] Error name:", error.name);
    console.error("[upload-blob] Error message:", error.message);
    console.error("[upload-blob] Stack:", error.stack);
    console.error("[upload-blob] Event body type:", typeof event.body);
    console.error("[upload-blob] Event body length:", event.body ? event.body.length : 0);
    
    // Always return JSON, never HTML
    const errorMessage = error.message || "Failed to upload file";
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: "Failed to upload file",
        message: errorMessage,
        // Include helpful details for debugging
        hint: error.message?.includes("not configured") 
          ? "Check NETLIFY_SITE_ID and NETLIFY_BLOB_READ_WRITE_TOKEN environment variables"
          : error.message?.includes("getStore")
          ? "Blob store may not exist. Create 'clemens-uploads' store in Netlify Dashboard"
          : "Check function logs for detailed error information",
      }),
    };
  }
};
