/**
 * Request Debouncer Utility
 * Prevents excessive API calls by debouncing requests
 * 
 * Usage:
 *   import { createRequestDebouncer } from './request-debouncer';
 *   const debouncedFetch = createRequestDebouncer(fetch, 300);
 */

import { debounce } from './debounce-throttle';

/**
 * Create a debounced version of a request function
 * @param {Function} requestFunc - Request function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {Function} keyGenerator - Function to generate cache key from arguments
 * @returns {Function} - Debounced request function
 */
export function createRequestDebouncer(requestFunc, wait = 300, keyGenerator = null) {
  const pendingRequests = new Map();
  const requestCache = new Map();
  const CACHE_TTL = 60000; // 1 minute cache

  async function debouncedRequest(...args) {
    // Generate cache key
    const key = keyGenerator 
      ? keyGenerator(...args)
      : JSON.stringify(args);

    // Check cache first
    const cached = requestCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    // Check if request is already pending
    if (pendingRequests.has(key)) {
      return pendingRequests.get(key);
    }

    // Create new request
    const requestPromise = requestFunc(...args)
      .then((response) => {
        // Cache successful responses
        if (response && response.ok !== false) {
          requestCache.set(key, {
            data: response,
            timestamp: Date.now()
          });
        }
        pendingRequests.delete(key);
        return response;
      })
      .catch((error) => {
        pendingRequests.delete(key);
        throw error;
      });

    pendingRequests.set(key, requestPromise);
    return requestPromise;
  }

  // Debounce the request function
  return debounce(debouncedRequest, wait, {
    leading: true,
    trailing: false
  });
}

/**
 * Debounced fetch wrapper
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} wait - Debounce wait time
 * @returns {Promise} - Fetch promise
 */
export function debouncedFetch(url, options = {}, wait = 300) {
  const debouncer = createRequestDebouncer(
    (url, options) => fetch(url, options),
    wait,
    (url) => url // Use URL as cache key
  );

  return debouncer(url, options);
}

/**
 * Create a request queue with debouncing
 * Useful for search inputs where you want to cancel previous requests
 */
export class RequestQueue {
  constructor(wait = 300) {
    this.wait = wait;
    this.pendingRequest = null;
    this.abortController = null;
  }

  async add(requestFunc, ...args) {
    // Cancel previous request
    if (this.abortController) {
      this.abortController.abort();
    }

    // Clear pending timeout
    if (this.pendingRequest) {
      clearTimeout(this.pendingRequest);
    }

    // Create new abort controller
    this.abortController = new AbortController();

    return new Promise((resolve, reject) => {
      this.pendingRequest = setTimeout(async () => {
        try {
          const result = await requestFunc(...args, {
            signal: this.abortController.signal
          });
          resolve(result);
        } catch (error) {
          if (error.name !== 'AbortError') {
            reject(error);
          }
        } finally {
          this.pendingRequest = null;
          this.abortController = null;
        }
      }, this.wait);
    });
  }

  cancel() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.pendingRequest) {
      clearTimeout(this.pendingRequest);
      this.pendingRequest = null;
    }
  }
}

export default {
  createRequestDebouncer,
  debouncedFetch,
  RequestQueue
};

