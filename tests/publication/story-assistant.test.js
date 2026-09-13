'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../../publication/story-assistant');
const R = require('../../publication/render');
const posts = require('../../publication/data/posts.json');

const context = { articleId: 'story-1', title: 'Reported facts', url: 'https://noteworthynews.co/article.html?id=story-1' };
const response = (reply = 'A sourced answer.', extra = {}) => ({ ok: true, status: 200, json: async () => ({ reply, ...extra }) });
const flush = () => new Promise(resolve => setImmediate(resolve));
function clock() {
  let next = 1; const timers = new Map();
  return { timers, setTimeout(fn, delay) { const id = next++; timers.set(id, { fn, delay }); return id; }, clearTimeout(id) { timers.delete(id); },
    run(delay) { for (const [id, timer] of [...timers]) if (timer.delay === delay) { timers.delete(id); timer.fn(); } } };
}
function conversation(options = {}) {
  const timers = clock(), calls = [];
  const fetch = options.fetch || (async (...args) => { calls.push(args); return response(); });
  return { api: A.createConversation({ fetch, context, ...timers, ...options }), timers, calls };
}

// A local DOM double checks event wiring and focus without a network or browser.
// Layout, real reduced-motion rendering, keyboard viewport and assistive-technology
// behavior remain the responsibilities of the independent browser pass.
class Element {
  constructor(tag, attrs = {}, children = []) {
    this.tagName = tag.toUpperCase(); this.attributes = {}; this.dataset = {}; this.children = [];
    this.listeners = {}; this.classes = new Set(); this._hidden = false; this.disabled = false;
    this.value = ''; this.textContent = ''; this.innerHTML = ''; this.focusCalls = [];
    this.classList = { add: (...values) => values.forEach(v => this.classes.add(v)), remove: (...values) => values.forEach(v => this.classes.delete(v)), toggle: (value, force) => force ? this.classes.add(value) : this.classes.delete(value) };
    Object.entries(attrs).forEach(([key, value]) => this.setAttribute(key, value));
    this.append(...children);
  }
  get hidden() { return this._hidden; }
  set hidden(value) {
    this._hidden = Boolean(value);
    const doc = this.ownerDocument;
    if (value && doc && this.contains(doc.activeElement)) doc.activeElement = doc.body;
  }
  get ownerDocument() { return this.tagName === 'DOCUMENT' ? this : this.parentNode?.ownerDocument; }
  get isConnected() { return Boolean(this.ownerDocument); }
  setAttribute(key, value) {
    this.attributes[key] = String(value);
    if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value);
    if (key === 'class') this.classes = new Set(String(value).split(/\s+/));
    if (key === 'hidden') this.hidden = true;
  }
  getAttribute(key) { return this.attributes[key] ?? null; }
  append(...children) { children.forEach(child => { child.parentNode = this; this.children.push(child); }); }
  remove() { this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; }
  matches(selector) {
    if (selector.startsWith('.')) return this.classes.has(selector.slice(1));
    const attr = selector.match(/^([a-z]+)?\[([^\]]+)\]$/);
    return attr ? (!attr[1] || this.tagName === attr[1].toUpperCase()) && Object.hasOwn(this.attributes, attr[2]) : this.tagName === selector.toUpperCase();
  }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
  dispatch(name, extras = {}) { const event = { target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extras }; for (const fn of this.listeners[name] || []) fn(event); return event; }
  dispatchEvent(event) { return this.dispatch(event.type, event); }
  focus(options) { this.focusCalls.push(options); this.ownerDocument.activeElement = this; }
  click() { if (this.disabled) return; this.focus(); return this.dispatch('click'); }
  reportValidity() { return Boolean(this.value.trim()) && this.value.length <= 2000; }
}
function fixture(options = {}) {
  const el = (tag, attrs = {}, children = []) => new Element(tag, attrs, children);
  const input = el('textarea'), send = el('button'), form = el('form', {}, [input, send]);
  const close = el('button', { class: 'sa-close' }), sources = el('a', { 'data-story-sources': '' });
  const suggestions = [el('button', { 'data-story-question': 'What happened?' }), el('button', { 'data-story-question': 'What is unclear?' })];
  const messages = el('div', { class: 'sa-messages' }), status = el('p', { class: 'sa-status' });
  const scroll = el('div', { class: 'sa-scroll' }, [...suggestions, messages]); scroll.scrollHeight = 300;
  const audio = el('button', { class: 'sa-audio' }), speechStop = el('button', { 'data-speech-stop': '', hidden: '' }), speechReplay = el('button', { 'data-speech-replay': '', hidden: '' }), speechStatus = el('span', { 'data-speech-status': '' });
  const visual = el('button', { 'data-story-visual': '', 'aria-pressed': 'false' });
  const panel = el('section', { class: 'sa-panel', hidden: '' }, [close, audio, scroll, visual, form, speechStop, speechReplay, speechStatus, status, sources]);
  const launcher = el('button', { class: 'sa-launcher', 'aria-expanded': 'false' });
  const root = el('aside', { 'data-story-assistant': '', 'data-context': JSON.stringify({ ...context, articleId: options.articleId || context.articleId }), hidden: '' }, [panel, launcher]);
  const articleLink = el('a'), headerAsk = el('button', { 'data-ask-story': '', hidden: '' });
  const body = el('body', { 'data-preview': String(Boolean(options.preview)) }, [articleLink, headerAsk, root]);
  const doc = el('document', {}, [body]); doc.body = body; doc.activeElement = articleLink;
  doc.createElement = tag => el(tag);
  const timers = clock(), storage = options.storage || new Map(), requests = [];
  const windowListeners = {};
  const win = { ...timers, AbortController, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } }, addEventListener(name, fn) { (windowListeners[name] ||= []).push(fn); }, fetch: options.fetch || (async (...args) => { requests.push(args); return response(); }),
    localStorage: { getItem: () => options.voiceOff ? 'off' : null, setItem() {} },
    ...(options.speech ? { NoteworthyStorySpeech: options.speech, speechSynthesis: options.synthesis, SpeechSynthesisUtterance: options.Utterance } : {}),
    sessionStorage: { getItem(key) { if (options.blockRead) throw Error('Storage denied'); return storage.get(key) ?? null; }, setItem(key, value) { if (options.blockWrite) throw Error('Storage denied'); storage.set(key, value); } } };
  return { doc, win, timers, storage, requests, root, panel, launcher, close, input, send, form, messages, status, scroll, articleLink, headerAsk, suggestions, sources, audio, speechStop, speechReplay, speechStatus, visual, windowListeners, el };
}
function audioFixture(options = {}) {
  const spoken = []; let cancellations = 0;
  const synthesis = { speak(utterance) { spoken.push(utterance); }, cancel() { cancellations++; }, getVoices: () => [] };
  class Utterance { constructor(text) { this.text = text; } }
  return { ...fixture({ ...options, speech: require('../../publication/story-speech'), synthesis, Utterance }), spoken, get cancellations() { return cancellations; } };
}

