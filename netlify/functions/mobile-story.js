/**
 * Mobile Story - normalized single-item detail for the native iOS app.
 *
 * GET /.netlify/functions/mobile-story   (alias: /api/mobile/story)
 *   ?id=<postId>     → { story: FeedItem (incl. bodyText) }
 *
 * For LIVE stories the app uses the existing live-stories.js?slug= endpoint,
 * which already returns the story + timeline. This endpoint covers regular
 * editorial/ingested posts so Story Detail can render natively without
 * scraping the website.
 *
 * Read-only. Reuses lib/postStore + lib/postNormalize.
 */

if (process.env.NETLIFY_DEV) {
  try {
    require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
  } catch (e) {}
}

const { getPostStore, readPost } = require("./lib/postStore");
const { normalizePost } = require("./lib/postNormalize");

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
  "Netlify-CDN-Cache-Control": "public, max-age=60, stale-while-revalidate=300",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: HEADERS, body: "" };
  }
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const id = (event.queryStringParameters?.id || "").trim();
    if (!id) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "Missing id" }) };
    }

    const store = getPostStore();
    const blobId = id.replace(/^post-/, "");
    let post = await readPost(store, blobId);

    // Legacy fallback for older earthquake posts keyed eq-<usgs id>.
    if (!post && blobId.startsWith("usgs-")) {
      post = await readPost(store, `eq-${blobId.substring(5)}`);
    }

    if (!post) {
      return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: "Story not found" }) };
    }

    const story = normalizePost(post, { includeBody: true });
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ story }) };
  } catch (error) {
    console.error("[mobile-story] Error:", error.message);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: "Internal server error" }) };
  }
};
