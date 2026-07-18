/**
 * Background processor for FDA food-safety source documents.
 *
 * Netlify background function (name suffix -background + config.background):
 * returns 202 immediately and may run up to 15 minutes.
 *
 * Invocation paths:
 *  - triggered by ingest-food-safety after discovery (with internal token)
 *  - triggered by fda-email-trigger after a verified email signal
 *  - scheduled safety-net sweep every 15 minutes for retries/backoff
 *
 * Manual HTTP calls MUST present FOOD_SAFETY_INTERNAL_TOKEN via the
 * x-internal-token header (constant-time comparison, fail-closed).
 */

if (process.env.NETLIFY_DEV) {
  try {
    require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  } catch (e) { /* optional in dev */ }
}

const crypto = require('crypto');
const { createLogger } = require('./lib/logger');
const { config } = require('./lib/food-safety/config');

function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function isAuthorized(event) {
  // Netlify scheduled invocations have a next_run body and no external caller.
  if (event.headers && event.headers['x-nf-event'] === 'schedule') return true;
  try {
    const body = JSON.parse(event.body || '{}');
    if (body && body.next_run) return true;
  } catch (_) { /* not a scheduled payload */ }

  const token = config.internalToken;
  if (!token) return false; // fail-closed: manual calls need the token configured
  const provided = (event.headers && (event.headers['x-internal-token'] || event.headers['X-Internal-Token'])) || '';
  return timingSafeEqualStr(token, provided);
}

exports.handler = async (event) => {
  const runId = crypto.randomUUID();
  const logger = createLogger('fda-processor', runId);

  if (!config.enabled) {
    logger.info('FDA food-safety processing disabled (ENABLE_FDA)');
    return { statusCode: 200, body: JSON.stringify({ enabled: false }) };
  }

  if (!isAuthorized(event)) {
    logger.warn('Unauthorized processor invocation rejected');
    return { statusCode: 401, body: JSON.stringify({ error: 'unauthorized' }) };
  }

  let requestBody = {};
  try {
    requestBody = JSON.parse(event.body || '{}');
  } catch (_) { /* empty body is fine for normal runs */ }

  if (Array.isArray(requestBody.publish_ids) && requestBody.publish_ids.length) {
    const { publishEventIds } = require('./lib/food-safety/publishBatch');
    const results = await publishEventIds(requestBody.publish_ids, {
      force: requestBody.force === true,
    });
    logger.info('Internal publish_ids complete', { results });
    return { statusCode: 200, body: JSON.stringify({ ok: true, publish: results }) };
  }

  if (requestBody.publish_ready) {
    const { publishReadyEvents } = require('./lib/food-safety/publishBatch');
    const results = await publishReadyEvents();
    logger.info('Internal publish_ready complete', { results });
    return { statusCode: 200, body: JSON.stringify({ ok: true, publish: results }) };
  }

  if (
    requestBody.rewrite_sources === true
    || requestBody.rewrite_posts === true
    || (Array.isArray(requestBody.rewrite_ids) && requestBody.rewrite_ids.length)
  ) {
    const supabase = require('./lib/supabaseClient');
    const { getEventById, getProducts, updateEvent } = require('./lib/food-safety/store');
    const { publishPost, upsertVerifiedEvent, postIdForEvent } = require('./lib/food-safety/publish');
    const { buildPublicGeographyFields } = require('./lib/food-safety/geographyContext');

    let ids = Array.isArray(requestBody.rewrite_ids) ? requestBody.rewrite_ids.map(String) : [];
    if ((requestBody.rewrite_sources === true || requestBody.rewrite_posts === true) && !ids.length) {
      const { data, error } = await supabase
        .from('food_safety_events')
        .select('id')
        .eq('publish_state', 'published')
        .not('post_id', 'is', null)
        .limit(100);
      if (error) throw new Error(error.message);
      ids = (data || []).map((r) => r.id);
    }

    const results = [];
    for (const id of ids) {
      try {
        const eventRow = await getEventById(id);
        if (!eventRow || eventRow.publish_state === 'suppressed') {
          results.push({ id, status: eventRow ? 'suppressed' : 'not_found' });
          continue;
        }
        const products = await getProducts(id);
        const geo = buildPublicGeographyFields(eventRow);
        const eventForPublish = { ...eventRow, ...geo };
        const hasMapData = Boolean(
          (eventForPublish.outbreak_case_states && eventForPublish.outbreak_case_states.length)
          || (eventForPublish.confirmed_distribution_states && eventForPublish.confirmed_distribution_states.length)
          || eventRow.geographic_scope === 'nationwide',
        );
        const { postId } = await publishPost(eventForPublish, { products, hasMapData });
        await updateEvent(id, { post_id: postId, publish_state: 'published', review_reason: null });
        await upsertVerifiedEvent({ ...eventForPublish, post_id: postId });
        results.push({ id, status: 'rewritten', post_id: postId || postIdForEvent(eventRow) });
      } catch (e) {
        results.push({ id, status: 'error', error: e.message });
      }
    }
    logger.info('Internal rewrite_posts complete', { results });
    return { statusCode: 200, body: JSON.stringify({ ok: true, rewrite: results }) };
  }

  const { claimPendingDocuments } = require('./lib/food-safety/store');
  const { processSourceDocument } = require('./lib/food-safety/pipeline');

  const stats = {
    claimed: 0,
    processed: 0,
    published: 0,
    review: 0,
    skipped: 0,
    failed: 0,
    outcomes: [],
  };

  try {
    const docs = await claimPendingDocuments({
      limit: config.maxDocsPerRun,
      workerId: `bg-${runId.slice(0, 8)}`,
    });
    stats.claimed = docs.length;
    logger.info(`Claimed ${docs.length} pending source documents`);

    for (const doc of docs) {
      const outcome = await processSourceDocument(doc, { logger });
      stats.outcomes.push({
        doc: outcome.docId,
        kind: outcome.sourceKind,
        status: outcome.status,
        publishState: outcome.publishState,
      });
      if (outcome.status === 'processed') {
        stats.processed += 1;
        if (outcome.publishState === 'published') stats.published += 1;
        if (outcome.publishState === 'review') stats.review += 1;
      } else if (outcome.status && outcome.status.startsWith('skipped')) {
        stats.skipped += 1;
      } else if (outcome.status && outcome.status.startsWith('failed')) {
        stats.failed += 1;
      }
    }

    logger.summary && logger.summary('Processing complete', stats);
    logger.info('Processing complete', stats);
    return { statusCode: 200, body: JSON.stringify(stats) };
  } catch (e) {
    logger.error('Processor crashed', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message, stats }) };
  }
};

exports.config = {
  // Safety-net sweep for retry/backoff scheduling; discovery also triggers
  // this function directly after inserting new candidates.
  schedule: '*/15 * * * *',
  background: true,
};
