/**
 * Situation Monitor V2 — Shell Orchestrator
 *
 * Responsibilities:
 *  1. Initialize panels and map
 *  2. Coordinate a single refresh cycle
 *  3. Maintain status bar and alert banner
 *
 * Everything else is delegated to panel classes and the data layer.
 */

import { MapView }             from '../../../src/components/situation-monitor/MapView.js';
import { NewsPanel }           from '../../../src/components/situation-monitor/Panels/NewsPanel.js';
import { MarketsPanel }        from '../../../src/components/situation-monitor/Panels/MarketsPanel.js';
import { EarthquakePanel }     from '../../../src/components/situation-monitor/Panels/EarthquakePanel.js';
import { WeatherAlertsPanel }  from '../../../src/components/situation-monitor/Panels/WeatherAlertsPanel.js';
import { IntelFeedPanel }      from '../../../src/components/situation-monitor/Panels/IntelFeedPanel.js';
import { CorrelationPanel }    from '../../../src/components/situation-monitor/Panels/CorrelationPanel.js';
import { RSSIntelligencePanel } from '../../../src/components/situation-monitor/Panels/RSSIntelligencePanel.js';
import { EventPipeline }       from '../../../src/components/situation-monitor/data/eventPipeline.js';
import {
  globalEventStore,
  normalizeEarthquake,
  normalizeWeatherAlert,
} from '../../../src/components/situation-monitor/data/eventStore.js';

const REFRESH_INTERVAL_MS = 60_000;

export class SituationMonitorV2 {
  constructor(containerId) {
    this.containerId = containerId;
    this.panels = {};
    this.mapView = null;
    this.eventPipeline = new EventPipeline({
      minSeverity: 2,
      minConfidence: 0.6,
      maxGeocodePerCycle: 5,
    });
    this.mapEvents = [];
    this.eventStore = globalEventStore;
    this.lastRefresh = null;
    this._refreshing = false;
    this._timer = null;
    this._tickTimer = null;

    this._init();
  }

  /* ── Initialization ──────────────────────────────── */

