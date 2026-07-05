/**
 * Post normalization - single source of truth for turning the loosely-typed
 * x-posts blob objects into a stable, public, mobile-friendly contract.
 *
 * The web feed (v2/js/feed.js) normalizes the same messy fields in the browser
 * (title|text|content|Content, datePosted|createdAt|created_at|Date,
 * imageUrl|image_url|image|..., etc). This module ports that logic server-side
 * so the native iOS app consumes ONE predictable shape and never reimplements
 * the field guessing.
 *
 * Normalized FeedItem:
 *   { id, kind, title, summary, imageUrl, mediaUrl, videoUrl, category,
 *     source, sourceUrl, url, webUrl, publishedAt, isBreaking, isAlert,
 *     isVideo, magnitude }
 */

const contentNormalize = require("../../../lib/contentNormalize");

const ENGINE_CATEGORIES = new Set([
  "Earthquake", "Weather Alert", "Volcano Alert",
  "Maritime Alert", "Airspace Alert", "Travel Advisory",
]);

// Delegate to the shared single-source-of-truth normalizer so the mobile API,
// the web article page, and the OG/crawler path all produce identical output.
const stripUrls = contentNormalize.stripUrls;

function getTitle(post) {
  return contentNormalize.cleanHeadline(post);
}

function getSummary(post) {
  // Prefer an explicit excerpt/summary; otherwise the body text minus the
  // headline, trimmed to a reasonable card length.
  const explicit = stripUrls(post.excerpt || post.summary || post.description || "");
  if (explicit) return explicit.slice(0, 400);

  const body = stripUrls(post.text || post.content || post.Content || "");
  if (!body) return "";
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  const rest = lines.slice(1).join(" ").trim();
  const chosen = rest || body;
  return chosen.slice(0, 400);
}

function getBodyText(post) {
  return stripUrls(post.text || post.content || post.Content || post.story || "");
}

function getVolcanoFallbackImage(post) {
  const cat = String(post.category || "").toLowerCase();
  const title = String(post.title || post.text || post.story || "").toLowerCase();
  if (!cat.includes("volcano") && !title.includes("volcano")) return null;
  if (title.includes("kilauea")) return "/assets/alerts/kilauea-volcano.jpg";
  if (title.includes("great sitkin")) return "/assets/alerts/great-sitkin-volcano.jpg";
  return null;
}

function getImage(post) {
  return (
    post.imageUrl || post.image_url || post.image || post.primary_image_url ||
    post.mediaUrl || post.media_url || getVolcanoFallbackImage(post) || null
  );
}

function getVideoUrl(post) {
  const raw = post.video_url || (Array.isArray(post.videos) && post.videos[0]) || null;
  if (!raw) return null;
  // Mirror the web rewrite so twimg media is proxied through the site.
  return String(raw).replace("https://video.twimg.com/", "/media/video/");
}

function isVideo(post) {
  return post.postType === "video" || !!post.video_url || (Array.isArray(post.videos) && post.videos.length > 0);
}

function getDate(post) {
  return post.datePosted || post.createdAt || post.created_at || post.Date || null;
}

function getCategory(post) {
  if (post.category) return post.category;
  const src = (post.source || "").toLowerCase();
  if (src.includes("usgs") || src.includes("earthquake")) return "Earthquake";
  if (src.includes("nws") || src.includes("weather")) return "Weather";
  if (src.includes("faa")) return "Aviation";
  return null;
}

function getSource(post) {
  return post.source || post.sourceName || post.author || null;
}

function getSourceUrl(post) {
  return post.x_url || post.link || post.source_url || post.sourceUrl || null;
}

function isBreakingText(post) {
  const t = (post.text || post.title || post.story || "").toUpperCase();
  return t.startsWith("BREAKING");
}

function isLowMagEarthquake(post) {
  const cat = (post.category || "").toLowerCase();
  const evtType = (post.event_type || "").toLowerCase();
  const isQuake = cat === "earthquake" || evtType === "earthquake";
  if (!isQuake) return false;
  const mag = post.magnitude ?? post.mag ?? (post.assets && post.assets.magnitude);
  const m = typeof mag === "string" ? parseFloat(mag) : Number(mag);
  return !Number.isFinite(m) || m < 4.5;
}

function isNonWeatherNWSAlert(post) {
  const title = (post.title || post.text || "").toLowerCase();
  const blocked = ["child abduction", "amber alert", "silver alert", "blue alert", "missing person", "civil emergency"];
  return blocked.some((t) => title.includes(t));
}

function isAlertPost(post) {
  if (isLowMagEarthquake(post)) return false;
  if (isNonWeatherNWSAlert(post)) return false;
  if (ENGINE_CATEGORIES.has(post.category)) return true;
  const src = (post.source || "").toLowerCase();
  return src.includes("usgs") || src.includes("nws") || src.includes("faa") || src.includes("uscg");
}

function getMagnitude(post) {
  const mag = post.magnitude ?? post.mag ?? (post.assets && post.assets.magnitude);
  const m = typeof mag === "string" ? parseFloat(mag) : Number(mag);
  return Number.isFinite(m) ? m : null;
}

function postId(post) {
  return post.id || post.postId || null;
}

/**
 * The public web article URL for a post (clean shareable link).
 */
function webUrl(post) {
  const id = postId(post);
  if (!id) return null;
  return `/article?id=${encodeURIComponent(id)}`;
}

/**
 * Normalize a single post blob into the public FeedItem contract.
 * @param {Object} post
 * @param {Object} [opts]
 * @param {boolean} [opts.includeBody] include the full body text (story detail)
 */
function normalizePost(post, opts = {}) {
  if (!post || typeof post !== "object") return null;
  const item = {
    id: postId(post),
    kind: "post",
    title: getTitle(post),
    summary: getSummary(post),
    imageUrl: getImage(post),
    videoUrl: getVideoUrl(post),
    category: getCategory(post),
    source: getSource(post),
    sourceUrl: getSourceUrl(post),
    webUrl: webUrl(post),
    publishedAt: getDate(post),
    isBreaking: isBreakingText(post),
    isAlert: isAlertPost(post),
    isVideo: isVideo(post),
    magnitude: getMagnitude(post),
  };
  if (opts.includeBody) {
    item.bodyText = getBodyText(post);
  }
  return item;
}

module.exports = {
  ENGINE_CATEGORIES,
  stripUrls,
  normalizePost,
  isAlertPost,
  isBreakingText,
  getCategory,
  getDate,
  postId,
};
