/**
 * Geocoding Proxy - Server-side Nominatim geocoder
 * GET /.netlify/functions/geocodeProxy?q=<encoded-query>
 * 
 * Fetches geocoding data server-side to avoid CORS and rate limits.
 * Implements strict rate limiting (1 req/sec) and caching (24h).
 */

// In-memory cache (TTL: 24 hours)
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Rate limiting: token bucket (1 request per second)
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second

// Single-flight pattern
const inFlight = new Map();

/**
 * Validate geocoding query before sending
 */
function validateQuery(query) {
  if (!query || typeof query !== 'string') {
    return false;
  }
  
  const trimmed = query.trim();
  
  // Length checks
  if (trimmed.length < 2 || trimmed.length > 60) {
    return false;
  }
  
  // Word count check
  const words = trimmed.split(/\s+/);
  if (words.length > 6) {
    return false;
  }
  
  // Banned phrases (garbage patterns)
  const bannedPhrases = [
    'terms that directly relate to',
    'the same league as',
    'exposed unusual scenarios',
    'may be numbered with',
    'that directly relate'
  ];
  
  const lowerQuery = trimmed.toLowerCase();
  for (const phrase of bannedPhrases) {
    if (lowerQuery.includes(phrase)) {
      return false;
    }
  }
  
  // Must have at least one capitalized word or known place keyword
  const hasCapitalized = /[A-Z]/.test(trimmed);
  const placeKeywords = ['city', 'country', 'state', 'region', 'capital', 'island', 'mountain', 'river'];
  const hasPlaceKeyword = placeKeywords.some(kw => lowerQuery.includes(kw));
  
  if (!hasCapitalized && !hasPlaceKeyword) {
    // Check for common country/city names
    const commonPlaces = ['america', 'united states', 'uk', 'france', 'germany', 'japan', 'china', 'russia', 'india', 'brazil', 'mexico', 'canada', 'australia'];
    const hasCommonPlace = commonPlaces.some(place => lowerQuery.includes(place));
    if (!hasCommonPlace) {
      return false;
    }
  }
  
  return true;
}

/**
 * Fetch from Nominatim with rate limiting
 */
async function fetchNominatim(query) {
  const cacheKey = `geo_${query.toLowerCase().trim()}`;
  const cached = cache.get(cacheKey);
  
  if (cached && (Date.now() - cached.fetchedAt < CACHE_TTL)) {
    return cached.data;
  }
  
  // Check if request already in flight
  if (inFlight.has(cacheKey)) {
    return inFlight.get(cacheKey);
  }
  
  // Rate limiting: wait if needed
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  
  // Create promise for single-flight
  const fetchPromise = (async () => {
    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=1&addressdetails=1`;
      
      lastRequestTime = Date.now();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'NoteworthyNewsBot/1.0 (contact: contact@noteworthynews.co)'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        // On 403/429, serve cached data if available
        if (response.status === 403 || response.status === 429) {
          console.warn(`[Geocode Proxy] Blocked/rate limited for "${query}", serving cached data`);
          if (cached) {
            return cached.data;
          }
        }
        throw new Error(`Nominatim HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      let result = null;
      if (data && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        
        // Determine precision
        let precision = 'unknown';
        if (item.address) {
          if (item.address.city || item.address.town || item.address.village) {
            precision = 'city';
          } else if (item.address.state || item.address.region) {
            precision = 'region';
          } else if (item.address.country) {
            precision = 'country';
          }
        }
        
        result = {
          query: query,
          lat: lat,
          lon: lon,
          displayName: item.display_name || query,
          importance: item.importance || 0,
          precision: precision,
          fetchedAt: new Date().toISOString()
        };
      } else {
        // No results - cache null to avoid re-querying
        result = {
          query: query,
          lat: null,
          lon: null,
          displayName: null,
          importance: 0,
          precision: 'unknown',
          fetchedAt: new Date().toISOString()
        };
      }
      
      // Cache result
      cache.set(cacheKey, {
        data: result,
        fetchedAt: Date.now()
      });
      
      return result;
    } catch (error) {
      // On error, serve cached data if available
      if (cached) {
        console.warn(`[Geocode Proxy] Error for "${query}", serving cached data:`, error.message);
        return cached.data;
      }
      throw error;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();
  
  inFlight.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Main handler
 */
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  
  // Handle OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }
  
  // Only allow GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  try {
    const { q } = event.queryStringParameters || {};
    
    if (!q) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing q parameter' })
      };
    }
    
    const decodedQuery = decodeURIComponent(q);
    
    // Validate query
    if (!validateQuery(decodedQuery)) {
      return {
        statusCode: 200, // Return 200 with null result (don't error)
        headers,
        body: JSON.stringify({
          query: decodedQuery,
          lat: null,
          lon: null,
          displayName: null,
          importance: 0,
          precision: 'unknown',
          error: 'Query validation failed',
          fetchedAt: new Date().toISOString()
        })
      };
    }
    
    const result = await fetchNominatim(decodedQuery);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('[Geocode Proxy] Handler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Internal server error'
      })
    };
  }
};
