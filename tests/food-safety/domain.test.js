/**
 * Deterministic domain-rule tests: numeric truth, state extraction,
 * allergen normalization, severity, versioning/diffing, staleness.
 * No network, no database.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const LIB = path.resolve(__dirname, '../../netlify/functions/lib/food-safety');

const { extractOutcomeMetrics, parseCountToken, extractUpcs } = require(path.join(LIB, 'normalize'));
const { extractStateList, isExplicitNationwide, normalizeStateToken } = require(path.join(LIB, 'states'));
const { classifyHazard, scopeFilter, MAJOR_ALLERGENS } = require(path.join(LIB, 'classify'));
const { computeSeverity } = require(path.join(LIB, 'severity'));
const { diffEvents, isNotStale } = require(path.join(LIB, 'versioning'));
const { decidePublishState } = require(path.join(LIB, 'validate'));

// ── Numeric truth rules ────────────────────────────────────────────────────

test('absent illness numbers stay null, never zero', () => {
  const m = extractOutcomeMetrics('The company issued a voluntary recall of the product.');
  assert.equal(m.illnesses, null);
  assert.equal(m.hospitalizations, null);
  assert.equal(m.deaths, null);
});

test('explicit "no illnesses reported" normalizes to zero with evidence', () => {
  const m = extractOutcomeMetrics('No illnesses have been reported to date in connection with this problem.');
  assert.equal(m.illnesses, 0);
  assert.ok(m.evidence.illnesses.includes('No illnesses'));
});

test('"at least N" retains the qualifier instead of silently exact totals', () => {
  const m = extractOutcomeMetrics('At least 12 people infected with Salmonella have been reported.');
  assert.equal(m.illnesses, 12);
  assert.ok(
    (m.qualifiers.illnesses || '').toLowerCase().includes('at least')
    || (m.evidence.illnesses || '').toLowerCase().includes('at least'),
  );
});

test('parseCountToken handles words and digits, rejects garbage', () => {
  assert.equal(parseCountToken('12'), 12);
  assert.equal(parseCountToken('1,644'), 1644);
  assert.equal(parseCountToken('three'), 3);
  assert.equal(parseCountToken('lots'), null);
});

// ── State extraction ───────────────────────────────────────────────────────

test('state list extraction from explicit distribution sentences', () => {
  const r = extractStateList('The product was distributed in California, Texas, and New York.');
  assert.deepEqual([...r.states].sort(), ['CA', 'NY', 'TX']);
});

test('"Washington" is not blindly treated as a state without context', () => {
  const r = extractStateList('The FDA in Washington announced new guidance for importers in the region.');
  // Either no WA at all, or flagged with low confidence — never a silent
  // high-confidence state hit from an agency location mention.
  if (r.states.includes('WA')) {
    assert.ok(r.confidence < 0.8, `confidence ${r.confidence}`);
  }
});

test('nationwide is only explicit', () => {
  assert.equal(isExplicitNationwide('Product was distributed nationwide.'), true);
  assert.equal(isExplicitNationwide('Product was distributed to retailers across several regions.'), false);
});

test('normalizeStateToken handles names, abbreviations, DC, PR', () => {
  assert.equal(normalizeStateToken('California'), 'CA');
  assert.equal(normalizeStateToken('D.C.'), 'DC');
  assert.equal(normalizeStateToken('Puerto Rico'), 'PR');
  assert.equal(normalizeStateToken('Narnia'), null);
});

// ── Allergen normalization ─────────────────────────────────────────────────

test('all nine major allergens normalize from undeclared statements', () => {
  const statements = {
    milk: 'recalled due to undeclared milk',
    egg: 'allergy alert on undeclared egg',
    fish: 'undeclared fish (anchovy)',
    'crustacean shellfish': 'undeclared crustacean shellfish (shrimp)',
    'tree nuts': 'undeclared tree nuts (almonds)',
    peanuts: 'undeclared peanuts',
    wheat: 'undeclared wheat',
    soybeans: 'undeclared soy',
    sesame: 'undeclared sesame',
  };
  for (const [allergen, text] of Object.entries(statements)) {
    const h = classifyHazard(text);
    assert.equal(h.hazardCategory, 'allergen', `${allergen}: ${JSON.stringify(h)}`);
    assert.ok(h.allergens.includes(allergen), `${allergen} not in ${JSON.stringify(h.allergens)}`);
  }
  assert.equal(MAJOR_ALLERGENS.length, 9);
});

test('allergen in a product name without undeclared context is not a hazard', () => {
  const h = classifyHazard('Black Sesame Filling Rice Balls recalled due to possible Salmonella contamination');
  assert.equal(h.hazardCategory, 'pathogen');
  assert.ok(!h.allergens.includes('sesame'));
});

// ── Scope filter ───────────────────────────────────────────────────────────

test('drug and device recalls are excluded', () => {
  assert.equal(scopeFilter({ title: 'Company recalls Losartan tablets 50 mg' }).include, false);
  assert.equal(scopeFilter({ title: 'Recall of infusion pump model X' }).include, false);
  assert.equal(scopeFilter({ title: 'Dietary supplement recall for undeclared sildenafil' }).include, false);
});

test('food product type overrides weak text exclusion matches', () => {
  const r = scopeFilter({
    title: 'Company recalls whole milk half gallons due to possible contamination',
    productType: 'Food & Beverages',
  });
  assert.equal(r.include, true);
});

// ── Severity ───────────────────────────────────────────────────────────────

test('deaths force severity 5 with explainable reason', () => {
  const { severity, reasons } = computeSeverity({
    event_kind: 'outbreak', deaths: 2, hazard_category: 'pathogen',
  });
  assert.equal(severity, 5);
  assert.ok(reasons.some((r) => r.startsWith('deaths_reported')));
});

test('hospitalizations force severity 4', () => {
  const { severity } = computeSeverity({
    event_kind: 'outbreak', illnesses: 30, hospitalizations: 4,
    hazard_category: 'pathogen', geographic_scope: 'multistate',
  });
  assert.equal(severity, 4);
});

test('terminated updates cap severity at 2 without deleting data', () => {
  const { severity, reasons } = computeSeverity({
    event_kind: 'recall', status: 'terminated', hazard_category: 'pathogen',
    public_action: 'Do not eat',
  });
  assert.equal(severity, 2);
  assert.ok(reasons.includes('ended_or_terminated_no_new_risk_cap'));
});

test('"0 deaths" is never a severity-5 trigger', () => {
  const { severity } = computeSeverity({
    event_kind: 'recall', deaths: 0, hazard_category: 'allergen',
    allergens: ['peanuts'],
  });
  assert.ok(severity < 5);
});

// ── Versioning / diffing ───────────────────────────────────────────────────

const baseEvent = {
  illnesses: 10, hospitalizations: 2, deaths: null,
  case_states: ['OH', 'MI'], distribution_states: ['OH', 'MI', 'IN'],
  product_name: 'Iceberg Lettuce', status: 'active',
  public_action: 'Do not eat', retailers: null,
  material_hash: 'aaa', source_updated_at: '2026-07-10T00:00:00Z',
};

test('material update produces structured change entries', () => {
  const next = {
    ...baseEvent,
    illnesses: 25,
    case_states: ['OH', 'MI', 'KY'],
    material_hash: 'bbb',
    source_updated_at: '2026-07-12T00:00:00Z',
  };
  const diff = diffEvents(baseEvent, next);
  assert.equal(diff.hasMaterialChange, true);
  const types = diff.materialChanges.map((c) => c.type);
  assert.ok(types.includes('illness_total'));
  assert.ok(types.includes('new_case_states'));
  const ill = diff.materialChanges.find((c) => c.type === 'illness_total');
  assert.equal(ill.from, 10);
  assert.equal(ill.to, 25);
});

test('cosmetic-only change does not report a material change', () => {
  const next = { ...baseEvent }; // identical material fields + same hash
  const diff = diffEvents(baseEvent, next);
  assert.equal(diff.hasMaterialChange, false);
});

test('termination is a status change, not a deletion', () => {
  const next = { ...baseEvent, status: 'terminated', material_hash: 'ccc' };
  const diff = diffEvents(baseEvent, next);
  assert.ok(diff.materialChanges.some((c) => c.type === 'recall_terminated'));
  // Prior data remains in the from-side of the change map.
  assert.equal(diff.changedFields.status.from, 'active');
});

test('stale data cannot overwrite newer official data', () => {
  const older = { ...baseEvent, source_updated_at: '2026-07-01T00:00:00Z' };
  assert.equal(isNotStale(baseEvent, older), false);
  const newer = { ...baseEvent, source_updated_at: '2026-07-15T00:00:00Z' };
  assert.equal(isNotStale(baseEvent, newer), true);
});

// ── Publish gate ───────────────────────────────────────────────────────────

test('review reasons force review state', () => {
  const d = decidePublishState({}, { reviewReasons: ['conflicting_illness_totals'], materialChanged: true });
  assert.equal(d.publishState, 'review');
});

test('auto-publish disabled keeps new candidates in review but leaves published events published', () => {
  // FDA_AUTO_PUBLISH is unset in the test environment → disabled.
  const fresh = decidePublishState({}, { reviewReasons: [], materialChanged: true, previousPublishState: null });
  assert.equal(fresh.publishState, 'review');
  const already = decidePublishState({}, { reviewReasons: [], materialChanged: true, previousPublishState: 'published' });
  assert.equal(already.publishState, 'published');
});

test('suppressed events stay suppressed', () => {
  const d = decidePublishState({}, { reviewReasons: [], materialChanged: true, previousPublishState: 'suppressed' });
  assert.equal(d.publishState, 'suppressed');
});

// ── UPC extraction ─────────────────────────────────────────────────────────

test('UPC extraction finds 12-14 digit codes, not dates or phone numbers', () => {
  const upcs = extractUpcs('UPC 6908791000053. Call 1-800-555-0199. Best by 12/31/2026.');
  assert.deepEqual(upcs, ['6908791000053']);
});
