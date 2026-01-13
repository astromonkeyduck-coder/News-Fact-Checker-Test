/**
 * Geocoding Helper - Converts city/street names to bounding boxes
 * Uses Nominatim (OpenStreetMap) with caching
 */

const { getCache, setCache, getCacheKey } = require('./cache.js');

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';
const GEOCODE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Geocode a location string to bounding box
 * @param {string} query - City name, street address, or location
 * @returns {Promise<Object|null>} {bbox: string, lat: number, lon: number, display_name: string} or null
 */
async function geocodeLocation(query) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return null;
  }
  
  const trimmedQuery = query.trim();
  
  // Check cache first
  const cacheKey = getCacheKey('geocode', { query: trimmedQuery });
  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }
  
  try {
    const params = new URLSearchParams({
      q: trimmedQuery,
      format: 'json',
      limit: '1',
      addressdetails: '1',
      extratags: '1'
    });
    
    const url = `${NOMINATIM_BASE}?${params.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'NoteworthyNews/1.0 (OSINT Live Cams)',
        'Accept': 'application/json',
        'Accept-Language': 'en'
      }
    });
    
    if (!response.ok) {
      console.error(`[geocode] Nominatim error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data) || data.length === 0) {
      // Cache negative result (shorter TTL)
      setCache(cacheKey, null, 'geocode');
      return null;
    }
    
    const result = data[0];
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    
    if (isNaN(lat) || isNaN(lon)) {
      return null;
    }
    
    // Create bbox with padding (0.05 degrees ≈ 5.5km radius)
    const padding = 0.05;
    const bbox = `${lon - padding},${lat - padding},${lon + padding},${lat + padding}`;
    
    const geocodeResult = {
      bbox,
      lat,
      lon,
      display_name: result.display_name || trimmedQuery,
      country_code: result.address?.country_code?.toUpperCase() || null,
      state: result.address?.state || null,
      city: result.address?.city || result.address?.town || result.address?.village || null
    };
    
    // Cache result with 24h TTL
    setCache(cacheKey, geocodeResult, 'geocode');
    
    return geocodeResult;
  } catch (error) {
    console.error('[geocode] Error geocoding location:', error);
    return null;
  }
}

/**
 * Geocode multiple locations (for batch processing)
 * @param {string[]} queries
 * @returns {Promise<Object[]>}
 */
async function geocodeLocations(queries) {
  if (!Array.isArray(queries) || queries.length === 0) {
    return [];
  }
  
  // Process sequentially to respect Nominatim rate limits
  const results = [];
  for (const query of queries) {
    const result = await geocodeLocation(query);
    results.push(result);
    // Small delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results.filter(Boolean);
}

module.exports = {
  geocodeLocation,
  geocodeLocations
};
