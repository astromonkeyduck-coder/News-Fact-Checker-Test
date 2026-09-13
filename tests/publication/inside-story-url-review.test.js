'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../../publication/inside-story/model');
const raw = require('../../publication/inside-story/data/java-sea-2026.json');
const data = model.prepareData(raw).data;
const firstTime = encodeURIComponent(new Date(data.timeline[0]).toISOString());
const partialLinks = [
  `?insideTime=${firstTime}`,
  `?insideChapter=shaking&insideTime=${firstTime}`,
  `?insideChapter=overview&insideTime=${firstTime}&insideLayer=bogus`,
  `?insideChapter=shaking&insideTime=${firstTime}&insideEvent=unknown&insideLayer=bogus`,
];

test('partial or conflicting deep links cannot pair the main shaking map with another earthquake’s details', () => {
  for (const url of partialLinks) {
    const state = model.readUrlState(data, url);
    if (['overview', 'shaking'].includes(state.chapter)) {
      assert.equal(state.eventId, data.mainEventId, url);
      assert.ok(state.time >= data.event.time, url);
    }
    assert.ok(model.visibleEvents(data, state).some(event => event.id === state.eventId), url);
  }
});

test('normalizing a partial deep link produces a stable shareable state', () => {
  for (const url of partialLinks) {
    const state = model.readUrlState(data, url);
    const shared = model.writeUrlState(data, state, '/inside-the-story/java-sea-2026/' + url);
    assert.deepEqual(model.readUrlState(data, shared), state, url);
  }
});
