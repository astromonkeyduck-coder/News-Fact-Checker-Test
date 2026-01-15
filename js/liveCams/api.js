/**
 * Live Cams API Client
 * 
 * SECURITY NOTE: All requests include X-CAMS-TOKEN header
 * Token is fetched from /api/cams-token endpoint (server-side only)
 * Never log or expose the token in console or source code
 */

let abortController = null;
let camsToken = null;

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
 * Search cameras
 */
export async function searchCameras(filters, signal = null) {
  const params = new URLSearchParams();
  
  if (filters.q) params.set('q', filters.q);
  if (filters.country) params.set('country', filters.country);
  if (filters.state) params.set('state', filters.state);
  if (filters.city) params.set('city', filters.city);
  if (filters.bbox) params.set('bbox', filters.bbox);
  if (filters.type && filters.type !== 'any') params.set('type', filters.type);
  if (filters.media && filters.media !== 'any') params.set('media', filters.media);
  params.set('limit', '200');
  
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
    
    console.log('[LiveCams API] Searching cameras with URL:', url);
    console.log('[LiveCams API] Filters:', filters);
    
    const response = await fetch(url, {
      signal: signal || abortController?.signal,
      headers
    });
    
    console.log('[LiveCams API] Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('[LiveCams API] Search failed:', response.status, errorText);
      throw new Error(`Search failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('[LiveCams API] Response data:', { 
      resultCount: data.results?.length || 0,
      hasResults: !!data.results,
      error: data.error,
      fullResponse: data // Log full response for debugging
    });
    
    if (data.error) {
      console.error('[LiveCams API] API returned error:', data.error);
    }
    
    // Check if results is actually an array
    if (!Array.isArray(data.results)) {
      console.error('[LiveCams API] Results is not an array:', typeof data.results, data.results);
      return [];
    }
    
    return data.results || [];
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Search cancelled');
    }
    throw error;
  }
}

/**
 * Get image proxy URL
 * Note: Actual token is added by the proxy endpoint or via fetch headers
 */
export function getImageProxyUrl(imageUrl) {
  if (!imageUrl) return null;
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
 * Load an image into an <img> element using the proxy with auth headers.
 * Uses a Blob URL to avoid CORS issues and allows header-based auth.
 */
export async function loadImageWithAuth(imgEl, proxyUrl, fallbackUrl = null, { cacheBust = false } = {}) {
  if (!imgEl || !proxyUrl) return;
  
  const requestUrl = cacheBust ? addCacheBust(proxyUrl) : proxyUrl;
  
  // Revoke previous object URL to avoid leaks
  if (imgEl.dataset.objectUrl) {
    URL.revokeObjectURL(imgEl.dataset.objectUrl);
    delete imgEl.dataset.objectUrl;
  }
  
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
      imgEl.src = cacheBust ? addCacheBust(fallbackUrl) : fallbackUrl;
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
