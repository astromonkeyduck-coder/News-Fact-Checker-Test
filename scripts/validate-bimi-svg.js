#!/usr/bin/env node
/**
 * Lightweight BIMI SVG preflight for noteworthynews.co.
 * Run: node scripts/validate-bimi-svg.js [path-to-svg]
 */

const fs = require('fs');
const path = require('path');

const svgPath = path.resolve(process.argv[2] || path.join(__dirname, '../bimi/bimi-logo.svg'));
const svg = fs.readFileSync(svgPath, 'utf8');
const errors = [];
const warnings = [];

if (!svg.includes('baseProfile="tiny-ps"')) {
  errors.push('Missing baseProfile="tiny-ps" (BIMI requires SVG Tiny PS).');
}

if (!/width="(\d+)"/.test(svg) || !/height="(\d+)"/.test(svg)) {
  errors.push('Missing absolute width/height attributes.');
} else {
  const w = Number(svg.match(/width="(\d+)"/)[1]);
  const h = Number(svg.match(/height="(\d+)"/)[1]);
  if (w !== h) errors.push(`Logo must be square (got ${w}x${h}).`);
  if (w < 96 || h < 96) errors.push(`Gmail requires at least 96x96px (got ${w}x${h}).`);
}

if (svg.includes('<script') || svg.includes('javascript:')) {
  errors.push('Scripts are not allowed in BIMI SVG.');
}

if (/xlink:href|href="http/i.test(svg)) {
  errors.push('External references are not allowed in BIMI SVG.');
}

if (/<image\b/i.test(svg)) {
  errors.push('Embedded raster images are not allowed in BIMI SVG.');
}

if (!/<rect[^>]+fill=/i.test(svg) && !/<circle[^>]+fill=/i.test(svg)) {
  warnings.push('BIMI logos should include a solid background fill.');
}

const sizeKb = Buffer.byteLength(svg, 'utf8') / 1024;
if (sizeKb > 32) {
  errors.push(`File exceeds 32 KB BIMI limit (${sizeKb.toFixed(1)} KB).`);
}

console.log(`BIMI SVG check: ${svgPath}`);
console.log(`Size: ${sizeKb.toFixed(2)} KB`);

if (warnings.length) {
  console.log('\nWarnings:');
  warnings.forEach((w) => console.log(`  - ${w}`));
}

if (errors.length) {
  console.log('\nErrors:');
  errors.forEach((e) => console.log(`  - ${e}`));
  process.exit(1);
}

console.log('\nOK — passes local BIMI SVG preflight.');
console.log('Next: host at https://noteworthynews.co/bimi/bimi-logo.svg and validate with https://bimigroup.org/bimi-generator/');
