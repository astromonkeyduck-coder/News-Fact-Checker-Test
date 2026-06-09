#!/usr/bin/env node
'use strict';

/**
 * Save the last N seconds from an active rolling buffer or growing local file.
 * Default: last 30 seconds → X-ready MP4.
 *
 * Not for YouTube watch-page ripping. Works with:
 * - Active clip:record:buffer session (rights-cleared feed)
 * - --from path/to/growing-or-complete.mkv (e.g. OBS window capture you have rights to)
 */

const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { runFfmpeg, runFfprobe, validateXReadyProbe } = require('./ffmpeg-utils');
const { assertRightsForClipping } = require('./lib/rights-guard');
const {
  isDryRun,
  CLIPS_OUTPUT_DIR,
  CLIPS_THUMBS_DIR,
  CLIPS_PROBE_DIR,
} = require('./lib/paths');
const {
  loadActiveSession,
  refreshSegments,
  getSegmentPaths,
  segmentsNeededForSeconds,
} = require('./lib/rolling-buffer');
const { getJob, updateJob, appendAuditLog } = require('./clip-job-store');

function parseArgs(argv) {
  const args = {
    dryRun: isDryRun(argv),
    seconds: 30,
    jobId: null,
    rightsBasis: null,
    fromPath: null,
    output: null,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') continue;
    if (arg === '--seconds') { args.seconds = parseFloat(argv[++i]); continue; }
    if (arg === '--job-id') { args.jobId = argv[++i]; continue; }
    if (arg === '--rights-basis') { args.rightsBasis = argv[++i]; continue; }
    if (arg === '--from') { args.fromPath = argv[++i]; continue; }
    if (arg === '--output') { args.output = argv[++i]; continue; }
  }

  return args;
}

