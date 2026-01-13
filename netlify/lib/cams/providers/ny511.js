/**
 * New York 511NY Provider
 * NY 511 traffic camera API
 */

const { normalizeCameras } = require('../normalize.js');

const NY511_API_BASE = 'https://511ny.org/api';
const NY511_API_KEY = process.env.NY511_API_KEY || null;

/**
 * Fetch cameras from NY511
 * @param {Object} params - {bbox, limit}
 * @returns {Promise<Camera[]>}
 */
async function fetchNY511Cameras(params = {}) {
  try {
    if (!NY511_API_KEY) {
      console.warn('[NY511 Provider] No API key configured');
      return [];
    }
    
    const queryParams = new URLSearchParams();
    queryParams.set('key', NY511_API_KEY);
    
    if (params.bbox) {
      const [minLon, minLat, maxLon, maxLat] = params.bbox.split(',').map(Number);
      queryParams.set('bbox', `${minLon},${minLat},${maxLon},${maxLat}`);
    }
    
    const url = `${NY511_API_BASE}/cameras?${queryParams.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`NY511 API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      return [];
    }
    
    // Transform NY511 format to our schema
    const rawCameras = data.map(cam => {
      return {
        providerId: String(cam.id || cam.camera_id || Math.random()),
        country: 'US',
        region1: 'NY',
        city: cam.city || cam.location?.city || null,
        road: cam.road || cam.route || cam.highway || null,
        title: cam.name || cam.title || cam.description || 'NY511 Camera',
        description: cam.description || null,
        lat: parseFloat(cam.latitude || cam.lat || 0),
        lon: parseFloat(cam.longitude || cam.lon || 0),
        type: 'dot_traffic',
        snapshotUrl: cam.image_url || cam.snapshot_url || cam.url || null,
        streamUrl: cam.stream_url || null,
        providerPageUrl: cam.url || `https://511ny.org/`,
        refreshSec: 60,
        status: cam.status === 'active' || cam.status === 'online' ? 'online' : 'offline',
        tags: ['ny', 'traffic', 'dot'],
        updatedAt: new Date().toISOString()
      };
    });
    
    // Limit results
    const limit = params.limit || 500;
    const limited = rawCameras.slice(0, limit);
    
    return normalizeCameras(limited, 'ny511');
  } catch (error) {
    console.error('[NY511 Provider] Error fetching cameras:', error);
    return [];
  }
}

module.exports = {
  fetchNY511Cameras
};
