#!/usr/bin/env node
'use strict';

/**
 * Rolling-buffer recorder for rights-cleared live feeds.
 * Keeps the last N seconds of segments so you can save a recent clip instantly.
 *
 * Do NOT use YouTube watch URLs. While monitoring a YouTube livestream for discovery,
 * record a parallel rights-cleared feed (pool, government HLS, your encoder, etc.).
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const { formatCommand, assertFfmpegAvailable } = require('./ffmpeg-utils');
const { assertSourceUrlAllowed, isYouTubeUrl } = require('./lib/source-guard');
const { isDryRun } = require('./lib/paths');
const { getJob, updateJob, appendAuditLog } = require('./clip-job-store');
const {
  createSession,
  loadActiveSession,
  setSessionPid,
  refreshSegments,
  pruneSegments,
  clearActiveSession,
} = require('./lib/rolling-buffer');

function parseArgs(argv) {
  const args = {
    dryRun: isDryRun(argv),
    jobId: null,
    segmentTime: 5,
    bufferSeconds: 90,
    sourceType: 'direct_hls',
    stop: false,
    status: false,
    positional: [],
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') continue;
    if (arg === '--job-id') { args.jobId = argv[++i]; continue; }
    if (arg === '--segment-time') { args.segmentTime = parseInt(argv[++i], 10); continue; }
    if (arg === '--buffer-seconds') { args.bufferSeconds = parseInt(argv[++i], 10); continue; }
    if (arg === '--source-type') { args.sourceType = argv[++i]; continue; }
    if (arg === '--stop') { args.stop = true; continue; }
    if (arg === '--status') { args.status = true; continue; }
    args.positional.push(arg);
  }

  return args;
}

function buildBufferRecordArgs(sourceUrl, segmentPattern, segmentTime) {
  return [
    '-hide_banner',
    '-y',
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-i', sourceUrl,
    '-map', '0:v:0?',
    '-map', '0:a:0?',
    '-c', 'copy',
    '-f', 'segment',
    '-segment_time', String(segmentTime),
    '-reset_timestamps', '1',
    segmentPattern,
  ];
}

async function stopBuffer() {
  const state = await loadActiveSession();
  if (!state) {
    console.log('[record-buffer] No active buffer session.');
    return null;
  }

  if (state.pid) {
    try {
      process.kill(state.pid, 'SIGTERM');
      console.log(`[record-buffer] Sent SIGTERM to pid ${state.pid}`);
    } catch (err) {
      if (err.code !== 'ESRCH') throw err;
    }
  }

  if (state.job_id) {
    await updateJob(state.job_id, { status: 'ready_to_clip' });
    await appendAuditLog('buffer_stopped', state.job_id, { session_id: state.session_id });
  }

  await clearActiveSession();
  console.log('[record-buffer] Buffer session stopped.');
  return state;
}

async function showStatus() {
  const state = await loadActiveSession();
  if (!state) {
    console.log('[record-buffer] No active buffer session.');
    return;
  }
  await refreshSegments(state);
  console.log(JSON.stringify({
    session_id: state.session_id,
    pid: state.pid,
    source_url: state.source_url,
    segment_time: state.segment_time,
    buffer_seconds: state.buffer_seconds,
    segments: state.segments.length,
    newest_segments: state.segments.slice(-5),
    started_at: state.started_at,
    save_last_hint: `npm run clip:save-last -- --seconds 30`,
  }, null, 2));
}

async function startBuffer(sourceUrl, options = {}) {
  if (isYouTubeUrl(sourceUrl)) {
    throw new Error(
      'YouTube watch URLs cannot be buffered. Use a rights-cleared HLS/RTMP feed. ' +
        'You can watch YouTube for discovery while this records your authorized source in parallel.'
    );
  }

  const existing = await loadActiveSession();
  if (existing?.pid) {
    throw new Error(
      `Buffer already running (session ${existing.session_id}, pid ${existing.pid}). ` +
        'Run with --stop first or use clip:save-last.'
    );
  }

  assertSourceUrlAllowed(options.sourceType || 'direct_hls', sourceUrl);

  const dryRun = options.dryRun ?? isDryRun();
  const jobId = options.jobId || null;

  if (jobId) {
    await updateJob(jobId, { status: 'recording', source_url: sourceUrl });
  }

  const state = await createSession({
    sourceUrl,
    sourceType: options.sourceType,
    jobId,
    segmentTime: options.segmentTime,
    bufferSeconds: options.bufferSeconds,
  });

  const ffmpeg = assertFfmpegAvailable();
  const ffArgs = buildBufferRecordArgs(sourceUrl, state.segment_pattern, state.segment_time);
  const logPath = path.join(state.dir, 'buffer.record.log');

  console.log(`[record-buffer] Rolling buffer → ${state.dir}`);
  console.log(`[record-buffer] Keeping ~${state.buffer_seconds}s (${state.segment_time}s segments)`);
  console.log(`[record-buffer] Save last 30s anytime: npm run clip:save-last`);

  if (dryRun) {
    console.log(`[record-buffer] DRY-RUN: ${formatCommand(ffmpeg, ffArgs)}`);
    return { dryRun: true, state };
  }

  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  logStream.write(`\n--- buffer started ${new Date().toISOString()} ---\n`);
  logStream.write(`${formatCommand(ffmpeg, ffArgs)}\n`);

  const child = spawn(ffmpeg, ffArgs, { stdio: ['ignore', 'pipe', 'pipe'], detached: false });

  await setSessionPid(child.pid);

  child.stdout.on('data', (chunk) => logStream.write(chunk));
  child.stderr.on('data', (chunk) => {
    logStream.write(chunk);
    process.stderr.write(chunk);
  });

  let watchTimer = null;
  const watcher = fs.watch(state.dir, () => {
    if (watchTimer) clearTimeout(watchTimer);
    watchTimer = setTimeout(async () => {
      try {
        const current = await loadActiveSession();
        if (!current) return;
        await pruneSegments(current);
      } catch (err) {
        console.error('[record-buffer] prune error:', err.message);
      }
    }, 500);
  });

  child.on('close', async (code) => {
    watcher.close();
    logStream.write(`\n--- buffer ended ${new Date().toISOString()} code=${code} ---\n`);
    logStream.end();

    if (jobId && code !== 0) {
      await updateJob(jobId, { status: 'failed', error_message: `Buffer recording exited ${code}` });
    }
    await clearActiveSession();
  });

  process.on('SIGINT', async () => {
    console.log('\n[record-buffer] Stopping…');
    child.kill('SIGTERM');
    if (jobId) {
      await updateJob(jobId, { status: 'ready_to_clip' });
    }
    await clearActiveSession();
    process.exit(0);
  });

  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('spawn', () => {
      resolve({ state, pid: child.pid, logPath });
    });
  });
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.status) {
    await showStatus();
    return;
  }

  if (args.stop) {
    await stopBuffer();
    return;
  }

  const [sourceUrl] = args.positional;
  if (!sourceUrl) {
    console.error(`Usage: node record-buffer.js SOURCE_URL [options]
  --buffer-seconds 90   How much history to retain (default 90)
  --segment-time 5      Segment length in seconds (default 5)
  --job-id UUID         Link to clip job
  --stop                Stop active buffer
  --status              Show active buffer status
  --dry-run

YouTube watch URLs are NOT supported. Record a rights-cleared feed in parallel
while you monitor YouTube for discovery.`);
    process.exit(1);
  }

  try {
    const result = await startBuffer(sourceUrl, {
      dryRun: args.dryRun,
      jobId: args.jobId,
      segmentTime: args.segmentTime,
      bufferSeconds: args.bufferSeconds,
      sourceType: args.sourceType,
    });

    if (result.dryRun) return;

    console.log(`[record-buffer] Running (pid ${result.pid}). Press Ctrl+C to stop.`);
    // Keep process alive while ffmpeg runs
    await new Promise(() => {});
  } catch (err) {
    console.error(`[record-buffer] ERROR: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { startBuffer, stopBuffer, showStatus, buildBufferRecordArgs };
