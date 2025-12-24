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

// vNext: Production detection - only dev on localhost/netlify preview
const isDevelopment = 
  typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || 
   window.location.hostname === '127.0.0.1' ||
   (window.location.hostname.includes('.netlify.app') && !window.location.hostname.includes('noteworthynews.co')));

const isProduction = !isDevelopment;

// Check for explicit debug mode (useful for production debugging)
const isDebugMode = 
  typeof window !== 'undefined' && 
  (window.localStorage?.getItem('debug') === 'true' || 
   window.location.search.includes('debug=true'));

// CSS styles for browser console (Chrome DevTools supports %c styling)
const styles = {
  reset: '',
  bold: 'font-weight: bold;',
  dim: 'opacity: 0.7;',
  red: 'color: #ff4444;',
  green: 'color: #44ff44;',
  yellow: 'color: #ffaa00;',
  blue: 'color: #4488ff;',
  magenta: 'color: #ff44ff;',
  cyan: 'color: #44ffff;',
  gray: 'color: #888888;',
  bgBlue: 'background-color: #1e3a5f; color: white; padding: 2px 6px; border-radius: 3px;',
  bgGreen: 'background-color: #1e5f1e; color: white; padding: 2px 6px; border-radius: 3px;',
  bgRed: 'background-color: #5f1e1e; color: white; padding: 2px 6px; border-radius: 3px;',
  bgYellow: 'background-color: #5f5f1e; color: white; padding: 2px 6px; border-radius: 3px;',
};

// Helper to format timestamp
const getTimestamp = () => {
  const now = new Date();
  return now.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    fractionalSecondDigits: 3
  });
};

