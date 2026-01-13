/**
 * Top Live Strip Component
 * Horizontal strip showing watchlist + hotspot cameras with auto-refresh
 */

import { getProviderBadge, getTypeIcon, getStatusIndicator } from '../providers-ui.js';
import { getImageProxyUrl } from '../api.js';

export class TopLiveStrip {
  constructor(container, state, onSelect) {
    this.container = container;
    this.state = state;
    this.onSelect = onSelect;
    this.refreshInterval = null;
    this.observer = null;
    
    this.setupIntersectionObserver();
    this.render();
    this.state.subscribe(() => this.render());
    this.startAutoRefresh();
  }
  
  setupIntersectionObserver() {
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
              this.observer.unobserve(img);
            }
          }
        });
      }, {
        rootMargin: '50px'
      });
    }
  }
  
  render() {
    const { watchlist, results } = this.state;
    
    // Get hotspot cameras (tagged with 'hotspot')
    const hotspotCameras = results.filter(cam => 
      cam.tags && cam.tags.includes('hotspot')
    ).slice(0, 10); // Limit to 10 hotspots
    
    // Combine watchlist + hotspots (dedupe by id)
    const allCameras = [];
    const seenIds = new Set();
    
    // Add watchlist first (priority)
    watchlist.forEach(cam => {
      if (!seenIds.has(cam.id)) {
        allCameras.push(cam);
        seenIds.add(cam.id);
      }
    });
    
    // Add hotspots
    hotspotCameras.forEach(cam => {
      if (!seenIds.has(cam.id)) {
        allCameras.push(cam);
        seenIds.add(cam.id);
      }
    });
    
    if (allCameras.length === 0) {
      this.container.innerHTML = `
        <div class="livecams-top-strip-empty">
          <p>Add cameras to watchlist or search hotspots to see them here</p>
        </div>
      `;
      return;
    }
    
    this.container.innerHTML = `
      <div class="livecams-top-strip">
        <div class="livecams-top-strip-header">
          <h3>Live Feed</h3>
          <span class="livecams-top-strip-count">${allCameras.length} cameras</span>
        </div>
        <div class="livecams-top-strip-scroll">
          ${allCameras.map(camera => this.renderCameraThumb(camera)).join('')}
        </div>
      </div>
    `;
    
    // Setup lazy loading for thumbnails
    this.setupLazyLoading();
  }
  
  renderCameraThumb(camera) {
    const isSelected = this.state.selectedCamera?.id === camera.id;
    const isInWatchlist = this.state.watchlist.some(c => c.id === camera.id);
    
    const thumbnailUrl = camera.media.snapshotUrl 
      ? getImageProxyUrl(camera.media.snapshotUrl) || camera.media.snapshotUrl
      : null;
    
    const locationParts = [camera.city, camera.region1].filter(Boolean);
    const locationStr = locationParts.length > 0 ? locationParts.join(', ') : camera.country || 'Unknown';
    
    return `
      <div class="livecams-top-strip-item ${isSelected ? 'selected' : ''}" data-camera-id="${camera.id}">
        <div class="livecams-top-strip-thumb">
          ${thumbnailUrl ? `
            <img 
              data-src="${thumbnailUrl}"
              alt="${camera.title}"
              class="livecams-top-strip-img"
              onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 100 75\\'%3E%3Crect fill=\\'%23333\\' width=\\'100\\' height=\\'75\\'/%3E%3Ctext fill=\\'%23666\\' x=\\'50%25\\' y=\\'50%25\\' text-anchor=\\'middle\\' dy=\\'.3em\\' font-size=\\'10\\'%3ENo Image%3C/text%3E%3C/svg%3E'"
            />
          ` : `
            <div class="livecams-top-strip-placeholder">
              ${getTypeIcon(camera.type)}
            </div>
          `}
          ${getStatusIndicator(camera.status)}
          ${isInWatchlist ? '<span class="livecams-top-strip-watchlist-badge">⭐</span>' : ''}
        </div>
        <div class="livecams-top-strip-info">
          <div class="livecams-top-strip-title" title="${camera.title}">${camera.title}</div>
          <div class="livecams-top-strip-location">${locationStr}</div>
        </div>
      </div>
    `;
  }
  
  setupLazyLoading() {
    if (!this.observer) return;
    
    const images = this.container.querySelectorAll('.livecams-top-strip-img[data-src]');
    images.forEach(img => {
      this.observer.observe(img);
    });
    
    // Attach click handlers
    const items = this.container.querySelectorAll('.livecams-top-strip-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const cameraId = item.dataset.cameraId;
        const camera = [...this.state.watchlist, ...this.state.results].find(c => c.id === cameraId);
        if (camera) {
          this.onSelect(camera);
        }
      });
    });
  }
  
  startAutoRefresh() {
    // Refresh thumbnails every 30 seconds
    this.refreshInterval = setInterval(() => {
      this.refreshThumbnails();
    }, 30000);
  }
  
  refreshThumbnails() {
    // Add timestamp to image URLs to bust cache
    const images = this.container.querySelectorAll('.livecams-top-strip-img');
    images.forEach(img => {
      if (img.src && !img.src.includes('data:image')) {
        const separator = img.src.includes('?') ? '&' : '?';
        img.src = `${img.src}${separator}_refresh=${Date.now()}`;
      }
    });
  }
  
  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}
