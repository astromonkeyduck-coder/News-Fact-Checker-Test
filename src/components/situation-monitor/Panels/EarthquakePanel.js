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
    this._initCalled = false; // Flag to prevent duplicate initialization
    // Don't call init() here - SituationMonitorShell.initPanels() will call it
  }

  async init() {
    // Prevent duplicate initialization
    if (this._initCalled) {
      console.warn('[EarthquakePanel] init() already called, skipping duplicate');
      return;
    }
    this._initCalled = true;
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
      const geoJson = await fetchEarthquakes(6.0);
      
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

    // Limit to 3 earthquakes max for clean display (both desktop and mobile)
    const content = this.earthquakes.slice(0, 3).map(eq => {
      const magnitude = eq.magnitude.toFixed(1);
      const time = formatTime(eq.time);
      const preciseTime = formatPreciseTime(eq.time); // Show precise timestamp with milliseconds
      const depth = eq.depth ? `${eq.depth.toFixed(1)} km` : 'Unknown';
      
      // Get severity indicator
      const severity = eq.severity || 1;
      const severityColor = severity >= 4 ? '#ff6b6b' : severity >= 3 ? '#ffa500' : '#4ecdc4';
      
      // Check for additional data
      const hasImage = eq.image_url || eq.assets?.image_url;
      const hasVideo = eq.video_url || eq.assets?.video_url;
      const hasImpact = eq.impact_assessment || eq.assets?.impact_assessment;
      const hasTsunami = eq.tsunami_risk || eq.assets?.tsunami_risk;
      const hasAftershock = eq.aftershock_forecast || eq.assets?.aftershock_forecast;
      
      // Build image/video links
      let mediaLinks = '';
      if (hasImage) {
        const imageUrl = eq.image_url || eq.assets?.image_url;
        mediaLinks += `<a href="${escapeHtml(imageUrl)}" target="_blank" rel="noopener noreferrer" class="sitmon-earthquake-media-link" title="View image">📸</a> `;
      }
      if (hasVideo) {
        const videoUrl = eq.video_url || eq.assets?.video_url;
        mediaLinks += `<a href="${escapeHtml(videoUrl)}" target="_blank" rel="noopener noreferrer" class="sitmon-earthquake-media-link" title="View video">🎬</a> `;
      }

      return `
        <div class="sitmon-earthquake-item" style="border-left-color: ${severityColor}">
          <div class="sitmon-earthquake-header">
            <span class="sitmon-earthquake-magnitude" style="color: ${severityColor}">M${magnitude}</span>
            <span class="sitmon-earthquake-time">${time}</span>
          </div>
          <div class="sitmon-earthquake-place">${escapeHtml(eq.place)}</div>
          <div class="sitmon-earthquake-precise-time" title="Precise earthquake time">
            <small>${preciseTime}</small>
          </div>
          <div class="sitmon-earthquake-details">
            Depth: ${depth}
            ${hasImpact ? ` | <span class="sitmon-earthquake-badge" title="Impact Assessment">⚡ Impact</span>` : ''}
            ${hasTsunami ? ` | <span class="sitmon-earthquake-badge" title="Tsunami Risk">🌊 Tsunami</span>` : ''}
            ${hasAftershock ? ` | <span class="sitmon-earthquake-badge" title="Aftershock Forecast">📊 Aftershocks</span>` : ''}
          </div>
          <div class="sitmon-earthquake-actions">
            ${mediaLinks}
            <a href="${escapeHtml(eq.url)}" target="_blank" rel="noopener noreferrer" class="sitmon-earthquake-link">USGS Details</a>
            ${eq.canonical_id ? `<a href="/article.html?id=post-usgs-${eq.canonical_id.split(':')[1] || eq.canonical_id}" class="sitmon-earthquake-link">View Article</a>` : ''}
          </div>
        </div>
      `;
    }).join('');

    super.render(`
      <div class="sitmon-earthquakes-list">
        ${content}
      </div>
      <div class="sitmon-earthquake-note">
        <small>Verified earthquakes from Noteworthy News system (M4.5+)</small>
      </div>
    `);
  }

  setupRefresh() {
    // Clear any existing refresh interval to prevent memory leaks
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
      this._refreshInterval = null;
    }
    
    // Auto-refresh every minute
    this._refreshInterval = setInterval(() => {
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

function formatPreciseTime(timestamp) {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp);
  
  // Format: YYYY-MM-DD HH:MM:SS.mmm UTC
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  const milliseconds = String(date.getUTCMilliseconds()).padStart(3, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds} UTC`;
}
