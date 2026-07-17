/**
 * Runtime validation: publish gate + public payload allowlists.
 *
 * A candidate may auto-publish only when EVERY applicable requirement passes.
 * Any failure routes the event to the review queue with an explicit reason.
 */

const { config } = require('./config');
const { isAllowedUrl } = require('./httpClient');
const { isValidStateAbbr } = require('./states');
const { MAJOR_ALLERGENS } = require('./classify');

const EVENT_KINDS = new Set(['recall', 'outbreak', 'safety_alert', 'allergen_alert']);
const HAZARD_CATEGORIES = new Set(['pathogen', 'allergen', 'chemical', 'foreign_material', 'toxin', 'labeling', 'other']);
const STATUSES = new Set(['new', 'active', 'ongoing', 'updated', 'expanded', 'ended', 'terminated', 'unknown']);

/**
 * Validate a normalized event candidate.
 * Returns { valid, errors: [], reviewReasons: [] }.
 * `errors` block persistence; `reviewReasons` force the review queue.
 */
function validateEventCandidate(event, { products = [], parseWarnings = [] } = {}) {
  const errors = [];
  const reviewReasons = [];

  // --- hard schema errors -------------------------------------------------
  if (!event.canonical_key) errors.push('missing_canonical_key');
  if (!EVENT_KINDS.has(event.event_kind)) errors.push(`invalid_event_kind:${event.event_kind}`);
  if (event.source_url && !isAllowedUrl(event.source_url)) errors.push('source_url_not_allowlisted');
  if (event.status && !STATUSES.has(event.status)) errors.push(`invalid_status:${event.status}`);
  if (event.hazard_category && !HAZARD_CATEGORIES.has(event.hazard_category)) {
    errors.push(`invalid_hazard_category:${event.hazard_category}`);
  }
  for (const metric of ['illnesses', 'hospitalizations', 'deaths', 'hus_cases']) {
    const v = event[metric];
    if (v !== null && v !== undefined && (!Number.isInteger(v) || v < 0)) {
      errors.push(`invalid_metric:${metric}`);
    }
  }
  for (const field of ['case_states', 'distribution_states']) {
    const arr = event[field];
    if (arr && arr.some((s) => !isValidStateAbbr(s))) errors.push(`invalid_state_in:${field}`);
  }
  if (event.allergens && event.allergens.some((a) => !MAJOR_ALLERGENS.includes(a))) {
    reviewReasons.push('unrecognized_allergen');
  }

  // --- review rules ---------------------------------------------------------
  if (!event.source_url) reviewReasons.push('missing_canonical_page');
  if (!event.title && !event.display_title) reviewReasons.push('missing_title');
  if (event.event_kind !== 'outbreak' && !event.product_name && !event.product_description
      && products.length === 0) {
    reviewReasons.push('product_not_identified');
  }
  if (event.event_kind === 'outbreak' && !event.product_name && !event.product_description) {
    // CORE-only unknown-product row: publish only with clear public value
    const hasAdvice = Boolean(event.public_action);
    const material = (event.illnesses || 0) >= 20 || (event.hospitalizations || 0) > 0
      || (event.deaths || 0) > 0;
    if (!hasAdvice && !material) reviewReasons.push('core_only_unknown_product_no_consumer_value');
  }
  if (!event.hazard_category && !event.recall_reason_text) {
    reviewReasons.push('hazard_not_identified');
  }
  if (!event.fda_publish_date && !event.company_announcement_date && !event.source_updated_at) {
    reviewReasons.push('missing_source_date');
  }
  if (event.event_kind !== 'outbreak' && !event.public_action) {
    reviewReasons.push('consumer_action_not_determined');
  }
  const conflictWarnings = (parseWarnings || []).filter((w) => String(w).startsWith('conflicting_'));
  if (conflictWarnings.length > 0) {
    reviewReasons.push(...conflictWarnings);
  }
  if ((parseWarnings || []).includes('missing_title')) {
    // already covered above via event.title check
  }
  if (typeof event.extraction_confidence === 'number'
      && event.extraction_confidence < config.confidenceThreshold) {
    reviewReasons.push(`extraction_confidence_below_threshold:${event.extraction_confidence}`);
  }
  if (event.extraction_method === 'ai_only') {
    reviewReasons.push('ai_only_extraction_requires_review');
  }
  // Distribution text present but no safe normalization and not nationwide
  if (event.distribution_text && (!event.distribution_states || event.distribution_states.length === 0)
      && event.geographic_scope !== 'nationwide' && event.event_kind === 'recall'
      && /\bstates?\b/i.test(event.distribution_text)) {
    reviewReasons.push('distribution_states_not_safely_normalized');
  }

  return { valid: errors.length === 0, errors, reviewReasons };
}

