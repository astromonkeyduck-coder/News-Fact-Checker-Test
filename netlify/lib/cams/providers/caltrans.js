/**
 * California Caltrans Provider
 * Caltrans CCTV open dataset
 */

const { normalizeCameras } = require('../normalize.js');

// Caltrans CCTV ArcGIS FeatureServer (public)
const CALTRANS_FEATURESERVER = 'https://gisdata.dot.ca.gov/arcgis/rest/services/CHhighway/CCTV/FeatureServer/0';

/**
 * Fetch cameras from Caltrans
 * @param {Object} params - {bbox, limit}
 * @returns {Promise<Camera[]>}
 */
async function fetchCaltransCameras(params = {}) {
  try {
    const queryParams = new URLSearchParams();
    queryParams.set('f', 'json');
    queryParams.set('outFields', '*');
    queryParams.set('where', '1=1');
    queryParams.set('returnGeometry', 'true');
    queryParams.set('outSR', '4326');
    
    const limit = params.limit || 500;
    queryParams.set('resultRecordCount', String(limit));
    queryParams.set('resultOffset', '0');
    
    const url = `${CALTRANS_FEATURESERVER}/query?${queryParams.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      // If endpoint doesn't exist, return empty (non-fatal)
      if (response.status === 404) {
        console.warn('[Caltrans Provider] Endpoint not found, skipping');
        return [];
      }
      throw new Error(`Caltrans API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    const cameras = data.features || [];
    
    if (!Array.isArray(cameras)) {
      return [];
    }
    
    // Transform ArcGIS format to our schema
    const rawCameras = cameras
      .filter(feature => feature.attributes)
      .map(feature => {
        const attrs = feature.attributes;
        const geom = feature.geometry || {};
        const cameraId = attrs.OBJECTID ?? attrs.index_ ?? Math.random();
        const snapshotUrl = attrs.currentImageURL || null;
        const route = attrs.route ? `${attrs.route}${attrs.routeSuffix || ''}` : null;
        
        return {
          providerId: String(cameraId),
          country: 'US',
          region1: 'CA',
          city: attrs.nearbyPlace || attrs.county || null,
          road: route || null,
          title: attrs.locationName || 'Caltrans CCTV',
          description: attrs.imageDescription || null,
          lat: attrs.latitude || geom.y || 0,
          lon: attrs.longitude || geom.x || 0,
          type: 'dot_traffic',
          snapshotUrl,
          streamUrl: attrs.streamingVideoURL || null,
          providerPageUrl: `https://dot.ca.gov/`,
          refreshSec: parseInt(attrs.currentImageUpdateFrequency, 10) || 60,
          status: String(attrs.inService || '').toLowerCase() === 'true' ? 'online' : 'unknown',
          tags: ['ca', 'caltrans', 'traffic', 'dot'],
          updatedAt: new Date().toISOString()
        };
      });
    
    // Filter by bbox if provided
    let filtered = rawCameras;
    if (params.bbox) {
      const [minLon, minLat, maxLon, maxLat] = params.bbox.split(',').map(Number);
      filtered = rawCameras.filter(cam => 
        cam.lon >= minLon && cam.lon <= maxLon &&
        cam.lat >= minLat && cam.lat <= maxLat
      );
    }
    
    // Limit results
    const limited = filtered.slice(0, limit);
    
    return normalizeCameras(limited, 'caltrans');
  } catch (error) {
    console.error('[Caltrans Provider] Error fetching cameras:', error);
    // Non-fatal - return empty array
    return [];
  }
}

module.exports = {
  fetchCaltransCameras
};
