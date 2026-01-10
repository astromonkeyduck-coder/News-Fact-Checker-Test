/**
 * Custom Monitors Panel
 */

import { BasePanel } from './BasePanel.js';

export class MonitorsPanel extends BasePanel {
  constructor(containerId, mapView) {
    super(containerId, 'Custom Monitors', { collapsible: true });
    this.mapView = mapView;
    // Initialize monitors as empty array first, then load
    this.monitors = [];
    // Don't call init() here - let SituationMonitorShell call it after DOM is ready
  }

  init() {
    // CRITICAL: Load monitors before initializing, with multiple safety checks
    try {
      this.monitors = this.loadMonitors();
    } catch (e) {
      console.error('[MonitorsPanel] Error in loadMonitors during init:', e);
      this.monitors = [];
    }
    
    // CRITICAL: Ensure it's ALWAYS an array - multiple checks
    if (!this.monitors || !Array.isArray(this.monitors)) {
      console.warn('[MonitorsPanel] monitors is not an array after loadMonitors, forcing empty array');
      this.monitors = [];
    }
    
    // CRITICAL: Verify array methods exist
    if (typeof this.monitors.map !== 'function') {
      console.error('[MonitorsPanel] CRITICAL: monitors does not have .map() method, forcing empty array');
      this.monitors = [];
    }
    
    super.init();
    
    // CRITICAL: Only render if container exists and is valid DOM element
    const container = document.getElementById(this.containerId);
    if (container && container.nodeType === 1) {
      try {
        this.render();
        this.setupForm();
      } catch (e) {
        console.error(`[MonitorsPanel] Error during render/setupForm:`, e);
      }
    } else {
      console.warn(`[MonitorsPanel] Container #${this.containerId} not found or invalid, deferring render`);
    }
  }

  loadMonitors() {
    try {
      const stored = localStorage.getItem('sitmon_monitors');
      if (!stored) {
        return [];
      }
      const parsed = JSON.parse(stored);
      // CRITICAL: Always return an array, never undefined or null
      if (!Array.isArray(parsed)) {
        console.warn('[MonitorsPanel] Stored monitors is not an array, returning empty array');
        return [];
      }
      return parsed;
    } catch (e) {
      console.error('[MonitorsPanel] Error loading monitors:', e);
      // CRITICAL: Always return an array, even on error
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
    if (!contentEl) {
      console.warn('[MonitorsPanel] Cannot setup form - content element not found');
      return;
    }
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
    // Defensive: ensure monitors is always an array
    if (!this.monitors || !Array.isArray(this.monitors)) {
      this.monitors = this.loadMonitors();
      if (!Array.isArray(this.monitors)) {
        this.monitors = [];
      }
    }
    
    // Defensive: ensure headlines is an array
    if (!headlines || !Array.isArray(headlines)) {
      headlines = [];
    }
    
    this.monitors.forEach(monitor => {
      // Defensive: ensure monitor has keywords
      if (!monitor || !monitor.keywords || !Array.isArray(monitor.keywords)) {
        return;
      }
      
      let matches = 0;
      
      headlines.forEach(headline => {
        if (!headline || !headline.title) return;
        const text = `${headline.title} ${headline.description || ''}`.toLowerCase();
        const hasMatch = monitor.keywords.some(keyword => 
          keyword && text.includes(String(keyword).toLowerCase())
        );
        if (hasMatch) matches++;
      });

      monitor.matchCount = matches;
    });

    this.saveMonitors();
    this.render();
  }

  render() {
    // CRITICAL: Ensure monitors is ALWAYS an array before any array operations
    if (!this.monitors || !Array.isArray(this.monitors)) {
      try {
        this.monitors = this.loadMonitors();
      } catch (e) {
        console.warn('[MonitorsPanel] Error loading monitors:', e);
        this.monitors = [];
      }
    }
    // Double-check after loadMonitors - this should NEVER be undefined
    if (!Array.isArray(this.monitors)) {
      console.warn('[MonitorsPanel] loadMonitors() did not return an array, using empty array');
      this.monitors = [];
    }
    
    // Final safety check - if somehow still not an array, force it
    if (typeof this.monitors.map !== 'function') {
      console.error('[MonitorsPanel] CRITICAL: monitors is not an array, forcing empty array');
      this.monitors = [];
    }
    
    const monitorsList = this.monitors.map(monitor => {
      // Defensive: ensure monitor has required properties
      if (!monitor || typeof monitor !== 'object') {
        return '';
      }
      try {
        // Defensive: ensure monitor has required properties for rendering
        const monitorName = monitor.name ? escapeHtml(String(monitor.name)) : 'Unnamed Monitor';
        const monitorId = monitor.id ? String(monitor.id) : '';
        const keywords = Array.isArray(monitor.keywords) 
          ? monitor.keywords.map(k => `<span class="sitmon-keyword">${escapeHtml(String(k))}</span>`).join(', ')
          : 'No keywords';
        const matchCount = typeof monitor.matchCount === 'number' ? monitor.matchCount : 0;
        const locationHtml = (monitor.lat && monitor.lon && typeof monitor.lat === 'number' && typeof monitor.lon === 'number')
          ? `<div class="sitmon-monitor-location">Location: ${monitor.lat.toFixed(2)}, ${monitor.lon.toFixed(2)}</div>`
          : '';
        
        return `
      <div class="sitmon-monitor-item">
        <div class="sitmon-monitor-header">
          <span class="sitmon-monitor-name">${monitorName}</span>
          <button class="sitmon-monitor-remove" data-id="${monitorId}" aria-label="Remove monitor">×</button>
        </div>
        <div class="sitmon-monitor-keywords">
          Keywords: ${keywords}
        </div>
        ${locationHtml}
        <div class="sitmon-monitor-matches">
          Matches: <strong>${matchCount}</strong>
        </div>
      </div>
    `;
      } catch (e) {
        console.warn('[MonitorsPanel] Error rendering monitor:', e, monitor);
        return '';
      }
    }).filter(html => html && html.trim() !== '').join('');

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
    const contentEl = this.getContentElement();
    if (!contentEl) {
      console.warn('[MonitorsPanel] Cannot bind remove buttons - content element not found');
      return;
    }
    const removeButtons = contentEl.querySelectorAll('.sitmon-monitor-remove');
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
