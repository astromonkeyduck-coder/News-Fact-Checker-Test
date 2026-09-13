'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../../games/content');
const S = require('../../games/session');

test('the authored collection has validated metadata and honest review status', () => {
  assert.deepEqual(C.validate(), { ok: true, errors: [] });
  assert.equal(C.releaseScope.expectedMissions, 6);
  assert.equal(C.releaseScope.expectedCases, 6);
  assert.equal(C.releaseScope.expectedQuickChecks, 24);
  assert.equal(C.releaseScope.status, 'complete-authored-season');
  for (const item of [...C.missions, ...C.cases, ...C.quickChecks]) {
    assert.equal(item.editorialReview.status, 'pending-human-review');
    assert.equal(item.editorialReview.reviewer, null);
    assert.equal(item.provenance.sourceUrl, null);
    assert.match(item.provenance.label, /fictional.*simulation/i);
    assert.ok(Object.isFrozen(item));
  }
});

test('24 Quick Checks balance the four verdicts and require real two-record reasoning within a fixed rubric', () => {
  assert.equal(C.quickChecks.length,24);
  assert.deepEqual(Object.fromEntries(C.verdicts.map(verdict=>[verdict,C.quickChecks.filter(item=>item.rubric.verdict===verdict).length])),{supported:6,misleading:6,false:6,insufficient:6});
  const allIds=new Set(),positions=new Set();
  for(const item of C.quickChecks){
    assert.equal(item.evidence.length,3);assert.equal(item.reasons.length,3);assert.equal(item.verification.options.length,3);assert.equal(item.rubric.decisiveEvidenceIds.length,2);
    for(const entry of [item,...item.evidence,...item.reasons,...item.verification.options]){assert.ok(!allIds.has(entry.id),entry.id);allIds.add(entry.id);}
    positions.add(item.verification.options.findIndex(option=>option.id===item.rubric.verificationAnswer));
    for(const record of item.evidence){assert.ok(C.world.features.some(feature=>feature.id===record.featureId));assert.equal(record.provenance.sourceUrl,null);assert.ok(Object.isFrozen(record));}
    const answer={verdict:item.rubric.verdict,evidenceIds:item.rubric.decisiveEvidenceIds,reasonId:item.rubric.reasonId,verificationAnswer:item.rubric.verificationAnswer};
    assert.equal(S.gradeStage(item,answer).score,100);
    assert.equal(S.gradeStage(item,{...answer,evidenceIds:item.evidence.map(record=>record.id)}).evidenceCorrect,false);
    assert.equal(S.gradeStage(item,{...answer,evidenceIds:[item.rubric.decisiveEvidenceIds[0]]}).evidenceCorrect,false);
    assert.ok(item.explanation.length>50&&item.uncertainty.length>20&&item.additionalMeasurement.length>30);
  }
  assert.equal(allIds.size,240);assert.equal(positions.size,3,'correct options should not always occupy the same position');
});

test('quick-bank validation rejects a missing decisive source, repeated pair, or mismatched verification answer', () => {
  for(const mutate of [data=>data.quickChecks[0].rubric.decisiveEvidenceIds=['missing','q01-e1'],data=>data.quickChecks[0].rubric.decisiveEvidenceIds=['q01-e1','q01-e1'],data=>data.quickChecks[0].verification.answer='missing',data=>data.quickChecks[0].evidence=[]]){
    const data=JSON.parse(JSON.stringify({missions:C.missions,cases:C.cases,quickChecks:C.quickChecks}));mutate(data);assert.equal(C.validate(data).ok,false);
  }
});

