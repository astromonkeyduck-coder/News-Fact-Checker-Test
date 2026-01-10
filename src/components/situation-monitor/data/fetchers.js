/**
 * Data Fetchers with Caching and Retry Logic
 */

// Memory cache
const memoryCache = new Map();
const CACHE_TTL = {
  news: 2 * 60 * 1000, // 2 minutes
  weather: 5 * 60 * 1000, // 5 minutes
  earthquakes: 1 * 60 * 1000, // 1 minute
  markets: 30 * 1000, // 30 seconds
  flights: 2 * 60 * 1000 // 2 minutes
};

// localStorage cache key prefix
const STORAGE_PREFIX = 'sitmon_';

/**
 * Get cached data (memory or localStorage)
 */
function getCached(key, type) {
  // Check memory cache first
  const memEntry = memoryCache.get(key);
  if (memEntry && Date.now() - memEntry.timestamp < CACHE_TTL[type]) {
    return memEntry.data;
  }

  // Check localStorage
  try {
    const stored = localStorage.getItem(STORAGE_PREFIX + key);
    if (stored) {
      const entry = JSON.parse(stored);
      if (Date.now() - entry.timestamp < CACHE_TTL[type]) {
        // Update memory cache
        memoryCache.set(key, entry);
        return entry.data;
      }
    }
  } catch (e) {
    console.warn('[Fetcher] localStorage read error:', e);
  }

  return null;
}

/**
 * Set cached data (memory and localStorage)
 */
function setCached(key, data, type) {
  const entry = {
    data,
    timestamp: Date.now()
  };
  memoryCache.set(key, entry);

  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch (e) {
    console.warn('[Fetcher] localStorage write error:', e);
    // Clear old entries if storage is full
    try {
      const keys = Object.keys(localStorage);
      const oldKeys = keys.filter(k => k.startsWith(STORAGE_PREFIX));
      if (oldKeys.length > 50) {
        // Remove oldest 10
        oldKeys.sort((a, b) => {
          const aData = JSON.parse(localStorage.getItem(a));
          const bData = JSON.parse(localStorage.getItem(b));
          return aData.timestamp - bData.timestamp;
        });
        oldKeys.slice(0, 10).forEach(k => localStorage.removeItem(k));
      }
    } catch (e2) {
      console.warn('[Fetcher] Cache cleanup error:', e2);
    }
  }
}

/**
 * Retry with exponential backoff
 */
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': 'Noteworthy-News-Situation-Monitor/1.0',
          ...options.headers
        }
      });

      if (response.ok) {
        return response;
      }

      // Don't retry on 4xx errors (except 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }

    // Exponential backoff: 1s, 2s, 4s
    if (attempt < maxRetries - 1) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Fetch RSS feed with caching
 */
export async function fetchRSSFeed(feedUrl, feedName) {
  const cacheKey = `rss_${feedName}_${feedUrl}`;
  const cached = getCached(cacheKey, 'news');
  if (cached) {
    return cached;
  }

  try {
    // Try direct fetch first
    const response = await fetchWithRetry(feedUrl);
    const text = await response.text();
    
    const result = {
      url: feedUrl,
      name: feedName,
      content: text,
      fetchedAt: new Date().toISOString()
    };

    setCached(cacheKey, result, 'news');
    return result;
  } catch (error) {
    console.warn(`[Fetcher] RSS fetch failed for ${feedName}:`, error);
    
    // Return cached data even if expired
    const expired = getCached(cacheKey, 'news');
    if (expired) {
      console.log(`[Fetcher] Using expired cache for ${feedName}`);
      return expired;
    }

    throw error;
  }
}

/**
 * Fetch JSON API with caching
 */
export async function fetchJSON(url, cacheKey, type = 'news', options = {}) {
  const cached = getCached(cacheKey, type);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetchWithRetry(url, options);
    const data = await response.json();
    
    setCached(cacheKey, data, type);
    return data;
  } catch (error) {
    console.warn(`[Fetcher] JSON fetch failed for ${cacheKey}:`, error);
    
    // Return expired cache if available
    const expired = getCached(cacheKey, type);
    if (expired) {
      console.log(`[Fetcher] Using expired cache for ${cacheKey}`);
      return expired;
    }

    throw error;
  }
}

/**
 * Fetch weather data
 */
export async function fetchWeather(lat, lon) {
  const cacheKey = `weather_${lat}_${lon}`;
  
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m`;
    return await fetchJSON(url, cacheKey, 'weather');
  } catch (error) {
    console.warn('[Fetcher] Weather fetch failed:', error);
    return null;
  }
}

/**
 * Fetch weather alerts (US only)
 */
export async function fetchWeatherAlerts() {
  const cacheKey = 'weather_alerts_us';
  
  try {
    const url = 'https://api.weather.gov/alerts/active';
    return await fetchJSON(url, cacheKey, 'weather', {
      headers: {
        'User-Agent': 'Noteworthy-News-Situation-Monitor/1.0 (contact@noteworthynews.co)'
      }
    });
  } catch (error) {
    console.warn('[Fetcher] Weather alerts fetch failed:', error);
    return null;
  }
}

/**
 * Fetch earthquakes
 */
export async function fetchEarthquakes(minMagnitude = 4.5) {
  const cacheKey = `earthquakes_${minMagnitude}`;
  
  try {
    const url = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${minMagnitude}_day.geojson`;
    return await fetchJSON(url, cacheKey, 'earthquakes');
  } catch (error) {
    console.warn('[Fetcher] Earthquake fetch failed:', error);
    return null;
  }
}

/**
 * Fetch crypto markets
 */
export async function fetchMarkets() {
  const cacheKey = 'markets_crypto';
  
  try {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true';
    return await fetchJSON(url, cacheKey, 'markets');
  } catch (error) {
    console.warn('[Fetcher] Markets fetch failed:', error);
    return null;
  }
}

/**
 * Fetch flights (best effort, may fail due to CORS)
 */
export async function fetchFlights() {
  const cacheKey = 'flights_opensky';
  
  try {
    const url = 'https://opensky-network.org/api/states/all';
    return await fetchJSON(url, cacheKey, 'flights');
  } catch (error) {
    console.warn('[Fetcher] Flights fetch failed (expected if CORS blocked):', error);
    return null;
  }
}

/**
 * Clear all caches
 */
export function clearCache() {
  memoryCache.clear();
  try {
    const keys = Object.keys(localStorage);
    keys.filter(k => k.startsWith(STORAGE_PREFIX)).forEach(k => localStorage.removeItem(k));
  } catch (e) {
    console.warn('[Fetcher] Cache clear error:', e);
  }
}
