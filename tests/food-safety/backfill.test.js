/**
 * Historical openFDA backfill selection and consumer-facing filter tests.
 * No network, no database writes.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const LIB = path.resolve(__dirname, '../../netlify/functions/lib/food-safety');

const { consumerFacingFilter } = require(path.join(LIB, 'consumerFacingFilter'));
const { evaluateBackfillRecord, selectBackfillRecords, parseClassFilter } = require(path.join(LIB, 'backfillSelect'));
const { parseOptions } = require(path.join(__dirname, '../../scripts/food-safety/backfill'));

function rec(overrides) {
  return {
    recallNumber: 'F-1234-2026',
    classification: 'Class I',
    recallingFirm: 'Example Foods LLC',
    productDescription: '',
    reasonForRecall: 'Potential Salmonella contamination',
    distributionPattern: '',
    codeInfo: '',
    ...overrides,
  };
}

const CONSUMER_ONLY = { consumerOnly: true, classFilter: parseClassFilter('I,II') };

// ── Retail consumer products included ───────────────────────────────────────

test('Good & Gather retail trail mix is consumer-facing', () => {
  const r = consumerFacingFilter(rec({
    productDescription: 'Good & Gather Dark Chocolate Trail Mix, 12 oz pouches sold in Target retail stores',
    distributionPattern: 'Nationwide retail grocery stores',
  }));
  assert.equal(r.include, true);
});

test('Utz retail chips are consumer-facing', () => {
  const r = consumerFacingFilter(rec({
    productDescription: 'Utz Ripple Cut Potato Chips, 9.5 oz bags',
    distributionPattern: 'Retail grocery and convenience stores',
  }));
  assert.equal(r.include, true);
});

test('Wawa bottled iced tea is consumer-facing', () => {
  const r = consumerFacingFilter(rec({
    productDescription: 'Wawa Brewed Iced Tea, 16 fl oz bottled tea sold at Wawa restaurant locations',
    distributionPattern: 'Wawa convenience stores in multiple states',
  }));
  assert.equal(r.include, true);
});

test('Market of Choice prepared salad is consumer-facing', () => {
  const r = consumerFacingFilter(rec({
    productDescription: 'Market of Choice Prepared Caesar Salad Kit, sold in deli counters at retail stores',
    distributionPattern: 'Market of Choice grocery stores in Oregon',
  }));
  assert.equal(r.include, true);
});

test('retail rice package is consumer-facing', () => {
  const r = consumerFacingFilter(rec({
    productDescription: 'Long grain white rice, 2 lb bags for retail sale',
    distributionPattern: 'Sold in grocery stores to consumers',
  }));
  assert.equal(r.include, true);
});

test('retail ice cream is consumer-facing', () => {
  const r = consumerFacingFilter(rec({
    productDescription: 'Vanilla ice cream, 1.5 quart retail cartons',
    distributionPattern: 'Retail supermarkets nationwide',
  }));
  assert.equal(r.include, true);
});

test('restaurant prepared food sold to consumers is consumer-facing', () => {
  const r = consumerFacingFilter(rec({
    productDescription: 'Prepared chicken salad sold at restaurant locations to consumers',
    distributionPattern: 'Quick service restaurant locations in 4 states',
  }));
  assert.equal(r.include, true);
});

test('fortified milk is not treated as a supplement because of vitamin wording', () => {
  const r = consumerFacingFilter(rec({
    productDescription: 'Vitamin D fortified whole milk, half gallon retail cartons',
    reasonForRecall: 'Undeclared almond allergen; contains vitamins A and D',
    distributionPattern: 'Retail grocery stores',
  }));
  assert.equal(r.include, true);
});

// ── Industrial / supplement exclusions ──────────────────────────────────────

test('50 lb seasoning bag is excluded as industrial', () => {
  const r = consumerFacingFilter(rec({
    productDescription: 'Seasoning blend, 50 lb bags supplied to food manufacturers for further processing',
    distributionPattern: 'Distributed to food processors',
  }));
  assert.equal(r.include, false);
  assert.equal(r.category, 'industrial');
});

test('25 kg dried milk powder is excluded as industrial', () => {
  const r = consumerFacingFilter(rec({
    productDescription: 'Dried milk powder, 25 kg bags for commercial use',
    distributionPattern: 'Sold to manufacturers',
  }));
  assert.equal(r.include, false);
  assert.equal(r.category, 'industrial');
});

test('industrial tote is excluded', () => {
  const r = consumerFacingFilter(rec({
    productDescription: 'Liquid flavor concentrate shipped in IBC totes to food processors',
    distributionPattern: 'Food manufacturers only',
  }));
  assert.equal(r.include, false);
  assert.equal(r.category, 'industrial');
});

test('moringa capsules are excluded as supplements', () => {
  const r = consumerFacingFilter(rec({
    productDescription: 'MOGO Moringa Leaf Capsules, 60 count dietary supplement bottles',
    reasonForRecall: 'Potential Salmonella contamination in herbal supplement capsules',
  }));
  assert.equal(r.include, false);
  assert.equal(r.category, 'supplement');
});

test('green-superfood supplement is excluded', () => {
  const r = consumerFacingFilter(rec({
    productDescription: 'Total Nutrition Green Superfood Supplement Powder, 30 servings',
    reasonForRecall: 'Undeclared milk allergen in supplement powder',
  }));
  assert.equal(r.include, false);
  assert.equal(r.category, 'supplement');
});

// ── Backfill selection integration ──────────────────────────────────────────

test('backfill requires both scopeFilter and consumerFacingFilter by default', () => {
  const retail = evaluateBackfillRecord(rec({
    productDescription: 'Utz Ripple Cut Potato Chips, 9.5 oz bags sold in retail stores',
  }), CONSUMER_ONLY);
  assert.equal(retail.enqueue, true);

  const industrial = evaluateBackfillRecord(rec({
    productDescription: 'Seasoning blend, 50 lb bags for manufacturers',
  }), CONSUMER_ONLY);
  assert.equal(industrial.enqueue, false);
  assert.equal(industrial.statBucket, 'excluded_industrial');
});

test('--max-enqueue=10 never enqueues more than 10 qualifying records', () => {
  const records = Array.from({ length: 25 }, (_, i) => rec({
    recallNumber: `F-${1000 + i}-2026`,
    productDescription: `Brand Snack Mix ${i}, 8 oz bags sold in retail grocery stores`,
  }));

  const { selected, stats } = selectBackfillRecords(records, {
    ...CONSUMER_ONLY,
    maxScan: 25,
    maxEnqueue: 10,
  });

  assert.equal(selected.length, 10);
  assert.equal(stats.enqueued, 10);
  assert.equal(stats.scanned, 10);
});

test('dry-run path does not require Supabase store module', () => {
  const opts = parseOptions([
    'node', 'backfill.js',
    '--since=2026-05-01',
    '--dry-run',
    '--consumer-only',
  ]);
  assert.equal(opts.dryRun, true);
  assert.equal(opts.consumerOnly, true);
});

test('parseOptions treats --include-industrial as consumerOnly false', () => {
  const opts = parseOptions([
    'node', 'backfill.js',
    '--since=2026-05-01',
    '--include-industrial',
  ]);
  assert.equal(opts.consumerOnly, false);
});

test('class filter accepts I and II only', () => {
  const classIII = evaluateBackfillRecord(rec({
    classification: 'Class III',
    productDescription: 'Retail cookies, 12 oz boxes sold in grocery stores',
  }), CONSUMER_ONLY);
  assert.equal(classIII.enqueue, false);
  assert.equal(classIII.statBucket, 'excluded_class');
});
