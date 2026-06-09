#!/usr/bin/env node
'use strict';

/**
 * Merge extension .part-NNN.webm files and convert to MP4.
 * MediaRecorder fragments must be byte-merged (not ffmpeg concat demuxer).
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { convertWebmChunksToMp4Buffer, hasWebmHeader } = require('./lib/convert-webm-chunks');
const { CLIPS_OUTPUT_DIR, isDryRun } = require('./lib/paths');
const { assertRightsForClipping } = require('./lib/rights-guard');

function findPartFiles(basePath) {
  const dir = path.dirname(basePath);
  const base = path.basename(basePath).replace(/\.(webm|mp4)$/i, '');
  const entries = fs.readdirSync(dir);
  return entries
    .filter((name) => name.startsWith(`${base}.part-`) && name.endsWith('.webm'))
    .sort()
    .map((name) => path.join(dir, name));
}

async function main() {
  const argv = process.argv.slice(2).filter((a) => a !== '--dry-run');
  let rightsBasis = null;
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--rights-basis') {
      rightsBasis = argv[++i];
    } else {
      positional.push(argv[i]);
    }
  }

  const basePath = positional[0];
  if (!basePath) {
    console.error('Usage: node concat-webm-parts.js BASENAME [--rights-basis "..."]');
    process.exit(1);
  }

  assertRightsForClipping(rightsBasis || '');

  const parts = findPartFiles(basePath);
  if (parts.length === 0) {
    throw new Error(`No part files found for ${basePath}. Expected ${path.basename(basePath)}.part-000.webm etc.`);
  }

  const buffers = parts.map((partPath) => fs.readFileSync(partPath));
  const merged = Buffer.concat(buffers);
  if (!hasWebmHeader(merged)) {
    throw new Error(
      'First part is missing WebM header. Re-record with extension v1.4.0+ after buffer fills.'
    );
  }

  const webmChunksBase64 = buffers.map((buf) => buf.toString('base64'));
  const base = path.basename(basePath).replace(/\.(webm|mp4)$/i, '');
  const outputPath = positional[1] || path.join(CLIPS_OUTPUT_DIR, `${base}.mp4`);

  if (isDryRun()) {
    console.log(JSON.stringify({ dryRun: true, parts, mergedBytes: merged.length, outputPath }, null, 2));
    return;
  }

  await fsp.mkdir(path.dirname(outputPath), { recursive: true });
  console.log(`[concat-parts] ${parts.length} parts (${merged.length} bytes) → ${outputPath}`);
  const mp4 = convertWebmChunksToMp4Buffer(null, webmChunksBase64);
  fs.writeFileSync(outputPath, mp4);
  console.log(JSON.stringify({ ok: true, outputPath, parts: parts.length, mergedBytes: merged.length }, null, 2));
}

main().catch((err) => {
  console.error(`[concat-parts] ERROR: ${err.message}`);
  process.exit(1);
});
