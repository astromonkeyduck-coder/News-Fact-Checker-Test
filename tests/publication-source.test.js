'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cn = require('../lib/contentNormalize');
const quality = require('../lib/publicationSourceQuality');
const posts = require('../publication/data/posts.json');
const { parseCanonicalPage } = require('../netlify/functions/lib/food-safety/providers/fda/canonicalPage');
const { scopeFilter, classifyHazard, buildDisplayTitle } = require('../netlify/functions/lib/food-safety/classify');
const { validateEventCandidate, decidePublishState } = require('../netlify/functions/lib/food-safety/validate');
const { buildCompactSummary } = require('../netlify/functions/lib/food-safety/publish');
const storeLib = require('../netlify/functions/lib/postStore');
let storage = {};
const mockStore = { async get(key) { if (storage.error) throw storage.error; return storage[key] || null; } };
// Inject only storage acquisition; canonical keys, lookup and handler remain real.
const originalGetStore = storeLib.getPostStore;
storeLib.getPostStore = () => mockStore;
delete require.cache[require.resolve('../netlify/functions/posts-read')];
const { handler, toPublicPost } = require('../netlify/functions/posts-read');
storeLib.getPostStore = originalGetStore;
const request = (params) => handler({httpMethod:'GET',queryStringParameters:params});

test('legacy FDA, USGS and numeric IDs retain exact stable lookup keys', async () => {
  for (const id of ['fda-page-1b6014ef53e61d57','usgs-us7000tgrk','2096717577204502980']) {
    storage = {[`post-${id}.json`]: posts.find(p => p.id === id)};
    for (const form of [id, `post-${id}.json`]) {
      const result = await request({id:form});
      assert.equal(result.statusCode,200);
      assert.equal(JSON.parse(result.body)[0].id,id);
    }
  }
  storage = {'post-eq-legacy.json': {id:'eq-legacy',title:'Legacy earthquake'}};
  assert.equal(JSON.parse((await request({id:'usgs-legacy'})).body)[0].id,'eq-legacy');
});

test('missing record, invalid ID and transient storage failure are distinct', async () => {
  storage = {};
  assert.equal((await request({id:'missing-record'})).statusCode,404);
  assert.equal((await request({id:'../private'})).statusCode,400);
  storage = {error:new Error('private service token diagnostics')};
  for (const params of [{id:'usgs-existing'}, {limit:'200'}]) {
    const result = await request(params);
    assert.equal(result.statusCode,503);
    assert.equal(result.headers['Cache-Control'],'no-store');
    assert.doesNotMatch(result.body,/private service token/);
  }
});

test('complete lead headline is recovered from matching original body; no guessed endings', () => {
  const lead = posts.find(p => p.id === '2096717577204502980');
  assert.equal(cn.cleanHeadline(lead),'UPDATE: 5 people dead, multiple others injured after Amazon cargo plane crash at Miami International Airport, the sheriff’s office says.');
  const long = 'A complete original headline '.repeat(12).trim();
  assert.equal(cn.cleanHeadline({title:long}),long);
  assert.equal(cn.cleanHeadline({title:'A truncated statement that remains…',text:'Entirely different body text.'}),'A truncated statement that remains…');
  assert.match(cn.cleanHeadline({title:long},{maxLength:80}),/…$/);
});

test('known bad FDA imports preserve inbound notices and cannot enter the feed', async () => {
  const ids = ['fda-page-1b6014ef53e61d57','fda-page-be0db24ddef68063'];
  storage = {'index.json':{ids}};
  for (const id of ids) storage[`post-${id}.json`] = posts.find(p => p.id === id);
  assert.deepEqual(JSON.parse((await request({limit:'200'})).body),[]);
  for (const id of ids) {
    const out = JSON.parse((await request({id})).body)[0];
    assert.equal(out.editorial_status,'review');
    assert.equal(out.review_required,true);
    assert.match(out.title,/review notice/);
    assert.equal(out.food_safety_summary,undefined);
    assert.equal(out.assets,undefined);
    assert.doesNotMatch(out.story,/outbreak linked to|contamination \(lead\)/);
  }
});

test('unpublished draft/review records are private and lead evidence is transparent', async () => {
  for (const state of ['draft','review','suppressed']) {
    storage = {'index.json':{ids:['private']},'post-private.json':{id:'private',title:'Private',editorial_state:state}};
    assert.equal((await request({id:'private'})).statusCode,404);
    assert.deepEqual(JSON.parse((await request({})).body),[]);
  }
  const lead = quality.publicationPost(posts.find(p => p.id === '2096717577204502980'));
  assert.match(lead.source_references[0].url,/local10.com/);
  assert.match(lead.source_references[0].claim,/attributed/);
  assert.equal(lead.datePosted,'2026-09-06T21:50:00.000Z');
});

