'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../../games/physics');
const W = require('../../games/world');
const close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected} beyond ${tolerance}`);
const tiny = overrides => ({ id: 'test-world', version: 1, grid: { nx: 2, ny: 1, dx: 10, dy: 10 }, terrain: [1, 0.9], initialDepth: [0.1, 0], permeabilityMmHr: 0, rainfallMmHr: 0, dispersionM2s: 0, probes: [{ id: 'up', x: 5, y: 5 }, { id: 'down', x: 15, y: 5 }], ...overrides });
function assertBudgets(state, tolerance = 1e-7) {
  close(state.budget.water.error, 0, tolerance); close(state.budget.tracer.error, 0, tolerance);
  assert.ok(state.depth.every(value => Number.isFinite(value) && value >= 0));
  assert.ok(state.tracerMass.every(value => Number.isFinite(value) && value >= 0));
}
test('dry/no-input scenario remains dry with exact zero budgets and no fake motion', () => {
  const state = P.replay(W.createScenario('dry-control'), { until: 3600 });
  assert.equal(Math.max(...state.depth), 0); assert.equal(state.budget.water.stored, 0); assert.equal(state.budget.tracer.stored, 0); assertBudgets(state);
  assert.ok(Object.values(state.sensorHistory).flat().every(point => point.depth === 0 && point.concentration === 0));
});
test('closed sloping cells move water and tracer downhill while conserving both quantities', () => {
  const state = P.replay(tiny({ initialTracerMass: [20, 0] }), { until: 120 });
  assert.ok(state.depth[1] > 0.01); assert.ok(state.tracerMass[1] > 1);
  close(state.budget.water.stored, 10); close(state.budget.tracer.stored, 20); assertBudgets(state);
  assert.ok(P.sample(state, 'down').concentration > 0);
});
test('a still level surface has no advective flux; dispersion alone mixes conservatively', () => {
  const config = tiny({ terrain: [0, 0], initialDepth: [0.2, 0.2], initialTracerMass: [20, 0], dispersionM2s: 0.5 });
  const state = P.replay(config, { until: 120 });
  close(state.depth[0], 0.2); close(state.depth[1], 0.2);
  assert.ok(state.tracerMass[0] < 20 && state.tracerMass[1] > 0);
  close(state.budget.tracer.stored, 20); assertBudgets(state);
});
test('a dry bed above the donor free surface does not receive uphill water', () => {
  const state = P.replay(tiny({ terrain: [0, 1], initialDepth: [0.1, 0] }), { until: 60 });
  close(state.depth[0], 0.1); close(state.depth[1], 0); assertBudgets(state);
});
test('piecewise rainfall, infiltration, drainage and open boundaries appear in the mass ledger', () => {
  const rain = P.replay(tiny({ initialDepth: 0, terrain: [0, 0], rainfall: [{ start: 7, end: 17, mmHr: 36 }], permeabilityMmHr: 0 }), { until: 30 });
  close(rain.budget.water.rainfall, 0.02); close(rain.budget.water.stored, 0.02); assertBudgets(rain);
  const state = P.replay(tiny({ initialDepth: [0.4, 0.4], initialTracerMass: [20, 20], permeabilityMmHr: 20,
    drains: [{ id: 'out', from: 0, to: null, capacityM3s: 0.05 }], boundary: { type: 'south-open', levelM: 0 } }), { until: 120 });
  for (const key of ['infiltrated', 'drained', 'boundaryOut']) { assert.ok(state.budget.water[key] > 0); assert.ok(state.budget.tracer[key] > 0); }
  assertBudgets(state);
});
test('a precisely timed harmless pulse is injected once and never requires negative concentration', () => {
  const config = tiny({ initialDepth: 0, pulses: [{ at: 7, cell: 0, massG: 10 }] });
  const before = P.replay(config, { until: 6 }); assert.equal(before.budget.tracer.injected, 0);
  const after = P.step(before, 1); assert.equal(after.budget.tracer.injected, 10); assert.equal(P.sample(after, 'up').concentration, 0);
  const later = P.step(after, 100); assert.equal(later.budget.tracer.injected, 10); assertBudgets(later);
});
test('large requested steps are internally bounded and cannot drain more water or tracer than exists', () => {
  const state = P.replay(tiny({ initialDepth: 0.00001, initialTracerMass: [10, 10], drains: [{ id: 'large', from: 0, to: 1, capacityM3s: 100, conductanceM2s: 1000 }], permeabilityMmHr: 500 }), { until: 600, dt: 600 });
  assert.equal(state.steps, 120); assertBudgets(state); assert.ok(state.limitedSteps > 0);
});
test('step/run are pure and saved mid-run state resumes to the same numerical result', () => {
  const config = W.createScenario('missing-connection'); const original = JSON.stringify(config); const initial = P.create(config); const savedInitial = P.serialize(initial);
  const firstHalf = P.run(initial, { until: 1800 });
  assert.equal(P.serialize(initial), savedInitial); assert.equal(JSON.stringify(config), original);
  const saved = P.serialize(firstHalf); const resumed = P.run(P.restore(saved), { until: 3600 });
  const uninterrupted = P.replay(config, { until: 3600 });
  assert.deepEqual(resumed.depth, uninterrupted.depth); assert.deepEqual(resumed.tracerMass, uninterrupted.tracerMass);
  assert.deepEqual(resumed.budget, uninterrupted.budget); assert.deepEqual(resumed.sensorHistory, uninterrupted.sensorHistory);
  const rewind = P.replay(config, { until: 1200 }); const again = P.run(rewind, { until: 3600 });
  assert.deepEqual(again.depth, uninterrupted.depth); assert.deepEqual(again.tracerMass, uninterrupted.tracerMass);
});
test('malformed inputs and inconsistent saves fail without silently changing the scenario', () => {
  for (const value of [tiny({ terrain: [1] }), tiny({ roughness: 0 }), tiny({ rainfallMmHr: -1 }), tiny({ grid: { nx: 0 } }), tiny({ pulses: [{ at: -1, cell: 0, massG: 1 }] }), tiny({ rainfall: [{ start: 0, end: 10, mmHr: 2 }, { start: 5, end: 15, mmHr: 2 }] })]) assert.throws(() => P.create(value));
  const state = P.replay(tiny(), { until: 60 }); const saved = JSON.parse(P.serialize(state)); saved.depth[0] += 1;
  assert.throws(() => P.restore(saved), /mass balance/);
  saved.version = 99; assert.throws(() => P.restore(saved), /save version/);
  assert.throws(() => P.sample(state, [1000, 1000]), /outside/);
  assert.throws(() => W.createScenario('baseline-storm', { terrainEdits: [{ index: 9000, deltaM: 0.1 }] }), /Terrain edits/);
});
test('virtual probes read the exact displayed numerical cell and preserve earlier run state', () => {
  const original = P.replay(tiny(), { until: 30 }); const next = P.withProbe(original, { id: 'placed', x: 12, y: 3 });
  const reading = P.sample(next, 'placed'); close(reading.depth, next.depth[1]); close(reading.tracerMass, next.tracerMass[1]);
  assert.equal(original.config.probes.length, 2); assert.equal(next.config.probes.length, 3);
  assert.equal(next.sensorHistory.placed[0].t, 30);
  assert.deepEqual(P.restore(P.serialize(next)).depth, next.depth);
});
test('restore rejects unknown, missing or empty probe histories before summary can fail', () => {
  const state = P.replay(W.createScenario(), { until: 60 });
  const unknown = JSON.parse(P.serialize(state)); unknown.sensorHistory['unknown-probe'] = unknown.sensorHistory['old-town'];
  assert.throws(() => P.restore(unknown), /configured probes/);
  const missing = JSON.parse(P.serialize(state)); delete missing.sensorHistory['old-town'];
  assert.throws(() => P.restore(missing), /configured probes/);
  const empty = JSON.parse(P.serialize(state)); empty.sensorHistory['old-town'] = [];
  assert.throws(() => P.restore(empty), /sensor history/);
  assert.doesNotThrow(() => P.summary(P.restore(P.serialize(state))));
});
