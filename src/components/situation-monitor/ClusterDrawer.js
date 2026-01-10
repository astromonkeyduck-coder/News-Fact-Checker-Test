/**
 * Cluster Drawer Panel
 * Shows events within a cluster
 */

import { getCategoryColor, getSeverityColor } from './data/clustering.js';

export class ClusterDrawer {
  constructor() {
    this.drawer = null;
    this.currentCluster = null;
    this.init();
  }
  
  init() {
    // Create drawer element
    this.drawer = document.createElement('div');
    this.drawer.className = 'sitmon-cluster-drawer';
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
    `;
    
    document.body.appendChild(this.drawer);
    
    // Listen for cluster clicks
    document.addEventListener('sitmon:cluster-click', (e) => {
      this.show(e.detail.cluster);
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
      if (this.isOpen() && !this.drawer.contains(e.target) && !e.target.closest('.event-cluster')) {
        this.hide();
      }
    });
  }
  
  show(cluster) {
    this.currentCluster = cluster;
    const content = this.drawer.querySelector('.sitmon-drawer-content');
    
    const count = cluster.getCount();
    const maxSeverity = cluster.getMaxSeverity();
    const category = cluster.getDominantCategory();
    const categoryColor = getCategoryColor(category);
    const severityColor = getSeverityColor(maxSeverity);
    
    // Sort events by severity then recency
    const sortedEvents = [...cluster.events].sort((a, b) => {
      if (b.severity !== a.severity) {
        return b.severity - a.severity;
      }
      const aTime = new Date(a.publishedAt).getTime();
      const bTime = new Date(b.publishedAt).getTime();
      return bTime - aTime;
    });
    
    // Get category breakdown
    const categoryCounts = new Map();
    for (const event of cluster.events) {
      const count = categoryCounts.get(event.category) || 0;
      categoryCounts.set(event.category, count + 1);
    }
    
    content.innerHTML = `
      <div style="margin-bottom: 24px;">
        <h2 style="
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 12px 0;
          color: #fff;
        ">${count} Event${count > 1 ? 's' : ''}</h2>
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
          ">${category}</span>
          <span style="
            display: inline-block;
            padding: 4px 12px;
            background: ${severityColor}40;
            border: 1px solid ${severityColor};
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
          ">Max Severity ${maxSeverity}/5</span>
        </div>
      </div>
      
      ${categoryCounts.size > 1 ? `
        <div style="margin-bottom: 24px;">
          <div style="font-size: 12px; color: rgba(255, 255, 255, 0.6); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Categories</div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${Array.from(categoryCounts.entries()).map(([cat, catCount]) => `
              <span style="
                padding: 4px 10px;
                background: ${getCategoryColor(cat)}40;
                border: 1px solid ${getCategoryColor(cat)};
                border-radius: 12px;
                font-size: 11px;
                color: ${getCategoryColor(cat)};
              ">${this.escapeHtml(cat)} (${catCount})</span>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      <div style="margin-bottom: 16px;">
        <div style="font-size: 12px; color: rgba(255, 255, 255, 0.6); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Top Events</div>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${sortedEvents.slice(0, 10).map(event => {
            const age = event.getAgeHours();
            const ageText = age < 1 ? `${Math.floor(age * 60)}m ago` : 
                            age < 24 ? `${Math.floor(age)}h ago` : 
                            `${Math.floor(age / 24)}d ago`;
            return `
              <div style="
                padding: 12px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s ease;
              " onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'; this.style.borderColor='rgba(34, 211, 238, 0.3)'" 
                 onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'; this.style.borderColor='rgba(255, 255, 255, 0.1)'"
                 data-event-id="${event.id}">
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                  <span style="
                    padding: 2px 8px;
                    background: ${getSeverityColor(event.severity)}40;
                    border: 1px solid ${getSeverityColor(event.severity)};
                    border-radius: 8px;
                    font-size: 10px;
                    font-weight: 600;
                    color: ${getSeverityColor(event.severity)};
                  ">${event.severity}/5</span>
                  <span style="
                    padding: 2px 8px;
                    background: ${getCategoryColor(event.category)}40;
                    border: 1px solid ${getCategoryColor(event.category)};
                    border-radius: 8px;
                    font-size: 10px;
                    color: ${getCategoryColor(event.category)};
                  ">${this.escapeHtml(event.category)}</span>
                </div>
                <div style="
                  font-size: 14px;
                  font-weight: 600;
                  margin-bottom: 4px;
                  color: #fff;
                ">${this.escapeHtml(event.title)}</div>
                <div style="
                  font-size: 12px;
                  color: rgba(255, 255, 255, 0.6);
                ">${this.escapeHtml(event.source)} • ${ageText}</div>
                ${event.location ? `<div style="font-size: 11px; color: rgba(255, 255, 255, 0.5); margin-top: 4px;">📍 ${this.escapeHtml(event.location.label)}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
        ${sortedEvents.length > 10 ? `
          <div style="
            margin-top: 12px;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.5);
            text-align: center;
          ">+ ${sortedEvents.length - 10} more events</div>
        ` : ''}
      </div>
      
      ${cluster.getBounds() ? `
        <button onclick="this.zoomToCluster()" style="
          width: 100%;
          padding: 12px;
          background: rgba(34, 211, 238, 0.2);
          border: 1px solid rgba(34, 211, 238, 0.4);
          border-radius: 8px;
          color: #22d3ee;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        " onmouseover="this.style.background='rgba(34, 211, 238, 0.3)'; this.style.borderColor='rgba(34, 211, 238, 0.6)'" 
           onmouseout="this.style.background='rgba(34, 211, 238, 0.2)'; this.style.borderColor='rgba(34, 211, 238, 0.4)'">
          Zoom to Cluster
        </button>
      ` : ''}
    `;
    
    // Add zoom handler
    const zoomBtn = content.querySelector('button[onclick*="zoomToCluster"]');
    if (zoomBtn) {
      zoomBtn.onclick = () => {
        const bounds = cluster.getBounds();
        if (bounds && window.situationMonitor && window.situationMonitor.mapView) {
          // TODO: Implement zoom to bounds
          console.log('[ClusterDrawer] Zoom to bounds:', bounds);
        }
      };
    }
    
    // Add event click handlers
    content.querySelectorAll('[data-event-id]').forEach(el => {
      el.addEventListener('click', () => {
        const eventId = el.getAttribute('data-event-id');
        const event = cluster.events.find(e => e.id === eventId);
        if (event) {
          document.dispatchEvent(new CustomEvent('sitmon:event-click', { detail: { event } }));
        }
      });
    });
    
    this.drawer.style.right = '0';
  }
  
  hide() {
    this.drawer.style.right = '-400px';
    this.currentCluster = null;
  }
  
  isOpen() {
    return this.drawer.style.right === '0px';
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
