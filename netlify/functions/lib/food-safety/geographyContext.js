/**
 * Outbreak geography context — keep three concepts strictly separate:
 *   1. outbreak-associated case states (linked to THIS investigation)
 *   2. national pathogen surveillance (broader, may include unrelated cases)
 *   3. confirmed product distribution (may differ from case states)
 *
 * Never invent a national case total. Never reuse one field for another.
 */

const LABELS = {
  mapTabCases: 'Cases linked to this outbreak',
  mapTabDistribution: 'Confirmed product distribution',
  mapCaptionCases: 'States reporting outbreak-associated cases',
  mapCaptionDistribution: 'Confirmed product distribution',
  mapLegendCases: 'Outbreak-associated cases reported',
  mapLegendDistribution: 'Confirmed product distribution',
  mapAltCases: 'States reporting outbreak-associated cases',
  mapAltDistribution: 'Confirmed product distribution states',
  metricIllnessesOutbreak: 'illnesses linked to this investigation',
  metricHospitalizationsOutbreak: 'hospitalizations linked to this investigation',
  metricDeathsOutbreak: 'deaths linked to this investigation',
  metricOutbreakCaseStates: 'States with outbreak-linked cases',
  metricConfirmedDistribution: 'Confirmed distribution states',
  possibleAdditionalDistribution:
    'FDA says implicated product may have been distributed beyond the states currently confirmed.',
};

/**
 * Extract source-backed national surveillance context from FDA page text.
 * Returns null when the page does not establish that the outbreak is a subset
 * of broader national pathogen reporting.
 */
function extractNationalSurveillanceContext(text, { organism = null } = {}) {
  if (!text || typeof text !== 'string') return null;
  const plain = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  const outbreakIsSubset = /illnesses included in this outbreak are a subset of .{0,80}illnesses identified nationwide/i.test(plain)
    || /subset of (?:the )?(?:[A-Za-z]+\s+)?illnesses identified nationwide/i.test(plain);

  if (!outbreakIsSubset) return null;

  const statements = [];
  const pathogen = organism || detectPathogenLabel(plain) || 'this pathogen';

  statements.push(
    `FDA says these illnesses are a subset of ${pathogen} illnesses identified nationwide.`,
  );

  if (/national surveillance[^.]*include this outbreak as well as illnesses that are not/i.test(plain)
      || /include this outbreak as well as illnesses that are not a part of this outbreak/i.test(plain)) {
    statements.push(
      'CDC national surveillance includes this outbreak and illnesses not part of it.',
    );
  }

  if (/probable and confirmed cases/i.test(plain)
      || /not yet been reported to CDC/i.test(plain)
      || /case counts in this advisory may not match/i.test(plain)) {
    statements.push(
      'State counts may include probable cases or cases not yet reported to CDC.',
    );
  }

  return {
    outbreak_is_subset_of_national: true,
    pathogen_label: pathogen,
    statements,
    // Never invent a national total — only set when an official figure is present.
    national_case_count: null,
  };
}

function detectPathogenLabel(plain) {
  const m = plain.match(/subset of the\s+([A-Za-z]+)\s+illnesses identified nationwide/i);
  return m ? m[1] : null;
}

/**
 * True when FDA states confirmed distribution may understate actual reach.
 */
function extractPossibleAdditionalDistribution(text) {
  if (!text || typeof text !== 'string') return false;
  const plain = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  return /product may have been distributed further/i.test(plain)
    || /reaching additional states/i.test(plain)
    || /distributed beyond the states/i.test(plain)
    || /Additional states may be added to this advisory/i.test(plain);
}

function buildInvestigationLabel(event) {
  const bits = [];
  if (Array.isArray(event.retailers) && event.retailers.length) {
    bits.push(event.retailers[0]);
  }
  if (event.product_name) {
    bits.push(String(event.product_name).toLowerCase().includes('lettuce')
      ? `${event.product_name}`.replace(/\s+/g, ' ').trim()
      : event.product_name);
  }
  if (!bits.length) return 'investigation';
  // "Taco Bell iceberg-lettuce investigation"
  const product = (event.product_name || '').toLowerCase();
  if (bits[0] && product.includes('iceberg')) {
    return `${bits[0]} iceberg-lettuce investigation`;
  }
  if (bits.length === 2) return `${bits[0]} ${bits[1]} investigation`;
  return `${bits[0]} investigation`;
}

/**
 * Prominent map notice when FDA says outbreak cases are a subset of national
 * pathogen illnesses. Empty string when not applicable.
 */
function buildOutbreakCaseMapNotice(event, { caseStateCount = null } = {}) {
  const ctx = event.national_surveillance_context
    || (event.other_outcomes && event.other_outcomes.national_surveillance_context)
    || null;
  if (!ctx || !ctx.outbreak_is_subset_of_national) return '';

  const pathogen = ctx.pathogen_label || event.organism || event.hazard_name || 'This pathogen';
  const n = Number.isFinite(caseStateCount)
    ? caseStateCount
    : (Array.isArray(event.outbreak_case_states) ? event.outbreak_case_states.length
      : (Array.isArray(event.case_states) ? event.case_states.length : null));
  const statePhrase = n ? `these ${n} state${n === 1 ? '' : 's'}` : 'these states';
  const investigation = buildInvestigationLabel(event);
  return `${pathogen} illnesses have been reported beyond ${statePhrase}. This map shows only states reporting cases currently linked by FDA and CDC to this specific ${investigation}.`;
}

/**
 * Explicit public geography fields. case_states remains for compatibility;
 * outbreak_case_states / confirmed_distribution_states are the preferred names.
 */
function buildPublicGeographyFields(eventRow) {
  const other = eventRow.other_outcomes && typeof eventRow.other_outcomes === 'object'
    ? eventRow.other_outcomes
    : {};
  const caseStates = Array.isArray(eventRow.case_states) ? eventRow.case_states : null;
  const distStates = Array.isArray(eventRow.distribution_states) ? eventRow.distribution_states : null;
  let national = eventRow.national_surveillance_context || other.national_surveillance_context || null;
  if (national && typeof national.national_case_count === 'undefined') {
    national = { ...national, national_case_count: null };
  }
  const possible = typeof eventRow.possible_additional_distribution === 'boolean'
    ? eventRow.possible_additional_distribution
    : (typeof other.possible_additional_distribution === 'boolean'
      ? other.possible_additional_distribution
      : null);

  return {
    outbreak_case_states: caseStates,
    confirmed_distribution_states: distStates,
    national_surveillance_context: national,
    possible_additional_distribution: possible,
  };
}

/**
 * Merge geography context into other_outcomes for persistence without a
 * hard dependency on a new SQL column migration.
 */
function mergeOtherOutcomes(existing, { nationalSurveillanceContext = null, possibleAdditionalDistribution = null, qualifiers = null } = {}) {
  const out = existing && typeof existing === 'object' ? { ...existing } : {};
  if (qualifiers && Object.keys(qualifiers).length) out.qualifiers = qualifiers;
  if (nationalSurveillanceContext) out.national_surveillance_context = nationalSurveillanceContext;
  if (typeof possibleAdditionalDistribution === 'boolean') {
    out.possible_additional_distribution = possibleAdditionalDistribution;
  }
  return Object.keys(out).length ? out : null;
}

module.exports = {
  LABELS,
  extractNationalSurveillanceContext,
  extractPossibleAdditionalDistribution,
  buildInvestigationLabel,
  buildOutbreakCaseMapNotice,
  buildPublicGeographyFields,
  mergeOtherOutcomes,
};
