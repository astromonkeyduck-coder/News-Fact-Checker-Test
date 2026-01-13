/**
 * Camera Card Component
 */

import { getProviderBadge, getTypeIcon, getStatusIndicator } from '../providers-ui.js';
import { getImageProxyUrl, fetchImageWithAuth } from '../api.js';

export class CameraCard {
  constructor(camera, state, onSelect, onAddToWatchlist) {
    this.camera = camera;
    this.state = state;
    this.onSelect = onSelect;
    this.onAddToWatchlist = onAddToWatchlist;
  }
  
  render() {
    const { camera } = this;
    const isInWatchlist = this.state.watchlist.some(c => c.id === camera.id);
    const isSelected = this.state.selectedCamera?.id === camera.id;
    
    // Get thumbnail URL (use proxy if needed)
    const thumbnailUrl = camera.media.snapshotUrl 
      ? getImageProxyUrl(camera.media.snapshotUrl) || camera.media.snapshotUrl
      : null;
    
    const locationParts = [
      camera.city,
      camera.region1,
      camera.country
    ].filter(Boolean);
    const locationStr = locationParts.length > 0 ? locationParts.join(', ') : 'Unknown location';
    
    return `
      <div class="livecams-card ${isSelected ? 'selected' : ''}" data-camera-id="${camera.id}">
        <div class="livecams-card-thumbnail">
          ${thumbnailUrl ? `
            <img 
              src="${thumbnailUrl}" 
              alt="${camera.title}"
              loading="lazy"
              onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 200 150\\'%3E%3Crect fill=\\'%23333\\' width=\\'200\\' height=\\'150\\'/%3E%3Ctext fill=\\'%23666\\' x=\\'50%25\\' y=\\'50%25\\' text-anchor=\\'middle\\' dy=\\'.3em\\' font-size=\\'14\\'%3ENo Image%3C/text%3E%3C/svg%3E'"
            />
          ` : `
            <div class="livecams-card-placeholder">
              ${getTypeIcon(camera.type)}
            </div>
          `}
          ${getStatusIndicator(camera.status)}
        </div>
        <div class="livecams-card-content">
          <div class="livecams-card-title">${camera.title}</div>
          <div class="livecams-card-location">${locationStr}</div>
          ${camera.road ? `<div class="livecams-card-road">${camera.road}</div>` : ''}
          <div class="livecams-card-meta">
            ${getProviderBadge(camera.provider)}
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
        </div>
      </div>
    `;
  }
  
  attachEvents(element) {
    const card = element.querySelector(`[data-camera-id="${this.camera.id}"]`);
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
