/**
 * Assemble a normalized food_safety_events candidate from a canonical-page
 * parse result (plus optional CORE row / recall-table context).
 */

const {
  classifyHazard, classifyEventKind, buildDisplayTitle, derivePublicAction,
} = require('./classify');
const { computeSeverity } = require('./severity');
const { materialHash } = require('./normalize');
const {
  extractNationalSurveillanceContext,
  extractPossibleAdditionalDistribution,
  mergeOtherOutcomes,
} = require('./geographyContext');

const EXTRACTION_METHOD_DETERMINISTIC = 'deterministic';

/**
 * @param {object} parse      parseCanonicalPage() result
 * @param {object} context    { sourceKind, coreRow, tableRow, canonicalKey, updateOf }
 * @returns {{ event, products, warnings }}
 */
function buildEventCandidate(parse, context = {}) {
  const warnings = [...(parse.warnings || [])];
  const coreRow = context.coreRow || null;

  const hazardText = [
    parse.recallReason, parse.title, parse.announcementText,
    parse.productDescription, coreRow ? coreRow.pathogen : null,
  ].filter(Boolean).join('\n');
  const hazard = classifyHazard(hazardText);

  const eventKind = classifyEventKind({
    sourceKind: context.sourceKind || '',
    title: parse.title || '',
    text: hazardText,
    hazard: { hazardCategory: hazard.hazardCategory },
  });

  const isExpansion = /expand(s|ed)? recall|expanded recall|recall expansion/i.test(
    `${parse.title || ''}\n${(parse.announcementText || '').slice(0, 600)}`,
  );

  const metrics = parse.metrics || {};

  // Geographic scope: only from explicit official signals
  let geographicScope = 'unknown';
  const distStates = parse.distributionStates || [];
  const caseStates = parse.caseStates || [];
  if (parse.nationwide) geographicScope = 'nationwide';
  else if (caseStates.length > 1 || distStates.length > 1) geographicScope = 'multistate';
  else if (caseStates.length === 1 || distStates.length === 1) geographicScope = 'single_state';

  // Status
  let status = parse.status || null;
  if (!status) {
    if (coreRow && /ended|closed/i.test(coreRow.investigationStatus || '')) status = 'ended';
    else if (isExpansion) status = 'expanded';
    else status = 'active';
  }

  const publicAction = derivePublicAction(parse.publicActionText || parse.announcementText || '');

  const products = (parse.products || []).map((p) => ({
    ...p,
    retailers: p.retailers || (parse.retailers.length ? parse.retailers : null),
    distribution_states: p.distribution_states || (distStates.length ? distStates : null),
  }));

  const event = {
    canonical_key: context.canonicalKey,
    event_kind: eventKind,
    provider: 'fda',
    source_url: parse.canonicalUrl,
    official_reference_number: coreRow ? coreRow.referenceNumber : (context.referenceNumber || null),
    openfda_event_id: context.openFdaEventId || null,
    recall_numbers: context.recallNumbers || null,

    title: parse.title,
    company: parse.company || null,
    brands: parse.brands && parse.brands.length ? parse.brands : null,
    product_name: firstProductName(parse, coreRow),
    product_description: parse.productDescription || null,

    hazard_category: hazard.hazardCategory,
    hazard_name: hazard.hazardName,
    organism: hazard.organism,
    serotype: hazard.serotype,
    allergens: hazard.allergens.length ? hazard.allergens : null,

    status,
    fda_recall_classification: context.fdaRecallClassification || null,
    voluntary_or_mandated: detectVoluntary(parse),

    company_announcement_date: parse.companyAnnouncementDate || null,
    fda_publish_date: parse.fdaPublishDate || null,
    source_updated_at: parse.sourceUpdatedAt || parse.fdaPublishDate || null,
    last_illness_onset: metrics.lastIllnessOnset || null,

    illnesses: numOrNull(metrics.illnesses),
    hospitalizations: numOrNull(metrics.hospitalizations),
    deaths: numOrNull(metrics.deaths),
    hus_cases: numOrNull(metrics.husCases),

    geographic_scope: geographicScope,
    // case_states = outbreak-associated states only (never national pathogen map)
    case_states: caseStates.length ? caseStates : null,
    distribution_states: distStates.length ? distStates : null,
    case_counts_by_state: context.caseCountsByState || null,
    distribution_text: parse.distributionText || null,
    retailers: parse.retailers && parse.retailers.length ? parse.retailers : null,

    recommendations: parse.recommendations && parse.recommendations.length
      ? parse.recommendations : null,
    public_action: publicAction,
    source_links: buildSourceLinks(parse, context),

    extraction_method: EXTRACTION_METHOD_DETERMINISTIC,
    extraction_confidence: estimateConfidence(parse, hazard, publicAction),
    source_hash: parse.bodyHash || null,

    // internal-only helpers for validation (not persisted directly)
    recall_reason_text: parse.recallReason || null,
  };

  if (isExpansion) event.status = 'expanded';

  // Geography context from full page text (subset-of-nationwide, distribution caveats).
  const contextText = [
    parse.fullText,
    parse.announcementText,
    parse.recallReason,
    parse.distributionText,
    parse.productDescription,
    parse.title,
  ].filter(Boolean).join('\n');
  const nationalCtx = extractNationalSurveillanceContext(contextText, {
    organism: hazard.organism,
  });
  const possibleExtraDist = extractPossibleAdditionalDistribution(contextText);
  event.national_surveillance_context = nationalCtx;
  event.possible_additional_distribution = possibleExtraDist || null;
  event.other_outcomes = mergeOtherOutcomes(null, {
    qualifiers: metrics.qualifiers,
    nationalSurveillanceContext: nationalCtx,
    possibleAdditionalDistribution: possibleExtraDist ? true : null,
  });

  event.display_title = buildDisplayTitle(event);
  event.short_dek = buildShortDek(event, parse);

  const { severity, reasons } = computeSeverity(event);
  event.severity = severity;
  event.severity_reasons = reasons;

  event.material_hash = materialHash(event, products);

  // evidence payload for admin review (stored on the source document /
  // version snapshot, never exposed publicly)
  const evidence = {
    metrics_evidence: metrics.evidence || {},
    parser_version: parse.parserVersion,
    warnings,
  };

  return { event, products, warnings, evidence };
}

