/**
 * Scheduled FDA food-safety discovery (every 5 minutes).
 *
 * Fast pass only: polls the FDA RSS feeds, reconciles the official recall
 * index table and the CORE investigation table on their own cadences,
 * inserts unseen/changed source documents, then triggers the background
 * processor. Heavy parsing, media, and publication happen in
 * process-food-safety-background.js.
 *
 * Gated by ENABLE_FDA (default off). Records an engine_runs row with
 * engine name "fda" like the other engines.
 */

if (process.env.NETLIFY_DEV) {
  try {
    require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  } catch (e) { /* optional in dev */ }
}

const crypto = require('crypto');
const { createLogger } = require('./lib/logger');
const { config } = require('./lib/food-safety/config');

function isEnabled() {
  return config.enabled;
}

async function recordRunStart(supabase, logger) {
  try {
    const { data, error } = await supabase
      .from('engine_runs')
      .insert({ engine: 'fda', started_at: new Date().toISOString(), ok: false })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  } catch (e) {
    logger.warn(`Could not record engine run start: ${e.message}`);
    return null;
  }
}

async function recordRunFinish(supabase, runId, { ok, counts, error }, logger) {
  if (!runId) return;
  try {
    await supabase
      .from('engine_runs')
      .update({
        finished_at: new Date().toISOString(),
        ok,
        count_new: counts.new || 0,
        count_updated: counts.changed || 0,
        count_total_seen: counts.seen || 0,
        error: error ? String(error).slice(0, 1000) : null,
      })
      .eq('id', runId);
  } catch (e) {
    logger.warn(`Could not record engine run finish: ${e.message}`);
  }
}

/** Trigger the background processor over HTTP with the internal token. */
async function triggerBackgroundProcessor(logger) {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (!base) {
    logger.warn('No site URL available; background processor must be scheduled independently');
    return false;
  }
  const token = config.internalToken;
  if (!token) {
    logger.warn('FOOD_SAFETY_INTERNAL_TOKEN not set; skipping background trigger (processor runs on its own schedule)');
    return false;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    // Background functions return 202 immediately.
    const res = await fetch(`${base}/.netlify/functions/process-food-safety-background`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': token,
      },
      body: JSON.stringify({ reason: 'discovery' }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.status === 202 || res.ok;
  } catch (e) {
    logger.warn(`Background trigger failed: ${e.message}`);
    return false;
  }
}

exports.handler = async () => {
  const runId = crypto.randomUUID();
  const logger = createLogger('fda', runId);

  if (!isEnabled()) {
    return {
      statusCode: 200,
      body: JSON.stringify({ enabled: false, message: 'FDA food-safety ingestion disabled (ENABLE_FDA)' }),
    };
  }

  // Lazy requires so a disabled engine costs nothing and missing optional
  // config cannot break the function at load time.
  const supabase = require('./lib/supabaseClient');
  const { runDiscovery } = require('./lib/food-safety/discovery');

  const engineRunId = await recordRunStart(supabase, logger);
  const startedAt = Date.now();

  try {
    const results = await runDiscovery({ logger });

    const totals = {
      seen: (results.feeds.seen || 0) + (results.recallTable.rows || 0) + (results.coreTable.rows || 0),
      new: (results.feeds.new || 0) + (results.recallTable.new || 0) + (results.coreTable.new || 0),
      changed: (results.feeds.changed || 0) + (results.recallTable.changed || 0) + (results.coreTable.changed || 0),
    };

    let triggered = false;
    if (totals.new > 0 || totals.changed > 0) {
      triggered = await triggerBackgroundProcessor(logger);
    }

    await recordRunFinish(supabase, engineRunId, { ok: true, counts: totals }, logger);

    const summary = {
      enabled: true,
      duration_ms: Date.now() - startedAt,
      feeds: results.feeds,
      recall_table: results.recallTable,
      core_table: results.coreTable,
      totals,
      background_triggered: triggered,
    };
    logger.info('Discovery complete', summary);
    return { statusCode: 200, body: JSON.stringify(summary) };
  } catch (e) {
    logger.error('Discovery failed', e);
    await recordRunFinish(supabase, engineRunId, { ok: false, counts: {}, error: e.message }, logger);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

exports.config = {
  schedule: '*/5 * * * *',
};
