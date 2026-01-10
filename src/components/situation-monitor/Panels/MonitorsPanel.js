/**
 * Custom Monitors Panel
 */

import { BasePanel } from './BasePanel.js';

export class MonitorsPanel extends BasePanel {
  constructor(containerId, mapView) {
    super(containerId, 'Custom Monitors', { collapsible: true });
    this.mapView = mapView;
    this.monitors = this.loadMonitors();
    this.init();
  }

  init() {
    super.init();
    this.render();
    this.setupForm();
  }

  loadMonitors() {
    try {
      const stored = localStorage.getItem('sitmon_monitors');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.warn('[MonitorsPanel] Failed to load monitors:', e);
      return [];
    }
  }

  saveMonitors() {
    try {
      localStorage.setItem('sitmon_monitors', JSON.stringify(this.monitors));
    } catch (e) {
      console.warn('[MonitorsPanel] Failed to save monitors:', e);
    }
  }

  setupForm() {
    const contentEl = this.getContentElement();
    const form = contentEl.querySelector('.sitmon-monitor-form');
    
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.addMonitor(form);
      });
    }
  }

  addMonitor(form) {
    const name = form.querySelector('[name="name"]').value.trim();
    const keywords = form.querySelector('[name="keywords"]').value.trim();
    const lat = parseFloat(form.querySelector('[name="lat"]').value) || null;
    const lon = parseFloat(form.querySelector('[name="lon"]').value) || null;
    const color = form.querySelector('[name="color"]').value || '#4A90E2';

    if (!name || !keywords) {
      alert('Name and keywords are required');
      return;
    }

    const monitor = {
      id: `monitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      keywords: keywords.split(',').map(k => k.trim()),
      lat,
      lon,
      color,
      matchCount: 0,
      createdAt: Date.now()
    };

    this.monitors.push(monitor);
    this.saveMonitors();
    this.render();

    // Add marker to map if coordinates provided
    if (lat && lon && this.mapView) {
      this.mapView.addMonitorMarker(monitor);
    }

    // Reset form
    form.reset();
  }

  removeMonitor(id) {
    this.monitors = this.monitors.filter(m => m.id !== id);
    this.saveMonitors();
    this.render();
  }

  updateMatches(headlines) {
    this.monitors.forEach(monitor => {
      let matches = 0;
      
      headlines.forEach(headline => {
        const text = `${headline.title} ${headline.description || ''}`.toLowerCase();
        const hasMatch = monitor.keywords.some(keyword => 
          text.includes(keyword.toLowerCase())
        );
        if (hasMatch) matches++;
      });

      monitor.matchCount = matches;
    });

    this.saveMonitors();
    this.render();
  }

  render() {
    const monitorsList = this.monitors.map(monitor => `
      <div class="sitmon-monitor-item">
        <div class="sitmon-monitor-header">
          <span class="sitmon-monitor-name">${escapeHtml(monitor.name)}</span>
          <button class="sitmon-monitor-remove" data-id="${monitor.id}" aria-label="Remove monitor">×</button>
        </div>
        <div class="sitmon-monitor-keywords">
          Keywords: ${monitor.keywords.map(k => `<span class="sitmon-keyword">${escapeHtml(k)}</span>`).join(', ')}
        </div>
        ${monitor.lat && monitor.lon ? `
          <div class="sitmon-monitor-location">
            Location: ${monitor.lat.toFixed(2)}, ${monitor.lon.toFixed(2)}
          </div>
        ` : ''}
        <div class="sitmon-monitor-matches">
          Matches: <strong>${monitor.matchCount}</strong>
        </div>
      </div>
    `).join('');

    const content = `
      <div class="sitmon-monitor-form-container">
        <form class="sitmon-monitor-form">
          <div class="sitmon-form-group">
            <label>Monitor Name</label>
            <input type="text" name="name" required placeholder="e.g., Ukraine Conflict">
          </div>
          <div class="sitmon-form-group">
            <label>Keywords (comma-separated)</label>
            <input type="text" name="keywords" required placeholder="ukraine, russia, war">
          </div>
          <div class="sitmon-form-row">
            <div class="sitmon-form-group">
              <label>Latitude (optional)</label>
              <input type="number" name="lat" step="0.0001" placeholder="48.3794">
            </div>
            <div class="sitmon-form-group">
              <label>Longitude (optional)</label>
              <input type="number" name="lon" step="0.0001" placeholder="31.1656">
            </div>
          </div>
          <div class="sitmon-form-group">
            <label>Color</label>
            <input type="color" name="color" value="#4A90E2">
          </div>
          <button type="submit" class="sitmon-form-submit">Add Monitor</button>
        </form>
      </div>

      <div class="sitmon-monitors-list">
        ${monitorsList || '<p>No monitors yet. Add one above.</p>'}
      </div>
    `;

    super.render(content);

    // Bind remove buttons
    const removeButtons = this.getContentElement().querySelectorAll('.sitmon-monitor-remove');
    removeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.removeMonitor(id);
      });
    });
  }

  getMonitors() {
    return this.monitors;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
