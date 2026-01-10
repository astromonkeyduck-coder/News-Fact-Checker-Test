/**
 * Event Pipeline
 * Converts news headlines to geocoded map events
 */

import { MapEvent, headlineToMapEvent, deduplicateEvents, filterEvents, sortEventsByPriority } from './MapEvent.js';
import { extractLocationCandidates, GeocodeQueue } from './geocoding.js';
import { calculateSeverity, classifyCategory, extractTopicTags, extractRegionTags, checkMultiSourceMention } from './classification.js';

/**
 * Event Pipeline Manager
 */
export class EventPipeline {
  constructor(options = {}) {
    this.geocodeQueue = new GeocodeQueue({ maxPerCycle: options.maxGeocodePerCycle || 5 });
    this.processedEvents = new Map(); // Track processed event IDs
    this.options = {
      minSeverity: options.minSeverity || 2,
      minConfidence: options.minConfidence || 0.6,
      showLowConfidence: options.showLowConfidence || false,
      maxAgeHours: options.maxAgeHours || 24,
      ...options
    };
    
    // Load geocode cache
    this.geocodeQueue.loadCache();
  }
  
  /**
   * Process headlines into MapEvents
   */
  async processHeadlines(headlines) {
    const events = [];
    
    // Step 1: Convert headlines to MapEvents (without geocoding)
    for (const headline of headlines) {
      // Classify category and severity
      const category = classifyCategory(headline);
      let severity = calculateSeverity(headline);
      
      // Boost severity if multiple sources mention same topic
      if (checkMultiSourceMention(headlines, headline)) {
        severity = Math.min(severity + 1, 5);
      }
      
      // Skip if severity too low
      if (severity < this.options.minSeverity) {
        continue;
      }
      
      // Create MapEvent
      const event = headlineToMapEvent(headline, category, severity);
      
      // Extract location candidates
      const candidates = extractLocationCandidates(headline);
      event.detectedLocations = candidates;
      
      // Extract tags
      event.topicTags = extractTopicTags(headline);
      
      // If we have location candidates, add to geocode queue
      if (candidates.length > 0) {
        // Use best candidate (highest confidence)
        const bestCandidate = candidates.reduce((best, current) => 
          current.confidence > (best?.confidence || 0) ? current : best
        );
        
        // Enqueue for geocoding
        await this.geocodeQueue.enqueue(bestCandidate);
      }
      
      events.push(event);
    }
    
    // Step 2: Process geocode queue (up to maxPerCycle)
    const geocodeResults = await this.geocodeQueue.processQueue();
    
    // Step 3: Match geocoded results to events
    const geocodeMap = new Map();
    for (const { candidate, result } of geocodeResults) {
      geocodeMap.set(candidate.text.toLowerCase(), result);
    }
    
    // Step 4: Assign locations to events
    for (const event of events) {
      if (event.detectedLocations.length > 0) {
        const bestCandidate = event.detectedLocations.reduce((best, current) => 
          current.confidence > (best?.confidence || 0) ? current : best
        );
        
        // Check if we have a geocoded result
        const geocoded = geocodeMap.get(bestCandidate.text.toLowerCase());
        
        if (geocoded) {
          event.location = {
            lat: geocoded.lat,
            lon: geocoded.lon,
            label: geocoded.label,
            precision: geocoded.precision,
            confidence: geocoded.confidence
          };
          event.confidence = geocoded.confidence;
        } else if (bestCandidate.lat && bestCandidate.lon) {
          // Use country alias coordinates
          event.location = {
            lat: bestCandidate.lat,
            lon: bestCandidate.lon,
            label: bestCandidate.text,
            precision: bestCandidate.type,
            confidence: bestCandidate.confidence
          };
          event.confidence = bestCandidate.confidence;
        }
        
        // Extract region tags based on location
        if (event.location) {
          event.regionTag = extractRegionTags(
            { title: event.title, description: '' },
            event.location
          );
        }
      }
    }
    
    // Step 5: Filter events (only those with valid locations and sufficient confidence/severity)
    const filtered = filterEvents(events, {
      minSeverity: this.options.minSeverity,
      minConfidence: this.options.minConfidence,
      showLowConfidence: this.options.showLowConfidence,
      maxAgeHours: this.options.maxAgeHours
    }).filter(event => {
      // Must have location to display on map
      return event.location && event.location.lat && event.location.lon;
    });
    
    // Step 6: Deduplicate
    const unique = deduplicateEvents(filtered);
    
    // Step 7: Sort by priority
    const sorted = sortEventsByPriority(unique);
    
    return sorted;
  }
  
  /**
   * Process and merge with existing events
   */
  async processAndMerge(headlines, existingEvents = []) {
    const newEvents = await this.processHeadlines(headlines);
    
    // Merge with existing events
    const allEvents = [...existingEvents, ...newEvents];
    
    // Deduplicate again (in case of overlap)
    const unique = deduplicateEvents(allEvents);
    
    // Filter by time decay
    const filtered = unique.filter(event => !event.isExpired(this.options.maxAgeHours));
    
    // Sort by priority
    return sortEventsByPriority(filtered);
  }
  
  /**
   * Get geocode queue status
   */
  getGeocodeQueueStatus() {
    return {
      queueLength: this.geocodeQueue.getQueueLength(),
      processing: this.geocodeQueue.processing
    };
  }
  
  /**
   * Save geocode cache
   */
  saveCache() {
    this.geocodeQueue.saveCache();
  }
}
