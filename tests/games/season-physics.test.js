'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const P = require('../../games/physics'); const W = require('../../games/world'); const G = require('../../games/gis');
const C = require('../../games/content'); const R = require('../../games/mission-rubric');
const copy = value => JSON.parse(JSON.stringify(value)); const states = new Map();
function saved(scenarioId, parameters = {}) {
  const key = scenarioId + JSON.stringify(parameters);
  if (!states.has(key)) states.set(key, P.replay(W.createScenario(scenarioId, parameters), { until: 3600, dt: 5 }));
  const state = states.get(key); const restored = P.restore(P.serialize(state));
  assert.deepEqual(restored.budget, state.budget);
  assert.ok(Math.abs(state.budget.water.error) < 1e-6); assert.ok(Math.abs(state.budget.tracer.error) < 1e-7);
  return { id: `saved-${state.scenario.fingerprint}`, name: scenarioId, scenarioId, scenarioVersion: state.scenario.version, modelVersion: state.modelVersion,
    config: copy(state.config), configFingerprint: state.scenario.fingerprint, duration: state.t, probeSeries: copy(state.sensorHistory), state: P.serialize(state) };
}
function observations(mission) {
  const binding = mission.observationBinding;
  return W.observations(P, binding.referenceScenarioId, { times: [...new Set([...binding.initialTimes, ...binding.heldOutTimes])], featureIds: [...new Set([...binding.initialFeatureIds, ...binding.heldOutFeatureIds])] });
}
function spatial(mission, snapshot, operation, includeOptional = false) {
  const featureIds = mission.rubric.spatial.featureIds;
  const from = W.feature(featureIds[0]); const to = W.feature(featureIds[1]);
  const input = operation === 'network' ? { network: W.drainage, fromId: from.id, toId: to.id, options: { includeOptional }, featureIds } :
    operation === 'profile' ? { terrain: snapshot.config.terrain, grid: snapshot.config.grid, coordinates: [[from.x, from.y], [to.x, to.y]], options: { samples: 31 }, featureIds } :
      { from, to, featureIds };
  return G.analyze(operation, input, { scenarioId: snapshot.scenarioId, scenarioVersion: snapshot.scenarioVersion, modelVersion: snapshot.modelVersion });
}
function fixture({ missionId, a, b, additional = [], operation, conclusionId, measurementChoiceId, interpretationId = 'sensitivity-only', includeOptional = false, ensemble }) {
  const mission = C.getMission(missionId); const fixed = observations(mission); const before = JSON.stringify(fixed);
  const visible = C.visibleObservations(mission, fixed, measurementChoiceId);
  const variable = mission.observationBinding.variables[0];
  const comparison = R.compareRuns(a, b, { observations: visible, probeIds: mission.rubric.experiment.probeIds, variable, tolerance: 0.001 });
  const analysis = spatial(mission, b, operation, includeOptional);
  const context = { analyses: [copy(analysis)], comparisons: [copy(comparison)], snapshots: copy([a, b, ...additional]), observations: copy(fixed), ensemble };
  const answer = { conclusionId, measurementChoiceId, interpretationId, evidenceIds: [mission.rubric.decisiveEvidenceIds[0], analysis.id, comparison.id], uncertaintyIds: mission.rubric.uncertainty.acceptedIds.slice(0, 2) };
  const grade = R.gradeMission(mission, answer, context);
  assert.equal(JSON.stringify(fixed), before, 'The rubric must not rewrite supplied observations');
  return { mission, fixed, visible, answer, context, comparison, analysis, grade };
}
function fullScore(result) {
  assert.equal(result.grade.score, 100, JSON.stringify({ mission: result.mission.id, grade: result.grade }));
  assert.equal(result.grade.conclusionCorrect, true);
  assert.ok(result.grade.conditionResults.every(condition => condition.passed));
  assert.ok(result.comparison.valid); assert.equal(result.comparison.changedParameters.length, 1);
  assert.deepEqual(result.grade.observedRowIds, result.visible.map(row => row.id));
  assert.ok(R.gradeMission(result.mission, { ...result.answer, evidenceIds: [] }, result.context).score < 100);
}

