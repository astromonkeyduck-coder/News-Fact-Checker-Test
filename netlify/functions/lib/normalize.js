/**
 * Normalization utilities for Verified Events Engine
 * Handles severity mapping, location sanitization, etc.
 */

/**
 * Normalize severity for earthquakes (magnitude-based)
 * @param {number} magnitude - Earthquake magnitude
 * @returns {number} Severity 1-5
 */
function normalizeEarthquakeSeverity(magnitude) {
  if (magnitude >= 8.0) return 5;
  if (magnitude >= 7.0) return 4;
  if (magnitude >= 6.5) return 3;
  if (magnitude >= 5.5) return 2;
  return 1;
}

/**
 * Normalize severity for weather alerts
 * @param {string} severity - Alert severity from NWS
 * @returns {number} Severity 1-5
 */
function normalizeWeatherSeverity(severity) {
  const upper = (severity || '').toUpperCase();
  if (upper.includes('EXTREME')) return 5;
  if (upper.includes('SEVERE')) return 4;
  if (upper.includes('MODERATE')) return 3;
  if (upper.includes('MINOR')) return 2;
  return 1;
}

/**
 * Normalize severity for airspace/maritime events
 * @param {string} level - Alert level
 * @returns {number} Severity 1-5
 */
function normalizeAirspaceSeverity(level) {
  const upper = (level || '').toUpperCase();
  if (upper.includes('NATIONWIDE') || upper.includes('MAJOR')) return 5;
  if (upper.includes('REGIONAL') || upper.includes('MULTIPLE')) return 4;
  if (upper.includes('SINGLE') || upper.includes('LOCAL')) return 3;
  return 2;
}

/**
 * Clean location text for human-readable display
 * Removes distance/direction prefixes and extracts region/country
 * @param {string} place - Raw location string
 * @returns {string} Cleaned location
 */
function cleanLocation(place) {
  if (!place) return 'Unknown Location';
  
  // Remove distance/direction prefixes like "20 km SE of"
  let cleaned = place.replace(/^\d+\s*(km|mi|miles?)\s*[NESW]+\s+of\s+/i, '');
  cleaned = cleaned.replace(/^\d+\s*(km|mi|miles?)\s+/i, '');
  
  // Extract country/region name (usually the last part)
  const parts = cleaned.split(',').map(p => p.trim());
  
  // If it's a small town, try to get the country/region
  if (parts.length > 1) {
    // Return the last part (usually country/region)
    return parts[parts.length - 1];
  }
  
  // For single-part locations, return as-is (capitalize first letter of each word)
  return cleaned.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Extract country code from location (basic implementation)
 * @param {string} location - Location string
 * @returns {string|null} ISO country code if detectable
 */
function extractCountryCode(location) {
  // This is a basic implementation - can be enhanced with geocoding
  // For now, return null and let engines provide it if available
  return null;
}

module.exports = {
  normalizeEarthquakeSeverity,
  normalizeWeatherSeverity,
  normalizeAirspaceSeverity,
  cleanLocation,
  extractCountryCode,
};




