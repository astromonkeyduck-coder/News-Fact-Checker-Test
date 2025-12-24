/**
 * Homepage Main Initialization
 * Orchestrates all deferred modules
 */

import { initCore, deferInit } from './initCore.js';
import { initEffects } from './initEffects.js';
import { initFeeds } from './initFeeds.js';
import { initGames } from './initGames.js';
import { initSpotlight } from './initSpotlight.js';
import { initAccordions, autoSetupAccordions } from './accordion.js';
import { logger } from '../../utils/logger.js';

/**
 * Initialize all homepage modules
 */
export function initHomepage() {
  logger.debug('Initializing homepage modules');
  
  // Core runs immediately (already done)
  initCore();
  
  // Initialize lazy images immediately (lightweight)
  import('./initCore.js').then(({ initLazyImages }) => {
    initLazyImages();
  });
  
  // Defer all non-critical modules
  deferInit(() => {
    initEffects();
    initFeeds();
    initGames();
    initSpotlight();
    initAccordions();
    autoSetupAccordions();
    logger.debug('All homepage modules initialized');
  }, 500);
}

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHomepage);
} else {
  initHomepage();
}

export default { initHomepage };

