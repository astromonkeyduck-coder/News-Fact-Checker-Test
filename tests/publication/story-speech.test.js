'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../../publication/story-speech');
const flush = () => new Promise(resolve => setImmediate(resolve));
// The existing endpoint returns an MP3 as JSON base64, not a raw audio response.
const mp3 = () => ({ ok: true, status: 200, json: async () => ({ format: 'mp3', audio: 'SUQzBAAAAAAA', truncated: false }) });

function fixture(options = {}) {
  const requests = [], audio = [], states = [], created = [], revoked = [], timers = new Map(); let nextTimer = 1;
  class Audio {
    constructor(src) { this.src = src || ''; this.listeners = {}; this.playCalls = 0; this.pauseCalls = 0; audio.push(this); }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
    removeEventListener(name, fn) { this.listeners[name] = (this.listeners[name] || []).filter(value => value !== fn); }
    fire(name) { this[`on${name}`]?.({ type: name }); for (const fn of this.listeners[name] || []) fn({ type: name }); }
    async play() { this.playCalls++; if (options.blockPlayback) throw Error('Playback blocked'); this.fire('playing'); }
    pause() { this.pauseCalls++; }
    removeAttribute(name) { if (name === 'src') this.src = ''; }
    load() {}
  }
  const win = { Audio, AbortController, URL: { createObjectURL(blob) { const url = `blob:local-test/${created.length + 1}`; created.push({ url, blob }); return url; }, revokeObjectURL(url) { revoked.push(url); } },
    setTimeout(fn, delay) { const id = nextTimer++; timers.set(id, { fn, delay }); return id; }, clearTimeout(id) { timers.delete(id); },
    fetch: async (...args) => { requests.push(args); return options.fetch ? options.fetch(...args) : mp3(); } };
  Object.defineProperty(win, 'speechSynthesis', { get() { assert.fail('ElevenLabs must never fall back to browser speech'); } });
  Object.defineProperty(win, 'SpeechSynthesisUtterance', { get() { assert.fail('Browser utterances are not an allowed fallback'); } });
  const api = S.createSpeech({ window: win, preview: Boolean(options.preview), onChange: state => states.push(state) });
  return { api, win, requests, audio, states, created, revoked, timers,
    runTimeout(delay) { for (const [id, timer] of [...timers]) if (timer.delay === delay) { timers.delete(id); timer.fn(); } } };
}

async function finishAudio(f, start = 0) {
  await flush();
  for (let i = start; i < f.audio.length; i++) { f.audio[i].fire('ended'); await flush(); }
}

test('ElevenLabs initialization is silent and makes no request or browser speech fallback', () => {
  const f = fixture(); assert.equal(f.api.supported, true);
  assert.equal(f.requests.length, 0); assert.equal(f.audio.length, 0); assert.equal(f.created.length, 0);
});

test('speech text keeps source attribution while removing links, Markdown and raw source URLs', () => {
  const value = '# What happened\n**USGS** reported shaking. [Agency source](https://earthquake.usgs.gov/earthquakes/eventpage/test)\nRead https://example.com/source for details. _Not a prediction._';
  assert.equal(S.plainText(value), 'What happened USGS reported shaking. Agency source Read for details. Not a prediction.');
  assert.doesNotMatch(S.chunks(value).join(' '), /https?:\/\/|\*\*|\]\(/);
  assert.equal(S.plainText(null), ''); assert.deepEqual(S.chunks('   '), []);
});

test('sentence-aware chunks preserve all answer text in order and stay within the 900-character request limit', () => {
  const text = Array.from({ length: 80 }, (_, i) => `Source ${i} describes the reported observations and their uncertainty.`).join(' ');
  const parts = S.chunks(text); assert.ok(parts.length > 4);
  assert.equal(parts.join(' '), S.plainText(text)); assert.ok(parts.every(part => part.length <= 900));
  assert.ok(parts.slice(0, -1).every(part => /[.!?]$/.test(part)), 'Available sentence boundaries should be retained');
  const longSentence = Array.from({ length: 500 }, (_, i) => `evidence${i}`).join(' ');
  assert.equal(S.chunks(longSentence).join(' '), longSentence); assert.ok(S.chunks(longSentence).every(part => part.length <= 900));
});