test('the full mission and short-case catalog has distinct investigative work and chapter coverage', () => {
  assert.equal(C.missions.length, 6);assert.equal(C.cases.length, 6);assert.equal(C.chapters.length, 3);
  const chapterIds=C.chapters.flatMap(chapter=>{assert.equal(chapter.missionIds.length,2);return chapter.missionIds;});
  assert.deepEqual(chapterIds,C.missions.map(mission=>mission.id));
  assert.deepEqual(C.missions.map(mission=>mission.scenarioId),['blocked-drain','missing-connection','low-rain-restricted','baseline-storm','clock-offset','retention']);
  assert.equal(C.getMission('missing-connection').observationBinding.variables[0],'concentration');
  assert.equal(C.getMission('out-of-time').observationBinding.variables[0],'concentration');
  assert.ok(C.getMission('waterline-briefing').conclusions.filter(conclusion=>C.getMission('waterline-briefing').rubric.acceptedConclusionIds.includes(conclusion.id)).every(conclusion=>conclusion.conditions.some(condition=>condition.type==='input-range')));
  for(const file of C.cases){
    let total=0;
    for(const stage of file.stages){
      const answer={verdict:stage.rubric.verdict,evidenceIds:stage.rubric.decisiveEvidenceIds,reasonId:stage.rubric.reasonId,verificationAnswer:stage.rubric.verificationAnswer};
      const grade=S.gradeStage(stage,answer);total+=grade.score;
      assert.equal(S.gradeStage(stage,{...answer,evidenceIds:stage.evidence.map(item=>item.id)}).evidenceCorrect,false);
      assert.ok(stage.evidence.length>=3&&stage.evidence.length<=5);
    }
    assert.equal(total,100,file.id);
  }
});

test('authored numerical and source diagrams support the actual case reasoning', () => {
  const chart=C.getCase('cropped-axis').stages[0].evidence.find(item=>item.chart).chart;
  assert.deepEqual(chart.values,[75,80]);assert.equal(chart.values[1]-chart.values[0],5);assert.equal((chart.values[1]-chart.croppedMin)/(chart.values[0]-chart.croppedMin),2);
  assert.ok(Math.abs((32-30)/30*100-6.7)<0.05);
  assert.ok(72/100>100/200);assert.ok(72/90<90/100);assert.ok(0/10<10/100);
  const evolving=C.getCase('denominator-shift');assert.equal(evolving.stages[0].rubric.verdict,'insufficient');assert.equal(evolving.stages[1].rubric.verdict,'misleading');assert.ok(!evolving.stages[0].evidence.some(item=>item.id==='den2-districts'));
  const chain=C.getCase('source-echo').stages[0].evidence.find(item=>item.sourceChain).sourceChain;
  const parent=new Map(chain.edges.map(edge=>[edge.from,edge.to]));
  for(const source of ['harbor','roundup','brief']){let at=source;for(let i=0;i<chain.nodes.length&&parent.has(at);i++)at=parent.get(at);assert.equal(at,'observer');}
  const clocks=C.getCase('correction-record').stages[0].evidence.find(item=>item.timestamps).timestamps;
  assert.equal(Date.parse(clocks[1].value)-Date.parse(clocks[0].value),35*60000);
});

test('fictional map coordinates remain separate from the real atlas and the opening buffer is hand-checkable', () => {
  assert.equal(C.world.coordinateSystem.units, 'm');
  assert.equal(C.world.coordinateSystem.georeference, null);
  const works = C.world.features.find(feature => feature.id === 'north-works');
  const town = C.world.features.find(feature => feature.id === 'old-town');
  const distance = Math.hypot(works.x - town.x, works.y - town.y);
  assert.ok(Math.abs(distance - Math.sqrt(130000)) < 1e-9);
  assert.ok(distance < 400);
  for (const item of C.missions) {
    for (const record of item.documents) assert.ok(C.world.features.some(feature => feature.id === record.featureId));
    for (const choice of item.measurementChoices) assert.ok(choice.probeId === null || C.world.features.some(feature => feature.id === choice.probeId));
  }
});

