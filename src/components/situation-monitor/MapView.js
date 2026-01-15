/**
 * ============================================================================
 * SITUATION MONITOR - MAP VIEW COMPONENT
 * ============================================================================
 * 
 * ARCHITECTURE:
 * ------------
 * This component renders a D3.js world map with event markers. It uses:
 * 
 * 1. ResizeObserver: Monitors container size changes and re-renders map
 * 2. fitSize projection: Automatically fits world data to container dimensions
 * 3. SVG viewBox: Ensures map scales cleanly at any size
 * 4. D3 joins: Efficiently updates markers without full re-render
 * 
 * DATA FLOW:
 * ---------
 * fetch → normalize → store → render
 * 
 * - Events are normalized into unified format (see EventStore)
 * - MapView receives events via updateEvents(events)
 * - Markers are rendered using D3 data joins for performance
 * 
 * ADDING NEW EVENT SOURCES:
 * -----------------------
 * 1. Add fetcher in data/fetchers.js
 * 2. Add normalizer in data/eventStore.js (normalizeEvent function)
 * 3. Add to EventPipeline in data/eventPipeline.js
 * 4. MapView will automatically render markers
 * 
 * PROJECTION SIZING:
 * -----------------
 * Uses d3.geoNaturalEarth1().fitSize([width, height], worldGeoJSON)
 * This ensures the map always fits the container correctly, regardless of
 * viewport size or layout changes.
 */

import { HOTSPOTS, CONFLICT_ZONES, CHOKEPOINTS, CABLE_POINTS, MILITARY_BASES, NUCLEAR_FACILITIES } from './data/sources.js';
import { clusterEvents, getCategoryColor, getSeverityColor } from './data/clustering.js';

export class MapView {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.options = {
      projection: options.projection || 'geoNaturalEarth1',
      ...options
    };
    
    this.svg = null;
    this.projection = null;
    this.path = null;
    this.worldData = null;
    this.tooltip = null;
    this.markers = new Map();
    this.debounceTimer = null;
    this.events = [];
    this.eventMarkers = new Map();
    this.clusterMarkers = new Map();
    this.currentZoom = 1.0;
    this.earthquakeTimeouts = new Map();
    this.resizeObserver = null;
    this.renderPending = false;
    this.container = null;
    
    // Bind methods
    this.handleResize = this.handleResize.bind(this);
    this.renderMap = this.renderMap.bind(this);
    
