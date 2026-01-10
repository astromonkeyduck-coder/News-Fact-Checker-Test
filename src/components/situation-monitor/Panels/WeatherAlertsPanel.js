/**
 * Weather Alerts Panel Component
 */

import { BasePanel } from './BasePanel.js';
import { fetchWeatherAlerts } from '../data/fetchers.js';
import { parseWeatherAlerts } from '../data/parsers.js';

export class WeatherAlertsPanel extends BasePanel {
  constructor(containerId) {
    super(containerId, 'Weather Alerts', { collapsible: true });
    this.alerts = [];
    // Initialize asynchronously - don't call init() here, it's called once in async init()
    // Don't await - let it run asynchronously
    this.init().catch(err => {
      console.error('[WeatherAlertsPanel] Init error:', err);
    });
  }

  async init() {
    super.init(); // Call BasePanel.init() to set up DOM structure (idempotent)
    await this.loadAlerts();
    this.setupRefresh();
  }

  async loadAlerts() {
    this.setLoading(true);
    this.setError(null);

    try {
      const geoJson = await fetchWeatherAlerts();
      
      if (geoJson) {
        this.alerts = parseWeatherAlerts(geoJson);
        // Sort by severity
        this.alerts.sort((a, b) => {
          const severityOrder = { 'extreme': 0, 'severe': 1, 'moderate': 2, 'minor': 3, 'unknown': 4 };
          return (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4);
        });
        this.render();
      } else {
        this.setError(new Error('Weather alerts unavailable'));
      }
      
      this.setLoading(false);
    } catch (error) {
      console.error('[WeatherAlertsPanel] Load error:', error);
      this.setError(error);
      this.setLoading(false);
    }
  }

  render() {
    if (this.alerts.length === 0) {
      super.render('<p>No active weather alerts (US only)</p>');
      return;
    }

    const content = this.alerts.slice(0, 10).map(alert => {
      const severity = alert.severity || 'unknown';
      const severityClass = severity.toLowerCase();

      return `
        <div class="sitmon-alert-item sitmon-alert-${severityClass}">
          <div class="sitmon-alert-header">
            <span class="sitmon-alert-event">${escapeHtml(alert.event)}</span>
            <span class="sitmon-alert-severity">${severity.toUpperCase()}</span>
          </div>
          ${alert.headline ? `
            <div class="sitmon-alert-headline">${escapeHtml(alert.headline)}</div>
          ` : ''}
          ${alert.areas ? `
            <div class="sitmon-alert-areas">Areas: ${escapeHtml(alert.areas)}</div>
          ` : ''}
        </div>
      `;
    }).join('');

    super.render(`
      <div class="sitmon-alerts-list">
        ${content}
      </div>
      <div class="sitmon-alert-note">
        <small>US only (weather.gov)</small>
      </div>
    `);
  }

  setupRefresh() {
    // Auto-refresh every 5 minutes
    setInterval(() => {
      if (!this.collapsed && this.enabled) {
        this.loadAlerts();
      }
    }, 5 * 60 * 1000);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
