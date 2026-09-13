'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const G = require('../../publication/story-guides');
const R = require('../../publication/render');
const D = require('../../publication/data');
const M = require('../../publication/model');
const snapshot = require('../../publication/data/posts.json');
const raw = D.merge(snapshot);
const root = path.resolve(__dirname, '../..');
const htmlFor = guide => R.page({ title: guide.title, description: guide.intro, canonical: G.href(guide), active: 'briefs', readingControls: true, content: G.detailContent(guide, raw) });
const renderedSection = (html, start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));

test('source calendar dates keep their exact day and do not acquire a fabricated midnight', () => {
  assert.equal(G.date('2026-09-06'), 'Sep 6, 2026');
  assert.equal(G.date('2024-02-29'), 'Feb 29, 2024');
  assert.match(G.date('2026-09-06T00:00:00.000Z'), /Sep 5, 2026.*8:00 PM EDT/);
  for (const guide of G.guides) {
    const html = htmlFor(guide);
    for (const source of guide.sources.filter(s => s.kind !== 'distribution')) {
      const day = source.updatedAt || source.publishedAt;
      if (/^\d{4}-\d{2}-\d{2}$/.test(day)) assert.ok(html.includes(`<time datetime="${day}">${G.date(day)}</time>`), `${guide.slug} changed a source calendar date`);
    }
    assert.ok(html.includes(`Sources through <time datetime="${guide.updatedAt}">${G.date(guide.updatedAt)}</time>`));
  }
});

test('guide timelines preserve original article publication timestamps and distinguish source updates', () => {
  for (const guide of G.guides) {
    const html = htmlFor(guide);
    const timeline = renderedSection(html, 'id="coverage-timeline"', 'id="source-documents"');
    const expected = guide.timeline.map(item => snapshot.find(post => String(post.id) === item.articleId)).sort((a, b) => Date.parse(a.datePosted) - Date.parse(b.datePosted));
    const renderedDates = [...timeline.matchAll(/<time datetime="([^"]+)">/g)].map(match => match[1]);
    assert.deepEqual(renderedDates, expected.map(post => post.datePosted));
    assert.match(timeline, /Noteworthy publication times, not the times the events occurred/);
    for (const post of expected) assert.ok(timeline.includes(`/article.html?id=${encodeURIComponent(post.id)}`));
  }
  const guide = G.bySlug('clover-hill-cheese-recall-2026');
  const html = htmlFor(guide);
  assert.match(html, /published June 29; source updated August 26/);
  assert.equal(M.normalize(snapshot.find(p => p.id === 'fda-core-1380')).published, snapshot.find(p => p.id === 'fda-core-1380').datePosted);
});

test('current outcome and evidence precede the preserved early-alarm chronology', () => {
  for (const slug of ['uw-whitewater-alert-september-2026', 'clover-hill-cheese-recall-2026']) {
    const guide = G.bySlug(slug), html = htmlFor(guide);
    const change = renderedSection(html, 'id="what-changed"', 'id="what-we-know"');
    assert.ok(html.indexOf('id="what-changed"') < html.indexOf('id="coverage-timeline"'));
    assert.ok(change.includes(R.esc(guide.change.text)));
    assert.ok(change.includes(R.esc(guide.change.sourceUrl)));
    assert.match(change, slug.startsWith('uw-') ? /no threat|all-clear/ : /investigation complete|ended/);
    assert.match(html, /Earlier updates may have been superseded/);
  }
});

test('known claims, sources, timeline links and correction route are available without JavaScript', () => {
  for (const guide of G.guides) {
    const html = htmlFor(guide).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    assert.ok(html.includes(R.esc(guide.title)));
    for (const claim of guide.known) {
      assert.ok(html.includes(R.esc(claim.text)));
      assert.ok(html.includes(`href="${R.esc(claim.sourceUrl)}"`));
    }
    assert.match(html, /All coverage and sources are available above/);
    if (guide.sources.some(source => source.kind === 'distribution')) assert.match(html, /not independent corroboration/);
    assert.ok(html.includes(encodeURIComponent('https://noteworthynews.co' + G.href(guide))));
  }
});

