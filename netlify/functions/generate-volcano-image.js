/**
 * Generate branded volcano alert image using the same template as earthquakes.
 * Produces a 4K composite: template + text overlay + 2 Mapbox satellite views.
 *
 * Called directly from the volcano engine (not an HTTP endpoint).
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const resvg = require('@resvg/resvg-js');
const crypto = require('crypto');

// ── Fonts ──────────────────────────────────────────────────────────────────
let FONT_DATA = { regular: null, bold: null };
let FONT_BUFFERS = { regular: null, bold: null };
try {
  FONT_DATA = require('./fonts-base64.js');
  if (FONT_DATA.regular) {
    const b64 = FONT_DATA.regular.split(',')[1] || FONT_DATA.regular;
    FONT_BUFFERS.regular = Buffer.from(b64, 'base64');
  }
  if (FONT_DATA.bold) {
    const b64 = FONT_DATA.bold.split(',')[1] || FONT_DATA.bold;
    FONT_BUFFERS.bold = Buffer.from(b64, 'base64');
  }
} catch (err) {
  console.error('[generate-volcano-image] Failed to load fonts:', err.message);
}

// ── Template / output constants ────────────────────────────────────────────
const TEMPLATE_WIDTH = 940;
const TEMPLATE_HEIGHT = 788;
const OUTPUT_WIDTH = 3840;
const OUTPUT_HEIGHT = 2160;

// Text placement (matches earthquake layout)
const ANCHOR_X = 50;
const ALIGN_SHIFT_X = 18;
const HEADLINE_BASELINE_Y = 200; // 100 base + 100 block offset
const LOCATION_OFFSET = 75;
const SAFE_LEFT = ANCHOR_X + ALIGN_SHIFT_X;
const SAFE_RIGHT_RATIO = 0.58;
const SAFE_LEFT_MARGIN = 40;
const HEADLINE_FONT_SIZE_BASE = 65;
const LOCATION_FONT_SIZE = 50;
const LOCATION_FONT_SIZE_MIN = 42;
const TEXT_GAP = 12;

// Colors - orange-red theme for volcanoes
const HEADLINE_COLOR = '#FFFFFF';
const ALERT_COLOR = '#FF4500'; // orange-red for volcano alerts

// ── Helpers ────────────────────────────────────────────────────────────────

function escapeSVG(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function estimateTextWidth(text, fontSize) {
  return text.length * fontSize * 0.6;
}

function bufferHash(buf) {
  if (!buf || !Buffer.isBuffer(buf)) return 'null';
  return crypto.createHash('sha1').update(buf).digest('hex').substring(0, 8);
}

// ── Template loading ───────────────────────────────────────────────────────

async function loadTemplate() {
  const candidates = [
    path.join(__dirname, '3rdUSGSTemp.png'),
    path.join(path.dirname(__dirname), '3rdUSGSTemp.png'),
    path.join(__dirname, '../../3rdUSGSTemp.png'),
    path.join(process.cwd(), 'netlify/functions/3rdUSGSTemp.png'),
    path.join(process.cwd(), '3rdUSGSTemp.png'),
    '/var/task/netlify/functions/3rdUSGSTemp.png',
    '/var/task/3rdUSGSTemp.png',
  ];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p);
      }
    } catch (_) { /* next */ }
  }

  // HTTP fallback
  const baseUrl = (process.env.NETLIFY_DEV || !process.env.URL)
    ? 'http://localhost:8888'
    : process.env.URL;
  for (const url of [`${baseUrl}/3rdUSGSTemp.png`, `${baseUrl}/netlify/functions/3rdUSGSTemp.png`]) {
    try {
      const res = await fetch(url);
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    } catch (_) { /* next */ }
  }

  throw new Error('Template 3rdUSGSTemp.png not found');
}

// ── Mapbox satellite ───────────────────────────────────────────────────────