/**
 * Decide the publish state for a validated candidate.
 */
function decidePublishState(event, { reviewReasons = [], materialChanged = true, previousPublishState = null } = {}) {
  if (previousPublishState === 'suppressed') {
    return { publishState: 'suppressed', reason: 'previously_suppressed' };
  }
  if (reviewReasons.length > 0) {
    return { publishState: 'review', reason: reviewReasons.join('; ') };
  }
  if (!materialChanged && previousPublishState === 'published') {
    return { publishState: 'published', reason: null };
  }
  if (!config.autoPublish) {
    // Auto-publish disabled: keep already-published events published,
    // everything else waits in review.
    if (previousPublishState === 'published') {
      return { publishState: 'published', reason: null };
    }
    return { publishState: 'review', reason: 'auto_publish_disabled' };
  }
  return { publishState: 'published', reason: null };
}

// ---------------------------------------------------------------------------
// Public payload allowlists
// ---------------------------------------------------------------------------

const PUBLIC_EVENT_FIELDS = [
  'id', 'event_kind', 'provider', 'source_url',
  'title', 'display_title', 'short_dek', 'public_action',
  'company', 'brands', 'product_name', 'product_description',
  'hazard_category', 'hazard_name', 'organism', 'serotype', 'allergens',
  'status', 'fda_recall_classification', 'voluntary_or_mandated',
  'update_number', 'current_version',
  'company_announcement_date', 'fda_publish_date', 'source_updated_at',
  'last_illness_onset',
  'illnesses', 'hospitalizations', 'deaths', 'hus_cases',
  'geographic_scope', 'case_states', 'distribution_states',
  'case_counts_by_state', 'distribution_text', 'retailers',
  'recommendations', 'source_links', 'images', 'severity', 'post_id',
];

const PUBLIC_PRODUCT_FIELDS = [
  'brand', 'product_name', 'variety', 'package_size', 'package_description',
  'upc', 'lot_code', 'additional_codes',
  'best_by_date', 'use_by_date', 'expiration_date',
  'retailers', 'distribution_states', 'image_urls',
];

const PUBLIC_VERSION_FIELDS = [
  'version_number', 'observed_at', 'source_updated_at', 'material_changes',
];

function pick(obj, fields) {
  const out = {};
  for (const f of fields) {
    if (obj[f] !== undefined) out[f] = obj[f];
  }
  return out;
}

/** Strip an event row to the strict public allowlist. */
function toPublicEvent(eventRow) {
  const out = pick(eventRow, PUBLIC_EVENT_FIELDS);
  // Public images: only safe display fields, never internal evidence
  if (Array.isArray(out.images)) {
    out.images = out.images.map((img) => ({
      url: img.url || img.optimizedUrl || img.sourceUrl || null,
      alt: img.alt || null,
      caption: img.caption || null,
      credit: img.credit || 'FDA',
      width: img.width || null,
      height: img.height || null,
      role: img.role || null,
    })).filter((i) => i.url);
  }
  if (Array.isArray(out.source_links)) {
    out.source_links = out.source_links
      .filter((l) => l && l.url && isAllowedUrl(l.url))
      .map((l) => ({ url: l.url, label: l.label || null, role: l.role || null }));
  }
  return out;
}

function toPublicProduct(productRow) {
  const out = pick(productRow, PUBLIC_PRODUCT_FIELDS);
  if (Array.isArray(out.image_urls)) {
    out.image_urls = out.image_urls.filter((u) => typeof u === 'string');
  } else if (out.image_urls && typeof out.image_urls === 'object') {
    out.image_urls = Object.values(out.image_urls).filter((u) => typeof u === 'string');
  }
  return out;
}

function toPublicVersion(versionRow) {
  return pick(versionRow, PUBLIC_VERSION_FIELDS);
}

module.exports = {
  validateEventCandidate,
  decidePublishState,
  toPublicEvent,
  toPublicProduct,
  toPublicVersion,
  PUBLIC_EVENT_FIELDS,
  PUBLIC_PRODUCT_FIELDS,
};
