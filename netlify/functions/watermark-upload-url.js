/**
 * Netlify Function: Watermark Upload URL
 *
 * Returns a presigned Cloudflare R2 PUT URL so an admin can upload a video
 * directly from the browser (bypassing the ~6MB function body limit). Used by
 * the manual-upload fallback of the Video Watermarker tool.
 *
 * Auth: admin-only (Auth0 JWT verified server-side via requireAdminAuth).
 */

const crypto = require("crypto");
const { corsHeaders, optionsResponse } = require("./lib/corsHeaders");
const { requireAdminAuth } = require("./middleware/requireAuth");
const { isR2Configured, presignPut } = require("./lib/r2");

const ALLOWED = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

function maxVideoBytes() {
  const mb = parseInt(process.env.MAX_VIDEO_MB || "150", 10);
  return mb * 1024 * 1024;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse;

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const auth = await requireAdminAuth(event);
  if (auth.statusCode) return auth;

  try {
    const params = event.queryStringParameters || {};
    const fileName = params.fileName || "";
    const fileSize = parseInt(params.fileSize || "0", 10);

    if (!fileName || !fileSize) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing fileName or fileSize parameter" }),
      };
    }

    const ext = fileName.split(".").pop().toLowerCase();
    const contentType = ALLOWED[ext];
    if (!contentType) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Unsupported file type. Use MP4, MOV, or WebM." }),
      };
    }

    const maxBytes = maxVideoBytes();
    if (fileSize > maxBytes) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: `File too large. Maximum is ${Math.round(maxBytes / 1024 / 1024)}MB.`,
        }),
      };
    }

    if (!isR2Configured()) {
      return {
        statusCode: 503,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Video storage is not configured on the server. Set the R2_* environment variables to enable uploads.",
        }),
      };
    }

    const timestamp = Date.now();
    const rand = crypto.randomBytes(8).toString("hex");
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectKey = `watermark-uploads/${timestamp}_${rand}_${safeName}`;

    const uploadUrl = await presignPut(objectKey, contentType, 3600);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        uploadUrl,
        objectKey,
        method: "PUT",
        headers: { "Content-Type": contentType },
        storageType: "r2",
      }),
    };
  } catch (error) {
    console.error("[watermark-upload-url] Error:", error.message);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Failed to generate upload URL" }),
    };
  }
};
