/**
 * Correlation Panel
 */

import { BasePanel } from './BasePanel.js';
import { detectCorrelations } from '../data/analysis.js';

export class CorrelationPanel extends BasePanel {
  constructor(containerId) {
    super(containerId, 'Correlations', { collapsible: true });
    this.correlations = [];
    this.headlines = [];
  }

  update(headlines) {
    this.headlines = headlines;
    this.correlations = detectCorrelations(headlines);
    this.render();
  }

  render() {
    if (this.correlations.length === 0) {
      super.render('<p>No correlations detected. Load news feed first.</p>');
      return;
    }

    const content = this.correlations.map(corr => {
      const momentum = corr.momentum.toFixed(1);
      const items = corr.items.slice(0, 3); // Top 3 items

      return `
        <div class="sitmon-correlation-item">
          <div class="sitmon-correlation-header">
            <span class="sitmon-correlation-topic">${escapeHtml(corr.topic)}</span>
            <span class="sitmon-correlation-count">${corr.count} mentions</span>
          </div>
          <div class="sitmon-correlation-momentum">
            Momentum: ${momentum}/hour
          </div>
          ${items.length > 0 ? `
            <div class="sitmon-correlation-items">
              ${items.map(item => `
                <div class="sitmon-correlation-item-link">
                  <a href="${escapeHtml(item.headline.link)}" target="_blank" rel="noopener noreferrer">
                    ${escapeHtml(item.headline.title.substring(0, 60))}...
                  </a>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    super.render(`
      <div class="sitmon-correlations-list">
        ${content}
      </div>
      <div class="sitmon-correlation-note">
        <small>Topics spiking across multiple categories</small>
      </div>
    `);
  }

  getCorrelations() {
    return this.correlations;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
