'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const R = require('../../publication/render');
const I = require('../../publication/inside-story/render');
const M = require('../../publication/inside-story/model');
const raw = require('../../publication/inside-story/data/java-sea-2026.json');
const root = path.resolve(__dirname, '../..');
const esc = R.esc;
const bodyWithoutData = html => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
const section = (html, start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
const page = () => R.page({ title: I.title, description: I.description, canonical: I.route, insideStory: true, content: I.content() });

// Load the real renderer with an isolated data fixture; never mutate the shared
// require cache or the source files while other publication work is running.
function rendererFor(data) {
  const filename = path.join(root, 'publication/inside-story/render.js');
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports, URL, console,
    require(specifier) {
      if (specifier === './data/java-sea-2026.json') return data;
      return require(path.resolve(path.dirname(filename), specifier));
    },
  }, { filename, timeout: 5000 });
  return module.exports;
}

test('the complete source history preserves real issue times and version-specific links without JavaScript', () => {
  const html = bodyWithoutData(I.content());
  const history = section(html, '<ol class="inside-evidence-history">', 'id="inside-methodology"');
  assert.equal((history.match(/<li\b/g) || []).length, raw.evidence.length);
  let previous = -1;
  for (const entry of raw.evidence) {
    const source = raw.sources.find(source => source.id === entry.sourceId);
    const position = history.indexOf(esc(entry.label));
    assert.ok(position > previous, `${entry.id} history is not in source issue order`);
    previous = position;
    assert.ok(history.includes(esc(entry.text)));
    assert.ok(history.includes(`<time datetime="${new Date(entry.time).toISOString()}">`));
    assert.ok(history.includes(`href="${esc(source.url)}"`));
  }
  assert.match(html, /dated agency versions, not a reconstruction of the newsroom/);
  assert.match(html, /earliest retained version is not necessarily the first public alert/i);
  assert.ok(html.includes(encodeURIComponent('https://noteworthynews.co' + I.route)));
});

test('the published comparison uses the retained origin values rather than the occurrence-time catalogue', () => {
  const html = bodyWithoutData(I.content());
  const comparison = section(html, '<figure class="inside-comparison">', '</figure>');
  const before = raw.evidence.find(entry => entry.id === 'origin-earlier');
  const after = raw.evidence.find(entry => entry.id === 'origin-current');
  for (const [label, key] of [['Magnitude', 'magnitude'], ['Depth, km', 'depthKm'], ['Stations used for location', 'originStations']]) {
    assert.ok(comparison.includes(`<th scope="row">${label}</th><td>${before[key]}</td><td>${after[key]}</td>`));
  }
  assert.match(comparison, /reviewed status and a preliminary evaluation status/);
  for (const entry of [before, after]) {
    const source = raw.sources.find(source => source.id === entry.sourceId);
    assert.ok(comparison.includes(`href="${esc(source.url)}"`));
  }
  assert.match(html, /not mean the earthquake itself happened again/);
});

test('static account states the limits of the real grid and bounded catalogue', () => {
  const html = bodyWithoutData(I.content());
  const prose = section(html, '<div class="inside-story-body">', 'class="inside-end"');
  assert.match(section(html, 'class="inside-event-stamp"', '</span>'), /UTC/);
  assert.ok(prose.includes(`MMI ${raw.shaking.grid.minimum}–${raw.shaking.grid.maximum}`));
  assert.match(prose, /not a claim about the maximum shaking everywhere/);
  assert.match(prose, /estimates, not individual sensor readings or reports of damage/);
  assert.match(prose, /not evidence of no shaking/);
  assert.match(prose, /does not assign them to an aftershock sequence/);
  assert.match(prose, /not automatically refreshed/);
  assert.ok(prose.includes(`Minimum magnitude ${raw.catalogue.minimumMagnitude}`));
  for (const time of [raw.catalogue.startTime, raw.catalogue.endTime]) assert.ok(prose.includes(esc(M.formatTime(time))));
  for (const source of raw.sources) {
    assert.ok(prose.includes(`href="${esc(source.url)}"`));
    assert.ok(prose.includes(`<time datetime="${new Date(source.retrievedAt).toISOString()}">`));
  }
  assert.match(prose, /Individual editor review is pending/);
});

test('ordinary catalogue links remain readable when JavaScript is enabled but the enhancement fails', () => {
  // <noscript> does not activate on a network or initialization error. A reader
  // must still be able to open the records after hidden controls stay hidden.
  const html = bodyWithoutData(I.content()).replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/g, '');
  const list = section(html, '<ol class="inside-event-list">', '</ol>');
  for (const event of raw.events) {
    assert.ok(list.includes(`href="${esc(event.url)}"`), `${event.id} needs an ordinary fallback source link`);
    assert.ok(list.includes(esc(event.place)));
    assert.ok(list.includes(esc(M.formatTime(event.time))));
  }
});

