/**
 * Florida FL511 Provider
 * ArcGIS FeatureServer for Florida traffic cameras
 */

const { normalizeCameras } = require('../normalize.js');

const FL511_FEATURESERVER = 'https://www.fl511.com/arcgis/rest/services/FL511/TrafficCameras/FeatureServer/0';

/**
 * Fetch cameras from FL511
 * @param {Object} params - {bbox, limit}
 * @returns {Promise<Camera[]>}
 */
async function fetchFL511Cameras(params = {}) {
  try {
    const queryParams = new URLSearchParams();
    queryParams.set('f', 'json');
    queryParams.set('outFields', '*');
    queryParams.set('where', '1=1'); // Get all cameras
    queryParams.set('returnGeometry', 'true');
    queryParams.set('returnDistinctValues', 'false');
    
    if (params.bbox) {
      const [minLon, minLat, maxLon, maxLat] = params.bbox.split(',').map(Number);
      queryParams.set('geometry', JSON.stringify({
        xmin: minLon,
        ymin: minLat,
        xmax: maxLon,
        ymax: maxLat,
        spatialReference: { wkid: 4326 }
      }));
      queryParams.set('geometryType', 'esriGeometryEnvelope');
      queryParams.set('spatialRel', 'esriSpatialRelIntersects');
    }
    
    const url = `${FL511_FEATURESERVER}/query?${queryParams.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`FL511 API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.features || !Array.isArray(data.features)) {
      return [];
    }
    
    // Transform ArcGIS format to our schema
    const rawCameras = data.features
      .filter(feature => feature.geometry && feature.attributes)
      .map(feature => {
        const attrs = feature.attributes;
        const geom = feature.geometry;
        
        // FL511 camera image URL pattern (may vary)
        const cameraId = attrs.CAMERA_ID || attrs.CameraID || attrs.ID;
        const snapshotUrl = cameraId 
          ? `https://www.fl511.com/images/cctv/${cameraId}.jpg`
          : null;
        
        return {
          providerId: String(cameraId || attrs.OBJECTID || Math.random()),
          country: 'US',
          region1: 'FL',
          city: attrs.CITY || attrs.City || null,
          road: attrs.ROAD || attrs.Road || attrs.ROUTE || null,
          title: attrs.NAME || attrs.Name || attrs.DESCRIPTION || 'FL511 Camera',
          description: attrs.DESCRIPTION || attrs.Description || null,
          lat: geom.y || geom.latitude || 0,
          lon: geom.x || geom.longitude || 0,
          type: 'dot_traffic',
          snapshotUrl,
          streamUrl: null,
          providerPageUrl: `https://www.fl511.com/`,
          refreshSec: 60, // FL511 typically refreshes every minute
          status: 'online', // Assume online if in feed
          tags: ['fl', 'traffic', 'dot'],
          updatedAt: new Date().toISOString()
        };
      });
    
    // Limit results
    const limit = params.limit || 500;
    const limited = rawCameras.slice(0, limit);
    
    return normalizeCameras(limited, 'fl511');
  } catch (error) {
    console.error('[FL511 Provider] Error fetching cameras:', error);
    return [];
  }
}

module.exports = {
  fetchFL511Cameras
};
