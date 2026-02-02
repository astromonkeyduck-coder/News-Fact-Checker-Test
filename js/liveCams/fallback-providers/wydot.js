/**
 * WYDOT Direct API Client (Wyoming DOT)
 * Wyoming 511 traffic camera system
 */

// Curated Wyoming cameras (scenic mountain passes and highways)
const WYDOT_CAMERAS = [
  {
    id: 'wydot-i80-cheyenne',
    title: 'I-80 at Cheyenne',
    lat: 41.1400,
    lon: -104.8200,
    city: 'Cheyenne',
    road: 'I-80',
    snapshotUrl: 'https://www.wyoroad.info/pls/roadinfo/camera?camera_id=CCITGR1'
  },
  {
    id: 'wydot-i80-laramie',
    title: 'I-80 Summit Rest Area (Laramie)',
    lat: 41.2631,
    lon: -105.5898,
    city: 'Laramie',
    road: 'I-80',
    snapshotUrl: 'https://www.wyoroad.info/pls/roadinfo/camera?camera_id=CLARSM'
  },
  {
    id: 'wydot-i25-casper',
    title: 'I-25 at Casper',
    lat: 42.8666,
    lon: -106.3131,
    city: 'Casper',
    road: 'I-25',
    snapshotUrl: 'https://www.wyoroad.info/pls/roadinfo/camera?camera_id=CCASPOP'
  },
  {
    id: 'wydot-yellowstone-east',
    title: 'US-20 East Entrance Yellowstone',
    lat: 44.4896,
    lon: -110.0027,
    city: 'Cody',
    road: 'US-20',
    snapshotUrl: 'https://www.wyoroad.info/pls/roadinfo/camera?camera_id=CYEL3'
  },
  {
    id: 'wydot-teton-pass',
    title: 'WY-22 Teton Pass',
    lat: 43.4943,
    lon: -110.9587,
    city: 'Wilson',
    road: 'WY-22 Teton Pass',
    snapshotUrl: 'https://www.wyoroad.info/pls/roadinfo/camera?camera_id=CTETPAS'
  },
  {
    id: 'wydot-jackson',
    title: 'US-191 Jackson Hole',
    lat: 43.4799,
    lon: -110.7624,
    city: 'Jackson',
    road: 'US-191',
    snapshotUrl: 'https://www.wyoroad.info/pls/roadinfo/camera?camera_id=CJACKSO'
  },
  {
    id: 'wydot-i80-rawlins',
    title: 'I-80 at Rawlins',
    lat: 41.7910,
    lon: -107.2387,
    city: 'Rawlins',
    road: 'I-80',
    snapshotUrl: 'https://www.wyoroad.info/pls/roadinfo/camera?camera_id=CRAWLIN'
  },
  {
    id: 'wydot-i90-sheridan',
    title: 'I-90 at Sheridan',
    lat: 44.7972,
    lon: -106.9561,
    city: 'Sheridan',
    road: 'I-90',
    snapshotUrl: 'https://www.wyoroad.info/pls/roadinfo/camera?camera_id=CSHERI'
  },
  {
    id: 'wydot-devils-tower',
    title: 'WY-24 Devils Tower',
    lat: 44.5902,
    lon: -104.7146,
    city: 'Hulett',
    road: 'WY-24',
    snapshotUrl: 'https://www.wyoroad.info/pls/roadinfo/camera?camera_id=CDEVTOW'
  }
];

/**
 * Fetch cameras from WYDOT curated list
 * @param {Object} params - Optional filters
 * @returns {Promise<Camera[]>}
 */
export async function fetchWYDOTDirect(params = {}) {
  try {
    console.log('[WYDOT Direct] Loading Wyoming cameras...');
    
    let cameras = WYDOT_CAMERAS.map(cam => ({
      id: cam.id,
      providerId: cam.id,
      provider: 'wydot',
      title: cam.title,
      description: `Wyoming DOT camera on ${cam.road}`,
      lat: cam.lat,
      lon: cam.lon,
      country: 'US',
      region1: 'WY',
      city: cam.city,
      road: cam.road,
      type: 'dot_traffic',
      status: 'online',
      tags: ['wyoming', 'wydot', 'dot', 'traffic', 'mountain'],
      media: {
        snapshotUrl: cam.snapshotUrl,
        streamUrl: null,
        mode: 'snapshot',
        providerPageUrl: 'https://www.wyoroad.info/'
      },
      refreshSec: 180, // Wyoming cameras update every 3 minutes typically
      updatedAt: new Date().toISOString()
    }));
    
    // Filter by bbox if provided
    if (params.bbox) {
      const [minLon, minLat, maxLon, maxLat] = params.bbox.split(',').map(Number);
      cameras = cameras.filter(cam => 
        cam.lat >= minLat && cam.lat <= maxLat &&
        cam.lon >= minLon && cam.lon <= maxLon
      );
    }
    
    console.log(`[WYDOT Direct] Returning ${cameras.length} cameras`);
    return cameras;
    
  } catch (error) {
    console.error('[WYDOT Direct] Error:', error);
    return [];
  }
}
