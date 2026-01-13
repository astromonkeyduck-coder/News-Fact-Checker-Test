/**
 * Netlify Function: Get Upload URL for Clemens Converter
 * 
 * Generates a signed upload URL for direct client-to-storage uploads.
 * Supports both Cloudflare R2 (preferred) and Netlify Blobs (fallback).
 * 
 * Security: Requires CLEMS_TOKEN if configured.
 */

const { getStore } = require("@netlify/blobs");
const crypto = require("crypto");

/**
 * Check if token authentication is required and valid
 */
function checkToken(event) {
  const requiredToken = process.env.CLEMS_TOKEN;
  if (!requiredToken) {
    // Token not configured, allow access
    return true;
  }

  // Check header first
  const headerToken = event.headers["x-clems-token"] || event.headers["X-Clems-Token"];
  if (headerToken === requiredToken) {
    return true;
  }

  // Check query param as fallback
  const queryToken = event.queryStringParameters?.token;
  if (queryToken === requiredToken) {
    return true;
  }

  return false;
}

/**
 * Generate upload URL using Netlify Blobs
 * Note: Blobs doesn't support true signed URLs, so we use a token-based approach
 */
async function getBlobUploadUrl(fileName, fileSize) {
  if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
    throw new Error("Netlify Blobs not configured");
  }

  const store = getStore({
    name: "clemens-uploads",
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
  });

  // Generate a unique object key with timestamp and random suffix
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(8).toString("hex");
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectKey = `uploads/${timestamp}_${randomSuffix}_${sanitizedFileName}`;

  // For Blobs, we'll use a token-based upload endpoint
  // The client will POST to /api/upload-blob with the token
  const uploadToken = crypto.randomBytes(32).toString("hex");
  
  // Store the token temporarily (expires in 1 hour)
  await store.set(`token:${uploadToken}`, JSON.stringify({
    objectKey,
    fileName,
    fileSize,
    expiresAt: Date.now() + 3600000, // 1 hour
  }), {
    metadata: { expiresAt: Date.now() + 3600000 },
  });

  return {
    uploadUrl: `/api/upload-blob?token=${uploadToken}`,
    objectKey,
    method: "POST",
    headers: {
      "Content-Type": "audio/mpeg",
    },
  };
}

/**
 * Generate upload URL using Cloudflare R2 (if configured)
 */
async function getR2UploadUrl(fileName, fileSize) {
  // Check if R2 is configured
  if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || 
      !process.env.R2_BUCKET || !process.env.R2_ENDPOINT) {
    console.log('[get-upload-url] R2 not configured, using Blobs fallback');
    return null; // R2 not configured, fallback to Blobs
  }

  try {
    const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
    const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

    // Create S3 client configured for R2
    const s3Client = new S3Client({
      region: "auto", // R2 uses "auto" region
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

    // Generate unique object key
    const timestamp = Date.now();
    const randomSuffix = require("crypto").randomBytes(8).toString("hex");
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectKey = `clemens-uploads/${timestamp}_${randomSuffix}_${sanitizedFileName}`;

    // Create PutObject command
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: objectKey,
      ContentType: "audio/mpeg",
      // Optional: Add metadata
      Metadata: {
        fileName: fileName,
        fileSize: fileSize.toString(),
        uploadedAt: new Date().toISOString(),
      },
    });

    // Generate presigned URL (valid for 1 hour)
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    console.log('[get-upload-url] ✅ Generated R2 presigned URL for:', objectKey);

    return {
      uploadUrl: uploadUrl, // Full R2 URL for direct upload
      objectKey: objectKey,
      method: "PUT",
      headers: {
        "Content-Type": "audio/mpeg",
      },
      storageType: "r2",
    };
  } catch (error) {
    console.error('[get-upload-url] R2 error:', error.message);
    // Fallback to Blobs if R2 fails
    return null;
  }
}

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Clems-Token",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  // Only allow GET
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Check token if configured
    if (!checkToken(event)) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Unauthorized: Invalid or missing token" }),
      };
    }

    // Get parameters
    const fileName = event.queryStringParameters?.fileName;
    const fileSize = parseInt(event.queryStringParameters?.fileSize || "0", 10);

    if (!fileName || !fileSize) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing fileName or fileSize parameter" }),
      };
    }

    // Validate file size (OpenAI Whisper max is 25MB)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (fileSize > maxSize) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: `File too large. Maximum size is ${maxSize / 1024 / 1024}MB` 
        }),
      };
    }

    // Try R2 first (supports large files), fallback to Blobs (has size limits)
    console.log('[get-upload-url] Checking R2 configuration...');
    console.log('[get-upload-url] R2_ACCESS_KEY_ID:', process.env.R2_ACCESS_KEY_ID ? 'SET' : 'MISSING');
    console.log('[get-upload-url] R2_SECRET_ACCESS_KEY:', process.env.R2_SECRET_ACCESS_KEY ? 'SET' : 'MISSING');
    console.log('[get-upload-url] R2_BUCKET:', process.env.R2_BUCKET || 'MISSING');
    console.log('[get-upload-url] R2_ENDPOINT:', process.env.R2_ENDPOINT || 'MISSING');
    console.log('[get-upload-url] File size:', fileSize, 'bytes (', (fileSize / 1024 / 1024).toFixed(2), 'MB)');
    
    let uploadInfo = await getR2UploadUrl(fileName, fileSize);
    
    if (!uploadInfo) {
      // Use Blobs fallback (warn if file is large)
      const fileSizeMB = fileSize / 1024 / 1024;
      if (fileSizeMB > 5) {
        console.error('[get-upload-url] ⚠️⚠️⚠️ CRITICAL: Large file (' + fileSizeMB.toFixed(2) + 'MB) using Blobs fallback');
        console.error('[get-upload-url] ⚠️⚠️⚠️ This file will FAIL with 500 error due to Netlify 6MB function limit!');
        console.error('[get-upload-url] ⚠️⚠️⚠️ SOLUTION: Configure R2 environment variables to enable direct uploads');
      }
      uploadInfo = await getBlobUploadUrl(fileName, fileSize);
    } else {
      console.log('[get-upload-url] ✅ Using R2 for upload (no size limits)');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        uploadUrl: uploadInfo.uploadUrl,
        objectKey: uploadInfo.objectKey,
        method: uploadInfo.method || "POST",
        headers: uploadInfo.headers || {},
        storageType: uploadInfo.storageType || "blobs",
      }),
    };
  } catch (error) {
    console.error("[get-upload-url] Error:", error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: "Failed to generate upload URL",
        message: error.message,
      }),
    };
  }
};
