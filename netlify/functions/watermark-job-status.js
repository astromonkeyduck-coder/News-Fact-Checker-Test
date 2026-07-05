/**
 * Netlify Function: Watermark Job Status
 *
 * Returns the status of a watermarking job and, when complete, a short-lived
 * presigned download URL for the finished MP4.
 *
 * Auth: admin-only (requireAdminAuth). Server file paths and the FB source URL
 * are never exposed - only a presigned download link.
 *
 * Opportunistic cleanup: expired jobs (older than TEMP_VIDEO_TTL_MINUTES) have
 * their output deleted from R2 and their record removed.
 */

const { corsHeaders, optionsResponse } = require("./lib/corsHeaders");
const { requireAdminAuth } = require("./middleware/requireAuth");
const r2 = require("./lib/r2");
const jobs = require("./lib/watermarkJobs");

function ttlMs() {
  return parseInt(process.env.TEMP_VIDEO_TTL_MINUTES || "60", 10) * 60 * 1000;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse;

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const auth = await requireAdminAuth(event);
  if (auth.statusCode) return auth;

  const jobId = (event.queryStringParameters || {}).id;
  if (!jobId) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Missing id parameter" }) };
  }

  const job = await jobs.getJob(jobId);
  if (!job) {
    return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "Job not found" }) };
  }

  // Opportunistic expiry: drop old outputs + records.
  const age = Date.now() - (job.createdAt || 0);
  if (age > ttlMs()) {
    if (job.outputKey) await r2.deleteObject(job.outputKey);
    if (job.source === "manual" && job.sourceKey) await r2.deleteObject(job.sourceKey);
    await jobs.deleteJob(jobId);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ id: jobId, status: "expired" }),
    };
  }

  const view = jobs.publicJobView(job);

  if (job.status === jobs.STATUS.COMPLETE && job.outputKey) {
    try {
      view.downloadUrl = await r2.presignGet(job.outputKey, 3600, job.downloadName || "watermarked.mp4");
    } catch (err) {
      console.error("[watermark-job-status] presign error:", err.message);
    }
  }

  return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(view) };
};
