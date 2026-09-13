'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../../publication/story-speech');

function fixture(options = {}) {
  const spoken = [], states = []; let cancellations = 0;
  class Utterance { constructor(text) { this.text = text; } }
  const synthesis = { cancel() { cancellations++; }, speak(value) { if (options.throwOnSpeak) throw Error('Blocked'); spoken.push(value); }, getVoices: () => options.voices || [] };
  const api = S.createSpeech({ synthesis, Utterance, onChange: value => states.push(value) });
  return { api, spoken, states, synthesis, get cancellations() { return cancellations; } };
}

test('speech initialization is silent and does not enumerate or queue voices before a request', () => {
  const f = fixture(); assert.equal(f.api.supported, true);
  assert.deepEqual(f.spoken, []); assert.deepEqual(f.states, []); assert.equal(f.cancellations, 0);
});

test('spoken plain text retains attribution while omitting Markdown syntax and raw source URLs', () => {
  const value = '# What happened\n**USGS** reported shaking. [Agency source](https://earthquake.usgs.gov/earthquakes/eventpage/test)\nRead https://example.com/source for details. _Not a prediction._';
  assert.equal(S.plainText(value), 'What happened USGS reported shaking. Agency source Read for details. Not a prediction.');
  assert.doesNotMatch(S.chunks(value).join(' '), /https?:\/\/|\*\*|\]\(/);
  assert.equal(S.plainText(null), ''); assert.deepEqual(S.chunks('   '), []);
});

test('a long answer is spoken completely and in order through successive short utterances', () => {
  const text = Array.from({ length: 500 }, (_, i) => `evidence${i}`).join(' ');
  const expected = S.chunks(text); assert.ok(expected.length > 10);
  assert.equal(expected.join(' '), text); assert.ok(expected.every(chunk => chunk.length <= 240));
  const f = fixture(); assert.equal(f.api.speak(text), true); assert.equal(f.spoken.length, 1);
  for (let i = 0; i < expected.length; i++) {
    assert.equal(f.spoken[i].text, expected[i]); f.spoken[i].onstart(); assert.equal(f.states.at(-1).state, 'speaking');
    f.spoken[i].onend(); assert.equal(f.spoken.length, Math.min(i + 2, expected.length));
  }
  assert.equal(f.states.at(-1).state, 'ended'); assert.equal(f.spoken.map(value => value.text).join(' '), text);
});

test('stop cancels audio and late start, end or error events cannot revive a canceled answer', () => {
  const f = fixture(); f.api.speak('A long sourced statement. '.repeat(50)); const old = f.spoken[0];
  f.api.stop(); assert.ok(f.cancellations >= 2); assert.equal(f.states.at(-1).state, 'stopped');
  const count = f.states.length; old.onstart(); old.onend(); old.onerror();
  assert.equal(f.spoken.length, 1); assert.equal(f.states.length, count);
});

test('replay or a new answer replaces the old queue and stale completion cannot skip new text', () => {
  const f = fixture(); f.api.speak('Old answer. '.repeat(100)); const old = f.spoken[0];
  f.api.speak('Replacement answer. '.repeat(80)); const current = f.spoken[1];
  old.onend(); assert.equal(f.spoken.length, 2);
  current.onend(); assert.equal(f.spoken.length, 3); assert.match(f.spoken[2].text, /Replacement/);
});

test('unsupported browser reports an honest fallback and accepts stop safely', () => {
  for (const args of [{}, { synthesis: { cancel() {} } }, { Utterance: class {} }]) {
    const states = []; const api = S.createSpeech({ ...args, onChange: state => states.push(state) });
    assert.equal(api.supported, false); assert.equal(api.speak('A reply'), false);
    assert.equal(states.at(-1).state, 'unavailable'); assert.match(states.at(-1).message, /unavailable in this browser/);
    assert.doesNotThrow(() => api.stop()); assert.equal(states.at(-1).state, 'stopped');
  }
});

test('speech engine errors stop queued chunks, expose a retry, and allow a later answer', () => {
  const f = fixture(); f.api.speak('Sources have limits. '.repeat(60)); const first = f.spoken[0];
  first.onerror({ error: 'not-allowed' }); assert.equal(f.states.at(-1).state, 'error'); assert.match(f.states.at(-1).message, /Read aloud to try again/);
  first.onend(); assert.equal(f.spoken.length, 1);
  assert.equal(f.api.speak('Try this answer.'), true); assert.equal(f.spoken[1].text, 'Try this answer.');
  f.spoken[1].onend(); assert.equal(f.states.at(-1).state, 'ended');
  const thrown = fixture({ throwOnSpeak: true }); assert.doesNotThrow(() => thrown.api.speak('Blocked by browser'));
  assert.equal(thrown.states.at(-1).state, 'error');
});

test('empty content cancels existing speech without speaking a blank utterance', () => {
  const f = fixture(); f.api.speak('Previous answer');
  assert.equal(f.api.speak('  '), false); assert.equal(f.spoken.length, 1); assert.equal(f.states.at(-1).state, 'stopped');
  f.spoken[0].onend(); assert.equal(f.spoken.length, 1);
});
