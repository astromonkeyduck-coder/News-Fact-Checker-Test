/**
 * FoodSafetyMap — dependency-free SVG U.S. map for Food Safety articles.
 *
 * Two explicitly separate modes:
 *   cases        — binary affected-state highlighting, or a choropleth ONLY
 *                  when official per-state counts exist
 *   distribution — source-backed distribution states; explicit nationwide
 *                  gets an honest all-states treatment with a label
 *
 * Truth rules enforced here:
 *   - never invents per-state numbers (choropleth requires official counts)
 *   - unknown geography renders a plain-language notice, never a guess
 *   - a text/table alternative always renders beneath the SVG
 *   - Puerto Rico / territories (outside the AlbersUsa projection) are
 *     listed explicitly as text when present in the data
 *
 * Geometry is vendored locally at /assets/food-safety/us-states.json
 * (Census-derived us-atlas, precomputed AlbersUsa paths — no runtime CDN).
 */
(function () {
  'use strict';

  const GEOMETRY_URL = '/assets/food-safety/us-states.json';
  let geometryPromise = null;

  function loadGeometry() {
    if (!geometryPromise) {
      geometryPromise = fetch(GEOMETRY_URL).then((res) => {
        if (!res.ok) throw new Error(`geometry HTTP ${res.status}`);
        return res.json();
      });
    }
    return geometryPromise;
  }

  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatAsOf(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  /** Bin official per-state counts into up to 4 intensity levels. */
  function binCounts(counts) {
    const values = Object.values(counts).filter((v) => typeof v === 'number' && v > 0);
    if (!values.length) return () => 0;
    const max = Math.max(...values);
    if (max <= 1) return () => 1;
    return (v) => {
      if (!v) return 0;
      const t = v / max;
      if (t > 0.66) return 3;
      if (t > 0.33) return 2;
      return 1;
    };
  }

  /**
   * Render the map into `container`.
   * @param {HTMLElement} container
   * @param {object} opts
   *   mode: 'cases' | 'distribution'
   *   map:  the `map` payload from /.netlify/functions/food-safety-event
   */
  async function render(container, { mode, map } = {}) {
    if (!container || !map) return;
    const isCases = mode === 'cases';
    const stateEntries = isCases ? (map.case_states || []) : (map.distribution_states || []);
    const counts = isCases && map.case_counts_by_state && typeof map.case_counts_by_state === 'object'
      ? map.case_counts_by_state : null;
    const nationwide = !isCases && map.nationwide_distribution === true;

    const abbrs = new Set(stateEntries.map((s) => s.abbr));
    const nameByAbbr = {};
    stateEntries.forEach((s) => { nameByAbbr[s.abbr] = s.name; });

    // Unknown geography: honest text, no map
    if (!nationwide && abbrs.size === 0) {
      container.innerHTML = `
        <p class="fs-map-unknown">${isCases
    ? 'FDA has not published a state-by-state case list for this event.'
    : 'FDA has not published a state-level distribution list for this event.'}</p>`;
      return;
    }

    let geometry;
    try {
      geometry = await loadGeometry();
    } catch (e) {
      container.innerHTML = buildTextAlternative({ isCases, stateEntries, counts, nationwide, map });
      return;
    }

    const bin = counts ? binCounts(counts) : null;
    const asOf = formatAsOf(map.as_of);
    const uid = `fsmap-${Math.random().toString(36).slice(2, 8)}`;

    const paths = geometry.states.map((s) => {
      const active = nationwide || abbrs.has(s.abbr);
      const count = counts ? counts[s.abbr] : undefined;
      let cls = 'fs-map-state';
      if (active) {
        cls += counts && typeof count === 'number'
          ? ` fs-map-state--level${bin(count)}`
          : ' fs-map-state--active';
      }
      const label = active
        ? (typeof count === 'number'
          ? `${s.name}: ${count.toLocaleString('en-US')} ${isCases ? 'cases' : ''}`.trim()
          : `${s.name}: ${isCases ? 'confirmed cases reported' : 'product distributed'}`)
        : s.name;
      return `<path d="${s.path}" class="${cls}" data-abbr="${s.abbr}" tabindex="${active ? 0 : -1}"
        role="img" aria-label="${esc(label)}"><title>${esc(label)}</title></path>`;
    }).join('');

    const legend = buildLegend({ isCases, counts, nationwide });

    // Territories present in the data but outside the projection
    const missing = stateEntries.filter((s) => !geometry.states.some((g) => g.abbr === s.abbr));

    container.innerHTML = `
      <figure class="fs-map-figure" role="group" aria-labelledby="${uid}-caption">
        <svg viewBox="0 0 ${geometry.meta.width} ${geometry.meta.height}" class="fs-map-svg"
             preserveAspectRatio="xMidYMid meet" aria-hidden="false">
          <g>${paths}</g>
        </svg>
        ${nationwide ? '<p class="fs-map-nationwide-note">FDA reports nationwide distribution. State-level records were not individually supplied.</p>' : ''}
        ${legend}
        <figcaption id="${uid}-caption" class="fs-map-caption">
          ${isCases ? 'States with confirmed cases' : 'States where product was distributed'}
          ${asOf ? ` · as of ${esc(asOf)} (FDA)` : ' (FDA)'}
        </figcaption>
        ${missing.length ? `<p class="fs-map-territories">Also listed by FDA: ${esc(missing.map((s) => s.name || s.abbr).join(', '))}</p>` : ''}
      </figure>
      ${buildTextAlternative({ isCases, stateEntries, counts, nationwide, map })}`;
  }

  function buildLegend({ isCases, counts, nationwide }) {
    if (nationwide) {
      return `<div class="fs-map-legend"><span class="fs-map-legend-swatch fs-map-state--active"></span>
        <span>Nationwide distribution (per FDA)</span></div>`;
    }
    if (counts) {
      return `<div class="fs-map-legend" aria-label="Case count intensity legend">
        <span class="fs-map-legend-swatch fs-map-state--level1"></span><span>Fewer cases</span>
        <span class="fs-map-legend-swatch fs-map-state--level2"></span>
        <span class="fs-map-legend-swatch fs-map-state--level3"></span><span>More cases</span>
      </div>`;
    }
    return `<div class="fs-map-legend"><span class="fs-map-legend-swatch fs-map-state--active"></span>
      <span>${isCases ? 'Confirmed cases reported' : 'Product distributed'}</span></div>`;
  }

  /** Accessible text/table alternative (always rendered under the SVG). */
  function buildTextAlternative({ isCases, stateEntries, counts, nationwide }) {
    if (nationwide && stateEntries.length === 0) {
      return '<p class="fs-map-alt">FDA reports the product was distributed nationwide.</p>';
    }
    if (!stateEntries.length) return '';
    if (counts) {
      const rows = stateEntries
        .map((s) => ({ name: s.name || s.abbr, count: counts[s.abbr] }))
        .sort((a, b) => (b.count || 0) - (a.count || 0));
      return `<details class="fs-map-alt-details"><summary>State-by-state table</summary>
        <table class="fs-map-alt-table"><thead><tr><th scope="col">State</th><th scope="col">Official count</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${typeof r.count === 'number' ? r.count.toLocaleString('en-US') : 'Not reported'}</td></tr>`).join('')}</tbody>
        </table></details>`;
    }
    const names = stateEntries.map((s) => s.name || s.abbr);
    const note = isCases
      ? 'State-by-state counts were not provided by FDA.'
      : '';
    return `<p class="fs-map-alt">${isCases ? 'States with confirmed cases' : 'Distribution states'}: ${esc(names.join(', '))}.${note ? ` ${note}` : ''}</p>`;
  }

  window.FoodSafetyMap = { render, loadGeometry };
}());
