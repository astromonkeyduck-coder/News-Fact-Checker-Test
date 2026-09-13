'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const worker = require('../../games/simulation-worker'); const P = require('../../games/physics'); const W = require('../../games/world');
test('worker replay and continuation return actual numerical state with matching request identities', () => {
  const config = W.createScenario('blocked-drain');
  const first = worker.dispatch({ requestId: 'r1', operation: 'replay', config, options: { until: 1200 } });
  assert.equal(first.requestId, 'r1'); assert.equal(first.result.t, 1200);
  const second = worker.dispatch({ requestId: 'r2', operation: 'run', state: first.result, options: { until: 1800 } });
  assert.equal(second.requestId, 'r2'); assert.equal(first.result.t, 1200);
  const direct = P.replay(config, { until: 1800 });
  assert.deepEqual(second.result.depth, direct.depth); assert.deepEqual(second.result.tracerMass, direct.tracerMass);
});
test('worker observations remain synthetic and ensembles compute actual distinct input runs', () => {
  const observed = worker.dispatch({ requestId: 3, operation: 'observations', scenarioId: 'blocked-drain', options: { times: [3600], featureIds: ['old-town'] } });
  assert.equal(observed.result.rows.length, 1); assert.equal(observed.result.rows[0].provenance.kind, 'synthetic-observation');
  const result = worker.dispatch({ requestId: 4, operation: 'ensemble', config: W.createScenario(), variants: [W.createScenario('baseline-storm', { rainfallMmHr: 55 }), W.createScenario('baseline-storm', { rainfallMmHr: 75 })], options: { until: 3600 } });
  assert.equal(result.result.summaries.length, 2);
  assert.ok(result.result.ranges['old-town'].at(-1).depthMax - result.result.ranges['old-town'].at(-1).depthMin > 0.02);
});
test('worker failure responses preserve the request ID and do not masquerade as successful results', () => {
  for (const request of [{ requestId: 'bad1', operation: 'replay', config: null }, { requestId: 'bad2', operation: 'unknown' }]) {
    const response = worker.dispatch(request); assert.equal(response.requestId, request.requestId); assert.ok(response.error); assert.equal(response.result, undefined);
  }
  assert.ok(worker.dispatch(null).error);
});
