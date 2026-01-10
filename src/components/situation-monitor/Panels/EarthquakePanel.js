/**
 * Earthquake Panel Component
 */

import { BasePanel } from './BasePanel.js';
import { fetchEarthquakes } from '../data/fetchers.js';
import { parseGeoJSON } from '../data/parsers.js';

export class EarthquakePanel extends BasePanel {
  constructor(containerId) {
    super(containerId, 'Earthquakes', { collapsible: true });
    this.earthquakes = [];
    // Initialize asynchronously - don't call init() here, it's called once in async init()
    // Don't await - let it run asynchronously
    this.init().catch(err => {
      console.error('[EarthquakePanel] Init error:', err);
    });
  }

  async init() {
    super.init(); // Call BasePanel.init() to set up DOM structure (idempotent)
    // Set up retry callback to reload earthquakes data
    this.onRetry = () => {
      this.loadEarthquakes();
    };
    await this.loadEarthquakes();
    this.setupRefresh();
  }

  async loadEarthquakes() {
    this.setLoading(true);
    this.setError(null);

    try {
      const geoJson = await fetchEarthquakes(4.5);
      
      if (geoJson) {
        this.earthquakes = parseGeoJSON(geoJson);
        // Sort by magnitude (highest first)
        this.earthquakes.sort((a, b) => b.magnitude - a.magnitude);
        this.render();
      } else {
        this.setError(new Error('Earthquake data unavailable'));
      }
      
      this.setLoading(false);
    } catch (error) {
      console.error('[EarthquakePanel] Load error:', error);
      this.setError(error);
      this.setLoading(false);
    }
  }

  render() {
    if (this.earthquakes.length === 0) {
      super.render('<p>No recent earthquakes (M4.5+)</p>');
      return;
    }

    const content = this.earthquakes.slice(0, 10).map(eq => {
      const magnitude = eq.magnitude.toFixed(1);
      const time = formatTime(eq.time);
      const depth = eq.depth ? `${eq.depth.toFixed(1)} km` : 'Unknown';

      return `
        <div class="sitmon-earthquake-item">
          <div class="sitmon-earthquake-header">
            <span class="sitmon-earthquake-magnitude">M${magnitude}</span>
            <span class="sitmon-earthquake-time">${time}</span>
          </div>
          <div class="sitmon-earthquake-place">${escapeHtml(eq.place)}</div>
          <div class="sitmon-earthquake-details">
            Depth: ${depth} | 
            <a href="${escapeHtml(eq.url)}" target="_blank" rel="noopener noreferrer">USGS Details</a>
          </div>
        </div>
      `;
    }).join('');

    super.render(`
      <div class="sitmon-earthquakes-list">
        ${content}
      </div>
      <div class="sitmon-earthquake-note">
        <small>Last 24 hours, M4.5+ (USGS)</small>
      </div>
    `);
  }

  setupRefresh() {
    // Auto-refresh every minute
    setInterval(() => {
      if (!this.collapsed && this.enabled) {
        this.loadEarthquakes();
      }
    }, 60000);
  }

  getEarthquakes() {
    return this.earthquakes;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(timestamp) {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleString();
}
