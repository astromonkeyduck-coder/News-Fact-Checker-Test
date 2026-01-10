/**
 * D3 + TopoJSON Map Component
 */

// D3 is loaded from CDN in HTML
// TopoJSON is loaded from CDN in HTML
import { HOTSPOTS, CONFLICT_ZONES, CHOKEPOINTS, CABLE_POINTS, MILITARY_BASES, NUCLEAR_FACILITIES } from './data/sources.js';

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
    
    this.init();
  }

  async init() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`[MapView] Container #${this.containerId} not found`);
      return;
    }

    // Create SVG (d3 loaded from CDN)
    this.svg = window.d3.select(container)
      .append('svg')
      .attr('width', this.options.width)
      .attr('height', this.options.height)
      .attr('viewBox', `0 0 ${this.options.width} ${this.options.height}`)
      .style('background', 'linear-gradient(135deg, rgba(5, 15, 35, 0.95) 0%, rgba(7, 21, 42, 0.95) 100%)');

    // Create tooltip
    this.tooltip = window.d3.select('body')
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
      .style('z-index', '1000')
      .style('max-width', '300px')
      .style('box-shadow', '0 4px 12px rgba(0, 0, 0, 0.5)');

    // Set up projection - minimize Antarctica visibility
    // Use a larger scale and shift center significantly up to focus on populated areas
    const scale = this.options.width / 5.8; // Larger scale to zoom in more
    const centerY = this.options.height / 2.3; // Shift center further up to reduce Antarctica
    
    this.projection = window.d3.geoMercator()
      .scale(scale)
      .translate([this.options.width / 2, centerY])
      .center([0, 30]); // Center on 30°N to focus on populated regions (moves viewport up)

    this.path = window.d3.geoPath().projection(this.projection);

    // Load world map data
    await this.loadWorldMap();
    
    // Render base map
    this.renderBaseMap();
    
    // Render overlays
    this.renderOverlays();
  }

  async loadWorldMap() {
    try {
      // Use Natural Earth 110m countries (free, public domain)
      const url = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
      const response = await fetch(url);
      const topojson = await response.json();
      
      // Convert to GeoJSON using topojson library (loaded from CDN)
      if (window.topojson) {
        this.worldData = window.topojson.feature(topojson, topojson.objects.countries);
      } else {
        // Fallback: try direct access
        this.worldData = topojson;
      }
    } catch (error) {
      console.error('[MapView] Failed to load world map:', error);
      // Fallback: create a simple outline
      this.worldData = null;
    }
  }

  renderBaseMap() {
    if (!this.worldData) return;

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
      .style('opacity', 0.8)
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
      });

    // Fade out after 15 seconds
    setTimeout(() => {
      circle.transition()
        .duration(2000)
        .style('opacity', 0)
        .remove();
    }, 15000);
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
        .style('opacity', 1);

      this.moveTooltip(event);
    }, 50);
  }

  moveTooltip(event) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.tooltip
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px');
    }, 10);
  }

  hideTooltip() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.tooltip.style('opacity', 0);
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

  destroy() {
    if (this.tooltip) {
      this.tooltip.remove();
    }
    if (this.svg) {
      this.svg.remove();
    }
  }
}
