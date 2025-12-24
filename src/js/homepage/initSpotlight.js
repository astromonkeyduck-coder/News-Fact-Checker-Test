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
 */
export function initSpotlight() {
  const spotlightSection = document.querySelector('.spotlight-section, #countrySpotlight');
  if (!spotlightSection) return;
  
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
}

/**
 * Load country spotlight with retry and caching
 */
async function loadSpotlight() {
  // Check cache first
  const cached = getCachedSpotlight();
  if (cached) {
    renderSpotlight(cached);
    logger.debug('Loaded spotlight from cache');
  }
  
  // Fetch fresh data
  try {
    const data = await fetchSpotlight();
    if (data) {
      cacheSpotlight(data);
      renderSpotlight(data);
      logger.debug('Loaded fresh spotlight data');
    }
  } catch (error) {
    logger.error('Failed to load spotlight', error);
    
    // Show cached data if available, otherwise show error
    if (!cached) {
      showSpotlightError();
    }
  }
}

/**
 * Fetch spotlight data with timeout
 */
async function fetchSpotlight() {
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
}

/**
 * Render spotlight data
 */
function renderSpotlight(data) {
  const container = document.querySelector('.spotlight-section, #countrySpotlight');
  if (!container || !data) return;
  
  // Render logic here
  // This is a placeholder - actual rendering depends on existing spotlight component
  logger.debug('Rendering spotlight', data);
}

/**
 * Show error state with retry button
 */
function showSpotlightError() {
  const container = document.querySelector('.spotlight-section, #countrySpotlight');
  if (!container) return;
  
  // vNext: Use DOM creation instead of innerHTML for security
  container.innerHTML = ''; // Clear first
  
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

