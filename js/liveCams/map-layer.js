/**
 * Live Cams Map Layer
 * Integrates camera markers into the Situation Monitor D3 map
 */

export class LiveCamsMapLayer {
  constructor(mapView, options = {}) {
    this.mapView = mapView;
    this.options = {
      visible: false,
      clusterThreshold: 50, // Cluster when more than N cameras
      clusterRadius: 30,    // Pixels
      ...options
    };
    
    this.cameras = [];
    this.markers = new Map();
    this.clusters = [];
    this.layerGroup = null;
    this.isVisible = false;
    this.onCameraClick = options.onCameraClick || null;
    
    this.init();
  }
  
  init() {
    if (!this.mapView || !this.mapView.svg) {
      console.warn('[LiveCamsMapLayer] MapView or SVG not available');
      return;
    }
    
    // Create a group for camera markers
    this.layerGroup = this.mapView.svg.append('g')
      .attr('class', 'livecams-map-layer')
      .style('pointer-events', 'all')
      .style('display', 'none'); // Hidden by default
    
    console.log('[LiveCamsMapLayer] Initialized');
  }
  
  /**
   * Update cameras on the map
   * @param {Camera[]} cameras - Array of camera objects with lat/lon
   */
  updateCameras(cameras) {
    this.cameras = cameras || [];
    this.render();
  }
  
  /**
   * Toggle layer visibility
   */
  toggle() {
    this.isVisible = !this.isVisible;
    this.setVisible(this.isVisible);
    return this.isVisible;
  }
  
  /**
   * Set layer visibility
   */
  setVisible(visible) {
    this.isVisible = visible;
    if (this.layerGroup) {
      this.layerGroup.style('display', visible ? 'block' : 'none');
    }
    if (visible) {
      this.render();
    }
  }
  
  /**
   * Render camera markers on the map
   */
  render() {
    if (!this.layerGroup || !this.isVisible) return;
    if (!this.mapView.projection) {
      console.warn('[LiveCamsMapLayer] Projection not ready');
      return;
    }
    
    const d3 = window.d3;
    if (!d3) return;
    
    // Clear existing markers
    this.layerGroup.selectAll('*').remove();
    
    // Filter cameras with valid coordinates
    const validCameras = this.cameras.filter(cam => 
      cam.lat && cam.lon && 
      Math.abs(cam.lat) <= 90 && 
      Math.abs(cam.lon) <= 180
    );
    
    if (validCameras.length === 0) {
      console.log('[LiveCamsMapLayer] No valid cameras to render');
      return;
    }
    
    // Should we cluster?
    if (validCameras.length > this.options.clusterThreshold) {
      this.renderClusters(validCameras);
    } else {
      this.renderIndividual(validCameras);
    }
    
    console.log(`[LiveCamsMapLayer] Rendered ${validCameras.length} cameras`);
  }
  
