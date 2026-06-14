/**
 * Watermark renderer for the Video Watermarker tool.
 *
 * Renders the two-line Noteworthy News watermark to a transparent PNG using
 * @resvg/resvg-js + the bundled Roboto Bold font (fonts-base64.js), then the
 * caller composites it with ffmpeg `overlay`.
 *
 * Why a PNG overlay instead of ffmpeg drawtext:
 *   - drawtext depends on libfreetype/fontconfig + a font file being present in
 *     the deployed function bundle, which is brittle on Netlify/Lambda.
 *   - rendering text into the PNG means user-supplied credit text NEVER touches
 *     an ffmpeg argument, eliminating any drawtext/command-injection surface.
 *
 * Sizing rules (fraction of video width), per spec:
 *   - vertical  (h > w, ~9:16): 0.046
 *   - square    (~1:1):         0.034
 *   - horizontal(w > h, 16:9):  0.026
 * Padding: left 4% of width, bottom 5% of height. Tight line spacing.
 */

const { Resvg } = require("@resvg/resvg-js");

const LINE1_TEXT = "Noteworthy News";

let _boldFontBuffer = null;

/**
 * Load the bundled Roboto Bold font as a Buffer (cached).
 * fonts-base64.js exports { regular: 'data:...;base64,...', bold: '...' }.
 */
function getBoldFontBuffer() {
  if (_boldFontBuffer) return _boldFontBuffer;
  try {
    const fonts = require("../fonts-base64.js");
    const dataUri = fonts.bold || fonts.regular;
    if (!dataUri) return null;
    const base64 = dataUri.includes(",") ? dataUri.split(",")[1] : dataUri;
    _boldFontBuffer = Buffer.from(base64, "base64");
    return _boldFontBuffer;
  } catch (err) {
    console.warn("[watermark] Could not load bundled font:", err.message);
    return null;
  }
}

function xmlEscape(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Classify aspect ratio and return the font-size fraction of video width.
 */
function fontFractionForAspect(width, height) {
  if (!width || !height) return 0.03;
  const ratio = width / height;
  if (ratio < 0.9) return 0.046; // vertical (taller than wide)
  if (ratio > 1.15) return 0.026; // horizontal (wider than tall)
  return 0.034; // square-ish
}

/**
 * Estimate rendered text width. Roboto Bold averages ~0.58em per glyph; we use
 * a slightly generous factor so the PNG canvas never clips the stroke.
 */
function estimateTextWidth(text, fontSize) {
  return Math.ceil(text.length * fontSize * 0.62);
}

/**
 * Build the transparent watermark PNG for the given video dimensions. The font
 * size scales with the video width per the aspect-ratio spec. Placement padding
 * (4% width / 5% height) is applied by ffmpeg via overlay expressions in
 * watermarkVideo(), so this function only produces the tightly-cropped PNG.
 *
 * @param {object} opts
 * @param {number} opts.width  video width in px
 * @param {number} opts.height video height in px
 * @param {string} opts.line2  second line text (already composed, e.g. "VIDEO: @user/FB")
 * @returns {{ pngBuffer: Buffer, width: number, height: number, fontSize: number }}
 */
function renderWatermark({ width, height, line2 }) {
  const w = Math.max(1, Math.round(width || 1280));
  const h = Math.max(1, Math.round(height || 720));

  const fontSize = Math.max(14, Math.round(w * fontFractionForAspect(w, h)));
  const lineGap = Math.round(fontSize * 0.18); // tight but readable
  const lineHeight = fontSize + lineGap;
  const strokeWidth = Math.max(1, Math.round(fontSize / 9));
  const shadowBlur = Math.max(1, Math.round(fontSize / 8));

  const line1 = LINE1_TEXT;
  const safeLine1 = xmlEscape(line1);
  const safeLine2 = xmlEscape(line2);

  // Canvas large enough for both lines plus stroke + shadow bleed.
  const pad = strokeWidth * 2 + shadowBlur * 2;
  const textBlockWidth =
    Math.max(estimateTextWidth(line1, fontSize), estimateTextWidth(line2, fontSize)) + pad * 2;
  const textBlockHeight = lineHeight * 2 + pad * 2;

  const baseline1 = pad + fontSize;
  const baseline2 = baseline1 + lineHeight;
  const textX = pad;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${textBlockWidth}" height="${textBlockHeight}" viewBox="0 0 ${textBlockWidth} ${textBlockHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="wmShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="${Math.round(strokeWidth / 2)}" stdDeviation="${shadowBlur}" flood-color="#000000" flood-opacity="0.85"/>
    </filter>
  </defs>
  <g filter="url(#wmShadow)" font-family="Roboto, Arial, Helvetica, sans-serif" font-weight="700" font-size="${fontSize}" stroke="#000000" stroke-width="${strokeWidth}" stroke-linejoin="round" paint-order="stroke fill" fill="#FFFFFF">
    <text x="${textX}" y="${baseline1}">${safeLine1}</text>
    <text x="${textX}" y="${baseline2}">${safeLine2}</text>
  </g>
</svg>`;

  const resvgOptions = {
    fitTo: { mode: "original" },
    font: { loadSystemFonts: true },
  };
  const fontBuffer = getBoldFontBuffer();
  if (fontBuffer) {
    resvgOptions.font.fontBuffers = [fontBuffer];
    resvgOptions.font.defaultFontFamily = "Roboto";
  }

  const resvg = new Resvg(svg, resvgOptions);
  const rendered = resvg.render();

  return {
    pngBuffer: rendered.asPng(),
    width: rendered.width,
    height: rendered.height,
    fontSize,
  };
}

/**
 * Sanitize a username/page slug to the watermark's allowed charset.
 * Returns "" when nothing usable remains.
 */
function sanitizeUsername(raw) {
  if (!raw) return "";
  let s = String(raw).trim();
  // Drop a leading @ and any URL-ish wrapping the caller may have left.
  s = s.replace(/^@+/, "");
  s = s.replace(/[^a-zA-Z0-9._-]/g, "");
  return s.slice(0, 64);
}

/**
 * Compose the exact second line of the watermark.
 *   - known username -> "VIDEO: @username/FB"
 *   - unknown        -> "VIDEO: Facebook/FB"
 */
function composeCreditLine(username) {
  const clean = sanitizeUsername(username);
  if (!clean || clean.toLowerCase() === "facebook") {
    return "VIDEO: Facebook/FB";
  }
  return `VIDEO: @${clean}/FB`;
}

module.exports = {
  renderWatermark,
  sanitizeUsername,
  composeCreditLine,
  fontFractionForAspect,
  LINE1_TEXT,
};
