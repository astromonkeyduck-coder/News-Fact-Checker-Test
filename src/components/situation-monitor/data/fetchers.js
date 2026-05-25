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
 * Get cached data even if expired (for fallback when fetch fails)
 */
function getExpiredCache(key) {
  // Check memory cache first (even if expired)
  const memEntry = memoryCache.get(key);
  if (memEntry) {
    return memEntry.data;
  }

  // Check localStorage (even if expired)
  try {
    const stored = localStorage.getItem(STORAGE_PREFIX + key);
    if (stored) {
      const entry = JSON.parse(stored);
      return entry.data;
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

// Single-flight pattern: track in-flight requests
const inFlightRequests = new Map();

/**
 * Fetch RSS feed via Netlify Function (server-side proxy)
 */
export async function fetchRSSFeed(feedId, feedName) {
  const cacheKey = `rss_${feedId}`;
  const cached = getCached(cacheKey, 'news');
  if (cached) {
    return cached;
  }

  // Single-flight: if request already in progress, return same promise
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const fetchPromise = (async () => {
    try {
      // Use Netlify Function proxy to avoid CORS
      const response = await fetchWithRetry(`/.netlify/functions/rssProxy?source=${encodeURIComponent(feedId)}`);
      
      if (!response.ok) {
        throw new Error(`RSS Proxy HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      // Transform to expected format
      const result = {
        url: data.source?.feedUrl || '',
        name: data.source?.name || feedName,
        content: '', // Not needed - items are already parsed
        items: data.items || [],
        fetchedAt: data.fetchedAt || new Date().toISOString()
      };

      setCached(cacheKey, result, 'news');
      return result;
    } catch (error) {
      console.warn(`[Fetcher] RSS fetch failed for ${feedName}:`, error);
      
      // Return cached data even if expired (for offline/failure resilience)
      const expired = getExpiredCache(cacheKey);
      if (expired) {
        console.log(`[Fetcher] Using expired cache for ${feedName}`);
        return expired;
      }

      throw error;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
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
    
    // Return expired cache if available (for offline/failure resilience)
    const expired = getExpiredCache(cacheKey);
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
 * Fetch weather alerts (US only) via Netlify Function proxy
 */
export async function fetchWeatherAlerts() {
  const cacheKey = 'weather_alerts_us';
  const cached = getCached(cacheKey, 'weather');
  if (cached) {
    return cached;
  }

  // Single-flight: if request already in progress, return same promise
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const fetchPromise = (async () => {
    try {
      // Use Netlify Function proxy to avoid CORS
      const response = await fetchWithRetry(`/.netlify/functions/weatherProxy?type=alerts`);
      
      if (!response.ok) {
        throw new Error(`Weather Proxy HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setCached(cacheKey, data, 'weather');
      return data;
    } catch (error) {
      console.warn('[Fetcher] Weather alerts fetch failed:', error);
      
      // Return expired cache if available
      const expired = getExpiredCache(cacheKey);
      if (expired) {
        console.log(`[Fetcher] Using expired cache for weather alerts`);
        return expired;
      }
      
      return null;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Fetch earthquakes
 */
export async function fetchEarthquakes(minMagnitude = 6.0) {
  const cacheKey = `earthquakes_${minMagnitude}`;
  
  try {
    // Try to fetch from our verified events API first (has more data)
    const baseUrl = window.location.origin || 'https://noteworthynews.co';
    const verifiedUrl = `${baseUrl}/.netlify/functions/get-verified-earthquakes?minMagnitude=${minMagnitude}&limit=50`;
    
    try {
      const verifiedResponse = await fetch(verifiedUrl);
      if (verifiedResponse.ok) {
        const verifiedData = await verifiedResponse.json();
        if (verifiedData.success && verifiedData.earthquakes && verifiedData.earthquakes.length > 0) {
          // Transform to GeoJSON format for compatibility
          const geoJson = {
            type: 'FeatureCollection',
            features: verifiedData.earthquakes.map(eq => ({
              type: 'Feature',
              id: eq.id,
              properties: {
                mag: eq.magnitude,
                place: eq.place,
                time: eq.time_ms || new Date(eq.time).getTime(),
                updated: eq.updated ? new Date(eq.updated).getTime() : eq.time_ms,
                url: eq.url,
                // Include additional data
                severity: eq.severity,
                image_url: eq.image_url,
                video_url: eq.video_url,
                assets: eq.assets,
                impact_assessment: eq.impact_assessment,
                tsunami_risk: eq.tsunami_risk,
                aftershock_forecast: eq.aftershock_forecast,
                anomaly_detection: eq.anomaly_detection,
                title: eq.title,
                summary: eq.summary,
                canonical_id: eq.canonical_id
              },
              geometry: {
                type: 'Point',
                coordinates: [eq.lon || 0, eq.lat || 0, eq.depth || 0]
              }
            }))
          };
          
          // Cache the result
          setCached(cacheKey, geoJson, 'earthquakes');
          return geoJson;
        }
      }
    } catch (verifiedError) {
      console.warn('[Fetcher] Verified earthquakes fetch failed, falling back to USGS:', verifiedError);
    }
    
    // Fallback to USGS feed
    const url = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${minMagnitude}_day.geojson`;
    return await fetchJSON(url, cacheKey, 'earthquakes');
  } catch (error) {
    console.warn('[Fetcher] Earthquake fetch failed:', error);
    return null;
  }
}

/**
 * Fetch crypto markets via Netlify Function (server-side proxy)
 */
export async function fetchMarkets() {
  const cacheKey = 'markets_crypto';
  const cached = getCached(cacheKey, 'markets');
  if (cached) {
    return cached;
  }

  // Single-flight: if request already in progress, return same promise
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const fetchPromise = (async () => {
    try {
      // Use Netlify Function proxy to avoid CORS
      const response = await fetchWithRetry(`/.netlify/functions/marketsProxy?source=crypto_simple_price`);
      
      if (!response.ok) {
        throw new Error(`Markets Proxy HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setCached(cacheKey, data, 'markets');
      return data;
    } catch (error) {
      console.warn('[Fetcher] Markets fetch failed:', error);
      
      // Return expired cache if available
      const expired = getExpiredCache(cacheKey);
      if (expired) {
        console.log(`[Fetcher] Using expired cache for markets`);
        return expired;
      }
      
      return null;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
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
