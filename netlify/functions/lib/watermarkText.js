/**
 * Watermark text helpers — dependency-free.
 *
 * Kept separate from watermark.js (the PNG renderer) so that lightweight,
 * esbuild-bundled functions like watermark-create-job can sanitize/compose
 * credit text WITHOUT pulling in the native @resvg/resvg-js module (which only
 * loads correctly in the zisi-bundled background processor).
 */

const LINE1_TEXT = "Noteworthy News";

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

module.exports = { LINE1_TEXT, sanitizeUsername, composeCreditLine };
