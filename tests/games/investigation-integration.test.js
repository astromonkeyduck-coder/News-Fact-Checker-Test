'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const P = require('../../games/physics'); const W = require('../../games/world'); const G = require('../../games/gis');
const V = require('../../games/investigation-view'); const C = require('../../games/content'); const R = require('../../games/mission-rubric');
const worker = require('../../games/simulation-worker');
const mission = C.getMission('map-everyone-shared');
const clone = value => JSON.parse(JSON.stringify(value));
// Exercise the controller's persisted record format against the numerical,
// rubric, renderer and content modules. Browser event ordering is separate QA.
function snapshot(state, name) {
  return { id: `saved-${name}`, name, scenarioId: state.scenario.id, scenarioVersion: state.scenario.version, modelVersion: state.modelVersion,
    config: clone(state.config), configFingerprint: state.scenario.fingerprint, duration: state.t, probeSeries: clone(state.sensorHistory), state: P.serialize(state) };
}
function simulate(id, parameters) {
  const response = worker.dispatch({ requestId: id, operation: 'replay', config: W.createScenario(id, parameters), options: { until: 3600, dt: 5 } });
  assert.equal(response.error, undefined); return response.result;
}
const baseState = simulate('baseline-storm'); const blockedState = simulate('blocked-drain'); const sealedState = simulate('sealed-works');
const baseline = snapshot(baseState, 'baseline'); const blocked = snapshot(blockedState, 'blocked'); const sealed = snapshot(sealedState, 'sealed');
const fixed = W.observations(P, mission.observationBinding.referenceScenarioId, { times: [3600, 2400], featureIds: ['old-town', 'north-works', 'east-wharf'] });
const geoRows = choice => C.visibleObservations(mission, fixed, choice).map(row => {
  const feature = W.feature(row.featureId);
  return { ...row, x: feature.x, y: feature.y, geometry: clone(feature.geometry) };
});
test('a 3600-second worker run survives nested guest-save JSON and snapshot restore exactly', () => {
  const run = { phase: 'active', simulation: P.serialize(blockedState), observed: fixed, workspace: { snapshots: [blocked], selected: 'old-town' } };
  const persisted = JSON.parse(JSON.stringify(run));
  assert.equal(typeof persisted.simulation, 'string');
  const restored = P.restore(persisted.simulation); const selected = P.restore(persisted.workspace.snapshots[0].state);
  assert.equal(restored.t, 3600); assert.deepEqual(restored.depth, selected.depth); assert.deepEqual(restored.tracerMass, selected.tracerMass);
  assert.deepEqual(restored.sensorHistory, persisted.workspace.snapshots[0].probeSeries);
  assert.deepEqual(R.snapshotErrors(persisted.workspace.snapshots[0]), []);
  assert.equal(P.hash(P.normalize(persisted.workspace.snapshots[0].config)), persisted.workspace.snapshots[0].configFingerprint);
});
test('withProbe returns a new full state with a restorable config, without altering water or previous history', () => {
  const before = P.serialize(blockedState); const placed = P.withProbe(blockedState, { id: 'probe-625-425', x: 625, y: 425 });
  assert.equal(P.serialize(blockedState), before); assert.equal(placed.t, blockedState.t);
  assert.deepEqual(placed.depth, blockedState.depth); assert.deepEqual(placed.tracerMass, blockedState.tracerMass);
  const saved = snapshot(placed, 'with-probe'); const restored = P.restore(saved.state);
  assert.deepEqual(R.snapshotErrors(saved), []);
  assert.equal(P.sample(restored, 'probe-625-425').depth, restored.depth[P.indexAt(restored.grid, [625, 425])]);
  assert.throws(() => P.sample(P.create(W.createScenario()), 'probe-625-425'), /Unknown probe/, 'The controller must reset a selected probe when replacing its configuration');
});
test('fixed evidence masking survives saving, GIS coordinate enrichment and alternate model runs', () => {
  const before = JSON.stringify(fixed); const restored = JSON.parse(before); const bound = C.bindObservations(mission.id, restored);
  const initial = C.visibleObservations(bound, restored);
  assert.deepEqual(initial.map(row => [row.featureId, row.t]), [['old-town', 3600]]);
  for (const choice of [undefined, 'm1-measure-works', 'm1-measure-wharf']) {
    const rows = geoRows(choice);
    assert.equal(rows.length, choice ? 2 : 1);
    assert.ok(rows.every(row => !Object.hasOwn(row, 'concentration')));
    assert.ok(rows.every(row => row.featureId === 'old-town' && row.t === 3600 || row.featureId === (choice === 'm1-measure-works' ? 'north-works' : 'east-wharf') && row.t === 2400));
    const selected = G.select(rows, G.buffer(W.feature('north-works'), 400));
    assert.ok(selected.every(row => rows.some(source => source.id === row.id)));
    const joined = G.spatialJoin(rows, W.zones); assert.equal(joined.assignments.length, rows.length);
    const html = V.map({ state: sealedState, world: W, observations: rows, layers: [{ id: 'observations' }] });
    assert.match(html, /class="inv-map-observation"/);
    assert.doesNotMatch(V.graph({ series: [], observations: rows, variable: 'concentration', probeId: 'old-town' }), /inv-plot-observed/);
  }
  assert.equal(JSON.stringify(fixed), before);
  assert.throws(() => C.bindObservations(mission.id, {}), /observation bundle/);
  assert.throws(() => C.bindObservations(mission.id, W.observations(P, 'sealed-works')), /provenance/);
});
test('a controller-shaped GIS pin with model provenance remains valid after JSON persistence and rubric recomputation', () => {
  const analysis = G.analyze('buffer', { center: W.feature('north-works'), radiusM: 400, featureIds: ['north-works', 'old-town'] },
    { scenarioId: baseState.scenario.id, scenarioVersion: baseState.scenario.version, modelVersion: baseState.modelVersion, timeWindow: null });
  const saved = clone(analysis);
  assert.equal(saved.modelVersion, P.MODEL_VERSION); assert.equal(R.analysisValid(saved, mission), true);
  assert.ok(G.select(W.features, saved.output).some(feature => feature.id === 'old-town'));
  const comparison = R.compareRuns(baseline, blocked, { observations: geoRows(), probeIds: mission.rubric.experiment.probeIds, variable: 'depth', tolerance: 0.001 });
  const answer = { conclusionId: 'm1-mechanism-not-unique', evidenceIds: ['m1-observation-register', saved.id, comparison.id],
    uncertaintyIds: ['m1-model-limits', 'm1-proximity-limit'], measurementChoiceId: 'm1-withhold-measurement', interpretationId: 'sensitivity-only' };
  const grade = R.gradeMission(mission, answer, { analyses: [saved], comparisons: [clone(comparison)], snapshots: clone([baseline, blocked, sealed]), observations: clone(fixed) });
  assert.equal(grade.score, 100); assert.equal(grade.breakdown.spatial, 20);
  assert.deepEqual(grade.observedRowIds, ['blocked-drain:old-town:3600']);
});
test('controlled comparisons use saved numerical outputs and distinguish the allowed held-out choices', () => {
  const initial = R.compareRuns(blocked, sealed, { observations: geoRows(), probeIds: ['old-town'] });
  assert.equal(initial.fitA.withinTolerance, true); assert.equal(initial.fitB.withinTolerance, true);
  const works = R.compareRuns(blocked, sealed, { observations: geoRows('m1-measure-works'), probeIds: ['old-town'] });
  assert.equal(works.fitA.withinTolerance, true); assert.equal(works.fitB.withinTolerance, false);
  const wharf = R.compareRuns(blocked, sealed, { observations: geoRows('m1-measure-wharf'), probeIds: ['old-town'] });
  assert.equal(wharf.fitA.withinTolerance, true); assert.equal(wharf.fitB.withinTolerance, true);
  const restored = P.restore(blocked.state);
  const graph = V.graph({ series: [{ name: blocked.name, rows: restored.sensorHistory['old-town'] }], observations: geoRows(), variable: 'depth', probeId: 'old-town' });
  assert.match(graph, /Saved|Supplied observation/); assert.match(graph, /0.119023/);
});
test('painted grid layers do not flood the accessibility tree while named locations remain keyboard targets', () => {
  const html = V.map({ state: baseState, world: W });
  const layers = [...html.matchAll(/<g data-map-layer="[^"]+"[^>]*>/g)].map(match => match[0]);
  assert.ok(layers.length > 0 && layers.every(layer => layer.includes('aria-hidden="true"')));
  assert.match(html, /data-feature-id="old-town" role="button" tabindex="0"/);
});
