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
const { publishEventIds, publishReadyEvents } = require('./lib/food-safety/publishBatch');

const HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function authorized(event, body = {}) {
  const token = config.internalToken;
  if (!token) return false;
  const headerToken = (event.headers && (event.headers['x-internal-token'] || event.headers['X-Internal-Token'])) || '';
  const bodyToken = typeof body.token === 'string' ? body.token : '';
  const provided = headerToken || bodyToken;
  return timingSafeEqualStr(token, provided);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'invalid JSON' }) };
  }

  if (!authorized(event, body)) {
    return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'unauthorized' }) };
  }

  try {
    const results = body.publish_ready
      ? await publishReadyEvents()
      : await publishEventIds(Array.isArray(body.ids) ? body.ids : []);

    if (!results.length) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'no ids' }) };
    }

    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true, results }) };
  } catch (e) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: e.message }) };
  }
};