test('an explicit answer uses the existing ElevenLabs endpoint and serially plays every returned MP3 chunk', async () => {
  const f = fixture(), text = Array.from({ length: 50 }, (_, i) => `Observation ${i} has a source and a limit.`).join(' ');
  const parts = S.chunks(text), pending = f.api.speak(text); await flush();
  assert.equal(f.requests.length, 1); assert.equal(f.audio.length, 1);
  for (let i = 0; i < parts.length; i++) {
    const [url, req] = f.requests[i]; assert.equal(url, '/.netlify/functions/elevenlabs-tts');
    assert.equal(req.method, 'POST'); assert.equal(req.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(req.body), { text: parts[i], storyAnswer: true }); assert.ok(req.signal instanceof AbortSignal);
    assert.equal(f.audio[i].playCalls, 1); f.audio[i].fire('ended'); await flush();
  }
  assert.equal(await pending, true); assert.equal(f.states.at(-1).state, 'ended');
  assert.equal(f.requests.map(([, req]) => JSON.parse(req.body).text).join(' '), S.plainText(text));
  assert.equal(f.timers.size, 0);
});

test('replaying an answer reuses its in-memory MP3 cache without another paid synthesis request', async () => {
  const f = fixture(), text = 'The source reports an observation, not a prediction.';
  const first = f.api.speak(text); await finishAudio(f); assert.equal(await first, true); assert.equal(f.requests.length, 1);
  const initialAudio = f.audio.length, replay = f.api.speak(text); await finishAudio(f, initialAudio);
  assert.equal(await replay, true); assert.equal(f.requests.length, 1); assert.equal(f.audio.length, 2);
  assert.equal(f.audio[1].playCalls, 1);
});

test('preview never requests ElevenLabs, creates audio, or falls back to the browser voice', async () => {
  const f = fixture({ preview: true }); assert.equal(await f.api.speak('A local preview notice'), false);
  assert.equal(f.requests.length, 0); assert.equal(f.audio.length, 0); assert.equal(f.timers.size, 0);
  assert.match(f.states.at(-1).message, /ElevenLabs|preview/i); assert.match(f.states.at(-1).message, /no.*request|not.*connected/i);
  assert.doesNotThrow(() => f.api.stop());
});

test('stop during a synthesis request aborts it and ignores a late successful response', async () => {
  let settle; const f = fixture({ fetch: () => new Promise(resolve => { settle = resolve; }) });
  const pending = f.api.speak('Pending answer'); await flush(); assert.equal(f.requests.length, 1);
  f.api.stop(); assert.equal(f.requests[0][1].signal.aborted, true); settle(mp3()); await pending; await flush();
  assert.equal(f.audio.length, 0); assert.equal(f.states.at(-1).state, 'stopped'); assert.equal(f.timers.size, 0);
});

test('stop during playback releases media and stale end callbacks cannot request or play the next chunk', async () => {
  const f = fixture(), pending = f.api.speak('A qualified source statement. '.repeat(100)); await flush();
  assert.equal(f.audio.length, 1); const current = f.audio[0], queuedEnd = current.onended; f.api.stop();
  assert.ok(current.pauseCalls > 0); queuedEnd(); await pending; await flush();
  assert.equal(f.requests.length, 1); assert.equal(f.audio.length, 1); assert.equal(f.states.at(-1).state, 'stopped');
  assert.equal(current.src, '', 'Canceled media must release its data URL');
});

test('a replacement answer invalidates the pending earlier generation and preserves the newer playback', async () => {
  let resolveOld; const f = fixture({ fetch: (_, req) => JSON.parse(req.body).text === 'Old answer' ? new Promise(resolve => { resolveOld = resolve; }) : mp3() });
  const old = f.api.speak('Old answer'); await flush(); const replacement = f.api.speak('New answer'); await flush();
  assert.equal(f.requests[0][1].signal.aborted, true); assert.equal(f.audio.length, 1);
  resolveOld(mp3()); await old; await flush(); assert.equal(f.audio.length, 1);
  f.audio[0].fire('ended'); assert.equal(await replacement, true); assert.equal(f.states.at(-1).state, 'ended');
});

