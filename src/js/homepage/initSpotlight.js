/**
 * Country Spotlight Initialization
 * Lazy-loaded with retry logic and localStorage caching
 */

import { logger } from '../../utils/logger.js';
import { deferInit } from './initCore.js';

const SPOTLIGHT_CACHE_KEY = 'noteworthy_spotlight_cache';
const SPOTLIGHT_CACHE_TTL = 3600000; // 1 hour

/**
 * Initialize country spotlight
 * Note: This is a lightweight wrapper. The actual spotlight functionality
 * is handled by the legacy implementation in script.js (initCountrySpotlight).
 * This module only provides a non-interfering initialization check.
 */
export function initSpotlight() {
  const spotlightSection = document.querySelector('.spotlight-section, #country-spotlight-section');
  if (!spotlightSection) return;
  
  // Check if the legacy spotlight implementation is already active
  // The legacy implementation uses these elements and functions
  const spotlightContainer = document.getElementById('spotlight-container');
  const refreshBtn = document.getElementById('refresh-spotlight-btn');
  
  // If legacy implementation is present, don't interfere
  // Also check for the legacy function that might be defined globally
  if (spotlightContainer || refreshBtn || window.loadSpotlight || typeof window.initCountrySpotlight !== 'undefined') {
    logger.debug('Legacy spotlight implementation detected, skipping new init');
    return;
  }
  
  // Wait a bit to ensure legacy implementation has time to initialize
  // (script.js loads before this module, but there might be a small delay)
  setTimeout(() => {
    // Check again after delay
    const container = document.getElementById('spotlight-container');
    const btn = document.getElementById('refresh-spotlight-btn');
    
    if (container || btn || window.loadSpotlight) {
      logger.debug('Legacy spotlight implementation detected after delay, skipping new init');
      return;
    }
    
    // Only proceed if legacy implementation is definitely not present
    // Use IntersectionObserver to load when visible
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          loadSpotlight();
          observer.disconnect();
        }
      });
    }, {
      rootMargin: '200px'
    });
    
    observer.observe(spotlightSection);
  }, 100); // Small delay to ensure legacy implementation has initialized
}

/**
 * Load country spotlight with retry and caching
 * Note: This is a lightweight wrapper. The actual loading is handled
 * by the legacy implementation in script.js. This function checks for
 * legacy implementation and defers to it if present.
 */
async function loadSpotlight() {
  // Check if legacy implementation is already active
  const container = document.querySelector('.spotlight-section, #country-spotlight-section');
  if (container && container.querySelector('#spotlight-container')) {
    logger.debug('Legacy spotlight implementation active, deferring to it');
    // The legacy implementation handles everything, so we just return
    return;
  }
  
  // Check cache first
  const cached = getCachedSpotlight();
  if (cached) {
    renderSpotlight(cached);
    logger.debug('Loaded spotlight from cache');
  }
  
  // Fetch fresh data (currently returns null as API doesn't exist)
  try {
    const data = await fetchSpotlight();
    if (data) {
      cacheSpotlight(data);
      renderSpotlight(data);
      logger.debug('Loaded fresh spotlight data');
    } else {
      // No data from API (API not implemented yet)
      // Don't show error - legacy implementation will handle it
      logger.debug('No API data available, legacy implementation will handle spotlight');
    }
  } catch (error) {
    logger.error('Failed to load spotlight', error);
    
    // Show cached data if available, otherwise show error
    // But only if legacy implementation isn't active
    if (!cached && !container?.querySelector('#spotlight-container')) {
      showSpotlightError();
    }
  }
}

/**
 * Fetch spotlight data with timeout
 * Note: This API endpoint doesn't exist yet. The legacy implementation
 * in script.js handles spotlight generation directly. This function
 * is kept for future API-based implementation but currently returns null
 * to avoid errors.
 */
async function fetchSpotlight() {
  // Check if legacy implementation is active - if so, don't fetch
  const container = document.querySelector('.spotlight-section, #country-spotlight-section');
  if (container && container.querySelector('#spotlight-container')) {
    logger.debug('Legacy spotlight active, skipping API fetch');
    return null;
  }
  
  // API endpoint doesn't exist yet - return null to avoid errors
  // The legacy implementation in script.js handles spotlight generation
  logger.debug('Spotlight API endpoint not implemented yet, legacy implementation handles this');
  return null;
  
  /* Future implementation when API is ready:
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
  
  try {
    const response = await fetch('/.netlify/functions/country-spotlight', {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
  */
}

/**
 * Render spotlight data
 * Note: This is a placeholder. The actual rendering is handled by
 * the legacy implementation in script.js. This function exists to
 * prevent errors but doesn't actually render anything.
 */
function renderSpotlight(data) {
  const container = document.querySelector('.spotlight-section, #country-spotlight-section');
  if (!container || !data) return;
  
  // Check if legacy implementation is already handling rendering
  if (container.querySelector('#spotlight-container')) {
    logger.debug('Legacy spotlight implementation active, skipping render');
    return;
  }
  
  // This is a placeholder - actual rendering is done by script.js
  logger.debug('Rendering spotlight (placeholder - legacy implementation handles actual rendering)', data);
}

/**
 * Show error state with retry button
 */
function showSpotlightError() {
  const container = document.querySelector('.spotlight-section, #country-spotlight-section');
  if (!container) return;
  
  // Don't clear the container - the legacy implementation might be using it
  // Instead, check if there's already content and don't interfere
  if (container.querySelector('#spotlight-container')) {
    logger.debug('Legacy spotlight container found, not showing error overlay');
    return;
  }
  
  // Only show error if container is empty (no legacy implementation)
  if (container.children.length > 0) {
    logger.debug('Container has content, not showing error overlay');
    return;
  }
  
  const errorDiv = document.createElement('div');
  errorDiv.className = 'spotlight-error';
  errorDiv.style.cssText = 'padding: 20px; text-align: center; color: rgba(255,255,255,0.7);';
  
  const errorP = document.createElement('p');
  errorP.textContent = 'Failed to load country spotlight';
  errorDiv.appendChild(errorP);
  
  const retryBtn = document.createElement('button');
  retryBtn.textContent = 'Retry';
  retryBtn.style.cssText = 'margin-top: 10px; padding: 8px 16px; background: rgba(74, 144, 226, 0.2); border: 1px solid rgba(74, 144, 226, 0.4); color: #4A90E2; border-radius: 6px; cursor: pointer;';
  retryBtn.onclick = () => {
    if (window.initSpotlight) {
      window.initSpotlight();
    } else {
      loadSpotlight(); // Fallback to direct call
    }
  };
  errorDiv.appendChild(retryBtn);
  
  container.appendChild(errorDiv);
}

/**
 * Get cached spotlight data
 */
function getCachedSpotlight() {
  try {
    const cached = localStorage.getItem(SPOTLIGHT_CACHE_KEY);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;
    
    if (age > SPOTLIGHT_CACHE_TTL) {
      localStorage.removeItem(SPOTLIGHT_CACHE_KEY);
      return null;
    }
    
    return data;
  } catch {
    return null;
  }
}

/**
 * Cache spotlight data
 */
function cacheSpotlight(data) {
  try {
    localStorage.setItem(SPOTLIGHT_CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (error) {
    logger.warn('Failed to cache spotlight', error);
  }
}

// Make initSpotlight globally available for retry button
if (typeof window !== 'undefined') {
  window.initSpotlight = initSpotlight;
}

export default { initSpotlight };

