/**
 * DOM Update Throttling Utilities
 * Prevents excessive DOM writes that cause layout thrashing
 */

import { throttle, throttleRAF } from './throttle.js';

/**
 * Throttle DOM text updates
 * @param {HTMLElement} element - Element to update
 * @param {Function} updateFn - Function that updates the element
 * @param {number} delay - Throttle delay in ms (default: 100ms)
 * @returns {Function} Throttled update function
 */
export function throttleDOMUpdate(element, updateFn, delay = 100) {
  return throttle(() => {
    // Batch DOM reads
    const measurements = [];
    
    // Batch DOM writes
    requestAnimationFrame(() => {
      updateFn(element);
    });
  }, delay);
}

/**
 * Throttle counter/ticker updates
 * Updates max 10 times per second
 */
export function throttleCounter(element, updateFn) {
  let lastUpdate = 0;
  const minInterval = 100; // 10 updates per second max
  
  return () => {
    const now = Date.now();
    if (now - lastUpdate >= minInterval) {
      lastUpdate = now;
      requestAnimationFrame(() => {
        updateFn(element);
      });
    }
  };
}

/**
 * Throttle scroll-based DOM updates
 * Uses requestAnimationFrame for smooth updates
 */
export function throttleScrollUpdate(updateFn) {
  return throttleRAF(updateFn);
}

/**
 * Batch multiple DOM updates together
 * Prevents layout thrashing by batching reads and writes
 */
export function batchDOMUpdates(updates) {
  // Read phase
  const measurements = updates.map(update => {
    if (typeof update.read === 'function') {
      return update.read();
    }
    return null;
  });
  
  // Write phase (in next frame)
  requestAnimationFrame(() => {
    updates.forEach((update, index) => {
      if (typeof update.write === 'function') {
        update.write(measurements[index]);
      }
    });
  });
}

/**
 * Measure once, write once pattern
 * Prevents repeated layout calculations
 */
export function measureOnceWriteOnce(readFn, writeFn) {
  let cachedMeasurement = null;
  let writeScheduled = false;
  
  return () => {
    // Read immediately
    if (!cachedMeasurement) {
      cachedMeasurement = readFn();
    }
    
    // Schedule write once
    if (!writeScheduled) {
      writeScheduled = true;
      requestAnimationFrame(() => {
        writeFn(cachedMeasurement);
        cachedMeasurement = null;
        writeScheduled = false;
      });
    }
  };
}

