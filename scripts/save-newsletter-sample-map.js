#!/usr/bin/env node
/**
 * Generate and save newsletter-sample-map.png to the repo for permanent storage.
 * The image is then served as a static asset from your site.
 *
 * Run once: node scripts/save-newsletter-sample-map.js
 * Then: git add newsletter-sample-map.png && git commit -m "Add newsletter sample map" && git push
 *
 * For a REAL map (not just coordinates text): set MAPBOX_TOKEN in .env or environment.
 * Without it, fallback shows a location card. Deployed Netlify may have MAPBOX_TOKEN.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BASE_URL = process.env.URL || process.env.NETLIFY_URL || 'https://noteworthynews.co';
const OUTPUT_FILE = path.join(__dirname, '../newsletter-sample-map.png');

async function fetchFromDeployedSite() {
  console.log('1. Generating via deployed Netlify function...');
  const genRes = await fetch(`${BASE_URL.replace(/\/$/, '')}/.netlify/functions/generate-sample-earthquake-map`);
  if (!genRes.ok) return null;
  console.log('   ✅ Generated');

  console.log('2. Fetching image...');
  const imgRes = await fetch(`${BASE_URL.replace(/\/$/, '')}/.netlify/functions/get-uploaded-image?key=newsletter-sample-map.png`);
  if (!imgRes.ok) return null;
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  if (buffer.length < 1000) return null;
  return buffer;
}

async function generateLocally() {
  console.log('   Trying local generation...');
  const generateImage = require('../netlify/functions/generate-earthquake-image').generateImage;
  const magnitude = 6.2;
  const location = 'Near Japan';
  const eventId = 'newsletter-sample';
  const coordinates = [139.7, 35.6];
  return generateImage(magnitude, location, eventId, 'standard', coordinates, null);
}

async function saveMap() {
  console.log('📷 Saving newsletter sample map to repo...\n');

  let buffer = await fetchFromDeployedSite();
  if (!buffer) {
    console.log('   Deployed fetch failed.');
    buffer = await generateLocally();
  }
  if (!buffer || buffer.length < 1000) {
    console.error('❌ Could not get image. Ensure site is deployed or run from project with deps installed.');
    process.exit(1);
  }

  // Resize and compress aggressively for email (320x180 JPEG ~25-40KB to avoid Gmail 102KB truncation)
  try {
    const sharp = require('sharp');
    buffer = await sharp(buffer)
      .resize(320, 180, { fit: 'cover' })
      .jpeg({ quality: 70 })
      .toBuffer();
    const jpegPath = path.join(__dirname, '../newsletter-sample-map.jpg');
    fs.writeFileSync(jpegPath, buffer);
    if (fs.existsSync(OUTPUT_FILE)) fs.unlinkSync(OUTPUT_FILE);
    console.log('   ✅ Resized for newsletter (JPEG for small size)');
  } catch (e) {
    console.warn('   ⚠️ Could not resize:', e.message);
    fs.writeFileSync(OUTPUT_FILE, buffer);
  }

  const outPath = fs.existsSync(path.join(__dirname, '../newsletter-sample-map.jpg')) 
    ? path.join(__dirname, '../newsletter-sample-map.jpg') : OUTPUT_FILE;
  const finalBuffer = fs.readFileSync(outPath);
  console.log('   ✅ Saved to', path.relative(process.cwd(), outPath), `(${Math.round(finalBuffer.length / 1024)} KB)`);

  console.log('\n✅ Done! Next steps:');
  console.log('   git add newsletter-sample-map.jpg newsletter-sample-map.png');
  console.log('   git commit -m "Add permanent newsletter sample map"');
  console.log('   git push');
  console.log('\n   After push, the newsletter will use: https://noteworthynews.co/newsletter-sample-map.jpg');
}

saveMap().catch((e) => {
  console.error(e);
  process.exit(1);
});
