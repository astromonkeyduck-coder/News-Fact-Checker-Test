/**
 * TxDOT Direct API Client (Texas DOT)
 * DriveTexas traffic camera system
 * Note: May require CORS proxy in production
 */

// DriveTexas regional endpoints
const TXDOT_REGIONS = {
  houston: { name: 'Houston', lat: 29.76, lon: -95.37 },
  dallas: { name: 'Dallas-Fort Worth', lat: 32.78, lon: -96.80 },
  sanantonio: { name: 'San Antonio', lat: 29.42, lon: -98.49 },
  austin: { name: 'Austin', lat: 30.27, lon: -97.74 },
  elpaso: { name: 'El Paso', lat: 31.76, lon: -106.49 }
};

// Curated list of reliable TxDOT cameras (direct image URLs)
const TXDOT_CURATED = [
  {
    id: 'txdot-houston-i10-katy',
    title: 'I-10 Katy Freeway at Beltway 8',
    lat: 29.7804,
    lon: -95.5559,
    city: 'Houston',
    road: 'I-10 Katy Freeway',
    snapshotUrl: 'https://its.txdot.gov/Content/images/Houston/CCTV0015.jpg'
  },
  {
    id: 'txdot-houston-i45-downtown',
    title: 'I-45 Downtown Houston',
    lat: 29.7559,
    lon: -95.3597,
    city: 'Houston',
    road: 'I-45',
    snapshotUrl: 'https://its.txdot.gov/Content/images/Houston/CCTV0001.jpg'
  },
  {
    id: 'txdot-dallas-i35-downtown',
    title: 'I-35E Downtown Dallas',
    lat: 32.7815,
    lon: -96.8005,
    city: 'Dallas',
    road: 'I-35E',
    snapshotUrl: 'https://its.txdot.gov/Content/images/Dallas/CCTV0001.jpg'
  },
  {
    id: 'txdot-dallas-i635-lbj',
    title: 'I-635 LBJ Freeway at US-75',
    lat: 32.9203,
    lon: -96.7501,
    city: 'Dallas',
    road: 'I-635 LBJ',
    snapshotUrl: 'https://its.txdot.gov/Content/images/Dallas/CCTV0020.jpg'
  },
  {
    id: 'txdot-sanantonio-i35',
    title: 'I-35 San Antonio Downtown',
    lat: 29.4241,
    lon: -98.4936,
    city: 'San Antonio',
    road: 'I-35',
    snapshotUrl: 'https://its.txdot.gov/Content/images/SanAntonio/CCTV0001.jpg'
  },
  {
    id: 'txdot-austin-i35-central',
    title: 'I-35 Central Austin',
    lat: 30.2672,
    lon: -97.7431,
    city: 'Austin',
    road: 'I-35',
    snapshotUrl: 'https://its.txdot.gov/Content/images/Austin/CCTV0001.jpg'
  },
  {
    id: 'txdot-austin-mopac',
    title: 'MoPac Expressway Austin',
    lat: 30.3074,
    lon: -97.7578,
    city: 'Austin',
    road: 'Loop 1 MoPac',
    snapshotUrl: 'https://its.txdot.gov/Content/images/Austin/CCTV0010.jpg'
  },
  {
    id: 'txdot-elpaso-i10',
    title: 'I-10 El Paso',
    lat: 31.7619,
    lon: -106.4850,
    city: 'El Paso',
    road: 'I-10',
    snapshotUrl: 'https://its.txdot.gov/Content/images/ElPaso/CCTV0001.jpg'
  }
];

/**
 * Fetch cameras from TxDOT curated list
 * @param {Object} params - Optional filters
 * @returns {Promise<Camera[]>}
 */
export async function fetchTxDOTDirect(params = {}) {
  try {
    console.log('[TxDOT Direct] Loading curated Texas cameras...');
    
    let cameras = TXDOT_CURATED.map(cam => ({
      id: cam.id,
      providerId: cam.id,
      provider: 'txdot',
      title: cam.title,
      description: `Texas DOT camera on ${cam.road}`,
      lat: cam.lat,
      lon: cam.lon,
      country: 'US',
      region1: 'TX',
      city: cam.city,
      road: cam.road,
      type: 'dot_traffic',
      status: 'online',
      tags: ['texas', 'txdot', 'dot', 'traffic', cam.city.toLowerCase()],
      media: {
        snapshotUrl: cam.snapshotUrl,
        streamUrl: null,
        mode: 'snapshot',
        providerPageUrl: 'https://drivetexas.org/'
      },
      refreshSec: 120, // TxDOT images update less frequently
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
    
    console.log(`[TxDOT Direct] Returning ${cameras.length} cameras`);
    return cameras;
    
  } catch (error) {
    console.error('[TxDOT Direct] Error:', error);
    return [];
  }
}

/**
 * Get cameras for a specific Texas city
 */
export function getTxDOTCamerasForCity(city) {
  const normalizedCity = city.toLowerCase();
  return TXDOT_CURATED
    .filter(cam => cam.city.toLowerCase() === normalizedCity)
    .map(cam => ({
      id: cam.id,
      providerId: cam.id,
      provider: 'txdot',
      title: cam.title,
      lat: cam.lat,
      lon: cam.lon,
      country: 'US',
      region1: 'TX',
      city: cam.city,
      road: cam.road,
      type: 'dot_traffic',
      status: 'online',
      tags: ['texas', 'txdot', 'dot', 'traffic'],
      media: {
        snapshotUrl: cam.snapshotUrl,
        streamUrl: null,
        mode: 'snapshot'
      },
      refreshSec: 120
    }));
}
