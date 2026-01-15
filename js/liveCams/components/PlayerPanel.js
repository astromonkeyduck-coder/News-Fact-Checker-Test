/**
 * Player Panel Component
 */

import { getProviderBadge, getTypeIcon, getStatusIndicator } from '../providers-ui.js';
import { getImageProxyUrl, loadImageWithAuth } from '../api.js';

export class PlayerPanel {
  constructor(container, state) {
    this.container = container;
    this.state = state;
    this.refreshInterval = null;
    
    this.render();
    this.state.subscribe(() => this.render());
  }
  
  render() {
    const { selectedCamera } = this.state;
    
    if (!selectedCamera) {
      this.container.innerHTML = `
        <div class="livecams-player-empty">
          <p>Select a camera to view</p>
        </div>
      `;
      this.clearRefreshInterval();
      return;
    }
    
    const camera = selectedCamera;
    const locationParts = [
      camera.city,
      camera.region1,
      camera.country
    ].filter(Boolean);
    const locationStr = locationParts.length > 0 ? locationParts.join(', ') : 'Unknown location';
    
    // Determine display mode
    let displayHtml = '';
    if (camera.media.streamUrl && camera.media.mode === 'stream') {
      // Try to embed stream (if iframe-safe)
      displayHtml = `
        <iframe 
          src="${camera.media.streamUrl}" 
          class="livecams-player-iframe"
          allowfullscreen
          frameborder="0"
        ></iframe>
      `;
    } else if (camera.media.snapshotUrl) {
      // Show snapshot with refresh
      const snapshotUrl = getImageProxyUrl(camera.media.snapshotUrl) || camera.media.snapshotUrl;
      displayHtml = `
        <img 
          id="livecams-player-image"
          src="data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 200 150\\'%3E%3Crect fill=\\'%23111\\' width=\\'200\\' height=\\'150\\'/%3E%3Ctext fill=\\'%23555\\' x=\\'50%25\\' y=\\'50%25\\' text-anchor=\\'middle\\' dy=\\'.3em\\' font-size=\\'14\\'%3ELoading...%3C/text%3E%3C/svg%3E"
          data-proxy-url="${snapshotUrl}"
          data-fallback-url="${camera.media.snapshotUrl || ''}"
          alt="${camera.title}"
          class="livecams-player-image"
        />
      `;
      this.setupSnapshotRefresh(camera);
    } else {
      displayHtml = `
        <div class="livecams-player-placeholder">
          ${getTypeIcon(camera.type)}
          <p>No image available</p>
        </div>
      `;
    }
    
    this.container.innerHTML = `
      <div class="livecams-player">
        <div class="livecams-player-header">
          <h3 class="livecams-player-title">${camera.title}</h3>
          ${getStatusIndicator(camera.status)}
        </div>
        <div class="livecams-player-display">
          ${displayHtml}
        </div>
        <div class="livecams-player-meta">
          <div class="livecams-player-location">
            <strong>Location:</strong> ${locationStr}
          </div>
          ${camera.road ? `
            <div class="livecams-player-road">
              <strong>Road:</strong> ${camera.road}
            </div>
          ` : ''}
          <div class="livecams-player-provider">
            ${getProviderBadge(camera.provider)}
          </div>
          ${camera.tags.length > 0 ? `
            <div class="livecams-player-tags">
              ${camera.tags.slice(0, 5).map(tag => `<span class="livecams-tag">${tag}</span>`).join('')}
            </div>
          ` : ''}
        </div>
        <div class="livecams-player-actions">
          ${camera.media.providerPageUrl ? `
            <a 
              href="${camera.media.providerPageUrl}" 
              target="_blank" 
              rel="noopener noreferrer"
              class="livecams-btn"
            >
              Open Provider Page
            </a>
          ` : ''}
          <button 
            class="livecams-btn" 
            data-action="copy-coords"
            title="Copy coordinates"
          >
            📋 Copy Coordinates
          </button>
          <button 
            class="livecams-btn" 
            data-action="refresh"
            title="Refresh image"
          >
            🔄 Refresh
          </button>
        </div>
      </div>
    `;
    
    this.attachEvents();
    
    if (camera.media.snapshotUrl) {
      this.loadPlayerImage(camera);
    }
  }
  
  attachEvents() {
    const copyBtn = this.container.querySelector('[data-action="copy-coords"]');
    const refreshBtn = this.container.querySelector('[data-action="refresh"]');
    
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const camera = this.state.selectedCamera;
        if (camera) {
          const coords = `${camera.lat}, ${camera.lon}`;
          navigator.clipboard.writeText(coords).then(() => {
            copyBtn.textContent = '✓ Copied!';
            setTimeout(() => {
              copyBtn.textContent = '📋 Copy Coordinates';
            }, 2000);
          });
        }
      });
    }
    
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.refreshSnapshot();
      });
    }
  }
  
  setupSnapshotRefresh(camera) {
    this.clearRefreshInterval();
    
    if (camera.media.snapshotUrl && camera.refreshSec) {
      const refreshMs = camera.refreshSec * 1000;
      this.refreshInterval = setInterval(() => {
        this.refreshSnapshot();
      }, refreshMs);
    }
  }
  
  refreshSnapshot() {
    const camera = this.state.selectedCamera;
    if (!camera || !camera.media.snapshotUrl) return;
    this.loadPlayerImage(camera, { cacheBust: true });
  }
  
  clearRefreshInterval() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  loadPlayerImage(camera, { cacheBust = false } = {}) {
    const img = this.container.querySelector('#livecams-player-image');
    if (!img) return;
    const proxyUrl = img.dataset.proxyUrl;
    const fallbackUrl = img.dataset.fallbackUrl || null;
    if (proxyUrl) {
      loadImageWithAuth(img, proxyUrl, fallbackUrl, { cacheBust });
    }
  }
}
