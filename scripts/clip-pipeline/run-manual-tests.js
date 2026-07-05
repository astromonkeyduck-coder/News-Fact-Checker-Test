#!/usr/bin/env node
'use strict';

/**
 * Manual test suite for clip pipeline (no Jest required).
 * Run: npm run test:clip-pipeline
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { spawnSync } = require('child_process');
const { parseTimestamp, validateClipRange } = require('./lib/timestamps');
const { assertRightsForClipping, hasRightsBasis } = require('./lib/rights-guard');
const { assertSourceUrlAllowed, isYouTubeUrl } = require('./lib/source-guard');
const { getFfmpegPath, getFfprobePath, validateXReadyProbe } = require('./ffmpeg-utils');
const { createJob, getJob, updateJob, listJobs } = require('./clip-job-store');
const { segmentsNeededForSeconds, segmentSortKey } = require('./lib/rolling-buffer');
const { isXUploadConfigured, printManualInstructions } = require('./x-upload');
const { CLIPS_OUTPUT_DIR } = require('./lib/paths');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${message}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${message}`);
  }
}

function assertThrows(fn, message) {
  try {
    fn();
    failed += 1;
    console.error(`  ✗ ${message} (expected throw)`);
  } catch {
    passed += 1;
    console.log(`  ✓ ${message}`);
  }
}

async function testTimestamps() {
  console.log('\n[timestamps]');
  assert(parseTimestamp('90') === 90, 'parses seconds');
  assert(parseTimestamp('01:30') === 90, 'parses MM:SS');
  assert(parseTimestamp('00:01:30') === 90, 'parses HH:MM:SS');
  assertThrows(() => validateClipRange('00:01:00', '00:00:30'), 'rejects start >= end');
  assertThrows(() => validateClipRange('00:00:00', '00:05:00', 120), 'rejects clip over max duration');
}

function testRightsGuard() {
  console.log('\n[rights-guard]');
  assert(hasRightsBasis({ rights_basis: 'Licensed pool feed' }), 'accepts rights_basis');
  assert(!hasRightsBasis({ rights_basis: '  ' }), 'rejects empty rights_basis');
  assertThrows(() => assertRightsForClipping({ rights_basis: '' }), 'blocks clipping without rights');
}

function testSourceGuard() {
  console.log('\n[source-guard]');
  assert(isYouTubeUrl('https://www.youtube.com/watch?v=abc'), 'detects YouTube URL');
  assertThrows(
    () => assertSourceUrlAllowed('direct_hls', 'https://www.youtube.com/watch?v=abc'),
    'rejects YouTube as HLS source'
  );
  assertThrows(
    () => assertSourceUrlAllowed('youtube_metadata_only', 'https://www.youtube.com/watch?v=abc'),
    'rejects YouTube URL even for metadata-only type'
  );
}

function testFfmpegAvailability() {
  console.log('\n[ffmpeg]');
  const ffmpeg = getFfmpegPath();
  const ffprobe = getFfprobePath();
  assert(Boolean(ffmpeg), `ffmpeg found: ${ffmpeg || 'MISSING'}`);
  assert(Boolean(ffprobe), `ffprobe found: ${ffprobe || 'MISSING'}`);

  if (ffmpeg) {
    const r = spawnSync(ffmpeg, ['-version'], { encoding: 'utf8' });
    assert(r.status === 0, 'ffmpeg -version succeeds');
  }
}

function testProbeValidation() {
  console.log('\n[probe validation]');
  const good = validateXReadyProbe({
    duration: 30,
    container: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac',
    width: 1280,
  });
  assert(good.length === 0, 'valid X-ready probe passes');

  const bad = validateXReadyProbe({
    duration: 0,
    container: 'matroska',
    videoCodec: 'vp9',
    audioCodec: 'opus',
    width: 1920,
  });
  assert(bad.length > 0, 'invalid probe fails validation');
}

async function testJobStore() {
  console.log('\n[job store]');
  const job = await createJob({
    title: 'Test job',
    source_type: 'local_file',
    rights_basis: 'Test rights - manual test only',
    source_attribution: '@test',
  });
  assert(Boolean(job.id), 'creates job with id');

  const loaded = await getJob(job.id);
  assert(loaded.title === 'Test job', 'loads job by id');

  await updateJob(job.id, { status: 'review_ready' }, { skipTransitionCheck: true });
  const updated = await getJob(job.id);
  assert(updated.status === 'review_ready', 'updates job status');

  const list = await listJobs();
  assert(list.some((j) => j.id === job.id), 'lists jobs');
}

function testRollingBufferMath() {
  console.log('\n[rolling-buffer]');
  assert(segmentsNeededForSeconds({ segment_time: 5 }, 30) >= 7, 'segments needed for 30s at 5s each');
  assert(segmentSortKey('seg-00012.mkv') === 12, 'segment sort key');
}

async function testSaveLastFromFile() {
  console.log('\n[save-last from file]');
  const testInput = process.env.CLIP_TEST_INPUT || 'data/clips/raw/test-source.mp4';
  if (!fs.existsSync(testInput)) {
    console.log('  ⚠ Skipped - no test video at', testInput);
    return;
  }

  const { saveLast } = require('./save-last');
  const result = await saveLast({
    dryRun: true,
    seconds: 3,
    rightsBasis: 'Test synthetic video',
    fromPath: testInput,
  });
  assert(result.dryRun === true, 'save-last dry-run from file');
}

function testXUploadDisabled() {
  console.log('\n[x-upload disabled]');
  const prevEnabled = process.env.X_UPLOAD_ENABLED;
  const prevToken = process.env.X_USER_ACCESS_TOKEN;
  delete process.env.X_UPLOAD_ENABLED;
  delete process.env.X_USER_ACCESS_TOKEN;
  assert(!isXUploadConfigured(), 'X upload not configured without env');
  printManualInstructions('/tmp/test-clip.mp4', 'Test post');
  process.env.X_UPLOAD_ENABLED = prevEnabled;
  process.env.X_USER_ACCESS_TOKEN = prevToken;
}

async function testMakeClipDryRun() {
  console.log('\n[make-clip dry-run]');
  const testInput = process.env.CLIP_TEST_INPUT;
  if (!testInput || !fs.existsSync(testInput)) {
    console.log('  ⚠ Skipped - set CLIP_TEST_INPUT to a local video file for integration test');
    return;
  }

  const outPath = path.join(CLIPS_OUTPUT_DIR, 'test-clip-dry-run.mp4');
  const { makeClip } = require('./make-clip');

  const result = await makeClip(testInput, '0:00:01', '0:00:03', outPath, {
    dryRun: true,
    rightsBasis: 'Test rights - manual test only',
    maxDuration: 120,
  });
  assert(result.dryRun === true, 'make-clip dry-run completes');
}

async function main() {
  console.log('Clip Pipeline Manual Tests');
  console.log('========================');

  await testTimestamps();
  testRightsGuard();
  testSourceGuard();
  testFfmpegAvailability();
  testProbeValidation();
  testRollingBufferMath();
  await testJobStore();
  testXUploadDisabled();
  await testSaveLastFromFile();
  await testMakeClipDryRun();

  console.log('\n========================');
  console.log(`Passed: ${passed}  Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