test('native controls start hidden, have labels and expose an equivalent map description', () => {
  const html = page();
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'duplicate IDs can break labels or source links');
  for (const [, id] of html.matchAll(/<label\b[^>]*for="([^"]+)"/g)) assert.ok(ids.includes(id), `missing labeled control ${id}`);
  for (const [, id] of html.matchAll(/aria-describedby="([^"]+)"/g)) assert.ok(ids.includes(id), `missing description ${id}`);
  for (const [tag] of html.matchAll(/<[a-z][^>]*\sdata-inside-controls(?:\s|>)[^>]*>/g)) assert.match(tag, /\shidden(?:\s|>)/);
  for (const chapter of M.CHAPTERS) {
    assert.match(html, new RegExp(`<button[^>]+type="button"[^>]+data-inside-chapter="${chapter}"[^>]+aria-pressed="(?:true|false)"`));
  }
  assert.match(html, /role="img" aria-labelledby="inside-map-title inside-map-description"/);
  assert.match(html, /Previous recorded earthquake/);
  assert.match(html, /Next recorded earthquake/);
  assert.match(html, /data-inside-status[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /does not reconstruct what was known or published at each moment/);
});

test('source strings and embedded JSON cannot introduce active HTML', () => {
  const data = structuredClone(raw);
  const attack = '</script><img src=x onerror="attack()"> & <untrusted>';
  data.event.place = attack;
  data.events[0].place = attack;
  data.evidence[0].label = attack;
  data.evidence[0].text = attack;
  data.sources[1].title = attack;
  data.sources[1].description = attack;
  data.sources[1].url = 'https://example.com/source?quote="quoted"&other=2';
  data.catalogue.description = attack;
  const html = rendererFor(data).content();
  assert.doesNotMatch(html, /<img src=x|<untrusted>|<script>attack/);
  assert.ok(html.includes(esc(attack)));
  assert.ok(html.includes(`href="${esc(new URL(data.sources[1].url).href)}"`));
  const embedded = html.match(/<script type="application\/json" id="inside-story-data">([\s\S]*?)<\/script>/);
  assert.ok(embedded);
  assert.doesNotMatch(embedded[1], /</);
  assert.equal(JSON.parse(embedded[1]).event.place, attack);
});

test('missing dated origins fail the build or remove the unsupported revision comparison', () => {
  const data = structuredClone(raw);
  data.sources = data.sources.filter(source => !source.id.startsWith('origin-'));
  data.evidence = data.evidence.filter(entry => !entry.id.startsWith('origin-'));
  let html;
  try { html = rendererFor(data).content(); }
  catch (error) { assert.match(String(error), /source|origin|evidence|valid|required/i); return; }
  const visible = bodyWithoutData(html);
  assert.doesNotMatch(visible, /USGS revised its estimate from magnitude 6\.6 to 6\.5|earlier preserved origin solution reports magnitude 6\.6/i);
  assert.match(visible, /earlier source version.*(?:unavailable|not.*preserved)|source history.*unavailable/i);
});

test('an unavailable shaking grid cannot leave an advertised rendered shaking layer', () => {
  const data = structuredClone(raw);
  data.shaking.geojson = { type: 'FeatureCollection', features: [] };
  let html;
  try { html = rendererFor(data).content(); }
  catch (error) { assert.match(String(error), /source|shaking|grid|valid|required/i); return; }
  const visible = bodyWithoutData(html);
  assert.match(visible, /shaking (?:overlay|grid|map).*unavailable/i);
  assert.doesNotMatch(visible, /The shaded cells show agency estimates/);
});

