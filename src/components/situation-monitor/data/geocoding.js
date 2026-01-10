/**
 * Geocoding System
 * Location extraction and geocoding for news events
 */

import { LocationCandidate } from './MapEvent.js';

/**
 * Country aliases mapping
 */
const COUNTRY_ALIASES = {
  'united states': { name: 'United States', lat: 39.8283, lon: -98.5795 },
  'usa': { name: 'United States', lat: 39.8283, lon: -98.5795 },
  'us': { name: 'United States', lat: 39.8283, lon: -98.5795 },
  'america': { name: 'United States', lat: 39.8283, lon: -98.5795 },
  'united kingdom': { name: 'United Kingdom', lat: 55.3781, lon: -3.4360 },
  'uk': { name: 'United Kingdom', lat: 55.3781, lon: -3.4360 },
  'britain': { name: 'United Kingdom', lat: 55.3781, lon: -3.4360 },
  'uae': { name: 'United Arab Emirates', lat: 23.4241, lon: 53.8478 },
  'russia': { name: 'Russia', lat: 61.5240, lon: 105.3188 },
  'china': { name: 'China', lat: 35.8617, lon: 104.1954 },
  'india': { name: 'India', lat: 20.5937, lon: 78.9629 },
  'japan': { name: 'Japan', lat: 36.2048, lon: 138.2529 },
  'germany': { name: 'Germany', lat: 51.1657, lon: 10.4515 },
  'france': { name: 'France', lat: 46.2276, lon: 2.2137 },
  'italy': { name: 'Italy', lat: 41.8719, lon: 12.5674 },
  'spain': { name: 'Spain', lat: 40.4637, lon: -3.7492 },
  'canada': { name: 'Canada', lat: 56.1304, lon: -106.3468 },
  'australia': { name: 'Australia', lat: -25.2744, lon: 133.7751 },
  'brazil': { name: 'Brazil', lat: -14.2350, lon: -51.9253 },
  'mexico': { name: 'Mexico', lat: 23.6345, lon: -102.5528 },
  'south korea': { name: 'South Korea', lat: 35.9078, lon: 127.7669 },
  'north korea': { name: 'North Korea', lat: 40.3399, lon: 127.5101 },
  'iran': { name: 'Iran', lat: 32.4279, lon: 53.6880 },
  'iraq': { name: 'Iraq', lat: 33.2232, lon: 43.6793 },
  'syria': { name: 'Syria', lat: 34.8021, lon: 38.9968 },
  'ukraine': { name: 'Ukraine', lat: 48.3794, lon: 31.1656 },
  'israel': { name: 'Israel', lat: 31.0461, lon: 34.8516 },
  'palestine': { name: 'Palestine', lat: 31.9522, lon: 35.2332 },
  'saudi arabia': { name: 'Saudi Arabia', lat: 23.8859, lon: 45.0792 },
  'egypt': { name: 'Egypt', lat: 26.8206, lon: 30.8025 },
  'turkey': { name: 'Turkey', lat: 38.9637, lon: 35.2433 },
  'pakistan': { name: 'Pakistan', lat: 30.3753, lon: 69.3451 },
  'afghanistan': { name: 'Afghanistan', lat: 33.9391, lon: 67.7100 },
  'yemen': { name: 'Yemen', lat: 15.5527, lon: 48.5164 },
  'libya': { name: 'Libya', lat: 26.3351, lon: 17.2283 },
  'sudan': { name: 'Sudan', lat: 12.8628, lon: 30.2176 },
  'ethiopia': { name: 'Ethiopia', lat: 9.1450, lon: 38.7667 },
  'nigeria': { name: 'Nigeria', lat: 9.0820, lon: 8.6753 },
  'south africa': { name: 'South Africa', lat: -30.5595, lon: 22.9375 },
  'kenya': { name: 'Kenya', lat: -0.0236, lon: 37.9062 },
  'poland': { name: 'Poland', lat: 51.9194, lon: 19.1451 },
  'romania': { name: 'Romania', lat: 45.9432, lon: 24.9668 },
  'greece': { name: 'Greece', lat: 39.0742, lon: 21.8243 },
  'portugal': { name: 'Portugal', lat: 39.3999, lon: -8.2245 },
  'netherlands': { name: 'Netherlands', lat: 52.1326, lon: 5.2913 },
  'belgium': { name: 'Belgium', lat: 50.5039, lon: 4.4699 },
  'switzerland': { name: 'Switzerland', lat: 46.8182, lon: 8.2275 },
  'austria': { name: 'Austria', lat: 47.5162, lon: 14.5501 },
  'sweden': { name: 'Sweden', lat: 60.1282, lon: 18.6435 },
  'norway': { name: 'Norway', lat: 60.4720, lon: 8.4689 },
  'denmark': { name: 'Denmark', lat: 56.2639, lon: 9.5018 },
  'finland': { name: 'Finland', lat: 61.9241, lon: 25.7482 },
  'ireland': { name: 'Ireland', lat: 53.4129, lon: -8.2439 },
  'czech republic': { name: 'Czech Republic', lat: 49.8175, lon: 15.4730 },
  'hungary': { name: 'Hungary', lat: 47.1625, lon: 19.5033 },
  'slovakia': { name: 'Slovakia', lat: 48.6690, lon: 19.6990 },
  'croatia': { name: 'Croatia', lat: 45.1000, lon: 15.2000 },
  'serbia': { name: 'Serbia', lat: 44.0165, lon: 21.0059 },
  'bulgaria': { name: 'Bulgaria', lat: 42.7339, lon: 25.4858 },
  'albania': { name: 'Albania', lat: 41.1533, lon: 20.1683 },
  'macedonia': { name: 'North Macedonia', lat: 41.6086, lon: 21.7453 },
  'bosnia': { name: 'Bosnia and Herzegovina', lat: 43.9159, lon: 17.6791 },
  'montenegro': { name: 'Montenegro', lat: 42.7087, lon: 19.3744 },
  'kosovo': { name: 'Kosovo', lat: 42.6026, lon: 20.9030 },
  'moldova': { name: 'Moldova', lat: 47.4116, lon: 28.3699 },
  'belarus': { name: 'Belarus', lat: 53.7098, lon: 27.9534 },
  'georgia': { name: 'Georgia', lat: 42.3154, lon: 43.3569 },
  'armenia': { name: 'Armenia', lat: 40.0691, lon: 45.0382 },
  'azerbaijan': { name: 'Azerbaijan', lat: 40.1431, lon: 47.5769 },
  'kazakhstan': { name: 'Kazakhstan', lat: 48.0196, lon: 66.9237 },
  'uzbekistan': { name: 'Uzbekistan', lat: 41.3775, lon: 64.5853 },
  'turkmenistan': { name: 'Turkmenistan', lat: 38.9697, lon: 59.5563 },
  'kyrgyzstan': { name: 'Kyrgyzstan', lat: 41.2044, lon: 74.7661 },
  'tajikistan': { name: 'Tajikistan', lat: 38.8610, lon: 71.2761 },
  'mongolia': { name: 'Mongolia', lat: 46.8625, lon: 103.8467 },
  'myanmar': { name: 'Myanmar', lat: 21.9162, lon: 95.9560 },
  'thailand': { name: 'Thailand', lat: 15.8700, lon: 100.9925 },
  'vietnam': { name: 'Vietnam', lat: 14.0583, lon: 108.2772 },
  'cambodia': { name: 'Cambodia', lat: 12.5657, lon: 104.9910 },
  'laos': { name: 'Laos', lat: 19.8563, lon: 102.4955 },
  'philippines': { name: 'Philippines', lat: 12.8797, lon: 121.7740 },
  'indonesia': { name: 'Indonesia', lat: -0.7893, lon: 113.9213 },
  'malaysia': { name: 'Malaysia', lat: 4.2105, lon: 101.9758 },
  'singapore': { name: 'Singapore', lat: 1.3521, lon: 103.8198 },
  'taiwan': { name: 'Taiwan', lat: 23.6978, lon: 120.9605 },
  'sri lanka': { name: 'Sri Lanka', lat: 7.8731, lon: 80.7718 },
  'bangladesh': { name: 'Bangladesh', lat: 23.6850, lon: 90.3563 },
  'nepal': { name: 'Nepal', lat: 28.3949, lon: 84.1240 },
  'bhutan': { name: 'Bhutan', lat: 27.5142, lon: 90.4336 },
  'maldives': { name: 'Maldives', lat: 3.2028, lon: 73.2207 },
  'new zealand': { name: 'New Zealand', lat: -40.9006, lon: 174.8860 },
  'argentina': { name: 'Argentina', lat: -38.4161, lon: -63.6167 },
  'chile': { name: 'Chile', lat: -35.6751, lon: -71.5430 },
  'colombia': { name: 'Colombia', lat: 4.5709, lon: -74.2973 },
  'peru': { name: 'Peru', lat: -9.1900, lon: -75.0152 },
  'venezuela': { name: 'Venezuela', lat: 6.4238, lon: -66.5897 },
  'cuba': { name: 'Cuba', lat: 21.5218, lon: -77.7812 },
  'jamaica': { name: 'Jamaica', lat: 18.1096, lon: -77.2975 },
  'haiti': { name: 'Haiti', lat: 18.9712, lon: -72.2852 },
  'dominican republic': { name: 'Dominican Republic', lat: 18.7357, lon: -70.1627 },
  'puerto rico': { name: 'Puerto Rico', lat: 18.2208, lon: -66.5901 },
  'guatemala': { name: 'Guatemala', lat: 15.7835, lon: -90.2308 },
  'honduras': { name: 'Honduras', lat: 15.2000, lon: -86.2419 },
  'el salvador': { name: 'El Salvador', lat: 13.7942, lon: -88.8965 },
  'nicaragua': { name: 'Nicaragua', lat: 12.2650, lon: -85.2072 },
  'costa rica': { name: 'Costa Rica', lat: 9.7489, lon: -83.7534 },
  'panama': { name: 'Panama', lat: 8.5380, lon: -80.7821 },
  'ecuador': { name: 'Ecuador', lat: -1.8312, lon: -78.1834 },
  'bolivia': { name: 'Bolivia', lat: -16.2902, lon: -63.5887 },
  'paraguay': { name: 'Paraguay', lat: -23.4425, lon: -58.4438 },
  'uruguay': { name: 'Uruguay', lat: -32.5228, lon: -55.7658 },
  'guyana': { name: 'Guyana', lat: 4.8604, lon: -58.9302 },
  'suriname': { name: 'Suriname', lat: 3.9193, lon: -56.0278 },
  'french guiana': { name: 'French Guiana', lat: 3.9339, lon: -53.1258 },
  'falkland islands': { name: 'Falkland Islands', lat: -51.7963, lon: -59.5236 },
  'greenland': { name: 'Greenland', lat: 71.7069, lon: -42.6043 },
  'iceland': { name: 'Iceland', lat: 64.9631, lon: -19.0208 },
  'faroe islands': { name: 'Faroe Islands', lat: 61.8926, lon: -6.9118 },
  'svalbard': { name: 'Svalbard', lat: 77.8750, lon: 20.9752 },
  'jan mayen': { name: 'Jan Mayen', lat: 70.9794, lon: -8.4689 },
  'bouvet island': { name: 'Bouvet Island', lat: -54.4208, lon: 3.3464 },
  'heard island': { name: 'Heard Island', lat: -53.0818, lon: 73.5042 },
  'mcdonald islands': { name: 'McDonald Islands', lat: -53.0367, lon: 72.5967 },
  'french southern territories': { name: 'French Southern Territories', lat: -49.2804, lon: 69.3486 },
  'south georgia': { name: 'South Georgia', lat: -54.4296, lon: -36.5879 },
  'south sandwich islands': { name: 'South Sandwich Islands', lat: -57.0000, lon: -26.0000 },
  'british indian ocean territory': { name: 'British Indian Ocean Territory', lat: -6.0000, lon: 71.5000 },
  'christmas island': { name: 'Christmas Island', lat: -10.4475, lon: 105.6904 },
  'cocos islands': { name: 'Cocos Islands', lat: -12.1642, lon: 96.8710 },
  'norfolk island': { name: 'Norfolk Island', lat: -29.0408, lon: 167.9547 },
  'pitcairn islands': { name: 'Pitcairn Islands', lat: -24.7036, lon: -127.4393 },
  'tokelau': { name: 'Tokelau', lat: -9.2000, lon: -171.8480 },
  'niue': { name: 'Niue', lat: -19.0544, lon: -169.8672 },
  'cook islands': { name: 'Cook Islands', lat: -21.2367, lon: -159.7776 },
  'samoa': { name: 'Samoa', lat: -13.7590, lon: -172.1046 },
  'tonga': { name: 'Tonga', lat: -21.1789, lon: -175.1982 },
  'fiji': { name: 'Fiji', lat: -16.5783, lon: 179.4144 },
  'vanuatu': { name: 'Vanuatu', lat: -15.3767, lon: 166.9592 },
  'new caledonia': { name: 'New Caledonia', lat: -20.9043, lon: 165.6180 },
  'solomon islands': { name: 'Solomon Islands', lat: -9.6457, lon: 160.1562 },
  'papua new guinea': { name: 'Papua New Guinea', lat: -6.3150, lon: 143.9555 },
  'nauru': { name: 'Nauru', lat: -0.5228, lon: 166.9315 },
  'kiribati': { name: 'Kiribati', lat: -3.3704, lon: -168.7340 },
  'tuvalu': { name: 'Tuvalu', lat: -7.1095, lon: 177.6493 },
  'marshall islands': { name: 'Marshall Islands', lat: 7.1315, lon: 171.1845 },
  'micronesia': { name: 'Micronesia', lat: 7.4256, lon: 150.5508 },
  'palau': { name: 'Palau', lat: 7.5150, lon: 134.5825 },
  'guam': { name: 'Guam', lat: 13.4443, lon: 144.7937 },
  'northern mariana islands': { name: 'Northern Mariana Islands', lat: 17.3308, lon: 145.3846 },
  'american samoa': { name: 'American Samoa', lat: -14.2710, lon: -170.1322 },
  'hawaii': { name: 'Hawaii', lat: 19.8968, lon: -155.5828 },
  'alaska': { name: 'Alaska', lat: 64.2008, lon: -149.4937 },
  'prince edward island': { name: 'Prince Edward Island', lat: 46.5107, lon: -63.4168 },
  'nova scotia': { name: 'Nova Scotia', lat: 44.6820, lon: -63.7443 },
  'new brunswick': { name: 'New Brunswick', lat: 46.5653, lon: -66.4619 },
  'quebec': { name: 'Quebec', lat: 52.9399, lon: -73.5491 },
  'ontario': { name: 'Ontario', lat: 50.0000, lon: -85.0000 },
  'manitoba': { name: 'Manitoba', lat: 53.7609, lon: -98.8139 },
  'saskatchewan': { name: 'Saskatchewan', lat: 54.0000, lon: -106.0000 },
  'alberta': { name: 'Alberta', lat: 55.0000, lon: -115.0000 },
  'british columbia': { name: 'British Columbia', lat: 53.7267, lon: -127.6476 },
  'yukon': { name: 'Yukon', lat: 64.0685, lon: -139.0684 },
  'northwest territories': { name: 'Northwest Territories', lat: 64.8255, lon: -124.8457 },
  'nunavut': { name: 'Nunavut', lat: 70.2998, lon: -83.1076 }
};