async function fetchSatelliteImage(lat, lon, zoom, width, height) {
  const token = process.env.MAPBOX_TOKEN;
  if (!token) throw new Error('MAPBOX_TOKEN not set');

  const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lon},${lat},${zoom}/${width}x${height}@2x?access_token=${token}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'NoteworthyNews/1.0' } });
  if (!res.ok) throw new Error(`Mapbox ${res.status}: ${await res.text().catch(() => '')}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Overlay a volcano marker (pulsing rings + center dot) on the satellite image.
 */
async function overlayVolcanoMarker(imageBuffer, width, height) {
  const cx = width / 2;
  const cy = height / 2;

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- outer glow -->
      <circle cx="${cx}" cy="${cy}" r="40" fill="none" stroke="#FF4500" stroke-width="3" opacity="0.35"/>
      <circle cx="${cx}" cy="${cy}" r="28" fill="none" stroke="#FF4500" stroke-width="3" opacity="0.55"/>
      <!-- inner ring -->
      <circle cx="${cx}" cy="${cy}" r="16" fill="none" stroke="#FF6600" stroke-width="3" opacity="0.8"/>
      <!-- triangle marker (volcano symbol) -->
      <polygon points="${cx},${cy - 14} ${cx - 12},${cy + 8} ${cx + 12},${cy + 8}"
               fill="#FF4500" stroke="#FFFFFF" stroke-width="2" opacity="0.95"/>
      <!-- center dot -->
      <circle cx="${cx}" cy="${cy}" r="3" fill="#FFFFFF" opacity="0.9"/>
    </svg>`;

  const overlay = await sharp(Buffer.from(svg)).png().toBuffer();
  return sharp(imageBuffer)
    .composite([{ input: overlay, blend: 'over', left: 0, top: 0 }])
    .png()
    .toBuffer();
}

/**
 * Fit an image buffer into targetWidth × targetHeight (cover + center-crop).
 */
