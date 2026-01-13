/**
 * Camera Cache - In-memory cache with TTL for camera search results
 */

// In-memory cache (per function instance)
const cache = new Map();

// Cache entry structure: { data, expires, timestamp }
const CACHE_TTL = {
  windy: 5 * 60 * 1000,      // 5 minutes (URLs expire fast)
  fl511: 20 * 60 * 1000,     // 20 minutes
  ny511: 20 * 60 * 1000,      // 20 minutes
  caltrans: 20 * 60 * 1000,  // 20 minutes
  nycdot: 20 * 60 * 1000,    // 20 minutes
  geocode: 24 * 60 * 60 * 1000, // 24 hours (geocoding results)
  search: 10 * 60 * 1000,    // 10 minutes (search results)
  default: 10 * 60 * 1000    // 10 minutes
};

/**
 * Generate cache key from query params
 * @param {string} provider
 * @param {Object} params
 * @returns {string}
 */
function getCacheKey(provider, params) {
  const parts = [provider];
  
  if (params.bbox) {
    parts.push(`bbox:${params.bbox}`);
  } else {
    if (params.country) parts.push(`country:${params.country}`);
    if (params.state) parts.push(`state:${params.state}`);
    if (params.city) parts.push(`city:${params.city}`);
    if (params.q) parts.push(`q:${params.q}`);
  }
  
  if (params.type) parts.push(`type:${params.type}`);
  if (params.media) parts.push(`media:${params.media}`);
  
  return parts.join('|');
}

/**
 * Get cached data if available and not expired
 * @param {string} key
 * @returns {Object|null} Cached data or null
 */
function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  
  const now = Date.now();
  if (now > entry.expires) {
    cache.delete(key);
    return null; // Expired
  }
  
  return entry.data;
}

/**
 * Set cache entry
 * @param {string} key
 * @param {Object} data
 * @param {string} provider - Provider name for TTL lookup
 */
function setCache(key, data, provider = 'default') {
  const ttl = CACHE_TTL[provider] || CACHE_TTL.default;
  const now = Date.now();
  
  cache.set(key, {
    data,
    expires: now + ttl,
    timestamp: now
  });
  
  // Cleanup old entries periodically (keep cache size reasonable)
  if (cache.size > 1000) {
    cleanupCache();
  }
}

/**
 * Remove expired entries from cache
 */
function cleanupCache() {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expires) {
      cache.delete(key);
    }
  }
}

/**
 * Clear all cache entries
 */
function clearCache() {
  cache.clear();
}

/**
 * Get cache stats
 * @returns {Object}
 */
function getCacheStats() {
  const now = Date.now();
  let expired = 0;
  let active = 0;
  
  for (const entry of cache.values()) {
    if (now > entry.expires) {
      expired++;
    } else {
      active++;
    }
  }
  
  return {
    total: cache.size,
    active,
    expired
  };
}

module.exports = {
  getCacheKey,
  getCache,
  setCache,
  clearCache,
  getCacheStats
};
