#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../../../');
const VENDOR = path.join(__dirname, 'vendor');
const coreEsm = path.join(ROOT, 'node_modules/@ffmpeg/core/dist/esm');

if (!fs.existsSync(coreEsm)) {
  console.error('Missing @ffmpeg/core. Run: npm install @ffmpeg/core');
  process.exit(1);
}

fs.mkdirSync(VENDOR, { recursive: true });
fs.copyFileSync(path.join(coreEsm, 'ffmpeg-core.js'), path.join(VENDOR, 'ffmpeg-core.js'));
fs.copyFileSync(path.join(coreEsm, 'ffmpeg-core.wasm'), path.join(VENDOR, 'ffmpeg-core.wasm'));

console.log('[copy-vendor] FFmpeg core copied to extension/vendor/');
