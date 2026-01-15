/**
 * Florida FL511 Provider
 * ArcGIS FeatureServer for Florida traffic cameras
 */

const { normalizeCameras } = require('../normalize.js');

const FL511_FEATURESERVER = 'https://services.arcgis.com/3wFbqsFPLeKqOlIK/arcgis/rest/services/FL511_Traffic_Cameras/FeatureServer/0';

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
    queryParams.set('outSR', '4326');
    
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
    
    const limit = params.limit || 500;
    queryParams.set('resultRecordCount', String(limit));
    queryParams.set('resultOffset', '0');
    
    const url = `${FL511_FEATURESERVER}/query?${queryParams.toString()}`;
    
    console.log('[FL511] Fetching cameras from:', url);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('[FL511] API error:', response.status, response.statusText, errorText.substring(0, 200));
      throw new Error(`FL511 API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('[FL511] Response features count:', data.features?.length || 0);
    
    if (!data.features || !Array.isArray(data.features)) {
      return [];
    }
    
    // Transform ArcGIS format to our schema
    const rawCameras = data.features
      .filter(feature => feature.attributes)
      .map(feature => {
        const attrs = feature.attributes;
        const geom = feature.geometry || {};
        const cameraId = attrs.ID || attrs.OBJECTID_1 || attrs.OBJECTID;
        const snapshotUrl = attrs.IMAGE || null;
        const road = [attrs.HIGHWAY, attrs.DIRECTION].filter(Boolean).join(' ');
        
        return {
          providerId: String(cameraId || Math.random()),
          country: 'US',
          region1: 'FL',
          city: attrs.COUNTY || null,
          road: road || null,
          title: attrs.DESCRIPT || 'FL511 Camera',
          description: attrs.DESCRIPT || null,
          lat: attrs.LATITUDE || geom.y || 0,
          lon: attrs.LONGITUDE || geom.x || 0,
          type: 'dot_traffic',
          snapshotUrl,
          streamUrl: null,
          providerPageUrl: `https://www.fl511.com/`,
          refreshSec: 60,
          status: 'online',
          tags: ['fl', 'traffic', 'dot'],
          updatedAt: new Date().toISOString()
        };
      });
    
    return normalizeCameras(rawCameras, 'fl511');
  } catch (error) {
    console.error('[FL511 Provider] Error fetching cameras:', error);
    return [];
  }
}

module.exports = {
  fetchFL511Cameras
};
