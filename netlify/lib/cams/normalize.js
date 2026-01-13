/**
 * Camera Normalization - Maps provider payloads to canonical Camera schema
 */

/**
 * Canonical Camera schema
 * @typedef {Object} Camera
 * @property {string} id - provider:id
 * @property {string} provider - windy|fl511|ny511|caltrans|nycdot
 * @property {string} country - ISO2 code (US, UA, IL, etc.)
 * @property {string|null} region1 - US state or admin area
 * @property {string|null} city
 * @property {string|null} road
 * @property {string} title
 * @property {string|null} description
 * @property {number} lat
 * @property {number} lon
 * @property {string} type - dot_traffic|city_street|scenic|other
 * @property {Object} media - {mode, snapshotUrl, streamUrl, providerPageUrl}
 * @property {number|null} refreshSec
 * @property {string} status - online|offline|unknown
 * @property {string[]} tags
 * @property {string} updatedAt - ISO timestamp
 */

/**
 * Normalize a camera object to canonical schema
 * @param {Object} raw - Raw provider data
 * @param {string} provider - Provider name
 * @returns {Camera|null} Normalized camera or null if invalid
 */
function normalizeCamera(raw, provider) {
  try {
    // Validate required fields
    if (!raw || typeof raw !== 'object') return null;
    
    const lat = parseFloat(raw.lat);
    const lon = parseFloat(raw.lon);
    if (isNaN(lat) || isNaN(lon)) return null;
    
    if (!raw.id && !raw.providerId) return null;
    const id = raw.id || `${provider}:${raw.providerId}`;
    
    // Build tags array
    const tags = [];
    if (raw.country) tags.push(raw.country.toLowerCase());
    if (raw.region1) tags.push(raw.region1.toLowerCase().replace(/\s+/g, '-'));
    if (raw.city) tags.push(raw.city.toLowerCase().replace(/\s+/g, '-'));
    if (raw.road) tags.push(raw.road.toLowerCase().replace(/\s+/g, '-'));
    if (raw.tags && Array.isArray(raw.tags)) {
      tags.push(...raw.tags.map(t => String(t).toLowerCase()));
    }
    
    // Determine media mode
    let mediaMode = 'unknown';
    if (raw.streamUrl) mediaMode = 'stream';
    else if (raw.snapshotUrl) mediaMode = 'snapshot';
    
    return {
      id: id.startsWith(`${provider}:`) ? id : `${provider}:${id}`,
      provider,
      country: raw.country || null,
      region1: raw.region1 || null,
      city: raw.city || null,
      road: raw.road || null,
      title: raw.title || raw.name || 'Untitled Camera',
      description: raw.description || null,
      lat,
      lon,
      type: raw.type || 'other',
      media: {
        mode: mediaMode,
        snapshotUrl: raw.snapshotUrl || null,
        streamUrl: raw.streamUrl || null,
        providerPageUrl: raw.providerPageUrl || raw.url || null
      },
      refreshSec: raw.refreshSec || null,
      status: raw.status || 'unknown',
      tags: [...new Set(tags)], // Dedupe
      updatedAt: raw.updatedAt || new Date().toISOString()
    };
  } catch (error) {
    console.error(`[normalize] Error normalizing camera from ${provider}:`, error);
    return null;
  }
}

/**
 * Normalize an array of cameras
 * @param {Object[]} rawCameras - Array of raw provider data
 * @param {string} provider - Provider name
 * @returns {Camera[]} Array of normalized cameras
 */
function normalizeCameras(rawCameras, provider) {
  if (!Array.isArray(rawCameras)) return [];
  return rawCameras
    .map(raw => normalizeCamera(raw, provider))
    .filter(cam => cam !== null);
}

module.exports = {
  normalizeCamera,
  normalizeCameras
};
