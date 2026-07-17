/**
 * Public read-only detail endpoint for one food-safety event.
 *
 * GET /.netlify/functions/food-safety-event?id=<event-uuid>
 * GET /.netlify/functions/food-safety-event?post=<post-id>
 *
 * Returns ONLY the strict public allowlist (validate.js): normalized event,
 * product rows, timeline, source links, image metadata, and map data.
 * Never returns internal evidence, raw source bodies, review reasons,
 * confidence values, or processing state.
 */

if (process.env.NETLIFY_DEV) {
  try {
    require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  } catch (e) { /* optional in dev */ }
}

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
  // Material updates rewrite the row; short TTL + SWR keeps articles fresh
  'Cache-Control': 'public, max-age=120, stale-while-revalidate=600',
  'Netlify-CDN-Cache-Control': 'public, max-age=120, stale-while-revalidate=600',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POST_ID_RE = /^[a-zA-Z0-9-]{4,120}$/;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: HEADERS, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'method not allowed' }) };
  }

  const id = (event.queryStringParameters?.id || '').trim();
  const postId = (event.queryStringParameters?.post || '').trim();
  if (!id && !postId) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'id or post parameter required' }) };
  }
  if (id && !UUID_RE.test(id)) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'invalid id' }) };
  }
  if (postId && !POST_ID_RE.test(postId)) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'invalid post id' }) };
  }

  try {
    const supabase = require('./lib/supabaseClient');
    const {
      toPublicEvent, toPublicProduct, toPublicVersion,
    } = require('./lib/food-safety/validate');
    const { getProducts, getVersions } = require('./lib/food-safety/store');
    const { stateNameFromAbbr } = require('./lib/food-safety/states');

    let query = supabase.from('food_safety_events').select('*').eq('publish_state', 'published');
    query = id ? query.eq('id', id) : query.eq('post_id', postId);
    const { data: eventRow, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);

    if (!eventRow) {
      return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: 'not found' }) };
    }

    const [products, versions] = await Promise.all([
      getProducts(eventRow.id),
      getVersions(eventRow.id),
    ]);

    const publicEvent = toPublicEvent(eventRow);

    // Map payload: only source-backed geography
    const map = {
      mode_case_data: Boolean(eventRow.case_states && eventRow.case_states.length),
      mode_distribution_data: Boolean(
        (eventRow.distribution_states && eventRow.distribution_states.length)
        || eventRow.geographic_scope === 'nationwide',
      ),
      nationwide_distribution: eventRow.geographic_scope === 'nationwide',
      case_states: (eventRow.case_states || []).map((abbr) => ({
        abbr, name: stateNameFromAbbr(abbr),
      })),
      distribution_states: (eventRow.distribution_states || []).map((abbr) => ({
        abbr, name: stateNameFromAbbr(abbr),
      })),
      // Per-state counts appear ONLY when officially supplied
      case_counts_by_state: eventRow.case_counts_by_state || null,
      distribution_text: eventRow.distribution_text || null,
      as_of: eventRow.source_updated_at || eventRow.fda_publish_date || null,
    };

    const body = {
      event: publicEvent,
      products: products.map(toPublicProduct),
      timeline: versions.map(toPublicVersion),
      map,
    };

    return { statusCode: 200, headers: HEADERS, body: JSON.stringify(body) };
  } catch (e) {
    console.error('[food-safety-event] error:', e.message);
    return {
      statusCode: 500,
      headers: { ...HEADERS, 'Cache-Control': 'no-store' },
      body: JSON.stringify({ error: 'internal error' }),
    };
  }
};
