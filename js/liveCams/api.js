/**
 * Live Cams API Client
 * 
 * Features:
 * - Tries Netlify functions first
 * - Falls back to direct DOT API calls when Netlify is unavailable
 * - Caches results in localStorage with TTL
 * 
 * SECURITY NOTE: All requests include X-CAMS-TOKEN header
 * Token is fetched from /api/cams-token endpoint (server-side only)
 * Never log or expose the token in console or source code
 */

import { fetchFallbackCameras, shouldUseFallback, getCuratedCameras } from './fallback-providers/index.js';

let abortController = null;
let camsToken = null;
let useFallbackMode = null; // null = unknown, true = use fallback, false = use Netlify

// Cache configuration — bump CACHE_VERSION to invalidate old cache (thumbnails + more cams fix)
const CACHE_KEY = 'livecams_cache';
const CACHE_VERSION_KEY = 'livecams_cache_version';
const CACHE_VERSION = 2;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get CAMS_TOKEN from server (cached)
 * Token is never logged or exposed
 */
async function getCamsToken() {
  if (camsToken) {
    return camsToken;
  }
  
  try {
    const response = await fetch('/api/cams-token', {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      camsToken = data.token;
      return camsToken;
    } else {
      // If token endpoint returns error, log it but continue (development mode allows requests without token)
      console.warn('[LiveCams API] CAMS_TOKEN endpoint returned:', response.status, response.statusText);
      console.warn('[LiveCams API] Continuing without token (development mode)');
    }
  } catch (error) {
    console.warn('[LiveCams API] Failed to fetch CAMS_TOKEN (continuing without token):', error.message);
    // Don't throw - allow requests to proceed without token (development mode)
  }
  
  return null;
}

/**
 * Get cached results if still valid and cache version matches
 */
function getCachedResults(cacheKey) {
  try {
    const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
    if (storedVersion !== String(CACHE_VERSION)) {
      localStorage.removeItem(CACHE_KEY);
      localStorage.setItem(CACHE_VERSION_KEY, String(CACHE_VERSION));
      return null;
    }
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const data = JSON.parse(cached);
    const entry = data[cacheKey];
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      return null; // Cache expired
    }
    console.log('[LiveCams API] Using cached results:', entry.results.length, 'cameras');
    return entry.results;
  } catch (err) {
    console.warn('[LiveCams API] Cache read error:', err);
    return null;
  }
}

/**
 * Save results to cache
 */
function setCachedResults(cacheKey, results) {
  try {
    let data = {};
    try {
      const existing = localStorage.getItem(CACHE_KEY);
      if (existing) data = JSON.parse(existing);
    } catch {}
    
    data[cacheKey] = {
      results,
      timestamp: Date.now()
    };
    
    // Keep only last 5 cache entries to avoid storage bloat
    const keys = Object.keys(data);
    if (keys.length > 5) {
      const oldest = keys.sort((a, b) => data[a].timestamp - data[b].timestamp)[0];
      delete data[oldest];
    }
    
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('[LiveCams API] Cache write error:', err);
  }
}

/**
 * Search cameras - tries Netlify first, falls back to direct DOT APIs
 */
