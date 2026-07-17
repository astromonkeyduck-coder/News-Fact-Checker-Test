/**
 * openFDA food enforcement API (Tier 2 enrichment/reconciliation ONLY).
 *
 * https://api.fda.gov/food/enforcement.json
 *
 * Used strictly for backfill, recall-number/event-id correlation,
 * classification, initiation/report dates, distribution-pattern enrichment,
 * and recall-status reconciliation. Never a low-latency publication trigger.
 *
 * Supports OPENFDA_API_KEY; anonymous access works within public rate limits.
 */

const { safeFetchWithRetry } = require('../../httpClient');
const { OPENFDA_ENFORCEMENT_URL, config } = require('../../config');

/**
 * Query the enforcement endpoint.
 * @param {object} opts
 *   - search: openFDA search expression (already escaped by caller)
 *   - limit: max records (openFDA cap 1000)
 *   - skip: pagination offset
 */
async function queryEnforcement({ search, limit = 20, skip = 0 } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  params.set('limit', String(Math.min(limit, 100)));
  if (skip) params.set('skip', String(skip));
  if (config.openFdaApiKey) params.set('api_key', config.openFdaApiKey);

  const url = `${OPENFDA_ENFORCEMENT_URL}?${params.toString()}`;
  try {
    const res = await safeFetchWithRetry(url, {
      accept: 'application/json',
      allowedContentTypes: ['json'],
    });
    const parsed = JSON.parse(res.body.toString('utf8'));
    return {
      meta: parsed.meta || null,
      results: Array.isArray(parsed.results) ? parsed.results.map(normalizeEnforcementRecord) : [],
    };
  } catch (e) {
    if (e.status === 404) return { meta: null, results: [] }; // no matches
    throw e;
  }
}

/** Find enforcement records by recalling firm within a date range. */
async function findByFirm(firmName, { sinceDate = null, limit = 20 } = {}) {
  const parts = [`recalling_firm:"${sanitizeQueryValue(firmName)}"`];
  if (sinceDate) {
    const from = sinceDate.replace(/-/g, '');
    parts.push(`report_date:[${from} TO 99991231]`);
  }
  return queryEnforcement({ search: parts.join(' AND '), limit });
}

/** Find enforcement records by recall number. */
async function findByRecallNumber(recallNumber) {
  return queryEnforcement({ search: `recall_number:"${sanitizeQueryValue(recallNumber)}"`, limit: 5 });
}

function sanitizeQueryValue(v) {
  return String(v || '').replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeEnforcementRecord(r) {
  return {
    recallNumber: r.recall_number || null,
    eventId: r.event_id || null,
    status: r.status || null,
    classification: r.classification || null, // "Class I" | "Class II" | "Class III"
    voluntaryMandated: r.voluntary_mandated || null,
    recallingFirm: r.recalling_firm || null,
    productDescription: r.product_description || null,
    reasonForRecall: r.reason_for_recall || null,
    distributionPattern: r.distribution_pattern || null,
    codeInfo: r.code_info || null,
    recallInitiationDate: fmtDate(r.recall_initiation_date),
    reportDate: fmtDate(r.report_date),
    terminationDate: fmtDate(r.termination_date),
    city: r.city || null,
    state: r.state || null,
  };
}

function fmtDate(s) {
  if (!s || !/^\d{8}$/.test(String(s))) return null;
  const str = String(s);
  return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
}

module.exports = {
  queryEnforcement,
  findByFirm,
  findByRecallNumber,
  normalizeEnforcementRecord,
};