test('eligible article markup is nonmodal, hidden without JS, labeled and escaped', () => {
  assert.equal(A.markup(null), ''); assert.equal(A.markup({ id: 'held', review_required: true }), '');
  const html = A.markup({ id: '\"<script>', title: '<img src=x onerror=alert(1)> & facts', href: '/article.html?id=story-1' });
  assert.match(html, /<aside[^>]*data-story-assistant[^>]* hidden>/);
  assert.match(html, /<section[^>]*id="story-ai-panel"[^>]* hidden>/);
  assert.match(html, /aria-controls="story-ai-panel"/); assert.match(html, /aria-expanded="false"/);
  assert.match(html, /role="log"/); assert.match(html, /aria-live="polite"/);
  assert.match(html, /<label for="story-ai-question">Your question<\/label>/);
  assert.match(html, /AI can make mistakes/); assert.match(html, /Sending shares your question/);
  assert.doesNotMatch(html, /aria-modal|autofocus|<img src=x|<script>/);
  const serialized = html.match(/data-context="([^"]+)"/)[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  assert.deepEqual(JSON.parse(serialized), { articleId: '\"<script>', title: '<img src=x onerror=alert(1)> & facts', url: context.url });
});

test('assistant assets and hidden entry button are article-only and excluded from withheld coverage', () => {
  const html = R.article(posts.find(p => p.id === '2096717577204502980'));
  assert.equal((html.match(/src="\/publication\/story-assistant.js"/g) || []).length, 1);
  assert.equal((html.match(/href="\/publication\/story-assistant.css"/g) || []).length, 1);
  assert.match(html, /data-ask-story hidden/); assert.match(html, /id="sources"/);
  assert.doesNotMatch(html, /noteworthy-chat-loader|chat-widget|sfx-engine/);
  for (const other of [R.home(posts), R.archive(posts), R.page({ title: 'About', description: 'About', content: '<p>About</p>' }), R.article(posts.find(p => p.id === 'fda-page-1b6014ef53e61d57'))]) {
    assert.doesNotMatch(other, /data-story-assistant|src="\/publication\/story-assistant.js"|href="\/publication\/story-assistant.css"/);
  }
  assert.match(R.article(posts.find(p => p.id === '2096717577204502980'), [], { preview: true }), /data-preview="true"/);
});

