/**
 * Cameras Grid Component
 */

import { CameraCard } from './CameraCard.js';
import { loadImageWithAuth } from '../api.js';

export class CamerasGrid {
  constructor(container, state, onSelect, onAddToWatchlist) {
    this.container = container;
    this.state = state;
    this.onSelect = onSelect;
    this.onAddToWatchlist = onAddToWatchlist;
    
    this.observer = null;
    this.setupIntersectionObserver();
    
    this.render();
    this.state.subscribe(() => this.render());
  }
  
  setupIntersectionObserver() {
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.loaded === 'true') {
              this.observer.unobserve(img);
              return;
            }
            const proxyUrl = img.dataset.proxyUrl;
            const fallbackUrl = img.dataset.fallbackUrl || null;
            if (proxyUrl) {
              loadImageWithAuth(img, proxyUrl, fallbackUrl).finally(() => {
                this.observer.unobserve(img);
              });
            }
          }
        });
      }, {
        rootMargin: '50px'
      });
    }
  }
  
  render() {
    const { results, loading, error } = this.state;
    
    if (loading) {
      this.container.innerHTML = `
        <div class="livecams-loading">
          <div class="livecams-spinner"></div>
          <p>Loading cameras...</p>
        </div>
      `;
      return;
    }
    
    if (error) {
      this.container.innerHTML = `
        <div class="livecams-error">
          <p>⚠️ ${error}</p>
          <button class="livecams-btn" onclick="location.reload()">Retry</button>
        </div>
      `;
      return;
    }
    
    if (results.length === 0) {
      this.container.innerHTML = `
        <div class="livecams-empty">
          <p>No cameras found. Try adjusting your filters.</p>
        </div>
      `;
      return;
    }
    
    this.container.innerHTML = `
      <div class="livecams-grid">
        ${results.map(camera => {
          const card = new CameraCard(camera, this.state, this.onSelect, this.onAddToWatchlist);
          return card.render();
        }).join('')}
      </div>
    `;
    
    // Attach events
    results.forEach(camera => {
      const card = new CameraCard(camera, this.state, this.onSelect, this.onAddToWatchlist);
      const element = this.container.querySelector(`[data-camera-id="${camera.id}"]`);
      if (element) {
        card.attachEvents(this.container);
      }
    });
    
    // Lazy-load thumbnails via proxy with auth
    if (this.observer) {
      const images = this.container.querySelectorAll('.livecams-card-thumbnail img[data-proxy-url]');
      images.forEach(img => this.observer.observe(img));
    }
  }
}