test('case one supports the drainage conclusion only after a discriminating held-out reading and controlled experiment', () => {
  const result = fixture({ missionId: 'map-everyone-shared', a: saved('baseline-storm'), b: saved('blocked-drain'), additional: [saved('sealed-works')], operation: 'distance', conclusionId: 'm1-drain-supported', measurementChoiceId: 'm1-measure-works', interpretationId: 'heldout-discriminates' });
  fullScore(result);
  assert.deepEqual(result.visible.map(row => [row.featureId, row.t]), [['old-town', 3600], ['north-works', 2400]]);
  assert.ok(result.visible.every(row => !Object.hasOwn(row, 'concentration')));
  const weaker = R.gradeMission(result.mission, { ...result.answer, measurementChoiceId: 'm1-measure-wharf' }, result.context);
  assert.equal(weaker.conclusionCorrect, false);
  assert.equal(R.gradeMission(result.mission, { ...result.answer, conclusionId: 'm1-mechanism-not-unique', interpretationId: 'sensitivity-only' }, result.context).score, 100);
});
test('case two tests a real directed connection and tracer response against the fixed wharf sample', () => {
  const result = fixture({ missionId: 'missing-connection', a: saved('baseline-storm'), b: saved('missing-connection'), operation: 'network', includeOptional: true, conclusionId: 'm2-link-supported', measurementChoiceId: 'm2-withhold', interpretationId: 'heldout-discriminates' });
  fullScore(result); assert.ok(result.analysis.output.edgeIds.includes('works-wharf'));
  assert.equal(result.comparison.fitA.withinTolerance, false); assert.equal(result.comparison.fitB.withinTolerance, true);
  assert.ok(result.visible.every(row => !Object.hasOwn(row, 'depth')));
  assert.equal(R.gradeMission(result.mission, { ...result.answer, conclusionId: 'm2-mechanism-only', interpretationId: 'sensitivity-only' }, result.context).score, 100);
});
test('case three permits a justified non-unique conclusion and a separately measured discrimination', () => {
  const inputs = { missionId: 'perfect-match', a: saved('low-rain-restricted'), b: saved('low-rain-restricted', { rainfallMmHr: 75 }), additional: [saved('high-rain-open')], operation: 'distance' };
  const initial = fixture({ ...inputs, conclusionId: 'm3-not-identified', measurementChoiceId: 'm3-withhold' }); fullScore(initial);
  for (const snapshot of [inputs.a, inputs.additional[0]]) assert.equal(R.observationFit(snapshot, initial.visible, { tolerance: 0.001 }).withinTolerance, true);
  const separated = fixture({ ...inputs, conclusionId: 'm3-low-supported', measurementChoiceId: 'm3-measure-wharf', interpretationId: 'heldout-discriminates' }); fullScore(separated);
  assert.equal(R.observationFit(inputs.additional[0], separated.visible, { tolerance: 0.001 }).withinTolerance, false);
  const confounded = R.compareRuns(inputs.a, inputs.additional[0], { observations: initial.visible, probeIds: ['old-town'], variable: 'depth', tolerance: 0.001 });
  const noControl = R.gradeMission(initial.mission, { ...initial.answer, evidenceIds: [initial.answer.evidenceIds[0], initial.analysis.id, confounded.id] }, { ...initial.context, comparisons: [confounded] });
  assert.equal(noControl.conclusionCorrect, false); assert.equal(noControl.breakdown.experiment, 0);
});
test('case four requires the actual opposite town and receiving-marsh peak responses', () => {
  const result = fixture({ missionId: 'fix-moved-problem', a: saved('baseline-storm'), b: saved('fast-drain'), operation: 'network', conclusionId: 'm4-tradeoff', measurementChoiceId: 'm4-withhold' }); fullScore(result);
  const peak = (snapshot, probeId) => Math.max(...snapshot.probeSeries[probeId].map(row => row.depth));
  assert.ok(peak(result.context.snapshots[1], 'old-town') < peak(result.context.snapshots[0], 'old-town'));
  assert.ok(peak(result.context.snapshots[1], 'reed-marsh') > peak(result.context.snapshots[0], 'reed-marsh'));
  assert.equal(R.gradeMission(result.mission, { ...result.answer, conclusionId: 'm4-policy-unresolved', interpretationId: 'sensitivity-only' }, result.context).score, 100);
});
test('case five changes only tracer release time while retaining source, mass and water solution', () => {
  const a = saved('baseline-storm'); const b = saved('clock-offset');
  const result = fixture({ missionId: 'out-of-time', a, b, operation: 'network', conclusionId: 'm5-timing-supported', measurementChoiceId: 'm5-withhold', interpretationId: 'heldout-discriminates' }); fullScore(result);
  assert.deepEqual(P.restore(a.state).depth, P.restore(b.state).depth);
  assert.equal(a.config.parameters.tracerPulse.massG, b.config.parameters.tracerPulse.massG);
  assert.equal(a.config.parameters.tracerPulse.featureId, b.config.parameters.tracerPulse.featureId);
  assert.equal(result.comparison.fitA.withinTolerance, false); assert.equal(result.comparison.fitB.withinTolerance, true);
  assert.equal(R.gradeMission(result.mission, { ...result.answer, conclusionId: 'm5-timing-bounded', interpretationId: 'sensitivity-only' }, result.context).score, 100);
  const alteredMass = saved('clock-offset', { tracerPulse: { at: 1200, massG: 1200, featureId: 'north-works' } });
  const comparison = R.compareRuns(a, alteredMass, { observations: result.visible, probeIds: ['old-town'], variable: 'concentration', tolerance: 0.001 });
  assert.deepEqual(comparison.changedParameters, ['tracerPulse']);
  const confounded = R.gradeMission(result.mission, { ...result.answer, conclusionId: 'm5-timing-bounded', interpretationId: 'sensitivity-only', evidenceIds: [result.answer.evidenceIds[0], result.analysis.id, comparison.id] }, { ...result.context, comparisons: [comparison], snapshots: [a, alteredMass] });
  assert.equal(confounded.breakdown.experiment, 0, 'Changing release time and mass is not a controlled timing experiment');
});
test('case six isolates permeability on the retained parcel and requires the actual explicit rainfall envelope', () => {
  const config = W.createScenario('retention');
  const ensemble = P.ensemble(config, [52, 65, 78].map(rainfallMmHr => W.createScenario('retention', { rainfallMmHr })), { until: 3600, dt: 5 });
  const result = fixture({ missionId: 'waterline-briefing', a: saved('retention', { permeabilityMmHr: 28 }), b: saved('retention'), operation: 'profile', conclusionId: 'm6-limited-trial', measurementChoiceId: 'm6-withhold', ensemble }); fullScore(result);
  assert.equal(result.analysis.output.length, 31);
  assert.ok(ensemble.ranges['old-town'].at(-1).depthMax > ensemble.ranges['old-town'].at(-1).depthMin);
  const missing = R.gradeMission(result.mission, result.answer, { ...result.context, ensemble: undefined });
  assert.equal(missing.conclusionCorrect, false);
  assert.equal(R.gradeMission(result.mission, { ...result.answer, conclusionId: 'm6-defer', interpretationId: 'sensitivity-only' }, result.context).score, 100);
  const forged = copy(ensemble); forged.ranges['old-town'].at(-1).depthMax += 0.02;
  assert.equal(R.gradeMission(result.mission, result.answer, { ...result.context, ensemble: forged }).conclusionCorrect, false);
  const changedTerrain = P.ensemble(config, [52, 65, 78].map(rainfallMmHr => W.createScenario('retention', { rainfallMmHr, retentionM: 0.2 })), { until: 3600 });
  assert.equal(R.gradeMission(result.mission, result.answer, { ...result.context, ensemble: changedTerrain }).conclusionCorrect, false);
  const repeatedRain = P.ensemble(config, [52, 52, 52].map(rainfallMmHr => W.createScenario('retention', { rainfallMmHr })), { until: 3600 });
  assert.equal(R.gradeMission(result.mission, result.answer, { ...result.context, ensemble: repeatedRain }).conclusionCorrect, false);
  const packageChange = R.compareRuns(saved('baseline-storm'), saved('retention'), { observations: result.visible, probeIds: ['old-town', 'reed-marsh'] });
  assert.equal(packageChange.changedParameters.length, 2, 'The two-input package must not masquerade as a one-factor experiment');
});