test('reduced motion disables decorative and pending animations without hiding functionality', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '../../publication/story-assistant.css'), 'utf8');
  const base = fs.readFileSync(path.resolve(__dirname, '../../publication/publication.css'), 'utf8');
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*animation:\s*none!important/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*transition:\s*none!important/);
  assert.match(base, /@media\s*\(prefers-reduced-motion:\s*reduce\)\{\*,\*::before,\*::after\{animation:none!important/);
});

test('answer and source rendering escape untrusted markup and reject active or credential URLs', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,<script>', 'file:///etc/passwd', '//other.test', 'https://user:password@example.com/a', 'not a URL']) assert.equal(A.safeUrl(value), null);
  assert.equal(A.safeUrl('https://example.com/a?q=1&x=2'), 'https://example.com/a?q=1&x=2');
  const answer = A.answerMarkup('<img src=x onerror=alert(1)>\n**Attributed** [agency](https://example.com/a?q=1&x=2) [unsafe](javascript:alert(1))');
  assert.match(answer, /&lt;img/); assert.match(answer, /<br><strong>Attributed<\/strong>/);
  assert.match(answer, /href="https:\/\/example.com\/a\?q=1&amp;x=2"/);
  assert.match(answer, /rel="noopener noreferrer"/); assert.doesNotMatch(answer, /<img|href="javascript:/);
  const html = A.sourceMarkup([{ url: 'https://example.com/a', title: '<svg onload=alert(1)>', label: 'Distribution & attribution' }, { url: 'https://example.com/a', title: 'Duplicate' }, { url: 'javascript:alert(1)' }, null, { url: 'https://user:pass@example.com' }]);
  assert.equal((html.match(/<a /g) || []).length, 1); assert.match(html, /Sources cited in this answer/);
  assert.match(html, /&lt;svg/); assert.match(html, /Distribution &amp; attribution/); assert.doesNotMatch(html, /<svg|Duplicate|javascript:/);
  assert.equal(A.sourceMarkup({ url: 'https://example.com' }), '');
  assert.equal((A.sourceMarkup(Array.from({ length: 12 }, (_, i) => ({ url: `https://example.com/${i}` }))).match(/<a /g) || []).length, 6);
  assert.equal(A.answerMarkup('a'.repeat(21000)).length, 20000);
});

