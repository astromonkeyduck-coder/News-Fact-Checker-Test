/**
 * Core Homepage Initialization
 * Critical path only - runs immediately on page load
 * Mission: Fast first paint, interactive ASAP
 */

import { logger } from '../../utils/logger.js';

// Performance tracking
const perfStart = performance.now();
let firstInteractionTime = null;
let modulesInitialized = {};

/**
 * Track time to first interaction
 */
function trackFirstInteraction() {
  if (firstInteractionTime) return; // Already tracked
  
  firstInteractionTime = performance.now();
  const tti = firstInteractionTime - perfStart;
  logger.performance('Time to First Interaction (TTI)', tti);
  
  // Remove listeners after first interaction
  ['click', 'keydown', 'touchstart'].forEach(event => {
    document.removeEventListener(event, trackFirstInteraction, { once: true });
  });
}

/**
 * Initialize core homepage functionality
 * Only critical features that block first paint
 */
export function initCore() {
  const coreTime = performance.now() - perfStart;
  logger.performance('initCore', coreTime);
  modulesInitialized.core = coreTime;
  
  // Critical: Start breaking news fetch immediately (already in HTML)
  // Critical: Initialize logger
  // Critical: Set up error boundaries
  
  // Track first interaction
  ['click', 'keydown', 'touchstart'].forEach(event => {
    document.addEventListener(event, trackFirstInteraction, { once: true });
  });
  
  // Everything else is deferred
  logger.debug('Core initialization complete');
}

/**
 * Track module initialization time
 */
export function trackModuleInit(moduleName) {
  const time = performance.now() - perfStart;
  modulesInitialized[moduleName] = time;
  logger.performance(`${moduleName} initialized`, time);
}

/**
 * Get all module initialization times (for debugging)
 */
export function getModuleTimings() {
  return { ...modulesInitialized };
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if device is mobile
 */
export function isMobile() {
  return window.innerWidth <= 768;
}

/**
 * Defer non-critical initialization
 */
export function deferInit(callback, delay = 0) {
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(callback, { timeout: delay || 2000 });
  } else {
    setTimeout(callback, delay || 100);
  }
}

/**
 * Initialize smooth scrolling with reduced motion support
 */
export function initSmoothScroll() {
  // Check for reduced motion preference
  if (prefersReducedMotion()) {
    // Disable smooth scroll if user prefers reduced motion
    document.documentElement.style.scrollBehavior = 'auto';
    return;
  }
  
  // Enable smooth scroll
  if ('scrollBehavior' in document.documentElement.style) {
    document.documentElement.style.scrollBehavior = 'smooth';
  }
  
  // Handle anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#' || !href) return;
      
      const targetId = href.substring(1);
      const targetElement = document.getElementById(targetId);
      
      if (targetElement) {
        e.preventDefault();
        const offset = 80; // Header height
        const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - offset;
        
        window.scrollTo({
          top: targetPosition,
          behavior: prefersReducedMotion() ? 'auto' : 'smooth'
        });
      }
    });
  });
}

/**
 * Initialize lazy loading for images
 */
export function initLazyImages() {
  // Add loading="lazy" to non-hero images
  const images = document.querySelectorAll('img:not([loading])');
  images.forEach((img) => {
    // Skip if already has loading attribute or is above the fold
    if (img.hasAttribute('loading')) return;
    
    const rect = img.getBoundingClientRect();
    const isAboveFold = rect.top < window.innerHeight && rect.bottom > 0;
    
    // Only lazy-load images below the fold
    if (!isAboveFold && 'loading' in HTMLImageElement.prototype) {
      img.loading = 'lazy';
      img.decoding = 'async';
    }
  });
  
  // Use IntersectionObserver for better control
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
          }
          img.classList.add('loaded');
          observer.unobserve(img);
        }
      });
    }, {
      rootMargin: '50px'
    });
    
    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });
  }
}

// Auto-initialize core
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCore);
} else {
  initCore();
}

