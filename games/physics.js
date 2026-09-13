(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NoteworthyPhysics = api;
})(typeof window === 'object' ? window : this, function () {
  'use strict';
  const VERSION = 1;
  const MODEL_VERSION = 'waterline-fv-1';
  const MAX_STEP = 5;
  const EPS = 1e-12;
  const clone = value => JSON.parse(JSON.stringify(value));
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const sum = values => values.reduce((total, value) => total + value, 0);
  function assert(condition, message) { if (!condition) throw new Error(message); }
  function hash(value) { const text = JSON.stringify(value); let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return (h >>> 0).toString(16).padStart(8, '0'); }
  function gridFor(input) {
    const g = { nx: 24, ny: 16, dx: 50, dy: 50, x0: 0, y0: 0, ...(input || {}) };
    assert(Number.isInteger(g.nx) && Number.isInteger(g.ny) && g.nx > 0 && g.ny > 0 && g.nx * g.ny <= 10000, 'Grid must contain 1–10000 cells');
    assert([g.dx, g.dy].every(value => finite(value) && value > 0) && [g.x0, g.y0].every(finite), 'Grid coordinates and dimensions must use finite metres');
    return g;
  }
  function indexAt(grid, point) {
    const g = gridFor(grid); const p = Array.isArray(point) ? point : [point?.x, point?.y];
    assert(p.length >= 2 && p.every(finite), 'A probe needs finite x/y metres');
    const x = Math.floor((p[0] - g.x0) / g.dx); const y = Math.floor((p[1] - g.y0) / g.dy);
    assert(x >= 0 && x < g.nx && y >= 0 && y < g.ny, 'Point lies outside the modeled cells');
    return y * g.nx + x;
  }
  function center(grid, index) { return [grid.x0 + (index % grid.nx + 0.5) * grid.dx, grid.y0 + (Math.floor(index / grid.nx) + 0.5) * grid.dy]; }
  function field(value, count, fallback, nonnegative = true) {
    const values = Array.isArray(value) ? value.slice() : Array(count).fill(value === undefined ? fallback : value);
    assert(values.length === count && values.every(item => finite(item) && (!nonnegative || item >= 0)), 'Invalid cell field');
    return values;
  }
  function normalize(input) {
    assert(input && typeof input === 'object', 'Scenario configuration is required');
    const config = clone(input); config.grid = gridFor(config.grid); const n = config.grid.nx * config.grid.ny;
    config.id = config.id || 'custom'; config.version = config.version || 1;
    assert(typeof config.id === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(config.id) && Number.isInteger(config.version) && config.version > 0, 'Scenario identity is invalid');
    config.terrain = field(config.terrain, n, 0, false);
    config.initialDepth = field(config.initialDepth, n, 0);
    config.initialTracerMass = field(config.initialTracerMass, n, 0);
    config.permeability = field(config.permeability ?? config.permeabilityMmHr, n, 0);
    config.roughness = field(config.roughness, n, 0.08);
    assert(config.roughness.every(value => value >= 0.01 && value <= 1), 'Manning roughness must be between 0.01 and 1 s/m^(1/3)');
    config.rainfall = config.rainfall || [{ start: 0, end: 3600, mmHr: config.rainfallMmHr ?? 0 }];
    assert(Array.isArray(config.rainfall) && config.rainfall.every(item => finite(item.start) && finite(item.end) && item.start >= 0 && item.end > item.start && finite(item.mmHr) && item.mmHr >= 0 && item.mmHr <= 500), 'Rainfall needs bounded nonnegative rates and valid second intervals');
    config.rainfall.sort((a, b) => a.start - b.start);
    assert(config.rainfall.every((item, index) => !index || item.start >= config.rainfall[index - 1].end), 'Rain intervals must not overlap');
    config.dispersionM2s = config.dispersionM2s ?? 0.25;
    assert(finite(config.dispersionM2s) && config.dispersionM2s >= 0 && config.dispersionM2s <= 10, 'Dispersion must be 0–10 m²/s');
    config.drains = config.drains || [];
    const ids = new Set();
    assert(Array.isArray(config.drains) && config.drains.every(edge => {
      const valid = typeof edge.id === 'string' && !ids.has(edge.id) && Number.isInteger(edge.from) && edge.from >= 0 && edge.from < n &&
        (edge.to === null || Number.isInteger(edge.to) && edge.to >= 0 && edge.to < n && edge.to !== edge.from) &&
        finite(edge.capacityM3s) && edge.capacityM3s >= 0 && edge.capacityM3s <= 100;
      ids.add(edge.id); return valid;
    }), 'Drain links require unique identities, cells and 0–100 m³/s capacities');
    config.drains = config.drains.map(edge => ({ ...edge, conductanceM2s: edge.conductanceM2s ?? 5, enabled: edge.enabled !== false }));
    assert(config.drains.every(edge => finite(edge.conductanceM2s) && edge.conductanceM2s >= 0), 'Drain conductance must be finite and nonnegative');
    config.boundary = config.boundary || { type: 'closed' };
    assert(['closed', 'south-open'].includes(config.boundary.type), 'Only closed or south-open boundary is supported');
    config.boundary.levelM = config.boundary.levelM ?? 0;
    assert(finite(config.boundary.levelM), 'Boundary level must be finite');
    config.pulses = config.pulses || [];
    assert(Array.isArray(config.pulses) && config.pulses.every(pulse => finite(pulse.at) && pulse.at >= 0 && finite(pulse.massG) && pulse.massG >= 0 && Number.isInteger(pulse.cell) && pulse.cell >= 0 && pulse.cell < n), 'Tracer pulses need valid time, mass and cell');
    config.probes = config.probes || [];
    const probes = new Set();
    config.probes.forEach(probe => { assert(typeof probe.id === 'string' && !probes.has(probe.id), 'Probe IDs must be unique'); indexAt(config.grid, probe); probes.add(probe.id); });
    config.sampleEvery = config.sampleEvery ?? 60;
    assert(finite(config.sampleEvery) && config.sampleEvery > 0, 'Sample interval must be positive seconds');
    return config;
  }
  function updateBudget(state) {
    const b = state.budget; const area = state.grid.dx * state.grid.dy;
    b.water.stored = sum(state.depth) * area;
    b.tracer.stored = sum(state.tracerMass);
    b.water.error = b.water.initial + b.water.rainfall - b.water.infiltrated - b.water.drained - b.water.boundaryOut - b.water.stored;
    b.tracer.error = b.tracer.initial + b.tracer.injected - b.tracer.infiltrated - b.tracer.drained - b.tracer.boundaryOut - b.tracer.stored;
  }
  function sample(state, location) {
    const probe = typeof location === 'string' ? state.config.probes.find(item => item.id === location) : location;
    assert(probe, 'Unknown probe'); const index = indexAt(state.grid, probe); const volume = state.depth[index] * state.grid.dx * state.grid.dy;
    return { t: state.t, index, depth: state.depth[index], tracerMass: state.tracerMass[index], concentration: volume > EPS ? state.tracerMass[index] / volume : 0, terrain: state.terrain[index], x: center(state.grid, index)[0], y: center(state.grid, index)[1] };
  }
  function record(state) {
    state.config.probes.forEach(probe => {
      const series = state.sensorHistory[probe.id] || (state.sensorHistory[probe.id] = []);
      const value = sample(state, probe);
      if (series.length && Math.abs(series[series.length - 1].t - state.t) < EPS) series[series.length - 1] = value;
      else series.push(value);
    });
  }
  function inject(state) {
    state.config.pulses.forEach((pulse, i) => {
      if (!state.injectedPulses.includes(i) && pulse.at <= state.t + EPS) {
        state.tracerMass[pulse.cell] += pulse.massG; state.budget.tracer.injected += pulse.massG; state.injectedPulses.push(i);
      }
    });
  }
  function create(input) {
    const config = normalize(input); const area = config.grid.dx * config.grid.dy;
    const state = { version: VERSION, modelVersion: MODEL_VERSION, scenario: { id: config.id, version: config.version, fingerprint: hash(config) }, t: 0,
      grid: { ...config.grid }, config, terrain: config.terrain.slice(), depth: config.initialDepth.slice(), tracerMass: config.initialTracerMass.slice(),
      injectedPulses: [], sensorHistory: {}, steps: 0, limitedSteps: 0,
      budget: { water: { initial: sum(config.initialDepth) * area, rainfall: 0, infiltrated: 0, drained: 0, boundaryOut: 0, stored: 0, error: 0 },
        tracer: { initial: sum(config.initialTracerMass), injected: 0, infiltrated: 0, drained: 0, boundaryOut: 0, stored: 0, error: 0 }, networkTransferredM3: {} } };
    inject(state); updateBudget(state); record(state); return state;
  }
  function copyState(state) {
    return { ...state, grid: { ...state.grid }, scenario: { ...state.scenario }, depth: state.depth.slice(), tracerMass: state.tracerMass.slice(), terrain: state.terrain.slice(),
      budget: clone(state.budget), injectedPulses: state.injectedPulses.slice(), sensorHistory: Object.fromEntries(Object.entries(state.sensorHistory).map(([id, series]) => [id, series.slice()])) };
  }
  function faces(grid, visit) {
    for (let y = 0; y < grid.ny; y++) for (let x = 0; x < grid.nx; x++) {
      const a = y * grid.nx + x;
      if (x + 1 < grid.nx) visit(a, a + 1, grid.dy, grid.dx);
      if (y + 1 < grid.ny) visit(a, a + grid.nx, grid.dx, grid.dy);
    }
  }
  function advance(state, dt) {
    const cfg = state.config; const g = state.grid; const area = g.dx * g.dy; const n = state.depth.length;
    const rain = cfg.rainfall.find(item => state.t >= item.start && state.t < item.end)?.mmHr || 0;
    const addition = rain / 3600000 * dt;
    for (let i = 0; i < n; i++) state.depth[i] += addition;
    state.budget.water.rainfall += addition * area * n;
    const volume = state.depth.map(depth => depth * area); const flow = []; const outgoing = Array(n).fill(0);
    function add(from, to, rate, kind, id) {
      if (rate > EPS) { flow.push({ from, to, rate, kind, id }); outgoing[from] += rate; }
    }
    faces(g, (a, b, width, length) => {
      const headA = state.terrain[a] + state.depth[a]; const headB = state.terrain[b] + state.depth[b];
      const from = headA > headB ? a : b; const to = from === a ? b : a;
      const wetDepth = Math.max(0, Math.max(headA, headB) - Math.max(state.terrain[a], state.terrain[b]));
      const rate = width / ((cfg.roughness[a] + cfg.roughness[b]) / 2) * wetDepth ** (5 / 3) * Math.sqrt(Math.abs(headA - headB) / length);
      add(from, to, rate, 'surface');
    });
    cfg.drains.forEach(edge => {
      if (!edge.enabled) return;
      const head = edge.to === null ? state.depth[edge.from] : state.terrain[edge.from] + state.depth[edge.from] - state.terrain[edge.to] - state.depth[edge.to];
      add(edge.from, edge.to, Math.min(edge.capacityM3s, Math.max(0, head) * edge.conductanceM2s), edge.to === null ? 'drained' : 'network', edge.id);
    });
    for (let i = 0; i < n; i++) add(i, null, cfg.permeability[i] / 3600000 * area, 'infiltrated');
    if (cfg.boundary.type === 'south-open') for (let i = 0; i < g.nx; i++) {
      const head = state.terrain[i] + state.depth[i] - cfg.boundary.levelM;
      add(i, null, g.dx / cfg.roughness[i] * state.depth[i] ** (5 / 3) * Math.sqrt(Math.max(0, head) / (g.dy / 2)), 'boundaryOut');
    }
    const factors = outgoing.map((rate, i) => rate * dt > volume[i] ? volume[i] / (rate * dt) : 1);
    if (factors.some(factor => factor < 1 - 1e-10)) state.limitedSteps++;
    const nextVolume = volume.slice(); const nextMass = state.tracerMass.slice();
    flow.forEach(edge => {
      const water = edge.rate * dt * factors[edge.from];
      const mass = volume[edge.from] > EPS ? water * state.tracerMass[edge.from] / volume[edge.from] : 0;
      nextVolume[edge.from] -= water; nextMass[edge.from] -= mass;
      if (edge.to !== null) { nextVolume[edge.to] += water; nextMass[edge.to] += mass; }
      else { state.budget.water[edge.kind] += water; state.budget.tracer[edge.kind] += mass; }
      if (edge.kind === 'network') state.budget.networkTransferredM3[edge.id] = (state.budget.networkTransferredM3[edge.id] || 0) + water;
    });
    state.depth = nextVolume.map(value => Math.max(0, value / area)); state.tracerMass = nextMass.map(value => Math.max(0, value));
    if (cfg.dispersionM2s > 0) {
      const transfers = []; const leaving = Array(n).fill(0);
      faces(g, (a, b, width, length) => {
        if (nextVolume[a] <= EPS || nextVolume[b] <= EPS) return;
        const concentrationA = state.tracerMass[a] / nextVolume[a]; const concentrationB = state.tracerMass[b] / nextVolume[b];
        const from = concentrationA > concentrationB ? a : b; const to = from === a ? b : a;
        const mass = cfg.dispersionM2s * width * Math.min(state.depth[a], state.depth[b]) / length * Math.abs(concentrationA - concentrationB) * dt;
        transfers.push({ from, to, mass }); leaving[from] += mass;
      });
      const dispersionScale = leaving.map((mass, i) => mass > state.tracerMass[i] ? state.tracerMass[i] / mass : 1);
      transfers.forEach(item => { const mass = item.mass * dispersionScale[item.from]; nextMass[item.from] -= mass; nextMass[item.to] += mass; });
      state.tracerMass = nextMass.map(value => Math.max(0, value));
    }
    state.t += dt; state.steps++; inject(state); updateBudget(state);
  }
  function evolve(state, until, dt, sampleEvery) {
    assert(finite(until) && until >= state.t && until <= 86400, 'Simulation end must be between current time and 86400 seconds');
    assert(finite(dt) && dt > 0 && dt <= 600, 'Requested time step must be 0–600 seconds');
    assert(finite(sampleEvery) && sampleEvery > 0, 'Sample interval must be positive');
    const next = copyState(state);
    while (next.t < until - EPS) {
      let h = Math.min(MAX_STEP, dt, until - next.t);
      for (const item of next.config.rainfall) for (const boundary of [item.start, item.end]) if (boundary > next.t + EPS) h = Math.min(h, boundary - next.t);
      for (const pulse of next.config.pulses) if (pulse.at > next.t + EPS) h = Math.min(h, pulse.at - next.t);
      const recording = (Math.floor((next.t + EPS) / sampleEvery) + 1) * sampleEvery;
      h = Math.min(h, recording - next.t); advance(next, h);
      if (Math.abs(next.t - recording) < 1e-8) record(next);
    }
    // Recording a requested endpoint makes short manual steps inspectable. It
    // does not affect integration and is de-duplicated at regular sample times.
    record(next); return next;
  }
  function step(state, seconds = 10) { assert(finite(seconds) && seconds >= 0, 'Step duration must be nonnegative'); return evolve(state, state.t + seconds, MAX_STEP, state.config.sampleEvery); }
  function run(state, options = {}) { return evolve(state, options.until ?? state.t + (options.seconds ?? 3600), options.dt ?? MAX_STEP, options.sampleEvery ?? state.config.sampleEvery); }
  function serialize(state) { return JSON.stringify(state); }
  function restore(value) {
    const saved = typeof value === 'string' ? JSON.parse(value) : clone(value);
    assert(saved && saved.version === VERSION && saved.modelVersion === MODEL_VERSION, 'Unsupported simulation save version');
    const config = normalize(saved.config); const n = config.grid.nx * config.grid.ny;
    assert(saved.scenario?.fingerprint === hash(config), 'Scenario inputs do not match their saved fingerprint');
    assert(finite(saved.t) && saved.t >= 0 && saved.t <= 86400, 'Invalid saved time');
    field(saved.depth, n, 0); field(saved.tracerMass, n, 0); field(saved.terrain, n, 0, false);
    assert(JSON.stringify(saved.terrain) === JSON.stringify(config.terrain), 'Saved terrain differs from the scenario');
    assert(JSON.stringify(saved.grid) === JSON.stringify(config.grid), 'Saved grid differs from the scenario');
    assert(saved.budget?.water && saved.budget?.tracer && Object.values(saved.budget.water).every(finite) && Object.values(saved.budget.tracer).every(finite), 'Invalid saved budgets');
    assert(Array.isArray(saved.injectedPulses) && new Set(saved.injectedPulses).size === saved.injectedPulses.length && saved.injectedPulses.every(i => Number.isInteger(i) && config.pulses[i]?.at <= saved.t), 'Invalid saved pulse history');
    assert(config.pulses.every((pulse, i) => pulse.at > saved.t || saved.injectedPulses.includes(i)), 'A due pulse is missing from the saved history');
    assert(saved.sensorHistory && typeof saved.sensorHistory === 'object', 'Missing sensor history');
    const configuredProbes = new Set(config.probes.map(probe => probe.id));
    assert(Object.keys(saved.sensorHistory).length === configuredProbes.size && Object.keys(saved.sensorHistory).every(id => configuredProbes.has(id)), 'Saved sensor history does not match configured probes');
    Object.values(saved.sensorHistory).forEach(series => assert(Array.isArray(series) && series.length > 0 && series.every((point, i) => finite(point.t) && point.t >= 0 && point.t <= saved.t && (!i || point.t > series[i - 1].t) && ['depth', 'concentration', 'tracerMass'].every(key => finite(point[key]) && point[key] >= 0)), 'Invalid sensor history'));
    saved.config = config; updateBudget(saved);
    assert(Math.abs(saved.budget.water.error) <= 1e-7 * Math.max(1, saved.budget.water.initial + saved.budget.water.rainfall) && Math.abs(saved.budget.tracer.error) <= 1e-7 * Math.max(1, saved.budget.tracer.initial + saved.budget.tracer.injected), 'Saved mass balance is inconsistent');
    return saved;
  }
  function replay(config, options = {}) { return run(create(config), options); }
  function withProbe(state, probe) {
    indexAt(state.grid, probe); assert(typeof probe.id === 'string' && probe.id, 'A probe needs an ID');
    const next = copyState(state); next.config = clone(state.config);
    next.config.probes = next.config.probes.filter(item => item.id !== probe.id).concat([{ id: probe.id, x: probe.x, y: probe.y }]);
    next.scenario.fingerprint = hash(next.config); next.sensorHistory[probe.id] = []; record(next); return next;
  }
  function summary(state, threshold = 0.01) {
    return { t: state.t, scenario: { ...state.scenario }, budget: clone(state.budget), maxDepth: Math.max(...state.depth),
      probes: Object.fromEntries(Object.entries(state.sensorHistory).map(([id, series]) => [id, { peakDepth: Math.max(...series.map(p => p.depth)), peakConcentration: Math.max(...series.map(p => p.concentration)), arrivalTime: series.find(p => p.concentration >= threshold)?.t ?? null, final: sample(state, id) }])) };
  }
  function ensemble(config, variants, options = {}) {
    assert(Array.isArray(variants) && variants.length >= 2 && variants.length <= 25, 'An ensemble needs 2–25 explicit input variants');
    const runs = variants.map(variant => { const input = { ...clone(config), ...clone(variant) }; return replay(input, options); });
    const reference = runs[0];
    for (const state of runs.slice(1)) {
      assert(state.config.probes.length === reference.config.probes.length && reference.config.probes.every(probe => state.config.probes.some(other => other.id === probe.id && other.x === probe.x && other.y === probe.y)), 'Ensemble probes must have matching identities and coordinates');
      assert(Object.keys(reference.sensorHistory).every(id => state.sensorHistory[id]?.length === reference.sensorHistory[id].length && reference.sensorHistory[id].every((point, index) => Math.abs(point.t - state.sensorHistory[id][index].t) < 1e-8)), 'Ensemble samples must use matching times');
    }
    const ranges = Object.fromEntries(Object.keys(runs[0].sensorHistory).map(id => [id, runs[0].sensorHistory[id].map((point, i) => {
      const samples = runs.map(state => state.sensorHistory[id][i]);
      return { t: point.t, depthMin: Math.min(...samples.map(p => p.depth)), depthMax: Math.max(...samples.map(p => p.depth)), concentrationMin: Math.min(...samples.map(p => p.concentration)), concentrationMax: Math.max(...samples.map(p => p.concentration)) };
    })]));
    return { version: VERSION, modelVersion: MODEL_VERSION, kind: 'input-sensitivity-range', assumptions: 'Envelope of listed inputs, not a probability interval or a real-world forecast.', variants: clone(variants), summaries: runs.map(state => summary(state)), ranges };
  }
  return { VERSION, MODEL_VERSION, MAX_STEP, hash, gridFor, indexAt, center, normalize, create, step, run, sample, serialize, restore, replay, withProbe, summary, ensemble };
});
