/**
 * Shared Cloudflare R2 (S3-compatible) helper for the Video Watermarker tool.
 *
 * Centralises the S3 client + presign/download/delete logic so the watermark
 * functions don't each re-create credentials handling. R2 is used as temporary
 * storage for original uploads and finished watermarked videos.
 *
 * All callers must treat R2 as optional and fail-closed when it isn't
 * configured - there is no client-visible fallback that leaks credentials.
 */

const fs = require("fs");
const { pipeline } = require("stream/promises");

function isR2Configured() {
  return Boolean(
    process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_ENDPOINT
  );
}

function getClient() {
  if (!isR2Configured()) {
    throw new Error("R2 storage is not configured");
  }
  const { S3Client } = require("@aws-sdk/client-s3");
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

/**
 * Create a presigned PUT URL the browser can upload to directly.
 * `contentType` is bound into the signature, so the client must send the same.
 */
async function presignPut(objectKey, contentType, expiresIn = 3600) {
  const { PutObjectCommand } = require("@aws-sdk/client-s3");
  const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: objectKey,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Create a presigned GET URL for downloading a finished video.
 */
async function presignGet(objectKey, expiresIn = 3600, downloadName = null) {
  const { GetObjectCommand } = require("@aws-sdk/client-s3");
  const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
  const client = getClient();
  const params = {
    Bucket: process.env.R2_BUCKET,
    Key: objectKey,
  };
  if (downloadName) {
    // Force a download with a clean filename, no server paths exposed.
    const safe = String(downloadName).replace(/[^a-zA-Z0-9._-]/g, "_");
    params.ResponseContentDisposition = `attachment; filename="${safe}"`;
  }
  const command = new GetObjectCommand(params);
  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Stream an R2 object to a local file path (used by the background processor
 * so large videos never need to be fully buffered in memory).
 */
async function downloadToFile(objectKey, destPath) {
  const { GetObjectCommand } = require("@aws-sdk/client-s3");
  const client = getClient();
  const response = await client.send(
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: objectKey })
  );
  if (!response.Body) {
    throw new Error("Empty object body from R2");
  }
  await pipeline(response.Body, fs.createWriteStream(destPath));
  return destPath;
}

/**
 * Upload a local file to R2.
 */
async function uploadFile(objectKey, filePath, contentType, metadata = {}) {
  const { PutObjectCommand } = require("@aws-sdk/client-s3");
  const client = getClient();
  const Body = fs.createReadStream(filePath);
  const stat = fs.statSync(filePath);
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: objectKey,
      Body,
      ContentType: contentType,
      ContentLength: stat.size,
      Metadata: metadata,
    })
  );
  return objectKey;
}

async function deleteObject(objectKey) {
  if (!isR2Configured() || !objectKey) return;
  try {
    const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
    const client = getClient();
    await client.send(
      new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: objectKey })
    );
  } catch (err) {
    // Cleanup is best-effort; never throw from a delete.
    console.error("[r2] deleteObject failed (non-fatal):", err.message);
  }
}

module.exports = {
  isR2Configured,
  presignPut,
  presignGet,
  downloadToFile,
  uploadFile,
  deleteObject,
};