test('briefing jump navigation has unique real targets and optional controls start hidden', () => {
  for (const guide of G.guides) {
    const html = htmlFor(guide);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${guide.slug} has duplicate IDs`);
    for (const [, target] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(target), `Missing #${target}`);
    for (const action of ['remember', 'acknowledge', 'forget']) {
      const button = html.match(new RegExp(`<button\\b[^>]*data-reading-action="${action}"[^>]*>`));
      assert.ok(button, `missing ${action}`);
      assert.match(button[0], /\shidden(?:\s|>)/);
    }
    assert.match(html, /data-reading-message[^>]*role="status"[^>]*aria-live="polite"/);
  }
});

test('briefing strings and supporting URLs cannot introduce active HTML', () => {
  const guide = structuredClone(G.guides[0]);
  guide.title = '<img src=x onerror="attack()">';
  guide.intro = '<script>attack()</script>';
  guide.change.text = 'A source says "quoted" & <untrusted>';
  guide.known[0] = { text: '<svg onload=attack()>', sourceUrl: 'javascript:attack()', label: 'Unsafe source' };
  guide.known[1] = { text: 'Supported statement', sourceUrl: 'https://example.com/report?a="quoted"&b=2', label: '<img src=x onerror=attack()>' };
  const html = htmlFor(guide);
  assert.doesNotMatch(html, /<img src=x|<svg onload|<script>attack|href="javascript:/);
  assert.match(html, /&lt;script&gt;attack\(\)&lt;\/script&gt;/);
  assert.ok(html.includes('href="https://example.com/report?a=&quot;quoted&quot;&amp;b=2"'));
  assert.ok(html.includes(R.esc(guide.change.text)));
});

test('invalid briefing slugs fail closed before becoming HTML attributes or output paths', () => {
  for (const slug of ['x" onclick="attack()', '../escape', 'a/b', '/absolute', 'a\\b', 'UPPER', '', 'a'.repeat(101), null]) {
    assert.throws(() => G.href({ slug }), /Invalid.*slug/);
  }
  assert.throws(() => G.href(null), /Invalid.*slug/);
  for (const guide of G.guides) assert.equal(G.href(guide), `/story-so-far/${guide.slug}/`);
});

test('article and homepage crosslinks use existing guides without loading reading-state JavaScript', () => {
  const home = R.home(raw);
  for (const guide of G.guides) {
    assert.ok(home.includes(`href="${G.href(guide)}"`));
    for (const id of guide.articleIds) {
      const post = raw.find(p => String(p.id) === id);
      const article = R.article(post, raw);
      assert.ok(article.includes(`href="${G.href(guide)}"`));
      assert.ok(article.indexOf('class="story-context"') < article.indexOf('id="article-heading"'));
      assert.doesNotMatch(article, /src="\/publication\/reading-(?:state|controls)\.js"/);
    }
  }
  assert.doesNotMatch(home, /src="\/publication\/reading-(?:state|controls)\.js"/);
  assert.equal(G.articleContext('no-guide-for-this-article'), '');
  assert.equal(G.leadLink('no-guide-for-this-article'), '');
});

test('the real build generates each canonical guide and index within the publish root', () => {
  // Execute the real build with in-memory output, so this regression cannot
  // mutate developer files or publication records while another task builds.
  const virtualRoot = '/tmp/noteworthy-brief-build-test';
  const writes = new Map();
  const fakeFs = { writeFileSync(file, content) { writes.set(file, String(content)); }, mkdirSync() {} };
  const script = fs.readFileSync(path.join(root, 'scripts/build-publication.js'), 'utf8');
  vm.runInNewContext(script, {
    __dirname: path.join(virtualRoot, 'scripts'), console: { log() {} },
    require(specifier) {
      if (specifier === 'node:fs') return fakeFs;
      if (specifier === './publication-shared-pages') return { buildSharedPages() {} };
      return require(specifier.startsWith('.') ? path.resolve(root, 'scripts', specifier) : specifier);
    }
  }, { timeout: 5000 });
  for (const guide of [null, ...G.guides]) {
    const route = guide ? G.href(guide) : '/story-so-far/';
    const html = writes.get(path.join(virtualRoot, route, 'index.html'));
    assert.ok(html, `build missed ${route}`);
    assert.ok(html.includes(`<link rel="canonical" href="https://noteworthynews.co${route}">`));
    assert.ok(html.includes(`<meta property="og:url" content="https://noteworthynews.co${route}">`));
    assert.match(html, /src="\/publication\/reading-state.js" defer/);
    assert.match(html, /src="\/publication\/reading-controls.js" defer/);
    assert.ok(html.indexOf('/publication/reading-state.js') < html.indexOf('/publication/reading-controls.js'));
    if (guide) assert.ok(html.includes(R.esc(guide.change.text)));
    assert.ok(writes.get(path.join(virtualRoot, 'publication-sitemap.xml')).includes(`https://noteworthynews.co${route}`));
  }
  assert.ok([...writes.keys()].every(file => file.startsWith(virtualRoot + '/')));
});

test('rendered reading metadata supplies the explicit source version independently of source date', () => {
  const readingState = require('../../publication/reading-state');
  for (const guide of G.guides) {
    assert.ok(readingState.validGuide(guide), `${guide.slug} metadata cannot initialize controls`);
    const html = htmlFor(guide);
    assert.ok(html.includes(`data-guide-version="${guide.version}"`));
    assert.ok(html.includes(`data-guide-updated-at="${guide.updatedAt}"`));
    const read = readingState.remember(readingState.emptyState(), guide);
    const newerVersionSameSourcesDate = { ...guide, version: guide.version + 1 };
    assert.equal(readingState.status(read, newerVersionSameSourcesDate).updated, true);
    assert.equal(read.briefings[0].revision, guide.updatedAt, 'checking a later version must not rewrite the source date');
  }
});

test('preview serves canonical guides and their index.html aliases as no-index source briefings', async () => {
  let handler;
  const fakeHttp = { createServer(callback) { handler = callback; return { listen() {} }; } };
  const script = fs.readFileSync(path.join(root, 'scripts/preview-publication.js'), 'utf8');
  vm.runInNewContext(script, {
    __dirname: path.join(root, 'scripts'), URL, process: { env: {} }, console: { log() {} },
    require(specifier) {
      if (specifier === 'node:http') return fakeHttp;
      return require(specifier.startsWith('.') ? path.resolve(root, 'scripts', specifier) : specifier);
    }
  }, { timeout: 5000 });
  async function request(url) {
    let status, headers, body;
    await handler({ method: 'GET', url }, { writeHead(code, values) { status = code; headers = values; }, end(content) { body = content; } });
    return { status, headers, body };
  }
  for (const guide of [null, ...G.guides]) {
    const route = guide ? G.href(guide) : '/story-so-far/';
    for (const alias of [route, route + 'index.html']) {
      const response = await request(alias);
      assert.equal(response.status, 200, alias);
      assert.match(response.headers['X-Robots-Tag'], /noindex/);
      assert.ok(response.body.includes(`<link rel="canonical" href="https://noteworthynews.co${route}">`));
      assert.ok(response.body.includes('data-preview="true"'));
      if (guide) assert.ok(response.body.includes(R.esc(guide.change.text)));
    }
  }
  assert.equal((await request('/story-so-far/does-not-exist/')).status, 404);
  assert.equal((await request('/story-so-far/%22bad/')).status, 404);
});
