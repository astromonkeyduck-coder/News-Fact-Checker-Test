/**
 * ============================================================================
 * UNIFIED EVENT STORE
 * ============================================================================
 * 
 * Normalizes events from multiple sources into a unified format:
 * - News headlines (RSS)
 * - Earthquakes (USGS)
 * - Weather alerts (NWS)
 * - Custom monitors
 * 
 * All events are normalized to the MapEvent format for consistent rendering.
 */

import { MapEvent, generateEventId } from './MapEvent.js';

/**
 * Unified Event Store
 * Manages events from all sources in a single Map by ID
 */
export class EventStore {
  constructor() {
    this.events = new Map(); // id -> MapEvent
    this.lastUpdate = null;
    this.updateCallbacks = [];
  }

  /**
   * Add or update an event
   */
  addEvent(event) {
    if (!event || !event.id) {
      console.warn('[EventStore] Invalid event:', event);
      return;
    }

    const existing = this.events.get(event.id);
    if (existing) {
      // Update existing event
      Object.assign(existing, event, {
        updatedAt: new Date().toISOString()
      });
    } else {
      // Add new event
      this.events.set(event.id, event);
    }

    this.lastUpdate = new Date();
    this.notifyUpdate();
  }

  /**
   * Add multiple events
   */
  addEvents(events) {
    if (!Array.isArray(events)) return;
    
    for (const event of events) {
      this.addEvent(event);
    }
  }

  /**
   * Remove event by ID
   */
  removeEvent(id) {
    if (this.events.delete(id)) {
      this.notifyUpdate();
    }
  }

  /**
   * Get event by ID
   */
  getEvent(id) {
    return this.events.get(id);
  }

  /**
   * Get all events
   */
  getAllEvents() {
    return Array.from(this.events.values());
  }

  /**
   * Get events filtered by criteria
   */
  getFilteredEvents(filters = {}) {
    let events = this.getAllEvents();

    // Filter by severity
    if (filters.minSeverity !== undefined) {
      events = events.filter(e => e.severity >= filters.minSeverity);
    }

    // Filter by category
    if (filters.categories && filters.categories.length > 0) {
      events = events.filter(e => filters.categories.includes(e.category));
    }

    // Filter by max age
    if (filters.maxAgeHours !== undefined) {
      const maxAge = filters.maxAgeHours;
      events = events.filter(e => {
        const age = (Date.now() - new Date(e.publishedAt).getTime()) / (1000 * 60 * 60);
        return age <= maxAge;
      });
    }

    // Filter by confidence
    if (filters.minConfidence !== undefined) {
      events = events.filter(e => (e.confidence || 0) >= filters.minConfidence);
    }

    // Sort by severity and recency
    events.sort((a, b) => {
      if (b.severity !== a.severity) {
        return b.severity - a.severity;
      }
      return new Date(b.publishedAt) - new Date(a.publishedAt);
    });

    return events;
  }