    this.init();
  }

  async init() {
    this.container = document.getElementById(this.containerId);
    if (!this.container) {
      console.error(`[MapView] Container #${this.containerId} not found`);
      return;
    }

    console.log('[MapView] Initializing map in container:', this.containerId);

    if (!window.d3) {
      console.error('[MapView] D3.js not available!');
      this.container.innerHTML = '<div style="padding: 2rem; color: #ff6b6b; text-align: center;">D3.js library not loaded</div>';
      return;
    }

    // Create SVG with 100% dimensions and viewBox
    this.svg = window.d3.select(this.container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', '0 0 1200 600') // Initial viewBox, will be updated
      .style('background', 'linear-gradient(135deg, rgba(5, 15, 35, 0.95) 0%, rgba(7, 21, 42, 0.95) 100%)')
      .style('display', 'block')
      .style('visibility', 'visible')
      .style('opacity', '1')
      .style('position', 'absolute')
      .style('top', '0')
      .style('left', '0');

    // Create tooltip
    this.tooltip = window.d3.select(this.container)
      .append('div')
      .attr('class', 'sitmon-tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background', 'rgba(5, 15, 35, 0.98)')
      .style('border', '1px solid rgba(74, 158, 255, 0.3)')
      .style('border-radius', '8px')
      .style('padding', '12px')
      .style('color', '#fff')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '100')
      .style('max-width', '300px')
      .style('box-shadow', '0 4px 12px rgba(0, 0, 0, 0.5)')
      .style('display', 'none');

    // Load world map data
    await this.loadWorldMap();
    
    // Wait for fonts and initial layout
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    
    // Initial render after layout
    requestAnimationFrame(() => {
      this.setupResizeObserver();
      this.renderMap();
    });
  }

  async loadWorldMap() {
    try {
      const url = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
      console.log('[MapView] Loading world map from:', url);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const topojson = await response.json();
      console.log('[MapView] TopoJSON loaded, converting to GeoJSON...');
      
      if (window.topojson && window.topojson.feature) {
        if (topojson.objects && topojson.objects.countries) {
        this.worldData = window.topojson.feature(topojson, topojson.objects.countries);
          console.log('[MapView] World map data loaded successfully, features:', this.worldData.features?.length || 0);
        } else {
          const objectKeys = Object.keys(topojson.objects || {});
          if (objectKeys.length > 0) {
            this.worldData = window.topojson.feature(topojson, topojson.objects[objectKeys[0]]);
            console.log('[MapView] Using alternative object:', objectKeys[0]);
          } else {
            throw new Error('No valid TopoJSON objects found');
          }
        }
      } else {
        console.warn('[MapView] TopoJSON library not available, creating fallback map');
        this.worldData = null;
        this.createFallbackMap();
        return;
      }
    } catch (error) {
      console.error('[MapView] Failed to load world map:', error);
      this.worldData = null;
      this.createFallbackMap();
    }
  }
  
  createFallbackMap() {
    console.log('[MapView] Creating fallback map...');
    const g = this.svg.append('g').attr('class', 'fallback-map');
    const rect = this.container.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Simple continent outlines
    g.append('path')
      .attr('d', `M ${centerX - 200} ${centerY - 50} L ${centerX - 100} ${centerY - 80} L ${centerX - 50} ${centerY - 40} L ${centerX - 80} ${centerY + 20} L ${centerX - 150} ${centerY + 10} Z`)
      .attr('fill', 'rgba(34, 211, 238, 0.08)')
      .attr('stroke', 'rgba(34, 211, 238, 0.25)')
      .attr('stroke-width', 0.4);
  }

  setupResizeObserver() {
    if (!this.container || !window.ResizeObserver) {
      // Fallback to window resize if ResizeObserver not available
      window.addEventListener('resize', this.handleResize);
      return;
    }

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === this.container) {
          this.handleResize();
        }
      }
    });

    this.resizeObserver.observe(this.container);
  }

  handleResize() {
    if (this.renderPending) return;
    
    this.renderPending = true;
    requestAnimationFrame(() => {
      this.renderMap();
      this.renderPending = false;
    });
  }

  renderMap() {
    if (!this.svg || !this.container) return;

    const rect = this.container.getBoundingClientRect();
    const width = rect.width || 1200;
    const height = rect.height || 600;

    if (width <= 0 || height <= 0) {
      console.warn('[MapView] Container has invalid dimensions:', width, height);
      return;
    }

    // Update SVG viewBox
    this.svg.attr('viewBox', `0 0 ${width} ${height}`);

    // Set up projection with fitSize
    if (this.worldData && this.worldData.features) {
      this.projection = window.d3.geoNaturalEarth1()
        .fitSize([width, height], this.worldData);
    } else {
      // Fallback projection if no world data
      const scale = width / 6.3;
      this.projection = window.d3.geoNaturalEarth1()
        .scale(scale)
        .translate([width / 2, height / 2]);
    }

    this.path = window.d3.geoPath().projection(this.projection);

    // Clear existing map elements (but keep tooltip)
    this.svg.selectAll('g.countries').remove();
    this.svg.selectAll('g.overlays').remove();
    this.svg.selectAll('g.event-markers').remove();
    this.svg.selectAll('g.event-clusters').remove();
    this.svg.selectAll('g.fallback-map').remove();

    // Render base map
    this.renderBaseMap();
    
    // Render overlays
    this.renderOverlays();
    
    // Re-render events (markers will be repositioned)
    if (this.events.length > 0) {
      this.renderEvents();
    }
  }

  renderBaseMap() {
    if (!this.worldData || !this.worldData.features || !this.path) {
      return;
    }

    const g = this.svg.append('g').attr('class', 'countries');

      g.selectAll('path')
      .data(this.worldData.features)
      .enter()
      .append('path')
      .attr('d', this.path)
      .attr('fill', 'rgba(34, 211, 238, 0.08)')
      .attr('stroke', 'rgba(34, 211, 238, 0.25)')
      .attr('stroke-width', 0.4)
      .on('mouseover', function(event) {
        window.d3.select(this)
          .attr('fill', 'rgba(34, 211, 238, 0.18)')
          .attr('stroke', 'rgba(34, 211, 238, 0.5)')
          .attr('stroke-width', 0.6);
      })
      .on('mouseout', function() {
        window.d3.select(this)
          .attr('fill', 'rgba(34, 211, 238, 0.08)')
          .attr('stroke', 'rgba(34, 211, 238, 0.25)')
          .attr('stroke-width', 0.4);
      });
  }

  renderOverlays() {
    // Render static overlays (conflict zones, hotspots, etc.)
    // These are rendered once and don't need frequent updates
    const overlaysG = this.svg.append('g').attr('class', 'overlays');
    
    // Only render if we have data
    if (CONFLICT_ZONES && CONFLICT_ZONES.length > 0) {
      this.renderConflictZones(overlaysG);
    }
  }

  renderConflictZones(container) {
    CONFLICT_ZONES.forEach(zone => {
      const [[minLat, minLon], [maxLat, maxLon]] = zone.bounds;
      const corners = [
        [minLon, minLat],
        [maxLon, minLat],
        [maxLon, maxLat],
        [minLon, maxLat],
        [minLon, minLat]
      ];

      const polygon = {
        type: 'Polygon',
        coordinates: [corners]
      };

      container.append('path')
        .datum(polygon)
        .attr('d', this.path)
        .attr('fill', zone.threatLevel === 'high' ? 'rgba(255, 107, 107, 0.12)' : 'rgba(255, 170, 0, 0.12)')
        .attr('stroke', zone.threatLevel === 'high' ? 'rgba(255, 107, 107, 0.4)' : 'rgba(255, 170, 0, 0.4)')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,4');
    });
  }

  updateEvents(events) {
    this.events = events || [];
    if (this.svg && this.projection) {
    this.renderEvents();
    }
  }
  
  renderEvents() {
    if (!this.svg || !this.projection || !this.path) return;
    
    // Remove existing event markers and clusters
    this.svg.selectAll('g.event-markers').remove();
    this.svg.selectAll('g.event-clusters').remove();
    this.eventMarkers.clear();
    this.clusterMarkers.clear();
    
    if (this.events.length === 0) return;
    
    // Cluster events
    const { individual, clusters } = clusterEvents(this.events, this.projection, {
      maxIndividual: 25,
      threshold: 28,
      currentZoom: this.currentZoom
    });
    
    // Render individual markers
    const eventG = this.svg.append('g').attr('class', 'event-markers');
    for (const event of individual) {
      this.renderEventMarker(eventG, event);
    }
    
    // Render clusters
    const clusterG = this.svg.append('g').attr('class', 'event-clusters');
    for (const cluster of clusters) {
      this.renderCluster(clusterG, cluster);
    }
  }
  
  renderEventMarker(container, event) {
    if (!event.location || !event.location.lat || !event.location.lon) return;
    
    const [x, y] = this.projection([event.location.lon, event.location.lat]);
    if (!x || !y || !isFinite(x) || !isFinite(y)) return;
    
    const color = getCategoryColor(event.category);
    const severity = event.severity || 1;
    const radius = severity >= 5 ? 8 : severity >= 4 ? 6 : 5;
    
    const marker = container.append('g')
      .attr('class', 'event-marker')
      .attr('data-event-id', event.id)
      .style('cursor', 'pointer');
    
    // Outer ring for severity 5 (pulsing effect)
    if (severity >= 5) {
      const ring = marker.append('circle')
        .attr('class', 'event-marker-ring')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', radius + 3)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 2)
        .attr('opacity', 0.6)
        .style('animation', 'pulse 2s ease-in-out infinite');
    }
    
    // Main marker circle
    const circle = marker.append('circle')
      .attr('class', 'event-marker-main')
      .attr('cx', x)
      .attr('cy', y)
      .attr('r', radius)
      .attr('fill', color)
      .attr('stroke', '#fff')
      .attr('stroke-width', severity >= 4 ? 2 : 1)
      .style('opacity', 0.9)
      .datum(event);
    
    // Hover effects
    marker.on('mouseover', (event, d) => {
      this.showEventTooltip(event, d);
      window.d3.select(event.currentTarget).select('.event-marker-main')
        .attr('r', radius + 2)
        .style('opacity', 1);
    })
    .on('mousemove', (event) => {
      this.moveTooltip(event);
    })
    .on('mouseout', (event) => {
      this.hideTooltip();
      window.d3.select(event.currentTarget).select('.event-marker-main')
        .attr('r', radius)
        .style('opacity', 0.9);
    })
    .on('click', (event, d) => {
      this.onEventClick(d);
    });
    
    this.eventMarkers.set(event.id, marker);
  }
  
  renderCluster(container, cluster) {
    const count = cluster.getCount();
    const maxSeverity = cluster.getMaxSeverity();
    const category = cluster.getDominantCategory();
    const color = getCategoryColor(category);
    
    const radius = Math.min(8 + Math.sqrt(count) * 2, 20);
    
    const clusterG = container.append('g')
      .attr('class', 'event-cluster')
      .attr('data-cluster-id', cluster.id)
      .style('cursor', 'pointer');
    
    // Outer ring for high severity clusters
    if (maxSeverity >= 4) {
      clusterG.append('circle')
        .attr('cx', cluster.x)
        .attr('cy', cluster.y)
        .attr('r', radius + 2)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.5);
    }
    
    // Cluster circle
    const circle = clusterG.append('circle')
      .attr('cx', cluster.x)
      .attr('cy', cluster.y)
      .attr('r', radius)
      .attr('fill', color)
      .attr('fill-opacity', 0.7)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .datum(cluster);
    
    // Count label
    clusterG.append('text')
      .attr('x', cluster.x)
      .attr('y', cluster.y)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#fff')
      .attr('font-size', count > 9 ? '11px' : '12px')
      .attr('font-weight', 'bold')
      .text(count);
    
    // Hover effects
    clusterG.on('mouseover', (event, d) => {
      this.showClusterTooltip(event, d);
      window.d3.select(event.currentTarget).select('circle')
        .attr('r', radius + 2)
        .attr('fill-opacity', 0.9);
    })
    .on('mousemove', (event) => {
      this.moveTooltip(event);
    })
    .on('mouseout', (event) => {
      this.hideTooltip();
      window.d3.select(event.currentTarget).select('circle')
        .attr('r', radius)
        .attr('fill-opacity', 0.7);
    })
    .on('click', (event, d) => {
      this.onClusterClick(d);
    });
    
    this.clusterMarkers.set(cluster.id, clusterG);
  }
  
  showEventTooltip(event, mapEvent) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    const mapContainer = document.getElementById(this.containerId);
    if (!mapContainer || !mapContainer.contains(event.target)) {
      return;
    }
    
    this.debounceTimer = setTimeout(() => {
      const age = mapEvent.getAgeHours ? mapEvent.getAgeHours() : 0;
      const ageText = age < 1 ? `${Math.floor(age * 60)}m ago` : 
                      age < 24 ? `${Math.floor(age)}h ago` : 
                      `${Math.floor(age / 24)}d ago`;
      
      let html = `<div style="font-weight: bold; margin-bottom: 4px;">${escapeHtml(mapEvent.title || 'Event')}</div>`;
      html += `<div style="color: rgba(255,255,255,0.7); font-size: 11px;">${escapeHtml(mapEvent.source || 'Unknown')} • ${ageText}</div>`;
      if (mapEvent.location && mapEvent.location.label) {
        html += `<div style="color: rgba(255,255,255,0.7); font-size: 11px; margin-top: 4px;">📍 ${escapeHtml(mapEvent.location.label)}</div>`;
      }
      html += `<div style="color: ${getSeverityColor(mapEvent.severity || 1)}; font-size: 11px; margin-top: 4px;">Severity: ${mapEvent.severity || 1}/5 • ${mapEvent.category || 'other'}</div>`;
      
      this.tooltip
        .html(html)
        .style('display', 'block')
        .style('opacity', 1);
      
      this.moveTooltip(event);
    }, 100);
  }
  
  showClusterTooltip(event, cluster) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    const mapContainer = document.getElementById(this.containerId);
    if (!mapContainer || !mapContainer.contains(event.target)) {
      return;
    }
    
    this.debounceTimer = setTimeout(() => {
      const count = cluster.getCount();
      const maxSeverity = cluster.getMaxSeverity();
      const category = cluster.getDominantCategory();
      
      let html = `<div style="font-weight: bold; margin-bottom: 4px;">${count} Event${count > 1 ? 's' : ''}</div>`;
      html += `<div style="color: rgba(255,255,255,0.7); font-size: 11px;">Category: ${category}</div>`;
      html += `<div style="color: ${getSeverityColor(maxSeverity)}; font-size: 11px; margin-top: 4px;">Max Severity: ${maxSeverity}/5</div>`;
      html += `<div style="color: rgba(255,255,255,0.6); font-size: 10px; margin-top: 4px;">Click to view details</div>`;
      
      this.tooltip
        .html(html)
        .style('display', 'block')
        .style('opacity', 1);
      
      this.moveTooltip(event);
    }, 100);
  }
  
  moveTooltip(event) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    const mapContainer = document.getElementById(this.containerId);
    if (!mapContainer || !mapContainer.contains(event.target)) {
      this.hideTooltip();
      return;
    }

    this.debounceTimer = setTimeout(() => {
      const rect = mapContainer.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      this.tooltip
        .style('left', (x + 10) + 'px')
        .style('top', (y - 10) + 'px');
    }, 10);
  }

  hideTooltip() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    if (this.tooltip) {
      this.tooltip
        .style('opacity', 0)
        .style('display', 'none');
    }
  }
  
  onEventClick(event) {
    const customEvent = new CustomEvent('sitmon:event-click', {
      detail: { event }
    });
    document.dispatchEvent(customEvent);
  }
  
  onClusterClick(cluster) {
    const customEvent = new CustomEvent('sitmon:cluster-click', {
      detail: { cluster }
    });
    document.dispatchEvent(customEvent);
  }

  // Legacy methods for backward compatibility
  resize(width, height) {
    // This method is kept for backward compatibility but ResizeObserver handles it now
    this.renderMap();
  }

  addEarthquake(lat, lon, magnitude) {
    const [x, y] = this.projection([lon, lat]);
    if (!x || !y || magnitude < 4.5) return;

    const g = this.svg.append('g').attr('class', 'earthquakes');
    const radius = Math.min(magnitude * 2.5, 18);
    const earthquakeId = `eq_${lat}_${lon}_${magnitude}_${Date.now()}`;

    const circle = g.append('circle')
      .attr('cx', x)
      .attr('cy', y)
      .attr('r', radius)
      .attr('fill', 'rgba(255, 107, 107, 0.25)')
      .attr('stroke', '#ff6b6b')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .style('opacity', 0)
      .transition()
      .duration(300)
      .style('opacity', 0.8);

    const timeoutId = setTimeout(() => {
      const node = circle.node();
      if (node && node.parentNode) {
        window.d3.select(node)
          .transition()
          .duration(2000)
          .style('opacity', 0)
          .on('end', function() {
            if (this.parentNode) {
              this.parentNode.removeChild(this);
            }
          });
      }
      this.earthquakeTimeouts.delete(earthquakeId);
    }, 15000);
    
    this.earthquakeTimeouts.set(earthquakeId, timeoutId);
  }
  
  clearEarthquakeTimeouts() {
    for (const timeoutId of this.earthquakeTimeouts.values()) {
      clearTimeout(timeoutId);
    }
    this.earthquakeTimeouts.clear();
  }
  
  destroy() {
    this.clearEarthquakeTimeouts();
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    if (this.tooltip) {
      this.tooltip.remove();
    }
    if (this.svg) {
      this.svg.remove();
    }
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
