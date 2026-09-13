'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../../publication/model');
const R = require('../../publication/render');
const D = require('../../publication/data');
const { toPublicPost } = require('../../netlify/functions/posts-read');
const { handler: articleHandler } = require('../../netlify/functions/article-preview');
const snapshot = require('../../publication/data/posts.json');
const quality = require('../../lib/publicationSourceQuality');

// Real records exercise API projection followed by the browser/SSR projection.
test('source review notices survive API-to-model projection without resurrecting claims', () => {
  for (const original of snapshot.filter(p => quality.reviewReason(p))) {
    const once = toPublicPost(original);
    const twice = M.normalize(once);
    assert.equal(twice.id, original.id);
    assert.equal(twice.review_required, true);
    assert.equal(twice.editorial_status, 'review');
    assert.equal(twice.food_safety_summary, undefined);
    assert.equal(twice.assets, undefined);
    assert.equal(twice.body, once.story);
    assert.equal(M.prepare([once]).length, 0);
    assert.match(R.article(once), /Editorial review notice/);
  }
});

test('own X status URL remains distribution while credited upstream reporting is evidence', () => {
  const original = snapshot.find(p => p.id === '2096717577204502980');
  const post = M.normalize(toPublicPost(original));
  const distribution = post.references.find(s => s.url === original.x_url);
  assert.equal(distribution.distribution, true, 'the real x.com/i/status URL must be original distribution');
  assert.equal(post.references.filter(s => /local10\.com/.test(s.url)).length, 1, 'projection must be idempotent');
  assert.equal(post.references.find(s => /local10\.com/.test(s.url)).distribution, false);
  assert.match(R.article(toPublicPost(original)), /Original distribution/);
});

test('explicit editorial source kind survives publication', () => {
  const post = D.fromEditorial({id:'source-kind-test',title:'Attribution test',state:'published',body:[],sources:[{id:'social',name:'Original distribution',kind:'distribution',url:'https://x.com/newsnoteworthy/status/123'}]});
  assert.equal(M.normalize(post).references[0].distribution, true);
});

test('FDA fact box uses the real event_kind and illnesses fields', () => {
  const original = snapshot.find(p => !quality.reviewReason(p) && p.food_safety_summary?.illnesses > 0);
  assert.ok(original, 'snapshot includes an agency record with reported cases');
  const html = R.article(toPublicPost(original));
  assert.ok(html.includes(`<dt>Illness count</dt><dd>${original.food_safety_summary.illnesses}</dd>`), 'known illnesses must not display Not reported');
  assert.ok(html.includes(`<dt>Event type</dt><dd>${original.food_safety_summary.event_kind}</dd>`));
});

test('official earthquake depth survives the public model', () => {
  const original = snapshot.find(p => p.id === 'usgs-us7000tgrk');
  assert.equal(M.normalize(toPublicPost(original)).depth, original.assets.depth);
  assert.match(R.article(toPublicPost(original)), /358\.597 km/);
});

test('published sourcing limitations remain visible to readers', () => {
  const limitation = 'No independent supporting documentation was available for this update.';
  const raw = D.fromEditorial({id:'limitation-test',title:'Source limitation test',state:'published',format:'wire-update',body:[{text:'An attributed update.',sourceIds:[]}],sources:[],sourcingLimitation:limitation});
  assert.ok(R.article(raw).includes(limitation), 'do not discard the editorial sourcing limitation at render time');
});

test('article endpoint never serves a draft accidentally placed in the local export', async () => {
  const draft = {id:'audit-private-draft',title:'PRIVATE DRAFT SENTINEL',state:'draft',format:'reporting',body:[{text:'Private unpublished details',sourceIds:[]}],sources:[]};
  D.editorial.articles.push(draft);
  try {
    const result = await articleHandler({httpMethod:'GET',queryStringParameters:{id:draft.id}});
    assert.equal(result.statusCode,404);
    assert.doesNotMatch(result.body,/PRIVATE DRAFT SENTINEL|Private unpublished details/);
  } finally {
    D.editorial.articles.splice(D.editorial.articles.indexOf(draft),1);
  }
});

test('unpublished records cannot hide in serialized homepage hydration data', () => {
  const html = R.home([{id:'private-hydration',title:'PRIVATE HYDRATION SENTINEL',story:'Private body',editorial_status:'draft'}]);
  assert.doesNotMatch(html,/PRIVATE HYDRATION SENTINEL|Private body/);
});
