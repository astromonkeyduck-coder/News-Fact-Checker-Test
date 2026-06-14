/**
 * Job store + ffmpeg/ffprobe runner for the Video Watermarker tool.
 *
 * Job state lives in the Netlify Blobs store `watermark-jobs` (self-contained,
 * no Supabase migration). ffmpeg/ffprobe are invoked with argument arrays via
 * spawn — never a shell string — so user input cannot inject shell commands.
 */

const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const crypto = require("crypto");
const { getStore } = require("@netlify/blobs");

const STORE_NAME = "watermark-jobs";

const STATUS = Object.freeze({
  WAITING: "waiting",
  FETCHING: "fetching",
  PROCESSING: "processing",
  COMPLETE: "complete",
  FAILED: "failed",
});

// ---------------------------------------------------------------------------
// Blobs job store
// ---------------------------------------------------------------------------

function getJobStore() {
  if (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
    return getStore({
      name: STORE_NAME,
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
    });
  }
  // In the Netlify runtime, context is injected automatically.
  return getStore(STORE_NAME);
}

function newJobId() {
  return crypto.randomUUID();
}

function newTriggerSecret() {
  return crypto.randomBytes(32).toString("hex");
}

async function createJob(fields) {
  const store = getJobStore();
  const now = Date.now();
  const job = {
    id: newJobId(),
    status: STATUS.WAITING,
    progress: 0,
    triggerSecret: newTriggerSecret(),
    createdAt: now,
    updatedAt: now,
    error: null,
    errorCode: null,
    outputKey: null,
    ...fields,
  };
  await store.setJSON(job.id, job);
  return job;
}

async function getJob(jobId) {
  if (!jobId) return null;
  const store = getJobStore();
  try {
    return await store.get(jobId, { type: "json" });
  } catch {
    return null;
  }
}

async function updateJob(jobId, patch) {
  const store = getJobStore();
  const existing = await getJob(jobId);
  if (!existing) return null;
  const updated = { ...existing, ...patch, updatedAt: Date.now() };
  await store.setJSON(jobId, updated);
  return updated;
}

async function deleteJob(jobId) {
  const store = getJobStore();
  try {
    await store.delete(jobId);
  } catch {
    /* best-effort */
  }
}

/**
 * Constant-time compare for the per-job trigger secret.
 */
function verifyTriggerSecret(job, provided) {
  if (!job || !job.triggerSecret || !provided) return false;
  const a = Buffer.from(String(job.triggerSecret));
  const b = Buffer.from(String(provided));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Strip server-only fields before returning a job to the client.
 */
function publicJobView(job) {
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    progress: job.progress || 0,
    error: job.error || null,
    errorCode: job.errorCode || null,
    username: job.username || null,
    creditLine: job.creditLine || null,
    createdAt: job.createdAt,
  };
}

// ---------------------------------------------------------------------------
// ffmpeg / ffprobe binary resolution + execution
// ---------------------------------------------------------------------------

let _ffmpegPath;

function resolveBinary(envVar, staticModule, fallbackName) {
  if (process.env[envVar]) return process.env[envVar];
  try {
    const mod = require(staticModule);
    const resolved = typeof mod === "string" ? mod : mod && mod.path;
    if (resolved && fs.existsSync(resolved)) return resolved;
  } catch {
    /* fall through */
  }
  const which = spawnSync("which", [fallbackName], { encoding: "utf8" });
  if (which.status === 0 && which.stdout.trim()) return which.stdout.trim();
  return fallbackName;
}

function getFfmpegPath() {
  if (!_ffmpegPath) _ffmpegPath = resolveBinary("FFMPEG_PATH", "ffmpeg-static", "ffmpeg");
  return _ffmpegPath;
}

/**
 * Run a binary with an argument array. Returns { code, stdout, stderr }.
 * Rejects on non-zero exit. NEVER uses a shell.
 */
function run(binary, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => {
      stdout += c.toString();
    });
    child.stderr.on("data", (c) => {
      stderr += c.toString();
    });
    child.on("error", (err) => reject(new Error(`Failed to spawn ${binary}: ${err.message}`)));
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ code, stdout, stderr });
      } else {
        const err = new Error(`${binary} exited with code ${code}`);
        err.stderr = stderr.slice(-2000);
        reject(err);
      }
    });
  });
}

