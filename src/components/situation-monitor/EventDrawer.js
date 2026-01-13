/**
 * Event Drawer Panel
 * Shows details for a single map event
 */

export class EventDrawer {
  constructor() {
    this.drawer = null;
    this.currentEvent = null;
    this.init();
  }
  
  init() {
    // Create drawer element
    this.drawer = document.createElement('div');
    this.drawer.className = 'sitmon-event-drawer';
    this.drawer.style.cssText = `
      position: fixed;
      right: -400px;
      top: 0;
      width: 380px;
      height: 100vh;
      background: rgba(5, 15, 42, 0.98);
      border-left: 2px solid rgba(34, 211, 238, 0.3);
      box-shadow: -4px 0 20px rgba(0, 0, 0, 0.5);
      z-index: 2000;
      overflow-y: auto;
      transition: right 0.3s ease;
      padding: 24px;
      color: #fff;
      pointer-events: none;
    `;
    
    document.body.appendChild(this.drawer);
    
    // Listen for event clicks
    document.addEventListener('sitmon:event-click', (e) => {
      this.show(e.detail.event);
    });
    
    // Close button
    this.drawer.innerHTML = `
      <button class="sitmon-drawer-close" style="
        position: absolute;
        top: 16px;
        right: 16px;
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.7);
        font-size: 24px;
        cursor: pointer;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: all 0.2s ease;
      ">×</button>
      <div class="sitmon-drawer-content"></div>
    `;
    
    const closeBtn = this.drawer.querySelector('.sitmon-drawer-close');
    closeBtn.addEventListener('click', () => this.hide());
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
      closeBtn.style.color = '#fff';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'transparent';
      closeBtn.style.color = 'rgba(255, 255, 255, 0.7)';
    });
    
    // Close on outside click
    document.addEventListener('click', (e) => {
      if (this.isOpen() && !this.drawer.contains(e.target) && !e.target.closest('.event-marker')) {
        this.hide();
      }
    });
  }
  
  show(event) {
    this.currentEvent = event;
    // Enable pointer events when drawer is open
    this.drawer.style.pointerEvents = 'auto';
    const content = this.drawer.querySelector('.sitmon-drawer-content');
    
    const age = event.getAgeHours();
    const ageText = age < 1 ? `${Math.floor(age * 60)}m ago` : 
                    age < 24 ? `${Math.floor(age)}h ago` : 
                    `${Math.floor(age / 24)}d ago`;
    
    const categoryColor = this.getCategoryColor(event.category);
    const severityColor = this.getSeverityColor(event.severity);
    
    content.innerHTML = `
      <div style="margin-bottom: 24px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
          <span style="
            display: inline-block;
            padding: 4px 12px;
            background: ${categoryColor}40;
            border: 1px solid ${categoryColor};
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
          ">${event.category}</span>
          <span style="
            display: inline-block;
            padding: 4px 12px;
            background: ${severityColor}40;
            border: 1px solid ${severityColor};
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
          ">Severity ${event.severity}/5</span>
        </div>
        <h2 style="
          font-size: 20px;
          font-weight: 700;
          margin: 0 0 12px 0;
          line-height: 1.4;
          color: #fff;
        ">${this.escapeHtml(event.title)}</h2>
        <div style="
          color: rgba(255, 255, 255, 0.6);
          font-size: 13px;
          margin-bottom: 16px;
        ">
          <div>${this.escapeHtml(event.source)} • ${ageText}</div>
          ${event.location ? `<div style="margin-top: 4px;">📍 ${this.escapeHtml(event.location.label)}</div>` : ''}
        </div>
      </div>
      
      ${event.url ? `
        <a href="${this.escapeHtml(event.url)}" target="_blank" rel="noopener noreferrer" style="
          display: inline-block;
          padding: 10px 20px;
          background: rgba(34, 211, 238, 0.2);
          border: 1px solid rgba(34, 211, 238, 0.4);
          border-radius: 8px;
          color: #22d3ee;
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s ease;
          margin-bottom: 24px;
        " onmouseover="this.style.background='rgba(34, 211, 238, 0.3)'; this.style.borderColor='rgba(34, 211, 238, 0.6)'" 
           onmouseout="this.style.background='rgba(34, 211, 238, 0.2)'; this.style.borderColor='rgba(34, 211, 238, 0.4)'">
          Read Article →
        </a>
      ` : ''}
      
      ${event.topicTags.length > 0 ? `
        <div style="margin-bottom: 24px;">
          <div style="font-size: 12px; color: rgba(255, 255, 255, 0.6); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Topic Tags</div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${event.topicTags.map(tag => `
              <span style="
                padding: 4px 10px;
                background: rgba(74, 158, 255, 0.2);
                border: 1px solid rgba(74, 158, 255, 0.4);
                border-radius: 12px;
                font-size: 11px;
                color: #4A90E2;
              ">${this.escapeHtml(tag)}</span>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      ${event.regionTag.length > 0 ? `
        <div style="margin-bottom: 24px;">
          <div style="font-size: 12px; color: rgba(255, 255, 255, 0.6); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Regions</div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${event.regionTag.map(region => `
              <span style="
                padding: 4px 10px;
                background: rgba(34, 211, 238, 0.2);
                border: 1px solid rgba(34, 211, 238, 0.4);
                border-radius: 12px;
                font-size: 11px;
                color: #22d3ee;
              ">${this.escapeHtml(region)}</span>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      ${event.detectedLocations.length > 0 ? `
        <div style="margin-bottom: 24px;">
          <div style="font-size: 12px; color: rgba(255, 255, 255, 0.6); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Location Detection</div>
          <div style="font-size: 13px; color: rgba(255, 255, 255, 0.8);">
            ${event.detectedLocations.map(loc => `
              <div style="margin-bottom: 6px;">
                ${this.escapeHtml(loc.text)} (${loc.type})
                ${loc.confidence ? `<span style="color: rgba(255, 255, 255, 0.5);"> - ${Math.round(loc.confidence * 100)}% confidence</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      <div style="
        padding-top: 24px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
      ">
        <div>Event ID: <code style="font-size: 11px; color: rgba(255, 255, 255, 0.7);">${this.escapeHtml(event.id)}</code></div>
        <div style="margin-top: 4px;">Published: ${new Date(event.publishedAt).toLocaleString()}</div>
        ${event.location ? `
          <div style="margin-top: 4px;">
            Coordinates: ${event.location.lat.toFixed(4)}, ${event.location.lon.toFixed(4)}
            <br>
            Precision: ${event.location.precision}
            ${event.location.confidence ? `<br>Confidence: ${Math.round(event.location.confidence * 100)}%` : ''}
          </div>
        ` : ''}
      </div>
    `;
    
    this.drawer.style.right = '0';
  }
  
  hide() {
    this.drawer.style.right = '-400px';
    this.drawer.style.pointerEvents = 'none'; // Disable interactions when hidden
    this.currentEvent = null;
  }
  
  isOpen() {
    return this.drawer.style.right === '0px';
  }
  
  getCategoryColor(category) {
    const colors = {
      conflict: '#ff6b6b',
      terror: '#ff3333',
      crime: '#ff8c42',
      disaster: '#ffaa00',
      weather: '#4A90E2',
      cyber: '#9b59b6',
      health: '#e74c3c',
      economy: '#f39c12',
      politics: '#3498db',
      nuclear: '#ff0000',
      other: '#95a5a6'
    };
    return colors[category] || colors.other;
  }
  
  getSeverityColor(severity) {
    const colors = {
      5: '#ff0000',
      4: '#ff6b6b',
      3: '#ffaa00',
      2: '#4A90E2',
      1: '#95a5a6'
    };
    return colors[severity] || colors[1];
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