test('an evolving case preserves two evidence snapshots with a fixed total reward', () => {
  const item = C.getCase('archive-frame');
  assert.equal(item.stages.reduce((sum, stage) => sum + stage.weight, 0), 100);
  assert.equal(item.stages[0].rubric.verdict, 'insufficient');
  assert.equal(item.stages[1].rubric.verdict, 'false');
  const firstIds = new Set(item.stages[0].evidence.map(evidence => evidence.id));
  assert.ok(!firstIds.has('af2-manifest'));
  assert.ok(!item.stages[0].evidence.some(evidence => evidence.body.includes('captured October 5')));
  assert.ok(item.stages[1].evidence.some(evidence => evidence.body.includes('captured October 5')));
  for (const stage of item.stages) {
    assert.ok(stage.evidence.length > stage.rubric.maxEvidence, 'opening or choosing everything must not solve the rubric');
    assert.ok(stage.rubric.decisiveEvidenceIds.length <= 2);
    assert.equal(stage.verification.answer, stage.rubric.verificationAnswer);
  }
});

test('rubric validation rejects duplicate IDs, unbounded evidence and invented review signoff', () => {
  for (const mutate of [
    data => { data.cases[0].stages[1].weight = 100; },
    data => { data.cases[0].stages[0].rubric.maxEvidence = 4; },
    data => { data.cases[0].stages[0].rubric.decisiveEvidenceIds = ['not-an-evidence-id']; },
    data => { data.cases[0].editorialReview.reviewer = 'An unverified human'; },
    data => { data.cases[0].stages[0].evidence[1].id = data.cases[0].stages[0].evidence[0].id; },
  ]) {
    const data = JSON.parse(JSON.stringify({ missions: C.missions, cases: C.cases, quickChecks: C.quickChecks }));
    mutate(data);
    assert.equal(C.validate(data).ok, false);
  }
});

test('mission rubric requires actual spatial and physical results and permits a bounded uncertain path', () => {
  const mission = C.getMission('map-everyone-shared');
  assert.deepEqual(mission.rubric.weights, { conclusion: 40, spatial: 20, experiment: 20, uncertainty: 20 });
  assert.equal(mission.rubric.spatial.requireComputedOutput, true);
  assert.equal(mission.rubric.experiment.requireDistinctRuns, true);
  assert.equal(mission.rubric.experiment.requireChangedNumericalOutput, true);
  assert.equal(mission.rubric.experiment.requireObservationComparison, true);
  const uncertain = mission.conclusions.find(choice => choice.id === 'm1-mechanism-not-unique');
  assert.ok(uncertain.conditions.some(condition => condition.type === 'acknowledge-nonidentifiability'));
  assert.ok(mission.rubric.acceptedConclusionIds.includes(uncertain.id));
  assert.ok(!mission.rubric.acceptedConclusionIds.includes('m1-proximity-proves-cause'));
  assert.equal(mission.observationBinding.status, 'awaiting-derived-bundle');
  assert.equal(mission.observations, undefined, 'authored text must not invent engine measurements');
});

test('binding derived observations copies and freezes them without changing the authored scenario or caller', () => {
  // This is an API validation fixture, not a claimed simulation output.
  const bundle = { configFingerprint: 'unit-test-fixture', rows: [{ id: 'fixture-1', featureId: 'old-town', t: 1, depth: 0.1, concentration: 0,
    provenance: { kind: 'synthetic-observation', scenarioId: 'blocked-drain', scenarioVersion: 'fixture', modelVersion: 'fixture' } }] };
  const bound = C.bindObservations('map-everyone-shared', bundle);
  assert.ok(Object.isFrozen(bound.observations.rows[0]));
  assert.equal(C.getMission('map-everyone-shared').observations, undefined);
  bundle.rows[0].depth = 999;
  assert.equal(bound.observations.rows[0].depth, 0.1);
  assert.equal(bound.observationBinding.status, 'derived');
  assert.throws(() => C.bindObservations('map-everyone-shared', { ...bundle, configFingerprint: '' }), /reproducible/);
  bundle.rows[0].provenance.scenarioId = 'sealed-works';
  assert.throws(() => C.bindObservations('map-everyone-shared', bundle), /provenance/);
});

test('the same authored content loads offline through its browser UMD export', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../games/content.js'), 'utf8'), context);
  const browser = context.window.NoteworthyContent;
  assert.equal(browser.version, C.version);
  assert.equal(browser.getCase('archive-frame').stages.length, 2);
  assert.equal(browser.validate().ok, true);
});
