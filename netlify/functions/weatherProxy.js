/**
 * Weather Proxy - Server-side weather data fetcher
 * GET /.netlify/functions/weatherProxy?type=alerts
 * 
 * Fetches weather data server-side to avoid CORS.
 */

// In-memory cache (TTL: 5 minutes)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch US weather alerts from weather.gov
 */
async function fetchWeatherAlerts() {
  const cacheKey = 'weather_alerts_us';
  const cached = cache.get(cacheKey);
  
  if (cached && (Date.now() - cached.fetchedAt < CACHE_TTL)) {
    return cached.data;
  }
  
  try {
    const url = 'https://api.weather.gov/alerts/active';
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Noteworthy-News-Situation-Monitor/1.0 (contact@noteworthynews.co)',
        'Accept': 'application/geo+json'
      }
    });
    
    if (!response.ok) {
      // On error, serve cached data if available
      if (cached) {
        console.warn('[Weather Proxy] Error fetching, serving cached data');
        return cached.data;
      }
      throw new Error(`Weather.gov HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    // Cache result
    cache.set(cacheKey, {
      data: data,
      fetchedAt: Date.now()
    });
    
    return data;
  } catch (error) {
    // On error, serve cached data if available
    if (cached) {
      console.warn('[Weather Proxy] Error fetching, serving cached data:', error.message);
      return cached.data;
    }
    throw error;
  }
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
    const { type } = event.queryStringParameters || {};
    
    if (type === 'alerts') {
      const result = await fetchWeatherAlerts();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result)
      };
    }
    
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: `Unknown type: ${type || 'missing'}. Use ?type=alerts` })
    };
  } catch (error) {
    console.error('[Weather Proxy] Handler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Internal server error'
      })
    };
  }
};
