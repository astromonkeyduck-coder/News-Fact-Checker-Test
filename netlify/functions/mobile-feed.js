/**
 * Mobile Feed - normalized, read-only content API for the native iOS app.
 *
 * GET /.netlify/functions/mobile-feed   (alias: /api/mobile/feed)
 *   ?limit=        page size (default 30, max 100)
 *   ?cursor=       opaque offset cursor for pagination
 *   ?section=      all | breaking | alerts   (default all)
 *   ?category=     case-insensitive category filter
 *
 * Returns a STABLE contract so Swift never reimplements the messy blob shape:
 *   { items: FeedItem[], nextCursor: string|null, total: number }
 *
 * Read-only. Reuses lib/postStore (Netlify Blobs) + lib/postNormalize. No
 * secrets exposed; the service-role key is never touched here.
 */

if (process.env.NETLIFY_DEV) {
  try {
    require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
  } catch (e) {}
}

const { getPostStore, readIndex, readPost } = require("./lib/postStore");
const { normalizePost, getDate } = require("./lib/postNormalize");

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
  "Netlify-CDN-Cache-Control": "public, max-age=60, stale-while-revalidate=300",
};

// Read a bounded slice of the index so a single device request never fans out
// to hundreds of blob reads.
const MAX_SCAN = 200;

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: HEADERS, body: "" };
  }
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const params = event.queryStringParameters || {};
    const limit = Math.min(Math.max(parseInt(params.limit || "30", 10) || 30, 1), 100);
    const cursor = Math.max(parseInt(params.cursor || "0", 10) || 0, 0);
    const section = ["all", "breaking", "alerts"].includes(params.section) ? params.section : "all";
    const category = (params.category || "").trim().toLowerCase();

    const store = getPostStore();
    const ids = await readIndex(store);
    if (!ids.length) {
      return ok({ items: [], nextCursor: null, total: 0 });
    }

    const scanIds = ids.slice(0, MAX_SCAN);
    const posts = await Promise.all(scanIds.map((id) => readPost(store, id)));

    let items = posts
      .filter(Boolean)
      .map((p) => normalizePost(p))
      .filter(Boolean);

    // Newest first (defensive - the index is already roughly ordered).
    items.sort((a, b) => new Date(getDate(b) || 0) - new Date(getDate(a) || 0));

    if (section === "breaking") items = items.filter((i) => i.isBreaking && !i.isAlert);
    else if (section === "alerts") items = items.filter((i) => i.isAlert);

    if (category) items = items.filter((i) => (i.category || "").toLowerCase() === category);

    const total = items.length;
    const page = items.slice(cursor, cursor + limit);
    const nextCursor = cursor + limit < total ? String(cursor + limit) : null;

    return ok({ items: page, nextCursor, total });
  } catch (error) {
    console.error("[mobile-feed] Error:", error.message);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: "Internal server error" }) };
  }
};

function ok(payload) {
  return { statusCode: 200, headers: HEADERS, body: JSON.stringify(payload) };
}
