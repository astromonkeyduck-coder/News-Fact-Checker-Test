(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NoteworthyGIS = api;
})(typeof window === 'object' ? window : this, function () {
  'use strict';
  const VERSION = 1; const CRS = 'MEREHAVEN-LOCAL-METRES'; const EPS = 1e-8;
  const clone = value => JSON.parse(JSON.stringify(value));
  function assert(value, message) { if (!value) throw new Error(message); }
  function point(value) { const p = Array.isArray(value) ? value : value?.geometry?.coordinates || [value?.x, value?.y]; assert(Array.isArray(p) && p.length === 2 && p.every(Number.isFinite), 'Coordinates must be x/y metres'); return p; }
  const distance = (a, b) => { a = point(a); b = point(b); return Math.hypot(a[0] - b[0], a[1] - b[1]); };
  function lineLength(coordinates) { assert(Array.isArray(coordinates) && coordinates.length >= 2, 'A line needs at least two points'); return coordinates.slice(1).reduce((total, p, i) => total + distance(coordinates[i], p), 0); }
  function rings(value) { const geometry = value?.geometry || value; const result = geometry?.type === 'Polygon' ? geometry.coordinates : Array.isArray(value) ? [value] : null; assert(result && result.length && result.every(ring => ring.length >= 3 && ring.every(p => { point(p); return true; })), 'A polygon needs valid rings'); return result; }
  function signedArea(ring) { return ring.reduce((sum, a, i) => { const b = ring[(i + 1) % ring.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0) / 2; }
  function area(polygon) { const rs = rings(polygon); return Math.max(0, Math.abs(signedArea(rs[0])) - rs.slice(1).reduce((sum, ring) => sum + Math.abs(signedArea(ring)), 0)); }
  function onSegment(p, a, b) { const cross = (p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0]); return Math.abs(cross) <= EPS && p[0] >= Math.min(a[0], b[0]) - EPS && p[0] <= Math.max(a[0], b[0]) + EPS && p[1] >= Math.min(a[1], b[1]) - EPS && p[1] <= Math.max(a[1], b[1]) + EPS; }
  function inRing(p, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[j]; const b = ring[i]; if (onSegment(p, a, b)) return { inside: true, boundary: true };
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return { inside, boundary: false };
  }
  function contains(polygon, coordinate) {
    const p = point(coordinate); const rs = rings(polygon); const exterior = inRing(p, rs[0]);
    if (!exterior.inside) return false;
    return !rs.slice(1).some(ring => { const match = inRing(p, ring); return match.inside && !match.boundary; });
  }
  function buffer(coordinate, radiusM, segments = 64) {
    const p = point(coordinate); assert(Number.isFinite(radiusM) && radiusM > 0 && Number.isInteger(segments) && segments >= 16 && segments <= 720, 'Buffer needs positive metres and 16–720 segments');
    const ring = Array.from({ length: segments }, (_, i) => [p[0] + radiusM * Math.cos(i * 2 * Math.PI / segments), p[1] + radiusM * Math.sin(i * 2 * Math.PI / segments)]); ring.push(ring[0].slice());
    return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { operation: 'buffer', crs: CRS, radiusM, center: p.slice(), segments, areaM2: Math.PI * radiusM ** 2, meaning: 'Straight-line proximity only; not a flood boundary or travel-time zone.' } };
  }
  function eligible(feature, options) {
    const t = feature.t ?? feature.properties?.t;
    if (options.startTime !== undefined && (!Number.isFinite(t) || t < options.startTime)) return false;
    if (options.endTime !== undefined && (!Number.isFinite(t) || t > options.endTime)) return false;
    if (options.property && (feature[options.property] ?? feature.properties?.[options.property]) !== options.value) return false;
    return true;
  }
  function select(features, region, options = {}) {
    assert(Array.isArray(features), 'Selection requires features');
    return features.filter(feature => eligible(feature, options) && (region?.properties?.operation === 'buffer'
      ? distance(feature, region.properties.center) <= region.properties.radiusM + EPS : contains(region, point(feature)))).map(clone);
  }
  function spatialJoin(points, zones, options = {}) {
    assert(Array.isArray(points) && Array.isArray(zones), 'A spatial join requires point and polygon collections');
    const assignments = points.filter(feature => eligible(feature, options)).map(feature => ({ featureId: feature.id, zoneIds: zones.filter(zone => contains(zone, point(feature))).map(zone => zone.id) }));
    const counts = Object.fromEntries(zones.map(zone => [zone.id, assignments.filter(item => item.zoneIds.includes(zone.id)).length]));
    return { assignments, counts, unmatchedIds: assignments.filter(item => !item.zoneIds.length).map(item => item.featureId), boundaryRule: 'Boundary points are included; a point on shared boundaries may join to more than one zone.' };
  }
  function networkPath(network, fromId, toId, options = {}) {
    assert(network && Array.isArray(network.nodes) && Array.isArray(network.edges), 'Network needs nodes and edges');
    const nodes = new Map(network.nodes.map(node => [node.id, node])); assert(nodes.has(fromId) && nodes.has(toId), 'Unknown network endpoint');
    const adjacency = new Map(network.nodes.map(node => [node.id, []]));
    network.edges.forEach(edge => {
      if (edge.enabled === false || edge.optional && !options.includeOptional) return;
      assert(nodes.has(edge.from) && nodes.has(edge.to), 'An edge references an unknown node');
      const length = edge.lengthM ?? distance(nodes.get(edge.from), nodes.get(edge.to)); assert(Number.isFinite(length) && length >= 0, 'Network lengths must be nonnegative metres');
      adjacency.get(edge.from).push({ node: edge.to, edge: edge.id, length });
      if (edge.directed === false) adjacency.get(edge.to).push({ node: edge.from, edge: edge.id, length });
    });
    const distances = new Map([[fromId, 0]]); const previous = new Map(); const pending = new Set(nodes.keys());
    while (pending.size) {
      const current = [...pending].sort((a, b) => (distances.get(a) ?? Infinity) - (distances.get(b) ?? Infinity))[0];
      if (!Number.isFinite(distances.get(current))) break;
      pending.delete(current); if (current === toId) break;
      adjacency.get(current).forEach(edge => { const next = distances.get(current) + edge.length; if (next < (distances.get(edge.node) ?? Infinity)) { distances.set(edge.node, next); previous.set(edge.node, { node: current, edge: edge.edge }); } });
    }
    if (!distances.has(toId)) return { connected: false, nodeIds: [], edgeIds: [], distanceM: null, meaning: 'No directed path exists in the selected network; proximity alone does not establish a connection.' };
    const nodeIds = [toId]; const edgeIds = []; let current = toId;
    while (current !== fromId) { const before = previous.get(current); edgeIds.unshift(before.edge); nodeIds.unshift(before.node); current = before.node; }
    return { connected: true, nodeIds, edgeIds, distanceM: distances.get(toId), meaning: 'Directed network distance, not modeled tracer travel time.' };
  }
  function profile(terrain, grid, coordinates, options = {}) {
    const length = lineLength(coordinates); const samples = options.samples ?? 31;
    assert(Number.isInteger(samples) && samples >= 2 && samples <= 1001 && Array.isArray(terrain) && terrain.length === grid.nx * grid.ny, 'Profile requires terrain cells and 2–1001 samples');
    const cumulative = [0]; coordinates.slice(1).forEach((p, i) => cumulative.push(cumulative[i] + distance(coordinates[i], p)));
    return Array.from({ length: samples }, (_, i) => {
      const at = length * i / (samples - 1); let segment = cumulative.findIndex(value => value >= at); segment = Math.max(1, segment);
      const fraction = cumulative[segment] === cumulative[segment - 1] ? 0 : (at - cumulative[segment - 1]) / (cumulative[segment] - cumulative[segment - 1]);
      const a = coordinates[segment - 1]; const b = coordinates[segment]; const x = a[0] + (b[0] - a[0]) * fraction; const y = a[1] + (b[1] - a[1]) * fraction;
      const col = Math.floor((x - (grid.x0 || 0)) / grid.dx); const row = Math.floor((y - (grid.y0 || 0)) / grid.dy);
      assert(col >= 0 && col < grid.nx && row >= 0 && row < grid.ny, 'Profile extends outside the modeled cells');
      return { distanceM: at, x, y, elevationM: terrain[row * grid.nx + col], cell: row * grid.nx + col };
    });
  }
  function hash(value) { let h = 2166136261; for (const ch of JSON.stringify(value)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0).toString(16).padStart(8, '0'); }
  function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
  function analyze(operation, inputs, context = {}) {
    let output; let units;
    if (operation === 'distance') { output = { distanceM: distance(inputs.from, inputs.to) }; units = 'm'; }
    else if (operation === 'area') { output = { areaM2: area(inputs.polygon) }; units = 'm²'; }
    else if (operation === 'buffer') { output = buffer(inputs.center, inputs.radiusM); units = 'm'; }
    else if (operation === 'selection') { output = select(inputs.features, inputs.region, { ...inputs.filter, ...context.timeWindow }); units = 'feature count'; }
    else if (operation === 'spatial-join') { output = spatialJoin(inputs.points, inputs.zones, { ...inputs.filter, ...context.timeWindow }); units = 'feature count'; }
    else if (operation === 'network') { output = networkPath(inputs.network, inputs.fromId, inputs.toId, inputs.options); units = 'm'; }
    else if (operation === 'profile') { output = profile(inputs.terrain, inputs.grid, inputs.coordinates, inputs.options); units = 'm'; }
    else throw new Error('Unknown spatial operation');
    const result = { version: VERSION, operation, crs: CRS, scenarioId: context.scenarioId || null, scenarioVersion: context.scenarioVersion || null, modelVersion: context.modelVersion || null,
      timeWindow: clone(context.timeWindow || null), inputs: clone(inputs), units,
      assumptions: ['Local fictional planar metre coordinates; no geographic degree calculation.', 'Proximity, network connectivity and physical arrival time are different measures.', ...(operation === 'profile' ? ['Nearest-cell elevations on a 50 m educational terrain grid.'] : [])], output };
    const fingerprint = hash(result);
    return freeze({ id: `gis-${fingerprint}`, fingerprint, ...result });
  }
  return { VERSION, CRS, distance, lineLength, area, buffer, contains, select, spatialJoin, networkPath, profile, analyze };
});
