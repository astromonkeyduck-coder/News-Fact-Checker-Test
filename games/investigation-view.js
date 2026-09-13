(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NoteworthyInvestigationView = api;
})(typeof window === 'object' ? window : this, function () {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const formats = new Map();
  const number = (value, digits = 3) => {
    if (!finite(value)) return '—';
    if (!formats.has(digits)) formats.set(digits, new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }));
    return formats.get(digits).format(value);
  };
  const id = value => String(value || 'main').replace(/[^a-zA-Z0-9_-]/g, '-');
  const color = (value, fallback) => typeof value === 'string' && /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value) ? value : fallback;
  const coordinate = value => Array.isArray(value) ? value : value?.geometry?.coordinates || [value?.x, value?.y];
  const validPoint = value => Array.isArray(value) && value.length >= 2 && value.slice(0, 2).every(finite);
  const allRows = value => Array.isArray(value) ? value : value?.rows || value?.observations || [];
  function path(coordinates, north = 800, close = false) {
    if (!Array.isArray(coordinates) || coordinates.some(point => !validPoint(point))) return '';
    return coordinates.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(3)},${(north - p[1]).toFixed(3)}`).join(' ') + (close ? ' Z' : '');
  }
  function geometryPath(geometry, north) {
    if (geometry?.type === 'LineString') return path(geometry.coordinates, north);
    if (geometry?.type === 'Polygon') return geometry.coordinates.map(ring => path(ring, north, true)).join(' ');
    if (geometry?.type === 'MultiPolygon') return geometry.coordinates.flatMap(poly => poly.map(ring => path(ring, north, true))).join(' ');
    return '';
  }
  function cellValue(state, point) {
    const g = state.grid; const p = coordinate(point);
    if (!validPoint(p)) return null;
    const x = Math.floor((p[0] - (g.x0 || 0)) / g.dx); const y = Math.floor((p[1] - (g.y0 || 0)) / g.dy);
    if (x < 0 || y < 0 || x >= g.nx || y >= g.ny) return null;
    const index = y * g.nx + x; const depth = state.depth[index]; const mass = state.tracerMass[index];
    return { index, depth, concentration: depth > 0 && finite(mass) ? mass / (depth * g.dx * g.dy) : 0 };
  }
  function cells(state, layer, north) {
    const g = state.grid; const output = []; const area = g.dx * g.dy;
    for (let index = 0; index < g.nx * g.ny; index++) {
      const x = (g.x0 || 0) + (index % g.nx) * g.dx; const y = (g.y0 || 0) + Math.floor(index / g.nx) * g.dy;
      const depth = state.depth[index]; const z = state.terrain[index]; const c = depth > 0 ? state.tracerMass[index] / (depth * area) : 0;
      let fill; let title;
      if (layer === 'terrain') {
        const v = clamp(z / 2, 0, 1); fill = `hsl(202 27% ${17 + v * 22}%)`; title = `Terrain ${number(z)} m above the fictional datum`;
      } else if (layer === 'water') {
        if (!finite(depth) || depth < 0.00001) continue;
        const v = clamp(depth / 0.3, 0, 1); fill = `hsl(196 ${46 + v * 24}% ${24 + v * 34}%)`; title = `Simulated water depth ${number(depth, 5)} m`;
      } else {
        if (!finite(c) || c < 0.000001) continue;
        const v = clamp(Math.log1p(c * 20) / Math.log(21), 0, 1); fill = `hsl(${172 - v * 20} ${45 + v * 28}% ${25 + v * 36}%)`; title = `Simulated harmless tracer ${number(c, 6)} g/m³`;
      }
      output.push(`<rect x="${x}" y="${north - y - g.dy}" width="${g.dx}" height="${g.dy}" fill="${fill}" data-cell-index="${index}"><title>Cell ${index}, east ${number(x + g.dx / 2)} m, north ${number(y + g.dy / 2)} m. ${title}</title></rect>`);
    }
    return output.join('');
  }
  function analysisMarkup(analysis, world, north) {
    if (!analysis) return '';
    const output = analysis.output; const input = analysis.inputs || {}; let shapes = '';
    if (output?.geometry) shapes = `<path d="${geometryPath(output.geometry, north)}" class="inv-analysis-region"/>`;
    else if (analysis.operation === 'distance' && validPoint(coordinate(input.from)) && validPoint(coordinate(input.to))) shapes = `<path d="${path([coordinate(input.from), coordinate(input.to)], north)}" class="inv-analysis-line"/>`;
    else if (analysis.operation === 'network' && output?.connected) {
      const points = output.nodeIds.map(key => world.drainage.nodes.find(node => node.id === key)).map(coordinate);
      shapes = `<path d="${path(points, north)}" class="inv-analysis-line"/>`;
    } else if (analysis.operation === 'profile' && input.coordinates) shapes = `<path d="${path(input.coordinates, north)}" class="inv-analysis-line"/>`;
    else if (Array.isArray(output)) shapes = output.filter(item => validPoint(coordinate(item))).map(item => { const p = coordinate(item); return `<circle cx="${p[0]}" cy="${north - p[1]}" r="24" class="inv-analysis-line"/>`; }).join('');
    return shapes ? `<g class="inv-map-analysis" data-analysis-id="${esc(analysis.id)}"><title>Pinned ${esc(analysis.operation)} analysis. ${esc(analysis.units)}. See its saved inputs and assumptions in the notebook.</title>${shapes}</g>` : '';
  }
  function map(options = {}) {
    const { state, world, selectedFeatureId, analysis } = options;
    if (!state?.grid || !world?.features || !Array.isArray(state.depth) || !Array.isArray(state.tracerMass) || !Array.isArray(state.terrain) ||
      !Number.isInteger(state.grid.nx) || !Number.isInteger(state.grid.ny) || state.grid.nx < 1 || state.grid.ny < 1 || ![state.grid.dx, state.grid.dy].every(value => finite(value) && value > 0) ||
      [state.depth, state.terrain, state.tracerMass].some(values => values.length !== state.grid.nx * state.grid.ny) || state.depth.some(value => !finite(value) || value < 0) || state.terrain.some(value => !finite(value)) || state.tracerMass.some(value => !finite(value) || value < 0)) {
      return '<p class="inv-view-empty">The map needs a valid simulation state. Its source evidence remains available in the case notebook.</p>';
    }
    const extent = world.extent || [0, 0, 1200, 800]; const north = extent[3]; const key = id(options.suffix);
    const frame = Array.isArray(options.viewBox) && options.viewBox.length === 4 && options.viewBox.every(finite) && options.viewBox[2] > 0 && options.viewBox[3] > 0 ? options.viewBox : [0, 0, 1200, 800];
    const defaultLayers = ['terrain', 'water', 'landuse', 'roads', 'drainage', 'observations'].map(layer => ({ id: layer, visible: true, opacity: layer === 'water' ? 0.8 : 1 }));
    const layers = options.layers || defaultLayers; const active = layers.filter(layer => layer.visible !== false);
    const observations = allRows(options.observations); const defs = `<defs><marker id="inv-drain-arrow-${key}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="#b6d8e2"/></marker><pattern id="inv-grid-${key}" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="#d5e5e8" stroke-opacity=".08" stroke-width="1"/></pattern></defs>`;
    let markup = '';
    active.forEach(layer => {
      let content = ''; const opacity = finite(layer.opacity) ? clamp(layer.opacity, 0, 1) : 1;
      if (['terrain', 'water', 'tracer'].includes(layer.id)) content = cells(state, layer.id, north);
      else if (layer.id === 'landuse') content = (world.zones || []).map(zone => `<path d="${geometryPath(zone.geometry, north)}" class="inv-map-zone" fill-rule="evenodd"><title>${esc(zone.name)}. Fictional land-use polygon.</title></path>`).join('');
      else if (layer.id === 'roads') content = (world.roads || []).map(road => `<path d="${geometryPath(road.geometry, north)}" class="inv-map-road"><title>${esc(road.name)}</title></path>`).join('');
      else if (layer.id === 'drainage') content = (world.drainage?.edges || []).map(edge => {
        const from = world.drainage.nodes.find(node => node.id === edge.from); const to = world.drainage.nodes.find(node => node.id === edge.to);
        const actual = state.config?.drains?.find(item => item.id === edge.id); const enabled = actual ? actual.enabled !== false : !edge.optional;
        if (!from || !to) return '';
        const midpoint = [(from.x + to.x) / 2, (from.y + to.y) / 2];
        return `<path d="${path([coordinate(from), midpoint, coordinate(to)], north)}" class="inv-map-drain${enabled ? '' : ' inv-map-drain-absent'}" ${enabled ? `marker-mid="url(#inv-drain-arrow-${key})" marker-end="url(#inv-drain-arrow-${key})"` : ''}><title>${esc(edge.id)}: ${enabled ? `enabled, capacity ${number(actual?.capacityM3s ?? edge.capacityM3s)} m³/s` : 'optional connection absent from this scenario'}. Directed model connection; not a measured travel time.</title></path>`;
      }).join('');
      else if (layer.id === 'observations') content = observations.filter(row => validPoint(coordinate(row))).map(row => { const p = coordinate(row); return `<rect x="${p[0] - 15}" y="${north - p[1] - 15}" width="30" height="30" rx="3" class="inv-map-observation"><title>Immutable synthetic observation at ${esc(row.featureId || row.id)}, ${number(row.t)} s: depth ${number(row.depth, 5)} m; tracer ${number(row.concentration, 6)} g/m³. Not a real measurement.</title></rect>`; }).join('');
      markup += `<g data-map-layer="${esc(layer.id)}" opacity="${opacity}" aria-hidden="true">${content}</g>`;
    });
    const locations = world.features.filter(item => validPoint(coordinate(item))).map(item => {
      const p = coordinate(item); const reading = cellValue(state, item); const selected = item.id === selectedFeatureId;
      const west = p[0] > 900; const labelX = p[0] + (west ? -24 : 24); const labelY = north - p[1] - 22;
      return `<g class="inv-map-feature${selected ? ' is-selected' : ''}" data-feature-id="${esc(item.id)}" role="button" tabindex="0" aria-pressed="${selected}" aria-label="${esc(item.name)}. East ${number(p[0])} metres, north ${number(p[1])} metres. ${reading ? `Predicted depth ${number(reading.depth, 4)} metres.` : ''}"><title>${esc(item.name)} · ${esc(item.kind)} · fictional Merehaven</title><circle class="inv-map-target" cx="${p[0]}" cy="${north - p[1]}" r="26"/><circle class="inv-map-dot" cx="${p[0]}" cy="${north - p[1]}" r="8"/><text class="inv-map-label" x="${labelX}" y="${labelY}" text-anchor="${west ? 'end' : 'start'}">${esc(item.name)}</text></g>`;
    }).join('');
    const probes = (options.probes || []).filter(item => validPoint(coordinate(item))).map(probe => {
      const p = coordinate(probe); const reading = cellValue(state, probe);
      return `<g class="inv-map-probe" data-probe-id="${esc(probe.id)}"><title>Virtual probe ${esc(probe.name || probe.id)}: ${reading ? `predicted depth ${number(reading.depth, 5)} m, tracer ${number(reading.concentration, 6)} g/m³` : 'outside grid'}</title><path d="M${p[0] - 12},${north - p[1]}h24M${p[0]},${north - p[1] - 12}v24"/><circle cx="${p[0]}" cy="${north - p[1]}" r="17"/></g>`;
    }).join('');
    const legend = [];
    if (active.some(layer => layer.id === 'terrain')) legend.push('<span><i class="inv-scale-terrain"></i>Terrain: 0–2 m, fictional datum</span>');
    if (active.some(layer => layer.id === 'water')) legend.push('<span><i class="inv-scale-water"></i>Water: 0–0.30 m; darker to brighter, saturates above 0.30 m</span>');
    if (active.some(layer => layer.id === 'tracer')) legend.push('<span><i class="inv-scale-tracer"></i>Tracer: 0–1 g/m³, logarithmic color; saturates above 1</span>');
    if (active.some(layer => layer.id === 'drainage')) legend.push('<span class="inv-drain-key">→ Enabled drain · dashed: absent optional link</span>');
    if (observations.length && active.some(layer => layer.id === 'observations')) legend.push('<span class="inv-observation-key">□ Immutable synthetic observation</span>');
    return `<svg class="inv-map" data-investigation-map data-map-time="${state.t}" data-map-scenario="${esc(state.scenario?.id)}" viewBox="${frame.join(' ')}" role="group" aria-labelledby="inv-map-title-${key}" aria-describedby="inv-map-description-${key}"><title id="inv-map-title-${key}">Merehaven simulated field map, ${number(state.t)} seconds</title><desc id="inv-map-description-${key}">Fictional local metre grid, north up. Select a named location using the map or location controls. Terrain, water and tracer colors show the numerical model; square symbols mark supplied synthetic observations. Comparison maps use fixed color scales. No animation or real emergency data.</desc>${defs}<rect x="0" y="0" width="1200" height="800" fill="#0a1c29"/>${markup}<rect x="0" y="0" width="1200" height="800" fill="url(#inv-grid-${key})" pointer-events="none"/>${analysisMarkup(analysis, world, north)}${locations}${probes}<g class="inv-map-compass" aria-hidden="true"><path d="M1155 100V40m-9 15 9-15 9 15"/><text x="1155" y="125" text-anchor="middle">N</text></g><g class="inv-map-distance" aria-hidden="true"><path d="M35 752v12h200v-12M135 752v12"/><text x="35" y="789">0</text><text x="235" y="789" text-anchor="end">200 m</text></g></svg><div class="inv-map-legend" aria-label="Map legend">${legend.join('')}</div>`;
  }
  function table(headers, rows, title) {
    return `<details class="inv-data-table"><summary>${esc(title)} (${rows.length} rows)</summary><div class="inv-data-scroll"><table><thead><tr>${headers.map(header => `<th scope="col">${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => `<td>${esc(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
  }
  function plot({ series, observations = [], variable, axisTitle, unit, xKey = 't', xTitle = 'Simulation time (s)', valueKey, labels, tableTitle }) {
    const prepared = series.map((item, i) => ({ name: item.name || `Prediction ${i + 1}`, color: color(item.color, ['#69d5c6', '#79aaff', '#efb96e'][i % 3]),
      rows: (item.rows || []).filter(row => finite(row[xKey]) && finite(row[valueKey]) && (variable === 'elevation' || row[valueKey] >= 0)).slice().sort((a, b) => a[xKey] - b[xKey]) }));
    const observed = observations.filter(row => finite(row[xKey]) && finite(row[valueKey]) && row[valueKey] >= 0);
    const all = prepared.flatMap(item => item.rows).concat(observed);
    if (!all.length) return '<p class="inv-view-empty">No numerical readings are available for this plot yet. Run or step the simulation to record a probe.</p>';
    const width = 660; const height = 265; const margin = { left: 75, right: 25, top: 29, bottom: 53 };
    const maxX = Math.max(1, ...all.map(row => row[xKey])); const maxY = Math.max(0.001, ...all.map(row => row[valueKey])) * 1.12;
    const minY = Math.min(0, ...all.map(row => row[valueKey])) * 1.12;
    const X = value => margin.left + value / maxX * (width - margin.left - margin.right);
    const Y = value => height - margin.bottom - (value - minY) / (maxY - minY) * (height - margin.top - margin.bottom);
    let axes = '';
    for (let i = 0; i <= 4; i++) {
      const value = minY + (maxY - minY) * i / 4; const y = Y(value);
      axes += `<path class="inv-plot-grid" d="M${margin.left},${y}H${width - margin.right}"/><text class="inv-plot-tick" x="${margin.left - 9}" y="${y + 4}" text-anchor="end">${number(value, variable === 'concentration' ? 4 : 3)}</text>`;
      const time = maxX * i / 4; const x = X(time);
      axes += `<text class="inv-plot-tick" x="${x}" y="${height - margin.bottom + 21}" text-anchor="middle">${number(time, 0)}</text>`;
    }
    const lines = prepared.map(item => {
      const d = item.rows.map((row, i) => `${i ? 'L' : 'M'}${X(row[xKey]).toFixed(2)},${Y(row[valueKey]).toFixed(2)}`).join(' ');
      return `<path class="inv-plot-line" d="${d}" stroke="${item.color}"/><g fill="${item.color}">${item.rows.length === 1 ? `<circle cx="${X(item.rows[0][xKey])}" cy="${Y(item.rows[0][valueKey])}" r="4"/>` : ''}</g>`;
    }).join('');
    const dots = observed.map(row => `<rect class="inv-plot-observed" x="${X(row[xKey]) - 4}" y="${Y(row[valueKey]) - 4}" width="8" height="8"><title>Immutable synthetic observation: ${number(row[xKey])} s, ${number(row[valueKey], 6)} ${esc(unit)}</title></rect>`).join('');
    const rows = prepared.flatMap(item => item.rows.map(row => [item.name, labels?.prediction || 'Simulated prediction', number(row[xKey]), number(row[valueKey], 6)])).concat(observed.map(row => ['Supplied observation', 'Immutable synthetic observation', number(row[xKey]), number(row[valueKey], 6)]));
    return `<figure class="inv-plot"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(axisTitle)} by ${esc(xTitle)}. An equivalent numeric table follows."><text class="inv-plot-axis-title" x="${margin.left}" y="17">${esc(axisTitle)} (${esc(unit)})</text>${axes}${lines}${dots}<text class="inv-plot-axis-title" x="${width / 2}" y="${height - 7}" text-anchor="middle">${esc(xTitle)}</text></svg><figcaption class="inv-plot-legend">${prepared.map(item => `<span><i style="background:${item.color}"></i>${esc(item.name)} · ${esc(labels?.prediction || 'simulated prediction')}</span>`).join('')}${observed.length ? '<span class="inv-observation-key">□ Supplied immutable synthetic observations</span>' : ''}</figcaption></figure>${table(['Series', 'Evidence type', xTitle, `${axisTitle} (${unit})`], rows, tableTitle || 'Read the plot as a data table')}`;
  }
  function graph(options = {}) {
    const variable = options.variable === 'concentration' ? 'concentration' : 'depth';
    const observations = allRows(options.observations).filter(row => !options.probeId || row.featureId === options.probeId || row.probeId === options.probeId);
    return plot({ series: options.series || [], observations, variable, valueKey: variable, axisTitle: variable === 'depth' ? 'Water depth' : 'Tracer concentration', unit: variable === 'depth' ? 'm' : 'g/m³' });
  }
  function profile(options = {}) {
    return plot({ series: [{ name: 'Terrain profile', color: '#efb96e', rows: options.samples || [] }], variable: 'elevation', xKey: 'distanceM', xTitle: 'Distance along section (m)', valueKey: 'elevationM', axisTitle: 'Terrain elevation', unit: 'm', labels: { prediction: 'fictional terrain grid' }, tableTitle: 'Read the terrain section as a table' });
  }
  function envelope(options = {}) {
    const result = options.ensemble; const variable = options.variable === 'concentration' ? 'concentration' : 'depth';
    const minKey = `${variable}Min`; const maxKey = `${variable}Max`;
    const input = result?.ranges?.[options.probeId];
    if (!Array.isArray(input) || !input.length || input.some(row => !finite(row.t) || row.t < 0 || !finite(row[minKey]) || !finite(row[maxKey]) || row[minKey] < 0 || row[maxKey] < row[minKey])) {
      return '<p class="inv-view-empty">No valid sensitivity range is available for this probe. Run the rainfall scenarios to calculate an envelope.</p>';
    }
    const rows = input.slice().sort((a, b) => a.t - b.t);
    if (rows.some((row, i) => i && row.t === rows[i - 1].t)) return '<p class="inv-view-empty">The sensitivity range has duplicate sample times and cannot be plotted reliably.</p>';
    const title = variable === 'depth' ? 'Water depth' : 'Tracer concentration'; const unit = variable === 'depth' ? 'm' : 'g/m³';
    const width = 660; const height = 265; const left = 75; const right = 635; const top = 29; const bottom = 212;
    const maxX = Math.max(1, ...rows.map(row => row.t)); const maxY = Math.max(0.001, ...rows.map(row => row[maxKey])) * 1.12;
    const X = value => left + value / maxX * (right - left); const Y = value => bottom - value / maxY * (bottom - top);
    const points = (values, key) => values.map((row, i) => `${i ? 'L' : 'M'}${X(row.t).toFixed(2)},${Y(row[key]).toFixed(2)}`).join(' ');
    const upper = points(rows, maxKey); const lower = points(rows, minKey);
    const band = `${upper} ${points(rows.slice().reverse(), minKey).replace(/^M/, 'L')} Z`;
    let axes = '';
    for (let i = 0; i <= 4; i++) {
      const value = maxY * i / 4; const time = maxX * i / 4;
      axes += `<path class="inv-plot-grid" d="M${left},${Y(value)}H${right}"/><text class="inv-plot-tick" x="${left - 9}" y="${Y(value) + 4}" text-anchor="end">${number(value, variable === 'concentration' ? 4 : 3)}</text><text class="inv-plot-tick" x="${X(time)}" y="${bottom + 21}" text-anchor="middle">${number(time, 0)}</text>`;
    }
    const variants = Array.isArray(result.variants) ? result.variants : [];
    const parameters = Array.isArray(result.parameterVariants) ? result.parameterVariants : [];
    const rainfall = Array.from({ length: Math.max(variants.length, parameters.length) }, (_, index) => {
      const variant = variants[index] || {}; const params = parameters[index] || variant.parameters || variant;
      const schedule = variant.rainfall || params.rainfallSchedule;
      let description;
      if (Array.isArray(schedule) && !schedule.length) description = 'no rainfall intervals (0 mm/h)';
      else if (Array.isArray(schedule) && schedule.every(row => finite(row.start) && finite(row.end) && finite(row.mmHr))) {
        description = schedule.map(row => `${row.mmHr} mm/h from ${row.start}–${row.end} s`).join('; ');
      } else if (finite(params.rainfallMmHr)) description = `${params.rainfallMmHr} mm/h (timing not supplied)`;
      else description = 'rainfall inputs not supplied';
      return `<li>Scenario ${index + 1}: ${esc(description)}.</li>`;
    }).join('');
    const single = rows.length === 1 ? `<path d="M${X(rows[0].t)},${Y(rows[0][minKey])}V${Y(rows[0][maxKey])}" stroke="#69d5c6" stroke-width="4"/><circle cx="${X(rows[0].t)}" cy="${Y(rows[0][minKey])}" r="3" fill="#69d5c6"/>` : '';
    const caption = 'Input-sensitivity envelope: the minimum and maximum of these simulated scenarios at each saved time. This is not a probability interval.';
    return `<figure class="inv-plot inv-envelope" data-envelope-probe="${esc(options.probeId)}"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)} sensitivity range at ${esc(options.probeId)}. Minimum and maximum simulated predictions; an equivalent numeric table follows."><text class="inv-plot-axis-title" x="${left}" y="17">${esc(title)} (${esc(unit)})</text>${axes}<path data-envelope-band d="${band}" fill="#69d5c6" fill-opacity=".22"/><path class="inv-plot-line" d="${upper}" stroke="#69d5c6"/><path class="inv-plot-line" d="${lower}" stroke="#69d5c6"/>${single}<text class="inv-plot-axis-title" x="${width / 2}" y="${height - 7}" text-anchor="middle">Simulation time (s)</text></svg><figcaption>${esc(caption)}</figcaption></figure><p>Rainfall inputs for this envelope:</p>${rainfall ? `<ul>${rainfall}</ul>` : '<p>The saved result does not include the rainfall inputs.</p>'}${table(['Simulation time (s)', `Minimum ${title.toLowerCase()} (${unit})`, `Maximum ${title.toLowerCase()} (${unit})`], rows.map(row => [number(row.t), number(row[minKey], 6), number(row[maxKey], 6)]), 'Read the sensitivity envelope as a data table')}`;
  }
  return { map, graph, profile, envelope };
});
