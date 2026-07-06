#!/usr/bin/env node
/**
 * Generate the Noteworthy "live signal" hero GIF for the welcome email.
 *
 * Concept: a dark newsroom panel — live dot pulsing, UTC clock ticking,
 * timestamped update cards, and the story status moving from DEVELOPING
 * to CONFIRMED. Serious, not sci-fi. Brand tokens from emails/noteworthy/theme.
 *
 * Email rules honored:
 *   - frame 1 is complete and readable (status DEVELOPING, all cards on)
 *   - decorative only: everything shown is repeated as HTML in the email
 *   - output target: 1080x540, < 800 KB
 *
 * Output: email-assets/noteworthy-live-signal.gif
 *   (publish dir is repo root, so this ships to
 *    https://noteworthynews.co/email-assets/noteworthy-live-signal.gif)
 *
 * Run: node scripts/generate-noteworthy-email-gif.js
 * Uses existing deps only (sharp + gifenc), same as generate-newsletter-gifs.js.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { GIFEncoder, quantize, applyPalette } = require('gifenc');

const W = 1080;
const H = 540;
const FRAMES = 12;
const DELAY_MS = 170;

const C = {
  bg: '#0A101C',
  panel: '#0D1526',
  raised: '#111A2E',
  border: '#1E2839',
  text: '#F0F2F5',
  secondary: '#98A2B3',
  muted: '#5F6B7E',
  accent: '#3B8BF2',
  live: '#EF4444',
  amber: '#F59E0B',
  green: '#34D399',
};

const MONO = 'Courier, monospace';
const UI = 'Helvetica, Arial, sans-serif';

/** One SVG frame. t = frame index. */
function frameSVG(t) {
  const phase = (t / FRAMES) * Math.PI * 2;
  // Live dot: slow breath, never fully off (frame 1 must read "live")
  const dotOpacity = (0.55 + 0.45 * Math.sin(phase)).toFixed(2);
  const ringR = 14 + 5 * ((t % 6) / 6);
  const ringOpacity = (0.5 * (1 - (t % 6) / 6)).toFixed(2);
  // Clock ticks one second every ~2 frames
  const sec = String(4 + Math.floor(t / 2)).padStart(2, '0');
  // Status flips at 2/3 through the loop, holds CONFIRMED to the end
  const confirmed = t >= 8;
  const stColor = confirmed ? C.green : C.amber;
  const stText = confirmed ? 'CONFIRMED' : 'DEVELOPING';
  const stWidth = confirmed ? 128 : 132;
  // Newest card's accent edge breathes subtly
  const edgeOpacity = (0.6 + 0.4 * Math.sin(phase + 1)).toFixed(2);

  const card = (y, time, line, newest = false) => `
    <rect x="48" y="${y}" width="${W - 96}" height="74" rx="6" fill="${C.panel}" stroke="${C.border}" stroke-width="2"/>
    ${newest ? `<rect x="48" y="${y}" width="4" height="74" rx="2" fill="${C.accent}" opacity="${edgeOpacity}"/>` : ''}
    <text x="76" y="${y + 30}" font-family="${MONO}" font-size="17" fill="${C.secondary}" letter-spacing="1">${time}</text>
    <text x="76" y="${y + 56}" font-family="${UI}" font-size="20" fill="${newest ? C.text : C.secondary}">${line}</text>`;

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="8" fill="none" stroke="${C.border}" stroke-width="2"/>

  <!-- header -->
  <text x="48" y="52" font-family="${UI}" font-size="17" font-weight="bold" fill="${C.text}" letter-spacing="3">NOTEWORTHY NEWSROOM</text>
  <text x="${W - 48}" y="52" text-anchor="end" font-family="${MONO}" font-size="17" fill="${C.secondary}" letter-spacing="2">21:47:${sec} UTC</text>
  <line x1="48" y1="72" x2="${W - 48}" y2="72" stroke="${C.border}" stroke-width="2"/>

  <!-- live row -->
  <circle cx="60" cy="112" r="${ringR}" fill="none" stroke="${C.live}" stroke-width="2" opacity="${ringOpacity}"/>
  <circle cx="60" cy="112" r="7" fill="${C.live}" opacity="${dotOpacity}"/>
  <text x="84" y="119" font-family="${UI}" font-size="19" font-weight="bold" fill="${C.live}" letter-spacing="2.5">LIVE</text>
  <text x="152" y="119" font-family="${UI}" font-size="19" fill="${C.text}">M7.1 EARTHQUAKE &#183; OFF SANRIKU COAST</text>

  <!-- status chip -->
  <rect x="${W - 48 - stWidth}" y="94" width="${stWidth}" height="34" rx="4" fill="none" stroke="${stColor}" stroke-width="2"/>
  <text x="${W - 48 - stWidth / 2}" y="117" text-anchor="middle" font-family="${UI}" font-size="14" font-weight="bold" fill="${stColor}" letter-spacing="2">${stText}</text>

  <!-- update cards (newest first) -->
  ${card(160, '21:39 UTC — JMA', 'Tsunami advisory issued for Miyagi and Iwate coasts', true)}
  ${card(248, '21:33 UTC — USGS', 'Magnitude revised to 7.1 after review')}
  ${card(336, '21:28 UTC — FIELD', 'Strong shaking reported in Sendai; grid holding')}

  <!-- footer -->
  <line x1="48" y1="448" x2="${W - 48}" y2="448" stroke="${C.border}" stroke-width="2"/>
  <text x="48" y="488" font-family="${MONO}" font-size="15" fill="${C.muted}" letter-spacing="2">SOURCES: USGS &#183; JMA</text>
  <text x="${W - 48}" y="488" text-anchor="end" font-family="${MONO}" font-size="15" fill="${C.muted}" letter-spacing="2">TIMESTAMPS ON EVERY UPDATE</text>
</svg>`;
}

async function main() {
  console.log('Rendering frames...');
  const rgbaFrames = [];
  for (let t = 0; t < FRAMES; t++) {
    const { data, info } = await sharp(Buffer.from(frameSVG(t)))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    rgbaFrames.push({ data: new Uint8ClampedArray(data), width: info.width, height: info.height });
    process.stdout.write(`  frame ${t + 1}/${FRAMES}\r`);
  }
  console.log('\nEncoding GIF...');

  // Shared palette from sampled pixels across first/middle/last frames
  const samples = [];
  for (const f of [rgbaFrames[0], rgbaFrames[Math.floor(FRAMES / 2)], rgbaFrames[FRAMES - 1]]) {
    for (let i = 0; i < f.data.length; i += 32) {
      samples.push(f.data[i], f.data[i + 1], f.data[i + 2], f.data[i + 3]);
    }
  }
  const palette = quantize(new Uint8ClampedArray(samples), 128);

  const gif = GIFEncoder();
  for (const f of rgbaFrames) {
    const index = applyPalette(f.data, palette);
    gif.writeFrame(index, f.width, f.height, { palette, delay: DELAY_MS, repeat: 0 });
  }
  gif.finish();

  const outDir = path.join(__dirname, '..', 'email-assets');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'noteworthy-live-signal.gif');
  fs.writeFileSync(outPath, Buffer.from(gif.bytes()));

  const kb = Math.round(fs.statSync(outPath).size / 1024);
  console.log(`Wrote ${outPath} (${kb} KB)`);
  if (kb > 800) {
    console.warn('WARNING: over the 800 KB email budget — reduce FRAMES or palette size.');
  }

  // Static first-frame fallback (PNG) for clients that block GIFs entirely
  const pngPath = path.join(outDir, 'noteworthy-live-signal-static.png');
  await sharp(Buffer.from(frameSVG(0))).png({ compressionLevel: 9 }).toFile(pngPath);
  console.log(`Wrote ${pngPath} (${Math.round(fs.statSync(pngPath).size / 1024)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
