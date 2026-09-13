'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../../publication/data/story-guides.json');
const snapshot = require('../../publication/data/posts.json');
const quality = require('../../lib/publicationSourceQuality');
const byId = new Map(snapshot.map(post => [String(post.id), post]));

const expectedGroups = {
  'miami-cargo-plane-crash-september-2026': ['2096684114694856768', '2096717577204502980'],
  'uw-whitewater-alert-september-2026': ['2095187297503183302', '2095190238230372510'],
  'clover-hill-cheese-recall-2026': ['fda-page-d51a22246d293688', 'fda-core-1380'],
};

test('curated story guides preserve exact real article IDs and chronology', () => {
  assert.equal(catalog.version, 1);
  assert.equal(catalog.guides.length, 3);
  assert.equal(new Set(catalog.guides.map(guide => guide.slug)).size, catalog.guides.length);
  for (const guide of catalog.guides) {
    assert.match(guide.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.deepEqual(guide.articleIds, expectedGroups[guide.slug]);
    assert.deepEqual(guide.timeline.map(entry => entry.articleId), guide.articleIds);
    let previous = -Infinity;
    for (const id of guide.articleIds) {
      assert.equal(typeof id, 'string');
      const post = byId.get(id);
      assert.ok(post, `missing original article ${id}`);
      assert.equal(quality.reviewReason(post), null, 'ambiguous imports cannot become story-guide evidence');
      const published = Date.parse(post.datePosted);
      assert.ok(published >= previous, 'chronology preserves publication order');
      previous = published;
    }
  }
});

test('every known claim cites listed supporting evidence rather than own distribution', () => {
  for (const guide of catalog.guides) {
    assert.ok(guide.title && guide.intro && guide.sourcingNote);
    assert.ok(guide.known.length >= 2 && guide.unknown.length >= 1);
    assert.equal(new Set(guide.sources.map(source => source.url)).size, guide.sources.length);
    for (const source of guide.sources) {
      const url = new URL(source.url);
      assert.equal(url.protocol, 'https:');
      assert.ok(source.label);
      assert.ok(['primary', 'credited-reporting', 'distribution'].includes(source.kind));
      if (/(?:^|\.)x\.com$/.test(url.hostname)) assert.equal(source.kind, 'distribution');
    }
    for (const claim of guide.known) {
      assert.ok(claim.text && claim.label);
      const source = guide.sources.find(source => source.url === claim.sourceUrl);
      assert.ok(source, `unlisted claim source: ${claim.sourceUrl}`);
      assert.notEqual(source.kind, 'distribution', 'own X posts are not independent evidence');
      assert.doesNotMatch(claim.text, /<[^>]+>|\bwe confirmed\b/i);
    }
    for (const uncertainty of guide.unknown) assert.ok(uncertainty.text);
  }
});

test('guide dates use latest source evidence and never invented midnight or build timestamps', () => {
  assert.match(catalog.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
  for (const guide of catalog.guides) {
    assert.equal(guide.updatedAtPrecision, 'date');
    assert.match(guide.updatedAt, /^\d{4}-\d{2}-\d{2}$/);
    const days = guide.sources.flatMap(source => [source.publishedAt, source.updatedAt].filter(Boolean).map(value => value.slice(0, 10)));
    days.push(...guide.articleIds.flatMap(id => {const p = byId.get(id); return [p.datePosted,p.updated_at].filter(Boolean).map(value => value.slice(0,10));}));
    assert.equal(guide.updatedAt, days.sort().at(-1));
    assert.ok(guide.updatedAt < catalog.reviewedAt, 'historical source dates must not become a fresh build date');
  }
});

test('event outcomes are attributed and the safety guide preserves ended status and final counts', () => {
  const campus = catalog.guides.find(guide => guide.slug.startsWith('uw-whitewater'));
  assert.ok(campus.known.some(claim => claim.sourceUrl === 'https://announcements.uww.edu/Announcement/Details/18939' && /no weapon/.test(claim.text)));
  assert.match(campus.intro, /all-clear/);
  assert.match(campus.sourcingNote, /does not establish that an armed attack occurred/);
  const miami = catalog.guides.find(guide => guide.slug.startsWith('miami-'));
  assert.ok(miami.known.some(claim => /WPLG Local 10 reported/.test(claim.text)));
  assert.ok(miami.unknown.some(item => /does not establish a final probable cause/.test(item.text)));
  const safety = catalog.guides.find(guide => guide.slug.startsWith('clover-'));
  const finalRecord = byId.get('fda-core-1380').food_safety_summary;
  assert.equal(finalRecord.status, 'ended');
  assert.match(safety.intro, /FDA marks it ended/);
  const totals = safety.known.find(claim => /hospitalizations/.test(claim.text));
  assert.ok(totals);
  assert.match(totals.text, new RegExp(`${finalRecord.illnesses} illnesses`));
  assert.match(totals.text, new RegExp(`${finalRecord.hospitalizations} hospitalizations`));
  assert.equal(finalRecord.deaths, 1);
  assert.match(totals.text, /one death/);
  assert.match(safety.sourcingNote, /No counts from different updates have been added together/);
});

test('What changed identifies a substantive dated development and supporting document', () => {
  for (const guide of catalog.guides) {
    assert.ok(guide.change.title && guide.change.text && guide.change.label);
    const source = guide.sources.find(source => source.url === guide.change.sourceUrl);
    assert.ok(source, 'change must cite an existing reviewed source');
    assert.notEqual(source.kind, 'distribution');
    assert.doesNotMatch(guide.change.text, /new scrape|just fetched|updated today|verified today/i);
  }
  const changes = Object.fromEntries(catalog.guides.map(guide => [guide.slug, guide.change.text]));
  assert.match(changes['miami-cargo-plane-crash-september-2026'], /September 9.*preliminary.*recorders/);
  assert.match(changes['uw-whitewater-alert-september-2026'], /no weapon.*no threat/);
  assert.match(changes['clover-hill-cheese-recall-2026'], /August 26.*investigation complete/);
});