  /**
   * Subscribe to updates
   */
  onUpdate(callback) {
    this.updateCallbacks.push(callback);
    return () => {
      const index = this.updateCallbacks.indexOf(callback);
      if (index >= 0) {
        this.updateCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Notify all subscribers
   */
  notifyUpdate() {
    for (const callback of this.updateCallbacks) {
      try {
        callback(this.getAllEvents());
      } catch (error) {
        console.error('[EventStore] Update callback error:', error);
      }
    }
  }

  /**
   * Clear all events
   */
  clear() {
    this.events.clear();
    this.notifyUpdate();
  }

  /**
   * Get stats
   */
  getStats() {
    const events = this.getAllEvents();
    const byCategory = {};
    const bySeverity = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    
    for (const event of events) {
      byCategory[event.category] = (byCategory[event.category] || 0) + 1;
      bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
    }

    return {
      total: events.length,
      byCategory,
      bySeverity,
      lastUpdate: this.lastUpdate
    };
  }
}

/**
 * Normalize an earthquake to MapEvent
 */
export function normalizeEarthquake(eq) {
  const id = `eq_${eq.id || eq.canonical_id || `${eq.latitude}_${eq.longitude}_${eq.time}`}`;
  
  // Determine severity from magnitude
  let severity = 1;
  if (eq.magnitude >= 7.0) severity = 5;
  else if (eq.magnitude >= 6.0) severity = 4;
  else if (eq.magnitude >= 5.0) severity = 3;
  else if (eq.magnitude >= 4.5) severity = 2;

  return new MapEvent({
    id,
    kind: 'earthquake',
    category: 'disaster',
    severity,
    title: `Earthquake M${eq.magnitude?.toFixed(1) || 'N/A'} - ${eq.place || 'Unknown location'}`,
    source: 'USGS',
    url: eq.url || `https://earthquake.usgs.gov/earthquakes/eventpage/${eq.id}`,
    publishedAt: eq.time ? new Date(eq.time).toISOString() : new Date().toISOString(),
    location: {
      lat: eq.latitude || eq.lat,
      lon: eq.longitude || eq.lon,
      label: eq.place || 'Unknown',
      precision: 'exact',
      confidence: 1.0
    },
    confidence: 1.0,
    regionTag: [],
    topicTags: ['SEISMIC'],
    summary: `Magnitude ${eq.magnitude?.toFixed(1)} earthquake at depth ${eq.depth?.toFixed(1)}km`
  });
}

/**
 * Normalize a weather alert to MapEvent
 */
export function normalizeWeatherAlert(alert) {
  const id = `weather_${alert.id || alert.identifier || `${alert.event}_${alert.sent}`}`;
  
  // Determine severity from alert severity
  let severity = 2;
  if (alert.severity === 'extreme') severity = 5;
  else if (alert.severity === 'severe') severity = 4;
  else if (alert.severity === 'moderate') severity = 3;
  else if (alert.severity === 'minor') severity = 2;
  else severity = 1;

  // Extract location from areas or headline
  let location = null;
  if (alert.areas) {
    // Try to geocode the first area (simplified - would need actual geocoding)
    location = {
      label: alert.areas,
      precision: 'region',
      confidence: 0.7
    };
  }

  return new MapEvent({
    id,
    kind: 'weather',
    category: 'weather',
    severity,
    title: alert.headline || alert.event || 'Weather Alert',
    source: 'NWS',
    url: alert.url,
    publishedAt: alert.sent ? new Date(alert.sent).toISOString() : new Date().toISOString(),
    location,
    confidence: 0.8,
    regionTag: [],
    topicTags: ['WEATHER'],
    summary: alert.description || alert.headline
  });
}

/**
 * Normalize a news headline to MapEvent
 * (Uses existing headlineToMapEvent but ensures it's a MapEvent instance)
 */
export function normalizeNewsHeadline(headline, category = 'other', severity = 2, location = null) {
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
    location,
    confidence: location ? (location.confidence || 0.6) : 0.3,
    regionTag: headline.regionTag || [],
    topicTags: headline.topicTags || [],
    summary: headline.description || headline.snippet || ''
  });
}

/**
 * Normalize a custom monitor match to MapEvent
 */
export function normalizeMonitorMatch(monitor, match) {
  const id = `monitor_${monitor.id}_${match.id || Date.now()}`;
  
  return new MapEvent({
    id,
    kind: 'monitor',
    category: monitor.category || 'other',
    severity: monitor.severity || match.severity || 2,
    title: match.title || monitor.name || 'Monitor Match',
    source: monitor.name || 'Custom Monitor',
    url: match.url || monitor.url,
    publishedAt: match.timestamp ? new Date(match.timestamp).toISOString() : new Date().toISOString(),
    location: monitor.lat && monitor.lon ? {
      lat: monitor.lat,
      lon: monitor.lon,
      label: monitor.location || 'Unknown',
      precision: 'exact',
      confidence: 1.0
    } : null,
    confidence: 0.9,
    regionTag: monitor.regions || [],
    topicTags: monitor.tags || [],
    summary: match.description || match.title
  });
}

/**
 * Create a singleton EventStore instance
 */
export const globalEventStore = new EventStore();
