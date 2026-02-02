/**
 * Cameras Grid Component
 * Features: Skeleton loaders, smooth animations, infinite scroll-ready
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
              // Add loading class to card
              const card = img.closest('.livecams-card');
              if (card) card.classList.add('loading-image');
              
              loadImageWithAuth(img, proxyUrl, fallbackUrl).finally(() => {
                if (card) card.classList.remove('loading-image');
                this.observer.unobserve(img);
              });
            }
          }
        });
      }, {
        rootMargin: '100px' // Start loading earlier
      });
    }
  }
  
  /**
   * Render skeleton loading cards
   */
  renderSkeletons(count = 12) {
    const skeletons = Array(count).fill(0).map((_, i) => `
      <div class="livecams-card livecams-skeleton" style="animation-delay: ${i * 50}ms">
        <div class="livecams-card-thumbnail">
          <div class="livecams-skeleton-image"></div>
        </div>
        <div class="livecams-card-content">
          <div class="livecams-skeleton-title"></div>
          <div class="livecams-skeleton-location"></div>
          <div class="livecams-skeleton-meta"></div>
        </div>
      </div>
    `).join('');
    
    return `
      <div class="livecams-grid livecams-grid-loading">
        ${skeletons}
      </div>
      <div class="livecams-loading-status">
        <div class="livecams-spinner-small"></div>
        <span>Searching cameras...</span>
      </div>
    `;
  }
  
  render() {
    const { results, loading, error } = this.state;
    
    if (loading) {
      this.container.innerHTML = this.renderSkeletons(12);
      return;
    }
    
    if (error) {
      this.container.innerHTML = `
        <div class="livecams-error">
          <div class="livecams-error-icon">📡</div>
          <h4>Connection Issue</h4>
          <p>${this.escapeHtml(error)}</p>
          <button class="livecams-btn livecams-btn-retry" data-action="retry">
            🔄 Retry Search
          </button>
        </div>
      `;
      // Attach retry handler
      const retryBtn = this.container.querySelector('[data-action="retry"]');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          this.state.setLoading(true);
          this.state.setError(null);
          // Trigger re-search via parent
          window.dispatchEvent(new CustomEvent('livecams-retry'));
        });
      }
      return;
    }
    
    if (results.length === 0) {
      this.container.innerHTML = `
        <div class="livecams-empty">
          <div class="livecams-empty-icon">🎥</div>
          <h4>No Cameras Found</h4>
          <p>Try adjusting your search filters or selecting a different region.</p>
          <div class="livecams-empty-suggestions">
            <button class="livecams-btn-suggestion" data-preset="nyc">📍 New York</button>
            <button class="livecams-btn-suggestion" data-preset="orlando">📍 Orlando</button>
          </div>
        </div>
      `;
      return;
    }
    
    // Render camera grid with staggered animation
    this.container.innerHTML = `
      <div class="livecams-grid-header">
        <span class="livecams-result-count">${results.length} cameras</span>
        <span class="livecams-result-hint">Click to view • ⭐ to save</span>
      </div>
      <div class="livecams-grid">
        ${results.map((camera, index) => {
          const card = new CameraCard(camera, this.state, this.onSelect, this.onAddToWatchlist);
          return card.render(index); // Pass index for staggered animation
        }).join('')}
      </div>
    `;
    
    // Attach events
    results.forEach(camera => {
      const card = new CameraCard(camera, this.state, this.onSelect, this.onAddToWatchlist);
      // Use CSS.escape on raw camera.id - browser decodes HTML entities in attributes,
      // so the attribute value matches the original ID, not the HTML-escaped version
      const element = this.container.querySelector(`[data-camera-id="${CSS.escape(camera.id)}"]`);
      if (element) {
        card.attachEvents(this.container);
      }
    });
    
    // Lazy-load thumbnails
    if (this.observer) {
      const images = this.container.querySelectorAll('.livecams-card-thumbnail img[data-proxy-url]');
      images.forEach(img => this.observer.observe(img));
    }
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
