/**
 * Big Board Overlay
 * Shows stats: active events, critical count, hotspots
 */

export class BigBoardOverlay {
  constructor() {
    this.overlay = null;
    this.stats = {
      activeEvents: 0,
      critical: 0,
      hotspots: 0
    };
    this.init();
  }
  
  init() {
    // Create overlay element
    this.overlay = document.createElement('div');
    this.overlay.className = 'sitmon-bigboard-overlay';
    this.overlay.style.cssText = `
      position: absolute;
      top: 16px;
      left: 16px;
      background: rgba(5, 15, 42, 0.9);
      border: 1px solid rgba(34, 211, 238, 0.3);
      border-radius: 8px;
      padding: 16px;
      z-index: 1000;
      min-width: 200px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    `;
    
    // Find map container and append
    const mapContainer = document.getElementById('sitmon-map');
    if (mapContainer) {
      mapContainer.style.position = 'relative';
      mapContainer.appendChild(this.overlay);
    }
    
    this.update();
  }
  
  update(events = []) {
    if (!this.overlay) return;
    
    // Calculate stats
    this.stats.activeEvents = events.length;
    this.stats.critical = events.filter(e => e.severity >= 5).length;
    
    // Count hotspots (clusters with 3+ events)
    // For now, estimate based on events (will be refined with actual clustering)
    const eventCountsByLocation = new Map();
    for (const event of events) {
      if (event.location) {
        const key = `${Math.round(event.location.lat * 10) / 10}_${Math.round(event.location.lon * 10) / 10}`;
        const count = eventCountsByLocation.get(key) || 0;
        eventCountsByLocation.set(key, count + 1);
      }
    }
    this.stats.hotspots = Array.from(eventCountsByLocation.values()).filter(count => count >= 3).length;
    
    // Render
    this.overlay.innerHTML = `
      <div style="
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 12px;
        font-weight: 600;
      ">Situation Monitor</div>
      
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div>
          <div style="
            font-size: 24px;
            font-weight: 700;
            color: #22d3ee;
            line-height: 1;
          ">${this.stats.activeEvents}</div>
          <div style="
            font-size: 11px;
            color: rgba(255, 255, 255, 0.6);
            margin-top: 4px;
          ">Active Events</div>
        </div>
        
        <div>
          <div style="
            font-size: 24px;
            font-weight: 700;
            color: ${this.stats.critical > 0 ? '#ff0000' : '#ff6b6b'};
            line-height: 1;
          ">${this.stats.critical}</div>
          <div style="
            font-size: 11px;
            color: rgba(255, 255, 255, 0.6);
            margin-top: 4px;
          ">Critical</div>
        </div>
        
        <div>
          <div style="
            font-size: 24px;
            font-weight: 700;
            color: #ffaa00;
            line-height: 1;
          ">${this.stats.hotspots}</div>
          <div style="
            font-size: 11px;
            color: rgba(255, 255, 255, 0.6);
            margin-top: 4px;
          ">Hotspots</div>
        </div>
      </div>
    `;
  }
  
  destroy() {
    if (this.overlay) {
      this.overlay.remove();
    }
  }
}
