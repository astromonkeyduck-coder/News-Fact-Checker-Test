/**
 * Geography context: outbreak cases vs national surveillance vs distribution.
 * Run: npm run fda:test
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const LIB = path.join(__dirname, '../../netlify/functions/lib/food-safety');
const FIXTURES = path.join(__dirname, 'fixtures');
const {
  extractNationalSurveillanceContext,
  extractPossibleAdditionalDistribution,
  buildOutbreakCaseMapNotice,
  buildPublicGeographyFields,
  LABELS,
} = require(path.join(LIB, 'geographyContext'));
const { buildEventCandidate } = require(path.join(LIB, 'buildEvent'));
const { parseCanonicalPage } = require(path.join(LIB, 'providers/fda/canonicalPage'));
const { toPublicEvent } = require(path.join(LIB, 'validate'));
const { buildStoryText } = require(path.join(LIB, 'publish'));
const { canonicalKeyForPage } = require(path.join(LIB, 'correlate'));

test('cyclospora fixture extracts national subset context and possible extra distribution', () => {
  const html = fs.readFileSync(path.join(FIXTURES, 'outbreak-cyclospora-lettuce.html'), 'utf8');
  const meta = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'outbreak-cyclospora-lettuce.meta.json'), 'utf8'));
  const parse = parseCanonicalPage(html, meta.source_url);
  const { event } = buildEventCandidate(parse, {
    sourceKind: 'fda_rss_outbreak',
    canonicalKey: canonicalKeyForPage(meta.source_url),
  });

  assert.ok(event.national_surveillance_context);
  assert.equal(event.national_surveillance_context.outbreak_is_subset_of_national, true);
  assert.equal(event.national_surveillance_context.national_case_count, null);
  assert.ok(event.national_surveillance_context.statements.some((s) => /subset/i.test(s)));
  assert.ok(event.national_surveillance_context.statements.some((s) => /CDC national surveillance/i.test(s)));
  assert.ok(event.national_surveillance_context.statements.some((s) => /probable cases/i.test(s)));
  assert.equal(event.possible_additional_distribution, true);

  // Case states remain outbreak-associated only — never relabeled as national.
  assert.deepEqual([...event.case_states].sort(), ['IN', 'KY', 'MI', 'OH', 'WV']);
  assert.ok(Array.isArray(event.distribution_states));
});

test('does not invent a national case count from subset language alone', () => {
  const ctx = extractNationalSurveillanceContext(
    'The illnesses included in this outbreak are a subset of the Cyclospora illnesses identified nationwide.',
    { organism: 'Cyclospora' },
  );
  assert.equal(ctx.national_case_count, null);
});

test('detects possible additional distribution language', () => {
  assert.equal(
    extractPossibleAdditionalDistribution(
      'Distribution has been confirmed for states listed, but product may have been distributed further, reaching additional states',
    ),
    true,
  );
  assert.equal(
    extractPossibleAdditionalDistribution('Distributed only in California.'),
    false,
  );
});

test('public geography fields keep outbreak cases and distribution separate', () => {
  const row = {
    case_states: ['IN', 'KY', 'MI', 'OH', 'WV'],
    distribution_states: ['IN', 'KY', 'MI', 'OH', 'WV'],
    other_outcomes: {
      national_surveillance_context: {
        outbreak_is_subset_of_national: true,
        pathogen_label: 'Cyclospora',
        statements: ['FDA says these illnesses are a subset of Cyclospora illnesses identified nationwide.'],
        national_case_count: null,
      },
      possible_additional_distribution: true,
    },
  };
  const geo = buildPublicGeographyFields(row);
  assert.deepEqual(geo.outbreak_case_states, row.case_states);
  assert.deepEqual(geo.confirmed_distribution_states, row.distribution_states);
  assert.equal(geo.national_surveillance_context.outbreak_is_subset_of_national, true);
  assert.equal(geo.possible_additional_distribution, true);

  const pub = toPublicEvent({
    id: '00000000-0000-4000-8000-000000000001',
    event_kind: 'outbreak',
    provider: 'fda',
    source_url: 'https://www.fda.gov/food/outbreaks-foodborne-illness/example',
    title: 'Cyclospora outbreak',
    display_title: 'Cyclospora outbreak',
    organism: 'Cyclospora',
    product_name: 'Iceberg Lettuce',
    retailers: ['Taco Bell'],
    illnesses: 1644,
    ...row,
  });
  assert.deepEqual(pub.outbreak_case_states, ['IN', 'KY', 'MI', 'OH', 'WV']);
  assert.deepEqual(pub.confirmed_distribution_states, ['IN', 'KY', 'MI', 'OH', 'WV']);
  assert.equal(pub.national_surveillance_context.national_case_count, null);
});

test('outbreak map notice warns that cases are investigation-linked, not national', () => {
  const notice = buildOutbreakCaseMapNotice({
    organism: 'Cyclospora',
    product_name: 'Iceberg Lettuce',
    retailers: ['Taco Bell'],
    case_states: ['IN', 'KY', 'MI', 'OH', 'WV'],
    national_surveillance_context: {
      outbreak_is_subset_of_national: true,
      pathogen_label: 'Cyclospora',
      statements: [],
      national_case_count: null,
    },
  });
  assert.match(notice, /Cyclospora illnesses have been reported beyond these 5 states/i);
  assert.match(notice, /Taco Bell iceberg-lettuce investigation/i);
  assert.match(notice, /only states reporting cases currently linked/i);
});

test('map notice omitted without national subset context', () => {
  const notice = buildOutbreakCaseMapNotice({
    organism: 'Salmonella',
    case_states: ['CA', 'TX'],
    national_surveillance_context: null,
  });
  assert.equal(notice, '');
});

test('map legend/tab labels use outbreak-specific wording', () => {
  assert.equal(LABELS.mapTabCases, 'Cases linked to this outbreak');
  assert.equal(LABELS.mapTabDistribution, 'Confirmed product distribution');
  assert.equal(LABELS.mapCaptionCases, 'States reporting outbreak-associated cases');
  assert.ok(!/States with cases/.test(LABELS.mapTabCases));
  assert.ok(!/Where it was sold/.test(LABELS.mapTabDistribution));
});

test('story text labels illnesses as linked to investigation; no invented national total', () => {
  const story = buildStoryText({
    event_kind: 'outbreak',
    organism: 'Cyclospora',
    product_name: 'Iceberg Lettuce',
    illnesses: 1644,
    hospitalizations: 94,
    deaths: 0,
    case_states: ['IN', 'KY', 'MI', 'OH', 'WV'],
    distribution_text: 'MI, OH, WV, KY, and IN',
    possible_additional_distribution: true,
    national_surveillance_context: {
      outbreak_is_subset_of_national: true,
      statements: [
        'FDA says these illnesses are a subset of Cyclospora illnesses identified nationwide.',
        'CDC national surveillance includes this outbreak and illnesses not part of it.',
      ],
      national_case_count: null,
    },
  });
  assert.match(story, /1,644 illnesses linked to this investigation/);
  assert.match(story, /outbreak-associated cases/);
  assert.match(story, /Confirmed product distribution/);
  assert.match(story, /distributed beyond the states currently confirmed/);
  assert.match(story, /subset of Cyclospora illnesses identified nationwide/);
  assert.ok(!/national total of/i.test(story));
});
