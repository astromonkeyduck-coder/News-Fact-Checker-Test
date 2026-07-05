/**
 * Netlify Background Function: Watermark Processor
 *
 * Runs the actual video work (up to ~15 min). It is NOT admin-callable from the
 * browser; it is authorized by the per-job triggerSecret created by the
 * admin-authenticated watermark-create-job function.
 *
 * Pipeline: validate -> fetch source -> ffprobe -> render watermark PNG ->
 * ffmpeg overlay + H.264/AAC encode -> upload result to R2 -> delete source.
 *
 * Note on /tmp: AWS Lambda (Netlify) gives ~512MB of /tmp, which must hold both
 * the source and the output. MAX_VIDEO_MB defaults to 150 to stay well under.
 */

const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");

const { corsHeaders } = require("./lib/corsHeaders");
const r2 = require("./lib/r2");
const { renderWatermark } = require("./lib/watermark");
const jobs = require("./lib/watermarkJobs");

exports.config = { background: true };

function maxVideoBytes() {
  return parseInt(process.env.MAX_VIDEO_MB || "150", 10) * 1024 * 1024;
}
function maxDurationSeconds() {
  return parseInt(process.env.MAX_VIDEO_DURATION_SECONDS || "600", 10);
}

function extFromKey(key, fallback = "mp4") {
  const ext = String(key || "").split(".").pop().toLowerCase();
  return /^[a-z0-9]{2,4}$/.test(ext) ? ext : fallback;
}

async function downloadHttpToFile(url, destPath) {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok || !res.body) {
    throw Object.assign(new Error(`Source fetch failed (${res.status})`), { code: "FB_FETCH_UNAVAILABLE" });
  }
  const contentLength = parseInt(res.headers.get("content-length") || "0", 10);
  if (contentLength && contentLength > maxVideoBytes()) {
    throw Object.assign(new Error("Source video exceeds size limit"), { code: "TOO_LARGE" });
  }
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(destPath));
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let jobId;
  let triggerSecret;
  try {
    const body = JSON.parse(event.body || "{}");
    jobId = body.jobId;
    triggerSecret = body.triggerSecret;
  } catch {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Invalid body" }) };
  }

  const job = await jobs.getJob(jobId);
  if (!job || !jobs.verifyTriggerSecret(job, triggerSecret)) {
    // Do not reveal whether the job exists.
    return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: "Forbidden" }) };
  }

  if (job.status === jobs.STATUS.COMPLETE || job.status === jobs.STATUS.PROCESSING) {
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true, status: job.status }) };
  }

  let tmpDir;
  try {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "wm-"));
    const inputExt = job.source === "manual" ? extFromKey(job.sourceKey) : "mp4";
    const inputPath = path.join(tmpDir, `input.${inputExt}`);
    const wmPath = path.join(tmpDir, "watermark.png");
    const outputPath = path.join(tmpDir, "output.mp4");

    // 1) Fetch source -------------------------------------------------------
    await jobs.updateJob(jobId, { status: jobs.STATUS.FETCHING, progress: 10 });

    if (job.source === "manual") {
      await r2.downloadToFile(job.sourceKey, inputPath);
    } else if (job.source === "facebook") {
      if (!job.sourceUrl) {
        throw Object.assign(new Error("No source URL"), { code: "FB_FETCH_UNAVAILABLE" });
      }
      await downloadHttpToFile(job.sourceUrl, inputPath);
    } else {
      throw Object.assign(new Error("Unknown source"), { code: "BAD_SOURCE" });
    }

    const stat = await fsp.stat(inputPath);
    if (stat.size === 0) {
      throw Object.assign(new Error("Empty source file"), { code: "EMPTY_SOURCE" });
    }
    if (stat.size > maxVideoBytes()) {
      throw Object.assign(new Error("Source video exceeds size limit"), { code: "TOO_LARGE" });
    }

    // 2) Probe --------------------------------------------------------------
    await jobs.updateJob(jobId, { status: jobs.STATUS.PROCESSING, progress: 35 });

    let meta;
    try {
      meta = await jobs.probe(inputPath);
    } catch (err) {
      throw Object.assign(new Error("Could not read video"), { code: "PROBE_FAILED" });
    }

    if (!meta.width || !meta.height) {
      throw Object.assign(new Error("No video stream detected"), { code: "NO_VIDEO_STREAM" });
    }
    if (meta.duration && meta.duration > maxDurationSeconds()) {
      throw Object.assign(
        new Error(`Video is longer than the ${maxDurationSeconds()}s limit`),
        { code: "TOO_LONG" }
      );
    }

    // 3) Render watermark PNG ----------------------------------------------
    const wm = renderWatermark({
      width: meta.width,
      height: meta.height,
      line2: job.creditLine,
    });
    await fsp.writeFile(wmPath, wm.pngBuffer);

    await jobs.updateJob(jobId, { progress: 55 });

    // 4) Overlay + encode ---------------------------------------------------
    await jobs.watermarkVideo({
      inputPath,
      watermarkPath: wmPath,
      position: job.position || "lower-left",
      outputPath,
      hasAudio: meta.hasAudio,
    });

    await jobs.updateJob(jobId, { progress: 85 });

    // 5) Upload result ------------------------------------------------------
    const outKey = `watermark-outputs/${jobId}.mp4`;
    const downloadName = `noteworthy-watermarked-${jobId.slice(0, 8)}.mp4`;
    await r2.uploadFile(outKey, outputPath, "video/mp4", { jobId });

    await jobs.updateJob(jobId, {
      status: jobs.STATUS.COMPLETE,
      progress: 100,
      outputKey: outKey,
      downloadName,
      sourceUrl: null, // drop the server-side FB source URL once finished
      width: meta.width,
      height: meta.height,
    });

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    console.error(`[watermark-process-background] Job ${jobId} failed:`, error.message);
    const code = error.code || "PROCESSING_FAILED";
    const messages = {
      FB_FETCH_UNAVAILABLE:
        "Facebook does not allow this video to be fetched automatically. Upload the video file manually instead.",
      TOO_LARGE: "The video is too large to process.",
      TOO_LONG: "The video is longer than the allowed limit.",
      PROBE_FAILED: "The uploaded file could not be read as a video.",
      NO_VIDEO_STREAM: "No video stream was found in the file.",
      EMPTY_SOURCE: "The source video was empty.",
      BAD_SOURCE: "Invalid video source.",
      PROCESSING_FAILED: "Video processing failed. Please try again or upload the file manually.",
    };
    try {
      await jobs.updateJob(jobId, {
        status: jobs.STATUS.FAILED,
        error: messages[code] || messages.PROCESSING_FAILED,
        errorCode: code,
        sourceUrl: null,
      });
    } catch (e) {
      console.error("[watermark-process-background] Failed to record failure:", e.message);
    }
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: false, code }) };
  } finally {
    // Always remove the manually uploaded original from R2 - on success AND on
    // failure - so failed jobs never leave large orphaned files. There is no
    // retry path that needs the original, and processed output is independent.
    if (job && job.source === "manual" && job.sourceKey) {
      await r2.deleteObject(job.sourceKey);
    }
    if (tmpDir) {
      fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
};
