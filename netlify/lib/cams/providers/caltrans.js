/**
 * California Caltrans Provider
 * Caltrans CCTV open dataset
 */

const { normalizeCameras } = require('../normalize.js');

// Caltrans typically provides data via ArcGIS or JSON endpoints
// This is a placeholder - actual endpoint may vary
const CALTRANS_API_BASE = 'https://cwwp2.dot.ca.gov/data/d4/cctv/cctv.json';

/**
 * Fetch cameras from Caltrans
 * @param {Object} params - {bbox, limit}
 * @returns {Promise<Camera[]>}
 */
async function fetchCaltransCameras(params = {}) {
  try {
    // Caltrans may have different endpoints per district
    // This is a generic implementation - may need adjustment based on actual API
    const url = CALTRANS_API_BASE;
    
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
    
    // Caltrans format may vary - adapt based on actual response
    const cameras = Array.isArray(data) ? data : (data.cameras || data.features || []);
    
    if (!Array.isArray(cameras)) {
      return [];
    }
    
    // Transform Caltrans format to our schema
    const rawCameras = cameras
      .filter(cam => cam.latitude && cam.longitude)
      .map(cam => {
        const cameraId = cam.id || cam.camera_id || cam.CameraID;
        const snapshotUrl = cameraId 
          ? `https://cwwp2.dot.ca.gov/data/d4/cctv/${cameraId}.jpg`
          : cam.image_url || cam.url || null;
        
        return {
          providerId: String(cameraId || Math.random()),
          country: 'US',
          region1: 'CA',
          city: cam.city || cam.location?.city || null,
          road: cam.route || cam.highway || cam.road || null,
          title: cam.name || cam.title || cam.description || 'Caltrans Camera',
          description: cam.description || null,
          lat: parseFloat(cam.latitude || cam.lat || 0),
          lon: parseFloat(cam.longitude || cam.lon || 0),
          type: 'dot_traffic',
          snapshotUrl,
          streamUrl: cam.stream_url || null,
          providerPageUrl: cam.url || `https://dot.ca.gov/`,
          refreshSec: 60,
          status: cam.status === 'active' ? 'online' : 'unknown',
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
    const limit = params.limit || 500;
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
