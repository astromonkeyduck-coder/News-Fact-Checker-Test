/**
 * Fixture-driven parser and pipeline tests. Fixtures are sanitized captures
 * of official FDA pages/feeds; original URL and capture date live in each
 * fixture's .meta.json. No live network access is used.
 *
 * Run: npm run fda:test:fixtures   (node --test)
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const FIXTURES = path.join(__dirname, 'fixtures');
const LIB = path.resolve(__dirname, '../../netlify/functions/lib/food-safety');

const { parseCanonicalPage } = require(path.join(LIB, 'providers/fda/canonicalPage'));
const { parseRecallTable } = require(path.join(LIB, 'providers/fda/recallTable'));
const { parseCoreTable, UNKNOWN_PRODUCT_RE } = require(path.join(LIB, 'providers/fda/coreTable'));
const { canonicalizeFdaUrl } = require(path.join(LIB, 'providers/fda/rss'));
const { buildEventCandidate } = require(path.join(LIB, 'buildEvent'));
const { scopeFilter } = require(path.join(LIB, 'classify'));
const { validateEventCandidate } = require(path.join(LIB, 'validate'));
const { canonicalKeyForPage } = require(path.join(LIB, 'correlate'));

function loadFixture(name) {
  const html = fs.readFileSync(path.join(FIXTURES, `${name}.html`), 'utf8');
  const meta = JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.meta.json`), 'utf8'));
  return { html, meta };
}

function buildFromFixture(name) {
  const { html, meta } = loadFixture(name);
  const parse = parseCanonicalPage(html, meta.source_url);
  const built = buildEventCandidate(parse, {
    sourceKind: parse.layout === 'outbreak_advisory' ? 'fda_rss_outbreak' : 'fda_rss_recall',
    canonicalKey: canonicalKeyForPage(meta.source_url),
  });
  return { parse, meta, ...built };
}

// ── Recall: undeclared peanut allergen ─────────────────────────────────────

test('peanut allergen recall: hazard, kind, explicit-zero illnesses', () => {
  const { event, products } = buildFromFixture('recall-allergen-peanut');

  assert.equal(event.event_kind, 'allergen_alert');
  assert.equal(event.hazard_category, 'allergen');
  assert.deepEqual(event.allergens, ['peanuts']);
  assert.match(event.display_title, /peanut/i);
  assert.match(event.display_title, /Glutinous Rice Balls/);

  // Page says "No illnesses have been reported to date" — explicit zero.
  assert.equal(event.illnesses, 0);
  // Never fabricated: page reports no hospitalizations/deaths at all.
  assert.equal(event.hospitalizations, null);
  assert.equal(event.deaths, null);

  assert.equal(event.geographic_scope, 'multistate');
  assert.ok(event.distribution_states.length >= 5);
  // Distribution list must never leak into case states.
  assert.equal(event.case_states, null);

  assert.ok(products.length >= 1);
  assert.equal(products[0].upc, '6908791000053');
  // Prose "specific lots of ..." must never become a lot code.
  assert.ok(!products[0].lot_code || /\d/.test(products[0].lot_code));
});

test('peanut allergen recall: passes scope filter and validation', () => {
  const { parse, meta, event, products, warnings } = buildFromFixture('recall-allergen-peanut');
  const scope = scopeFilter({ title: parse.title, description: parse.recallReason || '', url: meta.source_url });
  assert.equal(scope.include, true);

  const validation = validateEventCandidate(event, { products, parseWarnings: warnings });
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.reviewReasons, []);
});

// ── Recall expansion ────────────────────────────────────────────────────────

test('expanded recall: status expanded, severity >= 4', () => {
  const { event } = buildFromFixture('recall-expansion');
  assert.equal(event.status, 'expanded');
  assert.ok(event.severity >= 4, `severity ${event.severity}`);
  assert.match(event.display_title, /expands? recall/i);
});

// ── Multi-allergen (sesame) ────────────────────────────────────────────────

test('sesame/wheat/soy recall: all major allergens normalize', () => {
  const { event } = buildFromFixture('recall-allergen-sesame');
  assert.equal(event.hazard_category, 'allergen');
  assert.deepEqual([...event.allergens].sort(), ['sesame', 'soybeans', 'wheat']);
});

// ── Pathogen recall with no reported illnesses ─────────────────────────────

test('E. coli blueberries recall: pathogen identified, absent metrics stay null', () => {
  const { event } = buildFromFixture('recall-ecoli-blueberries');
  assert.equal(event.hazard_category, 'pathogen');
  assert.match(event.hazard_name, /E\. coli/);
  assert.equal(event.event_kind, 'recall');
  // No explicit illness statement on this page: null, never zero.
  assert.equal(event.hospitalizations, null);
  assert.equal(event.deaths, null);
});

test('listeria cottage cheese recall: unparseable distribution goes to review', () => {
  const { event, products, warnings } = buildFromFixture('recall-cottage-cheese');
  assert.match(event.hazard_name, /Listeria/);
  const validation = validateEventCandidate(event, { products, parseWarnings: warnings });
  // Distribution prose without safe state extraction must not publish silently.
  assert.ok(
    validation.reviewReasons.some((r) => r.includes('distribution_states_not_safely_normalized'))
    || (event.distribution_states && event.distribution_states.length > 0),
  );
});

// ── Severity escalation ────────────────────────────────────────────────────

test('infant formula botulism recall: severity 5', () => {
  const { event } = buildFromFixture('recall-infant-formula');
  assert.equal(event.severity, 5);
  assert.ok(event.severity_reasons.length > 0);
});

// ── Outbreak advisory (active cyclospora, case counts block) ───────────────

test('cyclospora outbreak: metrics, states, action, explicit zero deaths', () => {
  const { event } = buildFromFixture('outbreak-cyclospora-lettuce');

  assert.equal(event.event_kind, 'outbreak');
  assert.equal(event.organism, 'Cyclospora');
  assert.equal(event.illnesses, 1644);
  assert.equal(event.hospitalizations, 94);
  assert.equal(event.deaths, 0); // page explicitly lists "Deaths: 0"
  assert.equal(event.public_action, 'Do not eat');

  // Case states and distribution states extracted separately.
  assert.deepEqual([...event.case_states].sort(), ['IN', 'KY', 'MI', 'OH', 'WV']);
  assert.ok(Array.isArray(event.distribution_states));
  assert.ok(event.national_surveillance_context?.outbreak_is_subset_of_national);
  assert.equal(event.national_surveillance_context.national_case_count, null);
  assert.equal(event.possible_additional_distribution, true);

  assert.ok(event.severity >= 4);
});

test('salmonella cucumbers outbreak: conflicting official totals route to review', () => {
  const { event, products, warnings } = buildFromFixture('outbreak-salmonella-cucumbers');
  assert.equal(event.event_kind, 'outbreak');
  const validation = validateEventCandidate(event, { products, parseWarnings: warnings });
  assert.ok(
    validation.reviewReasons.some((r) => r.startsWith('conflicting_')),
    `expected conflict review reason, got ${JSON.stringify(validation.reviewReasons)}`,
  );
  // Ended investigation caps severity, never deletes data.
  assert.equal(event.status, 'ended');
  assert.ok(event.severity <= 2);
  assert.ok(event.illnesses > 0);
});

// ── Scope exclusions ───────────────────────────────────────────────────────

test('pet food recall is excluded by scope filter', () => {
  const { parse, meta } = (() => {
    const { html, meta } = loadFixture('recall-pet-food');
    return { parse: parseCanonicalPage(html, meta.source_url), meta };
  })();
  const scope = scopeFilter({
    title: parse.title,
    description: `${parse.recallReason || ''}\n${(parse.announcementText || '').slice(0, 500)}`,
    url: meta.source_url,
  });
  assert.equal(scope.include, false);
  assert.match(scope.reason, /veterinary_or_pet_food/);
});

test('cosmetic recall is excluded by scope filter', () => {
  const { html, meta } = loadFixture('recall-cosmetic-out-of-scope');
  const parse = parseCanonicalPage(html, meta.source_url);
  const scope = scopeFilter({
    title: parse.title,
    description: `${parse.recallReason || ''}\n${(parse.announcementText || '').slice(0, 500)}`,
    url: meta.source_url,
  });
  assert.equal(scope.include, false);
  assert.match(scope.reason, /cosmetic/);
});

// ── Structured recall index ────────────────────────────────────────────────

test('recall table parses structured rows', () => {
  const { html } = loadFixture('recall-table');
  const rows = parseRecallTable(html);
  assert.ok(rows.length >= 10, `only ${rows.length} rows`);
  const withUrl = rows.filter((r) => r.canonicalUrl);
  assert.ok(withUrl.length >= 10);
  for (const r of withUrl.slice(0, 5)) {
    assert.match(r.canonicalUrl, /^https:\/\/www\.fda\.gov\//);
    assert.ok(r.brandName || r.productDescription);
  }
});

// ── CORE investigation table ───────────────────────────────────────────────

test('CORE table parses rows with reference numbers', () => {
  const { html } = loadFixture('core-table');
  const rows = parseCoreTable(html);
  assert.ok(rows.length >= 3, `only ${rows.length} rows`);
  const withRef = rows.filter((r) => r.referenceNumber);
  assert.ok(withRef.length >= 3);
});

test('CORE unknown-product rows are detected and never used as product names', () => {
  const { html } = loadFixture('core-table');
  const rows = parseCoreTable(html);
  const unknown = rows.filter((r) => r.productLinked && UNKNOWN_PRODUCT_RE.test(r.productLinked));
  for (const row of unknown) {
    assert.equal(row.hasProductLinked, false);
  }
});

// ── RSS fixtures ───────────────────────────────────────────────────────────

test('food-safety recalls RSS yields canonical FDA candidates', async () => {
  const Parser = require('rss-parser');
  const parser = new Parser();
  const xml = fs.readFileSync(path.join(FIXTURES, 'rss-food-safety-recalls.xml'), 'utf8');
  const feed = await parser.parseString(xml);
  assert.ok(feed.items.length >= 5);
  for (const item of feed.items.slice(0, 5)) {
    const canonical = canonicalizeFdaUrl(item.link);
    assert.match(canonical, /^https:\/\/www\.fda\.gov\//);
  }
});

test('canonicalizeFdaUrl rejects non-FDA hostnames', () => {
  assert.equal(canonicalizeFdaUrl('https://evil.example.com/fda.gov/page'), null);
  assert.equal(canonicalizeFdaUrl('https://fda.gov.evil.com/recall'), null);
  assert.equal(
    canonicalizeFdaUrl('http://www.fda.gov/safety/recalls?utm_source=x#frag'),
    'https://www.fda.gov/safety/recalls',
  );
});

// ── Duplicate signals ──────────────────────────────────────────────────────

test('same canonical page from RSS/table/email produces one canonical key', () => {
  const url = 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/some-recall';
  const viaRss = canonicalKeyForPage(canonicalizeFdaUrl('http://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/some-recall?utm_campaign=email'));
  const viaTable = canonicalKeyForPage(url);
  const viaEmail = canonicalKeyForPage(canonicalizeFdaUrl(`${url}#main`));
  assert.equal(viaRss, viaTable);
  assert.equal(viaTable, viaEmail);
});
