#!/usr/bin/env node
'use strict';

/**
 * Record rights-cleared HLS/RTMP streams to MKV.
 * Do NOT pass YouTube watch URLs - use authorized direct feeds only.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const { formatCommand, assertFfmpegAvailable } = require('./ffmpeg-utils');
const { assertSourceUrlAllowed, isYouTubeUrl } = require('./lib/source-guard');
const { isDryRun, CLIPS_RAW_DIR } = require('./lib/paths');
const { getJob, updateJob, appendAuditLog } = require('./clip-job-store');

function parseArgs(argv) {
  const args = {
    dryRun: isDryRun(argv),
    jobId: null,
    segment: false,
    segmentTime: 3600,
    sourceType: 'direct_hls',
    positional: [],
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') continue;
    if (arg === '--job-id') {
      args.jobId = argv[++i];
      continue;
    }
    if (arg === '--segment') {
      args.segment = true;
      continue;
    }
    if (arg === '--segment-time') {
      args.segmentTime = parseInt(argv[++i], 10);
      continue;
    }
    if (arg === '--source-type') {
      args.sourceType = argv[++i];
      continue;
    }
    args.positional.push(arg);
  }

  return args;
}

function buildRecordArgs(sourceUrl, outputPath, { segment, segmentTime }) {
  const args = [
    '-hide_banner',
    '-y',
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-i', sourceUrl,
    '-map', '0:v:0?',
    '-map', '0:a:0?',
    '-c', 'copy',
  ];

  if (segment) {
    const segmentPattern = outputPath.replace(/\.mkv$/i, '') + '-%03d.mkv';
    args.push(
      '-f', 'segment',
      '-segment_time', String(segmentTime),
      '-reset_timestamps', '1',
      segmentPattern
    );
  } else {
    args.push(outputPath);
  }

  return args;
}

async function recordLive(sourceUrl, outputPath, options = {}) {
  if (isYouTubeUrl(sourceUrl)) {
    throw new Error('YouTube URLs cannot be recorded. Use a rights-cleared direct HLS/RTMP feed.');
  }

  const sourceType = options.sourceType || 'direct_hls';
  assertSourceUrlAllowed(sourceType, sourceUrl);

  const dryRun = options.dryRun ?? isDryRun();
  const jobId = options.jobId || null;

  await fsp.mkdir(path.dirname(outputPath), { recursive: true });
  const logPath = `${outputPath}.record.log`;

  if (jobId) {
    await updateJob(jobId, {
      status: 'recording',
      source_url: sourceUrl,
      local_file_path: outputPath,
    });
  }

  const ffmpeg = assertFfmpegAvailable();
  const ffArgs = buildRecordArgs(sourceUrl, outputPath, {
    segment: options.segment,
    segmentTime: options.segmentTime,
  });

  console.log(`[record-live] Recording → ${outputPath}`);
  console.log(`[record-live] Log → ${logPath}`);

  if (dryRun) {
    console.log(`[record-live] DRY-RUN: ${formatCommand(ffmpeg, ffArgs)}`);
    return { dryRun: true, outputPath, logPath };
  }

  return new Promise((resolve, reject) => {
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    logStream.write(`\n--- record started ${new Date().toISOString()} ---\n`);
    logStream.write(`${formatCommand(ffmpeg, ffArgs)}\n`);

    const child = spawn(ffmpeg, ffArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

    child.stdout.on('data', (chunk) => logStream.write(chunk));
    child.stderr.on('data', (chunk) => {
      logStream.write(chunk);
      process.stderr.write(chunk);
    });

    child.on('error', async (err) => {
      logStream.end();
      if (jobId) {
        await updateJob(jobId, { status: 'failed', error_message: err.message });
      }
      reject(err);
    });

    child.on('close', async (code) => {
      logStream.write(`\n--- record ended ${new Date().toISOString()} code=${code} ---\n`);
      logStream.end();

      if (code === 0) {
        if (jobId) {
          await updateJob(jobId, {
            status: 'ready_to_clip',
            local_file_path: outputPath,
            error_message: null,
          });
          await appendAuditLog('recording_complete', jobId, { output_path: outputPath });
        }
        resolve({ outputPath, logPath, code });
      } else {
        const msg = `FFmpeg recording exited with code ${code}`;
        if (jobId) {
          await updateJob(jobId, { status: 'failed', error_message: msg });
        }
        reject(new Error(msg));
      }
    });
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const [sourceUrl, outputArg] = args.positional;

  if (!sourceUrl) {
    console.error('Usage: node record-live.js SOURCE_URL [OUTPUT.mkv] [--job-id UUID] [--segment] [--dry-run]');
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath =
    outputArg || path.join(CLIPS_RAW_DIR, `event-${timestamp}.mkv`);

  try {
    const result = await recordLive(sourceUrl, outputPath, {
      dryRun: args.dryRun,
      jobId: args.jobId,
      segment: args.segment,
      segmentTime: args.segmentTime,
      sourceType: args.sourceType,
    });
    console.log('[record-live] Done.');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(`[record-live] ERROR: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { recordLive, buildRecordArgs };