/**
 * Run ffmpeg purely to read metadata. ffmpeg exits non-zero when no output is
 * given, so we capture stderr and ignore the exit code.
 */
function runForStderr(binary, args) {
  return new Promise((resolve) => {
    const child = spawn(binary, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (c) => {
      stderr += c.toString();
    });
    child.on("error", () => resolve(""));
    child.on("close", () => resolve(stderr));
  });
}

/**
 * Probe a local media file using ffmpeg itself (no separate ffprobe binary).
 * ffprobe-static ships ~300MB of multi-platform binaries, which would push the
 * deployed function over Netlify's size limits — so we parse ffmpeg's banner
 * instead and keep the bundle to the single ffmpeg binary.
 */
async function probe(filePath) {
  const stderr = await runForStderr(getFfmpegPath(), ["-hide_banner", "-i", filePath]);

  let duration = 0;
  const dur = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (dur) {
    duration = parseInt(dur[1], 10) * 3600 + parseInt(dur[2], 10) * 60 + parseFloat(dur[3]);
  }

  let width = null;
  let height = null;
  let videoCodec = null;
  const videoLine = stderr.match(/Stream #\d+:\d+(?:\[[^\]]*\])?(?:\([^)]*\))?:\s*Video:\s*([a-zA-Z0-9_]+)[^\n]*/);
  if (videoLine) {
    videoCodec = videoLine[1];
    const dims = videoLine[0].match(/(\d{2,5})x(\d{2,5})/);
    if (dims) {
      width = parseInt(dims[1], 10);
      height = parseInt(dims[2], 10);
    }
  }

  let audioCodec = null;
  const audioLine = stderr.match(/Stream #\d+:\d+(?:\[[^\]]*\])?(?:\([^)]*\))?:\s*Audio:\s*([a-zA-Z0-9_]+)/);
  if (audioLine) audioCodec = audioLine[1];

  return {
    duration: Number.isFinite(duration) ? duration : 0,
    width,
    height,
    videoCodec,
    audioCodec,
    hasAudio: Boolean(audioCodec),
  };
}

/**
 * Build the ffmpeg overlay position expression for a corner. Uses overlay's
 * W/H (main video) and w/h (watermark) so placement is correct regardless of
 * the exact probed dimensions (e.g. rotation metadata). Padding is 4% width /
 * 5% height per the design spec. Built from a fixed switch — no user input.
 */
function overlayExpr(position) {
  const padX = "W*0.04";
  const padY = "H*0.05";
  switch (position) {
    case "lower-right":
      return `W-w-${padX}:H-h-${padY}`;
    case "upper-left":
      return `${padX}:${padY}`;
    case "upper-right":
      return `W-w-${padX}:${padY}`;
    case "lower-left":
    default:
      return `${padX}:H-h-${padY}`;
  }
}

/**
 * Overlay the watermark PNG onto the input video and export H.264/AAC MP4.
 * Aspect ratio is preserved (no scaling); a single encode pass is used.
 */
async function watermarkVideo({ inputPath, watermarkPath, position = "lower-left", outputPath, hasAudio }) {
  const args = [
    "-hide_banner",
    "-y",
    "-i", inputPath,
    "-i", watermarkPath,
    "-filter_complex", `[0:v][1:v]overlay=${overlayExpr(position)}:format=auto[v]`,
    "-map", "[v]",
  ];
  if (hasAudio) {
    args.push("-map", "0:a:0");
    args.push("-c:a", "aac", "-b:a", "160k");
  } else {
    args.push("-an");
  }
  args.push(
    "-c:v", "libx264",
    // 'fast' gives the same visual quality as 'medium' at a given CRF (preset
    // only trades encode speed for file size), but encodes faster — important
    // to stay within the ~15 min background-function budget on long videos.
    "-preset", "fast",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    outputPath
  );
  await run(getFfmpegPath(), args);
  return outputPath;
}

module.exports = {
  STATUS,
  STORE_NAME,
  createJob,
  getJob,
  updateJob,
  deleteJob,
  verifyTriggerSecret,
  publicJobView,
  getJobStore,
  // ffmpeg
  getFfmpegPath,
  probe,
  watermarkVideo,
};