async function fitImage(imageBuffer, targetWidth, targetHeight) {
  return sharp(imageBuffer)
    .resize(targetWidth, targetHeight, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();
}

// ── Text SVG ───────────────────────────────────────────────────────────────

function buildTextSVG(alertLevel, volcanoName, w, h, scale) {
  const breakingText = 'Breaking News:';
  const alertText = `VOLCANO ${alertLevel.toUpperCase()}`;
  const locationText = volcanoName.toUpperCase();

  const fontFaceCSS = [];
  if (FONT_DATA.regular) fontFaceCSS.push(`@font-face{font-family:'Roboto';src:url('${FONT_DATA.regular}') format('truetype');font-weight:normal;font-style:normal;}`);
  if (FONT_DATA.bold) fontFaceCSS.push(`@font-face{font-family:'Roboto';src:url('${FONT_DATA.bold}') format('truetype');font-weight:bold;font-style:normal;}`);
  const fontFamily = (FONT_DATA.regular && FONT_DATA.bold) ? 'Roboto' : 'Arial, sans-serif';

  const headlineFS = Math.round(HEADLINE_FONT_SIZE_BASE * scale);
  let locationFS = Math.round(LOCATION_FONT_SIZE * scale);
  const locationFSMin = Math.round(LOCATION_FONT_SIZE_MIN * scale);

  const safeRight = Math.floor(w * SAFE_RIGHT_RATIO);
  const safeLeft = Math.round(SAFE_LEFT * scale);
  const maxW = safeRight - safeLeft;

  // Auto-shrink if text overflows
  const maxLine = Math.max(
    estimateTextWidth(breakingText, headlineFS),
    estimateTextWidth(alertText, headlineFS),
    estimateTextWidth(locationText, locationFS),
  );
  if (maxLine > maxW) {
    const ratio = maxW / maxLine;
    locationFS = Math.max(locationFSMin, Math.round(locationFS * ratio));
  }

  const x = Math.max(Math.round(SAFE_LEFT_MARGIN * scale), safeLeft);
  const baseY = Math.round(HEADLINE_BASELINE_Y * scale);
  const gap = Math.round(LOCATION_OFFSET * scale);

  return `
<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"
     shape-rendering="geometricPrecision" text-rendering="optimizeLegibility">
  <defs><style>${fontFaceCSS.join('\n')}</style></defs>
  <text x="${x}" y="${baseY}" font-family="${fontFamily}" font-size="${headlineFS}"
        font-weight="bold" fill="${HEADLINE_COLOR}">${escapeSVG(breakingText)}</text>
  <text x="${x}" y="${baseY + gap}" font-family="${fontFamily}" font-size="${headlineFS}"
        font-weight="bold" fill="${ALERT_COLOR}">${escapeSVG(alertText)}</text>
  <text x="${x}" y="${baseY + gap * 2}" font-family="${fontFamily}" font-size="${locationFS}"
        font-weight="bold" fill="${ALERT_COLOR}">${escapeSVG(locationText)}</text>
</svg>`;
}

// ── Image storage (reuse from earthquake module) ───────────────────────────

async function storeVolcanoImage(imageBuffer, eventId) {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN;
  const storeName = 'post-media';
  const imageKey = `volcano-${eventId}-${Date.now()}.png`;
  const baseUrl = process.env.URL || 'https://noteworthynews.co';

  if (!siteID || !token) {
    console.warn('[generate-volcano-image] Missing blob credentials, returning placeholder URL');
    return `${baseUrl}/.netlify/functions/get-uploaded-image?key=${encodeURIComponent(imageKey)}`;
  }

  let buf = Buffer.isBuffer(imageBuffer) ? imageBuffer : Buffer.from(imageBuffer);

  const { getStore } = require('@netlify/blobs');
  const store = getStore({ name: storeName, siteID, token });

  await store.set(imageKey, buf, { contentType: 'image/png' });
  console.log(`[generate-volcano-image] Stored ${imageKey} (${Math.round(buf.length / 1024)}KB)`);

  // Brief wait for propagation
  await new Promise(r => setTimeout(r, 2000));

  const imageUrl = `${baseUrl}/.netlify/functions/get-uploaded-image?key=${encodeURIComponent(imageKey)}`;
  return imageUrl;
}

// ── Main generator ─────────────────────────────────────────────────────────

/**
 * Generate a branded volcano alert image.
 * @param {string} volcanoName - e.g. "Kilauea"
 * @param {string} alertLevel - e.g. "WARNING", "WATCH", "ADVISORY"
 * @param {number|null} lat
 * @param {number|null} lon
 * @param {string} eventId - canonical event ID for storage key
 * @returns {Promise<string>} Absolute URL to the stored image
 */
async function generateVolcanoImage(volcanoName, alertLevel, lat, lon, eventId) {
  console.log(`[generate-volcano-image] Generating for ${alertLevel} - ${volcanoName} (${lat}, ${lon})`);

  // ─ Load template ─
  const templateBuffer = await loadTemplate();
  const templateMeta = await sharp(templateBuffer).metadata();
  const actualW = templateMeta.width;
  const actualH = templateMeta.height;

  const scaleW = OUTPUT_WIDTH / actualW;
  const scaleH = OUTPUT_HEIGHT / actualH;
  const scale = Math.min(scaleW, scaleH);
  const outW = Math.round(actualW * scale);
  const outH = Math.round(actualH * scale);

  // ─ Text overlay SVG → PNG ─
  const svgString = buildTextSVG(alertLevel, volcanoName, outW, outH, scale);

  const tempFontFiles = [];
  let textOverlay;
  try {
    const svgOpts = {
      font: { loadSystemFonts: true, fontFiles: [] },
      fitTo: { mode: 'original' },
    };
    if (FONT_BUFFERS.regular && FONT_BUFFERS.bold) {
      const dir = '/tmp';
      const rp = path.join(dir, `roboto-r-${Date.now()}.ttf`);
      const bp = path.join(dir, `roboto-b-${Date.now()}.ttf`);
      fs.writeFileSync(rp, FONT_BUFFERS.regular);
      fs.writeFileSync(bp, FONT_BUFFERS.bold);
      tempFontFiles.push(rp, bp);
      svgOpts.font.fontFiles = tempFontFiles;
    }
    const inst = new resvg.Resvg(svgString, svgOpts);
    textOverlay = inst.render().asPng();
  } finally {
    tempFontFiles.forEach(f => { try { fs.unlinkSync(f); } catch (_) {} });
  }

  if (!textOverlay || textOverlay.length === 0) {
    throw new Error('Text overlay render produced empty buffer');
  }

  // ─ Build 2 satellite images (regional + local) ─
  const IMAGE_AREA_Y = Math.round(410 * scale);
  const IMAGE_AREA_HEIGHT = Math.round(250 * scale);
  const IMAGE_PADDING = Math.round(20 * scale);
  const IMAGE_SPACING = Math.round(15 * scale);
  const imgAreaW = outW - IMAGE_PADDING * 2;
  const imgW = Math.floor((imgAreaW - IMAGE_SPACING) / 2);
  const imgH = IMAGE_AREA_HEIGHT;

  const compositeInputs = [
    { input: textOverlay, blend: 'over', left: 0, top: 0 },
  ];

  const hasCoords = lat != null && lon != null && Math.abs(lat) <= 85 && Math.abs(lon) <= 180;

  if (hasCoords) {
    const zooms = [6, 10]; // regional overview + closer view for volcanoes
    for (let i = 0; i < 2; i++) {
      try {
        let sat = await fetchSatelliteImage(lat, lon, zooms[i], imgW, imgH);
        sat = await overlayVolcanoMarker(sat, imgW, imgH);
        const fitted = await fitImage(sat, imgW, imgH);
        const x = IMAGE_PADDING + i * (imgW + IMAGE_SPACING);
        compositeInputs.push({ input: fitted, blend: 'over', left: x, top: IMAGE_AREA_Y });
        console.log(`[generate-volcano-image] Satellite ${i + 1} (zoom ${zooms[i]}) hash=${bufferHash(fitted)}`);
      } catch (err) {
        console.warn(`[generate-volcano-image] Satellite ${i + 1} failed: ${err.message}`);
      }
    }
  }

  // If no satellite images, generate simple location cards
  if (compositeInputs.length < 3) {
    for (let i = compositeInputs.length - 1; i < 2; i++) {
      const cardSvg = `
        <svg width="${imgW}" height="${imgH}" xmlns="http://www.w3.org/2000/svg">
          <rect width="${imgW}" height="${imgH}" fill="#1a1a2e"/>
          <text x="${imgW / 2}" y="${imgH / 2 - 20}" text-anchor="middle"
                font-family="Arial, sans-serif" font-size="28" fill="#FF4500" font-weight="bold">
            ${escapeSVG(volcanoName)}
          </text>
          <text x="${imgW / 2}" y="${imgH / 2 + 20}" text-anchor="middle"
                font-family="Arial, sans-serif" font-size="22" fill="#AAAAAA">
            ${hasCoords ? escapeSVG(`${lat.toFixed(2)}°, ${lon.toFixed(2)}°`) : 'Location unavailable'}
          </text>
        </svg>`;
      const cardBuf = await sharp(Buffer.from(cardSvg)).png().toBuffer();
      const x = IMAGE_PADDING + i * (imgW + IMAGE_SPACING);
      compositeInputs.push({ input: cardBuf, blend: 'over', left: x, top: IMAGE_AREA_Y });
    }
  }

  // ─ Composite ─
  const result = await sharp(templateBuffer)
    .resize(outW, outH, { fit: 'fill' })
    .composite(compositeInputs)
    .png({ quality: 90 })
    .toBuffer();

  console.log(`[generate-volcano-image] Composite done: ${outW}x${outH}, ${Math.round(result.length / 1024)}KB`);

  // ─ Store ─
  const imageUrl = await storeVolcanoImage(result, eventId);
  console.log(`[generate-volcano-image] Stored: ${imageUrl}`);
  return imageUrl;
}

module.exports = { generateVolcanoImage };
