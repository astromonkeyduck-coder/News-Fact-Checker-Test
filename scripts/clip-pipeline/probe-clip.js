#!/usr/bin/env node
'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { runFfprobe, summarizeProbe } = require('./ffmpeg-utils');
const { CLIPS_PROBE_DIR, isDryRun } = require('./lib/paths');

async function main() {
  const dryRun = isDryRun();
  const input = process.argv[2];
  const outArg = process.argv[3];

  if (!input) {
    console.error('Usage: node probe-clip.js INPUT [OUTPUT.json] [--dry-run]');
    process.exit(1);
  }

  if (!fs.existsSync(input)) {
    console.error(`File not found: ${input}`);
    process.exit(1);
  }

  const outputPath =
    outArg && !outArg.startsWith('--')
      ? outArg
      : path.join(CLIPS_PROBE_DIR, `${path.basename(input, path.extname(input))}.json`);

  const result = await runFfprobe(input, { dryRun });
  if (result.dryRun) {
    console.log('[probe-clip] Dry run complete.');
    process.exit(0);
  }

  await fsp.mkdir(path.dirname(outputPath), { recursive: true });
  await fsp.writeFile(outputPath, JSON.stringify(result.raw, null, 2), 'utf8');

  console.log('[probe-clip] Summary:');
  console.log(JSON.stringify(summarizeProbe(result.raw), null, 2));
  console.log(`[probe-clip] Written: ${outputPath}`);
}

main().catch((err) => {
  console.error(`[probe-clip] ERROR: ${err.message}`);
  process.exit(1);
});