test('the feature asset bundle is scoped to its route and carries the canonical preview contract', () => {
  const html = page();
  for (const asset of ['model.js', 'client.js']) assert.equal((html.match(new RegExp(`src="/publication/inside-story/${asset.replace('.', '\\.')}" defer`, 'g')) || []).length, 1);
  assert.ok(html.indexOf('/publication/inside-story/model.js') < html.indexOf('/publication/inside-story/client.js'));
  assert.match(html, /href="\/publication\/inside-story\/inside-story.css"/);
  assert.ok(html.includes(`<link rel="canonical" href="https://noteworthynews.co${I.route}">`));
  assert.ok(html.includes(`<meta property="og:url" content="https://noteworthynews.co${I.route}">`));
  const ordinary = R.page({ title: 'Ordinary article', description: 'Context', content: '<p>Reporting</p>' });
  assert.doesNotMatch(ordinary, /(?:src|href)="\/publication\/inside-story\//);
  const preview = R.page({ title: I.title, description: I.description, canonical: I.route, insideStory: true, preview: true, content: I.content() });
  assert.match(preview, /content="noindex, nofollow"/);
  assert.match(preview, /data-preview="true"/);
});

test('homepage and article feature links point to the reviewed event without carrying the interactive payload', () => {
  const feature = I.feature();
  assert.ok(feature.includes(`href="${I.route}"`));
  assert.match(feature, /Source archive/);
  assert.match(section(feature, 'class="inside-feature-date"', '</span>'), /UTC/);
  assert.doesNotMatch(feature, /<script\b|data-inside-controls|data-inside-story(?:\s|>)/);
  const context = I.articleContext(raw.articleId);
  assert.ok(context.includes(`href="${I.route}"`));
  assert.match(context, /earlier M6\.6 estimate and a later M6\.5 solution/);
  assert.match(context, /retains its publication time and source values/);
  assert.equal(I.articleContext('some-other-earthquake'), '');
  const D = require('../../publication/data');
  const posts = D.merge(require('../../publication/data/posts.json'));
  const original = posts.find(post => post.id === raw.articleId);
  assert.ok(original);
  const home = R.home(posts);
  const article = R.article(original, posts);
  for (const html of [home, article]) {
    assert.ok(html.includes(`href="${I.route}"`));
    assert.doesNotMatch(html, /src="\/publication\/inside-story\/(?:model|client)\.js"|id="inside-story-data"/);
  }
  assert.ok(article.includes(esc(original.title)));
  assert.ok(article.includes(`<time datetime="${new Date(original.datePosted).toISOString()}">`));
  assert.ok(article.indexOf('A later USGS estimate is available') < article.indexOf('id="article-heading"'));
});

test('the real static build publishes the canonical reconstruction and its sitemap entry', () => {
  const virtualRoot = '/tmp/noteworthy-inside-story-build-test';
  const writes = new Map();
  vm.runInNewContext(fs.readFileSync(path.join(root, 'scripts/build-publication.js'), 'utf8'), {
    __dirname: path.join(virtualRoot, 'scripts'), console: { log() {} },
    require(specifier) {
      if (specifier === 'node:fs') return { writeFileSync(file, content) { writes.set(file, String(content)); }, mkdirSync() {} };
      if (specifier === './publication-shared-pages') return { buildSharedPages() {} };
      return require(specifier.startsWith('.') ? path.resolve(root, 'scripts', specifier) : specifier);
    },
  }, { timeout: 5000 });
  const html = writes.get(path.join(virtualRoot, I.route, 'index.html'));
  assert.ok(html, 'the reconstruction must exist as a static HTML page');
  assert.ok(html.includes(`<link rel="canonical" href="https://noteworthynews.co${I.route}">`));
  assert.match(html, /data-inside-story/);
  for (const entry of raw.evidence) assert.ok(bodyWithoutData(html).includes(esc(entry.text)));
  assert.ok(writes.get(path.join(virtualRoot, 'publication-sitemap.xml')).includes(`https://noteworthynews.co${I.route}`));
  assert.ok([...writes.keys()].every(file => file.startsWith(virtualRoot + '/')));
});

test('preview serves canonical reconstruction aliases with noindex and rejects missing stories', async () => {
  let handler;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'scripts/preview-publication.js'), 'utf8'), {
    __dirname: path.join(root, 'scripts'), URL, process: { env: {} }, console: { log() {} },
    require(specifier) {
      if (specifier === 'node:http') return { createServer(callback) { handler = callback; return { listen() {} }; } };
      return require(specifier.startsWith('.') ? path.resolve(root, 'scripts', specifier) : specifier);
    },
  }, { timeout: 5000 });
  async function request(url) {
    let status, headers, body;
    await handler({ method: 'GET', url }, { writeHead(code, values) { status = code; headers = values; }, end(content) { body = content; } });
    return { status, headers, body };
  }
  for (const route of [I.route, I.route + 'index.html', I.route.slice(0, -1), I.route + '?insideChapter=evidence&insideEvidence=origin-earlier']) {
    const response = await request(route);
    assert.equal(response.status, 200, route);
    assert.match(response.headers['X-Robots-Tag'], /noindex/);
    assert.match(response.body, /data-preview="true"/);
    assert.ok(response.body.includes(`<link rel="canonical" href="https://noteworthynews.co${I.route}">`));
    assert.ok(bodyWithoutData(response.body).includes(esc(raw.evidence[0].text)));
  }
  assert.equal((await request('/inside-the-story/missing-earthquake/')).status, 404);
  assert.equal((await request('/inside-the-story/%22bad/')).status, 404);
});
