/**
 * Markets Proxy - Server-side market data fetcher
 * GET /.netlify/functions/marketsProxy?source=crypto_simple_price
 * 
 * Fetches market data server-side to avoid CORS and rate limits.
 */

// In-memory cache (TTL: 60 seconds)
const cache = new Map();
const CACHE_TTL = 60 * 1000; // 60 seconds

// Single-flight pattern: track in-flight requests
const inFlight = new Map();

/**
 * Fetch CoinGecko crypto prices
 */
async function fetchCryptoPrices() {
  const cacheKey = 'crypto_simple_price';
  const cached = cache.get(cacheKey);
  
  if (cached && (Date.now() - cached.fetchedAt < CACHE_TTL)) {
    return cached.data;
  }
  
  // Check if request already in flight
  if (inFlight.has(cacheKey)) {
    return inFlight.get(cacheKey);
  }
  
  // Create promise for single-flight
  const fetchPromise = (async () => {
    try {
      const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true';
      
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
        // On 429, serve cached data if available
        if (response.status === 429) {
          console.warn('[Markets Proxy] Rate limited, serving cached data');
          if (cached) {
            return cached.data;
          }
        }
        throw new Error(`CoinGecko HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      const result = {
        bitcoin: data.bitcoin || null,
        ethereum: data.ethereum || null,
        solana: data.solana || null,
        fetchedAt: new Date().toISOString()
      };
      
      // Cache result
      cache.set(cacheKey, {
        data: result,
        fetchedAt: Date.now()
      });
      
      return result;
    } catch (error) {
      // On error, serve cached data if available
      if (cached) {
        console.warn('[Markets Proxy] Error fetching, serving cached data:', error.message);
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
    const { source } = event.queryStringParameters || {};
    
    if (source === 'crypto_simple_price') {
      const result = await fetchCryptoPrices();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result)
      };
    }
    
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: `Unknown source: ${source}` })
    };
  } catch (error) {
    console.error('[Markets Proxy] Handler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Internal server error'
      })
    };
  }
};
