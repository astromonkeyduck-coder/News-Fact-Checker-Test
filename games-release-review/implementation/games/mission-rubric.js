(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./content') : root.NoteworthyContent, node ? require('./gis') : root.NoteworthyGIS, node ? require('./physics') : root.NoteworthyPhysics);
  if (node) module.exports = api; else root.NoteworthyMissionRubric = api;
})(typeof window === 'object' ? window : this, function (C, G, P) {
  'use strict';
  const VERSION = 1;
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const copy = value => JSON.parse(JSON.stringify(value));
  function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
  function stable(value) {
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
    return JSON.stringify(value);
  }
  function hash(value) { let n = 2166136261; for (const char of stable(value)) n = Math.imul(n ^ char.charCodeAt(0), 16777619); return (n >>> 0).toString(16).padStart(8, '0'); }
  const equivalent = (a, b) => stable(a) === stable(b);
  const parameterValue = (parameters, path) => path.split('.').reduce((value, key) => value?.[key], parameters);
  const readingTolerance = mission => mission.observationBinding.variables[0] === 'concentration' ? mission.observationBinding.concentrationToleranceGm3 ?? 0.001 : mission.observationBinding.depthToleranceM ?? 0.001;
  const rowsOf = observations => Array.isArray(observations) ? observations : observations?.rows || observations?.observations || [];
  function snapshotErrors(snapshot) {
    const errors = [];
    if (!snapshot?.id || !snapshot.scenarioId || !snapshot.scenarioVersion || snapshot.modelVersion !== P?.MODEL_VERSION || !finite(snapshot.duration) || snapshot.duration <= 0 || !snapshot.config || !snapshot.configFingerprint) return ['A complete versioned numerical snapshot is required.'];
    try { if (P.hash(P.normalize(snapshot.config)) !== snapshot.configFingerprint) errors.push('Snapshot configuration no longer matches its fingerprint.'); }
    catch (_) { errors.push('Snapshot configuration is invalid.'); }
    if (snapshot.config.id !== snapshot.scenarioId || snapshot.config.version !== snapshot.scenarioVersion) errors.push('Snapshot scenario identity does not match its configuration.');
    if (!snapshot.probeSeries || !Object.keys(snapshot.probeSeries).length) errors.push('The snapshot has no computed probe series.');
    for (const series of Object.values(snapshot.probeSeries || {})) {
      let previous = -1;
      if (!Array.isArray(series) || !series.length) { errors.push('A probe series is empty.'); continue; }
      for (const sample of series) {
        if (!finite(sample.t) || sample.t < 0 || sample.t > snapshot.duration + 1e-8 || sample.t <= previous || !finite(sample.depth) || sample.depth < 0 || (sample.concentration !== undefined && (!finite(sample.concentration) || sample.concentration < 0))) errors.push('Probe samples must be finite, nonnegative and ordered by simulation time.');
        previous = sample.t;
      }
    }
    return [...new Set(errors)];
  }
  function observationFit(snapshot, observations, options = {}) {
    const variable = options.variable || 'depth';
    const tolerance = finite(options.tolerance) && options.tolerance >= 0 ? options.tolerance : variable === 'depth' ? 0.001 : 0.000001;
    const rows = rowsOf(observations).filter(row => finite(row[variable]) && (!options.probeIds || options.probeIds.includes(row.featureId)));
    const samples = [], missing = [];
    for (const row of rows) {
      const sample = snapshot?.probeSeries?.[row.featureId]?.find(sample => sample.t === row.t);
      if (!sample || !finite(sample[variable])) { missing.push(row.id); continue; }
      const difference = Math.abs(sample[variable] - row[variable]);
      samples.push({ observationId: row.id, featureId: row.featureId, t: row.t, observed: row[variable], predicted: sample[variable], absoluteDifference: difference, withinTolerance: difference <= tolerance });
    }
    return { variable, tolerance, sampleCount: samples.length, requestedCount: rows.length, missingObservationIds: missing, complete: rows.length > 0 && missing.length === 0,
      meanAbsoluteError: samples.length ? samples.reduce((sum, sample) => sum + sample.absoluteDifference, 0) / samples.length : null,
      maximumAbsoluteError: samples.length ? Math.max(...samples.map(sample => sample.absoluteDifference)) : null,
      withinTolerance: rows.length > 0 && missing.length === 0 && samples.every(sample => sample.withinTolerance), samples };
  }
  function compareRuns(a, b, options = {}) {
    if (Array.isArray(options) || options?.rows) options = { observations: options };
    const errors = [...snapshotErrors(a), ...snapshotErrors(b)];
    if (errors.length) return freeze({ version: VERSION, kind: 'experiment-comparison', valid: false, errors: [...new Set(errors)] });
    const variable = options.variable || 'depth';
    if (!['depth', 'concentration'].includes(variable)) return freeze({ version: VERSION, kind: 'experiment-comparison', valid: false, errors: ['Unknown modeled variable.'] });
    const parametersA = a.config.parameters || {}, parametersB = b.config.parameters || {};
    const changedParameters = [...new Set([...Object.keys(parametersA), ...Object.keys(parametersB)])].filter(key => !equivalent(parametersA[key], parametersB[key])).sort();
    const parameterFields = { rainfallMmHr: ['rainfall'], rainfallSchedule: ['rainfall'], permeabilityMmHr: ['permeability'], drainageM3s: ['drains'], missingConnection: ['drains'], initialDepthM: ['initialDepth'], retentionM: ['terrain'], tracerPulse: ['pulses'], terrainEdits: ['terrain'] };
    const normalizedA = P.normalize(a.config), normalizedB = P.normalize(b.config);
    const metadataFields = ['id', 'version', 'name', 'fictional', 'crs', 'parameters', 'sampleEvery', 'probes'];
    const changedPhysicalFields = [...new Set([...Object.keys(normalizedA), ...Object.keys(normalizedB)])].filter(key => !metadataFields.includes(key) && !equivalent(normalizedA[key], normalizedB[key])).sort();
    const explainedFields = changedParameters.flatMap(key => parameterFields[key] || []);
    const unexplainedConfigChanges = changedPhysicalFields.filter(key => !explainedFields.includes(key));
    const probeIds = (options.probeIds || Object.keys(a.probeSeries).filter(id => b.probeSeries[id])).filter((id, index, ids) => ids.indexOf(id) === index).sort();
    const differentProbeLocations = probeIds.filter(id => {
      const first = normalizedA.probes.find(probe => probe.id === id), second = normalizedB.probes.find(probe => probe.id === id);
      return !first || !second || first.x !== second.x || first.y !== second.y;
    });
    const samples = [], missingProbeIds = [];
    for (const probeId of probeIds) {
      const seriesA = a.probeSeries[probeId], seriesB = b.probeSeries[probeId];
      if (!seriesA || !seriesB) { missingProbeIds.push(probeId); continue; }
      const other = new Map(seriesB.map(sample => [sample.t, sample]));
      for (const sampleA of seriesA) {
        const sampleB = other.get(sampleA.t);
        if (sampleB && finite(sampleA[variable]) && finite(sampleB[variable])) samples.push({ probeId, t: sampleA.t, a: sampleA[variable], b: sampleB[variable], difference: sampleB[variable] - sampleA[variable] });
      }
    }
    const fitA = observationFit(a, options.observations, { variable, tolerance: options.tolerance });
    const fitB = observationFit(b, options.observations, { variable, tolerance: options.tolerance });
    const core = { version: VERSION, kind: 'experiment-comparison', snapshotIds: [a.id, b.id], scenarioIds: [a.scenarioId, b.scenarioId], scenarioVersions: [a.scenarioVersion, b.scenarioVersion],
      modelVersion: a.modelVersion, configFingerprints: [a.configFingerprint, b.configFingerprint], parametersA: copy(parametersA), parametersB: copy(parametersB), changedParameters, changedPhysicalFields, unexplainedConfigChanges,
      durations: [a.duration, b.duration], sameDuration: a.duration === b.duration, sameModelVersion: a.modelVersion === b.modelVersion,
      variable, units: variable === 'depth' ? 'm' : 'g/m³', probeIds, missingProbeIds, differentProbeLocations, alignedSamples: samples.length, samples,
      meanAbsoluteDifference: samples.length ? samples.reduce((sum, sample) => sum + Math.abs(sample.difference), 0) / samples.length : null,
      maximumAbsoluteDifference: samples.length ? Math.max(...samples.map(sample => Math.abs(sample.difference))) : null,
      fitA, fitB, valid: a.id !== b.id && a.modelVersion === b.modelVersion && samples.length > 0 && !missingProbeIds.length && !differentProbeLocations.length,
      errors: [...(a.id === b.id ? ['Choose two distinct saved runs.'] : []), ...(samples.length ? [] : ['The probe series have no aligned samples.']), ...(differentProbeLocations.length ? ['Compared probe IDs must refer to the same locations in both runs.'] : [])],
      assumptions: ['Only identical saved sample times are compared; no interpolated evidence is invented.', 'Fits use the supplied observation snapshot and stated tolerance.', 'A one-factor response establishes model sensitivity, not independent real-world validation.'] };
    return freeze({ id: 'comparison-' + hash(core), ...core });
  }
  function analysisValid(record, mission) {
    const rule = mission.rubric.spatial;
    if (!record || !G || !record.id || !record.version || !record.scenarioId || !record.scenarioVersion || typeof record.units !== 'string' || !record.inputs || record.output === undefined) return false;
    const operation = record.operation === 'spatial-join' ? 'spatialJoin' : record.operation;
    if (!rule.operations.includes(operation) || !rule.units.includes(record.units.replace('²', '2'))) return false;
    const ids = record.inputs.featureIds;
    const required = record.operation === 'buffer' ? [rule.featureIds[0]] : rule.featureIds;
    if (!Array.isArray(ids) || !required.every(id => ids.includes(id))) return false;
    try {
      const expected = G.analyze(record.operation, record.inputs, { scenarioId: record.scenarioId, scenarioVersion: record.scenarioVersion, modelVersion: record.modelVersion, timeWindow: record.timeWindow });
      if (expected.id !== record.id || !equivalent(expected.output, record.output) || expected.crs !== record.crs) return false;
      const feature = id => C.world.features.find(feature => feature.id === id);
      const coordinate = value => Array.isArray(value) ? value : value?.geometry?.coordinates || [value?.x, value?.y];
      const matches = (value, id) => { const f = feature(id), p = coordinate(value); return f && p && p[0] === f.x && p[1] === f.y; };
      if (record.operation === 'buffer') {
        const range = rule.bufferRadiusRangeM || [0, Infinity];
        if (!matches(record.inputs.center, required[0]) || record.inputs.radiusM < range[0] || record.inputs.radiusM > range[1]) return false;
      }
      if (record.operation === 'distance' && !required.every(id => matches(record.inputs.from, id) || matches(record.inputs.to, id))) return false;
      if (record.operation === 'network' && !required.every(id => record.inputs.fromId === id || record.inputs.toId === id)) return false;
      if (record.operation === 'profile' && !required.every(id => matches(record.inputs.coordinates?.[0], id) || matches(record.inputs.coordinates?.at(-1), id))) return false;
      return true;
    } catch (_) { return false; }
  }
  function controlledComparison(record, mission) {
    const rule = mission.rubric.experiment;
    return record.valid && record.sameDuration && record.sameModelVersion && record.changedParameters.length === 1 && record.changedPhysicalFields.length > 0 && !record.unexplainedConfigChanges.length && rule.parameters.includes(record.changedParameters[0]) &&
      rule.heldConstant.every(parameter => equivalent(parameterValue(record.parametersA, parameter), parameterValue(record.parametersB, parameter))) &&
      Object.entries(rule.requiredParameters || {}).every(([parameter, value]) => equivalent(parameterValue(record.parametersA, parameter), value) && equivalent(parameterValue(record.parametersB, parameter), value)) &&
      (!rule.duration || record.durations.every(duration => duration === rule.duration)) &&
      record.meanAbsoluteDifference !== null && record.meanAbsoluteDifference > 1e-9 && rule.probeIds.every(id => record.probeIds.includes(id)) &&
      (!rule.requireObservationComparison || record.fitA.complete && record.fitB.complete);
  }
  function visibleRows(mission, observations, measurementChoiceId) {
    return C.visibleObservations(mission, { rows: rowsOf(observations) }, measurementChoiceId);
  }
  function inputRange(condition, ensemble, snapshots, mission) {
    if (ensemble?.modelVersion !== P.MODEL_VERSION || !Array.isArray(ensemble.variants) || ensemble.variants.length !== condition.values.length) return null;
    const values = ensemble.variants.map(config => parameterValue(config.parameters, condition.parameter));
    if (!equivalent(values.slice().sort((a, b) => a - b), condition.values.slice().sort((a, b) => a - b))) return null;
    const withoutInput = config => {
      const normalized = P.normalize(config), parameters = { ...normalized.parameters }; delete parameters[condition.parameter];
      const { id, version, name, rainfall, ...physical } = normalized;
      return { ...physical, parameters };
    };
    try {
      const baseline = ensemble.variants[0];
      if (!ensemble.variants.every(config => equivalent(withoutInput(config), withoutInput(baseline)) && Object.entries(condition.fixedParameters || {}).every(([key, value]) => equivalent(parameterValue(config.parameters, key), value)))) return null;
      if (!snapshots.some(snapshot => equivalent(withoutInput(snapshot.config), withoutInput(baseline)))) return null;
      // Re-run the bounded authored range: grading does not trust a clicked-tool flag or forged envelope.
      const actual = P.ensemble(baseline, ensemble.variants, { until: condition.duration, dt: 5 });
      if (!equivalent(actual.ranges, ensemble.ranges)) return null;
      const peaks = Object.fromEntries(mission.rubric.experiment.probeIds.map(id => {
        const values = actual.summaries.map(summary => summary.probes[id].peakDepth);
        return [id, { minimumPeakDepth: Math.min(...values), maximumPeakDepth: Math.max(...values), units: 'm' }];
      }));
      return { parameter: condition.parameter, values, duration: condition.duration, modelVersion: P.MODEL_VERSION, peaks, assumptions: actual.assumptions };
    } catch (_) { return null; }
  }
  function gradeMission(mission, answer = {}, context = {}) {
    const feedback = [], evidenceIds = Array.isArray(answer.evidenceIds) ? answer.evidenceIds : [];
    const analyses = Array.isArray(context.analyses) ? context.analyses : [], comparisons = Array.isArray(context.comparisons) ? context.comparisons : [], snapshots = Array.isArray(context.snapshots) ? context.snapshots : [];
    const knownIds = new Set([...mission.documents, ...analyses, ...comparisons].map(record => record.id));
    const selectionValid = evidenceIds.length > 0 && evidenceIds.length <= mission.rubric.maxEvidence && new Set(evidenceIds).size === evidenceIds.length && evidenceIds.every(id => knownIds.has(id));
    if (!selectionValid) feedback.push('Choose distinct, available evidence within the three-record limit. Opening every card earns no evidence credit.');
    const relevantDocument = selectionValid && evidenceIds.some(id => mission.rubric.decisiveEvidenceIds.includes(id));
    const validAnalyses = selectionValid ? analyses.filter(record => evidenceIds.includes(record.id) && analysisValid(record, mission)) : [];
    if (!validAnalyses.length) feedback.push('Pin a relevant computed GIS result with its actual inputs, feature IDs, units and version.');
    let observations = [];
    try { observations = visibleRows(mission, context.observations, answer.measurementChoiceId); }
    catch (_) { feedback.push('The mission observation policy could not be applied.'); }
    const validSnapshots = snapshots.filter(snapshot => snapshotErrors(snapshot).length === 0);
    const recalculated = selectionValid ? comparisons.filter(record => evidenceIds.includes(record.id)).map(record => {
      const a = validSnapshots.find(snapshot => snapshot.id === record.snapshotIds?.[0]), b = validSnapshots.find(snapshot => snapshot.id === record.snapshotIds?.[1]);
      return a && b ? compareRuns(a, b, { observations, probeIds: mission.rubric.experiment.probeIds, variable: mission.observationBinding.variables[0], tolerance: readingTolerance(mission) }) : null;
    }).filter(Boolean) : [];
    const controlled = recalculated.filter(record => controlledComparison(record, mission));
    const interpretationValid = mission.rubric.experiment.interpretationIds.includes(answer.interpretationId);
    if (!controlled.length) feedback.push('Pin a two-run comparison that changes one relevant factor, keeps the other inputs and duration fixed, and includes a changed numerical probe result.');
    if (!interpretationValid) feedback.push('Explain what the controlled result can establish; a map or matching curve is not independent causal proof.');
    const uncertaintyIds = Array.isArray(answer.uncertaintyIds) ? answer.uncertaintyIds : [];
    const uncertaintyValid = uncertaintyIds.length > 0 && uncertaintyIds.length <= mission.rubric.uncertainty.maxChoices && new Set(uncertaintyIds).size === uncertaintyIds.length && uncertaintyIds.every(id => mission.rubric.uncertainty.acceptedIds.includes(id));
    if (!uncertaintyValid) feedback.push('Choose a relevant limitation without a contradictory certainty claim.');
    const selectedConclusion = mission.conclusions.find(option => option.id === answer.conclusionId);
    const conditionResults = [];let inputRangeSummary = null;
    for (const condition of selectedConclusion?.conditions || []) {
      let passed = false, detail = '';
      if (condition.type === 'controlled-experiment') {
        passed = controlled.some(record => condition.parameter ? record.changedParameters.includes(condition.parameter) : condition.anyParameter?.some(parameter => record.changedParameters.includes(parameter)));
        detail = 'A relevant one-factor numerical experiment is required.';
      } else if (condition.type === 'acknowledge-nonidentifiability') {
        passed = uncertaintyValid && answer.interpretationId === 'sensitivity-only';
        detail = 'A bounded conclusion must distinguish model sensitivity from unique identification.';
      } else if (condition.type === 'observation-fit') {
        const choice = mission.measurementChoices.find(choice => choice.id === answer.measurementChoiceId);
        const heldOut = !condition.requireHeldOut || choice?.probeId && (!condition.heldOutProbeId || choice.probeId === condition.heldOutProbeId) && observations.some(row => row.featureId === choice.probeId);
        const fits = scenarioId => validSnapshots.filter(snapshot => snapshot.scenarioId === scenarioId).map(snapshot => observationFit(snapshot, observations, { variable: condition.variable || 'depth', tolerance: condition.tolerance }));
        const better = fits(condition.betterScenarioId), worse = fits(condition.thanScenarioId);
        passed = Boolean(heldOut && better.some(fit => fit.withinTolerance) && worse.some(fit => fit.complete && !fit.withinTolerance) && answer.interpretationId === 'heldout-discriminates');
        detail = 'The selected held-out measurement must favor one actual modeled prediction beyond the reading tolerance; a tiny numerical difference is insufficient.';
      } else if (condition.type === 'observation-compatibility') {
        const visible = condition.initialOnly ? visibleRows(mission, context.observations) : observations;
        passed = condition.scenarioIds.every(scenarioId => validSnapshots.some(snapshot => snapshot.scenarioId === scenarioId && observationFit(snapshot, visible, { variable: mission.observationBinding.variables[0], tolerance: readingTolerance(mission) }).withinTolerance));
        detail = 'Save both candidate hypotheses and show that each fits the actual initial observation at its stated tolerance.';
      } else if (condition.type === 'network-connected') {
        passed = validAnalyses.some(record => record.operation === 'network' && record.inputs.fromId === condition.fromId && record.inputs.toId === condition.toId && record.output.connected === true && (!condition.edgeId || record.output.edgeIds.includes(condition.edgeId)));
        detail = 'Pin the computed directed connection, including the optional edge used in this explanation.';
      } else if (condition.type === 'probe-directions') {
        passed = controlled.some(record => {
          if (!record.changedParameters.includes(condition.parameter)) return false;
          const pair = record.snapshotIds.map(id => validSnapshots.find(snapshot => snapshot.id === id));
          if (!pair.every(Boolean)) return false;
          pair.sort((a, b) => parameterValue(a.config.parameters, condition.parameter) - parameterValue(b.config.parameters, condition.parameter));
          return condition.expectations.every(expectation => {
            const values = pair.map(snapshot => {
              const rows = snapshot.probeSeries[expectation.probeId];
              return rows?.length ? Math.max(...rows.map(row => row[mission.observationBinding.variables[0]])) : NaN;
            });
            return values.every(finite) && (expectation.direction === 'increase' ? values[1] - values[0] > 0.000001 : values[0] - values[1] > 0.000001);
          });
        });
        detail = 'The complete saved series must show the claimed opposite peak directions at both receiving locations under the same controlled intervention.';
      } else if (condition.type === 'input-range') {
        inputRangeSummary = inputRange(condition, context.ensemble, validSnapshots, mission);passed = Boolean(inputRangeSummary);
        detail = 'Compute the specified three rainfall variants with the retained package and the other inputs fixed; a clicked button or a single favorable run is insufficient.';
      }
      conditionResults.push({ type: condition.type, passed, detail });
    }
    const conclusionValid = mission.rubric.acceptedConclusionIds.includes(answer.conclusionId) && conditionResults.length > 0 && conditionResults.every(result => result.passed);
    if (!conclusionValid) feedback.push(...conditionResults.filter(result => !result.passed).map(result => result.detail || 'The selected conclusion is not established by this evidence.'));
    if (!relevantDocument) feedback.push('Include a relevant source document alongside the computed map and experiment.');
    const weights = mission.rubric.weights;
    const breakdown = {
      conclusion: conclusionValid && relevantDocument && controlled.length && validAnalyses.length ? weights.conclusion : 0,
      spatial: validAnalyses.length ? weights.spatial : 0,
      experiment: controlled.length && interpretationValid ? weights.experiment : 0,
      uncertainty: uncertaintyValid ? weights.uncertainty : 0,
    };
    return freeze({ version: VERSION, score: Object.values(breakdown).reduce((sum, value) => sum + value, 0), maxScore: 100, breakdown,
      conclusionCorrect: Boolean(conclusionValid && relevantDocument && controlled.length && validAnalyses.length), selectionValid,
      evidenceIds: evidenceIds.slice(), conditionResults, feedback: [...new Set(feedback)], observedRowIds: observations.map(row => row.id),
      comparisonSummaries: controlled.map(record => ({ snapshotIds: record.snapshotIds, changedParameters: record.changedParameters, meanAbsoluteDifference: record.meanAbsoluteDifference, fitA: record.fitA, fitB: record.fitB })), inputRangeSummary,
      provenance: { contentVersion: mission.contentVersion, missionId: mission.id, missionVersion: mission.version, rubricVersion: VERSION, modelVersions: [...new Set(validSnapshots.map(snapshot => snapshot.modelVersion))], simulated: true },
      note: 'Fixed educational rubric for a saved game briefing. Local results are not verified public rankings or real-world operational conclusions.' });
  }
  return { VERSION, compareRuns, observationFit, gradeMission, snapshotErrors, analysisValid };
});
