'use strict';

const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { CLIPS_BUFFER_DIR, BUFFER_STATE_PATH } = require('./paths');

function ensureBufferDir() {
  fs.mkdirSync(CLIPS_BUFFER_DIR, { recursive: true });
}

async function writeState(state) {
  ensureBufferDir();
  state.updated_at = new Date().toISOString();
  const temp = `${BUFFER_STATE_PATH}.${process.pid}.tmp`;
  await fsp.writeFile(temp, JSON.stringify(state, null, 2), 'utf8');
  await fsp.rename(temp, BUFFER_STATE_PATH);
  return state;
}

async function loadActiveSession() {
  if (!fs.existsSync(BUFFER_STATE_PATH)) {
    return null;
  }
  const raw = await fsp.readFile(BUFFER_STATE_PATH, 'utf8');
  return JSON.parse(raw);
}

async function createSession({ sourceUrl, sourceType, jobId, segmentTime = 5, bufferSeconds = 90 }) {
  ensureBufferDir();
  const sessionId = crypto.randomUUID();
  const dir = path.join(CLIPS_BUFFER_DIR, sessionId);
  await fsp.mkdir(dir, { recursive: true });

  const state = {
    session_id: sessionId,
    source_url: sourceUrl,
    source_type: sourceType,
    job_id: jobId || null,
    dir,
    segment_pattern: path.join(dir, 'seg-%05d.mkv'),
    segment_time: segmentTime,
    buffer_seconds: bufferSeconds,
    segments: [],
    pid: null,
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await writeState(state);
  return state;
}

async function setSessionPid(pid) {
  const state = await loadActiveSession();
  if (!state) throw new Error('No active buffer session');
  state.pid = pid;
  return writeState(state);
}

function segmentSortKey(filename) {
  const match = filename.match(/seg-(\d+)\.mkv$/i);
  return match ? parseInt(match[1], 10) : 0;
}

async function refreshSegments(state) {
  const files = await fsp.readdir(state.dir);
  state.segments = files
    .filter((f) => /^seg-\d+\.mkv$/i.test(f))
    .sort((a, b) => segmentSortKey(a) - segmentSortKey(b));
  return state;
}

async function pruneSegments(state) {
  await refreshSegments(state);
  const maxSegments = Math.ceil(state.buffer_seconds / state.segment_time) + 1;

  while (state.segments.length > maxSegments) {
    const oldest = state.segments.shift();
    const fullPath = path.join(state.dir, oldest);
    try {
      await fsp.unlink(fullPath);
      console.log(`[rolling-buffer] Pruned ${oldest}`);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  return writeState(state);
}

function getSegmentPaths(state, count) {
  const slice = state.segments.slice(-count);
  return slice.map((f) => path.join(state.dir, f));
}

function segmentsNeededForSeconds(state, seconds) {
  return Math.ceil(seconds / state.segment_time) + 1;
}

async function clearActiveSession() {
  if (fs.existsSync(BUFFER_STATE_PATH)) {
    await fsp.unlink(BUFFER_STATE_PATH);
  }
}

module.exports = {
  createSession,
  loadActiveSession,
  writeState,
  setSessionPid,
  refreshSegments,
  pruneSegments,
  getSegmentPaths,
  segmentsNeededForSeconds,
  clearActiveSession,
  segmentSortKey,
};