test('adjacent citations remain separate links and balanced parentheses remain part of source URLs', () => {
  const html = A.answerMarkup('[A](https://a.test/a),[B](https://b.test/Report_(2026))');
  assert.equal((html.match(/<a /g) || []).length, 2);
  assert.match(html, /href="https:\/\/a.test\/a"/);
  assert.match(html, /href="https:\/\/b.test\/Report_\(2026\)"/);
  assert.match(html, /<\/a>,<a /);
});

test('generated illustrations require safe URLs and carry a visible non-evidence label', () => {
  for (const image of [null, {}, { imageUrl: 'javascript:alert(1)' }, { imageUrl: 'data:image/svg+xml,<svg>' }, { imageUrl: 'https://user:pass@example.com/image' }]) assert.equal(A.imageMarkup(image), '');
  const html = A.imageMarkup({ imageUrl: 'https://example.com/image.png?a=1&b=2', caption: '<script>Not verified</script>' });
  assert.match(html, /AI-generated illustration/); assert.match(html, /not a news photograph or evidence/);
  assert.match(html, /alt="AI-generated explanatory illustration/); assert.match(html, /src="https:\/\/example.com\/image.png\?a=1&amp;b=2"/);
  assert.doesNotMatch(html, /<script>/);
});

test('image generation is an explicit request option with a longer timeout; preview never fabricates an image', async () => {
  let settle; const requests = [];
  const f = conversation({ fetch: (_, req) => { requests.push(req); return new Promise(resolve => { settle = resolve; }); } });
  const pending = f.api.ask('Explain the geography visually', { image: true });
  assert.equal([...f.timers.timers.values()][0].delay, 90000);
  assert.equal(JSON.parse(requests[0].body).articleImage, true); assert.deepEqual(JSON.parse(requests[0].body).pageContext, context);
  settle(response('An explanatory illustration.', { image: { imageUrl: 'https://example.com/image.png' } }));
  assert.deepEqual((await pending).image, { imageUrl: 'https://example.com/image.png' }); assert.equal(f.timers.timers.size, 0);
  const preview = conversation({ preview: true, fetch: () => assert.fail('No image request from preview') });
  const result = await preview.api.ask('Explain visually', { image: true });
  assert.equal(result.preview, true); assert.equal(result.image, undefined); assert.match(result.reply, /No image was generated/);
});

test('conversation sends canonical context only on an explicit valid question and caps follow-up history', async () => {
  const f = conversation(); assert.equal(f.calls.length, 0);
  await assert.rejects(f.api.ask('  '), /2,000/); await assert.rejects(f.api.ask('x'.repeat(2001)), /2,000/);
  assert.equal(f.calls.length, 0);
  for (let i = 0; i < 8; i++) await f.api.ask(` Question ${i} `);
  const [endpoint, request] = f.calls[0]; assert.equal(endpoint, '/.netlify/functions/noteworthy-chat');
  assert.equal(request.method, 'POST'); assert.equal(request.headers['Content-Type'], 'application/json'); assert.ok(request.signal instanceof AbortSignal);
  assert.deepEqual(JSON.parse(request.body), { message: 'Question 0', chatHistory: [], pageContext: context });
  const last = JSON.parse(f.calls.at(-1)[1].body);
  assert.equal(last.chatHistory.length, 12); assert.equal(last.chatHistory[0].content, 'Question 1');
  assert.deepEqual(last.chatHistory.map(item => item.role), Array.from({ length: 12 }, (_, i) => i % 2 ? 'assistant' : 'user'));
  assert.equal(last.message, 'Question 7'); assert.deepEqual(last.pageContext, context); assert.equal(f.timers.timers.size, 0);
});

test('preview is explicitly labeled and never creates a request, conversation history or abort timer', async () => {
  const f = conversation({ preview: true, fetch: () => assert.fail('Preview must not contact the AI endpoint') });
  const answer = await f.api.ask('What happened?'); assert.equal(answer.preview, true);
  assert.match(answer.reply, /not connected in this local preview/); assert.match(answer.reply, /no AI request was sent/);
  assert.deepEqual(answer.sources, []); assert.equal(f.timers.timers.size, 0);
  assert.equal((await f.api.ask('And why?')).preview, true);
});

test('overlapping questions create one request, and only successful replies enter later history', async () => {
  let settle; const calls = [];
  const f = conversation({ fetch: (...args) => { calls.push(args); return new Promise(resolve => { settle = resolve; }); } });
  const first = f.api.ask('First'); await assert.rejects(f.api.ask('Duplicate'), /wait for the current answer/);
  assert.equal(calls.length, 1); settle(response('First answer')); await first;
  const second = f.api.ask('Failed'); settle({ ok: false, status: 429, json: async () => ({ error: 'Raw server detail' }) });
  await assert.rejects(second, /request limit/);
  const third = f.api.ask('Retry'); assert.deepEqual(JSON.parse(calls.at(-1)[1].body).chatHistory, [{ role: 'user', content: 'First' }, { role: 'assistant', content: 'First answer' }]);
  settle(response('Retry answer')); await third; assert.equal(f.timers.timers.size, 0);
});

test('abort timeout gives a useful retry error and releases busy state', async () => {
  let attempt = 0;
  const f = conversation({ fetch: async (_, options) => {
    if (++attempt > 1) return response('Recovered');
    return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(Object.assign(Error('Aborted'), { name: 'AbortError' }))));
  } });
  const pending = f.api.ask('Slow'); assert.equal([...f.timers.timers.values()][0].delay, 30000);
  f.timers.run(30000); await assert.rejects(pending, /took too long.*question is still here/);
  assert.equal((await f.api.ask('Try again')).reply, 'Recovered'); assert.equal(f.timers.timers.size, 0);
});

