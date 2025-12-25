/**
 * Structured logging for Verified Events Engine
 * Provides consistent log format with engine name, run_id, and metrics
 */

/**
 * Create a logger instance for an engine
 * @param {string} engine - Engine name
 * @param {string} runId - Run ID (UUID)
 * @returns {object} Logger instance
 */
function createLogger(engine, runId) {
  const prefix = `[${engine}]`;
  
  return {
    info: (message, data = {}) => {
      console.log(JSON.stringify({
        level: 'info',
        engine,
        run_id: runId,
        message,
        ...data,
        timestamp: new Date().toISOString(),
      }));
    },
    
    error: (message, error = null, data = {}) => {
      console.error(JSON.stringify({
        level: 'error',
        engine,
        run_id: runId,
        message,
        error: error ? {
          message: error.message,
          stack: error.stack,
        } : null,
        ...data,
        timestamp: new Date().toISOString(),
      }));
    },
    
    warn: (message, data = {}) => {
      console.warn(JSON.stringify({
        level: 'warn',
        engine,
        run_id: runId,
        message,
        ...data,
        timestamp: new Date().toISOString(),
      }));
    },
    
    summary: (metrics) => {
      console.log(JSON.stringify({
        level: 'summary',
        engine,
        run_id: runId,
        ...metrics,
        timestamp: new Date().toISOString(),
      }));
    },
  };
}

module.exports = {
  createLogger,
};

