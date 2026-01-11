/**
 * Narrative Panel
 */

import { BasePanel } from './BasePanel.js';
import { trackNarratives } from '../data/analysis.js';

export class NarrativePanel extends BasePanel {
  constructor(containerId) {
    super(containerId, 'Narrative Signals', { collapsible: true });
    this.narratives = null;
    this.headlines = [];
  }

  init() {
    super.init(); // Initialize DOM structure
    this.render(); // Show initial empty state
  }

  update(headlines) {
    this.headlines = headlines;
    this.narratives = trackNarratives(headlines);
    this.render();
  }

  render() {
    if (!this.narratives) {
      super.render('<p>No narrative data available. Load news feed first.</p>');
      return;
    }

    const crossings = this.narratives.crossings || [];
    const fringeSignals = this.narratives.fringeSignals || [];

    const content = `
      <div class="sitmon-narrative-stats">
        <div class="sitmon-narrative-stat">
          <span class="sitmon-stat-label">Mainstream:</span>
          <span class="sitmon-stat-value">${this.narratives.mainstream}</span>
        </div>
        <div class="sitmon-narrative-stat">
          <span class="sitmon-stat-label">Fringe:</span>
          <span class="sitmon-stat-value">${this.narratives.fringe}</span>
        </div>
        <div class="sitmon-narrative-stat">
          <span class="sitmon-stat-label">Crossings:</span>
          <span class="sitmon-stat-value">${crossings.length}</span>
        </div>
      </div>

      ${crossings.length > 0 ? `
        <div class="sitmon-narrative-section">
          <h4>Fringe → Mainstream Crossings</h4>
          <div class="sitmon-narrative-list">
            ${crossings.map(item => `
              <div class="sitmon-narrative-item sitmon-narrative-crossing">
                <div class="sitmon-narrative-title">
                  <a href="${escapeHtml(item.headline.link)}" target="_blank" rel="noopener noreferrer">
                    ${escapeHtml(item.headline.title)}
                  </a>
                </div>
                <div class="sitmon-narrative-source">${escapeHtml(item.domain)}</div>
                <div class="sitmon-narrative-keywords">
                  Keywords: ${item.matchedKeywords.map(kw => `<span class="sitmon-keyword">${escapeHtml(kw)}</span>`).join(', ')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${fringeSignals.length > 0 ? `
        <div class="sitmon-narrative-section">
          <h4>Fringe Signals</h4>
          <div class="sitmon-narrative-list">
            ${fringeSignals.map(item => `
              <div class="sitmon-narrative-item sitmon-narrative-fringe">
                <div class="sitmon-narrative-title">
                  <a href="${escapeHtml(item.headline.link)}" target="_blank" rel="noopener noreferrer">
                    ${escapeHtml(item.headline.title)}
                  </a>
                </div>
                <div class="sitmon-narrative-source">${escapeHtml(item.domain)}</div>
                <div class="sitmon-narrative-keywords">
                  Keywords: ${item.matchedKeywords.map(kw => `<span class="sitmon-keyword">${escapeHtml(kw)}</span>`).join(', ')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="sitmon-narrative-note">
        <small>⚠️ For monitoring purposes only. Not making factual claims.</small>
      </div>
    `;

    super.render(content);
  }

  getNarratives() {
    return this.narratives;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
