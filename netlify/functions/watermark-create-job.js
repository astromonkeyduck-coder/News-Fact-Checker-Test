/**
 * Netlify Function: Watermark Create Job
 *
 * Starts a watermarking job for either a manually uploaded video (R2 objectKey)
 * or an authorized Facebook video link (compliant Meta Graph API retrieval).
 *
 * Auth: admin-only (requireAdminAuth). The required rights checkbox is enforced
 * server-side. Facebook media is only ever retrieved via the official Graph API
 * `source` field; if that isn't possible we return a manual-upload fallback
 * instead of a cryptic error.
 */

const https = require("https");
const http = require("http");
const { URL } = require("url");

const { corsHeaders, optionsResponse } = require("./lib/corsHeaders");
const { requireAdminAuth } = require("./middleware/requireAuth");
const { composeCreditLine, sanitizeUsername } = require("./lib/watermarkText");
const { resolveFacebookVideo, isValidFacebookUrl } = require("./lib/facebook");
const { isR2Configured } = require("./lib/r2");
const jobs = require("./lib/watermarkJobs");

const VALID_POSITIONS = new Set(["lower-left", "lower-right", "upper-left", "upper-right"]);

// Lightweight in-memory rate limit per admin identity (per warm instance).
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 10;
const rateMap = new Map();

function rateLimited(key) {
  const now = Date.now();
  const entry = rateMap.get(key) || { count: 0, resetAt: now + RATE_WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_WINDOW_MS;
  }
  entry.count += 1;
  rateMap.set(key, entry);
  return entry.count > RATE_MAX;
}

/**
 * Fire-and-forget trigger to the background processor. Mirrors create-job.js.
 * The per-job triggerSecret authorizes the background run.
 */
function triggerBackground(jobId, triggerSecret) {
  try {
    const baseUrl =
      process.env.URL ||
      process.env.DEPLOY_PRIME_URL ||
      process.env.NETLIFY_URL ||
      (process.env.CONTEXT === "production" ? "https://noteworthynews.co" : "http://localhost:8888");
    const functionUrl = `${baseUrl}/.netlify/functions/watermark-process-background`;
    const url = new URL(functionUrl);
    const client = url.protocol === "https:" ? https : http;
    const postData = JSON.stringify({ jobId, triggerSecret });

    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
        timeout: 5000,
      },
      (res) => {
        res.on("data", () => {});
        res.on("end", () => {
          console.log(`[watermark-create-job] triggered background for ${jobId} (status ${res.statusCode})`);
        });
      }
    );
    req.on("error", (err) => console.error(`[watermark-create-job] trigger error for ${jobId}:`, err.message));
    req.on("timeout", () => {
      req.destroy();
      console.error(`[watermark-create-job] trigger timeout for ${jobId}`);
    });
    req.write(postData);
    req.end();
  } catch (err) {
    console.error("[watermark-create-job] triggerBackground failed:", err.message);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse;

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const auth = await requireAdminAuth(event);
  if (auth.statusCode) return auth;

  const rateKey = auth.user && (auth.user.sub || auth.user.email) ? auth.user.sub || auth.user.email : "admin";
  if (rateLimited(rateKey)) {
    return {
      statusCode: 429,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Too many jobs started. Please wait a moment and try again." }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const { mode, objectKey, facebookUrl, credit, position = "lower-left", rightsConfirmed } = body;

  if (rightsConfirmed !== true) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "You must confirm you have the legal right to transform and publish this video." }),
    };
  }

  if (!VALID_POSITIONS.has(position)) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Invalid watermark position." }) };
  }

  // Output storage is required for every job (both modes upload the result).
  if (!isR2Configured()) {
    return {
      statusCode: 503,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Video storage is not configured on the server. Set the R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_ENDPOINT environment variables.",
      }),
    };
  }

  try {
    if (mode === "manual") {
      if (!objectKey || typeof objectKey !== "string" || !objectKey.startsWith("watermark-uploads/")) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Missing or invalid upload reference." }) };
      }

      const username = sanitizeUsername(credit) || "Facebook";
      const creditLine = composeCreditLine(credit);

      const job = await jobs.createJob({
        source: "manual",
        sourceKey: objectKey,
        username,
        creditLine,
        position,
      });

      triggerBackground(job.id, job.triggerSecret);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ jobId: job.id, status: job.status, creditLine }),
      };
    }

    if (mode === "facebook") {
      if (!facebookUrl || !isValidFacebookUrl(facebookUrl)) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Enter a valid Facebook video link." }) };
      }

      const resolved = await resolveFacebookVideo(facebookUrl);

      // Prefer the credit the admin typed; otherwise the detected username.
      const usernameForCredit = sanitizeUsername(credit) || resolved.username || "Facebook";

      if (!resolved.retrievable) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            fallback: true,
            detectedUsername: resolved.username || "Facebook",
            message:
              "Facebook does not allow this video to be fetched automatically. Upload the video file manually instead.",
          }),
        };
      }

      const creditLine = composeCreditLine(usernameForCredit);

      const job = await jobs.createJob({
        source: "facebook",
        // sourceUrl is stored server-side only and never returned to the client.
        sourceUrl: resolved.sourceUrl,
        username: sanitizeUsername(usernameForCredit) || "Facebook",
        creditLine,
        position,
      });

      triggerBackground(job.id, job.triggerSecret);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ jobId: job.id, status: job.status, creditLine }),
      };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown mode." }) };
  } catch (error) {
    console.error("[watermark-create-job] Error:", error.message);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "Failed to create job." }) };
  }
};
