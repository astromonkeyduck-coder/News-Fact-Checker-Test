'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../games/content');
const W = require('../../games/world');
const P = require('../../games/physics');
const G = require('../../games/gis');
const R = require('../../games/mission-rubric');
const mission = C.getMission('map-everyone-shared');

function snapshot(scenarioId, options = {}) {
  const config = W.createScenario(scenarioId, options.overrides || {});
  if (options.changeConfig) options.changeConfig(config);
  const state = P.replay(config, { until: options.duration || 3600, dt: 5 });
  return { id: options.id || scenarioId, name: config.name, scenarioId, scenarioVersion: state.scenario.version,
    modelVersion: state.modelVersion, config: state.config, configFingerprint: state.scenario.fingerprint,
    duration: state.t, probeSeries: state.sensorHistory };
}
const baseline = snapshot('baseline-storm');
const blocked = snapshot('blocked-drain');
const sealed = snapshot('sealed-works');
const observations = W.observations(P, 'blocked-drain');
const analysis = G.analyze('buffer', { center: [325, 675], radiusM: 400, featureIds: ['north-works'] }, { scenarioId: 'blocked-drain', scenarioVersion: 1 });
const comparison = R.compareRuns(baseline, blocked, { observations: C.visibleObservations(mission, observations), probeIds: ['old-town'], tolerance: 0.001 });
const context = { analyses: [analysis], comparisons: [comparison], observations, snapshots: [baseline, blocked, sealed] };
const answer = { conclusionId: 'm1-mechanism-not-unique', evidenceIds: ['m1-observation-register', analysis.id, comparison.id],
  uncertaintyIds: ['m1-model-limits', 'm1-proximity-limit'], measurementChoiceId: 'm1-withhold-measurement', interpretationId: 'sensitivity-only' };

test('comparison records expose actual one-factor outputs, source inputs and aligned samples', () => {
  assert.equal(comparison.valid, true);
  assert.deepEqual(comparison.changedParameters, ['drainageM3s']);
  assert.deepEqual(comparison.changedPhysicalFields, ['drains']);
  assert.deepEqual(comparison.unexplainedConfigChanges, []);
  assert.equal(comparison.units, 'm');
  assert.equal(comparison.sameDuration, true);
  assert.ok(comparison.alignedSamples > 50);
  assert.ok(comparison.meanAbsoluteDifference > 0.01);
  assert.equal(comparison.fitA.withinTolerance, false);
  assert.equal(comparison.fitB.withinTolerance, true);
  assert.ok(Object.isFrozen(comparison.samples));
  assert.deepEqual(comparison.configFingerprints, [baseline.configFingerprint, blocked.configFingerprint]);
});

test('a reproducible spatial result, controlled experiment and justified uncertainty earn the full bounded rubric', () => {
  const result = R.gradeMission(mission, answer, context);
  assert.equal(result.score, 100);
  assert.deepEqual(result.breakdown, { conclusion: 40, spatial: 20, experiment: 20, uncertainty: 20 });
  assert.deepEqual(result.observedRowIds, ['blocked-drain:old-town:3600']);
  assert.equal(result.provenance.simulated, true);
  assert.ok(result.comparisonSummaries.length);
});

test('the real held-out choice separates hypotheses while the tempting Wharf measurement does not', () => {
  const initial = C.visibleObservations(mission, observations);
  assert.equal(initial.length, 1);
  assert.equal(R.observationFit(blocked, initial).withinTolerance, true);
  assert.equal(R.observationFit(sealed, initial).withinTolerance, true);
  const works = C.visibleObservations(mission, observations, 'm1-measure-works');
  const wharf = C.visibleObservations(mission, observations, 'm1-measure-wharf');
  assert.equal(R.observationFit(sealed, works).withinTolerance, false);
  assert.equal(R.observationFit(sealed, wharf).withinTolerance, true);
  const strong = { ...answer, conclusionId: 'm1-drain-supported', interpretationId: 'heldout-discriminates', measurementChoiceId: 'm1-measure-works' };
  assert.equal(R.gradeMission(mission, strong, context).score, 100);
  assert.ok(R.gradeMission(mission, { ...strong, measurementChoiceId: 'm1-measure-wharf' }, context).score < 100);
  assert.ok(R.gradeMission(mission, { ...strong, measurementChoiceId: 'm1-withhold-measurement' }, context).score < 100);
});

test('authorized observation views do not leak earlier depths, tracer, or the other measurement choice', () => {
  const before = JSON.stringify(observations);
  for (const choice of [undefined, 'not-a-choice', 'm1-withhold-measurement', 'm1-measure-works', 'm1-measure-wharf']) {
    const rows = C.visibleObservations(mission, observations, choice);
    for (const row of rows) {
      assert.equal(Object.hasOwn(row, 'concentration'), false);
      assert.ok(row.featureId === 'old-town' && row.t === 3600 || choice === 'm1-measure-works' && row.featureId === 'north-works' && row.t === 2400 || choice === 'm1-measure-wharf' && row.featureId === 'east-wharf' && row.t === 2400);
    }
    assert.ok(Object.isFrozen(rows));
  }
  assert.equal(JSON.stringify(observations), before);
});