/**
 * Extract location candidates from headline text
 * Returns array of LocationCandidate objects
 */
export function extractLocationCandidates(headline) {
  const candidates = [];
  const text = `${headline.title || ''} ${headline.description || ''}`.toLowerCase();
  const originalText = `${headline.title || ''} ${headline.description || ''}`;
  
  // 1. DATELINE extraction: "CITY —" or "CITY, Country —"
  const datelinePattern = /^([A-Z][A-Za-z.\- ]{2,40})(, ([A-Z][A-Za-z.\- ]{2,40}))? —/;
  const datelineMatch = originalText.match(datelinePattern);
  if (datelineMatch) {
    const city = datelineMatch[1].trim();
    const country = datelineMatch[3]?.trim();
    
    if (city) {
      candidates.push(new LocationCandidate(
        city,
        'city',
        null,
        null,
        0.9, // High confidence for datelines
        'none'
      ));
    }
    
    if (country) {
      const countryLower = country.toLowerCase();
      if (COUNTRY_ALIASES[countryLower]) {
        const alias = COUNTRY_ALIASES[countryLower];
        candidates.push(new LocationCandidate(
          alias.name,
          'country',
          alias.lat,
          alias.lon,
          0.9,
          'none'
        ));
      } else {
        candidates.push(new LocationCandidate(
          country,
          'country',
          null,
          null,
          0.8,
          'none'
        ));
      }
    }
  }
  
  // 2. Parenthetical location: "... in (City)" or "... near (City)"
  const inPattern = /\b(in|near|at|outside|inside|within|around|outside of|nearby)\s+([A-Z][A-Za-z.\- ]{2,40})\b/gi;
  let inMatch;
  while ((inMatch = inPattern.exec(originalText)) !== null) {
    const location = inMatch[2].trim();
    if (location.length > 2 && location.length < 50) {
      candidates.push(new LocationCandidate(
        location,
        'city',
        null,
        null,
        0.7,
        'none'
      ));
    }
  }
  
  // 3. Country keyword detection
  for (const [alias, data] of Object.entries(COUNTRY_ALIASES)) {
    const aliasPattern = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (aliasPattern.test(originalText)) {
      candidates.push(new LocationCandidate(
        data.name,
        'country',
        data.lat,
        data.lon,
        0.5, // Lower confidence for keyword-only matches
        'none'
      ));
    }
  }
  
  // Remove duplicates (same text, same type)
  const unique = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const key = `${candidate.text.toLowerCase()}_${candidate.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(candidate);
    }
  }
  
  return unique;
}

/**
 * Geocode a location candidate using Nominatim (OpenStreetMap)
 * Free, no API key required, but rate-limited
 */
/**
 * Validate geocoding query before sending
 */
function validateGeocodeQuery(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }
  
  const trimmed = text.trim();
  
  // Length checks
  if (trimmed.length < 2 || trimmed.length > 60) {
    return false;
  }
  
  // Word count check
  const words = trimmed.split(/\s+/);
  if (words.length > 6) {
    return false;
  }
  
  // Banned phrases (garbage patterns)
  const bannedPhrases = [
    'terms that directly relate to',
    'the same league as',
    'exposed unusual scenarios',
    'may be numbered with',
    'that directly relate'
  ];
  
  const lowerQuery = trimmed.toLowerCase();
  for (const phrase of bannedPhrases) {
    if (lowerQuery.includes(phrase)) {
      return false;
    }
  }
  
  // Must have at least one capitalized word or known place keyword
  const hasCapitalized = /[A-Z]/.test(trimmed);
  const placeKeywords = ['city', 'country', 'state', 'region', 'capital', 'island', 'mountain', 'river'];
  const hasPlaceKeyword = placeKeywords.some(kw => lowerQuery.includes(kw));
  
  if (!hasCapitalized && !hasPlaceKeyword) {
    // Check for common country/city names
    const commonPlaces = ['america', 'united states', 'uk', 'france', 'germany', 'japan', 'china', 'russia', 'india', 'brazil', 'mexico', 'canada', 'australia'];
    const hasCommonPlace = commonPlaces.some(place => lowerQuery.includes(place));
    if (!hasCommonPlace) {
      return false;
    }
  }
  
  return true;
}

export async function geocodeNominatim(candidate, options = {}) {
  // If we already have coordinates from country alias, return them
  if (candidate.lat && candidate.lon) {
    return {
      lat: candidate.lat,
      lon: candidate.lon,
      label: candidate.text,
      precision: candidate.type,
      confidence: candidate.confidence,
      geocoder: 'alias'
    };
  }
  
  // Validate query before sending
  if (!validateGeocodeQuery(candidate.text)) {
    console.warn(`[Geocoding] Skipping invalid query: "${candidate.text}"`);
    return null;
  }
  
  try {
    // Use Netlify Function proxy to avoid CORS
    const query = encodeURIComponent(candidate.text);
    const url = `/.netlify/functions/geocodeProxy?q=${query}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Geocode Proxy HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.lat && data.lon) {
      return {
        lat: data.lat,
        lon: data.lon,
        label: data.displayName || candidate.text,
        precision: data.precision || 'unknown',
        confidence: candidate.confidence * 0.9, // Slightly reduce confidence after geocoding
        geocoder: 'nominatim'
      };
    }
    
    return null;
  } catch (error) {
    console.warn(`[Geocoding] Geocode error for "${candidate.text}":`, error);
    return null;
  }
}

