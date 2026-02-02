/**
 * Camera Card Component
 * Features: Smooth animations, hover preview, progressive loading
 */

import { getProviderBadge, getTypeIcon, getStatusIndicator } from '../providers-ui.js';
import { getImageProxyUrl } from '../api.js';

export class CameraCard {
  constructor(camera, state, onSelect, onAddToWatchlist) {
    this.camera = camera;
    this.state = state;
    this.onSelect = onSelect;
    this.onAddToWatchlist = onAddToWatchlist;
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
  
  render(index = 0) {
    const { camera } = this;
    const isInWatchlist = this.state.watchlist?.some(c => c.id === camera.id) || false;
    const isSelected = this.state.selectedCamera?.id === camera.id;
    
    // Get thumbnail URL (use proxy if needed)
    const thumbnailUrl = camera.media?.snapshotUrl 
      ? getImageProxyUrl(camera.media.snapshotUrl)
      : null;
    const fallbackUrl = camera.media?.snapshotUrl || null;
    
    const locationParts = [
      camera.city,
      camera.region1,
      camera.country
    ].filter(Boolean);
    const locationStr = locationParts.length > 0 ? locationParts.join(', ') : 'Unknown location';
    
    // Calculate staggered animation delay (max 300ms total spread)
    const animationDelay = Math.min(index * 30, 300);
    
    // Provider display name
    const providerName = this.getProviderDisplayName(camera.provider);
    
    return `
      <div class="livecams-card ${isSelected ? 'selected' : ''}" 
           data-camera-id="${this.escapeHtml(camera.id)}"
           style="animation-delay: ${animationDelay}ms">
        <div class="livecams-card-thumbnail">
          ${thumbnailUrl ? `
            <img 
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 180'%3E%3Crect fill='%23151a25' width='320' height='180'/%3E%3Ccircle cx='160' cy='90' r='20' fill='none' stroke='%2322d3ee' stroke-width='2' opacity='0.5'%3E%3Canimate attributeName='r' values='15;25;15' dur='1.5s' repeatCount='indefinite'/%3E%3C/circle%3E%3C/svg%3E"
              data-proxy-url="${this.escapeHtml(thumbnailUrl)}"
              data-fallback-url="${this.escapeHtml(fallbackUrl || '')}"
              alt="${this.escapeHtml(camera.title)}"
              loading="lazy"
              class="livecams-card-image"
            />
          ` : `
            <div class="livecams-card-placeholder">
              ${getTypeIcon(camera.type)}
            </div>
          `}
          <div class="livecams-card-overlay">
            <span class="livecams-card-view-hint">Click to view</span>
          </div>
          ${getStatusIndicator(camera.status)}
          ${camera.media?.mode === 'stream' ? '<span class="livecams-card-live-badge">LIVE</span>' : ''}
        </div>
        <div class="livecams-card-content">
          <div class="livecams-card-title" title="${this.escapeHtml(camera.title)}">${this.escapeHtml(camera.title)}</div>
          <div class="livecams-card-location">
            <span class="livecams-location-icon">📍</span>
            ${this.escapeHtml(locationStr)}
          </div>
          ${camera.road ? `<div class="livecams-card-road">🛣️ ${this.escapeHtml(camera.road)}</div>` : ''}
          <div class="livecams-card-meta">
            <span class="livecams-provider-tag" title="${providerName}">${this.escapeHtml(providerName)}</span>
            ${getTypeIcon(camera.type)}
          </div>
        </div>
        <div class="livecams-card-actions">
          <button 
            class="livecams-btn-icon ${isInWatchlist ? 'active' : ''}" 
            data-action="watchlist"
            aria-label="${isInWatchlist ? 'Remove from' : 'Add to'} watchlist"
            title="${isInWatchlist ? 'Remove from' : 'Add to'} watchlist"
          >
            ${isInWatchlist ? '⭐' : '☆'}
          </button>
          <button 
            class="livecams-btn-icon" 
            data-action="map"
            aria-label="Show on map"
            title="Show on map"
          >
            🗺️
          </button>
        </div>
      </div>
    `;
  }
  
  /**
   * Get provider display name
   */
  getProviderDisplayName(provider) {
    const names = {
      'fl511': 'FL511',
      'caltrans': 'Caltrans',
      'txdot': 'TxDOT',
      'wydot': 'WyDOT',
      'windy': 'Windy',
      'earthcam': 'EarthCam',
      'ivideon': 'iVideon'
    };
    return names[provider] || provider || 'Unknown';
  }
  
  attachEvents(element) {
    // Use CSS.escape on raw camera.id - browser decodes HTML entities in attributes,
    // so the attribute value matches the original ID, not the HTML-escaped version
    const card = element.querySelector(`[data-camera-id="${CSS.escape(this.camera.id)}"]`);
    if (!card) return;
    
    // Click to select
    card.addEventListener('click', (e) => {
      if (!e.target.closest('[data-action]')) {
        this.onSelect(this.camera);
      }
    });
    
    // Watchlist button
    const watchlistBtn = card.querySelector('[data-action="watchlist"]');
    if (watchlistBtn) {
      watchlistBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onAddToWatchlist(this.camera);
      });
    }
  }
}