test('research page cannot manufacture a product from a Spanish webinar link', () => {
  const url = posts.find(p => p.id === 'fda-page-1b6014ef53e61d57').source_url;
  const parsed = parseCanonicalPage('<h1>Cyclospora Prevention, Response and Research Action Plan</h1><p>Outbreak research. <a>Actualización en investigación y metodología para Cyclospora — YouTube</a></p>',url);
  assert.equal(parsed.layout,'unknown');
  assert.equal(parsed.productDescription,null);
  assert.deepEqual(parsed.products,[]);
  assert.equal(parsed.metrics,null);
  assert.equal(scopeFilter({title:parsed.title,url}).include,false);
});

test('contradictory FDA Food & Beverages label queues epinephrine for review', () => {
  const decision = scopeFilter({title:'Epinephrine Injection recalled',productDescription:'Epinephrine Injection, USP 30 mg/30 mL',productType:'Food & Beverages'});
  assert.equal(decision.needsReview,true);
  const validation = validateEventCandidate({canonical_key:'fda:page:example',event_kind:'recall',title:'FDA epinephrine notice',source_url:'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/example',product_name:'Epinephrine Injection',hazard_category:'other',fda_publish_date:'2026-09-03',public_action:'Consult the original notice'}, {parseWarnings:[decision.reason]});
  assert.equal(validation.valid,true);
  assert.ok(validation.reviewReasons.includes('conflicting_product_type_non_food_identity'));
  assert.equal(decidePublishState({}, {reviewReasons:validation.reviewReasons,previousPublishState:'published'}).publishState,'review');
});

test('lead to health consequences does not mean lead contamination; absent counts stay null', () => {
  assert.equal(classifyHazard('Particulate matter may lead to serious health consequences.').hazardCategory,null);
  assert.equal(classifyHazard('Elevated levels of lead in the product').hazardCategory,'chemical');
  const summary = buildCompactSummary({illnesses:null,hospitalizations:null,deaths:null});
  assert.equal(summary.illnesses,null);
  assert.equal(summary.metric_summary,null);
  assert.equal(buildCompactSummary({illnesses:0,hospitalizations:null,deaths:null}).illnesses,0);
  const product='A long complete product description with several packages and variants '.repeat(3).trim();
  assert.ok(buildDisplayTitle({event_kind:'recall',product_name:product}).includes(product));
});


test('legacy article no-image fallback renders FDA and USGS records without a TDZ error', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/components/article-loader.js'), 'utf8');
  const loadStart = source.indexOf('async function loadArticle()');
  const start = source.indexOf("            const story = post.story || post.text || post.title || '';", loadStart);
  const end = source.indexOf('            // Update SEO meta tags', start);
  assert.ok(start > loadStart && end > start, 'original image fallback remains locatable');
  const resolve = new Function('post', 'title', 'SITE_URL', source.slice(start, end) + '\nreturn {image, category};');
  for (const id of ['fda-page-1b6014ef53e61d57', 'usgs-us7000tgrk']) {
    const post = posts.find(p => p.id === id);
    const resolved = resolve(post, post.title, 'https://noteworthynews.co');
    assert.equal(resolved.category, post.category);
    assert.equal(resolved.image, null);
  }
});


test('legacy FDA product headlines recover only complete matching source fields', () => {
  for (const id of ['fda-page-cd1b6dccc4a07ef1','fda-page-9259fb0b4d1debf7','fda-page-989e7b6b1eb31b56','fda-page-a3da9efd0da23e07','fda-page-b53d24e972945220']) {
    const post = posts.find(p => p.id === id);
    const title = quality.publicationPost(post).title;
    assert.doesNotMatch(title,/…/);
    assert.ok(title.toLowerCase().includes(post.food_safety_summary.product.toLowerCase()));
  }
  assert.equal(quality.publicationPost(posts.find(p => p.id === 'fda-page-d51a22246d293688')).title,'Clover Hill Dairy Expands Recall to Include All Clover Hill Dairy Brand Cheese Due to Possible Health Risk');
  assert.equal(cn.cleanHeadline({title:'An unrelated product… recalled',food_safety_summary:{product:'A different product'}}),'An unrelated product… recalled');
});


test('truncated trailing URL fragments recover the original complete social headline', () => {
  for (const id of ['2085172871773495417','2082242568717209631','2081564517662671072','2074984651714629961']) {
    const post = posts.find(p => p.id === id);
    assert.equal(cn.cleanHeadline(post),cn.normalizeSocialPostText(post.story).split('\n')[0]);
    assert.doesNotMatch(cn.cleanHeadline(post),/…/);
  }
});