export async function searchCameras(filters, signal = null) {
  const cacheKey = JSON.stringify(filters);
  
  // Determine fallback mode BEFORE cache check so image loading uses the correct mode
  // (when cache hit we return early and never set useFallbackMode otherwise)
  if (useFallbackMode === null) {
    useFallbackMode = await shouldUseFallback();
    console.log('[LiveCams API] Fallback mode:', useFallbackMode ? 'ENABLED (using direct DOT APIs)' : 'DISABLED (using Netlify)');
  }
  
  const cached = getCachedResults(cacheKey);
  if (cached) {
    return cached;
  }
  
  // If in fallback mode, go directly to fallback providers
  if (useFallbackMode) {
    console.log('[LiveCams API] Using fallback providers (direct DOT APIs)');
    try {
      const results = await fetchFallbackCameras(filters);
      setCachedResults(cacheKey, results);
      return results;
    } catch (error) {
      console.error('[LiveCams API] Fallback search failed:', error);
      const curated = getCuratedCameras();
      setCachedResults(cacheKey, curated);
      return curated;
    }
  }
  
  // Try Netlify function first
  const params = new URLSearchParams();
  
  if (filters.q) params.set('q', filters.q);
  if (filters.country) params.set('country', filters.country);
  if (filters.state) params.set('state', filters.state);
  if (filters.city) params.set('city', filters.city);
  if (filters.bbox) params.set('bbox', filters.bbox);
  if (filters.type && filters.type !== 'any') params.set('type', filters.type);
  if (filters.media && filters.media !== 'any') params.set('media', filters.media);
  params.set('limit', '400');
  
  const url = `/api/cams/search?${params.toString()}`;
  
  // Get token (never log it)
  const token = await getCamsToken();
  
  try {
    const headers = {
      'Accept': 'application/json'
    };
    
    // Add token header if available
    if (token) {
      headers['X-CAMS-TOKEN'] = token;
    }
    
    console.log('[LiveCams API] Searching cameras via Netlify:', url);
    
    const response = await fetch(url, {
      signal: signal || abortController?.signal,
      headers
    });
    
    // If Netlify returns 404, switch to fallback mode
    if (response.status === 404) {
      console.warn('[LiveCams API] Netlify function not found (404), switching to fallback mode');
      useFallbackMode = true;
      const results = await fetchFallbackCameras(filters);
      setCachedResults(cacheKey, results);
      return results;
    }
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('[LiveCams API] Search failed:', response.status, errorText);
      
      // Try fallback on any error
      console.log('[LiveCams API] Trying fallback providers after Netlify error...');
      const fallbackResults = await fetchFallbackCameras(filters).catch(() => getCuratedCameras());
      const results = fallbackResults.length > 0 ? fallbackResults : getCuratedCameras();
      setCachedResults(cacheKey, results);
      return results;
    }
    
    const data = await response.json();
    console.log('[LiveCams API] Netlify response:', data.results?.length || 0, 'cameras');
    
    if (data.error) {
      console.error('[LiveCams API] API returned error:', data.error);
    }
    
    // Check if results is actually an array
    if (!Array.isArray(data.results)) {
      console.error('[LiveCams API] Results is not an array, using fallback');
      const fallbackResults = await fetchFallbackCameras(filters);
      setCachedResults(cacheKey, fallbackResults);
      return fallbackResults;
    }
    
    let results = data.results || [];
    // If Netlify returned no (or very few) cameras for a broad search, merge in fallback so we always show something
    const isBroadSearch = !filters.q && !filters.city && !filters.bbox;
    if (results.length < 15 && isBroadSearch) {
      console.log('[LiveCams API] Netlify returned few cameras for broad search, merging fallback providers');
      try {
        const fallbackResults = await fetchFallbackCameras(filters);
        const seen = new Set(results.map(c => c.id));
        for (const cam of fallbackResults) {
          if (!seen.has(cam.id)) {
            seen.add(cam.id);
            results.push(cam);
          }
        }
        console.log('[LiveCams API] After merge:', results.length, 'cameras');
      } catch (mergeErr) {
        console.warn('[LiveCams API] Fallback merge failed:', mergeErr.message);
      }
    }
    setCachedResults(cacheKey, results);
    return results;
    
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Search cancelled');
    }
    
    // On network errors, try fallback
    console.warn('[LiveCams API] Network error, trying fallback:', error.message);
    useFallbackMode = true;
    try {
      const fallbackResults = await fetchFallbackCameras(filters);
      setCachedResults(cacheKey, fallbackResults);
      return fallbackResults;
    } catch (fallbackError) {
      console.error('[LiveCams API] Fallback also failed:', fallbackError);
      const curated = getCuratedCameras();
      setCachedResults(cacheKey, curated);
      return curated;
    }
  }
}

/**
 * Force fallback mode (useful for testing)
 */
export function setFallbackMode(enabled) {
  useFallbackMode = enabled;
  console.log('[LiveCams API] Fallback mode manually set to:', enabled);
}

/**
 * Clear cache
 */
export function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.setItem(CACHE_VERSION_KEY, String(CACHE_VERSION));
    console.log('[LiveCams API] Cache cleared');
  } catch {}
}

// Hosts that typically allow CORS for images (DOT/ArcGIS); use direct load in fallback mode
const CORS_SAFE_IMAGE_HOSTS = [
  'arcgis.com',
  'dot.ca.gov',
  'cwwp2.dot.ca.gov',
  'txdot.gov',
  'its.txdot.gov',
  'wydot.info',
  'wyoroad.info',
  'fl511.com'
];

function isCorsSafeImageHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return CORS_SAFE_IMAGE_HOSTS.some(h => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
}

