/**
 * Feed Initialization (Twitter, Breaking News)
 * Lazy-loaded when section is near viewport
 */

import { logger } from '../../utils/logger.js';
import { deferInit } from './initCore.js';

let feedsInitialized = false;

/**
 * Initialize Twitter/X feed
 */
function initTwitterFeed() {
  const twitterSection = document.querySelector('.twitter-feed-section, #twitterFeed');
  if (!twitterSection) return;
  
  logger.debug('Initializing Twitter feed');
  
  // Use IntersectionObserver to load when visible
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !feedsInitialized) {
        feedsInitialized = true;
        loadTwitterFeed();
        observer.disconnect();
      }
    });
  }, {
    rootMargin: '200px' // Start loading 200px before visible
  });
  
  observer.observe(twitterSection);
}

/**
 * Load Twitter feed content
 */
async function loadTwitterFeed() {
  try {
    logger.api('GET', '/.netlify/functions/posts-read?limit=20');
    
    // Use cached data if available
    if (window.__BREAKING_NEWS_DATA_RESOLVED__) {
      renderTwitterFeed(window.__BREAKING_NEWS_DATA_RESOLVED__);
      return;
    }
    
    // Wait for fetch if in progress
    if (window.__BREAKING_NEWS_DATA__) {
      const posts = await window.__BREAKING_NEWS_DATA__;
      renderTwitterFeed(posts);
      return;
    }
    
    // Fetch if not already started
    const response = await fetch('/.netlify/functions/posts-read?limit=20');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const posts = await response.json();
    renderTwitterFeed(posts);
  } catch (error) {
    logger.error('Failed to load Twitter feed', error);
    showFeedError();
  }
}

/**
 * Render Twitter feed
 */
function renderTwitterFeed(posts) {
  const container = document.querySelector('.twitter-feed-section, #twitterFeed');
  if (!container || !posts || !Array.isArray(posts)) return;
  
  logger.debug('Rendering Twitter feed', { count: posts.length });
  // Feed rendering logic would go here
  // This is a placeholder - actual rendering depends on existing feed component
}

/**
 * Show error state for feed
 */
function showFeedError() {
  const container = document.querySelector('.twitter-feed-section, #twitterFeed');
  if (!container) return;
  
  // vNext: Use DOM creation instead of innerHTML for security
  container.innerHTML = ''; // Clear first
  
  const errorDiv = document.createElement('div');
  errorDiv.className = 'feed-error';
  errorDiv.style.cssText = 'padding: 20px; text-align: center; color: rgba(255,255,255,0.7);';
  
  const errorP = document.createElement('p');
  errorP.textContent = 'Failed to load feed';
  errorDiv.appendChild(errorP);
  
  const retryBtn = document.createElement('button');
  retryBtn.textContent = 'Retry';
  retryBtn.style.cssText = 'margin-top: 10px; padding: 8px 16px; background: rgba(74, 144, 226, 0.2); border: 1px solid rgba(74, 144, 226, 0.4); color: #4A90E2; border-radius: 6px; cursor: pointer;';
  retryBtn.onclick = () => location.reload();
  errorDiv.appendChild(retryBtn);
  
  container.appendChild(errorDiv);
}

/**
 * Initialize all feeds
 */
export function initFeeds() {
  // Defer until idle
  deferInit(() => {
    initTwitterFeed();
  }, 500);
}

export default { initFeeds };