test('malformed, empty and unavailable responses do not poison retries or invent success', async () => {
  const invalid = [
    { ok: true, json: async () => { throw SyntaxError('Not JSON'); } },
    response('  '), response(null),
    { ok: false, status: 500, json: async () => ({ reply: 'Not a successful answer' }) }
  ];
  for (const failure of invalid) {
    let attempt = 0; const calls = [];
    const f = conversation({ fetch: async (_, req) => { calls.push(JSON.parse(req.body)); return ++attempt === 1 ? failure : response('Okay'); } });
    await assert.rejects(f.api.ask('Failed'), /No answer|unavailable/);
    assert.equal((await f.api.ask('Retry')).reply, 'Okay'); assert.deepEqual(calls[1].chatHistory, []);
    assert.equal(f.timers.timers.size, 0);
  }
});

test('introduction opens once without focus, scroll or network and survives a same-story reload', () => {
  const f = fixture(); assert.ok(A.mount(f.doc, f.win));
  assert.equal(f.root.hidden, false); assert.equal(f.headerAsk.hidden, false); assert.equal(f.panel.hidden, true);
  f.timers.run(2400); assert.equal(f.panel.hidden, false); assert.equal(f.launcher.hidden, true);
  assert.equal(f.doc.activeElement, f.articleLink); assert.equal(f.input.focusCalls.length, 0); assert.equal(f.requests.length, 0);
  assert.equal(f.storage.get('noteworthy-story-ai-dismissed:story-1'), '1');
  const reload = fixture({ storage: f.storage }); A.mount(reload.doc, reload.win); reload.timers.run(2400);
  assert.equal(reload.panel.hidden, true); assert.equal(reload.timers.timers.size, 0);
  const another = fixture({ storage: f.storage, articleId: 'story-2' }); A.mount(another.doc, another.win); another.timers.run(2400);
  assert.equal(another.panel.hidden, false); assert.equal(another.requests.length, 0);
});

