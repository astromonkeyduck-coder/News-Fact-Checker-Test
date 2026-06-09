#!/usr/bin/env node
'use strict';

/**
 * Convert a browser-captured WebM (e.g. from YouTube save-last button) to X-ready MP4.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { runFfmpeg, runFfprobe, validateXReadyProbe } = require('./ffmpeg-utils');
const { assertRightsForClipping } = require('./lib/rights-guard');
const { CLIPS_OUTPUT_DIR, isDryRun } = require('./lib/paths');

async function convertWebm(inputPath, outputPath, options = {}) {
  const dryRun = options.dryRun ?? isDryRun();

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input not found: ${inputPath}`);
  }

  assertRightsForClipping(options.rightsBasis || '');

  await fsp.mkdir(path.dirname(outputPath), { recursive: true });

  const args = [
    '-hide_banner', '-y',
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

  console.log(`[convert-webm] → ${outputPath}`);
  await runFfmpeg(args, { dryRun });

  if (dryRun) {
    return { outputPath, dryRun: true };
  }

  const probe = await runFfprobe(outputPath);
  const errors = validateXReadyProbe(probe.summary);
  if (errors.length) {
    throw new Error(errors.join('; '));
  }

  return { outputPath, summary: probe.summary };
}

async function main() {
  const dryRun = isDryRun();
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

  const [input, outputArg] = positional;
  if (!input) {
    console.error('Usage: node convert-webm.js INPUT.webm [OUTPUT.mp4] --rights-basis "..." [--dry-run]');
    process.exit(1);
  }

  const base = path.basename(input, path.extname(input));
  const output = outputArg || path.join(CLIPS_OUTPUT_DIR, `${base}.mp4`);

  try {
    const result = await convertWebm(input, output, { dryRun, rightsBasis });
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(`[convert-webm] ERROR: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { convertWebm };
