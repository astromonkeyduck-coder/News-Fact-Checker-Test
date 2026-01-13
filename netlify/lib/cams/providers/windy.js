/**
 * Windy/Webcams.travel Provider
 * Global webcam coverage via Windy API
 */

const { normalizeCameras } = require('../normalize.js');

const WINDY_API_BASE = 'https://api.windy.com/webcams/api/v2.0';
const WINDY_API_KEY = process.env.WINDY_API_KEY || null;

/**
 * Fetch cameras from Windy API
 * @param {Object} params - {bbox, country, city, limit}
 * @returns {Promise<Camera[]>}
 */
async function fetchWindyCameras(params = {}) {
  try {
    // Build query
    const queryParams = new URLSearchParams();
    
    if (params.bbox) {
      // bbox format: minLon,minLat,maxLon,maxLat
      const [minLon, minLat, maxLon, maxLat] = params.bbox.split(',').map(Number);
      queryParams.set('bbox', `${minLon},${minLat},${maxLon},${maxLat}`);
    } else if (params.country) {
      queryParams.set('country', params.country);
      if (params.city) {
        queryParams.set('city', params.city);
      }
    }
    
    queryParams.set('show', 'webcams:list');
    queryParams.set('limit', String(params.limit || 200));
    
    if (WINDY_API_KEY) {
      queryParams.set('key', WINDY_API_KEY);
    }
    
    const url = `${WINDY_API_BASE}/list?${queryParams.toString()}`;
    
    console.log('[Windy] Fetching cameras from:', url.replace(WINDY_API_KEY || '', '[KEY]'));
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('[Windy] API error:', response.status, response.statusText, errorText.substring(0, 200));
      throw new Error(`Windy API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.result || !data.result.webcams) {
      console.warn('[Windy] No webcams in response:', data);
      return [];
    }
    
    console.log('[Windy] Found', data.result.webcams.length, 'webcams');
    
    // Transform Windy format to our schema
    const rawCameras = data.result.webcams.map(webcam => {
      const location = webcam.location || {};
      const image = webcam.image || {};
      const player = webcam.player || {};
      
      // Determine type
      let type = 'scenic';
      const titleLower = (webcam.title || '').toLowerCase();
      if (titleLower.includes('traffic') || titleLower.includes('highway') || titleLower.includes('i-')) {
        type = 'dot_traffic';
      } else if (titleLower.includes('street') || titleLower.includes('city')) {
        type = 'city_street';
      }
      
      // Build tags for hotspots
      const tags = [];
      if (location.country_code) {
        tags.push(location.country_code.toLowerCase());
        // Tag conflict hotspots
        const countryCode = location.country_code.toLowerCase();
        if (['ua', 'il', 'ps', 'sy', 'ye'].includes(countryCode)) {
          tags.push('hotspot');
        }
      }
      if (location.city) {
        tags.push(location.city.toLowerCase().replace(/\s+/g, '-'));
      }
      
      return {
        providerId: String(webcam.id),
        country: location.country_code || null,
        region1: location.region || location.state || null,
        city: location.city || null,
        road: null,
        title: webcam.title || 'Untitled Webcam',
        description: webcam.title || null,
        lat: parseFloat(location.latitude) || 0,
        lon: parseFloat(location.longitude) || 0,
        type,
        snapshotUrl: image.current?.preview || image.current?.thumbnail || null,
        streamUrl: player.live?.embed || null,
        providerPageUrl: webcam.url?.current || null,
        refreshSec: 300, // Windy typically refreshes every 5 minutes
        status: webcam.status?.online ? 'online' : 'offline',
        tags,
        updatedAt: new Date().toISOString()
      };
    });
    
    return normalizeCameras(rawCameras, 'windy');
  } catch (error) {
    console.error('[Windy Provider] Error fetching cameras:', error);
    return [];
  }
}

module.exports = {
  fetchWindyCameras
};
