/**
 * Debounce and Throttle Utilities
 * Optimize performance by limiting function execution frequency
 * 
 * Usage:
 *   import { debounce, throttle } from './debounce-throttle';
 *   const debouncedSearch = debounce(handleSearch, 300);
 *   const throttledScroll = throttle(handleScroll, 100);
 */

/**
 * Debounce function - delays execution until after wait time
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {Object} options - Options object
 * @returns {Function} - Debounced function
 */
export function debounce(func, wait = 300, options = {}) {
  const {
    leading = false,
    trailing = true,
    maxWait = null
  } = options;

  let timeoutId = null;
  let maxTimeoutId = null;
  let lastCallTime = null;
  let lastInvokeTime = 0;
  let lastArgs = null;
  let lastThis = null;
  let result = null;

  function invokeFunc(time) {
    const args = lastArgs;
    const thisArg = lastThis;

    lastArgs = lastThis = null;
    lastInvokeTime = time;
    result = func.apply(thisArg, args);
    return result;
  }

  function leadingEdge(time) {
    lastInvokeTime = time;
    timeoutId = setTimeout(timerExpired, wait);
    if (leading) {
      return invokeFunc(time);
    }
    return result;
  }

  function remainingWait(time) {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;
    const timeWaiting = wait - timeSinceLastCall;

    return maxWait !== null
      ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
      : timeWaiting;
  }

  function shouldInvoke(time) {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;

    return (
      lastCallTime === null ||
      timeSinceLastCall >= wait ||
      timeSinceLastCall < 0 ||
      (maxWait !== null && timeSinceLastInvoke >= maxWait)
    );
  }

  function timerExpired() {
    const time = Date.now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    timeoutId = setTimeout(timerExpired, remainingWait(time));
  }

  function trailingEdge(time) {
    timeoutId = null;

    if (trailing && lastArgs) {
      return invokeFunc(time);
    }
    lastArgs = lastThis = null;
    return result;
  }

  function cancel() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    if (maxTimeoutId !== null) {
      clearTimeout(maxTimeoutId);
    }
    lastInvokeTime = 0;
    lastArgs = lastCallTime = lastThis = timeoutId = null;
  }

  function flush() {
    return timeoutId === null ? result : trailingEdge(Date.now());
  }

  function pending() {
    return timeoutId !== null;
  }

  function debounced(...args) {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastThis = this;
    lastCallTime = time;

    if (isInvoking) {
      if (timeoutId === null) {
        return leadingEdge(lastCallTime);
      }
      if (maxWait !== null) {
        timeoutId = setTimeout(timerExpired, wait);
        return invokeFunc(lastCallTime);
      }
    }
    if (timeoutId === null) {
      timeoutId = setTimeout(timerExpired, wait);
    }
    return result;
  }

  debounced.cancel = cancel;
  debounced.flush = flush;
  debounced.pending = pending;

  return debounced;
}

/**
 * Throttle function - limits execution to at most once per wait time
 * @param {Function} func - Function to throttle
 * @param {number} wait - Wait time in milliseconds
 * @param {Object} options - Options object
 * @returns {Function} - Throttled function
 */
export function throttle(func, wait = 100, options = {}) {
  const {
    leading = true,
    trailing = true
  } = options;

  return debounce(func, wait, {
    leading,
    trailing,
    maxWait: wait
  });
}

/**
 * Debounce for search inputs (300ms default)
 * @param {Function} searchFunc - Search function
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced search function
 */
export function debounceSearch(searchFunc, wait = 300) {
  return debounce(searchFunc, wait, {
    leading: false,
    trailing: true
  });
}

/**
 * Throttle for scroll handlers (100ms default)
 * @param {Function} scrollFunc - Scroll handler function
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Throttled scroll function
 */
export function throttleScroll(scrollFunc, wait = 100) {
  return throttle(scrollFunc, wait, {
    leading: false,
    trailing: true
  });
}

/**
 * Throttle for resize handlers (250ms default)
 * @param {Function} resizeFunc - Resize handler function
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Throttled resize function
 */
export function throttleResize(resizeFunc, wait = 250) {
  return throttle(resizeFunc, wait, {
    leading: false,
    trailing: true
  });
}

/**
 * Debounce for API calls (500ms default)
 * @param {Function} apiFunc - API function
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced API function
 */
export function debounceAPI(apiFunc, wait = 500) {
  return debounce(apiFunc, wait, {
    leading: false,
    trailing: true
  });
}

// Export all utilities
export default {
  debounce,
  throttle,
  debounceSearch,
  throttleScroll,
  throttleResize,
  debounceAPI
};