/**
 * Get image proxy URL
 * In fallback mode, use direct URL only for CORS-safe hosts (DOT/ArcGIS); otherwise use proxy so curated cams (e.g. EarthCam) work when proxy is available.
 */
export function getImageProxyUrl(imageUrl) {
  if (!imageUrl) return null;
  
  if (useFallbackMode && isCorsSafeImageHost(imageUrl)) {
    return imageUrl;
  }
  
  return `/api/cams/proxy-image?url=${encodeURIComponent(imageUrl)}`;
}

function addCacheBust(url) {
  if (!url) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_t=${Date.now()}`;
}

/**
 * Fetch image with CAMS_TOKEN header
 * Used for images that require authentication
 */
export async function fetchImageWithAuth(imageUrl) {
  const token = await getCamsToken();
  const headers = {};
  
  if (token) {
    headers['X-CAMS-TOKEN'] = token;
  }
  
  return fetch(imageUrl, { headers });
}

/**
 * Load an image into an <img> element.
 * In fallback mode, loads directly. Otherwise uses proxy with auth headers.
 */
export async function loadImageWithAuth(imgEl, proxyUrl, fallbackUrl = null, { cacheBust = false } = {}) {
  if (!imgEl || !proxyUrl) return;
  
  const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 150'%3E%3Crect fill='%23111' width='200' height='150'/%3E%3Ctext fill='%23555' x='50%25' y='50%25' text-anchor='middle' dy='.3em' font-size='14'%3ENo Image%3C/text%3E%3C/svg%3E";
  
  // Revoke previous object URL to avoid leaks
  if (imgEl.dataset.objectUrl) {
    URL.revokeObjectURL(imgEl.dataset.objectUrl);
    delete imgEl.dataset.objectUrl;
  }
  
  // In fallback mode: use direct image URL so thumbnails work without proxy.
  // If proxyUrl is our proxy endpoint (e.g. /api/cams/proxy-image), proxy may 404 when not on Netlify — use fallbackUrl (direct) so DOT images still load.
  if (useFallbackMode) {
    const isProxyEndpoint = typeof proxyUrl === 'string' && proxyUrl.includes('proxy-image');
    const urlToLoad = (isProxyEndpoint && fallbackUrl) ? fallbackUrl : proxyUrl;
    const directUrl = cacheBust ? addCacheBust(urlToLoad) : urlToLoad;
    imgEl.onerror = () => {
      if (fallbackUrl && urlToLoad !== fallbackUrl) {
        imgEl.src = cacheBust ? addCacheBust(fallbackUrl) : fallbackUrl;
        imgEl.onerror = () => {
          imgEl.src = placeholder;
          imgEl.onerror = null;
        };
      } else {
        imgEl.src = placeholder;
      }
      imgEl.onerror = null;
    };
    imgEl.src = directUrl;
    imgEl.dataset.loaded = 'true';
    return;
  }
  
  // Use proxy with auth headers
  const requestUrl = cacheBust ? addCacheBust(proxyUrl) : proxyUrl;
  
  try {
    const response = await fetchImageWithAuth(requestUrl);
    if (!response.ok) {
      throw new Error(`Image fetch failed: ${response.status}`);
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    imgEl.dataset.objectUrl = objectUrl;
    imgEl.src = objectUrl;
    imgEl.dataset.loaded = 'true';
  } catch (error) {
    if (fallbackUrl) {
      imgEl.onerror = () => {
        imgEl.src = placeholder;
        imgEl.onerror = null;
      };
      imgEl.src = cacheBust ? addCacheBust(fallbackUrl) : fallbackUrl;
    } else {
      imgEl.src = placeholder;
    }
  }
}

/**
 * Geocode a location (city/address) to bbox
 */
export async function geocodeLocation(query) {
  try {
    // Use Nominatim (OpenStreetMap) for geocoding
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'NoteworthyNews/1.0',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Geocoding failed');
    }
    
    const data = await response.json();
    if (data.length === 0) {
      return null;
    }
    
    const result = data[0];
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    
    // Create bbox (0.1 degree ~= 11km)
    const padding = 0.05;
    return `${lon - padding},${lat - padding},${lon + padding},${lat + padding}`;
  } catch (error) {
    console.error('[geocodeLocation] Error:', error);
    return null;
  }
}

/**
 * Cancel current search
 */
export function cancelSearch() {
  if (abortController) {
    abortController.abort();
  }
  abortController = new AbortController();
}

/**
 * Create new abort controller for search
 */
export function createSearchSignal() {
  cancelSearch();
  return abortController.signal;
}