test('over-selecting, duplicate evidence, absent documents and unsupported causal claims cannot earn full credit', () => {
  for (const changed of [
    { evidenceIds: [...answer.evidenceIds, 'm1-network-note'] },
    { evidenceIds: [analysis.id, analysis.id, comparison.id] },
    { evidenceIds: [analysis.id, comparison.id] },
    { conclusionId: 'm1-proximity-proves-cause' },
    { conclusionId: 'm1-model-is-proof' },
    { interpretationId: 'proximity-is-causation' },
  ]) assert.ok(R.gradeMission(mission, { ...answer, ...changed }, context).score < 100);
});

test('comparison claims are recalculated from saved runs instead of accepting stored correctness flags', () => {
  const forged = { ...comparison, changedParameters: [], meanAbsoluteDifference: 999, valid: false };
  assert.equal(R.gradeMission(mission, answer, { ...context, comparisons: [forged] }).score, 100, 'stored success/failure fields do not determine grading');
  assert.equal(R.gradeMission(mission, answer, { ...context, comparisons: [{ ...comparison, snapshotIds: ['missing-a', 'missing-b'] }] }).breakdown.experiment, 0);
  assert.equal(R.gradeMission(mission, answer, { ...context, snapshots: [baseline, { ...blocked, configFingerprint: 'changed' }] }).breakdown.experiment, 0);
});

test('recomputed GIS evidence rejects forged output and irrelevant geometry carrying a convenient feature label', () => {
  const forged = JSON.parse(JSON.stringify(analysis));
  forged.output.properties.areaM2 = 1;
  assert.equal(R.gradeMission(mission, answer, { ...context, analyses: [forged] }).breakdown.spatial, 0);
  const wrongPlace = G.analyze('buffer', { center: [775, 225], radiusM: 400, featureIds: ['north-works'] }, { scenarioId: 'blocked-drain', scenarioVersion: 1 });
  assert.equal(R.gradeMission(mission, { ...answer, evidenceIds: ['m1-observation-register', wrongPlace.id, comparison.id] }, { ...context, analyses: [wrongPlace] }).breakdown.spatial, 0);
  assert.equal(R.analysisValid({ id: 'broken', version: 1, scenarioId: 'blocked-drain', scenarioVersion: 1, inputs: {}, output: {} }, mission), false);
});

test('two-factor changes, hidden physical changes, unequal durations and missing alignment fail experiment credit', () => {
  const variants = [
    snapshot('retention'),
    snapshot('blocked-drain', { id: 'hidden-roughness', changeConfig(config) { config.roughness = 0.12; } }),
    snapshot('blocked-drain', { id: 'short-run', duration: 1800 }),
  ];
  for (const variant of variants) {
    const compare = R.compareRuns(baseline, variant, { observations: C.visibleObservations(mission, observations), probeIds: ['old-town'] });
    const result = R.gradeMission(mission, { ...answer, evidenceIds: ['m1-observation-register', analysis.id, compare.id] }, { ...context, comparisons: [compare], snapshots: [baseline, variant] });
    assert.equal(result.breakdown.experiment, 0, variant.id);
  }
  const shifted = JSON.parse(JSON.stringify(blocked));
  shifted.probeSeries['old-town'] = shifted.probeSeries['old-town'].slice(1).map(sample => ({ ...sample, t: sample.t - 0.5 }));
  const noAlignment = R.compareRuns(baseline, shifted, { probeIds: ['old-town'] });
  assert.equal(noAlignment.valid, false);
  assert.equal(noAlignment.alignedSamples, 0);
});

test('missing observation samples are reported rather than treated as a zero residual', () => {
  const missing = R.observationFit(blocked, [{ id: 'between-samples', featureId: 'old-town', t: 2399, depth: 0.1 }]);
  assert.equal(missing.complete, false);
  assert.equal(missing.withinTolerance, false);
  assert.equal(missing.meanAbsoluteError, null);
  assert.deepEqual(missing.missingObservationIds, ['between-samples']);
});

test('additional measurement probes do not confound physics, but moving a compared probe invalidates the comparison', () => {
  const added = snapshot('blocked-drain', { id: 'additional-observer', changeConfig(config) { config.probes.push({ id: 'extra-probe', x: 600, y: 600 }); } });
  const withExtra = R.compareRuns(baseline, added, { probeIds: ['old-town'], observations: C.visibleObservations(mission, observations) });
  assert.equal(withExtra.valid, true);
  assert.deepEqual(withExtra.unexplainedConfigChanges, []);
  const moved = snapshot('blocked-drain', { id: 'moved-observer', changeConfig(config) { config.probes.find(probe => probe.id === 'old-town').x = 600; } });
  const wrongLocation = R.compareRuns(baseline, moved, { probeIds: ['old-town'] });
  assert.equal(wrongLocation.valid, false);
  assert.deepEqual(wrongLocation.differentProbeLocations, ['old-town']);
});
