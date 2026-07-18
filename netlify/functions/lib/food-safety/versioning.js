/**
 * Event versioning: structured diffs between the stored event and a new
 * candidate. Material changes drive the public update number and the
 * "what changed" summary; cosmetic changes do not.
 */

const MATERIAL_FIELDS = [
  'illnesses', 'hospitalizations', 'deaths', 'hus_cases',
  'case_states', 'distribution_states', 'case_counts_by_state',
  'status', 'public_action', 'hazard_name', 'organism', 'serotype',
  'allergens', 'product_name', 'product_description', 'brands', 'company',
  'retailers', 'fda_recall_classification', 'geographic_scope',
  'last_illness_onset', 'recommendations',
];

const COSMETIC_FIELDS = new Set([
  'title', 'display_title', 'short_dek', 'source_hash', 'material_hash',
  'extraction_confidence', 'severity_reasons', 'source_links', 'images',
  'last_seen_at', 'source_updated_at', 'updated_at', 'compact_summary',
]);

function normalizeForDiff(v) {
  if (v === undefined) return null;
  if (Array.isArray(v)) return [...v].sort();
  return v;
}

function isEqual(a, b) {
  return JSON.stringify(normalizeForDiff(a)) === JSON.stringify(normalizeForDiff(b));
}

/**
 * Diff a stored event against a new candidate.
 * Returns { changedFields, materialChanges, hasMaterialChange }.
 * materialChanges entries are human/renderer-friendly structured facts.
 */
function diffEvents(previous, next, { previousProducts = [], nextProducts = [] } = {}) {
  const changedFields = {};
  const materialChanges = [];

  const fields = new Set([...MATERIAL_FIELDS]);
  for (const field of fields) {
    const before = previous ? previous[field] : null;
    const after = next[field];
    if (!isEqual(before ?? null, after ?? null)) {
      changedFields[field] = { from: before ?? null, to: after ?? null };
    }
  }

  // Never let stale data overwrite newer official data: caller must ensure
  // next.source_updated_at >= previous.source_updated_at before applying.

  // Human-meaningful material change descriptions
  if (changedFields.illnesses) {
    const { from, to } = changedFields.illnesses;
    if (to !== null) {
      materialChanges.push({
        type: 'illness_total', from, to, label: from === null ? `Illness total reported: ${to}` : `Illness total updated: ${from} → ${to}`,
      });
    }
  }
  if (changedFields.hospitalizations) {
    const { from, to } = changedFields.hospitalizations;
    if (to !== null) {
      materialChanges.push({
        type: 'hospitalization_total', from, to, label: from === null ? `Hospitalizations reported: ${to}` : `Hospitalizations updated: ${from} → ${to}`,
      });
    }
  }
  if (changedFields.deaths) {
    const { from, to } = changedFields.deaths;
    if (to !== null) {
      materialChanges.push({
        type: 'death_total', from, to, label: from === null ? `Deaths reported: ${to}` : `Deaths updated: ${from} → ${to}`,
      });
    }
  }
  if (changedFields.case_states) {
    const before = new Set(changedFields.case_states.from || []);
    const added = (changedFields.case_states.to || []).filter((s) => !before.has(s));
    if (added.length) {
      materialChanges.push({ type: 'new_case_states', states: added, label: `New outbreak-associated case states: ${added.join(', ')}` });
    }
  }
  if (changedFields.distribution_states) {
    const before = new Set(changedFields.distribution_states.from || []);
    const added = (changedFields.distribution_states.to || []).filter((s) => !before.has(s));
    if (added.length) {
      materialChanges.push({ type: 'new_distribution_states', states: added, label: `Distribution expanded to: ${added.join(', ')}` });
    }
  }
  if (changedFields.product_name || changedFields.product_description) {
    const to = (changedFields.product_name && changedFields.product_name.to)
      || (changedFields.product_description && changedFields.product_description.to);
    const from = (changedFields.product_name && changedFields.product_name.from)
      || (changedFields.product_description && changedFields.product_description.from);
    if (from === null && to) {
      materialChanges.push({ type: 'product_identified', product: to, label: `Food source identified: ${to}` });
    }
  }
  if (changedFields.status) {
    const to = changedFields.status.to;
    if (to === 'expanded') materialChanges.push({ type: 'recall_expanded', label: 'Recall expanded' });
    if (to === 'ended') materialChanges.push({ type: 'investigation_ended', label: 'Investigation ended' });
    if (to === 'terminated') materialChanges.push({ type: 'recall_terminated', label: 'Recall terminated' });
  }
  if (changedFields.retailers) {
    const before = new Set(changedFields.retailers.from || []);
    const added = (changedFields.retailers.to || []).filter((r) => !before.has(r));
    if (added.length) {
      materialChanges.push({ type: 'new_retailers', retailers: added, label: `New retailer(s): ${added.join(', ')}` });
    }
  }
  if (changedFields.public_action && changedFields.public_action.to) {
    materialChanges.push({
      type: 'consumer_action', action: changedFields.public_action.to, label: `Consumer action: ${changedFields.public_action.to}`,
    });
  }

  // Product-level changes (new lots / products)
  const prevKeys = new Set(previousProducts.map(productKey));
  const newRows = nextProducts.filter((p) => !prevKeys.has(productKey(p)));
  if (previous && newRows.length > 0 && previousProducts.length > 0) {
    materialChanges.push({
      type: 'new_products',
      count: newRows.length,
      label: `${newRows.length} product(s)/lot(s) added`,
    });
  }

  const hasMaterialChange = previous
    ? previous.material_hash !== next.material_hash
    : true;

  return { changedFields, materialChanges, hasMaterialChange };
}

function productKey(p) {
  return [(p.upc || ''), (p.lot_code || ''), (p.product_name || ''), (p.package_size || '')]
    .join('|').toLowerCase();
}

/**
 * Guard against stale data overwriting newer official data.
 * Returns true when `next` is NOT older than the stored event.
 */
function isNotStale(previous, next) {
  if (!previous || !previous.source_updated_at || !next.source_updated_at) return true;
  return new Date(next.source_updated_at).getTime() >= new Date(previous.source_updated_at).getTime();
}

module.exports = { diffEvents, isNotStale, MATERIAL_FIELDS, COSMETIC_FIELDS };
