#!/usr/bin/env node
'use strict';

/**
 * Chrome Native Messaging host — converts WebM → MP4 using bundled ffmpeg-static.
 * Supports chunked upload (Chrome limits each native message to ~1MB).
 * Install: npm run clip:install-native-host
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { convertWebmChunksToMp4Buffer, ffmpegPath } = require('../../lib/convert-webm-chunks');

const SESSIONS_ROOT = path.join(os.tmpdir(), 'noteworthy-clip-sessions');

function readExact(fd, length) {
  const buf = Buffer.alloc(length);
  let offset = 0;
  while (offset < length) {
    const n = fs.readSync(fd, buf, offset, length - offset);
    if (n === 0) throw new Error('Unexpected EOF');
    offset += n;
  }
  return buf;
}

function readMessage() {
  const lenBuf = readExact(0, 4);
  const len = lenBuf.readUInt32LE(0);
  if (len <= 0 || len > 100 * 1024 * 1024) {
    throw new Error(`Invalid message length: ${len}`);
  }
  return JSON.parse(readExact(0, len).toString('utf8'));
}

function writeMessage(obj) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  fs.writeSync(1, header);
  fs.writeSync(1, body);
}

function sessionDir(sessionId) {
  return path.join(SESSIONS_ROOT, sessionId);
}

function beginSession(message) {
  if (!message.sessionId || !message.filename) {
    throw new Error('Missing sessionId or filename');
  }
  const dir = sessionDir(message.sessionId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({
    filename: message.filename,
    chunkCount: Number(message.chunkCount) || 0,
  }), 'utf8');
  return { ok: true };
}

function writeChunk(message) {
  if (!message.sessionId || message.index == null || !message.data) {
    throw new Error('Missing sessionId, index, or data');
  }
  const dir = sessionDir(message.sessionId);
  if (!fs.existsSync(dir)) {
    throw new Error(`Unknown session: ${message.sessionId}`);
  }
  const partPath = path.join(dir, `part-${String(message.index).padStart(3, '0')}.webm`);
  const buf = Buffer.from(message.data, 'base64');
  if (message.append && fs.existsSync(partPath)) {
    fs.appendFileSync(partPath, buf);
  } else {
    fs.writeFileSync(partPath, buf);
  }
  const bytesWritten = fs.statSync(partPath).size;
  return { ok: true, index: message.index, bytesWritten };
}

function commitSession(message) {
  if (!message.sessionId) {
    throw new Error('Missing sessionId');
  }
  const dir = sessionDir(message.sessionId);
  const metaPath = path.join(dir, 'meta.json');
  if (!fs.existsSync(metaPath)) {
    throw new Error(`Unknown session: ${message.sessionId}`);
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const partFiles = fs.readdirSync(dir)
    .filter((name) => name.startsWith('part-') && name.endsWith('.webm'))
    .sort()
    .map((name) => path.join(dir, name));

  if (partFiles.length === 0) {
    throw new Error('No chunks received for session');
  }

  const webmChunksBase64 = partFiles.map((partPath) => fs.readFileSync(partPath).toString('base64'));
  const mp4 = convertWebmChunksToMp4Buffer(null, webmChunksBase64);

  const downloadsDir = path.join(os.homedir(), 'Downloads');
  fs.mkdirSync(downloadsDir, { recursive: true });
  const savedTo = path.join(downloadsDir, meta.filename);
  fs.writeFileSync(savedTo, mp4);

  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  return { ok: true, savedTo, size: mp4.length };
}

function convertInline(message) {
  if (!message.webmBase64 && !(message.webmChunksBase64 || []).length) {
    throw new Error('Missing webmBase64');
  }

  const mp4 = convertWebmChunksToMp4Buffer(
    message.webmBase64,
    message.webmChunksBase64
  );

  const downloadsDir = path.join(os.homedir(), 'Downloads');
  fs.mkdirSync(downloadsDir, { recursive: true });
  const filename = message.filename || `youtube-clip-${Date.now()}.mp4`;
  const savedTo = path.join(downloadsDir, filename);
  fs.writeFileSync(savedTo, mp4);

  return { ok: true, savedTo, size: mp4.length };
}

function handleMessage(message) {
  if (message.type === 'ping') {
    return { ok: true, pong: true, ffmpeg: ffmpegPath };
  }

  if (message.type === 'begin') {
    return beginSession(message);
  }

  if (message.type === 'chunk') {
    return writeChunk(message);
  }

  if (message.type === 'commit') {
    return commitSession(message);
  }

  if (message.type === 'convert') {
    return convertInline(message);
  }

  throw new Error(`Unknown message type: ${message.type}`);
}

function main() {
  try {
    fs.mkdirSync(SESSIONS_ROOT, { recursive: true });
    const message = readMessage();
    const response = handleMessage(message);
    writeMessage(response);
  } catch (err) {
    writeMessage({ ok: false, error: err.message || String(err) });
    process.exit(1);
  }
}

main();