test('automatic invitation defers for hidden documents, active text entry and open dialogs', () => {
  for (const reason of ['hidden', 'input', 'dialog']) {
    const f = fixture(); A.mount(f.doc, f.win);
    if (reason === 'hidden') f.doc.hidden = true;
    if (reason === 'input') { const input = f.el('input'); f.doc.body.append(input); input.focus(); }
    if (reason === 'dialog') f.doc.body.append(f.el('dialog', { open: '' }));
    const focused = f.doc.activeElement; f.timers.run(2400);
    assert.equal(f.panel.hidden, true, reason); assert.equal(f.doc.activeElement, focused); assert.equal(f.requests.length, 0);
  }
  const f = fixture(); f.doc.hidden = true; A.mount(f.doc, f.win); f.timers.run(2400);
  f.doc.hidden = false; f.doc.dispatch('visibilitychange'); f.timers.run(1200); assert.equal(f.panel.hidden, false);
});

test('dismissed introduction stays closed after visibility changes, including blocked session storage', () => {
  for (const options of [{}, { blockRead: true }, { blockWrite: true }, { blockRead: true, blockWrite: true }]) {
    const f = fixture(options); A.mount(f.doc, f.win); f.timers.run(2400); f.close.click();
    assert.equal(f.panel.hidden, true); assert.equal(f.launcher.hidden, false); assert.equal(f.launcher.getAttribute('aria-expanded'), 'false');
    f.doc.dispatch('visibilitychange'); f.timers.run(1200); f.timers.run(2400);
    assert.equal(f.panel.hidden, true); assert.equal(f.requests.length, 0);
    f.launcher.click(); assert.equal(f.panel.hidden, false); assert.equal(f.doc.activeElement, f.input);
  }
});

test('manual opening focuses without scrolling and Escape restores the actual trigger before it was hidden', () => {
  const f = fixture(); A.mount(f.doc, f.win);
  f.launcher.click(); assert.equal(f.doc.activeElement, f.input); assert.deepEqual(f.input.focusCalls.at(-1), { preventScroll: true });
  f.doc.dispatch('keydown', { key: 'Escape' }); assert.equal(f.panel.hidden, true); assert.ok(f.doc.activeElement === f.launcher, 'Escape should return focus to the launcher');
  f.headerAsk.click(); assert.equal(f.doc.activeElement, f.input); assert.equal(f.launcher.getAttribute('aria-expanded'), 'true');
  f.doc.dispatch('keydown', { key: 'Escape' }); assert.ok(f.doc.activeElement === f.headerAsk, 'Escape should return focus to the article entry button');
  assert.equal(f.requests.length, 0); f.timers.run(2400); assert.equal(f.panel.hidden, true);
});

test('closing an automatically opened panel does not take focus away from article controls', () => {
  const f = fixture(); A.mount(f.doc, f.win); f.timers.run(2400);
  f.doc.dispatch('keydown', { key: 'Escape' }); assert.equal(f.doc.activeElement, f.articleLink); assert.equal(f.panel.hidden, true);
});

test('mount is idempotent and invalid serialized context leaves enhancement hidden', () => {
  const f = fixture(); assert.ok(A.mount(f.doc, f.win)); assert.equal(A.mount(f.doc, f.win), null);
  assert.equal(f.timers.timers.size, 1); assert.equal(f.form.listeners.submit.length, 1);
  const broken = fixture(); broken.root.dataset.context = '{broken'; assert.equal(A.mount(broken.doc, broken.win), null);
  assert.equal(broken.root.hidden, true); assert.equal(broken.headerAsk.hidden, true); assert.equal(broken.timers.timers.size, 0);
  assert.equal(A.mount(null, {}), null);
});

test('preview form interaction preserves source navigation and renders honest preview output without fetch', async () => {
  const f = fixture({ preview: true }); A.mount(f.doc, f.win); f.headerAsk.click();
  f.input.value = 'What happened?'; const event = f.form.dispatch('submit'); assert.equal(event.defaultPrevented, true);
  await flush(); assert.equal(f.requests.length, 0); assert.equal(f.input.value, ''); assert.equal(f.input.readOnly, false);
  assert.equal(f.messages.children.length, 2); assert.match(f.messages.children[1].innerHTML, /Local preview/);
  assert.match(f.status.textContent, /Preview only.*No AI request sent/);
  f.sources.click(); assert.equal(f.panel.hidden, true);
});

