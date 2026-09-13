(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NoteworthyInsideStory = api;
})(typeof window === 'object' ? window : this, function () {
  'use strict';

  const CHAPTERS = ['overview', 'sequence', 'shaking', 'evidence'];
  const QUERY_KEYS = ['insideChapter', 'insideTime', 'insideEvent', 'insideEvidence', 'insideLayer'];
  const validId = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/.test(value);
  const timestamp = value => {
    if (typeof value === 'number') return Number.isFinite(value) && Number.isFinite(new Date(value).getTime()) ? value : null;
    if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)) return null;
    const day = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
    if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== value.slice(0, 10)) return null;
    const result = Date.parse(value);
    return Number.isFinite(result) ? result : null;
  };
  const httpUrl = value => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch (_) { return null; } };
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  function validBounds(bounds) {
    return Array.isArray(bounds) && bounds.length === 4 && bounds.every(finite) &&
      bounds[0] >= -180 && bounds[0] <= 180 && bounds[2] >= -180 && bounds[2] <= 180 && bounds[0] !== bounds[2] &&
      bounds[1] >= -90 && bounds[3] <= 90 && bounds[1] < bounds[3];
  }
  function project(coordinate, bounds, size = [1000, 600]) {
    if (!Array.isArray(coordinate) || coordinate.length < 2 || !coordinate.slice(0, 2).every(finite) || Math.abs(coordinate[0]) > 180 || Math.abs(coordinate[1]) > 90 || !validBounds(bounds) ||
      !Array.isArray(size) || size.length !== 2 || !size.every(value => finite(value) && value > 0)) throw new Error('Invalid map coordinate, bounds or size');
    const [west, south, east, north] = bounds;
    const span = east > west ? east - west : east + 360 - west;
    const longitudeScale = Math.max(0.01, Math.cos(((north + south) / 2) * Math.PI / 180));
    const scale = Math.min(size[0] / (span * longitudeScale), size[1] / (north - south));
    const left = (size[0] - span * longitudeScale * scale) / 2;
    const top = (size[1] - (north - south) * scale) / 2;
    let longitudeOffset = ((coordinate[0] - west) % 360 + 360) % 360;
    if (longitudeOffset > (span + 360) / 2) longitudeOffset -= 360;
    return { x: left + longitudeOffset * longitudeScale * scale, y: top + (north - coordinate[1]) * scale };
  }
  function formatTime(value) {
    const time = timestamp(value);
    return time === null ? 'Time not available' : new Date(time).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC', timeZoneName: 'short',
    });
  }

  function normalizeEvent(input) {
    if (!input || !validId(input.id) || timestamp(input.time) === null || !finite(input.longitude) || Math.abs(input.longitude) > 180 ||
      !finite(input.latitude) || Math.abs(input.latitude) > 90 || !httpUrl(input.url)) return null;
    return { ...input, time: timestamp(input.time), updated: timestamp(input.updated), url: httpUrl(input.url),
      place: typeof input.place === 'string' ? input.place : 'Location description not available',
      magnitude: finite(input.magnitude) ? input.magnitude : null, depthKm: finite(input.depthKm) ? input.depthKm : null };
  }
  function validGeoJson(value) {
    if (!value || value.type !== 'FeatureCollection' || !Array.isArray(value.features) || !value.features.length) return false;
    function coordinatesValid(coordinates) {
      if (!Array.isArray(coordinates) || coordinates.length === 0) return false;
      if (typeof coordinates[0] === 'number') return coordinates.length >= 2 && coordinates.every(finite) && Math.abs(coordinates[0]) <= 180 && Math.abs(coordinates[1]) <= 90;
      return coordinates.every(coordinatesValid);
    }
    return value.features.every(feature => feature?.type === 'Feature' &&
      ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'].includes(feature.geometry?.type) && coordinatesValid(feature.geometry.coordinates));
  }
  function prepareData(raw) {
    const errors = []; const warnings = [];
    if (!raw || typeof raw !== 'object' || !validId(raw.slug) || typeof raw.title !== 'string' || !raw.title.trim()) return { ok: false, errors: ['Story metadata is incomplete.'], warnings };
    const mainEvent = normalizeEvent(raw.event);
    if (!mainEvent) errors.push('The main event is missing a valid occurrence time, location or source link.');
    if (!validBounds(raw.bounds)) errors.push('The map bounds are invalid.');
    if (!Array.isArray(raw.events)) errors.push('The recorded-event catalog is unavailable.');
    if (errors.length) return { ok: false, errors, warnings };
    const eventMap = new Map();
    for (const input of raw.events) {
      const event = normalizeEvent(input);
      if (!event) { warnings.push('Some catalog records could not be displayed. Consult the source catalog.'); continue; }
      if (eventMap.has(event.id)) { warnings.push('Duplicate catalog records were omitted from the interactive view.'); continue; }
      eventMap.set(event.id, event);
    }
    eventMap.set(mainEvent.id, mainEvent);
    const events = [...eventMap.values()].sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
    const sourceIds = new Set();
    const sources = (Array.isArray(raw.sources) ? raw.sources : []).filter(source => {
      const valid = source && validId(source.id) && !sourceIds.has(source.id) && typeof source.title === 'string' && source.title.trim() && httpUrl(source.url);
      if (valid) sourceIds.add(source.id);
      return valid;
    }).map(source => ({ ...source, url: httpUrl(source.url), issuedAt: timestamp(source.issuedAt), retrievedAt: timestamp(source.retrievedAt) }));
    const evidenceIds = new Set();
    const evidence = (Array.isArray(raw.evidence) ? raw.evidence : []).filter(item => {
      const valid = item && validId(item.id) && !evidenceIds.has(item.id) && sourceIds.has(item.sourceId) && timestamp(item.time) !== null &&
        typeof item.label === 'string' && item.label.trim() && typeof item.text === 'string';
      if (valid) evidenceIds.add(item.id);
      else warnings.push('An evidence version is unavailable because its dated source could not be established.');
      return valid;
    }).map(item => ({ ...item, time: timestamp(item.time) })).sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
    const shaking = raw.shaking && sourceIds.has(raw.shaking.sourceId) && validGeoJson(raw.shaking.geojson) ? raw.shaking : null;
    const geography = raw.geography && sourceIds.has(raw.geography.sourceId) && validGeoJson(raw.geography.geojson) ? raw.geography : null;
    if (raw.shaking && !shaking) warnings.push('The shaking overlay is unavailable. Read the linked agency material.');
    return { ok: true, errors, warnings: [...new Set(warnings)], data: { ...raw, event: mainEvent, mainEventId: mainEvent.id,
      events, sources, evidence, shaking, geography, timeline: [...new Set(events.map(event => event.time))],
      availableLayers: ['epicentre', 'sequence', ...(shaking ? ['shaking'] : [])] } };
  }

  const eventById = (data, id) => data.events.find(event => event.id === id) || null;
  const evidenceById = (data, id) => data.evidence.find(item => item.id === id) || null;
  const sourceById = (data, id) => data.sources.find(source => source.id === id) || null;
  const visibleEvents = (data, state) => data.events.filter(event => event.time <= state.time);
  const timelineIndex = (data, state) => Math.max(0, data.timeline.indexOf(state.time));
  const chapterLayer = (data, chapter) => data.availableLayers.includes(chapter) ? chapter : 'epicentre';
  function defaultState(data) {
    return { chapter: 'overview', time: data.timeline[data.timeline.length - 1], eventId: data.mainEventId,
      evidenceId: data.evidence[data.evidence.length - 1]?.id || null, layer: 'epicentre' };
  }
  function reduce(data, current, action) {
    const next = { ...current };
    if (!action || typeof action !== 'object') return next;
    if (action.type === 'reset') return defaultState(data);
    if (action.type === 'chapter' && CHAPTERS.includes(action.value)) {
      next.chapter = action.value;
      next.layer = chapterLayer(data, action.value);
    }
    if (action.type === 'layer' && data.availableLayers.includes(action.value)) {
      next.layer = action.value;
      next.chapter = action.value === 'epicentre' ? 'overview' : action.value;
    }
    const selectedMapView = (action.type === 'chapter' && CHAPTERS.includes(action.value)) ||
      (action.type === 'layer' && data.availableLayers.includes(action.value));
    if (selectedMapView && ['overview', 'shaking'].includes(next.chapter)) {
      next.eventId = data.mainEventId;
      next.time = Math.max(next.time, data.event.time);
    }
    if (action.type === 'evidence' && evidenceById(data, action.value)) next.evidenceId = action.value;
    if (action.type === 'time' && Number.isInteger(action.value) && action.value >= 0 && action.value < data.timeline.length) next.time = data.timeline[action.value];
    if (action.type === 'step') {
      const direction = action.value === 'previous' ? -1 : action.value === 'next' ? 1 : 0;
      next.time = data.timeline[Math.max(0, Math.min(data.timeline.length - 1, timelineIndex(data, next) + direction))];
    }
    if (action.type === 'event') {
      const event = eventById(data, action.value);
      if (event) {
        next.eventId = event.id;
        next.time = Math.max(next.time, event.time);
        if (event.id !== data.mainEventId || next.chapter === 'evidence') {
          next.layer = 'sequence';
          next.chapter = 'sequence';
        }
      }
    }
    const selected = eventById(data, next.eventId);
    if (!selected || selected.time > next.time) next.eventId = visibleEvents(data, next).slice(-1)[0]?.id || data.mainEventId;
    return next;
  }
  function readUrlState(data, value) {
    let url;
    try { url = new URL(value, 'https://noteworthynews.co'); } catch (_) { return defaultState(data); }
    const params = url.searchParams;
    let result = defaultState(data);
    result = reduce(data, result, { type: 'chapter', value: params.get('insideChapter') });
    const time = timestamp(params.get('insideTime'));
    if (time !== null && time >= data.timeline[0] && time <= data.timeline[data.timeline.length - 1]) {
      let index = data.timeline.findIndex(item => item > time) - 1;
      if (index < 0) index = data.timeline.length - 1;
      result = reduce(data, result, { type: 'time', value: index });
    }
    result = reduce(data, result, { type: 'event', value: params.get('insideEvent') });
    result = reduce(data, result, { type: 'evidence', value: params.get('insideEvidence') });
    const explicitSourceComparison = params.get('insideChapter') === 'evidence' && (!params.has('insideLayer') || params.get('insideLayer') === 'epicentre');
    if (!explicitSourceComparison) result = reduce(data, result, { type: 'layer', value: params.get('insideLayer') });
    // The source comparison intentionally uses the epicentre layer. Preserve
    // that explicit chapter in shared URLs, while other layers use their own copy.
    if (explicitSourceComparison) {
      result = reduce(data, result, { type: 'chapter', value: 'evidence' });
    }
    // Partial links still need a coherent map and detail panel. An occurrence
    // time by itself asks for the catalog; explicit main-quake views must use
    // the main record even if an earlier catalog time was also supplied.
    const validTimeSelection = time !== null && time >= data.timeline[0] && time <= data.timeline[data.timeline.length - 1];
    if (validTimeSelection && !CHAPTERS.includes(params.get('insideChapter')) && !data.availableLayers.includes(params.get('insideLayer'))) {
      result = reduce(data, result, { type: 'chapter', value: 'sequence' });
    }
    if (['overview', 'shaking'].includes(result.chapter)) {
      result = reduce(data, result, { type: 'chapter', value: result.chapter });
    }
    return result;
  }
  function writeUrlState(data, state, value, reset = false) {
    const url = new URL(value, 'https://noteworthynews.co');
    QUERY_KEYS.forEach(key => url.searchParams.delete(key));
    if (!reset) {
      url.searchParams.set('insideChapter', state.chapter);
      url.searchParams.set('insideTime', new Date(state.time).toISOString());
      url.searchParams.set('insideEvent', state.eventId);
      if (state.evidenceId) url.searchParams.set('insideEvidence', state.evidenceId);
      url.searchParams.set('insideLayer', state.layer);
    }
    return url.pathname + url.search + url.hash;
  }

  return { CHAPTERS, QUERY_KEYS, validId, timestamp, httpUrl, validBounds, project, formatTime, normalizeEvent, validGeoJson, prepareData,
    eventById, evidenceById, sourceById, visibleEvents, timelineIndex, defaultState, reduce, readUrlState, writeUrlState };
});
