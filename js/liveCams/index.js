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
import { LiveCamsMapLayer } from './map-layer.js';

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
    
    // OSINT Grid View Modes: 1, 4, 9, 16, 36 cameras
    this.gridMode = 'single'; // 'single', 'grid4', 'grid9', 'grid16', 'grid36'
    this.gridCameras = []; // Selected cameras for grid view
    
    // Don't call init() here - it's async and should be awaited by caller
    // This prevents the constructor from returning before initialization completes
  }
  
  async init() {
    this.render();
    this.setupComponents();
    this.attachEvents();
    
    // Load initial results (global cameras - no filters)
    // Start with empty filters to get a broad set of results
    await this.performSearch();
  }
  
  render() {
    this.container.innerHTML = `
      <div class="livecams-container osint-surveillance-mode">
        <!-- OSINT Header -->
        <div class="livecams-osint-header">
          <div class="livecams-osint-title">
            <span class="livecams-osint-icon">📡</span>
            <h2>LIVE SURVEILLANCE NETWORK</h2>
            <span class="livecams-osint-status online">● ONLINE</span>
          </div>
          <div class="livecams-osint-controls">
            <button class="livecams-osint-btn" data-mode="single" title="Single View (1)">
              <span>1</span>
            </button>
            <button class="livecams-osint-btn" data-mode="grid4" title="Grid 2x2 (4)">
              <span>2×2</span>
            </button>
            <button class="livecams-osint-btn" data-mode="grid9" title="Grid 3x3 (9)">
              <span>3×3</span>
            </button>
            <button class="livecams-osint-btn" data-mode="grid16" title="Grid 4x4 (16)">
              <span>4×4</span>
            </button>
            <button class="livecams-osint-btn" data-mode="grid36" title="Grid 6x6 (36)">
              <span>6×6</span>
            </button>
            <button class="livecams-osint-btn" data-action="fullscreen" title="Fullscreen (F)">
              <span>⛶</span>
            </button>
          </div>
        </div>
        
        <!-- Top Live Strip -->
        <div class="livecams-top-strip-container" id="livecams-top-strip-container"></div>
        
        <!-- Hotspot Presets -->
        <div class="livecams-hotspots">
          <label class="livecams-osint-label">QUICK ACCESS // HOTSPOTS</label>
          <div class="livecams-hotspot-buttons">
            ${Object.entries(HOTSPOT_PRESETS).map(([key, preset]) => `
              <button class="livecams-hotspot-btn" data-preset="${key}">
                <span class="livecams-hotspot-icon">📍</span>
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
          
          <!-- Center/Right Panel: Player or Grid View -->
          <div class="livecams-view-panel" id="livecams-view-panel">
            <!-- Single View -->
            <div class="livecams-player-container livecams-view-single" id="livecams-player-container"></div>
            
            <!-- Multi-Grid Views -->
            <div class="livecams-grid-view livecams-view-grid4" id="livecams-grid-view-4" style="display: none;">
              <div class="livecams-grid-view-container" data-grid="4"></div>
            </div>
            <div class="livecams-grid-view livecams-view-grid9" id="livecams-grid-view-9" style="display: none;">
              <div class="livecams-grid-view-container" data-grid="9"></div>
            </div>
            <div class="livecams-grid-view livecams-view-grid16" id="livecams-grid-view-16" style="display: none;">
              <div class="livecams-grid-view-container" data-grid="16"></div>
            </div>
            <div class="livecams-grid-view livecams-view-grid36" id="livecams-grid-view-36" style="display: none;">
              <div class="livecams-grid-view-container" data-grid="36"></div>
            </div>
          </div>
        </div>
        
        <!-- OSINT Status Footer -->
        <div class="livecams-osint-footer">
          <div class="livecams-osint-footer-item">
            <span class="livecams-osint-footer-label">CAMERAS ONLINE:</span>
            <span class="livecams-osint-footer-value" id="livecams-online-count">0</span>
          </div>
          <div class="livecams-osint-footer-item">
            <span class="livecams-osint-footer-label">ACTIVE FEEDS:</span>
            <span class="livecams-osint-footer-value" id="livecams-active-feeds">0</span>
          </div>
          <div class="livecams-osint-footer-item">
            <span class="livecams-osint-footer-label">LAST UPDATE:</span>
            <span class="livecams-osint-footer-value" id="livecams-last-update">--:--:--</span>
          </div>
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
      this.mapLayer = new LiveCamsMapLayer(this.mapView, {
        onCameraClick: (camera) => {
          this.state.selectCamera(camera);
        }
      });
      
      // Update map layer when results change
      this.state.subscribe(() => {
        if (this.mapLayer) {
          this.mapLayer.updateCameras(this.state.results);
        }
      });
      
      // Listen for show-on-map events
      window.addEventListener('livecams-show-on-map', (e) => {
        if (e.detail?.camera && this.mapLayer) {
          this.mapLayer.setVisible(true);
          this.mapLayer.highlightCamera(e.detail.camera.id);
          this.mapLayer.zoomToCamera(e.detail.camera);
        }
      });
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
    
    // Grid mode buttons
    const modeButtons = this.container.querySelectorAll('[data-mode]');
    modeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        this.setGridMode(mode);
      });
    });
    
    // Fullscreen button
    const fullscreenBtn = this.container.querySelector('[data-action="fullscreen"]');
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => {
        this.toggleFullscreen();
      });
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      // F for fullscreen
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        this.toggleFullscreen();
      }
      // 1-6 for grid modes
      if (e.key === '1') {
        e.preventDefault();
        this.setGridMode('single');
      } else if (e.key === '2') {
        e.preventDefault();
        this.setGridMode('grid4');
      } else if (e.key === '3') {
        e.preventDefault();
        this.setGridMode('grid9');
      } else if (e.key === '4') {
        e.preventDefault();
        this.setGridMode('grid16');
      } else if (e.key === '5' || e.key === '6') {
        e.preventDefault();
        this.setGridMode('grid36');
      }
      // Arrow keys for navigation
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        this.navigateCameras(e.key === 'ArrowRight' ? 1 : -1);
      }
    });
    
    // Update status footer
    this.updateStatusFooter();
    setInterval(() => this.updateStatusFooter(), 1000);
    
    // Listen for fullscreen changes
    document.addEventListener('fullscreenchange', () => {
      const container = this.container.querySelector('.livecams-container');
      if (document.fullscreenElement === container) {
        // Entered fullscreen - optionally switch to 6x6 if enough cameras
        if (this.state.results.length >= 36 && this.gridMode !== 'grid36') {
          this.setGridMode('grid36');
        }
      }
    });
  }
  
  setGridMode(mode) {
    this.gridMode = mode;
    
    // Update button states
    const modeButtons = this.container.querySelectorAll('[data-mode]');
    modeButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    // Show/hide views
    const singleView = this.container.querySelector('.livecams-view-single');
    const grid4View = this.container.querySelector('#livecams-grid-view-4');
    const grid9View = this.container.querySelector('#livecams-grid-view-9');
    const grid16View = this.container.querySelector('#livecams-grid-view-16');
    const grid36View = this.container.querySelector('#livecams-grid-view-36');
    
    if (mode === 'single') {
      singleView.style.display = 'block';
      grid4View.style.display = 'none';
      grid9View.style.display = 'none';
      grid16View.style.display = 'none';
      grid36View.style.display = 'none';
    } else {
      singleView.style.display = 'none';
      const targetView = mode === 'grid4' ? grid4View : 
                        mode === 'grid9' ? grid9View : 
                        mode === 'grid16' ? grid16View : 
                        grid36View;
      targetView.style.display = 'grid';
      [grid4View, grid9View, grid16View, grid36View].forEach(v => {
        if (v !== targetView) v.style.display = 'none';
      });
      
      // Populate grid with selected cameras or watchlist
      this.populateGridView(mode);
    }
  }
  
  populateGridView(mode) {
    const gridSize = mode === 'grid4' ? 4 : mode === 'grid9' ? 9 : mode === 'grid16' ? 16 : 36;
    const container = this.container.querySelector(`[data-grid="${gridSize}"]`);
    if (!container) return;
    
    // Use watchlist first, then selected camera + results
    const cameras = this.state.watchlist.length > 0 
      ? [...this.state.watchlist]
      : this.state.selectedCamera 
        ? [this.state.selectedCamera, ...this.state.results.slice(0, gridSize - 1)]
        : this.state.results.slice(0, gridSize);
    
    this.gridCameras = cameras.slice(0, gridSize);
    
    // Helper function to escape HTML entities
    const escapeHtml = (text) => {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };
    
    // Helper function to escape for HTML attributes
    const escapeAttr = (text) => {
      if (!text) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    };
    
    container.innerHTML = this.gridCameras.map((camera, index) => {
      const snapshotUrl = camera.media?.snapshotUrl;
      const proxyUrl = snapshotUrl ? `/api/cams/proxy-image?url=${encodeURIComponent(snapshotUrl)}` : null;
      
      // Escape all user-provided data
      const safeId = escapeAttr(camera.id || '');
      const safeTitle = escapeHtml(camera.title || `Camera ${index + 1}`);
      const safeTitleAttr = escapeAttr(camera.title || `Camera ${index + 1}`);
      const safeCity = escapeHtml(camera.city || 'Unknown');
      
      return `
        <div class="livecams-grid-cell" data-camera-id="${safeId}">
          <div class="livecams-grid-cell-header">
            <span class="livecams-grid-cell-title">${safeTitle}</span>
            <span class="livecams-grid-cell-status online">●</span>
          </div>
          <div class="livecams-grid-cell-display">
            ${proxyUrl ? `
              <img 
                src="${escapeAttr(proxyUrl)}" 
                alt="${safeTitleAttr}"
                class="livecams-grid-cell-image"
                loading="lazy"
                onerror="this.parentElement.innerHTML='<div class=\\'livecams-grid-cell-placeholder\\'>📹</div>'"
              />
            ` : `
              <div class="livecams-grid-cell-placeholder">📹</div>
            `}
          </div>
          <div class="livecams-grid-cell-footer">
            <span class="livecams-grid-cell-location">${safeCity}</span>
          </div>
        </div>
      `;
    }).join('');
    
    // Auto-refresh grid images
    this.startGridRefresh();
  }
  
  startGridRefresh() {
    if (this.gridRefreshInterval) clearInterval(this.gridRefreshInterval);
    
    this.gridRefreshInterval = setInterval(() => {
      const images = this.container.querySelectorAll('.livecams-grid-cell-image');
      images.forEach(img => {
        if (img.src) {
          const url = new URL(img.src);
          url.searchParams.set('_t', Date.now());
          img.src = url.toString();
        }
      });
    }, 30000); // Refresh every 30 seconds
  }
  
  navigateCameras(direction) {
    if (this.gridMode !== 'single') return;
    
    const cameras = this.state.results;
    if (cameras.length === 0) return;
    
    const currentIndex = cameras.findIndex(c => c.id === this.state.selectedCamera?.id);
    let newIndex = currentIndex + direction;
    
    if (newIndex < 0) newIndex = cameras.length - 1;
    if (newIndex >= cameras.length) newIndex = 0;
    
    this.state.selectCamera(cameras[newIndex]);
  }
  
  toggleFullscreen() {
    const container = this.container.querySelector('.livecams-container');
    if (!container) return;
    
    if (!document.fullscreenElement) {
      // Enter fullscreen on the entire container
      container.requestFullscreen().catch(err => {
        console.error('Error entering fullscreen:', err);
      });
      
      // When entering fullscreen, optionally switch to 6x6 grid if not already
      if (this.gridMode !== 'grid36' && this.state.results.length >= 36) {
        setTimeout(() => {
          this.setGridMode('grid36');
        }, 100);
      }
    } else {
      document.exitFullscreen();
    }
  }
  
  updateStatusFooter() {
    const onlineCount = this.state.results.filter(c => c.status === 'online').length;
    const activeFeeds = this.gridMode === 'single' ? (this.state.selectedCamera ? 1 : 0) : 
                        this.gridMode === 'grid4' ? 4 : 
                        this.gridMode === 'grid9' ? 9 : 
                        this.gridMode === 'grid16' ? 16 : 36;
    const lastUpdate = new Date().toLocaleTimeString();
    
    const onlineEl = this.container.querySelector('#livecams-online-count');
    const feedsEl = this.container.querySelector('#livecams-active-feeds');
    const updateEl = this.container.querySelector('#livecams-last-update');
    
    if (onlineEl) onlineEl.textContent = onlineCount;
    if (feedsEl) feedsEl.textContent = activeFeeds;
    if (updateEl) updateEl.textContent = lastUpdate;
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
// Note: LiveCams is already exported as a named export above (export class LiveCams on line 53)
// We also export as default for convenience
export default LiveCams;
