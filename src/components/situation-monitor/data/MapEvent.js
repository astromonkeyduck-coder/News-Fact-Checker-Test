/**
 * Map Event Model and Conversion Pipeline
 * Converts news headlines into geocoded map events
 */

/**
 * LocationCandidate - represents a potential location extracted from text
 */
export class LocationCandidate {
  constructor(text, type, lat = null, lon = null, confidence = 0, geocoder = 'none') {
    this.text = text;
    this.type = type; // 'city' | 'region' | 'country'
    this.lat = lat;
    this.lon = lon;
    this.confidence = confidence; // 0-1
    this.geocoder = geocoder; // 'nominatim' | 'geonames' | 'opencage' | 'none'
  }
}

/**
 * MapEvent - canonical event model for map display
 */
export class MapEvent {
  constructor(data) {
    this.id = data.id; // stable hash
    this.kind = data.kind; // 'news' | 'quake' | 'monitor'
    this.category = data.category; // 'conflict' | 'crime' | 'terror' | 'disaster' | 'weather' | 'cyber' | 'politics' | 'economy' | 'health' | 'other'
    this.severity = data.severity; // 1-5 (5 = critical)
    this.title = data.title;
    this.source = data.source;
    this.url = data.url;
    this.publishedAt = data.publishedAt; // ISO string
    this.detectedLocations = data.detectedLocations || []; // LocationCandidate[]
    this.location = data.location; // { lat, lon, label, precision, confidence }
    this.confidence = data.confidence || 0; // 0-1
    this.regionTag = data.regionTag || []; // e.g. ['EUROPE', 'MENA']
    this.topicTags = data.topicTags || []; // e.g. ['NUCLEAR', 'CYBER']
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Check if event should be displayed on map
   */
  shouldDisplay(minSeverity = 2, minConfidence = 0.6, showLowConfidence = false) {
    if (this.severity >= 4) return true; // Always show high severity
    if (this.confidence >= minConfidence) return true;
    if (showLowConfidence && this.confidence >= 0.2) return true;
    return false;
  }

  /**
   * Check if event has expired (time decay)
   */
  isExpired(maxAgeHours = 24) {
    const age = (Date.now() - new Date(this.publishedAt).getTime()) / (1000 * 60 * 60);
    return age > maxAgeHours;
  }

  /**
   * Get age in hours
   */
  getAgeHours() {
    return (Date.now() - new Date(this.publishedAt).getTime()) / (1000 * 60 * 60);
  }
}

/**
 * Generate stable event ID from headline data
 * Hash: normalized title + source + date bucket (hour) + url
 */
export function generateEventId(headline) {
  const normalize = (str) => str.toLowerCase().trim().replace(/\s+/g, ' ');
  const title = normalize(headline.title || '');
  const source = normalize(headline.source || '');
  const url = headline.link || headline.url || '';
  
  // Date bucket: round to nearest hour
  const date = new Date(headline.timestamp || headline.pubDate || Date.now());
  const dateBucket = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()).toISOString();
  
  const hashString = `${title}|${source}|${dateBucket}|${url}`;
  
  // Simple hash function (djb2-like)
  let hash = 5381;
  for (let i = 0; i < hashString.length; i++) {
    hash = ((hash << 5) + hash) + hashString.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return `event_${Math.abs(hash).toString(36)}`;
}

/**
 * Convert headline to MapEvent (without geocoding)
 * Geocoding happens separately in geocoding pipeline
 */
export function headlineToMapEvent(headline, category = 'other', severity = 2) {
  const id = generateEventId(headline);
  
  return new MapEvent({
    id,
    kind: 'news',
    category,
    severity,
    title: headline.title || '',
    source: headline.source || 'Unknown',
    url: headline.link || headline.url || '',
    publishedAt: headline.timestamp 
      ? new Date(headline.timestamp).toISOString()
      : (headline.pubDate ? new Date(headline.pubDate).toISOString() : new Date().toISOString()),
    detectedLocations: [], // Will be populated by location extraction
    location: null, // Will be populated by geocoding
    confidence: 0, // Will be set after geocoding
    regionTag: [],
    topicTags: []
  });
}

/**
 * Deduplicate events by ID
 */
export function deduplicateEvents(events) {
  const seen = new Map();
  const unique = [];
  
  for (const event of events) {
    if (!seen.has(event.id)) {
      seen.set(event.id, event);
      unique.push(event);
    } else {
      // Update existing event if this one is newer
      const existing = seen.get(event.id);
      const existingTime = new Date(existing.publishedAt).getTime();
      const newTime = new Date(event.publishedAt).getTime();
      if (newTime > existingTime) {
        const index = unique.indexOf(existing);
        if (index >= 0) {
          unique[index] = event;
        }
        seen.set(event.id, event);
      }
    }
  }
  
  return unique;
}

/**
 * Filter events by criteria
 */
export function filterEvents(events, options = {}) {
  const {
    minSeverity = 2,
    minConfidence = 0.6,
    showLowConfidence = false,
    maxAgeHours = 24,
    categories = null, // null = all categories
    kinds = null // null = all kinds
  } = options;
  
  return events.filter(event => {
    // Time decay
    if (event.isExpired(maxAgeHours)) return false;
    
    // Severity/confidence filter
    if (!event.shouldDisplay(minSeverity, minConfidence, showLowConfidence)) return false;
    
    // Category filter
    if (categories && !categories.includes(event.category)) return false;
    
    // Kind filter
    if (kinds && !kinds.includes(event.kind)) return false;
    
    return true;
  });
}

/**
 * Sort events by priority (severity desc, then recency desc)
 */
export function sortEventsByPriority(events) {
  return [...events].sort((a, b) => {
    // First by severity (higher = first)
    if (b.severity !== a.severity) {
      return b.severity - a.severity;
    }
    // Then by recency (newer = first)
    const aTime = new Date(a.publishedAt).getTime();
    const bTime = new Date(b.publishedAt).getTime();
    return bTime - aTime;
  });
}
