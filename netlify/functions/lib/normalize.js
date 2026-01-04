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
 * US State abbreviations to full names mapping
 */
const US_STATES = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
  'DC': 'District of Columbia', 'PR': 'Puerto Rico', 'VI': 'U.S. Virgin Islands', 'AS': 'American Samoa',
  'GU': 'Guam', 'MP': 'Northern Mariana Islands'
};

/**
 * Expand US state abbreviation to full name
 * @param {string} abbreviation - State abbreviation (e.g., "CA")
 * @returns {string} Full state name (e.g., "California") or original if not found
 */
function expandStateAbbreviation(abbreviation) {
  if (!abbreviation) return abbreviation;
  const upper = abbreviation.trim().toUpperCase();
  return US_STATES[upper] || abbreviation;
}

/**
 * Clean location text for human-readable display
 * Removes distance/direction prefixes, expands state abbreviations, and formats nicely
 * @param {string} place - Raw location string
 * @returns {string} Cleaned location
 */
function cleanLocation(place) {
  if (!place) return 'Unknown Location';
  
  // Remove distance/direction prefixes like "20 km SE of"
  let cleaned = place.replace(/^\d+\s*(km|mi|miles?)\s*[NESW]+\s+of\s+/i, '');
  cleaned = cleaned.replace(/^\d+\s*(km|mi|miles?)\s+/i, '');
  
  // Extract parts
  const parts = cleaned.split(',').map(p => p.trim()).filter(p => p);
  
  if (parts.length > 1) {
    // Process each part and expand state abbreviations
    const processedParts = parts.map(part => {
      // Check if this part is a US state abbreviation
      const expanded = expandStateAbbreviation(part);
      return expanded;
    });
    
    // Return city, state/country format
    // If last part is a US state, include it; otherwise just return last part
    const lastPart = processedParts[processedParts.length - 1];
    const secondLastPart = processedParts.length > 1 ? processedParts[processedParts.length - 2] : null;
    
    // If we have city and state, return "City, State"
    if (processedParts.length >= 2 && US_STATES[secondLastPart?.toUpperCase()]) {
      return `${processedParts[0]}, ${expandStateAbbreviation(secondLastPart)}`;
    }
    
    // If last part is a state abbreviation, expand it
    if (US_STATES[lastPart.toUpperCase()]) {
      if (processedParts.length >= 2) {
        return `${processedParts[0]}, ${expandStateAbbreviation(lastPart)}`;
      }
      return expandStateAbbreviation(lastPart);
    }
    
    // Otherwise return last 2 parts (usually city, country)
    return processedParts.slice(-2).join(', ');
  }
  
  // For single-part locations, check if it's a state abbreviation
  const expanded = expandStateAbbreviation(cleaned);
  if (expanded !== cleaned) {
    return expanded;
  }
  
  // Capitalize first letter of each word
  return cleaned.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Check if a string contains non-ASCII characters (non-English)
 * @param {string} str - String to check
 * @returns {boolean} True if contains non-ASCII characters
 */
function containsNonASCII(str) {
  if (!str) return false;
  // Check for non-ASCII characters (outside basic Latin range)
  return /[^\x00-\x7F]/.test(str);
}

/**
 * Enhance location with reverse geocoding for more detailed information
 * @param {string} place - Raw location string from USGS
 * @param {number|null} lat - Latitude
 * @param {number|null} lon - Longitude
 * @returns {Promise<{location: string, englishName?: string}>} Enhanced location with optional English translation
 */
async function enhanceLocationWithGeocoding(place, lat, lon) {
  // Start with cleaned location
  let location = cleanLocation(place);
  let englishName = null;
  const hasNonASCII = containsNonASCII(location);
  
  // If we have coordinates, try reverse geocoding for more details
  // Check for null/undefined, not falsy (0 is a valid coordinate)
  if (lat != null && lon != null) {
    try {
      // Request English names explicitly
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1&accept-language=en`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'NoteworthyNews/1.0 (contact@noteworthynews.co)',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const address = data.address || {};
        
        // Build detailed location string with English names
        const parts = [];
        
        // Prefer English name if available, otherwise use local name
        const city = address['name:en'] || address.city || address.town || address.village || address.municipality;
        if (city) parts.push(city);
        
        // Add state (expand abbreviation if needed)
        const state = address.state || address.region;
        if (state) {
          const expandedState = expandStateAbbreviation(state);
          parts.push(expandedState);
        }
        
        // Add country (only if not USA)
        const country = address.country;
        if (country && country !== 'United States' && country !== 'USA') {
          parts.push(country);
        }
        
        // If we got good geocoding data, use it
        if (parts.length > 0) {
          const geocodedLocation = parts.join(', ');
          
          // If original location has non-ASCII characters, keep it as primary and use geocoded as English
          if (hasNonASCII) {
            // If geocoded location is different and appears to be in English, use it as English name
            if (geocodedLocation !== location && !containsNonASCII(geocodedLocation)) {
              englishName = geocodedLocation;
            }
            // Keep original location as primary display
          } else {
            // Original is already in English, use geocoded if it's better
            location = geocodedLocation;
          }
        }
        
        // Also check display_name for English version (fallback)
        if (hasNonASCII && !englishName && data.display_name) {
          const displayName = data.display_name;
          // If display_name is in English and different from location, use it as English name
          if (!containsNonASCII(displayName) && displayName !== location) {
            englishName = displayName;
          }
        }
      }
    } catch (error) {
      // If geocoding fails, fall back to cleaned location
      console.warn(`[normalize] Reverse geocoding failed: ${error.message}`);
    }
  }
  
  // Return object with location and optional English translation
  return {
    location,
    englishName: englishName || undefined
  };
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
  expandStateAbbreviation,
  enhanceLocationWithGeocoding,
  extractCountryCode,
};