test('pending UI prevents duplicate submissions; failed question stays editable and retries once', async () => {
  let settle; const calls = [];
  const f = fixture({ fetch: (...args) => { calls.push(args); return new Promise(resolve => { settle = resolve; }); } });
  A.mount(f.doc, f.win); f.headerAsk.click(); f.input.value = '<img src=x> What happened?';
  f.form.dispatch('submit'); f.form.dispatch('submit'); f.suggestions[0].click();
  assert.equal(calls.length, 1); assert.equal(f.send.disabled, true); assert.equal(f.input.readOnly, true);
  assert.ok(f.suggestions.every(button => button.disabled)); assert.match(f.messages.children[0].innerHTML, /&lt;img/);
  settle({ ok: false, status: 503, json: async () => ({}) }); await flush();
  assert.equal(f.messages.children.length, 0); assert.equal(f.input.value, '<img src=x> What happened?');
  assert.equal(f.input.readOnly, false); assert.equal(f.send.disabled, false); assert.ok(f.suggestions.every(button => !button.disabled));
  assert.match(f.status.textContent, /unavailable.*question is still here/);
  f.form.dispatch('submit'); assert.equal(calls.length, 2); assert.deepEqual(JSON.parse(calls[1][1].body).chatHistory, []);
  settle(response('A bounded answer.', { sources: [{ url: 'https://example.com/source', title: 'Original source' }] })); await flush();
  assert.equal(f.messages.children.length, 2); assert.equal(f.input.value, ''); assert.match(f.messages.children[1].innerHTML, /Generated answer/);
  assert.match(f.messages.children[1].innerHTML, /Original source/); assert.match(f.status.textContent, /Follow its sources/);
});

test('uncited and unavailable grounding states do not claim that source links were returned', async () => {
  for (const extra of [{ sources: [] }, { sources: [{ url: 'javascript:alert(1)' }] }, { groundingUnavailable: true, sources: [] }]) {
    const f = fixture({ fetch: async () => response('A qualified answer.', extra) }); A.mount(f.doc, f.win);
    f.input.value = 'What is unclear?'; f.form.dispatch('submit'); await flush();
    assert.match(f.status.textContent, extra.groundingUnavailable ? /Supporting sources were unavailable/ : /No source citations were returned/);
    assert.doesNotMatch(f.messages.children[1].innerHTML, /Sources cited in this answer/);
  }
});

test('Shift+Enter and composition preserve text entry while Enter submits one question', async () => {
  const f = fixture({ preview: true }); A.mount(f.doc, f.win); f.input.value = 'My question';
  assert.equal(f.input.dispatch('keydown', { key: 'Enter', shiftKey: true }).defaultPrevented, false);
  assert.equal(f.input.dispatch('keydown', { key: 'Enter', isComposing: true }).defaultPrevented, false);
  assert.equal(f.messages.children.length, 0);
  assert.equal(f.input.dispatch('keydown', { key: 'Enter' }).defaultPrevented, true); await flush();
  assert.equal(f.messages.children.length, 2); assert.equal(f.requests.length, 0);
});

test('spoken answers default on but introduction and manual opening never speak; a submitted answer does', async () => {
  const f = audioFixture(); A.mount(f.doc, f.win); f.timers.run(2400);
  assert.equal(f.audio.getAttribute('aria-pressed'), 'true'); assert.equal(f.spoken.length, 0); assert.equal(f.requests.length, 0);
  f.close.click(); f.headerAsk.click(); assert.equal(f.spoken.length, 0);
  f.input.value = 'What happened?'; f.form.dispatch('submit'); await flush();
  assert.equal(f.spoken.length, 1); assert.equal(f.spoken[0].text, 'A sourced answer.');
  assert.equal(f.speechStop.hidden, false); assert.equal(f.speechReplay.hidden, true);
  f.spoken[0].onend(); assert.equal(f.speechStop.hidden, true); assert.equal(f.speechReplay.hidden, false);
});

