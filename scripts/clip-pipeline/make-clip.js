#!/usr/bin/env node
'use strict';

/**
 * Clip/transcode worker — cuts from rights-cleared local or recorded files.
 * RIGHTS-CLEARED SOURCES ONLY. Do not use YouTube watch pages as input.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { runFfmpeg, runFfprobe, validateXReadyProbe } = require('./ffmpeg-utils');
const { validateClipRange, formatTimestamp } = require('./lib/timestamps');
const { assertRightsForClipping } = require('./lib/rights-guard');
const {
  isDryRun,
  CLIPS_OUTPUT_DIR,
  CLIPS_THUMBS_DIR,
  CLIPS_PROBE_DIR,
} = require('./lib/paths');
const { getJob, updateJob, appendAuditLog } = require('./clip-job-store');

function parseArgs(argv) {
  const args = {
    dryRun: isDryRun(argv),
    jobId: null,
    maxDuration: 120,
    rightsBasis: null,
    positional: [],
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') continue;
    if (arg === '--job-id') {
      args.jobId = argv[++i];
      continue;
    }
    if (arg === '--max-duration') {
      args.maxDuration = parseInt(argv[++i], 10);
      continue;
    }
    if (arg === '--rights-basis') {
      args.rightsBasis = argv[++i];
      continue;
    }
    args.positional.push(arg);
  }

  return args;
}

async function ensureOutputDir(filePath) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
}

async function makeClip(inputPath, startInput, endInput, outputPath, options = {}) {
  const dryRun = options.dryRun ?? isDryRun();
  const maxDuration = options.maxDuration ?? 120;
  const jobId = options.jobId || null;
  const rightsBasis = options.rightsBasis;

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  let job = null;
  if (jobId) {
    job = await getJob(jobId);
    assertRightsForClipping(job);
  } else if (rightsBasis) {
    assertRightsForClipping(rightsBasis);
  } else {
    throw new Error('Provide --job-id (with rights_basis on job) or --rights-basis for standalone clips.');
  }

  const { start, end, duration } = validateClipRange(startInput, endInput, maxDuration);
  const startTs = formatTimestamp(start);
  const endTs = formatTimestamp(end);

  await ensureOutputDir(outputPath);

  const thumbBase = jobId || path.basename(outputPath, path.extname(outputPath));
  const thumbPath = path.join(CLIPS_THUMBS_DIR, `${thumbBase}.jpg`);
  const probePath = path.join(CLIPS_PROBE_DIR, `${thumbBase}.json`);

  await fsp.mkdir(CLIPS_THUMBS_DIR, { recursive: true });
  await fsp.mkdir(CLIPS_PROBE_DIR, { recursive: true });

  if (jobId) {
    await updateJob(jobId, {
      status: 'clipping',
      requested_clip_start: startInput,
      requested_clip_end: endInput,
      local_file_path: job?.local_file_path || inputPath,
    });
  }

  const transcodeArgs = [
    '-hide_banner',
    '-y',
    '-ss', startTs,
    '-to', endTs,
    '-i', inputPath,
    '-map', '0:v:0?',
    '-map', '0:a:0?',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-pix_fmt', 'yuv420p',
    '-r', '30',
    '-vf', "scale='min(1280,iw)':-2",
    '-b:v', '3500k',
    '-maxrate', '3500k',
    '-bufsize', '7000k',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '48000',
    '-movflags', '+faststart',
    outputPath,
  ];

  if (jobId) {
    await updateJob(jobId, { status: 'transcoding' });
  }

  console.log(`[make-clip] Transcoding ${duration.toFixed(1)}s clip → ${outputPath}`);
  await runFfmpeg(transcodeArgs, { dryRun });

  const thumbAt = Math.min(Math.max(2, duration * 0.1), Math.max(0.1, duration - 0.05));
  const thumbArgs = [
    '-hide_banner',
    '-y',
    '-ss', String(thumbAt),
    '-i', outputPath,
    '-frames:v', '1',
    '-q:v', '2',
    thumbPath,
  ];

  console.log(`[make-clip] Thumbnail → ${thumbPath}`);
  if (!dryRun) {
    await runFfmpeg(thumbArgs, { dryRun: false });
  } else {
    await runFfmpeg(thumbArgs, { dryRun: true });
  }

  let probeResult;
  if (dryRun) {
    probeResult = { summary: { duration, container: 'mp4', videoCodec: 'h264', audioCodec: 'aac' }, raw: null };
  } else {
    probeResult = await runFfprobe(outputPath);
    await fsp.writeFile(probePath, JSON.stringify(probeResult.raw, null, 2), 'utf8');
  }

  const validationErrors = validateXReadyProbe(probeResult.summary);
  if (validationErrors.length > 0 && !dryRun) {
    const msg = `Output validation failed: ${validationErrors.join('; ')}`;
    if (jobId) {
      await updateJob(jobId, { status: 'failed', error_message: msg });
    }
    throw new Error(msg);
  }

  if (jobId && !dryRun) {
    await updateJob(jobId, {
      status: 'review_ready',
      output_path: outputPath,
      thumbnail_path: thumbPath,
      ffprobe_path: probePath,
      error_message: null,
    });
    await appendAuditLog('clip_ready_for_review', jobId, {
      output_path: outputPath,
      duration: probeResult.summary?.duration,
    });
  }

  return {
    outputPath,
    thumbPath,
    probePath,
    duration,
    summary: probeResult.summary,
    dryRun,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const [inputPath, startInput, endInput, outputPath] = args.positional;

  if (!inputPath || !startInput || !endInput) {
    console.error('Usage: node make-clip.js INPUT START END [OUTPUT] [--job-id UUID] [--max-duration SEC] [--rights-basis TEXT] [--dry-run]');
    process.exit(1);
  }

  const resolvedOutput =
    outputPath || path.join(CLIPS_OUTPUT_DIR, `${path.basename(inputPath, path.extname(inputPath))}-clip.mp4`);

  try {
    const result = await makeClip(inputPath, startInput, endInput, resolvedOutput, {
      dryRun: args.dryRun,
      jobId: args.jobId,
      maxDuration: args.maxDuration,
      rightsBasis: args.rightsBasis,
    });

    console.log('[make-clip] Done.');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(`[make-clip] ERROR: ${err.message}`);
    if (err.stderr) {
      console.error(err.stderr.slice(-2000));
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { makeClip, parseArgs };
