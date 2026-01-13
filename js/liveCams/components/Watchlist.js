/**
 * Watchlist Component
 */

import { CameraCard } from './CameraCard.js';

export class Watchlist {
  constructor(container, state, onSelect, onRemove) {
    this.container = container;
    this.state = state;
    this.onSelect = onSelect;
    this.onRemove = onRemove;
    
    this.render();
    this.state.subscribe(() => this.render());
  }
  
  render() {
    const { watchlist } = this.state;
    
    if (watchlist.length === 0) {
      this.container.innerHTML = `
        <div class="livecams-watchlist-empty">
          <p>No cameras in watchlist. Click the star icon on any camera to add it.</p>
        </div>
      `;
      return;
    }
    
    this.container.innerHTML = `
      <div class="livecams-watchlist">
        <div class="livecams-watchlist-header">
          <h3>Watchlist (${watchlist.length})</h3>
          <button class="livecams-btn-clear" data-action="clear-watchlist">Clear All</button>
        </div>
        <div class="livecams-watchlist-grid">
          ${watchlist.map(camera => {
            const card = new CameraCard(camera, this.state, this.onSelect, () => {
              this.onRemove(camera.id);
            });
            return card.render();
          }).join('')}
        </div>
      </div>
    `;
    
    // Attach events
    watchlist.forEach(camera => {
      const card = new CameraCard(camera, this.state, this.onSelect, () => {
        this.onRemove(camera.id);
      });
      const element = this.container.querySelector(`[data-camera-id="${camera.id}"]`);
      if (element) {
        card.attachEvents(this.container);
      }
    });
    
    // Clear all button
    const clearBtn = this.container.querySelector('[data-action="clear-watchlist"]');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('Clear all cameras from watchlist?')) {
          watchlist.forEach(camera => {
            this.onRemove(camera.id);
          });
        }
      });
    }
  }
}