/**
 * Geocode queue manager
 * Processes candidates with rate limiting (max 5 per cycle)
 */
export class GeocodeQueue {
  constructor(options = {}) {
    this.queue = [];
    this.processing = false;
    this.maxPerCycle = options.maxPerCycle || 1; // Reduced to 1 to prevent spam
    this.cache = new Map(); // Cache geocoding results
    this.cacheTTL = 30 * 24 * 60 * 60 * 1000; // 30 days
    this.inFlight = new Map(); // Single-flight pattern
  }
  
  /**
   * Add candidate to queue
   */
  enqueue(candidate) {
    // Check cache first
    const cacheKey = candidate.text.toLowerCase();
    const cached = this.getCached(cacheKey);
    if (cached) {
      return Promise.resolve(cached);
    }
    
    // Check if already in queue
    const inQueue = this.queue.find(c => 
      c.text.toLowerCase() === candidate.text.toLowerCase() && 
      c.type === candidate.type
    );
    if (inQueue) {
      return Promise.resolve(null); // Already queued
    }
    
    this.queue.push(candidate);
    return Promise.resolve(null);
  }
  
  /**
   * Process queue (up to maxPerCycle)
   */
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return [];
    }
    
    this.processing = true;
    const results = [];
    const toProcess = this.queue.splice(0, this.maxPerCycle);
    
    for (const candidate of toProcess) {
      try {
        const result = await geocodeNominatim(candidate);
        if (result) {
          // Cache result
          this.setCached(candidate.text.toLowerCase(), result);
          results.push({ candidate, result });
        }
      } catch (error) {
        console.warn(`[GeocodeQueue] Error processing "${candidate.text}":`, error);
      }
      
      // Rate limit: wait 1 second between requests (Nominatim policy)
      if (toProcess.indexOf(candidate) < toProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    this.processing = false;
    return results;
  }
  
  /**
   * Get cached result
   */
  getCached(key) {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < this.cacheTTL) {
      return entry.result;
    }
    if (entry) {
      this.cache.delete(key);
    }
    return null;
  }
  
  /**
   * Set cached result
   */
  setCached(key, result) {
    this.cache.set(key, {
      result,
      timestamp: Date.now()
    });
    
    // Cleanup old entries if cache gets too large
    if (this.cache.size > 1000) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      entries.slice(0, 100).forEach(([key]) => this.cache.delete(key));
    }
  }
  
  /**
   * Load cache from localStorage
   */
  loadCache() {
    try {
      const stored = localStorage.getItem('sitmon_geocode_cache');
      if (stored) {
        const data = JSON.parse(stored);
        const now = Date.now();
        for (const [key, entry] of Object.entries(data)) {
          if (now - entry.timestamp < this.cacheTTL) {
            this.cache.set(key, entry);
          }
        }
      }
    } catch (error) {
      console.warn('[GeocodeQueue] Failed to load cache:', error);
    }
  }
  
  /**
   * Save cache to localStorage
   */
  saveCache() {
    try {
      const data = {};
      for (const [key, entry] of this.cache.entries()) {
        data[key] = entry;
      }
      localStorage.setItem('sitmon_geocode_cache', JSON.stringify(data));
    } catch (error) {
      console.warn('[GeocodeQueue] Failed to save cache:', error);
    }
  }
  
  /**
   * Get queue length
   */
  getQueueLength() {
    return this.queue.length;
  }
}
