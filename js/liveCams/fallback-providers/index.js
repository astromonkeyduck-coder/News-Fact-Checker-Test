/**
 * Fallback Providers Index
 * Aggregates all direct DOT API clients that work without Netlify functions
 */

import { fetchFL511Direct } from './fl511.js';
import { fetchCaltransirect, fetchCaltransLA } from './caltrans.js';
import { fetchTxDOTDirect } from './txdot.js';
import { fetchWYDOTDirect } from './wydot.js';

// Curated fallback cameras for when all APIs fail
const CURATED_CAMERAS = [
  {
    id: 'earthcam-times-square',
    provider: 'earthcam',
    title: 'Times Square - NYC',
    lat: 40.758,
    lon: -73.9855,
    country: 'US',
    region1: 'NY',
    city: 'New York',
    type: 'city_street',
    status: 'online',
    tags: ['nyc', 'times-square', 'earthcam'],
    media: {
      snapshotUrl: 'https://www.earthcam.com/cams/usa/newyork/timessquare/images/current1.jpg',
      streamUrl: null,
      mode: 'snapshot',
      providerPageUrl: 'https://www.earthcam.com/usa/newyork/timessquare/'
    },
    refreshSec: 60
  },
  {
    id: 'earthcam-bourbon',
    provider: 'earthcam',
    title: 'Bourbon Street - New Orleans',
    lat: 29.9584,
    lon: -90.0654,
    country: 'US',
    region1: 'LA',
    city: 'New Orleans',
    type: 'city_street',
    status: 'online',
    tags: ['nola', 'bourbon-street', 'earthcam'],
    media: {
      snapshotUrl: 'https://www.earthcam.com/cams/usa/louisiana/neworleans/bourbonstreet/images/current1.jpg',
      streamUrl: null,
      mode: 'snapshot',
      providerPageUrl: 'https://www.earthcam.com/usa/louisiana/neworleans/bourbonstreet/'
    },
    refreshSec: 60
  },
  {
    id: 'earthcam-abbey-road',
    provider: 'earthcam',
    title: 'Abbey Road Crossing - London',
    lat: 51.5320,
    lon: -0.1782,
    country: 'GB',
    region1: 'England',
    city: 'London',
    type: 'city_street',
    status: 'online',
    tags: ['london', 'abbey-road', 'beatles', 'earthcam'],
    media: {
      snapshotUrl: 'https://www.earthcam.com/cams/england/london/abbeyroad/images/current1.jpg',
      streamUrl: null,
      mode: 'snapshot',
      providerPageUrl: 'https://www.earthcam.com/world/england/london/abbeyroad/'
    },
    refreshSec: 60
  },
  {
    id: 'earthcam-dublin',
    provider: 'earthcam',
    title: "Temple Bar - Dublin",
    lat: 53.3456,
    lon: -6.2639,
    country: 'IE',
    region1: 'Dublin',
    city: 'Dublin',
    type: 'city_street',
    status: 'online',
    tags: ['dublin', 'ireland', 'temple-bar', 'earthcam'],
    media: {
      snapshotUrl: 'https://www.earthcam.com/cams/ireland/dublin/templebar/images/current1.jpg',
      streamUrl: null,
      mode: 'snapshot',
      providerPageUrl: 'https://www.earthcam.com/world/ireland/dublin/'
    },
    refreshSec: 60
  }
];

/**
 * Fetch cameras from all fallback providers
 * @param {Object} params - Search params (bbox, country, state, etc.)
 * @returns {Promise<Camera[]>}
 */
export async function fetchFallbackCameras(params = {}) {
  console.log('[Fallback Providers] Fetching from direct DOT APIs...', params);
  
  const results = [];
  const errors = [];
  
  // Determine which providers to fetch based on params
  const fetchPromises = [];
  
  // FL511 - if searching US or FL specifically
  if (!params.country || params.country === 'US') {
    if (!params.state || params.state === 'FL') {
      fetchPromises.push(
        fetchFL511Direct(params)
          .then(cameras => {
            console.log(`[Fallback] FL511: ${cameras.length} cameras`);
            results.push(...cameras);
          })
          .catch(err => {
            errors.push({ provider: 'fl511', error: err.message });
          })
      );
    }
  }
  
  // Caltrans - if searching US or CA specifically
  if (!params.country || params.country === 'US') {
    if (!params.state || params.state === 'CA') {
      fetchPromises.push(
        fetchCaltransirect(params)
          .then(cameras => {
            console.log(`[Fallback] Caltrans: ${cameras.length} cameras`);
            results.push(...cameras);
          })
          .catch(err => {
            errors.push({ provider: 'caltrans', error: err.message });
          })
      );
    }
  }
  
  // TxDOT - if searching US or TX specifically
  if (!params.country || params.country === 'US') {
    if (!params.state || params.state === 'TX') {
      fetchPromises.push(
        fetchTxDOTDirect(params)
          .then(cameras => {
            console.log(`[Fallback] TxDOT: ${cameras.length} cameras`);
            results.push(...cameras);
          })
          .catch(err => {
            errors.push({ provider: 'txdot', error: err.message });
          })
      );
    }
  }
  
  // WYDOT - if searching US or WY specifically
  if (!params.country || params.country === 'US') {
    if (!params.state || params.state === 'WY') {
      fetchPromises.push(
        fetchWYDOTDirect(params)
          .then(cameras => {
            console.log(`[Fallback] WYDOT: ${cameras.length} cameras`);
            results.push(...cameras);
          })
          .catch(err => {
            errors.push({ provider: 'wydot', error: err.message });
          })
      );
    }
  }
  
  // Wait for all providers
  await Promise.allSettled(fetchPromises);
  
  // Always add curated cameras for variety
  results.push(...CURATED_CAMERAS);
  
  // Log any errors
  if (errors.length > 0) {
    console.warn('[Fallback Providers] Errors:', errors);
  }
  
  console.log(`[Fallback Providers] Total cameras: ${results.length}`);
  return results;
}

/**
 * Get just curated cameras (for testing/demos)
 */
export function getCuratedCameras() {
  return [...CURATED_CAMERAS];
}

/**
 * Check if fallback mode should be used
 * Returns true if Netlify functions are unavailable
 */
export async function shouldUseFallback() {
  try {
    // Quick check if Netlify functions are available
    const response = await fetch('/api/cams/health', {
      method: 'HEAD',
      signal: AbortSignal.timeout(2000)
    });
    return !response.ok;
  } catch {
    return true; // Network error or timeout = use fallback
  }
}