  async _init() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error('[SitMonV2] Container not found:', this.containerId);
      return;
    }

    this._showLoading(container);

    try {
      await this._waitForD3();
      await this._initMap();
      await this._initPanels();
      this._bindControls();
      this._bindEventStore();
      await this.refresh();
      this._startAutoRefresh();
      this._hideLoading(container);
    } catch (err) {
      console.error('[SitMonV2] Init failed:', err);
      this._showError(container, err.message);
    }
  }

  _showLoading(container) {
    const el = document.getElementById('sitmon-loading');
    if (el) el.style.display = '';
    const content = document.getElementById('sitmon-content');
    if (content) content.style.display = 'none';
  }

  _hideLoading(container) {
    const el = document.getElementById('sitmon-loading');
    if (el) el.style.display = 'none';
    const content = document.getElementById('sitmon-content');
    if (content) content.style.display = '';
  }

  _showError(container, message) {
    const el = document.getElementById('sitmon-loading');
    if (el) {
      el.innerHTML = `
        <div class="sitmon-error-state">
          <p>Failed to load Situation Monitor.</p>
          <p>${escapeHtml(message)}</p>
          <button class="sitmon-refresh-btn" onclick="location.reload()">Reload Page</button>
        </div>
      `;
    }
  }

  _waitForD3(maxMs = 5000) {
    return new Promise((resolve, reject) => {
      if (window.d3) return resolve();
      const start = Date.now();
      const check = () => {
        if (window.d3) return resolve();
        if (Date.now() - start > maxMs) return reject(new Error('D3.js failed to load'));
        setTimeout(check, 100);
      };
      check();
    });
  }

  /* ── Map ─────────────────────────────────────────── */

  async _initMap() {
    const mapEl = document.getElementById('sitmon-map');
    if (!mapEl) return;
    this.mapView = new MapView('sitmon-map');
  }

  /* ── Panels ──────────────────────────────────────── */

  async _initPanels() {
    const panelMap = {
      news:        { Class: NewsPanel,           id: 'panel-news-body' },
      earthquakes: { Class: EarthquakePanel,     id: 'panel-earthquakes-body' },
      weather:     { Class: WeatherAlertsPanel,  id: 'panel-weather-body' },
      markets:     { Class: MarketsPanel,        id: 'panel-markets-body' },
      rss:         { Class: RSSIntelligencePanel, id: 'panel-rss-body' },
      intel:       { Class: IntelFeedPanel,       id: 'panel-intel-body' },
      correlation: { Class: CorrelationPanel,     id: 'panel-correlation-body' },
    };

    const initPromises = [];
    for (const [key, { Class, id }] of Object.entries(panelMap)) {
      const el = document.getElementById(id);
      if (!el) continue;
      this.panels[key] = new Class(id);
      if (typeof this.panels[key].init === 'function') {
        initPromises.push(
          Promise.resolve(this.panels[key].init()).catch(err => {
            console.warn(`[SitMonV2] ${key} init error:`, err);
          })
        );
      }
    }
    await Promise.all(initPromises);
  }

  /* ── Controls ────────────────────────────────────── */

  _bindControls() {
    const refreshBtn = document.getElementById('sitmon-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refresh());
    }
  }

  _bindEventStore() {
    this.eventStore.onUpdate((events) => {
      this._updateMapEvents(events);
      this._updateAlertBanner(events);
      this._updateStatusCounts(events);
    });
  }

  /* ── Refresh ─────────────────────────────────────── */

  _startAutoRefresh() {
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => this.refresh(), REFRESH_INTERVAL_MS);

    if (this._tickTimer) clearInterval(this._tickTimer);
    this._tickTimer = setInterval(() => this._updateTimeSinceRefresh(), 10_000);
  }

  async refresh() {
    if (this._refreshing) return;
    this._refreshing = true;

    const btn = document.getElementById('sitmon-refresh');
    if (btn) {
      btn.disabled = true;
      btn.classList.add('loading');
    }

    this._setStatus('Updating\u2026');

    try {
      const dataPromises = [];
      if (this.panels.news?.loadNews)               dataPromises.push(this.panels.news.loadNews().catch(noop));
      if (this.panels.earthquakes?.loadEarthquakes)  dataPromises.push(this.panels.earthquakes.loadEarthquakes().catch(noop));
      if (this.panels.weather?.loadAlerts)            dataPromises.push(this.panels.weather.loadAlerts().catch(noop));
      if (this.panels.markets?.loadMarkets)           dataPromises.push(this.panels.markets.loadMarkets().catch(noop));

      await Promise.all(dataPromises);

      // Update analysis panels with news data
      const headlines = this.panels.news?.getHeadlines?.() || [];
      if (headlines.length > 0) {
        this.panels.intel?.update?.(headlines);
        this.panels.correlation?.update?.(headlines);

        try {
          const newEvents = await this.eventPipeline.processAndMerge(headlines, this.mapEvents);
          this.mapEvents = newEvents;
          this.mapView?.updateEvents?.(this.mapEvents);
          this.eventPipeline.saveCache();
        } catch (e) {
          console.warn('[SitMonV2] Event pipeline error:', e);
        }
      }

      // Feed events into the unified store
      this._feedEventStore();

      // Update earthquake markers on map
      if (this.mapView) {
        this.mapView.clearEarthquakeTimeouts();
        const eqs = this.panels.earthquakes?.getEarthquakes?.() || [];
        eqs.slice(0, 5).forEach(eq => {
          this.mapView.addEarthquake(eq.lat, eq.lon, eq.magnitude);
        });
      }

      this.lastRefresh = new Date();
      this._setStatus('Live');
      this._updateTimeSinceRefresh();

    } catch (err) {
      console.error('[SitMonV2] Refresh error:', err);
      this._setStatus('Error');
    } finally {
      this._refreshing = false;
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('loading');
      }
    }
  }

  _feedEventStore() {
    const events = [];

    const eqs = (this.panels.earthquakes?.getEarthquakes?.() || []).slice(0, 5);
    for (const eq of eqs) {
      try { events.push(normalizeEarthquake(eq)); } catch (_) { /* skip */ }
    }

    const alerts = this.panels.weather?.alerts || [];
    for (const alert of alerts) {
      try { events.push(normalizeWeatherAlert(alert)); } catch (_) { /* skip */ }
    }

    if (events.length > 0) {
      this.eventStore.addEvents(events);
    }
  }

  /* ── UI Updates ──────────────────────────────────── */

  _setStatus(text) {
    const el = document.getElementById('sitmon-status-text');
    if (el) el.textContent = text;

    const dot = document.getElementById('sitmon-live-dot');
    if (dot) {
      dot.classList.toggle('offline', text === 'Error');
    }
  }

  _updateTimeSinceRefresh() {
    const el = document.getElementById('sitmon-last-update');
    if (!el || !this.lastRefresh) return;
    const seconds = Math.floor((Date.now() - this.lastRefresh.getTime()) / 1000);
    if (seconds < 10) {
      el.textContent = 'just now';
    } else if (seconds < 60) {
      el.textContent = `${seconds}s ago`;
    } else {
      el.textContent = `${Math.floor(seconds / 60)}m ago`;
    }
  }

  _updateMapEvents(events) {
    if (!this.mapView) return;
    const mappable = events.filter(e => e.location?.lat && e.location?.lon);
    this.mapView.updateEvents(mappable);
  }

  _updateAlertBanner(events) {
    const banner = document.getElementById('sitmon-alert-banner');
    const listEl = document.getElementById('sitmon-alert-list');
    if (!banner || !listEl) return;

    const critical = events
      .filter(e => e.severity >= 4)
      .sort((a, b) => b.severity - a.severity || new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, 3);

    if (critical.length === 0) {
      banner.classList.remove('visible');
      return;
    }

    banner.classList.add('visible');
    listEl.innerHTML = critical.map(ev => {
      const age = ev.getAgeHours ? ev.getAgeHours() : 0;
      const ageText = age < 1 ? `${Math.floor(age * 60)}m ago`
                    : age < 24 ? `${Math.floor(age)}h ago`
                    : `${Math.floor(age / 24)}d ago`;
      const isCritical = ev.severity >= 5;
      return `
        <div class="sitmon-alert-item">
          <span class="sitmon-alert-severity ${isCritical ? '' : 'high'}"></span>
          <span>${escapeHtml(ev.title || 'Alert')}</span>
          <span class="sitmon-alert-time">${ageText}</span>
        </div>
      `;
    }).join('');
  }

  _updateStatusCounts(events) {
    const total = events.length;
    const critical = events.filter(e => e.severity >= 5).length;
    const high = events.filter(e => e.severity >= 4 && e.severity < 5).length;

    this._setCount('sitmon-count-events', total);
    this._setCount('sitmon-count-critical', critical);
    this._setCount('sitmon-count-high', high);
  }

  _setCount(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  /* ── Cleanup ─────────────────────────────────────── */

  destroy() {
    if (this._timer) clearInterval(this._timer);
    if (this._tickTimer) clearInterval(this._tickTimer);
    this.mapView?.destroy?.();
    Object.values(this.panels).forEach(p => p.destroy?.());
  }
}

/* ── Helpers ───────────────────────────────────────── */

function escapeHtml(text) {
  if (!text) return '';
  const el = document.createElement('div');
  el.textContent = text;
  return el.innerHTML;
}

function noop() {}
