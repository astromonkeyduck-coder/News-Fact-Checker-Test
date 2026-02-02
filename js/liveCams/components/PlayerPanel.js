/**
 * Player Panel Component
 * Enhanced with auto-refresh timer, PiP support, and better UX
 */

import { getProviderBadge, getTypeIcon, getStatusIndicator } from '../providers-ui.js';
import { getImageProxyUrl, loadImageWithAuth } from '../api.js';

export class PlayerPanel {
  constructor(container, state) {
    this.container = container;
    this.state = state;
    this.refreshInterval = null;
    this.countdownInterval = null;
    this.nextRefreshTime = null;
    this.isPiPActive = false;
    
    this.render();
    this.state.subscribe(() => this.render());
  }
  
  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  render() {
    const { selectedCamera } = this.state;
    
    if (!selectedCamera) {
      this.container.innerHTML = `
        <div class="livecams-player-empty">
          <div class="livecams-player-empty-icon">📹</div>
          <h4>Select a Camera</h4>
          <p>Choose a camera from the grid to view live feed</p>
          <div class="livecams-player-shortcuts">
            <span class="livecams-shortcut">← → to browse</span>
            <span class="livecams-shortcut">Enter to select</span>
          </div>
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
    
    // Check PiP support
    const pipSupported = 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled;
    
    // Determine display mode
    let displayHtml = '';
    let isStream = false;
    
    if (camera.media?.streamUrl && camera.media?.mode === 'stream') {
      isStream = true;
      // Try to embed stream (if iframe-safe)
      displayHtml = `
        <iframe 
          src="${this.escapeHtml(camera.media.streamUrl)}" 
          class="livecams-player-iframe"
          allowfullscreen
          frameborder="0"
        ></iframe>
        <div class="livecams-player-live-indicator">
          <span class="livecams-live-dot"></span>
          LIVE STREAM
        </div>
      `;
    } else if (camera.media?.snapshotUrl) {
      // Show snapshot with refresh
      const snapshotUrl = getImageProxyUrl(camera.media.snapshotUrl) || camera.media.snapshotUrl;
      displayHtml = `
        <img 
          id="livecams-player-image"
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 360'%3E%3Crect fill='%23151a25' width='640' height='360'/%3E%3Ccircle cx='320' cy='180' r='30' fill='none' stroke='%2322d3ee' stroke-width='2' opacity='0.5'%3E%3Canimate attributeName='r' values='25;35;25' dur='1.5s' repeatCount='indefinite'/%3E%3C/circle%3E%3C/svg%3E"
          data-proxy-url="${this.escapeHtml(snapshotUrl)}"
          data-fallback-url="${this.escapeHtml(camera.media.snapshotUrl || '')}"
          alt="${this.escapeHtml(camera.title)}"
          class="livecams-player-image"
        />
        <div class="livecams-player-refresh-indicator" id="livecams-refresh-timer">
          <span class="livecams-refresh-icon">↻</span>
          <span class="livecams-refresh-countdown">--</span>s
        </div>
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
    
    // Tags display (safely escape each)
    const tagsHtml = (camera.tags || []).slice(0, 5)
      .map(tag => `<span class="livecams-tag">${this.escapeHtml(tag)}</span>`)
      .join('');
    
    this.container.innerHTML = `
      <div class="livecams-player livecams-player-enhanced">
        <div class="livecams-player-header">
          <div class="livecams-player-header-left">
            <h3 class="livecams-player-title">${this.escapeHtml(camera.title)}</h3>
            <span class="livecams-player-location-badge">
              📍 ${this.escapeHtml(locationStr)}
            </span>
          </div>
          <div class="livecams-player-header-right">
            ${getStatusIndicator(camera.status)}
            ${isStream ? '<span class="livecams-player-mode-badge live">LIVE</span>' : '<span class="livecams-player-mode-badge snapshot">SNAPSHOT</span>'}
          </div>
        </div>
        
        <div class="livecams-player-display livecams-player-display-large">
          ${displayHtml}
          <div class="livecams-player-controls-overlay">
            <button class="livecams-player-control" data-action="prev" title="Previous camera">
              ◀
            </button>
            <button class="livecams-player-control" data-action="next" title="Next camera">
              ▶
            </button>
          </div>
        </div>
        
        <div class="livecams-player-toolbar">
          <button class="livecams-player-tool" data-action="refresh" title="Refresh now">
            🔄 Refresh
          </button>
          ${pipSupported && camera.media?.snapshotUrl ? `
            <button class="livecams-player-tool" data-action="pip" title="Picture-in-Picture">
              🖼️ PiP
            </button>
          ` : ''}
          <button class="livecams-player-tool" data-action="fullscreen" title="Fullscreen view">
            ⛶ Fullscreen
          </button>
          <button class="livecams-player-tool" data-action="copy-coords" title="Copy GPS coordinates">
            📋 Coords
          </button>
          <button class="livecams-player-tool" data-action="show-map" title="Show on map">
            🗺️ Map
          </button>
        </div>
        
        <div class="livecams-player-meta-compact">
          <div class="livecams-player-meta-row">
            ${camera.road ? `<span class="livecams-meta-item">🛣️ ${this.escapeHtml(camera.road)}</span>` : ''}
            ${getProviderBadge(camera.provider)}
          </div>
          ${tagsHtml ? `<div class="livecams-player-tags">${tagsHtml}</div>` : ''}
        </div>
        
        ${camera.media?.providerPageUrl ? `
          <a 
            href="${this.escapeHtml(camera.media.providerPageUrl)}" 
            target="_blank" 
            rel="noopener noreferrer"
            class="livecams-player-source-link"
          >
            View on ${this.getProviderName(camera.provider)} →
          </a>
        ` : ''}
      </div>
    `;
    
    this.attachEvents();
    
    if (camera.media?.snapshotUrl) {
      this.loadPlayerImage(camera);
    }
  }
  
  /**
   * Get provider display name
   */
  getProviderName(provider) {
    const names = {
      'fl511': 'FL511',
      'caltrans': 'Caltrans',
      'txdot': 'TxDOT',
      'wydot': 'WyDOT',
      'windy': 'Windy Webcams',
      'earthcam': 'EarthCam'
    };
    return names[provider] || 'Provider';
  }
  
  attachEvents() {
    // Action buttons
    const actions = this.container.querySelectorAll('[data-action]');
    actions.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        this.handleAction(action, e.currentTarget);
      });
    });
    
    // Keyboard navigation
    this.container.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        this.navigateCamera(-1);
      } else if (e.key === 'ArrowRight') {
        this.navigateCamera(1);
      }
    });
  }
  
  handleAction(action, btn) {
    const camera = this.state.selectedCamera;
    
    switch(action) {
      case 'copy-coords':
        if (camera) {
          const coords = `${camera.lat}, ${camera.lon}`;
          navigator.clipboard.writeText(coords).then(() => {
            btn.innerHTML = '✓ Copied!';
            setTimeout(() => {
              btn.innerHTML = '📋 Coords';
            }, 2000);
          });
        }
        break;
        
      case 'refresh':
        this.refreshSnapshot();
        btn.classList.add('refreshing');
        setTimeout(() => btn.classList.remove('refreshing'), 500);
        break;
        
      case 'pip':
        this.togglePictureInPicture();
        break;
        
      case 'fullscreen':
        this.toggleFullscreen();
        break;
        
      case 'prev':
        this.navigateCamera(-1);
        break;
        
      case 'next':
        this.navigateCamera(1);
        break;
        
      case 'show-map':
        // Dispatch event for parent to handle
        window.dispatchEvent(new CustomEvent('livecams-show-on-map', { 
          detail: { camera } 
        }));
        break;
    }
  }
  
  /**
   * Navigate to next/previous camera
   */
  navigateCamera(direction) {
    const results = this.state.results || [];
    if (results.length === 0) return;
    
    const currentIndex = results.findIndex(c => c.id === this.state.selectedCamera?.id);
    let newIndex = currentIndex + direction;
    
    // Wrap around
    if (newIndex < 0) newIndex = results.length - 1;
    if (newIndex >= results.length) newIndex = 0;
    
    this.state.selectCamera(results[newIndex]);
  }
  
  /**
   * Toggle Picture-in-Picture mode
   */
  async togglePictureInPicture() {
    const img = this.container.querySelector('#livecams-player-image');
    if (!img) return;
    
    try {
      // Create a video element from canvas for PiP
      // Since we have a static image, we'll create a canvas-based video
      if (this.isPiPActive && document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        this.isPiPActive = false;
        return;
      }
      
      // Create canvas from image
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 640;
      canvas.height = img.naturalHeight || 360;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      
      // Create video from canvas stream
      const stream = canvas.captureStream(1);
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      
      // Request PiP
      await video.requestPictureInPicture();
      this.isPiPActive = true;
      
      // Update canvas periodically with new snapshots
      this.pipUpdateInterval = setInterval(() => {
        const currentImg = this.container.querySelector('#livecams-player-image');
        if (currentImg && currentImg.complete) {
          ctx.drawImage(currentImg, 0, 0);
        }
      }, 1000);
      
      // Clean up on PiP exit
      video.addEventListener('leavepictureinpicture', () => {
        this.isPiPActive = false;
        if (this.pipUpdateInterval) {
          clearInterval(this.pipUpdateInterval);
          this.pipUpdateInterval = null;
        }
        video.srcObject = null;
        stream.getTracks().forEach(t => t.stop());
      });
      
    } catch (err) {
      console.error('[PlayerPanel] PiP error:', err);
    }
  }
  
  /**
   * Toggle fullscreen for the player display
   */
  async toggleFullscreen() {
    const display = this.container.querySelector('.livecams-player-display');
    if (!display) return;
    
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await display.requestFullscreen();
      }
    } catch (err) {
      console.error('[PlayerPanel] Fullscreen error:', err);
    }
  }
  
  setupSnapshotRefresh(camera) {
    this.clearRefreshInterval();
    
    if (camera.media?.snapshotUrl && camera.refreshSec) {
      const refreshMs = camera.refreshSec * 1000;
      this.nextRefreshTime = Date.now() + refreshMs;
      
      // Setup refresh interval
      this.refreshInterval = setInterval(() => {
        this.refreshSnapshot();
        this.nextRefreshTime = Date.now() + refreshMs;
      }, refreshMs);
      
      // Setup countdown timer update
      this.countdownInterval = setInterval(() => {
        this.updateCountdownDisplay();
      }, 1000);
      
      // Initial countdown update
      this.updateCountdownDisplay();
    }
  }
  
  /**
   * Update the countdown timer display
   */
  updateCountdownDisplay() {
    const timerEl = this.container.querySelector('#livecams-refresh-timer .livecams-refresh-countdown');
    if (!timerEl || !this.nextRefreshTime) return;
    
    const remaining = Math.max(0, Math.ceil((this.nextRefreshTime - Date.now()) / 1000));
    timerEl.textContent = remaining;
  }
  
  refreshSnapshot() {
    const camera = this.state.selectedCamera;
    if (!camera || !camera.media?.snapshotUrl) return;
    this.loadPlayerImage(camera, { cacheBust: true });
  }
  
  clearRefreshInterval() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    if (this.pipUpdateInterval) {
      clearInterval(this.pipUpdateInterval);
      this.pipUpdateInterval = null;
    }
    this.nextRefreshTime = null;
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
