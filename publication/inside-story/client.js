(function (root, factory) {
  const model = typeof module === 'object' && module.exports ? require('./model') : root.NoteworthyInsideStory;
  const api = factory(model);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else if (root.document && model) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', () => api.init(root));
    else api.init(root);
  }
})(typeof window === 'object' ? window : this, function (model) {
  'use strict';
  const CHAPTER_LABELS = { overview: 'Overview', sequence: 'Recorded earthquake sequence', shaking: 'Estimated shaking', evidence: 'Saved source versions' };
  const number = value => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 3 }) : null;
  function setVisible(element, visible) {
    if (!element) return;
    element.hidden = !visible;
    // SVG does not reflect the HTML hidden property into its attribute. The
    // shared [hidden] rule requires removing it explicitly when revealing SVG.
    if (visible) element.removeAttribute('hidden');
    else element.setAttribute('hidden', '');
    if (element.namespaceURI === 'http://www.w3.org/2000/svg') element.style.display = visible ? '' : 'none';
  }
  function replaceContent(element, nodes) {
    if (element) element.replaceChildren(...nodes);
  }
  function node(doc, tag, text) {
    const element = doc.createElement(tag); element.textContent = text; return element;
  }
  function definitionList(doc, items) {
    const list = doc.createElement('dl');
    items.forEach(([label, value]) => { list.appendChild(node(doc, 'dt', label)); list.appendChild(node(doc, 'dd', value)); });
    return list;
  }
  function link(doc, title, url) {
    const anchor = node(doc, 'a', title); anchor.href = url; anchor.rel = 'noopener noreferrer'; return anchor;
  }
  function renderEvent(doc, panel, event, data) {
    if (!panel || !event) return;
    const details = definitionList(doc, [
      ['Occurrence time', model.formatTime(event.time)],
      ['Depth', number(event.depthKm) === null ? 'Not reported' : `${number(event.depthKm)} km`],
      ['Coordinates', `${event.latitude.toFixed(4)}°, ${event.longitude.toFixed(4)}°`],
    ]);
    const updated = node(doc, 'p', '');
    updated.appendChild(node(doc, 'small', event.updated === null ? 'Catalog update time not supplied.' : `Catalog updated ${model.formatTime(event.updated)}.`));
    replaceContent(panel, [node(doc, 'h3', `${number(event.magnitude) === null ? 'Magnitude not reported' : `M${number(event.magnitude)}`} · USGS record`), node(doc, 'p', event.place), details,
      updated,
      link(doc, `Open the USGS event record (${event.id})`, event.url)]);
  }
  function renderEvidence(doc, panel, evidence, source) {
    if (!panel) return;
    if (!evidence || !source) {
      replaceContent(panel, [node(doc, 'p', 'A dated source version is not available in this interactive view. The sourced article remains available below.')]);
      return;
    }
    const details = [['Source version issued', model.formatTime(evidence.time)]];
    if (source.retrievedAt !== null) details.push(['Source retrieved', model.formatTime(source.retrievedAt)]);
    replaceContent(panel, [node(doc, 'h3', evidence.label), node(doc, 'p', evidence.text), definitionList(doc, details),
      node(doc, 'p', 'This is a documented source version. It is separate from the catalog filter, which uses earthquake occurrence times.'),
      link(doc, source.title, source.url)]);
  }

  function init(win) {
    const scope = win.document.querySelector('[data-inside-story]');
    if (!scope || scope.dataset.insideInitialized === 'true') return null;
    scope.dataset.insideInitialized = 'true';
    let status = scope.querySelector('[data-inside-status]');
    if (!status) { status = node(win.document, 'p', ''); scope.appendChild(status); }
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const controlGroups = [...scope.querySelectorAll('[data-inside-controls]')];
    let prepared;
    try {
      const json = scope.querySelector('#inside-story-data') || win.document.getElementById('inside-story-data');
      prepared = model.prepareData(JSON.parse(json?.textContent || 'null'));
    } catch (_) { prepared = { ok: false }; }
    if (!prepared.ok) {
      controlGroups.forEach(group => setVisible(group, false));
      status.textContent = 'The interactive view could not load its source data. The full sourced article, explanation and links remain available on this page.';
      return null;
    }
    const data = prepared.data;
    let current = model.readUrlState(data, win.location.href);
    const range = scope.querySelector('[data-inside-time]');
    const evidenceRange = scope.querySelector('[data-inside-evidence-time]');
    const evidenceSelect = scope.querySelector('[data-inside-evidence]');
    const eventPanel = scope.querySelector('[data-inside-event-detail]');
    const evidencePanel = scope.querySelector('[data-inside-evidence-detail]');
    let lastEventId; let lastEvidenceId;
    let urlUnavailable = false;
    function setText(selector, value) { const element = scope.querySelector(selector); if (element) element.textContent = value; }
    function configureRange(element, count, label) {
      if (!element) return;
      element.min = '0'; element.max = String(Math.max(0, count - 1)); element.step = '1'; element.disabled = count < 2;
      if (!element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby')) element.setAttribute('aria-label', label);
    }
    configureRange(range, data.timeline.length, 'Filter catalog earthquakes by occurrence time');
    configureRange(evidenceRange, data.evidence.length, 'Choose a dated source version');
    if (evidenceSelect) {
      evidenceSelect.replaceChildren(...data.evidence.map(item => {
        const option = node(win.document, 'option', `${item.label} · ${model.formatTime(item.time)}`); option.value = item.id; return option;
      }));
      evidenceSelect.disabled = data.evidence.length === 0;
      if (!evidenceSelect.getAttribute('aria-label') && !evidenceSelect.getAttribute('aria-labelledby')) evidenceSelect.setAttribute('aria-label', 'Dated source version');
    }
    function renderMarker(evidence) {
      const marker = scope.querySelector('[data-inside-evidence-marker]');
      if (!marker) return;
      const valid = current.chapter === 'evidence' && evidence && typeof evidence.longitude === 'number' && typeof evidence.latitude === 'number' &&
        Number.isFinite(evidence.longitude) && Number.isFinite(evidence.latitude) && Math.abs(evidence.longitude) <= 180 && Math.abs(evidence.latitude) <= 90;
      setVisible(marker, Boolean(valid));
      setVisible(scope.querySelector('[data-inside-evidence-marker-legend]'), Boolean(valid));
      if (!valid) return;
      const map = scope.querySelector('[data-inside-map]');
      const size = (map?.getAttribute('data-inside-projection-size') || '800 530').trim().split(/[\s,]+/).map(Number);
      const position = model.project([evidence.longitude, evidence.latitude], data.bounds, size);
      if (String(marker.tagName).toLowerCase() === 'g') marker.setAttribute('transform', `translate(${position.x} ${position.y})`);
      else { marker.setAttribute('cx', String(position.x)); marker.setAttribute('cy', String(position.y)); }
      marker.setAttribute('aria-label', `Origin location in ${evidence.label}`);
      setText('[data-inside-evidence-marker-label]', evidence.label);
    }
    function render() {
      scope.dataset.insideActiveChapter = current.chapter;
      scope.dataset.insideActiveLayer = current.layer;
      const map = scope.querySelector('[data-inside-map]');
      const view = current.layer === 'sequence' ? 'sequence' : current.chapter === 'evidence' ? 'evidence' : current.layer === 'shaking' ? 'shaking' : 'overview';
      const frame = map?.getAttribute(`data-inside-view-${view}`);
      const frameValues = frame?.trim().split(/[\s,]+/).map(Number);
      if (frameValues?.length === 4 && frameValues.every(Number.isFinite) && frameValues[2] > 0 && frameValues[3] > 0) map.setAttribute('viewBox', frameValues.join(' '));
      scope.querySelectorAll('[data-inside-time-controls]').forEach(group => setVisible(group, current.layer === 'sequence'));
      scope.querySelectorAll('[data-inside-evidence-controls]').forEach(group => setVisible(group, current.chapter === 'evidence'));
      setVisible(eventPanel, current.chapter !== 'evidence');
      scope.querySelectorAll('[data-inside-chapter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.insideChapter === current.chapter)));
      scope.querySelectorAll('[data-inside-chapter-copy]').forEach(copy => setVisible(copy, copy.dataset.insideChapterCopy === current.chapter));
      scope.querySelectorAll('[data-inside-layer]').forEach(button => {
        button.disabled = !data.availableLayers.includes(button.dataset.insideLayer);
        button.setAttribute('aria-pressed', String(button.dataset.insideLayer === current.layer));
      });
      scope.querySelectorAll('[data-inside-map-layer]').forEach(layer => setVisible(layer,
        layer.dataset.insideMapLayer === current.layer || (layer.dataset.insideMapLayer === 'epicentre' && current.layer === 'shaking')));
      const visible = new Set(model.visibleEvents(data, current).map(event => event.id));
      scope.querySelectorAll('[data-inside-event-point]').forEach(point => setVisible(point, visible.has(point.dataset.insideEventPoint)));
      scope.querySelectorAll('[data-inside-event]').forEach(button => {
        const event = model.eventById(data, button.dataset.insideEvent);
        if (!event) return;
        setVisible(button, visible.has(event.id));
        if (String(button.tagName).toLowerCase() === 'button') button.setAttribute('aria-pressed', String(event.id === current.eventId));
        else if (event.id === current.eventId) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
        button.dataset.insideSelected = String(event.id === current.eventId);
      });
      const index = model.timelineIndex(data, current);
      const timeLabel = `${model.formatTime(current.time)} · ${visible.size} / ${data.events.length} events`;
      if (range) { range.value = String(index); range.setAttribute('aria-valuetext', `${model.formatTime(current.time)}; ${visible.size} of ${data.events.length} catalog events by occurrence time, not what was known then`); }
      setText('[data-inside-time-label]', timeLabel);
      scope.querySelectorAll('[data-inside-step]').forEach(button => { button.disabled = button.dataset.insideStep === 'previous' ? index === 0 : index === data.timeline.length - 1; });
      const evidence = model.evidenceById(data, current.evidenceId);
      const evidenceIndex = Math.max(0, data.evidence.findIndex(item => item.id === current.evidenceId));
      if (evidenceSelect) evidenceSelect.value = evidence?.id || '';
      if (evidenceRange) {
        evidenceRange.value = String(evidenceIndex);
        evidenceRange.setAttribute('aria-valuetext', evidence ? `${evidence.label}; issued ${model.formatTime(evidence.time)}` : 'Dated source version unavailable');
      }
      setText('[data-inside-evidence-time-label]', evidence ? `${evidence.label} · Issued ${model.formatTime(evidence.time)}` : 'Dated source version unavailable');
      scope.querySelectorAll('[data-inside-evidence-stat]').forEach(element => {
        const field = element.dataset.insideEvidenceStat;
        const value = field === 'issuedAt' ? (evidence ? model.formatTime(evidence.time) : null) : number(evidence?.[field]);
        element.textContent = value === null ? 'Not supplied by this version' : value + (field === 'depthKm' ? ' km' : '');
      });
      if (lastEventId !== current.eventId) { renderEvent(win.document, eventPanel, model.eventById(data, current.eventId), data); lastEventId = current.eventId; }
      if (lastEvidenceId !== current.evidenceId) { renderEvidence(win.document, evidencePanel, evidence, evidence && model.sourceById(data, evidence.sourceId)); lastEvidenceId = current.evidenceId; }
      renderMarker(evidence);
    }
    function announce(action) {
      let message = '';
      if (action.type === 'chapter') message = `${CHAPTER_LABELS[current.chapter]} selected. The complete explanation remains available below.`;
      else if (action.type === 'evidence') { const item = model.evidenceById(data, current.evidenceId); message = item ? `${item.label}, issued ${model.formatTime(item.time)}. This changes the displayed source version, not the occurrence-time catalog.` : 'Dated source version unavailable.'; }
      else if (action.type === 'event') message = `${current.eventId} selected. The source details have been updated.`;
      else if (action.type === 'reset') message = 'The interactive view is reset. The latest saved source version is selected.';
      else if (action.type === 'layer') message = `${current.layer === 'shaking' ? 'Estimated shaking' : current.layer === 'sequence' ? 'Recorded earthquake sequence' : 'Current epicentre'} layer selected.`;
      else message = `Catalog occurrence-time filter: ${model.formatTime(current.time)}. ${model.visibleEvents(data, current).length} recorded events visible.`;
      status.textContent = message + (urlUnavailable ? ' The address could not be updated in this browser; the on-page controls still work.' : '');
    }
    function update(action, announceChange = true) {
      current = model.reduce(data, current, action);
      render();
      try { win.history.replaceState(win.history.state, '', model.writeUrlState(data, current, win.location.href, action.type === 'reset')); }
      catch (_) { urlUnavailable = true; }
      if (announceChange) announce(action);
    }
    scope.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || (event.button !== undefined && event.button !== 0)) return;
      const target = event.target.closest('[data-inside-chapter], [data-inside-layer], [data-inside-event], [data-inside-step], [data-inside-reset]');
      if (!target || !scope.contains(target) || target.disabled) return;
      let action;
      if (target.hasAttribute('data-inside-reset')) action = { type: 'reset' };
      else if (target.hasAttribute('data-inside-event')) action = { type: 'event', value: target.dataset.insideEvent };
      else if (target.hasAttribute('data-inside-chapter')) action = { type: 'chapter', value: target.dataset.insideChapter };
      else if (target.hasAttribute('data-inside-layer')) action = { type: 'layer', value: target.dataset.insideLayer };
      else action = { type: 'step', value: target.dataset.insideStep };
      event.preventDefault(); update(action);
    });
    if (range) {
      range.addEventListener('input', () => update({ type: 'time', value: Number(range.value) }, false));
      range.addEventListener('change', () => update({ type: 'time', value: Number(range.value) }));
    }
    if (evidenceSelect) evidenceSelect.addEventListener('change', () => update({ type: 'evidence', value: evidenceSelect.value }));
    if (evidenceRange) {
      const evidenceAction = () => ({ type: 'evidence', value: data.evidence[Number(evidenceRange.value)]?.id });
      evidenceRange.addEventListener('input', () => update(evidenceAction(), false));
      evidenceRange.addEventListener('change', () => update(evidenceAction()));
    }
    win.addEventListener('popstate', () => { current = model.readUrlState(data, win.location.href); render(); status.textContent = 'The interactive view now matches the page address.'; });
    try {
      controlGroups.forEach(group => setVisible(group, true));
      render();
      status.textContent = prepared.warnings.length ? prepared.warnings.join(' ') : 'Explore the official source versions and the recorded catalog. No playback runs automatically.';
      scope.querySelectorAll('[data-inside-static-event]').forEach(element => setVisible(element, false));
    } catch (_) {
      controlGroups.forEach(group => setVisible(group, false));
      status.textContent = 'The interactive view is unavailable in this browser. The full sourced article remains available on this page.';
      return null;
    }
    return { getState: () => ({ ...current }), data };
  }

  return { init };
});
