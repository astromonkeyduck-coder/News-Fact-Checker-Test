'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const G = require('../../games/gis'); const W = require('../../games/world');
const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} vs ${b}`);
const square = { type: 'Polygon', coordinates: [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]] };
test('distances and areas agree with hand-computable metre geometries', () => {
  close(G.distance([0, 0], [300, 400]), 500);
  close(G.lineLength([[0, 0], [300, 0], [300, 400]]), 700);
  close(G.area(square), 10000);
  const holes = structuredClone(square); holes.coordinates.push([[25, 25], [75, 25], [75, 75], [25, 75], [25, 25]]);
  close(G.area(holes), 7500); assert.equal(G.contains(holes, [50, 50]), false); assert.equal(G.contains(holes, [25, 25]), true);
  close(G.distance(W.feature('north-works'), W.feature('old-town')), Math.sqrt(130000));
});
test('a buffer computes proximity, including exact circle selection at the polygon approximation edge', () => {
  const region = G.buffer([0, 0], 100);
  close(region.properties.areaM2, Math.PI * 10000);
  assert.ok(Math.abs(G.area(region) - region.properties.areaM2) / region.properties.areaM2 < 0.002);
  const points = [{ id: 'inside', x: 50, y: 0 }, { id: 'boundary', x: 100, y: 0 }, { id: 'outside', x: 100.1, y: 0 }];
  assert.deepEqual(G.select(points, region).map(point => point.id), ['inside', 'boundary']);
  const works = G.buffer(W.feature('north-works'), 400);
  assert.ok(G.select(W.features, works).some(feature => feature.id === 'old-town'));
  assert.match(works.properties.meaning, /not a flood boundary/);
});
test('spatial selection and joins compute actual membership with time filtering and boundary semantics', () => {
  const points = [{ id: 'a', x: 50, y: 50, t: 10, properties: { kind: 'sensor' } }, { id: 'b', x: 200, y: 50, t: 20 }, { id: 'c', x: 0, y: 50, t: 30 }];
  assert.deepEqual(G.select(points, square, { startTime: 20, endTime: 40 }).map(item => item.id), ['c']);
  const joined = G.spatialJoin(points, [{ id: 'square', geometry: square }], { startTime: 10, endTime: 20 });
  assert.deepEqual(joined.counts, { square: 1 }); assert.deepEqual(joined.unmatchedIds, ['b']);
  assert.equal(G.contains(square, [0, 50]), true);
});
test('network direction and an optional connection differ from straight-line proximity', () => {
  const absent = G.networkPath(W.drainage, 'north-works', 'east-wharf'); assert.equal(absent.connected, false);
  const present = G.networkPath(W.drainage, 'north-works', 'east-wharf', { includeOptional: true });
  assert.equal(present.connected, true); assert.deepEqual(present.edgeIds, ['works-wharf']); close(present.distanceM, Math.hypot(700, 300));
  assert.equal(G.networkPath(W.drainage, 'east-wharf', 'north-works', { includeOptional: true }).connected, false);
  assert.deepEqual(G.networkPath(W.drainage, 'north-works', 'south-outfall').nodeIds, ['north-works', 'old-town', 'reed-marsh', 'south-outfall']);
});
test('terrain profiles sample the same grid and report real cumulative distance', () => {
  const rows = G.profile([3, 2, 1], { nx: 3, ny: 1, dx: 50, dy: 50 }, [[25, 25], [125, 25]], { samples: 3 });
  assert.deepEqual(rows.map(row => row.distanceM), [0, 50, 100]); assert.deepEqual(rows.map(row => row.elevationM), [3, 2, 1]);
  assert.throws(() => G.profile([3, 2, 1], { nx: 3, ny: 1, dx: 50, dy: 50 }, [[25, 25], [151, 25]]), /outside/);
});
test('pinned analysis retains inspectable inputs, versions, assumptions and deterministic result', () => {
  const inputs = { from: [0, 0], to: [300, 400] }; const context = { scenarioId: 'baseline-storm', scenarioVersion: 1, timeWindow: { startTime: 0, endTime: 3600 } };
  const result = G.analyze('distance', inputs, context); inputs.to[0] = 9;
  close(result.output.distanceM, 500); assert.deepEqual(result.inputs.to, [300, 400]); assert.equal(result.crs, W.CRS);
  assert.ok(Object.isFrozen(result.output)); assert.ok(result.assumptions.length); assert.equal(result.version, 1);
  assert.equal(result.id, G.analyze('distance', { from: [0, 0], to: [300, 400] }, context).id);
  assert.throws(() => G.analyze('fake-heatmap', {}), /Unknown/);
});
