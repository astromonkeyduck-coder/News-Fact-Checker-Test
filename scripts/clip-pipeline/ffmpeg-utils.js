'use strict';

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const { isDryRun } = require('./lib/paths');

let cachedFfmpegPath;
let cachedFfprobePath;

function resolveBinary(envVar, staticModule, fallbackName) {
  if (process.env[envVar]) {
    return process.env[envVar];
  }

  try {
    const staticPath = require(staticModule);
    const resolved = typeof staticPath === 'string' ? staticPath : staticPath?.path;
    if (resolved && fs.existsSync(resolved)) {
      return resolved;
    }
  } catch {
    // fall through
  }

  const which = spawnSync('which', [fallbackName], { encoding: 'utf8' });
  if (which.status === 0 && which.stdout.trim()) {
    return which.stdout.trim();
  }

  return null;
}

function getFfmpegPath() {
  if (!cachedFfmpegPath) {
    cachedFfmpegPath = resolveBinary('FFMPEG_PATH', 'ffmpeg-static', 'ffmpeg');
  }
  return cachedFfmpegPath;
}

function getFfprobePath() {
  if (!cachedFfprobePath) {
    cachedFfprobePath = resolveBinary('FFPROBE_PATH', 'ffprobe-static', 'ffprobe');
  }
  return cachedFfprobePath;
}

function assertFfmpegAvailable() {
  const ffmpeg = getFfmpegPath();
  if (!ffmpeg) {
    throw new Error(
      'FFmpeg not found. Install ffmpeg or ensure ffmpeg-static is installed (npm install). ' +
        'Optionally set FFMPEG_PATH.'
    );
  }
  return ffmpeg;
}

function assertFfprobeAvailable() {
  const ffprobe = getFfprobePath();
  if (!ffprobe) {
    throw new Error(
      'ffprobe not found. Install ffmpeg (includes ffprobe) or ensure ffprobe-static is installed. ' +
        'Optionally set FFPROBE_PATH.'
    );
  }
  return ffprobe;
}

function formatCommand(binary, args) {
  const escaped = args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg));
  return `${binary} ${escaped.join(' ')}`;
}

function runProcess(binary, args, { dryRun = false, logPrefix = '[ffmpeg]', captureStderr = true } = {}) {
  if (dryRun || isDryRun()) {
    console.log(`${logPrefix} DRY-RUN: ${formatCommand(binary, args)}`);
    return { code: 0, stdout: '', stderr: '', dryRun: true };
  }

  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (captureStderr) {
        process.stderr.write(chunk);
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn ${binary}: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ code, stdout, stderr });
      } else {
        const err = new Error(`${binary} exited with code ${code}`);
        err.code = code;
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
      }
    });
  });
}

async function runFfmpeg(args, opts = {}) {
  const ffmpeg = assertFfmpegAvailable();
  return runProcess(ffmpeg, args, { logPrefix: '[ffmpeg]', ...opts });
}

async function runFfprobe(filePath, opts = {}) {
  const ffprobe = assertFfprobeAvailable();
  const args = [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath,
  ];
  const result = await runProcess(ffprobe, args, { logPrefix: '[ffprobe]', captureStderr: false, ...opts });
  if (result.dryRun) {
    return { dryRun: true, summary: null, raw: null };
  }
  const raw = JSON.parse(result.stdout);
  return { raw, summary: summarizeProbe(raw) };
}

function summarizeProbe(probe) {
  const streams = probe.streams || [];
  const video = streams.find((s) => s.codec_type === 'video');
  const audio = streams.find((s) => s.codec_type === 'audio');
  const duration = parseFloat(probe.format?.duration || video?.duration || 0);

  return {
    duration,
    container: probe.format?.format_name || null,
    sizeBytes: probe.format?.size ? parseInt(probe.format.size, 10) : null,
    videoCodec: video?.codec_name || null,
    audioCodec: audio?.codec_name || null,
    width: video?.width || null,
    height: video?.height || null,
    fps: video?.avg_frame_rate || null,
  };
}

function validateXReadyProbe(summary) {
  const errors = [];

  if (!summary) {
    errors.push('No ffprobe summary available');
    return errors;
  }

  if (!summary.duration || summary.duration <= 0) {
    errors.push('Invalid or missing duration');
  }

  if (!summary.container || !summary.container.includes('mp4')) {
    errors.push(`Expected MP4 container, got: ${summary.container}`);
  }

  if (summary.videoCodec !== 'h264') {
    errors.push(`Expected H.264 video, got: ${summary.videoCodec}`);
  }

  if (summary.audioCodec && summary.audioCodec !== 'aac') {
    errors.push(`Expected AAC audio, got: ${summary.audioCodec}`);
  }

  if (summary.width && summary.width > 1280) {
    errors.push(`Video width ${summary.width}px exceeds max 1280px`);
  }

  return errors;
}

module.exports = {
  getFfmpegPath,
  getFfprobePath,
  assertFfmpegAvailable,
  assertFfprobeAvailable,
  formatCommand,
  runFfmpeg,
  runFfprobe,
  summarizeProbe,
  validateXReadyProbe,
};
