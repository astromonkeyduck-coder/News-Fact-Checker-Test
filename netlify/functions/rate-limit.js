/**
 * Rate Limiting Middleware for Netlify Functions
 * 
 * Usage:
 *   const rateLimit = require('./rate-limit');
 *   exports.handler = rateLimit(async (event, context) => {
 *     // Your handler code
 *   });
 */

// In-memory store (for serverless, consider Redis for production)
const requestCounts = new Map();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of requestCounts.entries()) {
    if (now - data.resetTime > 60000) { // 1 minute
      requestCounts.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Create rate limiter middleware
 * @param {Object} options - Rate limit options
 * @param {number} options.maxRequests - Maximum requests per window
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {Function} options.getKey - Function to get unique key for rate limiting
 */
function createRateLimiter(options = {}) {
  const {
    maxRequests = 10,
    windowMs = 60000, // 1 minute default
    getKey = (event) => {
      // Default: rate limit by IP
      return event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
             event.headers['client-ip'] || 
             'unknown';
    },
    message = 'Too many requests, please try again later.'
  } = options;

  return (handler) => {
    return async (event, context) => {
      const key = getKey(event);
      const now = Date.now();
      
      // Get or create rate limit data
      let rateLimitData = requestCounts.get(key);
      
      if (!rateLimitData || now - rateLimitData.resetTime > windowMs) {
        // New window or expired
        rateLimitData = {
          count: 0,
          resetTime: now + windowMs
        };
        requestCounts.set(key, rateLimitData);
      }
      
      // Increment count
      rateLimitData.count++;
      
      // Check if limit exceeded
      if (rateLimitData.count > maxRequests) {
        const retryAfter = Math.ceil((rateLimitData.resetTime - now) / 1000);
        
        return {
          statusCode: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateLimitData.resetTime).toISOString()
          },
          body: JSON.stringify({
            error: 'Too Many Requests',
            message: message,
            retryAfter: retryAfter
          })
        };
      }
      
      // Add rate limit headers to response
      const response = await handler(event, context);
      
      if (response && response.headers) {
        response.headers['X-RateLimit-Limit'] = maxRequests.toString();
        response.headers['X-RateLimit-Remaining'] = Math.max(0, maxRequests - rateLimitData.count).toString();
        response.headers['X-RateLimit-Reset'] = new Date(rateLimitData.resetTime).toISOString();
      }
      
      return response;
    };
  };
}

// Pre-configured rate limiters for common use cases
const rateLimiters = {
  // Strict: 5 requests per minute
  strict: createRateLimiter({ maxRequests: 5, windowMs: 60000 }),
  
  // Standard: 10 requests per minute
  standard: createRateLimiter({ maxRequests: 10, windowMs: 60000 }),
  
  // Generous: 20 requests per minute
  generous: createRateLimiter({ maxRequests: 20, windowMs: 60000 }),
  
  // API: 60 requests per minute
  api: createRateLimiter({ maxRequests: 60, windowMs: 60000 }),
  
  // Image generation: 3 requests per hour (very strict)
  imageGeneration: createRateLimiter({ 
    maxRequests: 3, 
    windowMs: 3600000, // 1 hour
    message: 'Image generation limit reached. Please try again in an hour.'
  }),
  
  // Chat: 30 requests per minute
  chat: createRateLimiter({ 
    maxRequests: 30, 
    windowMs: 60000,
    message: 'Too many chat requests. Please wait a moment.'
  })
};

module.exports = {
  createRateLimiter,
  rateLimiters,
  // Default export for convenience
  default: rateLimiters.standard
};