function xReadyEncodeArgs(outputPath) {
  return [
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
}

async function concatSegments(segmentPaths, outputPath, dryRun) {
  if (segmentPaths.length === 0) {
    throw new Error('No segments available to concat');
  }

  if (segmentPaths.length === 1) {
    return segmentPaths[0];
  }

  const listPath = path.join(os.tmpdir(), `clip-concat-${Date.now()}.txt`);
  const listBody = segmentPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
  await fsp.writeFile(listPath, listBody, 'utf8');

  const args = [
    '-hide_banner', '-y',
    '-f', 'concat', '-safe', '0',
    '-i', listPath,
    '-c', 'copy',
    outputPath,
  ];

  console.log(`[save-last] Concat ${segmentPaths.length} segments → ${outputPath}`);
  await runFfmpeg(args, { dryRun });

  if (!dryRun) {
    try { await fsp.unlink(listPath); } catch { /* ignore */ }
  }

  return outputPath;
}

async function transcodeTail(inputPath, seconds, outputPath, dryRun) {
  const args = [
    '-hide_banner', '-y',
    '-sseof', `-${seconds}`,
    '-i', inputPath,
    ...xReadyEncodeArgs(outputPath),
  ];

  console.log(`[save-last] Saving last ${seconds}s → ${outputPath}`);
  await runFfmpeg(args, { dryRun });
  return outputPath;
}

async function generateThumbAndProbe(outputPath, baseName, dryRun) {
  await fsp.mkdir(CLIPS_THUMBS_DIR, { recursive: true });
  await fsp.mkdir(CLIPS_PROBE_DIR, { recursive: true });

  const thumbPath = path.join(CLIPS_THUMBS_DIR, `${baseName}.jpg`);
  const probePath = path.join(CLIPS_PROBE_DIR, `${baseName}.json`);

  if (dryRun) {
    await runFfmpeg([
      '-hide_banner', '-y', '-ss', '1', '-i', outputPath,
      '-frames:v', '1', '-q:v', '2', thumbPath,
    ], { dryRun: true });
    return { thumbPath, probePath, summary: null };
  }

  const probeInput = await runFfprobe(outputPath);
  const dur = probeInput.summary?.duration || 30;
  const at = Math.min(Math.max(0.5, dur * 0.1), Math.max(0.1, dur - 0.05));

  await runFfmpeg([
    '-hide_banner', '-y',
    '-ss', String(at),
    '-i', outputPath,
    '-frames:v', '1', '-q:v', '2',
    thumbPath,
  ]);

  await fsp.writeFile(probePath, JSON.stringify(probeInput.raw, null, 2), 'utf8');

  const errors = validateXReadyProbe(probeInput.summary);
  if (errors.length > 0) {
    throw new Error(`Output validation failed: ${errors.join('; ')}`);
  }

  return { thumbPath, probePath, summary: probeInput.summary };
}

async function resolveInputFromBuffer(state, seconds, dryRun) {
  await refreshSegments(state);
  const needed = segmentsNeededForSeconds(state, seconds);
  const paths = getSegmentPaths(state, needed);

  if (paths.length === 0) {
    throw new Error(
      'Buffer has no segments yet. Wait a few seconds for recording to produce segments, then retry.'
    );
  }

  for (const p of paths) {
    if (!fs.existsSync(p)) {
      throw new Error(`Segment missing: ${p}. Buffer may still be initializing.`);
    }
  }

  if (paths.length === 1) {
    return paths[0];
  }

  const concatOut = path.join(state.dir, `_concat-${Date.now()}.mkv`);
  return concatSegments(paths, concatOut, dryRun);
}

async function saveLast(options = {}) {
  const dryRun = options.dryRun ?? isDryRun();
  const seconds = options.seconds ?? 30;
  const jobId = options.jobId ?? null;
  const rightsBasis = options.rightsBasis;

  if (seconds <= 0 || seconds > 120) {
    throw new Error('seconds must be between 0 and 120 (use --max-duration on make-clip for longer)');
  }

  if (jobId) {
    assertRightsForClipping(await getJob(jobId));
  } else if (rightsBasis) {
    assertRightsForClipping(rightsBasis);
  } else {
    throw new Error('Provide --job-id or --rights-basis');
  }

  let inputPath = options.fromPath;

  if (!inputPath) {
    const state = await loadActiveSession();
    if (!state) {
      throw new Error(
        'No active buffer session. Start one with: npm run clip:record:buffer -- "HLS_URL"\n' +
          'Or pass --from /path/to/local/recording.mkv'
      );
    }
    inputPath = await resolveInputFromBuffer(state, seconds, dryRun);
  }

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input not found: ${inputPath}`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const baseName = `last-${seconds}s-${stamp}`;
  const outputPath = options.output || path.join(CLIPS_OUTPUT_DIR, `${baseName}.mp4`);

  await fsp.mkdir(path.dirname(outputPath), { recursive: true });

  if (jobId) {
    await updateJob(jobId, {
      status: 'clipping',
      requested_clip_start: `-${seconds}s`,
      requested_clip_end: 'now',
      local_file_path: inputPath,
    });
  }

  await transcodeTail(inputPath, seconds, outputPath, dryRun);

  let meta = { thumbPath: null, probePath: null, summary: null };
  if (!dryRun) {
    meta = await generateThumbAndProbe(outputPath, baseName, dryRun);
  }

  if (jobId && !dryRun) {
    await updateJob(jobId, {
      status: 'review_ready',
      output_path: outputPath,
      thumbnail_path: meta.thumbPath,
      ffprobe_path: meta.probePath,
      error_message: null,
    });
    await appendAuditLog('save_last', jobId, { seconds, output_path: outputPath });
  }

  return {
    seconds,
    inputPath,
    outputPath,
    ...meta,
    dryRun,
  };
}

async function main() {
  const args = parseArgs(process.argv);

  try {
    const result = await saveLast({
      dryRun: args.dryRun,
      seconds: args.seconds,
      jobId: args.jobId,
      rightsBasis: args.rightsBasis,
      fromPath: args.fromPath,
      output: args.output,
    });

    console.log('[save-last] Done.');
    console.log(JSON.stringify(result, null, 2));
    console.log(`\nOpen: ${result.outputPath}`);
  } catch (err) {
    console.error(`[save-last] ERROR: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { saveLast, transcodeTail, concatSegments };
