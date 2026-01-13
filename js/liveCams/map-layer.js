/**
 * Map Layer for Camera Markers
 * Integrates with Situation Monitor's MapView
 */

import { getTypeIcon } from './providers-ui.js';

export class CameraMapLayer {
  constructor(mapView, state) {
    this.mapView = mapView;
    this.state = state;
    this.markers = [];
    this.clusters = [];
    
    this.state.subscribe(() => this.updateMarkers());
  }
  
  /**
   * Update markers based on current results
   */
  updateMarkers() {
    const { results, selectedCamera } = this.state;
    
    // Clear existing markers
    this.clearMarkers();
    
    if (!this.mapView || !results || results.length === 0) {
      return;
    }
    
    // Create markers for each camera
    results.forEach(camera => {
      const marker = this.createMarker(camera, selectedCamera?.id === camera.id);
      this.markers.push(marker);
    });
    
    // Apply clustering if too many markers
    if (this.markers.length > 25) {
      this.applyClustering();
    } else {
      this.addMarkersToMap();
    }
  }
  
  /**
   * Create a marker for a camera
   */
  createMarker(camera, isSelected) {
    const icon = getTypeIcon(camera.type);
    const color = isSelected ? '#22d3ee' : this.getMarkerColor(camera.type);
    
    return {
      id: camera.id,
      lat: camera.lat,
      lon: camera.lon,
      camera,
      icon,
      color,
      isSelected
    };
  }
  
  /**
   * Get marker color by type
   */
  getMarkerColor(type) {
    const colors = {
      dot_traffic: '#FF6B6B',
      city_street: '#4ECDC4',
      scenic: '#95E1D3',
      other: '#666'
    };
    return colors[type] || colors.other;
  }
  
  /**
   * Apply clustering to markers
   */
  applyClustering() {
    // Simple grid-based clustering
    const gridSize = 0.1; // ~11km
    const clusters = new Map();
    
    this.markers.forEach(marker => {
      const gridX = Math.floor(marker.lon / gridSize);
      const gridY = Math.floor(marker.lat / gridSize);
      const key = `${gridX},${gridY}`;
      
      if (!clusters.has(key)) {
        clusters.set(key, []);
      }
      clusters.get(key).push(marker);
    });
    
    // Create cluster markers
    this.clusters = Array.from(clusters.entries()).map(([key, markers]) => {
      if (markers.length === 1) {
        return markers[0];
      }
      
      // Calculate cluster center
      const avgLat = markers.reduce((sum, m) => sum + m.lat, 0) / markers.length;
      const avgLon = markers.reduce((sum, m) => sum + m.lon, 0) / markers.length;
      
      return {
        id: `cluster-${key}`,
        lat: avgLat,
        lon: avgLon,
        isCluster: true,
        count: markers.length,
        markers
      };
    });
    
    this.addClustersToMap();
  }
  
  /**
   * Add markers to map (if MapView supports it)
   */
  addMarkersToMap() {
    // This would integrate with Situation Monitor's MapView
    // For now, we'll add markers via D3 if available
    if (typeof window.d3 === 'undefined' || !this.mapView) {
      return;
    }
    
    // Implementation depends on MapView API
    // This is a placeholder - actual integration will depend on MapView structure
    console.log('[CameraMapLayer] Adding markers to map:', this.markers.length);
  }
  
  /**
   * Add clusters to map
   */
  addClustersToMap() {
    // Similar to addMarkersToMap but for clusters
    console.log('[CameraMapLayer] Adding clusters to map:', this.clusters.length);
  }
  
  /**
   * Clear all markers
   */
  clearMarkers() {
    this.markers = [];
    this.clusters = [];
    // Remove from map if needed
  }
  
  /**
   * Handle marker click
   */
  onMarkerClick(marker) {
    if (marker.isCluster) {
      // Zoom to cluster or expand
      return;
    }
    
    this.state.selectCamera(marker.camera);
  }
}
