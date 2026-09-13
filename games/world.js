(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NoteworthyWorld = api;
})(typeof window === 'object' ? window : this, function () {
  'use strict';
  const VERSION = 1;
  const CRS = 'MEREHAVEN-LOCAL-METRES';
  const grid = { nx: 24, ny: 16, dx: 50, dy: 50, x0: 0, y0: 0 };
  const extent = [0, 0, 1200, 800];
  const clone = value => JSON.parse(JSON.stringify(value));
  function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
  const features = freeze([
    { id: 'north-works', name: 'North Works', x: 325, y: 675, kind: 'development', geometry: { type: 'Point', coordinates: [325, 675] }, properties: { landUse: 'workshops', fictional: true } },
    { id: 'old-town', name: 'Old Town', x: 525, y: 375, kind: 'neighborhood', geometry: { type: 'Point', coordinates: [525, 375] }, properties: { landUse: 'homes and shops', fictional: true } },
    { id: 'reed-marsh', name: 'Reed Marsh', x: 775, y: 225, kind: 'wetland', geometry: { type: 'Point', coordinates: [775, 225] }, properties: { landUse: 'marsh', fictional: true } },
    { id: 'east-wharf', name: 'East Wharf', x: 1025, y: 375, kind: 'infrastructure', geometry: { type: 'Point', coordinates: [1025, 375] }, properties: { landUse: 'wharf and storehouse', fictional: true } },
    { id: 'south-outfall', name: 'South Outfall', x: 775, y: 25, kind: 'outfall', geometry: { type: 'Point', coordinates: [775, 25] }, properties: { landUse: 'outfall', fictional: true } },
  ]);
  const feature = id => features.find(item => item.id === id) || null;
  const ring = (west, south, east, north) => [[west, south], [east, south], [east, north], [west, north], [west, south]];
  const zones = freeze([
    { id: 'works-zone', name: 'North Works parcel', geometry: { type: 'Polygon', coordinates: [ring(200, 550, 450, 800)] }, properties: { featureId: 'north-works', permeabilityMmHr: 28, fictionalPopulation: 0, fictional: true } },
    { id: 'town-zone', name: 'Old Town basin', geometry: { type: 'Polygon', coordinates: [ring(400, 250, 650, 500)] }, properties: { featureId: 'old-town', permeabilityMmHr: 4, fictionalPopulation: 340, fictional: true } },
    { id: 'marsh-zone', name: 'Reed Marsh', geometry: { type: 'Polygon', coordinates: [ring(650, 100, 900, 350)] }, properties: { featureId: 'reed-marsh', permeabilityMmHr: 42, fictionalPopulation: 0, fictional: true } },
    { id: 'wharf-zone', name: 'East Wharf', geometry: { type: 'Polygon', coordinates: [ring(900, 250, 1150, 500)] }, properties: { featureId: 'east-wharf', permeabilityMmHr: 3, fictionalPopulation: 40, fictional: true } },
  ]);
  const roads = freeze([
    { id: 'works-road', name: 'Works Road', geometry: { type: 'LineString', coordinates: [[325, 675], [525, 675], [525, 375]] }, properties: { kind: 'road', fictional: true } },
    { id: 'wharf-road', name: 'Wharf Road', geometry: { type: 'LineString', coordinates: [[125, 375], [525, 375], [1025, 375]] }, properties: { kind: 'road', fictional: true } },
    { id: 'marsh-walk', name: 'Marsh Walk', geometry: { type: 'LineString', coordinates: [[525, 375], [775, 225], [775, 25]] }, properties: { kind: 'path', fictional: true } },
  ]);
  const drainage = freeze({ nodes: features.map(item => ({ id: item.id, x: item.x, y: item.y })), edges: [
    { id: 'works-town', from: 'north-works', to: 'old-town', capacityM3s: 0.12, directed: true, optional: false },
    { id: 'town-marsh', from: 'old-town', to: 'reed-marsh', capacityM3s: 0.18, directed: true, optional: false },
    { id: 'marsh-outfall', from: 'reed-marsh', to: 'south-outfall', capacityM3s: 0.08, directed: true, optional: false },
    { id: 'wharf-outfall', from: 'east-wharf', to: 'south-outfall', capacityM3s: 0.06, directed: true, optional: false },
    { id: 'works-wharf', from: 'north-works', to: 'east-wharf', capacityM3s: 0.10, directed: true, optional: true },
  ] });
  const probes = freeze(features.map(item => ({ id: item.id, name: item.name, x: item.x, y: item.y })));
  const scenarios = freeze([
    { id: 'baseline-storm', name: 'Maintained drainage', description: 'Reference inputs: the recorded network, mixed land surfaces and a 65 mm/h synthetic storm.', parameters: {} },
    { id: 'sealed-works', name: 'Less permeable North Works', description: 'Only the Works parcel permeability changes; the same storm and drains remain.', parameters: { permeabilityMmHr: 2 } },
    { id: 'blocked-drain', name: 'Restricted Old Town drain', description: 'Only the Old Town drain capacity changes; the same storm and land surfaces remain.', parameters: { drainageM3s: 0.005 } },
    { id: 'missing-connection', name: 'Unmapped Works–Wharf link', description: 'An optional directed drain connects North Works to East Wharf.', parameters: { missingConnection: true } },
    { id: 'clock-offset', name: 'Later tracer release', description: 'The recorded network stays unchanged; the harmless tracer release happens 10 minutes later.', parameters: { tracerPulse: { at: 1200, massG: 600, featureId: 'north-works' } } },
    { id: 'retention', name: 'Upstream retention and permeable surface', description: 'A lowered Works parcel and higher permeability store and infiltrate more stormwater. This changes two inputs and is labeled accordingly.', parameters: { permeabilityMmHr: 48, retentionM: 0.10 } },
    { id: 'fast-drain', name: 'Expanded Old Town drain', description: 'The town-to-marsh drain can transfer more water under the same storm.', parameters: { drainageM3s: 0.65 } },
    { id: 'low-rain-restricted', name: 'Lighter rain, restricted drain', description: 'A two-input hypothesis: 55 mm/h rainfall and a 0.05 m³/s town drain. One final town reading does not distinguish it from the paired heavier-rain hypothesis.', parameters: { rainfallMmHr: 55, drainageM3s: 0.05 } },
    { id: 'high-rain-open', name: 'Heavier rain, open drain', description: 'A two-input hypothesis: 75 mm/h rainfall and a 0.45 m³/s town drain. Another location can distinguish it from the lighter-rain hypothesis.', parameters: { rainfallMmHr: 75, drainageM3s: 0.45 } },
    { id: 'dry-control', name: 'Dry control', description: 'No initial water, rain or tracer. A limiting-case experiment.', parameters: { rainfallMmHr: 0, initialDepthM: 0, tracerPulse: { at: 600, massG: 0, featureId: 'north-works' } } },
  ]);
  function cell(point) { return Math.floor(point[1] / grid.dy) * grid.nx + Math.floor(point[0] / grid.dx); }
  function createScenario(id = 'baseline-storm', overrides = {}) {
    const definition = scenarios.find(item => item.id === id); if (!definition) throw new Error('Unknown named scenario');
    const params = { rainfallMmHr: 65, permeabilityMmHr: 28, drainageM3s: 0.18, missingConnection: false, initialDepthM: 0.005, retentionM: 0,
      tracerPulse: { at: 600, massG: 600, featureId: 'north-works' }, terrainEdits: [], ...clone(definition.parameters), ...clone(overrides) };
    for (const [key, max] of [['rainfallMmHr', 200], ['permeabilityMmHr', 100], ['drainageM3s', 2], ['initialDepthM', 0.25], ['retentionM', 0.5]]) {
      if (!Number.isFinite(params[key]) || params[key] < 0 || params[key] > max) throw new Error(`Invalid ${key}`);
    }
    if (typeof params.missingConnection !== 'boolean') throw new Error('missingConnection must be true or false');
    if (Object.prototype.hasOwnProperty.call(params, 'rainfallSchedule')) {
      if (!Array.isArray(params.rainfallSchedule) || params.rainfallSchedule.length > 3 || params.rainfallSchedule.some(item => !item || !Number.isFinite(item.start) || !Number.isFinite(item.end) || !Number.isFinite(item.mmHr) || item.start < 0 || item.end > 3600 || item.end <= item.start || item.mmHr < 0 || item.mmHr > 200)) throw new Error('rainfallSchedule needs at most three valid intervals within 0–3600 seconds and 0–200 mm/h');
      params.rainfallSchedule = params.rainfallSchedule.map(({ start, end, mmHr }) => ({ start, end, mmHr })).sort((a, b) => a.start - b.start);
      if (params.rainfallSchedule.some((item, index) => index && item.start < params.rainfallSchedule[index - 1].end)) throw new Error('rainfallSchedule intervals must not overlap');
    }
    const terrain = []; const permeability = []; const initialDepth = [];
    for (let y = 0; y < grid.ny; y++) for (let x = 0; x < grid.nx; x++) {
      const cx = (x + 0.5) * 50; const cy = (y + 0.5) * 50;
      const town = Math.exp(-(((cx - 525) / 110) ** 2 + ((cy - 375) / 110) ** 2));
      const wharf = Math.exp(-(((cx - 1025) / 90) ** 2 + ((cy - 375) / 100) ** 2));
      let z = 0.002 * cy + 0.0004 * (1200 - cx) - 0.28 * town - 0.50 * wharf;
      let k = 12;
      if (cx >= 200 && cx < 450 && cy >= 550) { k = params.permeabilityMmHr; z -= params.retentionM; }
      if (cx >= 400 && cx < 650 && cy >= 250 && cy < 500) k = 4;
      if (cx >= 650 && cx < 900 && cy >= 100 && cy < 350) k = 42;
      if (cx >= 900 && cx < 1150 && cy >= 250 && cy < 500) k = 3;
      terrain.push(z); permeability.push(k); initialDepth.push(params.initialDepthM);
    }
    if (!Array.isArray(params.terrainEdits) || params.terrainEdits.length > grid.nx * grid.ny) throw new Error('Terrain edits must be a bounded list');
    const editedCells = new Set();
    params.terrainEdits.forEach(edit => { if (!Number.isInteger(edit.index) || edit.index < 0 || edit.index >= terrain.length || editedCells.has(edit.index) || !Number.isFinite(edit.deltaM) || Math.abs(edit.deltaM) > 0.5) throw new Error('Terrain edits must be unique valid cell changes within ±0.5 m'); editedCells.add(edit.index); terrain[edit.index] += edit.deltaM; });
    const drains = drainage.edges.map(edge => ({ id: edge.id, from: cell([feature(edge.from).x, feature(edge.from).y]), to: cell([feature(edge.to).x, feature(edge.to).y]),
      capacityM3s: edge.id === 'town-marsh' ? params.drainageM3s : edge.capacityM3s, conductanceM2s: 5, enabled: !edge.optional || params.missingConnection }));
    drains.push({ id: 'outfall-exit', from: cell([775, 25]), to: null, capacityM3s: 0.5, conductanceM2s: 5 });
    const pulse = params.tracerPulse; const source = feature(pulse?.featureId);
    if (!source || !Number.isFinite(pulse.at) || pulse.at < 0 || pulse.at > 7200 || !Number.isFinite(pulse.massG) || pulse.massG < 0 || pulse.massG > 5000) throw new Error('Tracer pulse needs a known feature, 0–7200 seconds and 0–5000 grams');
    return { id, version: VERSION, name: definition.name, fictional: true, crs: CRS, parameters: params, grid: { ...grid }, terrain, permeability, initialDepth,
      roughness: 0.08, rainfall: params.rainfallSchedule ? clone(params.rainfallSchedule) : [{ start: 0, end: 2700, mmHr: params.rainfallMmHr }], dispersionM2s: 0.25,
      drains, pulses: [{ at: pulse.at, massG: pulse.massG, cell: cell([source.x, source.y]) }], probes: clone(probes), boundary: { type: 'south-open', levelM: 0 }, sampleEvery: 60 };
  }
  function observations(physics, scenarioId = 'blocked-drain', options = {}) {
    if (!physics?.replay) throw new Error('The numerical engine is required to compute synthetic observations');
    const times = options.times || [600, 1200, 1800, 2400, 3600]; const selected = options.featureIds || probes.map(item => item.id);
    const config = createScenario(scenarioId, options.overrides || {});
    const state = physics.replay(config, { until: Math.max(...times), dt: 5, sampleEvery: 60 });
    const rows = [];
    selected.forEach(id => {
      if (!feature(id)) throw new Error('Unknown observation feature');
      times.forEach(t => {
        const value = state.sensorHistory[id].find(item => item.t === t);
        if (!value) throw new Error('Observation times must fall on the 60-second saved clock');
        const point = feature(id);
        rows.push({ id: `${scenarioId}:${id}:${t}`, featureId: id, t, x: point.x, y: point.y, geometry: { type: 'Point', coordinates: [point.x, point.y] }, depth: value.depth, concentration: value.concentration,
          provenance: { kind: 'synthetic-observation', scenarioId, scenarioVersion: VERSION, modelVersion: physics.MODEL_VERSION, fingerprint: state.scenario.fingerprint, note: 'Generated by the same educational model; not an independent validation or real measurement.' } });
      });
    });
    return freeze({ version: VERSION, id: `observations:${scenarioId}`, fictional: true, scenario: clone(state.scenario), configFingerprint: state.scenario.fingerprint, config, rows, observations: rows, summary: physics.summary(state) });
  }
  function ensemble(physics, scenarioId, parameterVariants, options = {}) {
    const result = physics.ensemble(createScenario(scenarioId), parameterVariants.map(parameters => createScenario(scenarioId, parameters)), options);
    result.parameterVariants = clone(parameterVariants); return result;
  }
  return { VERSION, CRS, grid: freeze(grid), extent: freeze(extent), features, zones, roads, drainage, probes, scenarios, feature, createScenario, observations, ensemble };
});