  /**
   * Render individual camera markers
   */
  renderIndividual(cameras) {
    const d3 = window.d3;
    const projection = this.mapView.projection;
    
    // Create camera markers
    const markers = this.layerGroup.selectAll('.livecams-marker')
      .data(cameras, d => d.id)
      .enter()
      .append('g')
      .attr('class', 'livecams-marker')
      .attr('transform', d => {
        const coords = projection([d.lon, d.lat]);
        return coords ? `translate(${coords[0]}, ${coords[1]})` : 'translate(-9999, -9999)';
      })
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        this.handleCameraClick(d);
      })
      .on('mouseenter', (event, d) => {
        this.showTooltip(event, d);
      })
      .on('mouseleave', () => {
        this.hideTooltip();
      });
    
    // Camera icon (video camera shape)
    markers.append('circle')
      .attr('r', 8)
      .attr('fill', 'rgba(34, 211, 238, 0.8)')
      .attr('stroke', 'rgba(255, 255, 255, 0.9)')
      .attr('stroke-width', 2);
    
    // Camera icon inner
    markers.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '10px')
      .text('📹');
    
    // Pulse animation for online cameras
    markers.filter(d => d.status === 'online')
      .append('circle')
      .attr('r', 8)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(34, 211, 238, 0.6)')
      .attr('stroke-width', 1)
      .style('animation', 'cameraPulse 2s ease-out infinite');
  }
  
  /**
   * Render clustered camera markers
   */
  renderClusters(cameras) {
    const d3 = window.d3;
    const projection = this.mapView.projection;
    
    // Simple grid-based clustering
    const clusters = this.clusterCameras(cameras);
    
    const clusterMarkers = this.layerGroup.selectAll('.livecams-cluster')
      .data(clusters)
      .enter()
      .append('g')
      .attr('class', 'livecams-cluster')
      .attr('transform', d => {
        const coords = projection([d.lon, d.lat]);
        return coords ? `translate(${coords[0]}, ${coords[1]})` : 'translate(-9999, -9999)';
      })
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        // On cluster click, zoom or show list
        if (d.cameras.length === 1) {
          this.handleCameraClick(d.cameras[0]);
        } else {
          this.showClusterPopup(event, d);
        }
      });
    
    // Cluster circle
    clusterMarkers.append('circle')
      .attr('r', d => Math.min(25, 10 + Math.sqrt(d.cameras.length) * 3))
      .attr('fill', 'rgba(34, 211, 238, 0.6)')
      .attr('stroke', 'rgba(255, 255, 255, 0.8)')
      .attr('stroke-width', 2);
    
    // Cluster count
    clusterMarkers.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', 'white')
      .attr('font-size', '11px')
      .attr('font-weight', 'bold')
      .text(d => d.cameras.length);
  }
  
  /**
   * Simple grid-based clustering
   */
  clusterCameras(cameras) {
    const gridSize = 5; // degrees
    const grid = new Map();
    
    cameras.forEach(cam => {
      const gridX = Math.floor(cam.lon / gridSize);
      const gridY = Math.floor(cam.lat / gridSize);
      const key = `${gridX},${gridY}`;
      
      if (!grid.has(key)) {
        grid.set(key, {
          cameras: [],
          lat: 0,
          lon: 0
        });
      }
      
      const cluster = grid.get(key);
      cluster.cameras.push(cam);
    });
    
    // Calculate cluster centers
    return Array.from(grid.values()).map(cluster => {
      const avgLat = cluster.cameras.reduce((sum, c) => sum + c.lat, 0) / cluster.cameras.length;
      const avgLon = cluster.cameras.reduce((sum, c) => sum + c.lon, 0) / cluster.cameras.length;
      return {
        ...cluster,
        lat: avgLat,
        lon: avgLon
      };
    });
  }
  
  /**
   * Handle camera marker click
   */
  handleCameraClick(camera) {
    if (this.onCameraClick) {
      this.onCameraClick(camera);
    }
    
    // Dispatch event for Live Cams panel to handle
    window.dispatchEvent(new CustomEvent('livecams-map-select', {
      detail: { camera }
    }));
  }
  
  /**
   * Show tooltip for camera
   */
  showTooltip(event, camera) {
    // Use map's existing tooltip if available, or create one
    let tooltip = document.querySelector('.livecams-map-tooltip');
    
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'livecams-map-tooltip';
      tooltip.style.cssText = `
        position: fixed;
        z-index: 10000;
        background: rgba(5, 15, 35, 0.95);
        border: 1px solid rgba(34, 211, 238, 0.4);
        border-radius: 8px;
        padding: 8px 12px;
        color: white;
        font-size: 12px;
        pointer-events: none;
        max-width: 250px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      `;
      document.body.appendChild(tooltip);
    }
    
    tooltip.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 4px; color: #22d3ee;">${this.escapeHtml(camera.title)}</div>
      <div style="font-size: 11px; opacity: 0.7;">📍 ${this.escapeHtml(camera.city || camera.region1 || 'Unknown')}</div>
      ${camera.road ? `<div style="font-size: 11px; opacity: 0.7;">🛣️ ${this.escapeHtml(camera.road)}</div>` : ''}
      <div style="font-size: 10px; margin-top: 4px; color: rgba(255,255,255,0.5);">Click to view</div>
    `;
    
    tooltip.style.left = `${event.clientX + 10}px`;
    tooltip.style.top = `${event.clientY + 10}px`;
    tooltip.style.display = 'block';
  }
  
  /**
   * Hide tooltip
   */
  hideTooltip() {
    const tooltip = document.querySelector('.livecams-map-tooltip');
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  }
  
  /**
   * Show cluster popup
   */
  showClusterPopup(event, cluster) {
    // For now, just select first camera in cluster
    // Could be enhanced to show a popup with camera list
    if (cluster.cameras.length > 0) {
      this.handleCameraClick(cluster.cameras[0]);
    }
  }
  
  /**
   * Highlight a specific camera on the map
   */
  highlightCamera(cameraId) {
    if (!this.layerGroup) return;
    
    // Remove existing highlights
    this.layerGroup.selectAll('.livecams-marker')
      .classed('highlighted', false)
      .select('circle')
      .attr('stroke', 'rgba(255, 255, 255, 0.9)')
      .attr('stroke-width', 2);
    
    // Add highlight to selected
    this.layerGroup.selectAll('.livecams-marker')
      .filter(d => d.id === cameraId)
      .classed('highlighted', true)
      .select('circle')
      .attr('stroke', '#ffd700')
      .attr('stroke-width', 3);
  }
  
  /**
   * Zoom map to camera location
   */
  zoomToCamera(camera) {
    if (!camera || !this.mapView) return;
    
    // The MapView should have a panTo or zoomTo method
    // For now, dispatch event for MapView to handle
    window.dispatchEvent(new CustomEvent('map-zoom-to', {
      detail: { lat: camera.lat, lon: camera.lon, zoom: 6 }
    }));
  }
  
  /**
   * Escape HTML
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * Clean up
   */
  destroy() {
    if (this.layerGroup) {
      this.layerGroup.remove();
      this.layerGroup = null;
    }
    this.hideTooltip();
  }
}

// Add CSS animation for camera pulse
const style = document.createElement('style');
style.textContent = `
  @keyframes cameraPulse {
    0% {
      transform: scale(1);
      opacity: 0.8;
    }
    100% {
      transform: scale(2.5);
      opacity: 0;
    }
  }
  
  .livecams-marker.highlighted circle {
    animation: cameraHighlight 1s ease-in-out infinite;
  }
  
  @keyframes cameraHighlight {
    0%, 100% {
      filter: drop-shadow(0 0 4px #ffd700);
    }
    50% {
      filter: drop-shadow(0 0 10px #ffd700);
    }
  }
`;
document.head.appendChild(style);
