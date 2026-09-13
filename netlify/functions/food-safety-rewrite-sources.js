/**
 * Sync operator tool: rewrite public source_urls on already-published FDA posts.
 * Protected by FOOD_SAFETY_INTERNAL_TOKEN (x-internal-token header).
 *
 * POST { ids: ["uuid", ...] }  or  { all_published: true }
 */

if (process.env.NETLIFY_DEV) {
  try {
    require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  } catch (_) { /* optional */ }
}

const crypto = require('crypto');
const { config } = require('./lib/food-safety/config');
const { buildPublicSourceUrls } = require('./lib/food-safety/publish');

const HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function authorized(event) {
  const token = config.internalToken;
  if (!token) return false;
  const provided = (event.headers && (event.headers['x-internal-token'] || event.headers['X-Internal-Token'])) || '';
  return timingSafeEqualStr(token, provided);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'method not allowed' }) };
  }
  if (!authorized(event)) {
    return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'unauthorized' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'invalid JSON' }) };
  }

  const supabase = require('./lib/supabaseClient');
  const { getEventById } = require('./lib/food-safety/store');
  const { getPostStore, readPost, writePost } = require('./lib/postStore');
  const { postIdForEvent } = require('./lib/food-safety/publish');

  let ids = Array.isArray(body.ids) ? body.ids.map(String).filter((id) => UUID_RE.test(id)) : [];
  if (body.all_published) {
    const { data, error } = await supabase
      .from('food_safety_events')
      .select('id')
      .eq('publish_state', 'published')
      .not('post_id', 'is', null)
      .limit(100);
    if (error) throw new Error(error.message);
    ids = (data || []).map((r) => r.id);
  }

  if (!ids.length) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'no ids' }) };
  }

  const store = getPostStore();
  const results = [];

  for (const id of ids) {
    try {
      const eventRow = await getEventById(id);
      if (!eventRow) {
        results.push({ id, status: 'not_found' });
        continue;
      }
      if (eventRow.publish_state === 'suppressed') {
        results.push({ id, status: 'suppressed' });
        continue;
      }

      const postId = eventRow.post_id || postIdForEvent(eventRow);
      const existing = await readPost(store, postId);
      if (!existing) {
        results.push({ id, status: 'post_missing', post_id: postId });
        continue;
      }

      const sourceUrls = buildPublicSourceUrls(eventRow);
      const cleanedLinks = (Array.isArray(eventRow.source_links) ? eventRow.source_links : [])
        .filter((l) => l && l.url && (l.role === 'canonical' || l.role === 'core_table'));

      await writePost(store, postId, {
        ...existing,
        source_url: eventRow.source_url || existing.source_url,
        source_urls: sourceUrls,
        link: eventRow.source_url || existing.link,
        url: eventRow.source_url || existing.url,
      });

      // Keep Supabase source_links tidy for future publishes.
      if (cleanedLinks.length && cleanedLinks.length !== (eventRow.source_links || []).length) {
        await supabase
          .from('food_safety_events')
          .update({ source_links: cleanedLinks })
          .eq('id', id);
      }

      results.push({
        id,
        status: 'rewritten',
        post_id: postId,
        source_count: sourceUrls.length,
        source_urls: sourceUrls,
      });
    } catch (e) {
      results.push({ id, status: 'error', error: e.message });
    }
  }

  return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true, results }) };
};
