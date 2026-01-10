/**
 * Diagnostics Panel
 * Shows debug information when ?debug=1 query param is present
 */

export class DiagnosticsPanel {
  constructor(eventPipeline, mapEvents) {
    this.eventPipeline = eventPipeline;
    this.mapEvents = mapEvents;
    this.panel = null;
    this.isEnabled = false;
    this.init();
  }
  
  init() {
    // Check for ?debug=1 query param
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') !== '1') {
      return;
    }
    
    this.isEnabled = true;
    this.createPanel();
    this.startUpdates();
  }
  
  createPanel() {
    this.panel = document.createElement('div');
    this.panel.className = 'sitmon-diagnostics-panel';
    this.panel.style.cssText = `
      position: fixed;
      bottom: 16px;
      right: 16px;
      width: 400px;
      max-height: 500px;
      background: rgba(5, 15, 42, 0.95);
      border: 2px solid rgba(255, 107, 107, 0.5);
      border-radius: 8px;
      padding: 16px;
      z-index: 3000;
      overflow-y: auto;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      color: #fff;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
    `;
    
    document.body.appendChild(this.panel);
    this.update();
  }
  
  update() {
    if (!this.panel || !this.isEnabled) return;
    
    const geocodeStatus = this.eventPipeline.getGeocodeQueueStatus();
    const eventCounts = this.getEventCounts();
    const categoryBreakdown = this.getCategoryBreakdown();
    const severityBreakdown = this.getSeverityBreakdown();
    
    this.panel.innerHTML = `
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      ">
        <div style="font-weight: 700; font-size: 14px; color: #ff6b6b;">🔧 DIAGNOSTICS MODE</div>
        <button onclick="this.parentElement.parentElement.style.display='none'" style="
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          font-size: 18px;
          padding: 0;
          width: 24px;
          height: 24px;
        ">×</button>
      </div>
      
      <div style="margin-bottom: 16px;">
        <div style="font-weight: 600; margin-bottom: 8px; color: #22d3ee;">Event Pipeline</div>
        <div style="padding-left: 12px; color: rgba(255, 255, 255, 0.8);">
          <div>Total Events: ${this.mapEvents.length}</div>
          <div>Geocode Queue: ${geocodeStatus.queueLength}</div>
          <div>Processing: ${geocodeStatus.processing ? 'Yes' : 'No'}</div>
        </div>
      </div>
      
      <div style="margin-bottom: 16px;">
        <div style="font-weight: 600; margin-bottom: 8px; color: #22d3ee;">Event Breakdown</div>
        <div style="padding-left: 12px; color: rgba(255, 255, 255, 0.8);">
          <div>With Location: ${eventCounts.withLocation}</div>
          <div>Without Location: ${eventCounts.withoutLocation}</div>
          <div>High Confidence (≥0.6): ${eventCounts.highConfidence}</div>
          <div>Low Confidence (&lt;0.6): ${eventCounts.lowConfidence}</div>
        </div>
      </div>
      
      <div style="margin-bottom: 16px;">
        <div style="font-weight: 600; margin-bottom: 8px; color: #22d3ee;">Category Breakdown</div>
        <div style="padding-left: 12px; color: rgba(255, 255, 255, 0.8);">
          ${Object.entries(categoryBreakdown).map(([cat, count]) => `
            <div>${cat}: ${count}</div>
          `).join('')}
        </div>
      </div>
      
      <div style="margin-bottom: 16px;">
        <div style="font-weight: 600; margin-bottom: 8px; color: #22d3ee;">Severity Breakdown</div>
        <div style="padding-left: 12px; color: rgba(255, 255, 255, 0.8);">
          ${Object.entries(severityBreakdown).map(([sev, count]) => `
            <div>Severity ${sev}: ${count}</div>
          `).join('')}
        </div>
      </div>
      
      <div style="margin-bottom: 16px;">
        <div style="font-weight: 600; margin-bottom: 8px; color: #22d3ee;">Recent Events (Last 5)</div>
        <div style="padding-left: 12px; color: rgba(255, 255, 255, 0.8); font-size: 10px;">
          ${this.mapEvents.slice(0, 5).map(event => `
            <div style="margin-bottom: 4px; padding: 4px; background: rgba(255, 255, 255, 0.05); border-radius: 4px;">
              <div style="font-weight: 600;">${this.escapeHtml(event.title.substring(0, 40))}...</div>
              <div style="color: rgba(255, 255, 255, 0.6);">
                ${event.category} | ${event.severity}/5 | ${event.location ? event.location.label : 'No location'}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div style="
        margin-top: 16px;
        padding-top: 12px;
        border-top: 1px solid rgba(255, 255, 255, 0.2);
        font-size: 10px;
        color: rgba(255, 255, 255, 0.5);
      ">
        Diagnostics mode enabled via ?debug=1
      </div>
    `;
  }
  
  getEventCounts() {
    return {
      withLocation: this.mapEvents.filter(e => e.location && e.location.lat && e.location.lon).length,
      withoutLocation: this.mapEvents.filter(e => !e.location || !e.location.lat || !e.location.lon).length,
      highConfidence: this.mapEvents.filter(e => e.confidence >= 0.6).length,
      lowConfidence: this.mapEvents.filter(e => e.confidence < 0.6).length
    };
  }
  
  getCategoryBreakdown() {
    const breakdown = {};
    for (const event of this.mapEvents) {
      breakdown[event.category] = (breakdown[event.category] || 0) + 1;
    }
    return breakdown;
  }
  
  getSeverityBreakdown() {
    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const event of this.mapEvents) {
      breakdown[event.severity] = (breakdown[event.severity] || 0) + 1;
    }
    return breakdown;
  }
  
  startUpdates() {
    if (!this.isEnabled) return;
    
    // Update every 5 seconds
    setInterval(() => {
      this.update();
    }, 5000);
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  destroy() {
    if (this.panel) {
      this.panel.remove();
    }
  }
}
