/**
 * Caltrans Direct API Client (California DOT)
 * Works directly from browser - public endpoint
 */

const CALTRANS_API = 'https://cwwp2.dot.ca.gov/data/d4/cctv/cctvStatusD04.json';

// District endpoints - D4 is Bay Area, D7 is LA, etc.
const CALTRANS_DISTRICTS = {
  d3: 'https://cwwp2.dot.ca.gov/data/d3/cctv/cctvStatusD03.json',  // Sacramento
  d4: 'https://cwwp2.dot.ca.gov/data/d4/cctv/cctvStatusD04.json',  // Bay Area
  d5: 'https://cwwp2.dot.ca.gov/data/d5/cctv/cctvStatusD05.json',  // Central Coast
  d6: 'https://cwwp2.dot.ca.gov/data/d6/cctv/cctvStatusD06.json',  // Fresno
  d7: 'https://cwwp2.dot.ca.gov/data/d7/cctv/cctvStatusD07.json',  // LA
  d8: 'https://cwwp2.dot.ca.gov/data/d8/cctv/cctvStatusD08.json',  // San Bernardino
  d11: 'https://cwwp2.dot.ca.gov/data/d11/cctv/cctvStatusD11.json', // San Diego
  d12: 'https://cwwp2.dot.ca.gov/data/d12/cctv/cctvStatusD12.json'  // Orange County
};

/**
 * Fetch cameras from Caltrans directly (browser-side)
 * @param {Object} params - Optional filters
 * @returns {Promise<Camera[]>}
 */
export async function fetchCaltransirect(params = {}) {
  try {
    console.log('[Caltrans Direct] Fetching cameras from multiple districts...');
    
    // Fetch from multiple districts in parallel
    const districtPromises = Object.entries(CALTRANS_DISTRICTS).map(async ([district, url]) => {
      try {
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
          console.warn(`[Caltrans Direct] District ${district} returned ${response.status}`);
          return [];
        }
        
        const data = await response.json();
        return { district, cameras: data.data || [] };
      } catch (err) {
        console.warn(`[Caltrans Direct] District ${district} failed:`, err.message);
        return { district, cameras: [] };
      }
    });
    
    const results = await Promise.all(districtPromises);
    
    // Combine all district cameras
    let allCameras = [];
    for (const { district, cameras } of results) {
      if (Array.isArray(cameras)) {
        const normalized = cameras.map(cam => normalizeCaltransCamera(cam, district));
        allCameras.push(...normalized);
      }
    }
    
    console.log(`[Caltrans Direct] Found ${allCameras.length} cameras total`);
    
    // Filter by bbox if provided
    if (params.bbox) {
      const [minLon, minLat, maxLon, maxLat] = params.bbox.split(',').map(Number);
      allCameras = allCameras.filter(cam => 
        cam.lat >= minLat && cam.lat <= maxLat &&
        cam.lon >= minLon && cam.lon <= maxLon
      );
      console.log(`[Caltrans Direct] After bbox filter: ${allCameras.length} cameras`);
    }
    
    return allCameras.filter(cam => cam.media.snapshotUrl);
    
  } catch (error) {
    console.error('[Caltrans Direct] Error:', error);
    return [];
  }
}

/**
 * Normalize Caltrans camera to common schema
 */
function normalizeCaltransCamera(cam, district) {
  const location = cam.location || {};
  const imageData = cam.imageData || {};
  
  return {
    id: `caltrans-${district}-${cam.index || Math.random().toString(36).substr(2, 9)}`,
    providerId: String(cam.index || ''),
    provider: 'caltrans',
    title: location.locationName || `CA ${location.route || ''} Camera`,
    description: location.nearbyPlace || null,
    lat: parseFloat(location.latitude) || 0,
    lon: parseFloat(location.longitude) || 0,
    country: 'US',
    region1: 'CA',
    city: location.nearbyPlace || null,
    road: location.route ? `${location.direction || ''} ${location.route}`.trim() : null,
    type: 'dot_traffic',
    status: cam.inService === 'true' ? 'online' : 'offline',
    tags: ['california', 'caltrans', 'dot', 'traffic', district],
    media: {
      snapshotUrl: imageData.static?.currentImageURL || imageData.streamingVideoURL || null,
      streamUrl: imageData.streamingVideoURL || null,
      mode: imageData.streamingVideoURL ? 'stream' : 'snapshot',
      providerPageUrl: null
    },
    refreshSec: 60,
    updatedAt: imageData.static?.currentImageUpdateTime || new Date().toISOString()
  };
}

/**
 * Get just LA area cameras (district 7) - useful for demos
 */
export async function fetchCaltransLA() {
  try {
    const response = await fetch(CALTRANS_DISTRICTS.d7, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`Caltrans LA error: ${response.status}`);
    }
    
    const data = await response.json();
    const cameras = data.data || [];
    
    return cameras.map(cam => normalizeCaltransCamera(cam, 'd7'))
      .filter(cam => cam.media.snapshotUrl);
    
  } catch (error) {
    console.error('[Caltrans LA Direct] Error:', error);
    return [];
  }
}