test('an earlier fetch finishing late cannot clear the current request controller or its timeout', async () => {
  const pendingResponses = new Map();
  const f = fixture({ fetch: (_, req) => new Promise(resolve => pendingResponses.set(JSON.parse(req.body).text, resolve)) });
  const old = f.api.speak('Old pending answer'); await flush();
  const current = f.api.speak('Current pending answer'); await flush();
  assert.equal(f.requests[0][1].signal.aborted, true);
  pendingResponses.get('Old pending answer')(mp3()); assert.equal(await old, false);
  assert.ok([...f.timers.values()].some(timer => timer.delay === 25000), 'The newer request must retain its timeout');
  f.api.stop(); assert.equal(f.requests[1][1].signal.aborted, true, 'Stop must still abort the newer request');
  pendingResponses.get('Current pending answer')(mp3()); assert.equal(await current, false);
  assert.equal(f.audio.length, 0); assert.equal(f.timers.size, 0);
});

test('a 25-second synthesis timeout exposes a retry, clears pending state, and never invokes a fallback voice', async () => {
  let attempt = 0; const f = fixture({ fetch: (_, req) => ++attempt === 1 ? new Promise((_, reject) => req.signal.addEventListener('abort', () => reject(Object.assign(Error('Aborted'), { name: 'AbortError' })))) : mp3() });
  const first = f.api.speak('Slow answer'); await flush();
  assert.ok([...f.timers.values()].some(timer => timer.delay === 25000)); f.runTimeout(25000);
  assert.equal(await first, false); assert.equal(f.states.at(-1).state, 'error'); assert.match(f.states.at(-1).message, /try|retry|Read aloud/i);
  const retry = f.api.speak('Slow answer'); await finishAudio(f); assert.equal(await retry, true); assert.equal(f.requests.length, 2);
});

test('HTTP failures leave text usable and a subsequent explicit retry can succeed without a browser fallback', async () => {
  for (const status of [429, 500]) {
    let attempt = 0; const f = fixture({ fetch: () => ++attempt === 1 ? { ok: false, status, json: async () => ({ error: 'Internal provider details' }) } : mp3() });
    assert.equal(await f.api.speak('Sourced answer'), false); assert.equal(f.audio.length, 0);
    assert.equal(f.states.at(-1).state, 'error'); assert.match(f.states.at(-1).message, /ElevenLabs|audio/i);
    const retry = f.api.speak('Sourced answer'); await finishAudio(f); assert.equal(await retry, true);
  }
});

test('missing, malformed, oversized and truncated audio cannot be played or cached as a complete answer', async () => {
  const good = { format: 'mp3', audio: 'SUQzBAAAAAAA' };
  const invalid = [{}, { ...good, format: 'wav' }, { ...good, audio: '' }, { ...good, audio: '<script>' },
    { ...good, truncated: true }, { ...good, character_count: 1 }, { ...good, audio: 'A'.repeat(6000001) }];
  for (const payload of invalid) {
    let attempt = 0; const f = fixture({ fetch: () => ++attempt === 1 ? { ok: true, json: async () => payload } : mp3() });
    assert.equal(await f.api.speak('A complete answer'), false); assert.equal(f.audio.length, 0);
    assert.equal(f.states.at(-1).state, 'error'); assert.match(f.states.at(-1).message, /complete ElevenLabs audio/);
    const retry = f.api.speak('A complete answer'); await finishAudio(f); assert.equal(await retry, true);
    assert.equal(f.requests.length, 2, 'Invalid provider audio must not enter the replay cache');
  }
});

test('media playback rejection reports a retry without queuing later chunks', async () => {
  const f = fixture({ blockPlayback: true }); assert.equal(await f.api.speak('Read this statement. '.repeat(100)), false);
  assert.equal(f.requests.length, 1); assert.equal(f.audio.length, 1); assert.equal(f.states.at(-1).state, 'error');
  assert.match(f.states.at(-1).message, /Read aloud|try|play/i);
});

test('missing media capabilities and empty content cannot trigger requests or browser fallback', async () => {
  const states = [], unsupported = S.createSpeech({ window: {}, onChange: value => states.push(value) });
  assert.equal(unsupported.supported, false); assert.equal(await unsupported.speak('An answer'), false);
  assert.equal(states.at(-1).state, 'unavailable'); assert.doesNotThrow(() => unsupported.stop());
  const f = fixture(); assert.equal(await f.api.speak('  '), false); assert.equal(f.requests.length, 0); assert.equal(f.audio.length, 0);
});
