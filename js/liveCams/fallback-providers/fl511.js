/**
 * FL511 Direct API Client (Florida DOT)
 * Works directly from browser - CORS enabled
 * ArcGIS FeatureServer endpoint
 */

const FL511_API = 'https://services1.arcgis.com/O1JpcwDW8sjYuddV/arcgis/rest/services/CCTV/FeatureServer/0/query';

/**
 * Fetch cameras from FL511 directly (browser-side)
 * @param {Object} params - Optional bbox filter
 * @returns {Promise<Camera[]>}
 */
export async function fetchFL511Direct(params = {}) {
  try {
    const queryParams = new URLSearchParams({
      where: '1=1',
      outFields: '*',
      f: 'json',
      resultRecordCount: '500'
    });
    
    // Add bbox if provided (minLon,minLat,maxLon,maxLat)
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
      queryParams.set('inSR', '4326');
      queryParams.set('spatialRel', 'esriSpatialRelIntersects');
    }
    
    const url = `${FL511_API}?${queryParams.toString()}`;
    console.log('[FL511 Direct] Fetching cameras...');
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`FL511 API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.features || !Array.isArray(data.features)) {
      console.warn('[FL511 Direct] No features in response');
      return [];
    }
    
    console.log(`[FL511 Direct] Found ${data.features.length} cameras`);
    
    // Transform to normalized schema
    return data.features.map(feature => {
      const attrs = feature.attributes || {};
      const geom = feature.geometry || {};
      
      return {
        id: `fl511-${attrs.OBJECTID || attrs.CameraID || Math.random().toString(36).substr(2, 9)}`,
        providerId: String(attrs.OBJECTID || attrs.CameraID || ''),
        provider: 'fl511',
        title: attrs.Description || attrs.CameraName || 'FL Traffic Camera',
        description: attrs.Description || null,
        lat: geom.y || attrs.Latitude || 0,
        lon: geom.x || attrs.Longitude || 0,
        country: 'US',
        region1: 'FL',
        city: attrs.City || attrs.County || null,
        road: attrs.RoadwayName || attrs.Roadway || null,
        type: 'dot_traffic',
        status: 'online',
        tags: ['florida', 'dot', 'traffic'],
        media: {
          snapshotUrl: attrs.VideoURL || attrs.ImageURL || attrs.URL || null,
          streamUrl: null,
          mode: 'snapshot',
          providerPageUrl: null
        },
        refreshSec: 60,
        updatedAt: new Date().toISOString()
      };
    }).filter(cam => cam.lat && cam.lon && cam.media.snapshotUrl);
    
  } catch (error) {
    console.error('[FL511 Direct] Error:', error);
    return [];
  }
}
