'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../../publication/inside-story/model');
const sourceData = require('../../publication/inside-story/data/java-sea-2026.json');
const fresh = () => structuredClone(sourceData);
const prepared = () => model.prepareData(fresh()).data;

test('the saved official dataset retains its actual source chronology without mutation', () => {
  const raw = fresh(); const before = JSON.stringify(raw); const result = model.prepareData(raw);
  assert.equal(result.ok, true); assert.deepEqual(result.warnings, []);
  assert.equal(result.data.events.length, 4);
  assert.deepEqual(result.data.evidence.map(item => item.id), ['origin-earlier', 'shakemap-1', 'origin-current', 'shakemap-4']);
  assert.equal(model.evidenceById(result.data, 'origin-earlier').magnitude, 6.6);
  assert.equal(model.evidenceById(result.data, 'origin-current').magnitude, 6.5);
  assert.equal(model.evidenceById(result.data, 'origin-earlier').depthKm, 358.597);
  assert.equal(model.evidenceById(result.data, 'origin-current').depthKm, 372);
  assert.ok(result.data.events.every(event => event.time <= result.data.event.time), 'The regional selection contains no post-mainshock events');
  assert.ok(result.data.evidence.every(item => item.time > result.data.event.time), 'Product issue times are not event occurrence times');
  assert.equal(JSON.stringify(raw), before);
});
test('invalid essential story data fails closed while individual bad catalog rows are omitted honestly', () => {
  for (const raw of [null, {}, { ...fresh(), event: { ...fresh().event, url: 'javascript:alert(1)' } }, { ...fresh(), bounds: [0, 2, 0, 3] }, { ...fresh(), events: null }]) {
    assert.equal(model.prepareData(raw).ok, false);
  }
  const raw = fresh();
  raw.events.push({ ...raw.events[0], id: 'invalid-location', latitude: 100 });
  raw.events.push({ ...raw.events[0] });
  const result = model.prepareData(raw);
  assert.equal(result.ok, true); assert.equal(result.data.events.length, 4);
  assert.match(result.warnings.join(' '), /could not be displayed/);
  assert.match(result.warnings.join(' '), /Duplicate/);
  assert.equal(model.normalizeEvent({ ...raw.event, magnitude: null, depthKm: undefined }).magnitude, null);
  assert.equal(model.normalizeEvent({ ...raw.event, magnitude: null, depthKm: undefined }).depthKm, null);
});
test('source versions and overlays require valid registered source links', () => {
  const raw = fresh(); raw.sources[0].url = 'data:text/html,unsafe';
  raw.evidence.push({ id: 'unsupported', sourceId: 'invented', label: 'Unknown', time: raw.event.time, text: 'No registered source' });
  raw.shaking.sourceId = 'invented';
  const result = model.prepareData(raw);
  assert.equal(result.ok, true);
  assert.equal(model.evidenceById(result.data, 'unsupported'), null);
  assert.equal(result.data.shaking, null);
  assert.deepEqual(result.data.availableLayers, ['epicentre', 'sequence']);
  assert.ok(result.data.evidence.every(item => model.sourceById(result.data, item.sourceId)));
  assert.match(result.warnings.join(' '), /dated source.*shaking overlay/);
});
test('strict timestamps and bounded coordinates reject ambiguous input', () => {
  for (const input of ['2026-09-13', '2026-02-29T00:00:00Z', '2026-09-13T12:00:00', '2026-09-13T99:00:00Z', Infinity, NaN, null]) assert.equal(model.timestamp(input), null);
  assert.equal(model.timestamp('2024-02-29T00:00:00Z'), Date.UTC(2024, 1, 29));
  assert.equal(model.timestamp('2026-09-13T01:00:00+01:00'), Date.UTC(2026, 8, 13));
  assert.match(model.formatTime('2026-09-13T00:00:00Z'), /Sep 13, 2026.*UTC/);
  assert.equal(model.httpUrl('javascript:alert(1)'), null);
  assert.equal(model.validGeoJson({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [101, 91] } }] }), false);
});
test('projection fits the viewport consistently, including dateline crossing', () => {
  assert.deepEqual(model.project([107, -6], [102, -10, 112, -2], [800, 530]), { x: 400, y: 265 });
  assert.deepEqual(model.project([180, 0], [170, -10, -170, 10], [800, 600]), { x: 400, y: 300 });
  const west = model.project([175, 0], [170, -10, -170, 10], [800, 600]);
  const east = model.project([-175, 0], [170, -10, -170, 10], [800, 600]);
  assert.ok(west.x < 400 && east.x > 400);
  assert.throws(() => model.project([107, 100], sourceData.bounds, [800, 530]), /Invalid/);
  assert.throws(() => model.project([107, -6], sourceData.bounds, [0, 530]), /Invalid/);
});
test('occurrence-time filtering changes only the catalog and clamps stepping', () => {
  const data = prepared(); const initial = model.defaultState(data);
  const first = model.reduce(data, initial, { type: 'time', value: 0 });
  assert.equal(model.visibleEvents(data, first).length, 1);
  assert.equal(first.eventId, data.events[0].id);
  assert.equal(first.evidenceId, initial.evidenceId);
  assert.deepEqual(model.reduce(data, first, { type: 'step', value: 'previous' }), first);
  assert.deepEqual(model.reduce(data, initial, { type: 'step', value: 'next' }), initial);
  const selected = model.reduce(data, first, { type: 'event', value: data.mainEventId });
  assert.equal(selected.time, data.event.time); assert.equal(selected.eventId, data.mainEventId);
});
test('source-version selection never simulates what was known at a catalog occurrence time', () => {
  const data = prepared();
  const first = model.reduce(data, model.defaultState(data), { type: 'time', value: 0 });
  const earlier = model.reduce(data, first, { type: 'evidence', value: 'origin-earlier' });
  assert.equal(earlier.time, first.time); assert.equal(earlier.eventId, first.eventId);
  assert.deepEqual(model.visibleEvents(data, earlier), model.visibleEvents(data, first));
  assert.equal(earlier.evidenceId, 'origin-earlier');
  assert.deepEqual(model.reduce(data, earlier, { type: 'evidence', value: 'invented' }), earlier);
});
test('explicit map-layer choices use the corresponding explanation and event selection exits source comparison', () => {
  const data = prepared(); const evidence = model.reduce(data, model.defaultState(data), { type: 'chapter', value: 'evidence' });
  for (const layer of ['epicentre', 'sequence', 'shaking']) {
    const state = model.reduce(data, evidence, { type: 'layer', value: layer });
    assert.equal(state.chapter, layer === 'epicentre' ? 'overview' : layer);
    assert.equal(state.layer, layer);
  }
  const selected = model.reduce(data, evidence, { type: 'event', value: data.events[0].id });
  assert.equal(selected.chapter, 'sequence'); assert.equal(selected.layer, 'sequence');
});
test('returning to a main-quake map restores the matching detail after a regional selection', () => {
  const data = prepared();
  const regional = model.reduce(data, model.defaultState(data), { type: 'time', value: 0 });
  for (const action of [{ type: 'chapter', value: 'overview' }, { type: 'chapter', value: 'shaking' }, { type: 'layer', value: 'epicentre' }, { type: 'layer', value: 'shaking' }]) {
    const state = model.reduce(data, regional, action);
    assert.equal(state.eventId, data.mainEventId);
    assert.ok(state.time >= data.event.time);
  }
});
test('share URLs round-trip separate choices and preserve unrelated query and hash', () => {
  const data = prepared(); let state = model.defaultState(data);
  state = model.reduce(data, state, { type: 'time', value: 0 });
  state = model.reduce(data, state, { type: 'chapter', value: 'evidence' });
  state = model.reduce(data, state, { type: 'evidence', value: 'origin-earlier' });
  const url = model.writeUrlState(data, state, '/inside-the-story/java-sea-2026/?ref=reader#sources');
  assert.deepEqual(model.readUrlState(data, url), state);
  assert.match(url, /ref=reader/); assert.ok(url.endsWith('#sources'));
  const firstTime = new Date(data.timeline[0]).toISOString();
  assert.equal(model.readUrlState(data, `?insideTime=${encodeURIComponent(firstTime)}`).time, data.timeline[0]);
  const between = new Date(data.timeline[0] + 1).toISOString();
  assert.equal(model.readUrlState(data, `?insideTime=${encodeURIComponent(between)}`).time, data.timeline[0]);
  assert.equal(model.writeUrlState(data, state, url, true), '/inside-the-story/java-sea-2026/?ref=reader#sources');
});
test('unrecognized URL input cannot select an invented event, source, chapter or layer', () => {
  const data = prepared();
  const state = model.readUrlState(data, '?insideChapter=unknown&insideTime=1900-01-01T00:00:00Z&insideEvent=javascript:alert(1)&insideEvidence=unknown&insideLayer=other');
  assert.deepEqual(state, model.defaultState(data));
  assert.deepEqual(model.reduce(data, state, { type: 'time', value: -1 }), state);
  assert.deepEqual(model.reduce(data, state, { type: 'time', value: 1.5 }), state);
  assert.deepEqual(model.reduce(data, state, { type: 'reset' }), model.defaultState(data));
});
test('partial and invalid-layer deep links cannot pair the main-quake map with a regional detail record', () => {
  const data = prepared(); const time = encodeURIComponent(new Date(data.timeline[0]).toISOString());
  for (const chapter of ['overview', 'shaking']) {
    for (const layer of ['', '&insideLayer=unknown']) {
      const state = model.readUrlState(data, `?insideChapter=${chapter}&insideTime=${time}${layer}`);
      assert.equal(state.chapter, chapter);
      assert.equal(state.layer, chapter === 'overview' ? 'epicentre' : 'shaking');
      assert.equal(state.eventId, data.mainEventId);
      assert.ok(state.time >= data.event.time);
      assert.deepEqual(model.readUrlState(data, model.writeUrlState(data, state, '/inside-the-story/java-sea-2026/')), state);
    }
  }
  for (const suffix of ['', '&insideLayer=unknown', '&insideChapter=unknown']) {
    const state = model.readUrlState(data, `?insideTime=${time}${suffix}`);
    assert.equal(state.chapter, 'sequence'); assert.equal(state.layer, 'sequence');
    assert.equal(state.time, data.timeline[0]); assert.equal(state.eventId, data.events[0].id);
  }
});
