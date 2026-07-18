/**
 * Food Safety article enhancement — progressive layer for FDA recall /
 * outbreak articles.
 *
 * The deterministic story text rendered by article-loader remains the
 * no-JS / failure baseline. This module fetches the strict public detail
 * endpoint and adds, in order:
 *
 *   1. consumer-action banner (top, before the body)
 *   2. "What changed" strip for updates (from structured version diffs)
 *   3. verified metric cards (only officially reported numbers)
 *   4. affected-products responsive table
 *   5. cases / distribution map (lazy-loads FoodSafetyMap + geometry)
 *   6. update timeline (from stored version records)
 *   7. labeled official source links
 *
 * Truth rules: nothing here invents values. Absent numbers stay absent.
 * Case states and distribution states are never merged.
 */
(function () {
  'use strict';

  const DETAIL_API = '/.netlify/functions/food-safety-event';
  const CSS_HREF = '/src/components/food-safety/food-safety.css';
  const MAP_SRC = '/src/components/food-safety/FoodSafetyMap.js';

  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function ensureStylesheet() {
    if (document.querySelector(`link[href="${CSS_HREF}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS_HREF;
    document.head.appendChild(link);
  }

  function loadMapModule() {
    if (window.FoodSafetyMap) return Promise.resolve(window.FoodSafetyMap);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = MAP_SRC;
      s.onload = () => resolve(window.FoodSafetyMap);
      s.onerror = () => reject(new Error('map module failed to load'));
      document.head.appendChild(s);
    });
  }

  function fmtDate(iso, withTime) {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const opts = { month: 'long', day: 'numeric', year: 'numeric' };
    if (withTime) { opts.hour = 'numeric'; opts.minute = '2-digit'; }
    return d.toLocaleDateString('en-US', opts);
  }

  function fmtNum(n) {
    return typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('en-US') : null;
  }

  // ── 1. Action banner ───────────────────────────

  function kindLabel(ev) {
    if (ev.event_kind === 'outbreak') return 'Outbreak';
    if (ev.event_kind === 'allergen_alert') return 'Allergen Alert';
    if (ev.event_kind === 'safety_alert') return 'Safety Alert';
    return 'Food Recall';
  }

  function statusLabel(ev) {
    const map = {
      new: 'Active', active: 'Active', ongoing: 'Ongoing',
      updated: 'Updated', expanded: 'Expanded',
      ended: 'Investigation ended', terminated: 'Recall terminated',
    };
    return map[ev.status] || null;
  }

  function buildBanner(ev) {
    const bits = [];
    bits.push(`<span class="fs-banner-kind fs-banner-kind--${esc(ev.event_kind || 'recall')}">${esc(kindLabel(ev))}</span>`);
    if (ev.update_number > 0) bits.push(`<span class="fs-banner-update">Update ${esc(String(ev.update_number))}</span>`);
    const st = statusLabel(ev);
    if (st) bits.push(`<span class="fs-banner-status">${esc(st)}</span>`);
    const updated = fmtDate(ev.source_updated_at || ev.fda_publish_date);
    if (updated) bits.push(`<span class="fs-banner-date">FDA · ${esc(updated)}</span>`);

    // Only FDA-supported consumer actions ever reach public_action.
    const action = ev.public_action
      ? `<p class="fs-banner-action">${esc(ev.public_action)}</p>`
      : '';

    return `
      <aside class="fs-banner" role="note" aria-label="Consumer safety status">
        <div class="fs-banner-row">${bits.join('')}</div>
        ${action}
      </aside>`;
  }

  // ── 2. What changed ────────────────────────────

  function buildWhatChanged(timeline, ev) {
    if (!Array.isArray(timeline) || timeline.length < 2) return '';
    const latest = timeline[timeline.length - 1];
    const changes = Array.isArray(latest.material_changes) ? latest.material_changes : [];
    if (!changes.length) return '';
    const when = fmtDate(latest.source_updated_at || latest.observed_at);
    return `
      <section class="fs-section fs-changed" aria-labelledby="fs-changed-h">
        <h2 id="fs-changed-h" class="fs-section-title">What changed${ev.update_number > 0 ? ` in Update ${esc(String(ev.update_number))}` : ''}</h2>
        ${when ? `<p class="fs-section-sub">Official update · ${esc(when)}</p>` : ''}
        <ul class="fs-changed-list">
          ${changes.map((c) => `<li>${esc(c.label || '')}</li>`).join('')}
        </ul>
      </section>`;
  }

  // ── 3. Metric cards ────────────────────────────

  function buildMetrics(ev, productCount) {
    const cards = [];
    const add = (label, value, cls) => {
      if (value == null || value === '') return;
      cards.push(`<div class="fs-metric${cls ? ` ${cls}` : ''}"><span class="fs-metric-value">${esc(String(value))}</span><span class="fs-metric-label">${esc(label)}</span></div>`);
    };

    const isOutbreak = ev.event_kind === 'outbreak';
    // Only explicitly reported numbers. null never becomes 0.
    // Outbreak metrics are investigation-linked — never framed as a national disease total.
    add(
      isOutbreak ? 'Illnesses linked to this investigation' : 'Illnesses',
      fmtNum(ev.illnesses),
      typeof ev.illnesses === 'number' && ev.illnesses > 0 ? 'fs-metric--alert' : '',
    );
    add(
      isOutbreak ? 'Hospitalizations linked to this investigation' : 'Hospitalizations',
      fmtNum(ev.hospitalizations),
      typeof ev.hospitalizations === 'number' && ev.hospitalizations > 0 ? 'fs-metric--alert' : '',
    );
    add(
      isOutbreak ? 'Deaths linked to this investigation' : 'Deaths',
      fmtNum(ev.deaths),
      typeof ev.deaths === 'number' && ev.deaths > 0 ? 'fs-metric--alert' : '',
    );

    const outbreakStates = ev.outbreak_case_states || ev.case_states;
    if (Array.isArray(outbreakStates) && outbreakStates.length) {
      add(isOutbreak ? 'States with outbreak-linked cases' : 'States with cases', outbreakStates.length);
    }
    const distStates = ev.confirmed_distribution_states || ev.distribution_states;
    if (Array.isArray(distStates) && distStates.length) {
      add('Confirmed distribution states', distStates.length);
    } else if (ev.geographic_scope === 'nationwide') {
      add('Confirmed product distribution', 'Nationwide');
    }
    add('Last illness onset', fmtDate(ev.last_illness_onset));
    add('FDA classification', ev.fda_recall_classification);
    if (productCount > 1) add('Affected products', productCount);

    // Never invent or display a national pathogen total.
    const nationalCount = ev.national_surveillance_context
      && ev.national_surveillance_context.national_case_count;
    if (Number.isFinite(nationalCount)) {
      add('National surveillance cases (official)', fmtNum(nationalCount));
    }

    if (!cards.length) return '';
    return `
      <section class="fs-section" aria-labelledby="fs-metrics-h">
        <h2 id="fs-metrics-h" class="fs-section-title">Verified figures <span class="fs-section-src">per FDA</span></h2>
        <div class="fs-metrics">${cards.join('')}</div>
        <p class="fs-metrics-note">Only figures explicitly reported by FDA for this investigation appear here. Missing figures were not reported, not zero.${isOutbreak ? ' These totals are not a national disease count.' : ''}</p>
      </section>`;
  }

  function buildNationalContext(ev) {
    const ctx = ev.national_surveillance_context;
    if (!ctx || !ctx.outbreak_is_subset_of_national) return '';
    const statements = Array.isArray(ctx.statements) ? ctx.statements.filter(Boolean) : [];
    if (!statements.length) return '';
    // Guard: never invent a national total in this section.
    if (ctx.national_case_count != null && !Number.isFinite(ctx.national_case_count)) return '';
    return `
      <section class="fs-section fs-national-context" aria-labelledby="fs-national-h">
        <h2 id="fs-national-h" class="fs-section-title">National surveillance context</h2>
        <ul class="fs-national-list">
          ${statements.map((s) => `<li>${esc(s)}</li>`).join('')}
        </ul>
        ${Number.isFinite(ctx.national_case_count)
    ? `<p class="fs-national-total">Official national surveillance total: ${esc(fmtNum(ctx.national_case_count))}</p>`
    : '<p class="fs-national-note">No separate national case total is shown because FDA and CDC have not published one for this advisory beyond the investigation-linked figures above.</p>'}
      </section>`;
  }

  // ── 4. Affected products table ─────────────────

  const PRODUCT_COLUMNS = [
    { key: 'brand', label: 'Brand' },
    { key: 'product_name', label: 'Product' },
    { key: 'variety', label: 'Variety' },
    { key: 'package_size', label: 'Package' },
    { key: 'upc', label: 'UPC' },
    { key: 'lot_code', label: 'Lot' },
    { key: 'additional_codes', label: 'Other codes' },
    { key: 'best_by_date', label: 'Best by' },
    { key: 'use_by_date', label: 'Use by' },
    { key: 'expiration_date', label: 'Expires' },
    { key: 'retailers', label: 'Retailer' },
  ];

  function cellValue(p, key) {
    const v = p[key];
    if (v == null) return '';
    if (Array.isArray(v)) return v.join(', ');
    return String(v);
  }

  function buildProducts(products) {
    if (!Array.isArray(products) || !products.length) return '';
    // Columns appear only when at least one row has a value
    const cols = PRODUCT_COLUMNS.filter((c) => products.some((p) => cellValue(p, c.key)));
    if (!cols.length) return '';

    const showFilter = products.length >= 8;
    const filter = showFilter
      ? `<input type="search" class="fs-products-filter" placeholder="Filter by product, UPC, or lot" aria-label="Filter affected products">`
      : '';

    const head = cols.map((c) => `<th scope="col">${esc(c.label)}</th>`).join('');
    const rows = products.map((p) => {
      const cells = cols.map((c) => `<td data-label="${esc(c.label)}">${esc(cellValue(p, c.key)) || '<span class="fs-cell-empty">—</span>'}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    return `
      <section class="fs-section" id="fs-products" aria-labelledby="fs-products-h">
        <h2 id="fs-products-h" class="fs-section-title">Affected products</h2>
        ${filter}
        <div class="fs-table-wrap" role="region" aria-label="Affected products table" tabindex="0">
          <table class="fs-products-table">
            <thead><tr>${head}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>`;
  }

  function bindProductFilter(root) {
    const input = root.querySelector('.fs-products-filter');
    if (!input) return;
    const rows = Array.from(root.querySelectorAll('.fs-products-table tbody tr'));
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      rows.forEach((tr) => {
        tr.hidden = q ? !tr.textContent.toLowerCase().includes(q) : false;
      });
    });
  }

  // ── 5. Map ─────────────────────────────────────

  function buildMapSection(map, ev) {
    const hasCases = map.mode_case_data;
    const hasDist = map.mode_distribution_data;
    if (!hasCases && !hasDist) return '';

    const labels = map.labels || {};
    const tabCases = labels.tab_cases || 'Cases linked to this outbreak';
    const tabDist = labels.tab_distribution || 'Confirmed product distribution';

    const toggle = hasCases && hasDist
      ? `<div class="fs-map-toggle" role="tablist" aria-label="Map mode">
          <button type="button" class="fs-map-toggle-btn is-active" data-mode="cases" role="tab" aria-selected="true">${esc(tabCases)}</button>
          <button type="button" class="fs-map-toggle-btn" data-mode="distribution" role="tab" aria-selected="false">${esc(tabDist)}</button>
        </div>`
      : '';

    const single = !toggle
      ? `<p class="fs-section-sub">${hasCases
    ? (labels.caption_cases || 'States reporting outbreak-associated cases')
    : (labels.caption_distribution || 'Confirmed product distribution')}</p>`
      : '';

    // Case-mode national-subset notice is rendered inside FoodSafetyMap (cases only).
    const possibleDist = (map.possible_additional_distribution || ev.possible_additional_distribution)
      ? '<p class="fs-map-distribution-caveat" role="note">FDA says implicated product may have been distributed beyond the states currently confirmed.</p>'
      : '';

    return `
      <section class="fs-section" id="fs-map" aria-labelledby="fs-map-h">
        <h2 id="fs-map-h" class="fs-section-title">${hasCases ? 'Outbreak-linked cases and confirmed distribution' : 'Confirmed product distribution'}</h2>
        ${toggle}${single}
        <div class="fs-map-container" data-fs-map></div>
        ${possibleDist}
        ${map.distribution_text ? `<p class="fs-map-source-text">FDA distribution note: ${esc(map.distribution_text)}</p>` : ''}
      </section>`;
  }

  async function initMap(root, map) {
    const container = root.querySelector('[data-fs-map]');
    if (!container) return;
    let mod;
    try {
      mod = await loadMapModule();
    } catch (e) {
      container.innerHTML = '<p class="fs-map-unknown">Map unavailable. State lists are shown in the sections above.</p>';
      return;
    }
    const initialMode = map.mode_case_data ? 'cases' : 'distribution';
    await mod.render(container, { mode: initialMode, map });

    root.querySelectorAll('.fs-map-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        root.querySelectorAll('.fs-map-toggle-btn').forEach((b) => {
          const active = b === btn;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        await mod.render(container, { mode: btn.dataset.mode, map });
      });
    });
  }

  // ── 6. Timeline ────────────────────────────────

  function buildTimeline(timeline) {
    if (!Array.isArray(timeline) || !timeline.length) return '';
    const items = timeline.slice().reverse().map((v) => {
      const when = fmtDate(v.source_updated_at || v.observed_at);
      const changes = Array.isArray(v.material_changes) ? v.material_changes : [];
      const label = v.version_number === 1
        ? 'First FDA posting recorded'
        : (changes.length ? changes.map((c) => esc(c.label || '')).join('<br>') : 'Official update recorded');
      return `
        <li class="fs-timeline-item">
          <span class="fs-timeline-marker" aria-hidden="true"></span>
          <div class="fs-timeline-body">
            <span class="fs-timeline-date">${esc(when || `Version ${v.version_number}`)}</span>
            <p class="fs-timeline-text">${label}</p>
          </div>
        </li>`;
    }).join('');
    return `
      <section class="fs-section" id="fs-timeline" aria-labelledby="fs-timeline-h">
        <h2 id="fs-timeline-h" class="fs-section-title">Update timeline</h2>
        <ol class="fs-timeline">${items}</ol>
      </section>`;
  }

  // ── 7. Official sources ────────────────────────

  const ROLE_LABELS = {
    canonical: 'Official FDA advisory',
    company_announcement: 'Company announcement (hosted by FDA)',
    core_table: 'FDA CORE investigation table',
    recall_table: 'FDA recalls index',
    related: 'Related official FDA page',
    openfda: 'openFDA enforcement record (supplementary)',
  };

  function buildSources(ev) {
    const links = Array.isArray(ev.source_links) ? ev.source_links : [];
    const rows = [];
    const seen = new Set();
    if (ev.source_url && !links.some((l) => l.url === ev.source_url)) {
      rows.push({ url: ev.source_url, label: null, role: 'canonical' });
    }
    links.forEach((l) => { if (l && l.url) rows.push(l); });
    const items = rows.filter((l) => {
      if (seen.has(l.url)) return false;
      seen.add(l.url);
      return true;
    }).map((l) => `
      <li class="fs-source-item">
        <a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">
          <span class="fs-source-role">${esc(ROLE_LABELS[l.role] || l.label || 'Official FDA page')}</span>
          <span class="fs-source-url">${esc(l.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 80))}</span>
        </a>
      </li>`).join('');
    if (!items) return '';
    return `
      <section class="fs-section" id="fs-sources" aria-labelledby="fs-sources-h">
        <h2 id="fs-sources-h" class="fs-section-title">Official sources</h2>
        <ul class="fs-sources">${items}</ul>
      </section>`;
  }

  // ── Entry point ────────────────────────────────

  /**
   * @param {object} post       the post record (needs food_safety_event_id or id)
   * @param {HTMLElement} bodyElement  #article-body
   */
  async function enhance(post, bodyElement) {
    if (!bodyElement) return;
    ensureStylesheet();

    const eventId = post.food_safety_event_id || null;
    const url = eventId
      ? `${DETAIL_API}?id=${encodeURIComponent(eventId)}`
      : `${DETAIL_API}?post=${encodeURIComponent(post.id || '')}`;

    let detail;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      detail = await res.json();
    } catch (e) {
      // Baseline article (deterministic story text + source trail) stands alone.
      console.warn('[FoodSafety] detail unavailable:', e.message);
      return;
    }
    if (!detail || !detail.event) return;

    const ev = detail.event;
    const products = detail.products || [];
    const timeline = detail.timeline || [];
    const map = detail.map || {};

    // Banner + what-changed go ABOVE the body; data sections follow it.
    const top = document.createElement('div');
    top.className = 'fs-top';
    top.innerHTML = buildBanner(ev) + buildWhatChanged(timeline, ev);
    bodyElement.parentNode.insertBefore(top, bodyElement);

    const below = document.createElement('div');
    below.className = 'fs-detail';
    below.innerHTML = [
      buildMetrics(ev, products.length),
      buildNationalContext(ev),
      buildProducts(products),
      buildMapSection(map, ev),
      buildTimeline(timeline),
      buildSources(ev),
    ].join('');
    bodyElement.insertAdjacentElement('afterend', below);

    bindProductFilter(below);
    if (below.querySelector('[data-fs-map]')) {
      // Lazy: only fetch geometry when the map section is near the viewport.
      const target = below.querySelector('#fs-map');
      if ('IntersectionObserver' in window && target) {
        const io = new IntersectionObserver((entries) => {
          if (entries.some((en) => en.isIntersecting)) {
            io.disconnect();
            initMap(below, map);
          }
        }, { rootMargin: '400px' });
        io.observe(target);
      } else {
        initMap(below, map);
      }
    }
  }

  window.FoodSafetyArticle = { enhance };
}());
