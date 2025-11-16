/**
 * Centralized Logging Utility
 * 
 * Provides a consistent logging interface that can be disabled in production.
 * Use this instead of console.log/error/warn throughout the codebase.
 * 
 * Usage:
 *   import { logger } from './utils/logger';
 *   logger.log('User logged in', { userId: 123 });
 *   logger.error('Failed to load data', error);
 *   logger.warn('Deprecated API used');
 */

const isDevelopment = 
  typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || 
   window.location.hostname === '127.0.0.1' ||
   window.location.hostname.includes('.netlify.app'));

const isProduction = !isDevelopment;

// Check for explicit debug mode (useful for production debugging)
const isDebugMode = 
  typeof window !== 'undefined' && 
  (window.localStorage?.getItem('debug') === 'true' || 
   window.location.search.includes('debug=true'));

/**
 * Logger utility with different log levels
 */
export const logger = {
  /**
   * Log informational messages
   * @param {string} message - Log message
   * @param {any} data - Optional data to log
   */
  log: (message, data = null) => {
    if (isProduction && !isDebugMode) return;
    
    if (data !== null) {
      console.log(`[Noteworthy News] ${message}`, data);
    } else {
      console.log(`[Noteworthy News] ${message}`);
    }
  },

  /**
   * Log warning messages
   * @param {string} message - Warning message
   * @param {any} data - Optional data to log
   */
  warn: (message, data = null) => {
    if (isProduction && !isDebugMode) return;
    
    if (data !== null) {
      console.warn(`[Noteworthy News] WARNING: ${message}`, data);
    } else {
      console.warn(`[Noteworthy News] WARNING: ${message}`);
    }
  },

  /**
   * Log error messages (always logged, even in production)
   * @param {string} message - Error message
   * @param {Error|any} error - Error object or data
   */
  error: (message, error = null) => {
    // Errors are always logged, but with less detail in production
    if (error) {
      if (isProduction && !isDebugMode) {
        // In production, only log error message, not full stack
        console.error(`[Noteworthy News] ERROR: ${message}`, error.message || error);
      } else {
        console.error(`[Noteworthy News] ERROR: ${message}`, error);
      }
    } else {
      console.error(`[Noteworthy News] ERROR: ${message}`);
    }
  },

  /**
   * Log debug messages (only in development or debug mode)
   * @param {string} message - Debug message
   * @param {any} data - Optional data to log
   */
  debug: (message, data = null) => {
    if (isProduction && !isDebugMode) return;
    
    if (data !== null) {
      console.debug(`[Noteworthy News] DEBUG: ${message}`, data);
    } else {
      console.debug(`[Noteworthy News] DEBUG: ${message}`);
    }
  },

  /**
   * Log performance metrics
   * @param {string} label - Performance label
   * @param {number} duration - Duration in milliseconds
   */
  performance: (label, duration) => {
    if (isProduction && !isDebugMode) return;
    
    console.log(`[Noteworthy News] PERFORMANCE: ${label} took ${duration.toFixed(2)}ms`);
  },

  /**
   * Group related logs together
   * @param {string} label - Group label
   * @param {Function} callback - Function to execute within the group
   */
  group: (label, callback) => {
    if (isProduction && !isDebugMode) {
      callback();
      return;
    }
    
    console.group(`[Noteworthy News] ${label}`);
    try {
      callback();
    } finally {
      console.groupEnd();
    }
  },

  /**
   * Log API requests/responses
   * @param {string} method - HTTP method
   * @param {string} url - Request URL
   * @param {any} data - Request/response data
   */
  api: (method, url, data = null) => {
    if (isProduction && !isDebugMode) return;
    
    if (data) {
      console.log(`[Noteworthy News] API ${method} ${url}`, data);
    } else {
      console.log(`[Noteworthy News] API ${method} ${url}`);
    }
  }
};

// Export default for convenience
export default logger;

// Also expose globally for easy access (optional)
if (typeof window !== 'undefined') {
  window.logger = logger;
}

