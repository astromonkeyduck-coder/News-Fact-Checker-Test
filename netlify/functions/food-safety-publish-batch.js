/**
 * Internal batch publish for food_safety_events already in review.
 * Protected by FOOD_SAFETY_INTERNAL_TOKEN — not public admin Auth0.
 *
 * POST { ids: ["uuid", ...] }
 * POST { publish_ready: true }  → all review + review_reason=auto_publish_disabled
 */

if (process.env.NETLIFY_DEV) {
  try {
    require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  } catch (_) { /* optional */ }
}

const crypto = require('crypto');
const { config } = require('./lib/food-safety/config');

const HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function authorized(event) {
  const token = config.internalToken;
  if (!token) return false;
  const provided = (event.headers && (event.headers['x-internal-token'] || event.headers['X-Internal-Token'])) || '';
  if (!provided || provided.length !== token.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(token));
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
  const { getEventById, getProducts, updateEvent } = require('./lib/food-safety/store');
  const { publishPost, upsertVerifiedEvent } = require('./lib/food-safety/publish');

  let ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
  if (body.publish_ready) {
    const { data, error } = await supabase
      .from('food_safety_events')
      .select('id')
      .eq('publish_state', 'review')
      .eq('review_reason', 'auto_publish_disabled');
    if (error) throw new Error(error.message);
    ids = (data || []).map((r) => r.id);
  }

  ids = ids.filter((id) => UUID_RE.test(id));
  if (!ids.length) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'no ids' }) };
  }

  const results = [];
  for (const id of ids) {
    try {
      const eventRow = await getEventById(id);
      if (!eventRow) {
        results.push({ id, status: 'not_found' });
        continue;
      }
      if (eventRow.publish_state === 'suppressed') {
        results.push({ id, status: 'suppressed', reason: eventRow.review_reason });
        continue;
      }
      if (eventRow.publish_state === 'published' && eventRow.post_id) {
        results.push({ id, status: 'already_published', post_id: eventRow.post_id });
        continue;
      }
      const products = await getProducts(id);
      const hasMapData = Boolean(
        (eventRow.case_states && eventRow.case_states.length)
        || (eventRow.distribution_states && eventRow.distribution_states.length)
        || eventRow.geographic_scope === 'nationwide',
      );
      const { postId } = await publishPost(eventRow, { products, hasMapData });
      await updateEvent(id, { publish_state: 'published', review_reason: null, post_id: postId });
      await upsertVerifiedEvent({ ...eventRow, post_id: postId });
      results.push({ id, status: 'published', post_id: postId, title: eventRow.display_title });
    } catch (e) {
      results.push({ id, status: 'error', error: e.message });
    }
  }

  return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true, results }) };
};
