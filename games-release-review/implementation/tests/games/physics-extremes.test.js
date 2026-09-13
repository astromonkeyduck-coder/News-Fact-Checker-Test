'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const P = require('../../games/physics'); const W = require('../../games/world');
test('the supported extreme world inputs remain conservative and converge within explicit looser tolerances', () => {
  const trials = [
    { rainfallMmHr: 200, permeabilityMmHr: 0, drainageM3s: 0 },
    { rainfallMmHr: 200, permeabilityMmHr: 100, drainageM3s: 2, missingConnection: true },
    { rainfallMmHr: 200, drainageM3s: 0, terrainEdits: [{ index: 178, deltaM: -0.5 }] },
    { rainfallMmHr: 0, initialDepthM: 0.25, drainageM3s: 2 },
    { rainfallMmHr: 200, initialDepthM: 0.25, permeabilityMmHr: 0, drainageM3s: 2, terrainEdits: [{ index: 178, deltaM: -0.5 }], missingConnection: true },
  ];
  for (const overrides of trials) {
    const input = W.createScenario('baseline-storm', overrides);
    const coarse = P.replay(input, { until: 3600, dt: 5 }); const fine = P.replay(input, { until: 3600, dt: 2.5 });
    const label = JSON.stringify(overrides);
    assert.ok(Math.max(...coarse.depth.map((value, i) => Math.abs(value - fine.depth[i]))) < 0.004, `Depth convergence: ${label}`);
    assert.ok(Math.abs(coarse.budget.water.stored - fine.budget.water.stored) / Math.max(1, fine.budget.water.stored) < 0.002, `Water convergence: ${label}`);
    assert.ok(coarse.tracerMass.reduce((sum, value, i) => sum + Math.abs(value - fine.tracerMass[i]), 0) / 600 < 0.006, `Tracer convergence: ${label}`);
    for (const state of [coarse, fine]) {
      assert.ok(state.depth.every(value => Number.isFinite(value) && value >= 0)); assert.ok(state.tracerMass.every(value => Number.isFinite(value) && value >= 0));
      assert.ok(Math.abs(state.budget.water.error) < 1e-6); assert.ok(Math.abs(state.budget.tracer.error) < 1e-7);
    }
  }
});
test('a still closed uniform rainfall cell agrees with the independent analytic storage balance', () => {
  const input = { id: 'analytic-storm', grid: { nx: 1, ny: 1, dx: 50, dy: 50 }, terrain: [0], initialDepth: [0.05], rainfallMmHr: 200, permeabilityMmHr: 100, boundary: { type: 'closed' }, pulses: [], probes: [{ id: 'cell', x: 25, y: 25 }] };
  const state = P.replay(input, { until: 3600 });
  const expected = (0.05 + (200 - 100) / 1000) * 2500;
  assert.ok(Math.abs(state.budget.water.stored - expected) < 1e-8);
  assert.ok(Math.abs(P.sample(state, 'cell').depth - 0.15) < 1e-10);
});
test('passive tracer changes scale mass linearly without changing the water solution', () => {
  const input = W.createScenario('missing-connection');
  const double = W.createScenario('missing-connection', { tracerPulse: { at: 600, massG: 1200, featureId: 'north-works' } });
  const a = P.replay(input, { until: 3600 }); const b = P.replay(double, { until: 3600 });
  assert.deepEqual(a.depth, b.depth);
  assert.ok(a.tracerMass.every((mass, i) => Math.abs(2 * mass - b.tracerMass[i]) < 1e-8));
});
test('the supplied world rejects initial storage outside the numerically supported range', () => {
  assert.throws(() => W.createScenario('baseline-storm', { initialDepthM: 1 }), /initialDepthM/);
  assert.throws(() => W.createScenario('baseline-storm', { initialDepthM: 0.251 }), /initialDepthM/);
  assert.doesNotThrow(() => W.createScenario('baseline-storm', { initialDepthM: 0.25 }));
});
test('duplicate terrain edits cannot evade the bounded per-cell elevation change', () => {
  assert.throws(() => W.createScenario('baseline-storm', { terrainEdits: [{ index: 178, deltaM: -0.5 }, { index: 178, deltaM: -0.5 }] }), /unique valid cell/);
  const baseline = W.createScenario(); const edited = W.createScenario('baseline-storm', { terrainEdits: [{ index: 178, deltaM: -0.5 }, { index: 179, deltaM: 0.5 }] });
  assert.ok(Math.abs(edited.terrain[178] - baseline.terrain[178] + 0.5) < 1e-10);
  assert.ok(Math.abs(edited.terrain[179] - baseline.terrain[179] - 0.5) < 1e-10);
});
test('optional rainfall schedule preserves default inputs and materializes bounded independent phases', () => {
  const baseline = W.createScenario();
  assert.equal(Object.prototype.hasOwnProperty.call(baseline.parameters, 'rainfallSchedule'), false);
  assert.deepEqual(baseline.rainfall, [{ start: 0, end: 2700, mmHr: 65 }]);
  const schedule = [{ start: 1217, end: 1819, mmHr: 108 }, { start: 7, end: 607, mmHr: 36 }];
  const input = W.createScenario('baseline-storm', { rainfallSchedule: schedule });
  assert.deepEqual(input.rainfall, schedule.slice().reverse()); assert.equal(schedule[0].start, 1217);
  input.rainfall[0].mmHr = 50; assert.equal(input.parameters.rainfallSchedule[0].mmHr, 36);
  assert.deepEqual(W.createScenario('baseline-storm', { rainfallSchedule: [] }).rainfall, []);
  for (const rainfallSchedule of [null, [{ start: -1, end: 20, mmHr: 10 }], [{ start: 0, end: 3601, mmHr: 10 }], [{ start: 0, end: 20, mmHr: 201 }], [{ start: 20, end: 20, mmHr: 10 }], [{ start: 0, end: 20, mmHr: 10 }, { start: 19, end: 30, mmHr: 10 }], [0, 1, 2, 3].map(start => ({ start, end: start + 1, mmHr: 10 }))]) {
    assert.throws(() => W.createScenario('baseline-storm', { rainfallSchedule }), /rainfallSchedule/);
  }
});
test('world rainfall phases agree with analytic closed-cell volumes across off-step boundaries', () => {
  const config = W.createScenario('baseline-storm', { rainfallSchedule: [{ start: 7, end: 607, mmHr: 36 }, { start: 1217, end: 1819, mmHr: 108 }] });
  const input = { id: 'analytic-phases', grid: { nx: 1, ny: 1, dx: 50, dy: 50 }, terrain: [0], initialDepth: 0, permeabilityMmHr: 0, rainfall: config.rainfall, boundary: { type: 'closed' }, pulses: [], probes: [{ id: 'cell', x: 25, y: 25 }] };
  const atPause = P.replay(input, { until: 1000, dt: 5 });
  assert.ok(Math.abs(atPause.depth[0] - 36 * 600 / 3600000) < 1e-12);
  const state = P.run(atPause, { until: 3600, dt: 5 }); const fine = P.replay(input, { until: 3600, dt: 2.5 });
  const expectedDepth = (36 * 600 + 108 * 602) / 3600000;
  assert.ok(Math.abs(state.depth[0] - expectedDepth) < 1e-12);
  assert.ok(Math.abs(state.budget.water.rainfall - expectedDepth * 2500) < 1e-8);
  assert.ok(Math.abs(state.budget.water.error) < 1e-8); assert.ok(Math.abs(state.depth[0] - fine.depth[0]) < 1e-12);
});