test('muting during a pending request suppresses its later answer, while explicit replay still works', async () => {
  let settle;
  const f = audioFixture({ fetch: () => new Promise(resolve => { settle = resolve; }) }); A.mount(f.doc, f.win); f.headerAsk.click();
  f.input.value = 'A question'; f.form.dispatch('submit'); f.audio.click();
  assert.equal(f.audio.getAttribute('aria-pressed'), 'false'); assert.match(f.audio.getAttribute('aria-label'), /Enable spoken answers/);
  settle(response('Returned after mute')); await flush(); assert.equal(f.spoken.length, 0);
  f.speechReplay.click(); assert.equal(f.spoken.length, 1); assert.equal(f.spoken[0].text, 'Returned after mute');
  f.speechStop.click(); const count = f.spoken.length; f.spoken[0].onend(); assert.equal(f.spoken.length, count);
  assert.equal(f.speechStop.hidden, true); assert.equal(f.speechReplay.hidden, false);
});

test('a stored voice-off preference suppresses default speech without disabling explicit replay', async () => {
  const f = audioFixture({ voiceOff: true }); A.mount(f.doc, f.win); f.headerAsk.click();
  assert.equal(f.audio.getAttribute('aria-pressed'), 'false');
  f.input.value = 'Question'; f.form.dispatch('submit'); await flush(); assert.equal(f.spoken.length, 0);
  f.speechReplay.click(); assert.equal(f.spoken.length, 1);
});

test('dismissal, a hidden document, navigation and another audio owner stop speech without restarting it', async () => {
  for (const action of ['close', 'hidden', 'pagehide', 'other-audio']) {
    const f = audioFixture({ fetch: async () => response('A long answer. '.repeat(50)) }); A.mount(f.doc, f.win); f.headerAsk.click();
    f.input.value = 'Question'; f.form.dispatch('submit'); await flush(); assert.equal(f.spoken.length, 1);
    const initialCancellations = f.cancellations;
    if (action === 'close') f.close.click();
    if (action === 'hidden') { f.doc.hidden = true; f.doc.dispatch('visibilitychange'); }
    if (action === 'pagehide') for (const handler of f.windowListeners.pagehide) handler();
    if (action === 'other-audio') f.doc.dispatch('noteworthy:audio-owner', { detail: { owner: 'article-player' } });
    assert.ok(f.cancellations > initialCancellations, action); f.spoken[0].onend(); assert.equal(f.spoken.length, 1, action);
  }
});

test('a pending answer does not start audio after dismissal or backgrounding, and errors never speak', async () => {
  for (const outcome of ['dismiss', 'background', 'error']) {
    let settle; const f = audioFixture({ fetch: () => new Promise(resolve => { settle = resolve; }) }); A.mount(f.doc, f.win); f.headerAsk.click();
    f.input.value = 'Question'; f.form.dispatch('submit');
    if (outcome === 'dismiss') f.close.click();
    if (outcome === 'background') { f.doc.hidden = true; f.doc.dispatch('visibilitychange'); }
    settle(outcome === 'error' ? { ok: false, status: 500, json: async () => ({}) } : response('A later answer'));
    await flush(); assert.equal(f.spoken.length, 0, outcome);
  }
});

test('an explicit preview question can demonstrate speech while clearly saying no AI request was sent', async () => {
  const f = audioFixture({ preview: true }); A.mount(f.doc, f.win); f.timers.run(2400);
  assert.equal(f.spoken.length, 0); f.input.value = 'Explain this'; f.form.dispatch('submit'); await flush();
  assert.equal(f.requests.length, 0); assert.equal(f.spoken.length, 1);
  assert.match(f.spoken[0].text, /not connected in this local preview/);
  assert.match(f.status.textContent, /Preview only.*No AI request sent/);
});
