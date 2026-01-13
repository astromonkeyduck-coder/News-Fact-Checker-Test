/**
 * Live Cams Main Module
 * Bootstrap and wire up all components
 */

import { LiveCamsState } from './state.js';
import { searchCameras, geocodeLocation, createSearchSignal } from './api.js';
import { SearchBar } from './components/SearchBar.js';
import { FiltersPanel } from './components/FiltersPanel.js';
import { CamerasGrid } from './components/CamerasGrid.js';
import { PlayerPanel } from './components/PlayerPanel.js';
import { Watchlist } from './components/Watchlist.js';
import { TopLiveStrip } from './components/TopLiveStrip.js';
import { CameraMapLayer } from './map-layer.js';

// Hotspot presets
const HOTSPOT_PRESETS = {
  kyiv: {
    name: 'Kyiv, Ukraine',
    bbox: '30.2,50.2,30.8,50.6',
    country: 'UA',
    city: 'Kyiv'
  },
  telaviv: {
    name: 'Tel Aviv, Israel',
    bbox: '34.7,32.0,34.9,32.2',
    country: 'IL',
    city: 'Tel Aviv'
  },
  nyc: {
    name: 'New York City',
    bbox: '-74.1,40.6,-73.9,40.8',
    country: 'US',
    state: 'NY',
    city: 'New York'
  },
  orlando: {
    name: 'Orlando, FL',
    bbox: '-81.5,28.4,-81.3,28.6',
    country: 'US',
    state: 'FL',
    city: 'Orlando'
  },
  bourbonst: {
    name: 'Bourbon Street, New Orleans',
    bbox: '-90.08,29.96,-90.06,29.98',
    country: 'US',
    state: 'LA',
    city: 'New Orleans'
  }
};

export class LiveCams {
  constructor(container, mapView = null) {
    this.container = container;
    this.mapView = mapView;
    this.state = new LiveCamsState();
    
    this.searchBar = null;
    this.filtersPanel = null;
    this.camerasGrid = null;
    this.playerPanel = null;
    this.watchlist = null;
    this.topLiveStrip = null;
    this.mapLayer = null;
    
    // Don't call init() here - it's async and should be awaited by caller
    // This prevents the constructor from returning before initialization completes
  }
  
  async init() {
    this.render();
    this.setupComponents();
    this.attachEvents();
    
    // Load initial results (US cameras)
    await this.performSearch();
  }
  
  render() {
    this.container.innerHTML = `
      <div class="livecams-container">
        <!-- Top Live Strip -->
        <div class="livecams-top-strip-container" id="livecams-top-strip-container"></div>
        
        <!-- Hotspot Presets -->
        <div class="livecams-hotspots">
          <label>Quick Locations:</label>
          <div class="livecams-hotspot-buttons">
            ${Object.entries(HOTSPOT_PRESETS).map(([key, preset]) => `
              <button class="livecams-hotspot-btn" data-preset="${key}">
                ${preset.name}
              </button>
            `).join('')}
          </div>
        </div>
        
        <div class="livecams-layout">
          <!-- Left Panel: Browser -->
          <div class="livecams-left-panel">
            <div class="livecams-watchlist-container" id="livecams-watchlist-container"></div>
            <div class="livecams-search-container" id="livecams-search-container"></div>
            <div class="livecams-filters-container" id="livecams-filters-container"></div>
            <div class="livecams-grid-container" id="livecams-grid-container"></div>
          </div>
          
          <!-- Right Panel: Player -->
          <div class="livecams-right-panel">
            <div class="livecams-player-container" id="livecams-player-container"></div>
          </div>
        </div>
        
        <!-- Disclaimer -->
        <div class="livecams-disclaimer">
          <p>Camera content provided by respective DOT/511/webcam providers.</p>
        </div>
      </div>
    `;
  }
  
  setupComponents() {
    const topStripContainer = this.container.querySelector('#livecams-top-strip-container');
    const watchlistContainer = this.container.querySelector('#livecams-watchlist-container');
    const searchContainer = this.container.querySelector('#livecams-search-container');
    const filtersContainer = this.container.querySelector('#livecams-filters-container');
    const gridContainer = this.container.querySelector('#livecams-grid-container');
    const playerContainer = this.container.querySelector('#livecams-player-container');
    
    // Top Live Strip
    this.topLiveStrip = new TopLiveStrip(
      topStripContainer,
      this.state,
      (camera) => this.state.selectCamera(camera)
    );
    
    // Watchlist
    this.watchlist = new Watchlist(
      watchlistContainer,
      this.state,
      (camera) => this.state.selectCamera(camera),
      (cameraId) => this.state.removeFromWatchlist(cameraId)
    );
    
    // Search Bar
    this.searchBar = new SearchBar(
      searchContainer,
      this.state,
      () => this.performSearch()
    );
    
    // Filters Panel
    this.filtersPanel = new FiltersPanel(
      filtersContainer,
      this.state,
      () => this.performSearch()
    );
    
    // Cameras Grid
    this.camerasGrid = new CamerasGrid(
      gridContainer,
      this.state,
      (camera) => this.state.selectCamera(camera),
      (camera) => this.state.addToWatchlist(camera)
    );
    
    // Player Panel
    this.playerPanel = new PlayerPanel(
      playerContainer,
      this.state
    );
    
    // Map Layer (if mapView available)
    if (this.mapView) {
      this.mapLayer = new CameraMapLayer(this.mapView, this.state);
    }
  }
  
  attachEvents() {
    // Hotspot preset buttons
    const presetButtons = this.container.querySelectorAll('[data-preset]');
    presetButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const presetKey = btn.dataset.preset;
        const preset = HOTSPOT_PRESETS[presetKey];
        if (preset) {
          this.state.setFilters({
            country: preset.country,
            state: preset.state || null,
            city: preset.city || null,
            bbox: preset.bbox
          });
          await this.performSearch();
        }
      });
    });
  }
  
  async performSearch() {
    this.state.setLoading(true);
    this.state.setError(null);
    
    try {
      const signal = createSearchSignal();
      const filters = { ...this.state.filters };
      
      // If city is provided but no bbox, try to geocode
      if (filters.city && !filters.bbox) {
        try {
          const bbox = await geocodeLocation(filters.city);
          if (bbox) {
            filters.bbox = bbox;
          }
        } catch (geocodeError) {
          console.warn('[LiveCams] Geocoding failed, continuing without bbox:', geocodeError);
          // Continue search without bbox
        }
      }
      
      const results = await searchCameras(filters, signal);
      this.state.setResults(results);
      console.log(`[LiveCams] Search completed: ${results.length} cameras found`);
    } catch (error) {
      console.error('[LiveCams] Search error:', error);
      console.error('[LiveCams] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      this.state.setError(error.message || 'Failed to search cameras');
      this.state.setResults([]);
    } finally {
      this.state.setLoading(false);
    }
  }
}

// Export for use in Situation Monitor
export { LiveCams };
export default LiveCams;
