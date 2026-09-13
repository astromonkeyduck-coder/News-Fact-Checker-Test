'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../../publication/inside-story/model');
const client = require('../../publication/inside-story/client');
const sourceData = require('../../publication/inside-story/data/java-sea-2026.json');

// Minimal DOM double exercises event wiring, attributes and progressive visibility
// without a browser dependency. Root's visual/browser QA covers actual layout.
class Element {
  constructor(tag = 'div', attributes = {}, children = []) {
    this.tagName = tag.toUpperCase(); this.attributes = {}; this.dataset = {}; this.children = [];
    this.listeners = {}; this.style = {}; this.hidden = false; this.disabled = false; this._text = '';
    Object.entries(attributes).forEach(([key, value]) => this.setAttribute(key, value));
    children.forEach(child => this.appendChild(child));
  }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set textContent(value) { this._text = String(value); this.children = []; }
  setAttribute(key, value) {
    this.attributes[key] = String(value);
    if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
    if (key === 'hidden') this.hidden = true;
  }
  getAttribute(key) { return this.attributes[key] ?? null; }
  hasAttribute(key) { return Object.hasOwn(this.attributes, key); }
  removeAttribute(key) { delete this.attributes[key]; }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  replaceChildren(...children) { this.children = []; this._text = ''; children.forEach(child => this.appendChild(child)); }
  matches(selector) {
    selector = selector.trim();
    if (selector.startsWith('#')) return this.getAttribute('id') === selector.slice(1);
    const attr = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
    return attr ? this.hasAttribute(attr[1]) && (attr[2] === undefined || this.getAttribute(attr[1]) === attr[2]) : this.tagName.toLowerCase() === selector;
  }
  querySelectorAll(selector) {
    const found = []; const walk = element => element.children.forEach(child => { if (selector.split(',').some(part => child.matches(part))) found.push(child); walk(child); });
    walk(this); return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { return selector.split(',').some(part => this.matches(part)) ? this : this.parentNode?.closest(selector) || null; }
  contains(element) { return element === this || this.children.some(child => child.contains(element)); }
  addEventListener(name, listener) { this.listeners[name] = listener; }
}
const el = (name, tag = 'div', value = '', attrs = {}) => new Element(tag, { [`data-inside-${name}`]: value, ...attrs });
function fixture(options = {}) {
  const raw = structuredClone(sourceData); if (options.mutate) options.mutate(raw);
  const json = new Element('script', { id: 'inside-story-data' }); json.textContent = options.corrupt ? '{bad' : JSON.stringify(raw);
  const article = new Element('section', { id: 'full-article' }); article.textContent = 'Complete static sourced reporting remains readable.';
  const map = el('map', 'svg', '', { 'viewBox': '0 0 800 530', 'data-inside-projection-size': '800 530', 'data-inside-view-overview': '100 90 400 265', 'data-inside-view-sequence': '0 0 800 530', 'data-inside-view-shaking': '320 140 150 100', 'data-inside-view-evidence': '320 140 150 100' });
  const marker = el('evidence-marker', 'g', '', { hidden: '' }); marker.namespaceURI = 'http://www.w3.org/2000/svg'; map.appendChild(marker);
  for (const layer of ['epicentre', 'sequence', 'shaking']) {
    const group = el('map-layer', 'g', layer, layer === 'epicentre' ? {} : { hidden: '' });
    group.namespaceURI = 'http://www.w3.org/2000/svg'; map.appendChild(group);
  }
  const controls = el('controls', 'nav', '', { hidden: '' });
  for (const chapter of model.CHAPTERS) controls.appendChild(el('chapter', 'button', chapter));
  for (const layer of ['epicentre', 'sequence', 'shaking']) controls.appendChild(el('layer', 'button', layer));
  controls.appendChild(el('reset', 'button'));
  const timeControls = el('time-controls', 'section', '', { 'data-inside-controls': '', hidden: '' });
  for (const [name, tag, value] of [['time', 'input', ''], ['time-label', 'output', ''], ['step', 'button', 'previous'], ['step', 'button', 'next']]) timeControls.appendChild(el(name, tag, value));
  const evidenceControls = el('evidence-controls', 'section', '', { 'data-inside-controls': '', hidden: '' });
  evidenceControls.appendChild(el('evidence', 'select')); evidenceControls.appendChild(el('evidence-time', 'input')); evidenceControls.appendChild(el('evidence-time-label', 'output'));
  const scope = el('story', 'article');
  [json, article, map, controls, timeControls, evidenceControls, el('status', 'p'), el('event-detail'), el('evidence-detail'), el('evidence-marker-legend')].forEach(node => scope.appendChild(node));
  for (const name of ['magnitude', 'depthKm', 'issuedAt']) scope.appendChild(el('evidence-stat', 'span', name));
  for (const chapter of model.CHAPTERS) scope.appendChild(el('chapter-copy', 'section', chapter));
  raw.events.forEach(event => {
    scope.appendChild(el('event', 'button', event.id, { 'data-inside-controls': '', hidden: '' }));
    scope.appendChild(el('static-event', 'a', event.id));
    const anchor = el('event', 'a', event.id, { 'data-inside-event-point': event.id }); anchor.appendChild(new Element('circle')); map.appendChild(anchor);
  });
  const doc = new Element('document', {}, [scope]); doc.createElement = tag => new Element(tag); doc.getElementById = id => doc.querySelector(`#${id}`);
  const historyCalls = []; const win = { document: doc, location: { href: options.url || 'https://noteworthynews.co/inside-the-story/java-sea-2026/?ref=test#sources' }, events: {}, addEventListener(name, listener) { this.events[name] = listener; } };
  win.history = { state: { existing: true }, replaceState(state, _, value) { if (options.blockHistory) throw new Error('Blocked'); historyCalls.push({ state, value }); win.location.href = new URL(value, win.location.href).href; } };
  const query = selector => scope.querySelector(selector);
  const click = (selector, extras = {}) => { const target = typeof selector === 'string' ? query(selector) : selector; let prevented = false; scope.listeners.click({ target, preventDefault() { prevented = true; }, ...extras }); return prevented; };
  return { win, scope, query, click, historyCalls, raw, article, marker, map };
}
test('initialization preserves the article and URL, with no autoplay and correct filtered button visibility', () => {
  const time = new Date(sourceData.events.slice().sort((a, b) => a.time - b.time)[0].time).toISOString();
  const f = fixture({ url: `https://noteworthynews.co/inside-the-story/java-sea-2026/?insideChapter=sequence&insideTime=${encodeURIComponent(time)}` });
  const instance = client.init(f.win); assert.ok(instance);
  assert.equal(f.historyCalls.length, 0); assert.equal(f.article.hidden, false);
  assert.equal(f.article.textContent, 'Complete static sourced reporting remains readable.');
  assert.ok(f.scope.querySelectorAll('[data-inside-static-event]').every(node => node.hidden));
  const buttons = f.scope.querySelectorAll('[data-inside-event]').filter(node => node.tagName === 'BUTTON');
  assert.equal(buttons.filter(node => !node.hidden).length, 1, 'Control reveal must not resurrect events beyond the time filter');
  assert.equal(f.query('[data-inside-time-controls]').hidden, false);
  assert.equal(f.query('[data-inside-evidence-controls]').hidden, true);
  assert.match(f.query('[data-inside-time-label]').textContent, /1 \/ 4 events$/);
  assert.match(f.query('[data-inside-time]').getAttribute('aria-valuetext'), /not what was known then/);
});
test('corrupt source data leaves static reporting readable and enhancement controls hidden', () => {
  const f = fixture({ corrupt: true }); assert.equal(client.init(f.win), null);
  assert.ok(f.scope.querySelectorAll('[data-inside-controls]').every(node => node.hidden));
  assert.ok(f.scope.querySelectorAll('[data-inside-static-event]').every(node => !node.hidden));
  assert.equal(f.article.hidden, false); assert.match(f.query('[data-inside-status]').textContent, /full sourced article/);
});
test('source controls synchronize actual values and retain separate occurrence-time state', () => {
  const f = fixture(); const instance = client.init(f.win);
  f.click('[data-inside-chapter="evidence"]');
  const occurrence = instance.getState().time;
  assert.equal(f.query('[data-inside-time-controls]').hidden, true);
  assert.equal(f.query('[data-inside-evidence-controls]').hidden, false);
  assert.equal(f.query('[data-inside-event-detail]').hidden, true);
  const range = f.query('[data-inside-evidence-time]'); const status = f.query('[data-inside-status]'); const previousStatus = status.textContent;
  range.value = '0'; range.listeners.input();
  assert.equal(status.textContent, previousStatus, 'Dragging updates values without repeatedly announcing the full source panel');
  assert.equal(f.query('[data-inside-evidence]').value, 'origin-earlier');
  assert.equal(f.query('[data-inside-evidence-stat="magnitude"]').textContent, '6.6');
  assert.equal(f.query('[data-inside-evidence-stat="depthKm"]').textContent, '358.597 km');
  assert.equal(instance.getState().time, occurrence);
  range.listeners.change(); assert.match(status.textContent, /not the occurrence-time catalog/);
  const select = f.query('[data-inside-evidence]'); select.value = 'origin-current'; select.listeners.change();
  assert.equal(range.value, '2'); assert.equal(f.query('[data-inside-evidence-stat="magnitude"]').textContent, '6.5');
  assert.equal(f.query('[data-inside-evidence-stat="depthKm"]').textContent, '372 km');
  assert.equal(instance.getState().time, occurrence); assert.equal(f.article.hidden, false);
});
test('source markers use the base projection across cropped frames and never invent missing coordinates', () => {
  const f = fixture(); client.init(f.win); f.click('[data-inside-chapter="evidence"]');
  const select = f.query('[data-inside-evidence]'); select.value = 'origin-earlier'; select.listeners.change();
  const evidence = f.raw.evidence.find(item => item.id === 'origin-earlier');
  const projected = model.project([evidence.longitude, evidence.latitude], f.raw.bounds, [800, 530]);
  assert.equal(f.map.getAttribute('viewBox'), '320 140 150 100');
  assert.equal(f.marker.getAttribute('transform'), `translate(${projected.x} ${projected.y})`);
  assert.equal(f.marker.hidden, false); assert.equal(f.query('[data-inside-evidence-marker-legend]').hidden, false);
  assert.equal(f.marker.hasAttribute('hidden'), false, 'SVG hidden property alone does not remove the CSS-matched attribute');
  assert.equal(f.marker.style.display, '');
  select.value = 'origin-current'; select.listeners.change(); const currentPosition = f.marker.getAttribute('transform');
  assert.notEqual(currentPosition, `translate(${projected.x} ${projected.y})`);
  select.value = 'shakemap-1'; select.listeners.change();
  assert.equal(f.marker.hidden, true); assert.equal(f.query('[data-inside-evidence-marker-legend]').hidden, true);
  assert.equal(f.marker.hasAttribute('hidden'), true); assert.equal(f.marker.style.display, 'none');
  select.value = 'origin-current'; select.listeners.change(); f.click('[data-inside-chapter="overview"]');
  assert.equal(f.marker.hidden, true); assert.equal(f.query('[data-inside-evidence-marker-legend]').hidden, true);
  assert.equal(f.map.getAttribute('viewBox'), '100 90 400 265');
});
test('delegated point selection handles nested SVG clicks, preserves modified clicks and uses real sources', () => {
  const f = fixture(); const instance = client.init(f.win); const earlier = instance.data.events[0];
  const anchor = f.scope.querySelectorAll('[data-inside-event]').find(node => node.tagName === 'A' && node.dataset.insideEvent === earlier.id);
  assert.equal(f.click(anchor.children[0], { ctrlKey: true }), false); assert.equal(f.historyCalls.length, 0);
  assert.equal(f.click(anchor.children[0]), true);
  assert.equal(instance.getState().eventId, earlier.id); assert.equal(instance.getState().layer, 'sequence');
  assert.equal(f.map.getAttribute('viewBox'), '0 0 800 530');
  const panel = f.query('[data-inside-event-detail]');
  assert.equal(panel.querySelector('a').href, earlier.url);
  assert.match(panel.querySelector('h3').textContent, /USGS record/);
  assert.equal(panel.querySelectorAll('dt').length, 3);
  assert.equal(panel.querySelector('small').parentNode.tagName, 'P', 'The update timestamp has its own paragraph before the source link');
});
test('safe text construction leaves HTML-looking evidence inert and unknown values explicit', () => {
  const f = fixture({ mutate(raw) { const item = raw.evidence[raw.evidence.length - 1]; item.text = '<img src=x onerror=alert(1)>'; delete item.magnitude; delete item.depthKm; } });
  client.init(f.win);
  assert.match(f.query('[data-inside-evidence-detail]').textContent, /<img src=x onerror=alert\(1\)>/);
  assert.equal(f.query('[data-inside-evidence-detail]').querySelector('img'), null);
  assert.equal(f.query('[data-inside-evidence-stat="magnitude"]').textContent, 'Not supplied by this version');
});
test('unavailable history keeps controls usable and reports sharing limits truthfully', () => {
  const f = fixture({ blockHistory: true }); const instance = client.init(f.win);
  f.click('[data-inside-chapter="shaking"]');
  assert.equal(instance.getState().chapter, 'shaking');
  assert.match(f.query('[data-inside-status]').textContent, /address could not be updated.*controls still work/);
});
test('map-layer buttons keep caption, layer and detail visibility in agreement', () => {
  const f = fixture(); const instance = client.init(f.win);
  f.click('[data-inside-layer="shaking"]');
  assert.equal(instance.getState().chapter, 'shaking');
  const shakingLayer = f.query('[data-inside-map-layer="shaking"]');
  assert.equal(shakingLayer.hasAttribute('hidden'), false);
  assert.equal(shakingLayer.style.display, '');
  assert.equal(f.query('[data-inside-map-layer="epicentre"]').hasAttribute('hidden'), false, 'The current epicentre remains a location reference on the shaking grid');
  assert.equal(f.query('[data-inside-map-layer="sequence"]').hasAttribute('hidden'), true);
  assert.equal(f.query('[data-inside-chapter-copy="shaking"]').hidden, false);
  assert.equal(f.query('[data-inside-chapter-copy="overview"]').hidden, true);
  f.click('[data-inside-chapter="evidence"]');
  f.click('[data-inside-event]');
  assert.equal(instance.getState().chapter, 'sequence');
  assert.equal(f.query('[data-inside-event-detail]').hidden, false);
  assert.equal(f.query('[data-inside-evidence-controls]').hidden, true);
});
test('reset and navigation restore validated state while retaining unrelated address data', () => {
  const f = fixture(); const instance = client.init(f.win);
  f.click('[data-inside-chapter="evidence"]'); f.click('[data-inside-reset]');
  assert.deepEqual(instance.getState(), model.defaultState(instance.data));
  assert.equal(f.win.location.href, 'https://noteworthynews.co/inside-the-story/java-sea-2026/?ref=test#sources');
  f.win.location.href = 'https://noteworthynews.co/inside-the-story/java-sea-2026/?insideChapter=sequence&insideEvidence=origin-earlier';
  f.win.events.popstate();
  assert.equal(instance.getState().chapter, 'sequence'); assert.equal(instance.getState().evidenceId, 'origin-earlier');
  assert.equal(f.query('[data-inside-time-controls]').hidden, false);
  assert.equal(f.query('[data-inside-evidence-controls]').hidden, true);
  assert.equal(f.query('[data-inside-event-detail]').hidden, false);
});
test('a partial shaking deep link shows the main record consistently in map and details', () => {
  const prepared = model.prepareData(sourceData).data;
  const time = encodeURIComponent(new Date(prepared.timeline[0]).toISOString());
  const f = fixture({ url: `https://noteworthynews.co/inside-the-story/java-sea-2026/?insideChapter=shaking&insideTime=${time}&insideLayer=unknown` });
  const instance = client.init(f.win);
  assert.equal(instance.getState().eventId, prepared.mainEventId);
  assert.equal(f.query('[data-inside-event-detail]').querySelector('a').href, prepared.event.url);
  assert.match(f.query('[data-inside-event-detail]').querySelector('h3').textContent, /^M6\.5/);
  assert.equal(f.query('[data-inside-map-layer="shaking"]').hasAttribute('hidden'), false);
});
