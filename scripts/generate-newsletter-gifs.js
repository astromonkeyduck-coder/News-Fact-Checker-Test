#!/usr/bin/env node
/**
 * Generate animated GIFs for the Noteworthy News showcase newsletter.
 * Creates: newsletter-location-alert.gif, newsletter-earthquake-live.gif, newsletter-map-preview.gif
 *
 * Run: node scripts/generate-newsletter-gifs.js
 * Then: git add newsletter-*.gif && git commit && git push
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const sharp = require('sharp');
const { GIFEncoder, quantize, applyPalette } = require('gifenc');

const BASE_URL = process.env.URL || process.env.NETLIFY_URL || 'https://noteworthynews.co';
const FRAME_COUNT = 8;
const FRAME_DELAY_MS = 120;
const CARD_SIZE = { w: 270, h: 180 };
const MAP_SIZE = { w: 480, h: 270 };

async function fetchBaseMap() {
  console.log('1. Fetching base map from deployed site...');
  const genRes = await fetch(`${BASE_URL.replace(/\/$/, '')}/.netlify/functions/generate-sample-earthquake-map`);
  if (!genRes.ok) {
    console.log('   Deployed fetch failed, trying local...');
    return null;
  }
  const imgRes = await fetch(`${BASE_URL.replace(/\/$/, '')}/.netlify/functions/get-uploaded-image?key=newsletter-sample-map.png`);
  if (!imgRes.ok) return null;
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  if (buffer.length < 1000) return null;
  console.log('   ✅ Fetched');
  return buffer;
}

async function getBaseMapLocally() {
  const { generateImage } = require('../netlify/functions/generate-earthquake-image').generateImage;
  return generateImage(6.2, 'Tokyo, Japan', 'newsletter-sample', 'standard', [139.7, 35.6], null);
}

async function framesToGif(frames, width, height) {
  const gif = GIFEncoder({ width, height, repeat: 0 });
  const sampleFrames = [frames[0], frames[Math.floor(frames.length / 2)], frames[frames.length - 1]];
  const allPixels = [];
  for (const f of sampleFrames) {
    const { data } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const rgba = new Uint8ClampedArray(data);
    for (let i = 0; i < rgba.length; i += 40) {
      allPixels.push(rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]);
    }
  }
  const palette = quantize(new Uint8ClampedArray(allPixels), 128);
  for (let i = 0; i < frames.length; i++) {
    const { data, info } = await sharp(frames[i]).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const index = applyPalette(new Uint8ClampedArray(data), palette);
    gif.writeFrame(index, info.width, info.height, { palette, delay: FRAME_DELAY_MS });
  }
  gif.finish();
  return Buffer.from(gif.bytes());
}

async function makePulsingOverlayFrames(baseBuffer, size, label) {
  const frames = [];
  for (let i = 0; i < FRAME_COUNT; i++) {
    const t = (i / FRAME_COUNT) * Math.PI * 2;
    const pulse = 0.4 + 0.3 * Math.sin(t);
    const svg = `<svg width="${size.w}" height="${size.h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="rgba(74,144,226,0)"/>
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" 
            font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="rgba(255,255,255,${pulse})"
            style="text-shadow:0 0 8px rgba(74,144,226,0.8)">${label}</text>
    </svg>`;
    const frame = await sharp(baseBuffer)
      .resize(size.w, size.h, { fit: 'cover' })
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .png()
      .toBuffer();
    frames.push(frame);
  }
  return frames;
}

async function main() {
  console.log('📷 Generating newsletter GIFs...\n');

  let baseMap = await fetchBaseMap();
  if (!baseMap) {
    baseMap = await getBaseMapLocally();
  }
  if (!baseMap || baseMap.length < 1000) {
    console.error('❌ Could not get base map. Run save-newsletter-sample-map.js first or deploy the site.');
    process.exit(1);
  }

  const outDir = path.join(__dirname, '..');
  const outputs = [
    { file: 'newsletter-location-alert.gif', label: 'LOCATION', size: CARD_SIZE },
    { file: 'newsletter-earthquake-live.gif', label: 'LIVE', size: CARD_SIZE },
    { file: 'newsletter-map-preview.gif', label: '3D MAP', size: MAP_SIZE },
  ];

  for (const out of outputs) {
    console.log(`   Generating ${out.file} (${out.label})...`);
    const frames = await makePulsingOverlayFrames(baseMap, out.size, out.label);
    const gifBuffer = await framesToGif(frames, out.size.w, out.size.h);
    fs.writeFileSync(path.join(outDir, out.file), gifBuffer);
    console.log(`   ✅ ${out.file} (${Math.round(gifBuffer.length / 1024)} KB)`);
  }

  console.log('\n✅ Done! Next steps:');
  console.log('   git add newsletter-location-alert.gif newsletter-earthquake-live.gif newsletter-map-preview.gif');
  console.log('   git commit -m "Add newsletter showcase GIFs"');
  console.log('   git push');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
