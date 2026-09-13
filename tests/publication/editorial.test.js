'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const vm = require('node:vm');
const w = require('../../publication/editorial/store');
// Synthetic fixtures are confined to tests. They are never exported as journalism.
const actor = { name: 'Test Editor', role: 'Fixture reviewer', verified: true };
const now = '2026-09-12T14:00:00Z';
const later = '2026-09-12T15:00:00Z';
const input = () => ({ id: 'fixture-1', title: 'A complete fixture headline', format: 'wire-update',
  claimStatus: 'attributed', lifecycle: 'updating', sources: [{ id: 'source-1', name: 'Fixture source', url: 'https://example.com/source', kind: 'primary' }],
  body: [{ text: 'A brief attributed fixture update.', sourceIds: ['source-1'] }] });
function reviewed(data = input()) {
  let r = w.createDraft(data, actor, now);
  r = w.submitReview(r, actor, now);
  r = w.markPreview(r, actor, now);
  return w.approveReview(r, actor, 'Checked linked evidence and preview.', now);
}
function published(data = input()) { return w.publishRecord(reviewed(data), actor, now); }

test('drafts and unapproved reviews stay out of public exports', () => {
  const draft = w.createDraft(input(), actor, now);
  assert.deepEqual(w.exportPublished([draft]).articles, []);
  assert.throws(() => w.publishRecord(draft, actor, now), /reviewed/);
  assert.throws(() => w.publishRecord(w.submitReview(draft, actor, now), actor, now), /preview/);
});
test('publication requires a matching preview and review of the actual content', () => {
  const r = reviewed();
  r.body[0].text = 'An unreviewed change';
  assert.throws(() => w.publishRecord(r, actor, now), /preview/);
  const previewed = w.markPreview(r, actor, now);
  assert.throws(() => w.publishRecord(previewed, actor, now), /changed after review/);
  assert.equal(published().publishedAt, now);
});
test('independent lifecycle and claim status; full headlines and valid citations', () => {
  const r = published({ ...input(), claimStatus: 'confirmed', lifecycle: 'updating' });
  assert.equal(r.lifecycle, 'updating');
  assert.equal(r.claimStatus, 'confirmed');
  assert.match(w.validateRecord({ ...r, title: 'Cut off…' }, { ready: true }).join(), /complete headline/);
  assert.match(w.validateRecord({ ...r, body: [{ text: 'claim', sourceIds: ['missing'] }] }, { ready: true }).join(), /known sources/);
});
test('own distribution links are not evidence; explicitly limited sourcing can be published', () => {
  const data = input(); data.sources[0].kind = 'distribution';
  assert.throws(() => reviewed(data), /sourcing limitation/);
  data.sourcingLimitation = 'Only the original distribution post is available; this claim is not independently verified.';
  data.claimStatus = 'not-independently-verified';
  assert.equal(published(data).claimStatus, 'not-independently-verified');
});
test('ambiguous imports require recorded human resolution and a fresh preview', () => {
  const data = { ...input(), format: 'automated-agency-summary', import: { agency: 'FDA', pageType: 'drug-recall', ambiguous: true, reasons: ['Classification mismatch'], illnessCount: null } };
  let r = w.submitReview(w.createDraft(data, actor, now), actor, now);
  assert.throws(() => w.approveReview(r, actor, 'Checked', now), /Ambiguous/);
  r = w.approveReview(r, actor, 'Checked primary notice: drug recall, not food.', now, true);
  assert.throws(() => w.publishRecord(r, actor, now), /preview/);
  r = w.markPreview(r, actor, now);
  r = w.publishRecord(r, actor, now);
  assert.equal(r.import.illnessCount, null);
  assert.equal(r.import.reviewDecision.approved, true);
});
test('research and unknown document pages cannot be represented as alert summaries', () => {
  for (const pageType of ['research-page', 'general-information', 'unknown']) {
    assert.throws(() => published({ ...input(), format: 'automated-agency-summary', import: { agency: 'FDA', pageType } }), /document type/);
  }
});
test('corrections preserve original date, original error and responsible editor', () => {
  const initial = published();
  let r = w.reviseRecord(initial, { title: 'Corrected fixture headline' }, actor, { type: 'correction', note: 'Corrected fixture description.', before: 'Original error', after: 'Correct information' }, later);
  assert.equal(w.exportPublished([r]).articles[0].title, initial.title, 'Existing published version remains while revision is reviewed');
  r = w.submitReview(r, actor, later);
  r = w.markPreview(r, actor, later);
  r = w.approveReview(r, actor, 'Compared old and new source information.', later);
  r = w.publishRecord(r, actor, later);
  assert.equal(r.state, 'corrected');
  assert.equal(r.publishedAt, now);
  assert.equal(r.updatedAt, later);
  assert.equal(r.corrections[0].before, 'Original error');
  assert.equal(w.exportPublished([r]).corrections[0].url, '/article.html?id=fixture-1');
  assert.equal(w.exportPublished([r]).articles[0].editorialResponsibility.email, undefined);
});
test('ordinary updates are separate and cannot refresh dates without a content change', () => {
  const initial = published();
  assert.throws(() => w.reviseRecord(initial, {}, actor, { type: 'update', note: 'Refresh' }, later), /No content change/);
  let r = w.reviseRecord(initial, { summary: 'New supported detail' }, actor, { type: 'update', note: 'Added supported detail.' }, later);
  r = w.submitReview(r, actor, later); r = w.markPreview(r, actor, later); r = w.approveReview(r, actor, 'Checked detail', later); r = w.publishRecord(r, actor, later);
  assert.equal(r.updates.length, 1); assert.equal(r.corrections.length, 0); assert.equal(r.publishedAt, now);
  assert.throws(() => w.reviseRecord(r, { id: 'different' }, actor, { type: 'update', note: 'Move ID' }, later), /original article ID/);
});
test('identity, timezone, and duplicate export IDs fail explicitly', () => {
  assert.throws(() => w.createDraft(input(), { name: 'Unverified' }, now), /actual responsible person/);
  assert.throws(() => w.createDraft(input(), actor, '2026-09-12T14:00:00'), /timezone/);
  assert.throws(() => w.exportPublished([published(), published()]), /Duplicate article ID/);
});
test('adopting a legacy article preserves its existing publication and update timestamps', () => {
  const original = '2026-01-02T12:30:00-05:00';
  const updated = '2026-01-03T12:30:00-05:00';
  const record = published({ ...input(), publishedAt: original, updatedAt: updated });
  assert.equal(record.publishedAt, original);
  assert.equal(record.updatedAt, updated);
});
test('export refuses direct changes to published content, timestamps or correction history', () => {
  for (const mutate of [r => { r.title = 'Unreviewed'; }, r => { r.publishedAt = later; }, r => { r.corrections.push({ note: 'Unreviewed correction' }); }]) {
    const record = published(); mutate(record);
    assert.throws(() => w.exportPublished([record]), /outside review/);
  }
});
test('preview escapes imported HTML and dangerous source URLs', () => {
  const r = w.createDraft(input(), actor, now);
  r.title = '<img src=x onerror=alert(1)>';
  r.body[0].text = '<script>alert(1)</script>';
  r.sources[0].url = 'javascript:alert(1)';
  const html = w.previewRecord(r);
  assert.ok(!html.includes('<script>')); assert.ok(!html.includes('href="javascript:'));
  assert.ok(html.includes('&lt;script&gt;')); assert.ok(html.includes('noindex,nofollow'));
});
test('CLI executes a local draft, review, preview, publication and export without service credentials', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteworthy-editorial-test-'));
  try {
    const source = path.join(dir, 'source.json'); const person = path.join(dir, 'actor.json');
    const records = path.join(dir, 'records'); const record = path.join(records, 'fixture-1.json');
    fs.writeFileSync(source, JSON.stringify(input())); fs.writeFileSync(person, JSON.stringify(actor));
    const cli = path.resolve(__dirname, '../../scripts/publication-editorial.js');
    const run = (...args) => execFileSync(process.execPath, [cli, ...args], { env: { PATH: process.env.PATH }, encoding: 'utf8' });
    run('create', record, '--input', source, '--actor', person);
    run('submit', record, '--actor', person);
    run('preview', record, '--actor', person, '--out', path.join(dir, 'preview.html'));
    run('approve', record, '--actor', person, '--note', 'Checked fixture source.');
    run('publish', record, '--actor', person);
    run('export', records, '--out', path.join(dir, 'published.json'));
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'published.json'))).articles.length, 1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

