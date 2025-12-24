/**
 * Game Embeds Initialization
 * Lazy-loaded when section is near viewport
 */

import { logger } from '../../utils/logger.js';
import { isMobile } from './initCore.js';

let gamesInitialized = false;

/**
 * Initialize game embeds (Geography, Fact-Checker)
 */
export function initGames() {
  if (gamesInitialized) return;
  
  const gameSections = document.querySelectorAll('.fact-checker-section, .geography-game-section, [data-game-embed]');
  
  if (gameSections.length === 0) return;
  
  // Use IntersectionObserver for each game section
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        loadGameEmbed(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, {
    rootMargin: '300px' // Start loading well before visible
  });
  
  gameSections.forEach(section => {
    observer.observe(section);
  });
  
  gamesInitialized = true;
  logger.debug('Game sections observed for lazy loading');
}

/**
 * Load game embed
 */
function loadGameEmbed(section) {
  const gameType = section.dataset.gameType || section.className.includes('fact-checker') ? 'fact-checker' : 'geography';
  
  logger.debug(`Loading game embed: ${gameType}`);
  
  // On mobile, show "Open in full screen" button instead of embedding
  if (isMobile() && section.dataset.mobileFullscreen !== 'false') {
    showMobileGameButton(section, gameType);
    return;
  }
  
  // Desktop: Load actual embed
  // This would initialize the actual game component
  // Placeholder for actual game initialization
}

/**
 * Show mobile-friendly game button
 */
function showMobileGameButton(section, gameType) {
  const gameUrl = gameType === 'fact-checker' ? '/game.html' : '/geography-game.html';
  
  section.innerHTML = `
    <div class="mobile-game-prompt" style="padding: 40px 20px; text-align: center;">
      <h3 style="color: white; margin-bottom: 16px;">Play ${gameType === 'fact-checker' ? 'Fact Checker' : 'Geography'} Game</h3>
      <p style="color: rgba(255,255,255,0.7); margin-bottom: 24px;">For the best experience, open this game in full screen</p>
      <a href="${gameUrl}" style="display: inline-block; padding: 12px 24px; background: rgba(74, 144, 226, 0.2); border: 1px solid rgba(74, 144, 226, 0.4); color: #4A90E2; border-radius: 6px; text-decoration: none; font-weight: 600;">
        Open Game
      </a>
    </div>
  `;
}

export default { initGames };

