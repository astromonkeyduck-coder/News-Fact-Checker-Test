'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const state = require('../../publication/reading-state');
const controls = require('../../publication/reading-controls');
const guide = (updatedAt = '2026-09-13', slug = 'a-real-briefing', version = 1) => ({ slug, title: 'A published briefing', updatedAt, version });

function storageFixture(raw = null) {
  const values = new Map(raw == null ? [] : [[state.STORAGE_KEY, raw]]);
  let blocked = false; let writeBlocked = false; const calls = [];
  const storage = { getItem(key) { if (blocked) throw new Error('Blocked'); calls.push(['read', key]); return values.get(key) ?? null; },
    setItem(key, value) { if (blocked || writeBlocked) throw new Error('Blocked'); calls.push(['write', key]); values.set(key, value); },
    removeItem(key) { if (blocked || writeBlocked) throw new Error('Blocked'); calls.push(['remove', key]); values.delete(key); } };
  return { values, calls, storage, block() { blocked = true; }, blockWrites() { writeBlocked = true; } };
}

test('validates real calendar dates and safe stable slugs', () => {
  for (const value of ['2026-02-29', '2026-13-01', '2026-04-31', '2026-9-1', '2026-09-13T00:00:00Z', 'not-a-date']) assert.equal(state.validRevision(value), false);
  assert.equal(state.validRevision('2024-02-29'), true);
  for (const value of ['../secret', 'https://example.com', '/article', 'a?b', 'a_b', '__proto__', '', 'a'.repeat(101)]) assert.equal(state.validSlug(value), false);
  assert.equal(state.validSlug('miami-airport-crash'), true);
  for (const version of [undefined, null, 0, -1, 1.5, '1', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(state.validVersion(version), false);
  assert.equal(state.validVersion(1), true);
});
test('only explicit remembering or acknowledgement advances the saved revision', () => {
  const original = state.emptyState();
  assert.equal(state.status(original, guide()).remembered, false);
  const saved = state.remember(original, guide('2026-09-12'));
  assert.equal(original.briefings.length, 0);
  const current = guide('2026-09-13', 'a-real-briefing', 2);
  assert.deepEqual(state.status(saved, current), { remembered: true, acknowledgedRevision: '2026-09-12', acknowledgedVersion: 1, updated: true });
  assert.equal(saved.briefings[0].revision, '2026-09-12', 'Checking a revisit must not acknowledge the revision');
  const acknowledged = state.acknowledge(saved, current);
  assert.equal(acknowledged.briefings[0].revision, '2026-09-13');
  assert.equal(state.status(acknowledged, current).updated, false);
  assert.throws(() => state.acknowledge(original, guide()), /Remember.*first/);
});
test('same-date and older versions do not claim an update or downgrade a newer acknowledgement', () => {
  const saved = state.remember(state.emptyState(), guide());
  assert.equal(state.status(saved, guide()).updated, false);
  assert.equal(state.status(saved, guide('2026-09-12')).updated, false);
  assert.equal(state.acknowledge(saved, guide('2026-09-12')).briefings[0].revision, '2026-09-13');
});
test('a meaningful version increment within the same day is an unread update', () => {
  const saved = state.remember(state.emptyState(), guide('2026-09-13', 'a-real-briefing', 1));
  const current = guide('2026-09-13', 'a-real-briefing', 2);
  assert.equal(state.status(saved, current).updated, true);
  const next = state.acknowledge(saved, current);
  assert.equal(next.briefings[0].version, 2);
  assert.equal(next.briefings[0].revision, '2026-09-13');
  assert.equal(state.status(next, current).updated, false);
});
test('a later date without a version increment does not imply a meaningful update', () => {
  const saved = state.remember(state.emptyState(), guide('2026-09-12', 'a-real-briefing', 1));
  const dateOnlyChange = guide('2026-09-13', 'a-real-briefing', 1);
  assert.equal(state.status(saved, dateOnlyChange).updated, false);
  assert.deepEqual(state.acknowledge(saved, dateOnlyChange), saved);
});
test('an older tab cannot overwrite a higher stored version even if its displayed date is later', () => {
  const saved = state.remember(state.emptyState(), guide('2026-09-12', 'a-real-briefing', 3));
  const olderTab = guide('2026-09-13', 'a-real-briefing', 2);
  assert.equal(state.status(saved, olderTab).updated, false);
  assert.deepEqual(state.remember(saved, olderTab), saved);
  assert.deepEqual(state.acknowledge(saved, olderTab), saved);
});
test('records contain only slug, revision date and version; forgetting one preserves the others', () => {
  const saved = state.remember(state.remember(state.emptyState(), guide()), guide('2026-09-12', 'second-briefing'));
  const forgotten = state.forget(saved, guide());
  assert.equal(saved.briefings.length, 2);
  assert.equal(forgotten.briefings.length, 1);
  assert.equal(forgotten.briefings[0].slug, 'second-briefing');
  assert.deepEqual(Object.keys(forgotten.briefings[0]), ['slug', 'revision', 'version']);
  assert.ok(!state.serialize(saved).includes('title'));
});
test('corrupt or unknown schemas fail safely; no URLs or unknown fields are imported', () => {
  for (const raw of ['{broken', '{}', 'null', '{"version":2,"briefings":[]}', '{"version":1,"briefings":[{"slug":"../x","revision":"2026-09-13"}]}']) assert.equal(state.parse(raw).ok, false);
  const duplicated = JSON.stringify({ version: 1, briefings: [{ slug: 'a', revision: '2026-09-13', version: 1 }, { slug: 'a', revision: '2026-09-13', version: 1 }] });
  assert.equal(state.parse(duplicated).ok, false);
  assert.deepEqual(state.parse(JSON.stringify({ version: 1, briefings: [{ slug: 'a', revision: '2026-09-13', version: 1, url: 'https://untrusted.example' }] })).state.briefings, [{ slug: 'a', revision: '2026-09-13', version: 1 }]);
  assert.equal(state.parse(JSON.stringify({ version: 1, briefings: [{ slug: 'a', revision: '2026-09-13' }] })).ok, false);
});
test('loading is read-only; explicit actions use only the dedicated storage key', () => {
  const fixture = storageFixture(); fixture.values.set('existing-account-bookmarks', 'untouched');
  const access = controls.createStorageAccess(() => fixture.storage);
  access.read(); access.read();
  assert.ok(fixture.calls.every(([action]) => action === 'read'));
  assert.equal(access.apply('remember', guide()).ok, true);
  assert.ok(fixture.values.has(state.STORAGE_KEY));
  assert.equal(access.apply('clear').ok, true);
  assert.equal(fixture.values.has(state.STORAGE_KEY), false);
  assert.equal(fixture.values.get('existing-account-bookmarks'), 'untouched');
});
test('blocked storage and failed writes never report persistence', () => {
  const fixture = storageFixture(); const access = controls.createStorageAccess(() => fixture.storage);
  fixture.blockWrites();
  assert.equal(access.apply('remember', guide()).ok, false);
  assert.equal(fixture.values.has(state.STORAGE_KEY), false);
  fixture.block(); assert.equal(access.read().reason, 'unavailable');
  assert.equal(access.apply('clear').ok, false);
  assert.equal(controls.createStorageAccess(() => { throw new Error('Storage getter blocked'); }).read().ok, false);
});
test('malformed saved state is not silently overwritten; explicit clear can recover', () => {
  const fixture = storageFixture('{broken'); const access = controls.createStorageAccess(() => fixture.storage);
  assert.equal(access.apply('remember', guide()).reason, 'corrupt');
  assert.equal(fixture.values.get(state.STORAGE_KEY), '{broken');
  assert.equal(access.apply('clear').ok, true);
  assert.equal(access.apply('remember', guide()).ok, true);
});
test('date labels use UTC so date-only revisions do not shift to the previous day', () => {
  assert.equal(controls.formatRevision('2026-09-13'), 'September 13, 2026');
});

// Minimal DOM fixtures exercise the actual controls, without service accounts,
// network requests or a third-party browser dependency.
class Element {
  constructor(attributes = {}, children = []) {
    this.attributes = { ...attributes }; this.children = children; this.dataset = {}; this.listeners = {};
    this.hidden = false; this.disabled = false; this.textContent = '';
    Object.entries(attributes).forEach(([key, value]) => { if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value; });
  }
  matches(selector) {
    const match = selector.trim().match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
    return Boolean(match && Object.hasOwn(this.attributes, match[1]) && (match[2] === undefined || this.attributes[match[1]] === match[2]));
  }
  querySelectorAll(selector) {
    const matches = []; const walk = node => { node.children.forEach(child => { if (selector.split(',').some(value => child.matches(value))) matches.push(child); walk(child); }); };
    walk(this); return matches;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  hasAttribute(name) { return Object.hasOwn(this.attributes, name); }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  focus() { this.focused = true; }
}
function memoryElements() {
  return ['status', 'updated', 'message'].map(name => new Element({ [`data-reading-${name}`]: '' }));
}
function guideElement(info = guide(), isCard = false) {
  const children = memoryElements();
  if (!isCard) ['remember', 'acknowledge', 'forget'].forEach(action => { const button = new Element({ 'data-reading-action': action }); button.hidden = true; children.push(button); });
  return new Element({ [isCard ? 'data-story-guide-card' : 'data-story-guide']: '', 'data-guide-slug': info.slug, 'data-guide-title': info.title, 'data-guide-updated-at': info.updatedAt, 'data-guide-version': String(info.version) }, children);
}
function windowFixture(scope, storage) {
  return { document: new Element({}, [scope]), localStorage: storage, events: {}, addEventListener(name, listener) { this.events[name] = listener; } };
}
const action = (scope, name) => scope.querySelector(`[data-reading-action="${name}"]`);
test('guide revisit keeps old acknowledgement until the reader clicks Mark this version as read', () => {
  const fixture = storageFixture(state.serialize(state.remember(state.emptyState(), guide('2026-09-12'))));
  const scope = guideElement(guide('2026-09-13', 'a-real-briefing', 2)); const win = windowFixture(scope, fixture.storage); controls.init(win);
  assert.equal(scope.querySelector('[data-reading-updated]').hidden, false);
  assert.match(scope.querySelector('[data-reading-status]').textContent, /September 12, 2026/);
  assert.equal(action(scope, 'remember').hidden, true);
  assert.equal(action(scope, 'acknowledge').hidden, false);
  assert.ok(fixture.calls.every(([name]) => name === 'read'));
  action(scope, 'acknowledge').listeners.click();
  assert.equal(scope.querySelector('[data-reading-updated]').hidden, true);
  assert.equal(state.parse(fixture.values.get(state.STORAGE_KEY)).state.briefings[0].revision, '2026-09-13');
  assert.equal(action(scope, 'forget').focused, true);
});
test('a fresh guide requires explicit opt-in and displays truthful failed-write feedback', () => {
  const fixture = storageFixture(); const scope = guideElement(); controls.init(windowFixture(scope, fixture.storage));
  assert.equal(action(scope, 'remember').hidden, false);
  assert.equal(action(scope, 'forget').hidden, true);
  assert.equal(fixture.values.size, 0);
  fixture.blockWrites(); action(scope, 'remember').listeners.click();
  assert.match(scope.querySelector('[data-reading-message]').textContent, /choice was not saved/);
  assert.equal(action(scope, 'forget').hidden, true);
});
test('index shows only known-guide statuses and explicitly clears this feature only', () => {
  const remembered = state.remember(state.remember(state.emptyState(), guide('2026-09-12')), guide('2026-09-11', 'retired-briefing'));
  const fixture = storageFixture(state.serialize(remembered)); fixture.values.set('existing-bookmarks', 'unchanged');
  const card = guideElement(guide('2026-09-13', 'a-real-briefing', 2), true);
  const clear = new Element({ 'data-reading-action': 'clear' });
  const indexStatus = new Element({ 'data-reading-index-status': '' });
  const scope = new Element({ 'data-story-guide-index': '' }, [indexStatus, card, clear, new Element({ 'data-reading-message': '' })]);
  controls.init(windowFixture(scope, fixture.storage));
  assert.equal(scope.querySelectorAll('[data-story-guide-card]').length, 1);
  assert.equal(card.querySelector('[data-reading-updated]').hidden, false);
  assert.match(indexStatus.textContent, /1 of these briefings/);
  clear.listeners.click();
  assert.match(indexStatus.textContent, /No briefings remembered/);
  assert.equal(clear.hidden, true);
  assert.equal(fixture.values.get('existing-bookmarks'), 'unchanged');
  assert.equal(fixture.values.has(state.STORAGE_KEY), false);
});
test('cross-tab changes refresh visible status without writing or acknowledging a newer guide', () => {
  const fixture = storageFixture(); const scope = guideElement(guide('2026-09-13', 'a-real-briefing', 2)); const win = windowFixture(scope, fixture.storage); controls.init(win);
  fixture.values.set(state.STORAGE_KEY, state.serialize(state.remember(state.emptyState(), guide('2026-09-12'))));
  win.events.storage({ key: state.STORAGE_KEY });
  assert.equal(scope.querySelector('[data-reading-updated]').hidden, false);
  assert.ok(fixture.calls.every(([name]) => name === 'read'));
});
