'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const V = require('../../games/investigation-view'); const P = require('../../games/physics'); const W = require('../../games/world'); const G = require('../../games/gis');
test('map plots actual grid coordinates, respects layer order and uses identical comparison scales', () => {
  const state = P.create(W.createScenario('baseline-storm'));
  const html = V.map({ state, world: W, layers: [{ id: 'terrain' }, { id: 'water', opacity: 0.4 }, { id: 'roads' }], viewBox: [100, 200, 600, 400], suffix: 'before' });
  assert.ok(html.indexOf('data-map-layer="terrain"') < html.indexOf('data-map-layer="water"'));
  assert.ok(html.indexOf('data-map-layer="water"') < html.indexOf('data-map-layer="roads"'));
  assert.match(html, /data-map-layer="water" opacity="0.4"/);
  assert.match(html, /viewBox="100 200 600 400"/);
  assert.match(html, /cx="325" cy="125"/); // North Works: 800-675.
  assert.match(html, /x="0" y="750" width="50" height="50"/); // Southwest cell.
  assert.match(html, /Water: 0–0.30 m/);
  const later = V.map({ state: P.run(state, { until: 600 }), world: W, suffix: 'after' });
  assert.match(later, /Water: 0–0.30 m/); assert.notEqual(later, html);
  assert.match(html, /inv-drain-arrow-before/); assert.match(later, /inv-drain-arrow-after/);
});
test('features expose stable keyboard targets, selected state and real predicted readings', () => {
  const state = P.create(W.createScenario()); const html = V.map({ state, world: W, selectedFeatureId: 'old-town', probes: [{ id: 'mine', x: 525, y: 375 }] });
  assert.match(html, /data-feature-id="old-town" role="button" tabindex="0" aria-pressed="true"/);
  assert.match(html, /Predicted depth 0.005 metres/); assert.match(html, /data-probe-id="mine"/);
  assert.match(html, /Virtual probe mine: predicted depth 0.005 m/);
});
test('optional drainage follows actual scenario and computed buffer geometry is drawn', () => {
  const base = P.create(W.createScenario()); const actual = P.create(W.createScenario('missing-connection'));
  const analysis = G.analyze('buffer', { center: [325, 675], radiusM: 400 });
  const before = V.map({ state: base, world: W, analysis }); const after = V.map({ state: actual, world: W });
  assert.match(before, /works-wharf: optional connection absent/);
  assert.match(after, /works-wharf: enabled, capacity 0.1 m³\/s/);
  assert.match(before, new RegExp(`data-analysis-id="${analysis.id}"`));
  assert.match(before, /inv-analysis-region/);
});
test('graph uses real numerical rows, filters observations by probe, and includes equivalent table', () => {
  const html = V.graph({ series: [{ name: 'Baseline', color: '#69d5c6', rows: [{ t: 0, depth: 0 }, { t: 60, depth: 0.1 }] }], observations: [{ featureId: 'old-town', t: 60, depth: 0.09 }, { featureId: 'east-wharf', t: 60, depth: 9 }], variable: 'depth', probeId: 'old-town' });
  assert.match(html, /Water depth \(m\)/); assert.match(html, /Simulation time \(s\)/);
  assert.match(html, /Read the plot as a data table \(3 rows\)/);
  assert.match(html, /<td>0.1<\/td>/); assert.match(html, /<td>0.09<\/td>/); assert.doesNotMatch(html, /<td>9<\/td>/);
  assert.match(html, /Simulated prediction/); assert.match(html, /Immutable synthetic observation/);
  assert.match(html, /inv-plot-observed/);
});
test('tracer plots declare mass-volume units and terrain profiles use distance not time', () => {
  const tracer = V.graph({ series: [{ name: 'Trial', rows: [{ t: 0, concentration: 0 }, { t: 60, concentration: 0.2 }] }], variable: 'concentration' });
  assert.match(tracer, /Tracer concentration \(g\/m³\)/);
  const profile = V.profile({ samples: [{ distanceM: 0, elevationM: 1 }, { distanceM: 500, elevationM: -0.5 }] });
  assert.match(profile, /Distance along section \(m\)/); assert.match(profile, /fictional terrain grid/); assert.match(profile, /<td>500<\/td>/);
  assert.match(profile, /<td>-0.5<\/td>/);
});
test('invalid state and empty series produce honest fallbacks; user strings cannot inject markup', () => {
  assert.match(V.map({ state: null, world: W }), /valid simulation state/);
  const incomplete = P.create(W.createScenario()); incomplete.terrain = [];
  assert.match(V.map({ state: incomplete, world: W }), /valid simulation state/);
  assert.match(V.graph({ series: [] }), /No numerical readings/);
  const html = V.graph({ series: [{ name: '<img src=x onerror=alert(1)>', color: '" onload="bad', rows: [{ t: 0, depth: 1 }] }] });
  assert.doesNotMatch(html, /<img/); assert.match(html, /&lt;img/); assert.doesNotMatch(html, /onload="bad/);
  const world = { ...W, features: W.features.map(item => ({ ...item, name: '<svg onload=bad>' })) };
  const map = V.map({ state: P.create(W.createScenario()), world, suffix: '" onload="bad' });
  assert.doesNotMatch(map, /<svg onload/); assert.match(map, /&lt;svg onload=bad&gt;/);
});
test('sensitivity envelope plots actual min/max predictions with the exact rainfall schedules and table', () => {
  const result = W.ensemble(P, 'baseline-storm', [{ rainfallMmHr: 52 }, { rainfallMmHr: 65 }, { rainfallMmHr: 78 }], { until: 120 });
  const html = V.envelope({ ensemble: result, probeId: 'old-town', variable: 'depth' });
  assert.match(html, /data-envelope-band/); assert.match(html, /Water depth \(m\)/);
  assert.match(html, /not a probability interval/); assert.match(html, /52 mm\/h from 0–2700 s/); assert.match(html, /78 mm\/h from 0–2700 s/);
  assert.match(html, /Read the sensitivity envelope as a data table \(3 rows\)/);
  const expected = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(result.ranges['old-town'][2].depthMin);
  assert.ok(html.includes(`<td>${expected}</td>`));
  const changed = JSON.parse(JSON.stringify(result)); changed.ranges['old-town'][2].depthMax += 0.1;
  assert.notEqual(V.envelope({ ensemble: changed, probeId: 'old-town' }), html);
  assert.match(V.envelope({ ensemble: result, probeId: 'north-works', variable: 'concentration' }), /Tracer concentration \(g\/m³\)/);
});
test('envelope preserves repeated capped rainfall rates and rejects malformed ranges', () => {
  const ranges = { probe: [{ t: 0, depthMin: 0, depthMax: 0 }, { t: 60, depthMin: 0.1, depthMax: 0.2 }] };
  const variants = [120, 150, 150].map(mmHr => ({ rainfall: [{ start: 0, end: 2700, mmHr }] }));
  const html = V.envelope({ ensemble: { ranges, variants }, probeId: 'probe' });
  assert.equal((html.match(/150 mm\/h/g) || []).length, 2); assert.match(html, /Scenario 3: 150/);
  assert.match(V.envelope({ ensemble: { ranges }, probeId: 'missing' }), /No valid sensitivity range/);
  assert.match(V.envelope({ ensemble: { ranges: { probe: [{ t: 0, depthMin: 2, depthMax: 1 }] } }, probeId: 'probe' }), /No valid sensitivity range/);
  assert.match(V.envelope({ ensemble: { ranges }, probeId: 'probe' }), /does not include the rainfall inputs/);
  const dry = V.envelope({ ensemble: { ranges, variants: [{ rainfall: [], parameters: { rainfallMmHr: 65 } }] }, probeId: 'probe' });
  assert.match(dry, /no rainfall intervals \(0 mm\/h\)/); assert.doesNotMatch(dry, /65 mm\/h/);
});