function firstProductName(parse, coreRow) {
  // Prefer the concrete product row name; the summary product description
  // often concatenates every variant into an unreadable phrase.
  if (parse.products && parse.products.length >= 1 && parse.products[0].product_name) {
    return parse.products[0].product_name;
  }
  if (parse.productDescription && parse.productDescription.length <= 120) return parse.productDescription;
  if (coreRow && coreRow.productLinked) return coreRow.productLinked;
  return null;
}

function detectVoluntary(parse) {
  const t = `${parse.title || ''}\n${(parse.announcementText || '').slice(0, 800)}`;
  if (/voluntar(y|ily)/i.test(t)) return 'voluntary';
  if (/mandat(ed|ory)|ordered/i.test(t)) return 'mandated';
  return null;
}

function buildSourceLinks(parse, context) {
  const links = [];
  if (parse.canonicalUrl) {
    links.push({
      url: parse.canonicalUrl,
      label: parse.layout === 'outbreak_advisory' ? 'FDA outbreak advisory' : 'FDA recall announcement',
      role: 'canonical',
    });
  }
  if (context.coreRow && context.coreRow.referenceNumber) {
    links.push({
      url: 'https://www.fda.gov/food/outbreaks-foodborne-illness/investigations-foodborne-illness-outbreaks',
      label: `FDA CORE investigation table (ref #${context.coreRow.referenceNumber})`,
      role: 'core_table',
    });
  }
  if (context.tableRow) {
    links.push({
      url: 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts',
      label: 'FDA recalls index',
      role: 'recall_index',
    });
  }
  for (const rel of context.relatedUrls || []) {
    links.push({ url: rel, label: 'Related FDA announcement', role: 'related' });
  }
  return links;
}

function buildShortDek(event, parse) {
  const bits = [];
  if (event.company && event.event_kind !== 'outbreak') bits.push(event.company);
  if (event.hazard_name) bits.push(event.hazard_name);
  if (event.public_action) bits.push(event.public_action);
  if (bits.length === 0 && parse.recallReason) bits.push(parse.recallReason);
  return bits.join(' · ').slice(0, 200) || null;
}

function estimateConfidence(parse, hazard, publicAction) {
  let score = 0.5;
  if (parse.title) score += 0.1;
  if (parse.company || parse.layout === 'outbreak_advisory') score += 0.1;
  if (hazard.hazardCategory) score += 0.1;
  if (parse.fdaPublishDate || parse.companyAnnouncementDate) score += 0.1;
  if (publicAction || (parse.recommendations && parse.recommendations.length)) score += 0.1;
  if ((parse.warnings || []).length > 0) score -= 0.15 * parse.warnings.length;
  return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
}

function numOrNull(n) {
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

module.exports = { buildEventCandidate };
