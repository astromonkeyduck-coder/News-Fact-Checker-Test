/**
 * D3-based Point Clustering for Map Events
 * Ensures max 25 individual markers at world zoom
 */

/**
 * Cluster configuration
 */
const CLUSTER_CONFIG = {
  maxIndividualMarkers: 25,
  clusterDistanceThreshold: 28, // pixels
  minZoomForClustering: 0.5, // Below this zoom level, cluster more aggressively
  maxClusterRadius: 50 // pixels - max radius for a cluster
};

/**
 * Cluster class
 */
export class Cluster {
  constructor(x, y, events = []) {
    this.x = x;
    this.y = y;
    this.events = events;
    this.id = `cluster_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get dominant category (most common category in cluster)
   */
  getDominantCategory() {
    const categoryCounts = new Map();
    for (const event of this.events) {
      const count = categoryCounts.get(event.category) || 0;
      categoryCounts.set(event.category, count + 1);
    }
    
    let maxCount = 0;
    let dominant = 'other';
    for (const [category, count] of categoryCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        dominant = category;
      }
    }
    
    return dominant;
  }
  
  /**
   * Get max severity in cluster
   */
  getMaxSeverity() {
    return Math.max(...this.events.map(e => e.severity), 0);
  }
  
  /**
   * Get count
   */
  getCount() {
    return this.events.length;
  }
  
  /**
   * Get bounds (for zoom-to-cluster)
   */
  getBounds() {
    if (this.events.length === 0) return null;
    
    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;
    
    for (const event of this.events) {
      if (event.location) {
        minLat = Math.min(minLat, event.location.lat);
        maxLat = Math.max(maxLat, event.location.lat);
        minLon = Math.min(minLon, event.location.lon);
        maxLon = Math.max(maxLon, event.location.lon);
      }
    }
    
    return { minLat, maxLat, minLon, maxLon };
  }
}

/**
 * Simple distance-based clustering algorithm
 * Groups points within threshold distance (in pixels)
 */
function clusterPoints(projectedPoints, threshold) {
  const clusters = [];
  const used = new Set();
  
  for (let i = 0; i < projectedPoints.length; i++) {
    if (used.has(i)) continue;
    
    const point = projectedPoints[i];
    const cluster = new Cluster(point.x, point.y, [point.event]);
    used.add(i);
    
    // Find nearby points
    for (let j = i + 1; j < projectedPoints.length; j++) {
      if (used.has(j)) continue;
      
      const otherPoint = projectedPoints[j];
      const dx = point.x - otherPoint.x;
      const dy = point.y - otherPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= threshold) {
        cluster.events.push(otherPoint.event);
        // Update cluster center (average)
        cluster.x = (cluster.x * (cluster.events.length - 1) + otherPoint.x) / cluster.events.length;
        cluster.y = (cluster.y * (cluster.events.length - 1) + otherPoint.y) / cluster.events.length;
        used.add(j);
      }
    }
    
    clusters.push(cluster);
  }
  
  return clusters;
}

/**
 * Cluster events for map display
 * Returns { individual: MapEvent[], clusters: Cluster[] }
 */
export function clusterEvents(events, projection, options = {}) {
  const {
    maxIndividual = CLUSTER_CONFIG.maxIndividualMarkers,
    threshold = CLUSTER_CONFIG.clusterDistanceThreshold,
    currentZoom = 1.0
  } = options;
  
  if (events.length === 0) {
    return { individual: [], clusters: [] };
  }
  
  // Project all events to screen coordinates
  const projectedPoints = [];
  for (const event of events) {
    if (!event.location || !event.location.lat || !event.location.lon) continue;
    
    const [x, y] = projection([event.location.lon, event.location.lat]);
    if (x == null || y == null || !isFinite(x) || !isFinite(y)) continue;
    
    projectedPoints.push({ x, y, event });
  }
  
  if (projectedPoints.length === 0) {
    return { individual: [], clusters: [] };
  }
  
  // If we have fewer points than max, show all individually
  if (projectedPoints.length <= maxIndividual) {
    return {
      individual: projectedPoints.map(p => p.event),
      clusters: []
    };
  }
  
  // Adjust threshold based on zoom level
  // At lower zoom (world view), use larger threshold to cluster more aggressively
  const adjustedThreshold = currentZoom < CLUSTER_CONFIG.minZoomForClustering
    ? threshold * 1.5
    : threshold;
  
  // Perform clustering
  const clusters = clusterPoints(projectedPoints, adjustedThreshold);
  
  // Separate into individual markers and clusters
  const individual = [];
  const clusterList = [];
  
  // Sort clusters by size (largest first) and severity
  clusters.sort((a, b) => {
    if (b.getCount() !== a.getCount()) {
      return b.getCount() - a.getCount();
    }
    return b.getMaxSeverity() - a.getMaxSeverity();
  });
  
  // Keep top N individual markers (by severity/recency)
  // Sort events by priority
  const sortedEvents = [...projectedPoints]
    .sort((a, b) => {
      // First by severity
      if (b.event.severity !== a.event.severity) {
        return b.event.severity - a.event.severity;
      }
      // Then by recency
      const aTime = new Date(a.event.publishedAt).getTime();
      const bTime = new Date(b.event.publishedAt).getTime();
      return bTime - aTime;
    });
  
  // Mark which events are in clusters
  const inCluster = new Set();
  for (const cluster of clusters) {
    if (cluster.getCount() > 1) {
      for (const event of cluster.events) {
        inCluster.add(event.id);
      }
    }
  }
  
  // Add individual markers (not in clusters, top priority)
  let individualCount = 0;
  for (const { event } of sortedEvents) {
    if (individualCount >= maxIndividual) break;
    if (!inCluster.has(event.id)) {
      individual.push(event);
      individualCount++;
    }
  }
  
  // Add clusters (only clusters with 2+ events)
  for (const cluster of clusters) {
    if (cluster.getCount() > 1) {
      clusterList.push(cluster);
    } else if (cluster.getCount() === 1 && individualCount < maxIndividual) {
      // Single-event "clusters" become individual markers if we have room
      individual.push(cluster.events[0]);
      individualCount++;
    }
  }
  
  return {
    individual: individual.slice(0, maxIndividual),
    clusters: clusterList
  };
}

/**
 * Get category color for visualization
 */
export function getCategoryColor(category) {
  const colors = {
    conflict: '#ff6b6b',
    terror: '#ff3333',
    crime: '#ff8c42',
    disaster: '#ffaa00',
    weather: '#4A90E2',
    cyber: '#9b59b6',
    health: '#e74c3c',
    economy: '#f39c12',
    politics: '#3498db',
    nuclear: '#ff0000',
    other: '#95a5a6'
  };
  
  return colors[category] || colors.other;
}

/**
 * Get severity color
 */
export function getSeverityColor(severity) {
  const colors = {
    5: '#ff0000', // Critical - bright red
    4: '#ff6b6b', // High - red
    3: '#ffaa00', // Elevated - orange
    2: '#4A90E2', // Low - blue
    1: '#95a5a6'  // Ignore - gray
  };
  
  return colors[severity] || colors[1];
}