function pageScript(file, marker) {
  const html = fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8');
  return [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(script => script.includes(marker));
}
function fakePage(search, fetch) {
  const elements = new Map();
  const getElementById = id => {
    if (!elements.has(id)) elements.set(id, { style: {}, hidden: false, checked: false, value: '', textContent: '', listeners: {},
      classList: { add() {}, remove() {} }, addEventListener(type, listener) { this.listeners[type] = listener; } });
    return elements.get(id);
  };
  return { elements, context: { document: { getElementById }, window: { location: { search, origin: 'https://noteworthynews.co' } },
    URLSearchParams, URL, fetch, console, setTimeout() { return 1; }, clearTimeout() {} } };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
test('public preferences landing makes no account API request and offers useful recovery', () => {
  let requests = 0;
  const page = fakePage('', () => { requests++; });
  vm.runInNewContext(pageScript('newsletter-preferences.html', 'const urlParams'), page.context);
  assert.equal(requests, 0);
  assert.equal(page.elements.get('invalidLink').style.display, 'block');
  assert.ok(fs.readFileSync(path.resolve(__dirname, '../../newsletter-preferences.html'), 'utf8').includes('href="/subscriptions.html"'));
});
test('failed preference loading is visible and cannot overwrite unknown saved settings', async () => {
  const page = fakePage('?email=Zm9vQGV4YW1wbGUuY29t', async () => ({ ok: false, status: 503, json: async () => ({ success: false }) }));
  vm.runInNewContext(pageScript('newsletter-preferences.html', 'const urlParams'), page.context);
  await flush();
  assert.match(page.elements.get('toast').textContent, /could not be loaded/);
  assert.equal(page.elements.get('toggleEarthquakeAlerts').disabled, true);
  assert.equal(page.elements.get('preferencesRetry').hidden, false);
});
test('failed preference saving restores last saved controls, preserves legacy link and reports failure', async () => {
  const preferences = { leaderboard: true, streak: false, earthquakeAlerts: false, location: false, earthquakeMagnitudeMin: 6 };
  const page = fakePage('?email=Zm9vQGV4YW1wbGUuY29t', async (url, options) => options ? ({ ok: false, json: async () => ({ success: false }) }) : ({ ok: true, json: async () => ({ success: true, preferences }) }));
  vm.runInNewContext(pageScript('newsletter-preferences.html', 'const urlParams'), page.context);
  await flush();
  const control = page.elements.get('toggleEarthquakeAlerts');
  control.checked = true;
  control.listeners.change();
  await flush();
  assert.equal(control.checked, false);
  assert.equal(control.disabled, false);
  assert.match(page.elements.get('toast').textContent, /not saved/);
  assert.equal(page.elements.get('unsubscribeBtn').href, 'unsubscribe.html?email=Zm9vQGV4YW1wbGUuY29t');
});
test('article correction links preselect the existing form and include the full story URL', () => {
  const article = 'https://noteworthynews.co/article.html?id=fda-page-1b6014ef53e61d57';
  const page = fakePage('?subject=correction&article=' + encodeURIComponent(article), () => { throw new Error('No messages should send in this test.'); });
  vm.runInNewContext(pageScript('contact.html', "var form = document.getElementById('contactForm')"), page.context);
  assert.equal(page.elements.get('contactSubject').value, 'correction');
  assert.ok(page.elements.get('contactMessage').value.includes(article));
});
