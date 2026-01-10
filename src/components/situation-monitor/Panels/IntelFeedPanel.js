/**
 * Intel Feed Panel (Main Character Analysis)
 */

import { BasePanel } from './BasePanel.js';
import { extractMainCharacters } from '../data/analysis.js';

export class IntelFeedPanel extends BasePanel {
  constructor(containerId) {
    super(containerId, 'Main Characters', { collapsible: true });
    this.characters = [];
    this.headlines = [];
  }

  update(headlines) {
    this.headlines = headlines;
    this.characters = extractMainCharacters(headlines, 10);
    this.render();
  }

  render() {
    if (this.characters.length === 0) {
      super.render('<p>No character data available. Load news feed first.</p>');
      return;
    }

    const content = this.characters.map(char => {
      const typeLabel = char.type.charAt(0).toUpperCase() + char.type.slice(1);
      
      return `
        <div class="sitmon-character-item">
          <div class="sitmon-character-header">
            <span class="sitmon-character-name">${escapeHtml(char.name)}</span>
            <span class="sitmon-character-count">${char.count}x</span>
          </div>
          <div class="sitmon-character-details">
            <span class="sitmon-character-type">${typeLabel}</span>
            <span class="sitmon-character-mentions">${char.mentions} mentions</span>
          </div>
        </div>
      `;
    }).join('');

    super.render(`
      <div class="sitmon-characters-list">
        ${content}
      </div>
      <div class="sitmon-character-note">
        <small>Top mentioned entities from current headlines</small>
      </div>
    `);
  }

  getCharacters() {
    return this.characters;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
