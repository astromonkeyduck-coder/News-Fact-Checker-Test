'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

let ffmpegPath;
let ffprobePath;
try {
  ffmpegPath = require('ffmpeg-static');
} catch {
  ffmpegPath = 'ffmpeg';
}
try {
  ffprobePath = require('ffprobe-static');
} catch {
  ffprobePath = 'ffprobe';
}

const {
  mergeWebmChunkBuffers,
  isEbmlHeader,
} = require('./merge-webm-chunks');

function decodeChunks(webmBase64, webmChunksBase64) {
  const chunks = Array.isArray(webmChunksBase64)
    ? webmChunksBase64.filter(Boolean).map((b64) => Buffer.from(b64, 'base64'))
    : [];

  if (chunks.length > 0) {
    return mergeWebmChunkBuffers(chunks);
  }

  if (webmBase64) {
    return Buffer.from(webmBase64, 'base64');
  }

  return null;
}

function hasWebmHeader(buf) {
  return isEbmlHeader(buf);
}

function probeDurationSeconds(inputPath) {
  const result = spawnSync(ffprobePath, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    inputPath,
  ], { encoding: 'utf8' });

  const val = parseFloat(String(result.stdout || '').trim());
  return Number.isFinite(val) && val > 0 ? val : 0;
}

function buildInputArgs(inputPath, trimSeconds) {
  if (trimSeconds <= 0) {
    return ['-i', inputPath];
  }

  const duration = probeDurationSeconds(inputPath);
  if (duration <= trimSeconds + 0.25) {
    return ['-i', inputPath];
  }

  const start = Math.max(0, duration - trimSeconds);
  return ['-ss', String(start), '-i', inputPath, '-t', String(trimSeconds)];
}

function convertWebmChunksToMp4Buffer(webmBase64, webmChunksBase64, options = {}) {
  const trimSeconds = Number(options.trimSeconds) || 0;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteworthy-clip-'));
  const inputPath = path.join(tmpDir, 'input.webm');
  const outputPath = path.join(tmpDir, 'output.mp4');

  try {
    const merged = decodeChunks(webmBase64, webmChunksBase64);
    if (!merged || merged.length === 0) {
      throw new Error('Missing webm data');
    }

    if (!hasWebmHeader(merged)) {
      throw new Error(
        'Invalid WebM capture (missing header). Refresh YouTube, play the video until the buffer fills, then save again.'
      );
    }

    if (merged.length < 5000) {
      throw new Error(`Input too small (${merged.length} bytes) — let the video play longer before saving`);
    }

    fs.writeFileSync(inputPath, merged);

    const inputArgs = buildInputArgs(inputPath, trimSeconds);

    const result = spawnSync(
      ffmpegPath,
      [
        '-hide_banner', '-y',
        '-fflags', '+genpts+igndts',
        '-avoid_negative_ts', 'make_zero',
        '-err_detect', 'ignore_err',
        '-max_muxing_queue_size', '9999',
        ...inputArgs,
        '-map', '0:v:0?',
        '-map', '0:a:0?',
        '-vf', "scale='min(1280,iw)':-2",
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-pix_fmt', 'yuv420p',
        '-r', '30',
        '-vsync', 'cfr',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '48000',
        '-movflags', '+faststart',
        '-f', 'mp4',
        outputPath,
      ],
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );

    if (result.status !== 0) {
      throw new Error((result.stderr || 'FFmpeg failed').slice(-800));
    }

    if (!fs.existsSync(outputPath)) {
      throw new Error('FFmpeg produced no output');
    }

    const outBuf = fs.readFileSync(outputPath);
    if (outBuf.length < 5000 || outBuf.toString('ascii', 4, 8) !== 'ftyp') {
      throw new Error('FFmpeg output is not a valid MP4');
    }

    return outBuf;
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

module.exports = { convertWebmChunksToMp4Buffer, ffmpegPath, hasWebmHeader };
