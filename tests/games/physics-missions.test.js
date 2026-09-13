'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../../games/physics'); const W = require('../../games/world');
const runs = new Map();
const run = id => { if (!runs.has(id)) runs.set(id, P.replay(W.createScenario(id), { until: 3600 })); return runs.get(id); };
test('one initial gauge cannot distinguish two explanations, but a targeted second reading can', () => {
  const restricted = run('blocked-drain'); const sealed = run('sealed-works');
  assert.ok(Math.abs(P.sample(restricted, 'old-town').depth - P.sample(sealed, 'old-town').depth) < 0.001, 'A ±1 mm final reading fits both hypotheses');
  const at = (state, id) => state.sensorHistory[id].find(row => row.t === 2400);
  assert.ok(Math.abs(at(restricted, 'north-works').depth - at(sealed, 'north-works').depth) > 0.01, 'North Works is a discriminating depth measurement');
  assert.ok(Math.abs(at(restricted, 'east-wharf').depth - at(sealed, 'east-wharf').depth) < 0.001, 'East Wharf does not discriminate in this case');
});
test('an optional directed connection changes tracer arrival where a clock shift does not', () => {
  const connected = P.summary(run('missing-connection')).probes['east-wharf']; const shifted = P.summary(run('clock-offset')).probes['east-wharf'];
  assert.equal(connected.arrivalTime, 660); assert.equal(shifted.arrivalTime, null);
  assert.ok(connected.peakConcentration > 1); assert.ok(shifted.peakConcentration < 0.0001);
  assert.equal(run('clock-offset').sensorHistory['north-works'].find(row => row.concentration > 0.01).t, 1200);
});
test('expanded town drainage improves one peak while increasing the receiving marsh peak', () => {
  const base = P.summary(run('baseline-storm')); const fast = P.summary(run('fast-drain')); const retain = P.summary(run('retention'));
  assert.ok(fast.probes['old-town'].peakDepth < base.probes['old-town'].peakDepth - 0.03);
  assert.ok(fast.probes['reed-marsh'].peakDepth > base.probes['reed-marsh'].peakDepth + 0.02);
  assert.ok(retain.budget.water.infiltrated > base.budget.water.infiltrated);
  assert.ok(retain.budget.water.stored < base.budget.water.stored);
});
test('a distinct rainfall/drainage pair fits one gauge but is separated by a different observation', () => {
  const lower = run('low-rain-restricted'); const higher = run('high-rain-open');
  assert.ok(Math.abs(P.sample(lower, 'old-town').depth - P.sample(higher, 'old-town').depth) < 0.001);
  assert.ok(Math.abs(P.sample(lower, 'east-wharf').depth - P.sample(higher, 'east-wharf').depth) > 0.04);
  assert.ok(Math.abs(P.sample(lower, 'north-works').depth - P.sample(higher, 'north-works').depth) < 0.001);
});
test('supplied synthetic observations are fixed, provenance-bound and independent of counterfactual runs', () => {
  const observations = W.observations(P, 'blocked-drain', { times: [2400, 3600] });
  const before = JSON.stringify(observations); run('fast-drain'); run('sealed-works');
  assert.equal(JSON.stringify(observations), before); assert.ok(Object.isFrozen(observations.rows[0]));
  assert.throws(() => { observations.rows[0].depth = 99; }, TypeError);
  assert.equal(observations.configFingerprint, observations.scenario.fingerprint);
  assert.ok(observations.rows.every(row => row.provenance.kind === 'synthetic-observation' && row.provenance.modelVersion === P.MODEL_VERSION));
  assert.equal(observations.rows.find(row => row.featureId === 'old-town' && row.t === 3600).depth, P.sample(run('blocked-drain'), 'old-town').depth);
});
test('halving the internal time step keeps water and tracer differences within documented numerical tolerances', () => {
  for (const id of ['baseline-storm', 'sealed-works', 'blocked-drain', 'missing-connection', 'fast-drain', 'retention', 'low-rain-restricted', 'high-rain-open']) {
    const coarse = run(id); const fine = P.replay(W.createScenario(id), { until: 3600, dt: 2.5 });
    const depthDifference = Math.max(...coarse.depth.map((depth, i) => Math.abs(depth - fine.depth[i])));
    const massDifference = coarse.tracerMass.reduce((total, mass, i) => total + Math.abs(mass - fine.tracerMass[i]), 0);
    assert.ok(depthDifference < 0.0002, `${id}: maximum depth difference ${depthDifference}`);
    assert.ok(massDifference / 600 < 0.003, `${id}: final tracer L1/injected mass ${massDifference / 600}`);
    assert.ok(Math.abs(coarse.budget.water.stored - fine.budget.water.stored) / fine.budget.water.stored < 0.001);
    for (const state of [coarse, fine]) { assert.ok(Math.abs(state.budget.water.error) < 1e-6); assert.ok(Math.abs(state.budget.tracer.error) < 1e-7); }
  }
});
test('an explicit rainfall ensemble is a reproducible sensitivity envelope from changed simulations', () => {
  const variants = [{ rainfallMmHr: 55 }, { rainfallMmHr: 65 }, { rainfallMmHr: 75 }];
  const result = W.ensemble(P, 'baseline-storm', variants, { until: 3600 });
  assert.equal(result.kind, 'input-sensitivity-range'); assert.equal(result.summaries.length, 3);
  const last = result.ranges['old-town'].at(-1);
  assert.ok(last.depthMax > last.depthMin + 0.02);
  assert.ok(last.depthMin <= P.sample(run('baseline-storm'), 'old-town').depth && last.depthMax >= P.sample(run('baseline-storm'), 'old-town').depth);
  assert.match(result.assumptions, /not a probability interval/);
  assert.equal(JSON.stringify(result), JSON.stringify(W.ensemble(P, 'baseline-storm', variants, { until: 3600 })));
});
test('ensemble ranges reject unmatched observation times or probe locations instead of combining by index', () => {
  const config = W.createScenario();
  assert.throws(() => P.ensemble(config, [{ sampleEvery: 60 }, { sampleEvery: 120 }], { until: 120 }), /matching times/);
  assert.throws(() => P.ensemble(config, [{}, { probes: config.probes.slice(1) }], { until: 120 }), /matching identities/);
  const moved = config.probes.map((probe, i) => ({ ...probe, x: probe.x + (i ? 0 : 50) }));
  assert.throws(() => P.ensemble(config, [{}, { probes: moved }], { until: 120 }), /matching identities/);
  const reordered = P.ensemble(config, [{}, { probes: config.probes.slice().reverse() }], { until: 120 });
  assert.ok(reordered.ranges['old-town'].every(row => row.depthMin === row.depthMax));
});
