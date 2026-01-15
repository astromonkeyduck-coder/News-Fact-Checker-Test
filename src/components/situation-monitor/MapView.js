/**
 * D3 + TopoJSON Map Component
 */

// D3 is loaded from CDN in HTML
// TopoJSON is loaded from CDN in HTML
import { HOTSPOTS, CONFLICT_ZONES, CHOKEPOINTS, CABLE_POINTS, MILITARY_BASES, NUCLEAR_FACILITIES } from './data/sources.js';
import { clusterEvents, getCategoryColor, getSeverityColor } from './data/clustering.js';

export class MapView {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.options = {
      width: options.width || 1200,
      height: options.height || 600,
      projection: options.projection || 'geoMercator',
      ...options
    };
    
    this.svg = null;
    this.projection = null;
    this.path = null;
    this.worldData = null;
    this.tooltip = null;
    this.markers = new Map();
    this.debounceTimer = null;
    this.events = []; // MapEvent array
    this.eventMarkers = new Map(); // Track event markers
    this.clusterMarkers = new Map(); // Track cluster markers
    this.currentZoom = 1.0; // Track zoom level for clustering
    this.earthquakeTimeouts = new Map(); // Track earthquake fade-out timeouts
    
    this.init();
  }

  async init() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`[MapView] Container #${this.containerId} not found`);
      return;
    }

    console.log('[MapView] Initializing map in container:', this.containerId);

    // Check if D3 is available
    if (!window.d3) {
      console.error('[MapView] D3.js not available!');
      container.innerHTML = '<div style="padding: 2rem; color: #ff6b6b; text-align: center;">D3.js library not loaded</div>';
      return;
    }

    // Create SVG (d3 loaded from CDN)
    this.svg = window.d3.select(container)
      .append('svg')
      .attr('width', this.options.width)
      .attr('height', this.options.height)
      .attr('viewBox', `0 0 ${this.options.width} ${this.options.height}`)
      .style('background', 'linear-gradient(135deg, rgba(5, 15, 35, 0.95) 0%, rgba(7, 21, 42, 0.95) 100%)')
      .style('display', 'block')
      .style('visibility', 'visible')
      .style('opacity', '1');

    console.log('[MapView] SVG created, dimensions:', this.options.width, 'x', this.options.height);

    // Create tooltip - only visible within map container
    const mapContainer = document.getElementById(this.containerId);
    this.tooltip = window.d3.select(mapContainer || 'body')
      .append('div')
      .attr('class', 'sitmon-tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background', 'rgba(5, 15, 35, 0.95)')
      .style('border', '1px solid rgba(74, 158, 255, 0.3)')
      .style('border-radius', '8px')
      .style('padding', '12px')
      .style('color', '#fff')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '10') // Lower z-index, only above map
      .style('max-width', '300px')
      .style('box-shadow', '0 4px 12px rgba(0, 0, 0, 0.5)')
      .style('display', 'none'); // Hidden by default

    // Set up projection - minimize Antarctica visibility
    // Use a larger scale and shift center significantly up to focus on populated areas
    const scale = this.options.width / 5.8; // Larger scale to zoom in more
    const centerY = this.options.height / 2.3; // Shift center further up to reduce Antarctica
    
    this.projection = window.d3.geoMercator()
      .scale(scale)
      .translate([this.options.width / 2, centerY])
      .center([0, 30]); // Center on 30°N to focus on populated regions (moves viewport up)

    this.path = window.d3.geoPath().projection(this.projection);
    console.log('[MapView] Projection configured');

    // Load world map data
    await this.loadWorldMap();
    
    // Render base map (will render fallback if worldData is null)
    this.renderBaseMap();
    
    // Render overlays
    this.renderOverlays();
    
    console.log('[MapView] Map initialization complete');
  }

  async loadWorldMap() {
    try {
      // Use Natural Earth 110m countries (free, public domain)
      const url = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
      console.log('[MapView] Loading world map from:', url);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const topojson = await response.json();
      console.log('[MapView] TopoJSON loaded, converting to GeoJSON...');
      
      // Convert to GeoJSON using topojson library (loaded from CDN)
      if (window.topojson && window.topojson.feature) {
        if (topojson.objects && topojson.objects.countries) {
          this.worldData = window.topojson.feature(topojson, topojson.objects.countries);
          console.log('[MapView] World map data loaded successfully, features:', this.worldData.features?.length || 0);
        } else {
          console.warn('[MapView] TopoJSON missing countries object, trying alternative...');
          // Try alternative structure
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
      // Create a fallback simple map
      this.worldData = null;
      this.createFallbackMap();
    }
  }
  
  /**
   * Create a simple fallback map if world data fails to load
   */
  createFallbackMap() {
    console.log('[MapView] Creating fallback map...');
    // Create a simple grid/outline as fallback
    const g = this.svg.append('g').attr('class', 'fallback-map');
    
    // Draw a simple world outline using basic shapes
    // This is a very basic representation
    const centerX = this.options.width / 2;
    const centerY = this.options.height / 2;
    
    // Draw continents as simple shapes (very basic representation)
    // North America
    g.append('path')
      .attr('d', `M ${centerX - 200} ${centerY - 50} L ${centerX - 100} ${centerY - 80} L ${centerX - 50} ${centerY - 40} L ${centerX - 80} ${centerY + 20} L ${centerX - 150} ${centerY + 10} Z`)
      .attr('fill', 'rgba(34, 211, 238, 0.08)')
      .attr('stroke', 'rgba(34, 211, 238, 0.25)')
      .attr('stroke-width', 0.4);
    
    // South America
    g.append('path')
      .attr('d', `M ${centerX - 150} ${centerY + 20} L ${centerX - 100} ${centerY + 10} L ${centerX - 80} ${centerY + 60} L ${centerX - 120} ${centerY + 80} L ${centerX - 160} ${centerY + 70} Z`)
      .attr('fill', 'rgba(34, 211, 238, 0.08)')
      .attr('stroke', 'rgba(34, 211, 238, 0.25)')
      .attr('stroke-width', 0.4);
    
    // Europe/Africa
    g.append('path')
      .attr('d', `M ${centerX - 50} ${centerY - 60} L ${centerX + 50} ${centerY - 70} L ${centerX + 80} ${centerY - 20} L ${centerX + 60} ${centerY + 40} L ${centerX - 20} ${centerY + 50} L ${centerX - 40} ${centerY - 10} Z`)
      .attr('fill', 'rgba(34, 211, 238, 0.08)')
      .attr('stroke', 'rgba(34, 211, 238, 0.25)')
      .attr('stroke-width', 0.4);
    
    // Asia
    g.append('path')
      .attr('d', `M ${centerX + 60} ${centerY - 70} L ${centerX + 200} ${centerY - 80} L ${centerX + 220} ${centerY - 20} L ${centerX + 180} ${centerY + 30} L ${centerX + 100} ${centerY + 20} L ${centerX + 80} ${centerY - 10} Z`)
      .attr('fill', 'rgba(34, 211, 238, 0.08)')
      .attr('stroke', 'rgba(34, 211, 238, 0.25)')
      .attr('stroke-width', 0.4);
    
    console.log('[MapView] Fallback map created');
  }

  renderBaseMap() {
    if (!this.worldData || !this.worldData.features) {
      console.warn('[MapView] No world data available, skipping base map render');
      return;
    }

    console.log('[MapView] Rendering base map with', this.worldData.features.length, 'features');
    const g = this.svg.append('g').attr('class', 'countries');

    g.selectAll('path')
      .data(this.worldData.features)
      .enter()
      .append('path')
      .attr('d', this.path)
      .attr('fill', 'rgba(34, 211, 238, 0.08)')
      .attr('stroke', 'rgba(34, 211, 238, 0.25)')
      .attr('stroke-width', 0.4)
      .on('mouseover', function(event, d) {
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
    
    console.log('[MapView] Base map rendered successfully');
  }

  renderOverlays() {
    // Only render overlays if we have actual data to display
    // For now, we'll skip these until real data is available
    // This prevents showing empty/floating markers
    
    // Uncomment these when you have actual data:
    // this.renderConflictZones();
    // this.renderHotspots();
    // this.renderChokepoints();
    // this.renderCablePoints();
    // this.renderMilitaryBases();
    // this.renderNuclearFacilities();
  }

  renderConflictZones() {
    // Only render if we have actual conflict zone data
    if (!CONFLICT_ZONES || CONFLICT_ZONES.length === 0) return;
    
    const g = this.svg.append('g').attr('class', 'conflict-zones');

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

      g.append('path')
        .datum(polygon)
        .attr('d', this.path)
        .attr('fill', zone.threatLevel === 'high' ? 'rgba(255, 107, 107, 0.12)' : 'rgba(255, 170, 0, 0.12)')
        .attr('stroke', zone.threatLevel === 'high' ? 'rgba(255, 107, 107, 0.4)' : 'rgba(255, 170, 0, 0.4)')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,4');
    });
  }

  renderHotspots() {
    // Only render if we have actual hotspot data
    if (!HOTSPOTS || HOTSPOTS.length === 0) return;
    
    const g = this.svg.append('g').attr('class', 'hotspots');

    HOTSPOTS.forEach(hotspot => {
      const [x, y] = this.projection([hotspot.lon, hotspot.lat]);
      if (!x || !y) return;

      const color = hotspot.threatLevel === 'high' ? '#ff6b6b' : '#ffaa00';
      
      const circle = g.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 5)
        .attr('fill', color)
        .attr('stroke', 'rgba(255, 255, 255, 0.9)')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .style('opacity', 0.85)
        .on('mouseover', (event) => {
          this.showTooltip(event, {
            title: hotspot.name,
            threatLevel: hotspot.threatLevel,
            category: hotspot.category
          });
          window.d3.select(event.currentTarget)
            .attr('r', 7)
            .style('opacity', 1);
        })
        .on('mousemove', (event) => {
          this.moveTooltip(event);
        })
        .on('mouseout', (event) => {
          this.hideTooltip();
          window.d3.select(event.currentTarget)
            .attr('r', 5)
            .style('opacity', 0.85);
        });
    });
  }

  renderChokepoints() {
    // Only render if we have actual chokepoint data
    if (!CHOKEPOINTS || CHOKEPOINTS.length === 0) return;
    
    const g = this.svg.append('g').attr('class', 'chokepoints');

    CHOKEPOINTS.forEach(point => {
      const [x, y] = this.projection([point.lon, point.lat]);
      if (!x || !y) return;

      g.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 4)
        .attr('fill', '#4A90E2')
        .attr('stroke', 'rgba(255, 255, 255, 0.9)')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .on('mouseover', (event) => {
          this.showTooltip(event, {
            title: point.name,
            type: 'Shipping Chokepoint'
          });
        })
        .on('mousemove', (event) => {
          this.moveTooltip(event);
        })
        .on('mouseout', () => {
          this.hideTooltip();
        });
    });
  }

  renderCablePoints() {
    // Only render if we have actual cable point data
    if (!CABLE_POINTS || CABLE_POINTS.length === 0) return;
    
    const g = this.svg.append('g').attr('class', 'cable-points');

    CABLE_POINTS.forEach(point => {
      const [x, y] = this.projection([point.lon, point.lat]);
      if (!x || !y) return;

      g.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 3)
        .attr('fill', '#22d3ee')
        .attr('stroke', 'rgba(255, 255, 255, 0.9)')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .on('mouseover', (event) => {
          this.showTooltip(event, {
            title: point.name,
            type: 'Cable Landing Point'
          });
        })
        .on('mousemove', (event) => {
          this.moveTooltip(event);
        })
        .on('mouseout', () => {
          this.hideTooltip();
        });
    });
  }

  renderMilitaryBases() {
    // Only render if we have actual military base data
    if (!MILITARY_BASES || MILITARY_BASES.length === 0) return;
    
    const g = this.svg.append('g').attr('class', 'military-bases');

    MILITARY_BASES.forEach(base => {
      const [x, y] = this.projection([base.lon, base.lat]);
      if (!x || !y) return;

      g.append('polygon')
        .attr('points', `${x},${y-5} ${x+4},${y+3} ${x-4},${y+3}`)
        .attr('fill', '#ff6b6b')
        .attr('stroke', 'rgba(255, 255, 255, 0.9)')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .on('mouseover', (event) => {
          this.showTooltip(event, {
            title: base.name,
            type: `Military Base (${base.type})`
          });
        })
        .on('mousemove', (event) => {
          this.moveTooltip(event);
        })
        .on('mouseout', () => {
          this.hideTooltip();
        });
    });
  }

  renderNuclearFacilities() {
    // Only render if we have actual nuclear facility data
    if (!NUCLEAR_FACILITIES || NUCLEAR_FACILITIES.length === 0) return;
    
    const g = this.svg.append('g').attr('class', 'nuclear-facilities');

    NUCLEAR_FACILITIES.forEach(facility => {
      const [x, y] = this.projection([facility.lon, facility.lat]);
      if (!x || !y) return;

      g.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 5)
        .attr('fill', '#ffaa00')
        .attr('stroke', 'rgba(255, 255, 255, 0.9)')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseover', (event) => {
          this.showTooltip(event, {
            title: facility.name,
            type: 'Nuclear Facility'
          });
        })
        .on('mousemove', (event) => {
          this.moveTooltip(event);
        })
        .on('mouseout', () => {
          this.hideTooltip();
        });
    });
  }

  addEarthquake(lat, lon, magnitude) {
    const [x, y] = this.projection([lon, lat]);
    if (!x || !y) return;

    // Only show earthquakes if magnitude is significant (M4.5+)
    if (magnitude < 4.5) return;

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
      .on('mouseover', (event) => {
        this.showTooltip(event, {
          title: `Earthquake M${magnitude.toFixed(1)}`,
          type: 'Seismic Event'
        });
        window.d3.select(event.currentTarget)
          .attr('r', radius + 2)
          .style('opacity', 1);
      })
      .on('mousemove', (event) => {
        this.moveTooltip(event);
      })
      .on('mouseout', (event) => {
        this.hideTooltip();
        window.d3.select(event.currentTarget)
          .attr('r', radius)
          .style('opacity', 0.8);
      })
      .transition()
      .duration(300)
      .style('opacity', 0.8);

    // Fade out after 15 seconds
    const timeoutId = setTimeout(() => {
      // Verify circle and its parent still exist, and MapView is still valid
      const node = circle.node();
      if (node && node.parentNode && this.svg && this.svg.node() && this.svg.node().contains(node)) {
        // Re-select to ensure valid D3 selection
        const circleSelection = window.d3.select(node);
        if (!circleSelection.empty()) {
          try {
            circleSelection
              .transition()
              .duration(2000)
              .style('opacity', 0)
              .on('end', function() {
                // Remove after transition completes
                const parent = this.parentNode;
                if (parent) {
                  parent.removeChild(this);
                }
              });
          } catch (e) {
            // If transition fails, just remove directly
            if (node.parentNode) {
              node.parentNode.removeChild(node);
            }
          }
        }
      }
      this.earthquakeTimeouts.delete(earthquakeId);
    }, 15000);
    
    this.earthquakeTimeouts.set(earthquakeId, timeoutId);
  }
  
  /**
   * Clear all earthquake timeouts (on cleanup/refresh)
   */
  clearEarthquakeTimeouts() {
    for (const timeoutId of this.earthquakeTimeouts.values()) {
      clearTimeout(timeoutId);
    }
    this.earthquakeTimeouts.clear();
  }

  addMonitorMarker(monitor) {
    if (!monitor.lat || !monitor.lon) return;

    const [x, y] = this.projection([monitor.lon, monitor.lat]);
    if (!x || !y) return;

    const g = this.svg.append('g').attr('class', 'monitor-markers');
    const color = monitor.color || '#4A90E2';

    const marker = g.append('circle')
      .attr('cx', x)
      .attr('cy', y)
      .attr('r', 8)
      .attr('fill', color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .datum(monitor)
      .on('mouseover', (event, d) => {
        this.showTooltip(event, {
          title: d.name,
          type: 'Custom Monitor',
          matches: d.matchCount || 0
        });
      })
      .on('mousemove', (event) => {
        this.moveTooltip(event);
      })
      .on('mouseout', () => {
        this.hideTooltip();
      });

    // Add badge for match count
    if (monitor.matchCount > 0) {
      g.append('text')
        .attr('x', x)
        .attr('y', y - 12)
        .attr('text-anchor', 'middle')
        .attr('fill', '#fff')
        .attr('font-size', '10px')
        .attr('font-weight', 'bold')
        .text(monitor.matchCount);
    }

    this.markers.set(monitor.id, marker);
  }

  showTooltip(event, data) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Only show tooltip if mouse is actually over the map
    const mapContainer = document.getElementById(this.containerId);
    if (!mapContainer || !mapContainer.contains(event.target)) {
      return;
    }

    this.debounceTimer = setTimeout(() => {
      let html = `<div style="font-weight: bold; margin-bottom: 4px;">${data.title}</div>`;
      if (data.type) {
        html += `<div style="color: rgba(255,255,255,0.7); font-size: 11px;">${data.type}</div>`;
      }
      if (data.threatLevel) {
        html += `<div style="color: ${data.threatLevel === 'high' ? '#ff3333' : '#ffaa00'}; font-size: 11px; margin-top: 4px;">Threat: ${data.threatLevel}</div>`;
      }
      if (data.matches !== undefined) {
        html += `<div style="color: #4A90E2; font-size: 11px; margin-top: 4px;">Matches: ${data.matches}</div>`;
      }

      this.tooltip
        .html(html)
        .style('display', 'block')
        .style('opacity', 1);

      this.moveTooltip(event);
    }, 300); // Increased delay to prevent accidental hovers
  }

  moveTooltip(event) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Only move tooltip if it's visible and mouse is over map
    const mapContainer = document.getElementById(this.containerId);
    if (!mapContainer || !mapContainer.contains(event.target)) {
      this.hideTooltip();
      return;
    }

    this.debounceTimer = setTimeout(() => {
      // Position relative to map container, not page
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

  resize(width, height) {
    this.options.width = width;
    this.options.height = height;
    
    if (this.svg) {
      this.svg.attr('width', width).attr('height', height);
      
      // Use same projection settings as init - minimize Antarctica
      const scale = width / 5.8;
      const centerY = height / 2.3;
      this.projection
        .scale(scale)
        .translate([width / 2, centerY])
        .center([0, 30]);
      
      // Re-render
      this.svg.selectAll('*').remove();
      this.renderBaseMap();
      this.renderOverlays();
    }
  }

  /**
   * Update events on map
   */
  updateEvents(events) {
    this.events = events || [];
    this.renderEvents();
  }
  
  /**
   * Render events with clustering
   */
  renderEvents() {
    if (!this.svg || !this.projection) return;
    
    // Remove existing event markers and clusters
    this.svg.selectAll('.event-marker').remove();
    this.svg.selectAll('.event-cluster').remove();
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
  
  /**
   * Render a single event marker
   */
  renderEventMarker(container, event) {
    if (!event.location || !event.location.lat || !event.location.lon) return;
    
    const [x, y] = this.projection([event.location.lon, event.location.lat]);
    if (!x || !y || !isFinite(x) || !isFinite(y)) return;
    
    const color = getCategoryColor(event.category);
    const severity = event.severity;
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
    
    // Hover effects - target the main circle specifically, not the ring
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
  
  /**
   * Render a cluster
   */
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
  
  /**
   * Show event tooltip
   */
  showEventTooltip(event, mapEvent) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    // Only show if mouse is over map
    const mapContainer = document.getElementById(this.containerId);
    if (!mapContainer || !mapContainer.contains(event.target)) {
      return;
    }
    
    this.debounceTimer = setTimeout(() => {
      const age = mapEvent.getAgeHours();
      const ageText = age < 1 ? `${Math.floor(age * 60)}m ago` : 
                      age < 24 ? `${Math.floor(age)}h ago` : 
                      `${Math.floor(age / 24)}d ago`;
      
      let html = `<div style="font-weight: bold; margin-bottom: 4px;">${escapeHtml(mapEvent.title)}</div>`;
      html += `<div style="color: rgba(255,255,255,0.7); font-size: 11px;">${escapeHtml(mapEvent.source)} • ${ageText}</div>`;
      if (mapEvent.location && mapEvent.location.label) {
        html += `<div style="color: rgba(255,255,255,0.7); font-size: 11px; margin-top: 4px;">📍 ${escapeHtml(mapEvent.location.label)}</div>`;
      }
      html += `<div style="color: ${getSeverityColor(mapEvent.severity)}; font-size: 11px; margin-top: 4px;">Severity: ${mapEvent.severity}/5 • ${mapEvent.category}</div>`;
      
      this.tooltip
        .html(html)
        .style('display', 'block')
        .style('opacity', 1);
      
      this.moveTooltip(event);
    }, 300); // Increased delay
  }
  
  /**
   * Show cluster tooltip
   */
  showClusterTooltip(event, cluster) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    // Only show if mouse is over map
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
    }, 300); // Increased delay
  }
  
  /**
   * Handle event click
   */
  onEventClick(event) {
    // Dispatch custom event for event drawer
    const customEvent = new CustomEvent('sitmon:event-click', {
      detail: { event }
    });
    document.dispatchEvent(customEvent);
  }
  
  /**
   * Handle cluster click
   */
  onClusterClick(cluster) {
    // Dispatch custom event for cluster drawer
    const customEvent = new CustomEvent('sitmon:cluster-click', {
      detail: { cluster }
    });
    document.dispatchEvent(customEvent);
  }
  
  destroy() {
    // Clear all earthquake timeouts
    this.clearEarthquakeTimeouts();
    
    if (this.tooltip) {
      this.tooltip.remove();
    }
    if (this.svg) {
      this.svg.remove();
    }
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