// Helper to format data objects nicely
const formatData = (data) => {
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (data instanceof Error) {
    return `${data.name}: ${data.message}`;
  }
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
};

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
    
    const timestamp = getTimestamp();
    if (data !== null) {
      console.log(
        `%c[${timestamp}]%c [Noteworthy News]%c ${message}`,
        styles.gray + styles.dim,
        styles.blue + styles.bold,
        styles.reset,
        data
      );
    } else {
      console.log(
        `%c[${timestamp}]%c [Noteworthy News]%c ${message}`,
        styles.gray + styles.dim,
        styles.blue + styles.bold,
        styles.reset
      );
    }
  },

  /**
   * Log warning messages
   * @param {string} message - Warning message
   * @param {any} data - Optional data to log
   */
  warn: (message, data = null) => {
    if (isProduction && !isDebugMode) return;
    
    const timestamp = getTimestamp();
    if (data !== null) {
      console.warn(
        `%c[${timestamp}]%c ⚠%c [Noteworthy News] WARNING:%c ${message}`,
        styles.gray + styles.dim,
        styles.yellow + styles.bold,
        styles.yellow + styles.bold,
        styles.reset,
        data
      );
    } else {
      console.warn(
        `%c[${timestamp}]%c ⚠%c [Noteworthy News] WARNING:%c ${message}`,
        styles.gray + styles.dim,
        styles.yellow + styles.bold,
        styles.yellow + styles.bold,
        styles.reset
      );
    }
  },

  /**
   * Log error messages (always logged, even in production)
   * @param {string} message - Error message
   * @param {Error|any} error - Error object or data
   */
  error: (message, error = null) => {
    // Errors are always logged, but with less detail in production
    const timestamp = getTimestamp();
    if (error) {
      if (isProduction && !isDebugMode) {
        // In production, only log error message, not full stack
        console.error(
          `%c[${timestamp}]%c ✗%c [Noteworthy News] ERROR:%c ${message}`,
          styles.gray + styles.dim,
          styles.red + styles.bold,
          styles.red + styles.bold,
          styles.reset,
          error.message || error
        );
      } else {
        console.error(
          `%c[${timestamp}]%c ✗%c [Noteworthy News] ERROR:%c ${message}`,
          styles.gray + styles.dim,
          styles.red + styles.bold,
          styles.red + styles.bold,
          styles.reset,
          error
        );
        if (error instanceof Error && error.stack) {
          console.error(`%cStack trace:%c\n${error.stack}`, styles.gray, styles.reset);
        }
      }
    } else {
      console.error(
        `%c[${timestamp}]%c ✗%c [Noteworthy News] ERROR:%c ${message}`,
        styles.gray + styles.dim,
        styles.red + styles.bold,
        styles.red + styles.bold,
        styles.reset
      );
    }
  },

  /**
   * Log debug messages (only in development or debug mode)
   * @param {string} message - Debug message
   * @param {any} data - Optional data to log
   */
  debug: (message, data = null) => {
    if (isProduction && !isDebugMode) return;
    
    const timestamp = getTimestamp();
    if (data !== null) {
      console.debug(
        `%c[${timestamp}]%c 🔍%c [Noteworthy News] DEBUG:%c ${message}`,
        styles.gray + styles.dim,
        styles.cyan + styles.bold,
        styles.cyan,
        styles.reset,
        data
      );
    } else {
      console.debug(
        `%c[${timestamp}]%c 🔍%c [Noteworthy News] DEBUG:%c ${message}`,
        styles.gray + styles.dim,
        styles.cyan + styles.bold,
        styles.cyan,
        styles.reset
      );
    }
  },

  /**
   * Log performance metrics
   * @param {string} label - Performance label
   * @param {number} duration - Duration in milliseconds
   */
  performance: (label, duration) => {
    if (isProduction && !isDebugMode) return;
    
    const timestamp = getTimestamp();
    const color = duration > 1000 ? styles.red : duration > 500 ? styles.yellow : styles.green;
    console.log(
      `%c[${timestamp}]%c ⚡%c [Noteworthy News] PERFORMANCE:%c ${label} took %c${duration.toFixed(2)}ms`,
      styles.gray + styles.dim,
      styles.magenta + styles.bold,
      styles.magenta,
      styles.reset,
      color + styles.bold
    );
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
    
    const timestamp = getTimestamp();
    console.group(
      `%c[${timestamp}]%c 📦%c [Noteworthy News] ${label}`,
      styles.gray + styles.dim,
      styles.blue + styles.bold,
      styles.reset
    );
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
    
    const timestamp = getTimestamp();
    const methodColor = method === 'GET' ? styles.blue : 
                       method === 'POST' ? styles.green : 
                       method === 'PUT' ? styles.yellow : 
                       method === 'DELETE' ? styles.red : styles.cyan;
    
    if (data) {
      console.log(
        `%c[${timestamp}]%c 🌐%c [Noteworthy News] API%c ${method}%c ${url}`,
        styles.gray + styles.dim,
        styles.cyan + styles.bold,
        styles.reset,
        methodColor + styles.bold,
        styles.reset,
        data
      );
    } else {
      console.log(
        `%c[${timestamp}]%c 🌐%c [Noteworthy News] API%c ${method}%c ${url}`,
        styles.gray + styles.dim,
        styles.cyan + styles.bold,
        styles.reset,
        methodColor + styles.bold,
        styles.reset
      );
    }
  },
  
  /**
   * Log structured data in a table format
   * @param {string} label - Table label
   * @param {object|array} data - Data to display in table
   */
  table: (label, data) => {
    if (isProduction && !isDebugMode) return;
    
    const timestamp = getTimestamp();
    console.log(
      `%c[${timestamp}]%c 📊%c [Noteworthy News] ${label}`,
      styles.gray + styles.dim,
      styles.blue + styles.bold,
      styles.reset
    );
    console.table(data);
  },
  
  /**
   * Log a success message
   * @param {string} message - Success message
   * @param {any} data - Optional data to log
   */
  success: (message, data = null) => {
    if (isProduction && !isDebugMode) return;
    
    const timestamp = getTimestamp();
    if (data !== null) {
      console.log(
        `%c[${timestamp}]%c ✓%c [Noteworthy News] SUCCESS:%c ${message}`,
        styles.gray + styles.dim,
        styles.green + styles.bold,
        styles.green + styles.bold,
        styles.reset,
        data
      );
    } else {
      console.log(
        `%c[${timestamp}]%c ✓%c [Noteworthy News] SUCCESS:%c ${message}`,
        styles.gray + styles.dim,
        styles.green + styles.bold,
        styles.green + styles.bold,
        styles.reset
      );
    }
  }
};

// Export default for convenience
export default logger;

// Also expose globally for easy access (optional)
if (typeof window !== 'undefined') {
  window.logger = logger;
}

