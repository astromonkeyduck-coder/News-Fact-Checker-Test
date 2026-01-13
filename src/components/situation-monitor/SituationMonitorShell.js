/**
 * Situation Monitor Shell - Main Component
 */

import { MapView } from './MapView.js';
import { NewsPanel } from './Panels/NewsPanel.js';
import { MarketsPanel } from './Panels/MarketsPanel.js';
import { EarthquakePanel } from './Panels/EarthquakePanel.js';
import { WeatherAlertsPanel } from './Panels/WeatherAlertsPanel.js';
import { IntelFeedPanel } from './Panels/IntelFeedPanel.js';
import { CorrelationPanel } from './Panels/CorrelationPanel.js';
import { NarrativePanel } from './Panels/NarrativePanel.js';
import { MonitorsPanel } from './Panels/MonitorsPanel.js';
import { RSSIntelligencePanel } from './Panels/RSSIntelligencePanel.js';
import { EventPipeline } from './data/eventPipeline.js';
import { EventDrawer } from './EventDrawer.js';
import { ClusterDrawer } from './ClusterDrawer.js';
import { BigBoardOverlay } from './BigBoardOverlay.js';
import { DiagnosticsPanel } from './DiagnosticsPanel.js';
import { showLoader, setLoaderProgress, setLoaderPhase, hideLoader } from '../../loader/IntelLoader.js';

export class SituationMonitorShell {
  constructor(containerId) {
    this.containerId = containerId;
    this.mapView = null;
    this.panels = {};
    this.autoRefresh = true;
    this.refreshInterval = null;
    this.eventPipeline = new EventPipeline({
      minSeverity: 2,
      minConfidence: 0.6,
      maxGeocodePerCycle: 5
    });
    this.mapEvents = []; // Track current map events
    this.eventDrawer = null;
    this.clusterDrawer = null;
    this.bigBoardOverlay = null;
    this.diagnosticsPanel = null;
    this.liveCams = null;
    this._refreshing = false; // Guard for single-flight refresh
    this._refreshPromise = null; // Promise for single-flight refresh
    this._shellCreated = false; // Guard for double initialization
    
    // Don't await - let it run asynchronously
    // Add timeout to ensure loader hides even if initialization hangs
    const initTimeout = setTimeout(() => {
      console.warn('[SituationMonitorShell] Init timeout - hiding loader');
      hideLoader();
    }, 30000); // 30 second timeout
    
    this.init().catch(err => {
      console.error('[SituationMonitorShell] Init error:', err);
      hideLoader(); // Ensure loader hides on error
    }).finally(() => {
      clearTimeout(initTimeout);
    });
  }

  async init() {
    // CRITICAL: Prevent double initialization
    if (this._shellCreated) {
      console.warn('[SituationMonitorShell] Shell already created, skipping init');
      hideLoader(); // Ensure loader is hidden
      return;
    }
    
    // Wrap entire init in try-catch to ensure loader always hides
    try {
    
    // Show loader immediately
    showLoader({ phase: 'AUTH' });
    setLoaderProgress(0.05);
    
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`[SituationMonitorShell] Container #${this.containerId} not found`);
      hideLoader();
      return;
    }
    
    // Mark shell as created
    this._shellCreated = true;

    // CRITICAL: Ensure container is visible before injecting HTML
    container.style.display = 'block';
    container.style.visibility = 'visible';
    container.style.opacity = '1';
    container.style.zIndex = '1';
    
    // Create layout - matches Noteworthy News container system
    container.innerHTML = `
      <div class="sitmon-page-wrapper" style="display: block !important; visibility: visible !important; opacity: 1 !important; position: relative !important; z-index: 1 !important;">
        <!-- Page Header -->
        <div class="sitmon-page-header" style="display: flex !important; visibility: visible !important; opacity: 1 !important;">
          <div class="sitmon-header-left">
            <h1 class="sitmon-page-title">Situation Monitor</h1>
            <p class="sitmon-page-subtitle">Global Intelligence Dashboard</p>
            <div class="sitmon-status-chip" id="sitmon-status-chip">Updated</div>
          </div>
          <div class="sitmon-header-right">
            <!-- Music Controls -->
            <div class="sitmon-music-controls">
              <button id="sitmonMusicBtn" class="sitmon-music-btn" aria-label="Play/Pause Background Music" title="Play/Pause Background Music">
                <svg class="sitmon-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
                  <path d="M9 18V5l9-2v13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/>
                  <circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="1.8" fill="currentColor" fill-opacity="0.2"/>
                  <circle cx="18" cy="16" r="3" stroke="currentColor" stroke-width="1.8" fill="currentColor" fill-opacity="0.2"/>
                </svg>
              </button>
              <button id="sitmonVolumeBtn" class="sitmon-music-btn" aria-label="Mute/Unmute Background Music" title="Mute/Unmute Background Music">
                <svg class="sitmon-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <input type="range" id="sitmonVolumeSlider" class="sitmon-volume-slider" min="0" max="100" value="50" aria-label="Volume" title="Volume">
              <button id="sitmonSkipBtn" class="sitmon-music-btn music-skip-btn" aria-label="Skip to Next Song" title="Skip to Next Song">
                <svg class="sitmon-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
                  <path d="M5 4v16l11-8L5 4z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/>
                  <path d="M19 4v16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <button class="sitmon-refresh-btn" id="sitmon-refresh-btn" aria-label="Refresh all data">
              <svg class="sitmon-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18" preserveAspectRatio="xMidYMid meet">
                <path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Refresh
            </button>
            <label class="sitmon-auto-refresh-toggle">
              <input type="checkbox" id="sitmon-auto-refresh" checked>
              <span>Auto-refresh (5min)</span>
            </label>
            <button class="sitmon-tab-btn" id="sitmon-tab-livecams" aria-label="Live Cams">
              📹 LIVE CAMS
            </button>
          </div>
        </div>

        <!-- Main Dashboard Grid -->
        <div class="sitmon-dashboard-grid" style="display: grid !important; visibility: visible !important; opacity: 1 !important;">
          <!-- Left Column: Map Card -->
          <div class="sitmon-map-card">
            <div class="sitmon-card-header">
              <h2 class="sitmon-card-title">World Map</h2>
            </div>
            <div class="sitmon-card-body">
            <div id="sitmon-map" class="sitmon-map"></div>
            </div>
          </div>

          <!-- Right Column: Analysis Panels Stack -->
          <div class="sitmon-panels-stack">
            <div class="sitmon-panel-card" id="sitmon-panel-intel">
              <div class="sitmon-card-header">
                <h2 class="sitmon-card-title">Main Characters</h2>
              </div>
              <div class="sitmon-card-body" id="sitmon-panel-intel-body"></div>
            </div>

            <div class="sitmon-panel-card" id="sitmon-panel-correlation">
              <div class="sitmon-card-header">
                <h2 class="sitmon-card-title">Correlations</h2>
              </div>
              <div class="sitmon-card-body" id="sitmon-panel-correlation-body"></div>
            </div>

            <div class="sitmon-panel-card" id="sitmon-panel-narrative">
              <div class="sitmon-card-header">
                <h2 class="sitmon-card-title">Narrative Signals</h2>
              </div>
              <div class="sitmon-card-body" id="sitmon-panel-narrative-body"></div>
            </div>

            <div class="sitmon-panel-card" id="sitmon-panel-monitors">
              <div class="sitmon-card-header">
                <h2 class="sitmon-card-title">Custom Monitors</h2>
              </div>
              <div class="sitmon-card-body" id="sitmon-panel-monitors-body"></div>
            </div>
          </div>
        </div>

        <!-- Secondary Panels Grid -->
        <div class="sitmon-secondary-grid" style="display: grid !important; visibility: visible !important; opacity: 1 !important;">
          <div class="sitmon-panel-card" id="sitmon-panel-news">
            <div class="sitmon-card-header">
              <h2 class="sitmon-card-title">News Feed</h2>
            </div>
            <div class="sitmon-card-body" id="sitmon-panel-news-body"></div>
          </div>

          <div class="sitmon-panel-card" id="sitmon-panel-markets">
            <div class="sitmon-card-header">
              <h2 class="sitmon-card-title">Markets</h2>
            </div>
            <div class="sitmon-card-body" id="sitmon-panel-markets-body"></div>
          </div>

          <div class="sitmon-panel-card" id="sitmon-panel-earthquakes">
            <div class="sitmon-card-header">
              <h2 class="sitmon-card-title">Earthquakes</h2>
            </div>
            <div class="sitmon-card-body" id="sitmon-panel-earthquakes-body"></div>
          </div>

          <div class="sitmon-panel-card" id="sitmon-panel-weather">
            <div class="sitmon-card-header">
              <h2 class="sitmon-card-title">Weather Alerts</h2>
            </div>
            <div class="sitmon-card-body" id="sitmon-panel-weather-body"></div>
          </div>

          <div class="sitmon-panel-card" id="sitmon-panel-rss">
            <div class="sitmon-card-header">
              <h2 class="sitmon-card-title">RSS Intelligence</h2>
            </div>
            <div class="sitmon-card-body" id="sitmon-panel-rss-body"></div>
          </div>
          
          <div class="sitmon-panel-card" id="sitmon-panel-livecams" style="display: none; grid-column: 1 / -1; height: calc(100vh - 200px);">
            <div class="sitmon-card-header">
              <h2 class="sitmon-card-title">LIVE CAMS</h2>
            </div>
            <div class="sitmon-card-body" id="sitmon-panel-livecams-body" style="padding: 0; height: 100%; overflow: hidden;"></div>
          </div>
        </div>
      </div>
    `;

    setLoaderPhase('DECRYPT');
    setLoaderProgress(0.15);
    
    // Initialize map
    await this.initMap();
    
    setLoaderPhase('SYNC');
    setLoaderProgress(0.35);

    // Initialize panels (now async - waits for DOM and calls init() on all panels)
    await this.initPanels();
    
    setLoaderProgress(0.50);

    // Setup controls
    this.setupControls();
    
    setLoaderProgress(0.60);
    
    // Initialize enhancement features
    this.initToastSystem();
    this.initKeyboardShortcuts();
    
    setLoaderProgress(0.70);
    
    // Initialize drawers and overlays
    this.initDrawers();
    this.initBigBoardOverlay();
    this.initDiagnostics();
    
    setLoaderPhase('RENDER');
    setLoaderProgress(0.80);

    // Initial data load
    await this.refreshAll();
    
    setLoaderProgress(0.95);

    // Setup auto-refresh
    this.setupAutoRefresh();
    
    // Show keyboard hint only after successful initialization
    this.initKeyboardHint();
    
    // CRITICAL: Start continuous visibility monitor to prevent content from being hidden
    this.startVisibilityMonitor();
    
    // All systems ready - hide loader
    setLoaderPhase('READY');
    setLoaderProgress(1.0);
    
    // Small delay for "READY" phase to be visible (reduced from 500ms to 200ms for faster UX)
    setTimeout(() => {
      hideLoader();
      
      // CRITICAL: Ensure container is visible after loader hides
      setTimeout(() => {
        const container = document.getElementById(this.containerId);
        if (container) {
          // Force visibility
          container.style.display = 'block';
          container.style.visibility = 'visible';
          container.style.opacity = '1';
          container.style.zIndex = '1';
          // Ensure wrapper is visible
          const wrapper = container.querySelector('.sitmon-page-wrapper');
          if (wrapper) {
            wrapper.style.display = 'block';
            wrapper.style.visibility = 'visible';
            wrapper.style.opacity = '1';
            wrapper.style.position = 'relative';
            wrapper.style.zIndex = '1';
            // Force all child elements to be visible
            const allChildren = wrapper.querySelectorAll('*');
            allChildren.forEach(child => {
              const computed = window.getComputedStyle(child);
              if (computed.display === 'none') {
                child.style.display = '';
              }
              if (computed.visibility === 'hidden') {
                child.style.visibility = '';
              }
              if (computed.opacity === '0') {
                child.style.opacity = '';
              }
            });
          }
          
          // Also aggressively remove any stuck loaders/overlays and placeholder
          const stuckLoader = document.getElementById('nn-intel-loader');
          if (stuckLoader) {
            stuckLoader.style.display = 'none';
            stuckLoader.style.visibility = 'hidden';
            stuckLoader.style.opacity = '0';
            stuckLoader.style.pointerEvents = 'none';
            stuckLoader.style.zIndex = '-999999';
          }
          
          const placeholder = document.getElementById('sitmon-loading-placeholder');
          if (placeholder) {
            placeholder.style.display = 'none';
            placeholder.style.visibility = 'hidden';
            placeholder.style.opacity = '0';
          }
          
          console.log('[SituationMonitorShell] ✅ Container and wrapper visibility forced after loader hide');
        } else {
          console.error('[SituationMonitorShell] ❌ Container not found after loader hide!');
        }
      }, 100); // Small delay to ensure loader removal completes
    }, 200);
    } catch (error) {
      console.error('[SituationMonitorShell] Critical init error:', error);
      // Ensure loader hides even on error
      hideLoader();
      
      // CRITICAL: Ensure container is visible even on error
      setTimeout(() => {
        const container = document.getElementById(this.containerId);
        if (container) {
          container.style.display = 'block';
          container.style.visibility = 'visible';
          container.style.opacity = '1';
          container.style.zIndex = '1';
          console.log('[SituationMonitorShell] ✅ Container visibility forced after error');
        }
      }, 100);
      
      // Show error message to user
      this.showToast('Initialization error - some features may be unavailable', 'error');
    }
  }

  async initMap() {
    const mapContainer = document.getElementById('sitmon-map');
    if (!mapContainer) {
      console.error('[SituationMonitorShell] Map container not found');
      return;
    }

    // Show placeholder while loading
    mapContainer.innerHTML = `
      <div class="sitmon-map-placeholder" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: rgba(255, 255, 255, 0.6);">
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="width: 80px; height: 80px; margin-bottom: 1rem; opacity: 0.5;">
          <defs>
            <linearGradient id="mapPlaceholderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#22d3ee;stop-opacity:0.3" />
              <stop offset="50%" style="stop-color:#4A90E2;stop-opacity:0.3" />
              <stop offset="100%" style="stop-color:#22d3ee;stop-opacity:0.3" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="45" fill="url(#mapPlaceholderGradient)"/>
          <ellipse cx="50" cy="30" rx="35" ry="8" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
          <ellipse cx="50" cy="50" rx="40" ry="10" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
          <ellipse cx="50" cy="70" rx="35" ry="8" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
          <path d="M 15 50 Q 50 20, 85 50" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
          <path d="M 15 50 Q 50 50, 85 50" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
          <path d="M 15 50 Q 50 80, 85 50" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
        </svg>
        <p style="font-size: 0.9rem;">Map loading...</p>
      </div>
    `;

    // Wait for container to be sized and D3/TopoJSON to be available
    await new Promise(resolve => setTimeout(resolve, 200));

    // Check if D3 and TopoJSON are available
    if (typeof window.d3 === 'undefined' || typeof window.topojson === 'undefined') {
      console.error('[SituationMonitorShell] D3 or TopoJSON not available');
      mapContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: rgba(255, 255, 255, 0.6);">
          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="width: 80px; height: 80px; margin-bottom: 1rem; opacity: 0.5;">
            <defs>
              <linearGradient id="mapErrorGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#ff6b6b;stop-opacity:0.3" />
                <stop offset="50%" style="stop-color:#ffaa00;stop-opacity:0.3" />
                <stop offset="100%" style="stop-color:#ff6b6b;stop-opacity:0.3" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="45" fill="url(#mapErrorGradient)"/>
            <ellipse cx="50" cy="30" rx="35" ry="8" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
            <ellipse cx="50" cy="50" rx="40" ry="10" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
            <ellipse cx="50" cy="70" rx="35" ry="8" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
            <path d="M 15 50 Q 50 20, 85 50" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
            <path d="M 15 50 Q 50 50, 85 50" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
            <path d="M 15 50 Q 50 80, 85 50" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
          </svg>
          <p style="font-size: 0.9rem;">Map libraries not loaded</p>
        </div>
      `;
      return;
    }

    // Get actual container dimensions
    const rect = mapContainer.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 500;

    try {
      // Clear placeholder before initializing map
      mapContainer.innerHTML = '';

    this.mapView = new MapView('sitmon-map', {
        width: Math.max(width, 400),
        height: Math.max(height, 300)
    });

      // Handle resize with debounce
      let resizeTimeout;
      const handleResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
      if (this.mapView && mapContainer) {
            const newRect = mapContainer.getBoundingClientRect();
            const newWidth = newRect.width || width;
            const newHeight = newRect.height || height;
            if (newWidth > 0 && newHeight > 0) {
        this.mapView.resize(newWidth, newHeight);
      }
          }
        }, 250);
      };

      window.addEventListener('resize', handleResize);
      
      // Also handle orientation change on mobile
      window.addEventListener('orientationchange', () => {
        setTimeout(handleResize, 500);
      });
    } catch (error) {
      console.error('[SituationMonitorShell] Map initialization error:', error);
      mapContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: rgba(255, 255, 255, 0.6);">
          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="width: 80px; height: 80px; margin-bottom: 1rem; opacity: 0.5;">
            <defs>
              <linearGradient id="mapErrorGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#ff6b6b;stop-opacity:0.3" />
                <stop offset="50%" style="stop-color:#ffaa00;stop-opacity:0.3" />
                <stop offset="100%" style="stop-color:#ff6b6b;stop-opacity:0.3" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="45" fill="url(#mapErrorGradient)"/>
            <ellipse cx="50" cy="30" rx="35" ry="8" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
            <ellipse cx="50" cy="50" rx="40" ry="10" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
            <ellipse cx="50" cy="70" rx="35" ry="8" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
            <path d="M 15 50 Q 50 20, 85 50" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
            <path d="M 15 50 Q 50 50, 85 50" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
            <path d="M 15 50 Q 50 80, 85 50" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
          </svg>
          <p style="font-size: 0.9rem;">Map data unavailable</p>
        </div>
      `;
    }
  }

  async initPanels() {
    // CRITICAL: Wait for DOM to be ready before creating panels
    // The container HTML was just injected, but we need to ensure all elements exist
    await new Promise(resolve => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve);
      } else {
        // DOM already ready, but wait a tick for elements to be available
        setTimeout(resolve, 0);
      }
    });

    // CRITICAL: Verify all required panel body elements exist before creating panels
    const requiredBodies = [
      'sitmon-panel-news-body',
      'sitmon-panel-earthquakes-body',
      'sitmon-panel-weather-body',
      'sitmon-panel-markets-body',
      'sitmon-panel-intel-body',
      'sitmon-panel-correlation-body',
      'sitmon-panel-narrative-body',
      'sitmon-panel-monitors-body',
      'sitmon-panel-rss-body'
    ];
    
    const missingBodies = requiredBodies.filter(id => {
      const el = document.getElementById(id);
      return !el || el.nodeType !== 1;
    });
    
    if (missingBodies.length > 0) {
      console.error('[SituationMonitorShell] CRITICAL: Missing panel body elements:', missingBodies);
      console.error('[SituationMonitorShell] Cannot initialize panels - DOM structure incomplete');
      // Don't throw - just log and skip panel initialization
      return;
    }

    // Data panels - using body containers
    this.panels.news = new NewsPanel('sitmon-panel-news-body');
    this.panels.markets = new MarketsPanel('sitmon-panel-markets-body');
    this.panels.earthquakes = new EarthquakePanel('sitmon-panel-earthquakes-body');
    this.panels.weather = new WeatherAlertsPanel('sitmon-panel-weather-body');

    // Analysis panels - using body containers
    this.panels.intel = new IntelFeedPanel('sitmon-panel-intel-body');
    this.panels.correlation = new CorrelationPanel('sitmon-panel-correlation-body');
    this.panels.narrative = new NarrativePanel('sitmon-panel-narrative-body');
    this.panels.monitors = new MonitorsPanel('sitmon-panel-monitors-body', this.mapView);
    
    // RSS Intelligence panel
    this.panels.rss = new RSSIntelligencePanel('sitmon-panel-rss-body');

    // CRITICAL: Initialize all panels (none call init() in constructor anymore)
    const initPromises = [];
    
    // Initialize NewsPanel (was missing - Bug 1 fix)
    if (this.panels.news && typeof this.panels.news.init === 'function') {
      initPromises.push(Promise.resolve(this.panels.news.init()).catch(err => {
        console.error('[SituationMonitorShell] NewsPanel init error:', err);
      }));
    }
    
    // Initialize panels that don't auto-init
    if (this.panels.markets && typeof this.panels.markets.init === 'function') {
      initPromises.push(Promise.resolve(this.panels.markets.init()).catch(err => {
        console.error('[SituationMonitorShell] MarketsPanel init error:', err);
      }));
    }
    
    if (this.panels.earthquakes && typeof this.panels.earthquakes.init === 'function') {
      initPromises.push(Promise.resolve(this.panels.earthquakes.init()).catch(err => {
        console.error('[SituationMonitorShell] EarthquakePanel init error:', err);
      }));
    }
    
    if (this.panels.weather && typeof this.panels.weather.init === 'function') {
      initPromises.push(Promise.resolve(this.panels.weather.init()).catch(err => {
        console.error('[SituationMonitorShell] WeatherAlertsPanel init error:', err);
      }));
    }
    
    // CRITICAL: MonitorsPanel MUST be initialized before updateMatches() is called
    if (this.panels.monitors && typeof this.panels.monitors.init === 'function') {
      initPromises.push(Promise.resolve(this.panels.monitors.init()).catch(err => {
        console.error('[SituationMonitorShell] MonitorsPanel init error:', err);
      }));
    }
    
    if (this.panels.intel && typeof this.panels.intel.init === 'function') {
      initPromises.push(Promise.resolve(this.panels.intel.init()).catch(err => {
        console.error('[SituationMonitorShell] IntelFeedPanel init error:', err);
      }));
    }
    
    if (this.panels.correlation && typeof this.panels.correlation.init === 'function') {
      initPromises.push(Promise.resolve(this.panels.correlation.init()).catch(err => {
        console.error('[SituationMonitorShell] CorrelationPanel init error:', err);
      }));
    }
    
    if (this.panels.narrative && typeof this.panels.narrative.init === 'function') {
      initPromises.push(Promise.resolve(this.panels.narrative.init()).catch(err => {
        console.error('[SituationMonitorShell] NarrativePanel init error:', err);
      }));
    }
    
    if (this.panels.rss && typeof this.panels.rss.init === 'function') {
      initPromises.push(Promise.resolve(this.panels.rss.init()).catch(err => {
        console.error('[SituationMonitorShell] RSSIntelligencePanel init error:', err);
      }));
    }

    // Wait for all panels to initialize
    await Promise.all(initPromises);

    // Setup cross-panel updates
    this.panels.news.onRetry = () => this.panels.news.loadNews();
    this.panels.markets.onRetry = () => this.panels.markets.loadMarkets();
    this.panels.earthquakes.onRetry = () => this.panels.earthquakes.loadEarthquakes();
    this.panels.weather.onRetry = () => this.panels.weather.loadAlerts();
  }

  setupControls() {
    const refreshBtn = document.getElementById('sitmon-refresh-btn');
    const autoRefreshCheckbox = document.getElementById('sitmon-auto-refresh');
    const statusChip = document.getElementById('sitmon-status-chip');

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshAll());
    }

    if (autoRefreshCheckbox) {
      autoRefreshCheckbox.addEventListener('change', (e) => {
        this.autoRefresh = e.target.checked;
        this.setupAutoRefresh();
        this.showToast(
          e.target.checked ? 'Auto-refresh enabled' : 'Auto-refresh disabled',
          'info'
        );
      });
    }
    
    // Store status chip reference
    this.statusChip = statusChip;
    
    // Live Cams tab button
    const liveCamsTab = document.getElementById('sitmon-tab-livecams');
    if (liveCamsTab) {
      console.log('[SituationMonitorShell] Live Cams button found, attaching click handler');
      liveCamsTab.addEventListener('click', (e) => {
        console.log('[SituationMonitorShell] Live Cams button clicked');
        e.preventDefault();
        e.stopPropagation();
        this.toggleLiveCams();
      });
    } else {
      console.warn('[SituationMonitorShell] Live Cams button NOT FOUND - button may not be in DOM');
    }
  }
  
  async toggleLiveCams() {
    console.log('[SituationMonitorShell] toggleLiveCams() called');
    const liveCamsPanel = document.getElementById('sitmon-panel-livecams');
    const liveCamsTab = document.getElementById('sitmon-tab-livecams');
    
    if (!liveCamsPanel) {
      console.error('[SituationMonitorShell] Live Cams panel NOT FOUND in DOM');
      return;
    }
    
    const isVisible = liveCamsPanel.style.display !== 'none';
    console.log('[SituationMonitorShell] Live Cams panel visible:', isVisible);
    
    if (!isVisible) {
      // Show Live Cams panel
      console.log('[SituationMonitorShell] Showing Live Cams panel...');
      liveCamsPanel.style.display = 'block';
      if (liveCamsTab) {
        liveCamsTab.classList.add('active');
      }
      
      // Initialize Live Cams if not already initialized
      if (!this.liveCams) {
        console.log('[SituationMonitorShell] Initializing Live Cams...');
        await this.initLiveCams();
      } else {
        console.log('[SituationMonitorShell] Live Cams already initialized');
      }
    } else {
      // Hide Live Cams panel
      console.log('[SituationMonitorShell] Hiding Live Cams panel');
      liveCamsPanel.style.display = 'none';
      if (liveCamsTab) {
        liveCamsTab.classList.remove('active');
      }
    }
  }
  
  async initLiveCams() {
    console.log('[SituationMonitorShell] initLiveCams() called');
    const container = document.getElementById('sitmon-panel-livecams-body');
    if (!container) {
      console.error('[SituationMonitorShell] Live Cams container not found');
      return;
    }
    
    console.log('[SituationMonitorShell] Container found, attempting to import Live Cams module...');
    console.log('[SituationMonitorShell] Import path: ../../../js/liveCams/index.js');
    console.log('[SituationMonitorShell] Current file location: src/components/situation-monitor/SituationMonitorShell.js');
    
    try {
      // Dynamically import Live Cams module
      console.log('[SituationMonitorShell] Starting dynamic import...');
      
      // Use absolute path from site root (works regardless of current page location)
      // The path /js/liveCams/index.js should work from any page
      const importPath = '/js/liveCams/index.js';
      console.log('[SituationMonitorShell] Using absolute import path:', importPath);
      
      let module;
      try {
        module = await import(importPath);
        console.log('[SituationMonitorShell] ✅ Import successful');
      } catch (err) {
        console.error('[SituationMonitorShell] ❌ Import failed:', err);
        throw new Error(`Failed to import Live Cams module from ${importPath}: ${err.message}`);
      }
      
      console.log('[SituationMonitorShell] Module imported successfully:', Object.keys(module));
      
      // Try default export first (since we export default), then named export
      let LiveCams = module.default || module.LiveCams;
      if (!LiveCams) {
        throw new Error('LiveCams class not found in module. Exported: ' + Object.keys(module).join(', '));
      }
      console.log('[SituationMonitorShell] LiveCams class found:', typeof LiveCams, 'from', module.default ? 'default' : 'named export');
      
      console.log('[SituationMonitorShell] Creating LiveCams instance...');
      this.liveCams = new LiveCams(container, this.mapView);
      console.log('[SituationMonitorShell] LiveCams instance created, calling init()...');
      
      // Await initialization to ensure UI is fully loaded before showing panel
      // This prevents blank/partially-loaded UI when panel is first displayed
      await this.liveCams.init();
      console.log('[SituationMonitorShell] ✅ Live Cams initialized successfully');
    } catch (error) {
      console.error('[SituationMonitorShell] ❌ Error initializing Live Cams:', error);
      console.error('[SituationMonitorShell] Error name:', error.name);
      console.error('[SituationMonitorShell] Error message:', error.message);
      console.error('[SituationMonitorShell] Error stack:', error.stack);
      
      // Try to get more details about the error
      if (error.message && error.message.includes('Failed to fetch')) {
        console.error('[SituationMonitorShell] This looks like a module loading error - check import path');
      }
      
      this.showToast('Failed to load Live Cams: ' + (error.message || 'Unknown error'), 'error');
      
      // Show error in container
      container.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: #ff6b6b;">
          <h3>Live Cams Failed to Load</h3>
          <p>${error.message || 'Unknown error'}</p>
          <p style="font-size: 0.85rem; color: #888; margin-top: 1rem;">Check browser console for details</p>
          <p style="font-size: 0.75rem; color: #666; margin-top: 0.5rem;">Error: ${error.name || 'Error'}</p>
        </div>
      `;
    }
  }
  
  initToastSystem() {
    // Create toast container if it doesn't exist
    let container = document.querySelector('.sitmon-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'sitmon-toast-container';
      document.body.appendChild(container);
    }
    this.toastContainer = container;
  }
  
  showToast(message, type = 'info', title = null) {
    if (!this.toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `sitmon-toast ${type}`;
    
    // Icon based on type
    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    } else {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    }
    
    toast.innerHTML = `
      <div class="sitmon-toast-icon" style="color: ${type === 'success' ? '#4ecdc4' : type === 'error' ? '#ff6b6b' : '#4A90E2'}">${iconSvg}</div>
      <div class="sitmon-toast-content">
        ${title ? `<div class="sitmon-toast-title">${title}</div>` : ''}
        <div class="sitmon-toast-message">${message}</div>
      </div>
      <button class="sitmon-toast-close" aria-label="Close">×</button>
    `;
    
    this.toastContainer.appendChild(toast);
    
    // Auto-remove after 4 seconds
    const autoRemove = setTimeout(() => {
      this.removeToast(toast);
    }, 4000);
    
    // Close button
    const closeBtn = toast.querySelector('.sitmon-toast-close');
    closeBtn.addEventListener('click', () => {
      clearTimeout(autoRemove);
      this.removeToast(toast);
    });
    
    return toast;
  }
  
  removeToast(toast) {
    if (!toast) return;
    toast.classList.add('hiding');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }
  
  initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }
      
      // Ctrl/Cmd + R - Refresh
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        this.refreshAll();
        this.showToast('Refreshing all data...', 'info');
      }
      
      // R - Quick refresh (without Ctrl)
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        // Only if not in a focused element
        if (document.activeElement === document.body || document.activeElement.tagName === 'DIV') {
          this.refreshAll();
          this.showToast('Refreshing all data...', 'info');
        }
      }
      
      // Escape - Close drawers
      if (e.key === 'Escape') {
        if (this.eventDrawer && this.eventDrawer.isOpen) {
          this.eventDrawer.close();
        }
        if (this.clusterDrawer && this.clusterDrawer.isOpen) {
          this.clusterDrawer.close();
        }
      }
      
      // ? - Toggle keyboard hints
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        const hint = document.querySelector('.sitmon-keyboard-hint');
        if (hint) {
          hint.classList.toggle('hidden');
        }
      }
    });
  }
  
  initKeyboardHint() {
    // Create keyboard shortcut hint panel
    const hint = document.createElement('div');
    hint.className = 'sitmon-keyboard-hint';
    hint.innerHTML = `
      <button class="sitmon-keyboard-hint-close" aria-label="Close keyboard hints" style="position: absolute; top: 8px; right: 8px; background: transparent; border: none; color: rgba(255, 255, 255, 0.6); cursor: pointer; padding: 4px; font-size: 18px; line-height: 1; transition: color 0.2s;">×</button>
      <div class="sitmon-keyboard-hint-title">Keyboard Shortcuts</div>
      <ul class="sitmon-keyboard-hint-list">
        <li class="sitmon-keyboard-hint-item">
          <span>Refresh data</span>
          <span class="sitmon-keyboard-hint-key">R</span>
        </li>
        <li class="sitmon-keyboard-hint-item">
          <span>Close drawers</span>
          <span class="sitmon-keyboard-hint-key">Esc</span>
        </li>
        <li class="sitmon-keyboard-hint-item">
          <span>Toggle hints</span>
          <span class="sitmon-keyboard-hint-key">?</span>
        </li>
      </ul>
    `;
    document.body.appendChild(hint);
    
    // Close button handler
    const closeBtn = hint.querySelector('.sitmon-keyboard-hint-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        hint.classList.add('hidden');
      });
      closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.color = '#fff';
      });
      closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.color = 'rgba(255, 255, 255, 0.6)';
      });
    }
    
    // Hide after 10 seconds, or on click
    setTimeout(() => {
      hint.classList.add('hidden');
    }, 10000);
    
    hint.addEventListener('click', () => {
      hint.classList.add('hidden');
    });
  }

  initDrawers() {
    this.eventDrawer = new EventDrawer();
    this.clusterDrawer = new ClusterDrawer();
  }
  
  initBigBoardOverlay() {
    // Wait for map to be initialized
    setTimeout(() => {
      this.bigBoardOverlay = new BigBoardOverlay();
      if (this.mapEvents.length > 0) {
        this.bigBoardOverlay.update(this.mapEvents);
      }
    }, 1000);
  }
  
  initDiagnostics() {
    this.diagnosticsPanel = new DiagnosticsPanel(this.eventPipeline, this.mapEvents);
    // Update diagnostics when events change
    const originalUpdate = this.diagnosticsPanel?.update.bind(this.diagnosticsPanel);
    if (originalUpdate) {
      // Will be called after refreshAll updates events
    }
  }

  setupAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    if (this.autoRefresh) {
      // Refresh every 5 minutes
      this.refreshInterval = setInterval(() => {
        this.refreshAll();
      }, 5 * 60 * 1000);
    }
  }

  async refreshAll() {
    // Single-flight: prevent multiple simultaneous refreshes
    if (this._refreshing) {
      console.log('[SituationMonitorShell] Refresh already in progress, skipping');
      return Promise.resolve(); // Return resolved promise to prevent hanging
    }
    
    // CRITICAL: Set flag immediately after check to prevent race condition
    // This must be set before creating the async function to ensure single-flight behavior
    this._refreshing = true;
    
    // Create refresh promise and store it
    const refreshPromise = (async () => {
      console.log('[SituationMonitorShell] Refreshing all data...');

    // Update UI state
    const refreshBtn = document.getElementById('sitmon-refresh-btn');
    const statusChip = this.statusChip;
    
    if (refreshBtn) {
      refreshBtn.classList.add('loading');
      refreshBtn.disabled = true;
    }
    
    if (statusChip) {
      statusChip.textContent = 'Updating...';
      statusChip.classList.add('updating');
    }

    try {
      // Refresh data panels
      await Promise.all([
        this.panels.news.loadNews(),
        this.panels.markets.loadMarkets(),
        this.panels.earthquakes.loadEarthquakes(),
        this.panels.weather.loadAlerts()
      ]);

      // Update analysis panels with news data
      const headlines = this.panels.news.getHeadlines();
      if (headlines && headlines.length > 0) {
        // Ensure panels are initialized before updating
        if (this.panels.intel && typeof this.panels.intel.update === 'function') {
          this.panels.intel.update(headlines);
        }
        if (this.panels.correlation && typeof this.panels.correlation.update === 'function') {
          this.panels.correlation.update(headlines);
        }
        if (this.panels.narrative && typeof this.panels.narrative.update === 'function') {
          this.panels.narrative.update(headlines);
        }
        // CRITICAL: Only call updateMatches if MonitorsPanel is initialized
        if (this.panels.monitors && typeof this.panels.monitors.updateMatches === 'function') {
          // Double-check that monitors array exists (init was called)
          if (this.panels.monitors.monitors !== undefined) {
            this.panels.monitors.updateMatches(headlines);
          } else {
            console.warn('[SituationMonitorShell] MonitorsPanel not initialized, skipping updateMatches');
          }
        }
        
        // Process headlines into map events
        try {
          const newEvents = await this.eventPipeline.processAndMerge(headlines, this.mapEvents);
          this.mapEvents = newEvents;
          
          // Update map with events
          if (this.mapView) {
            this.mapView.updateEvents(this.mapEvents);
          }
          
          // Update big board overlay
          if (this.bigBoardOverlay) {
            this.bigBoardOverlay.update(this.mapEvents);
          }
          
          // Update diagnostics panel
          if (this.diagnosticsPanel && this.diagnosticsPanel.isEnabled) {
            this.diagnosticsPanel.mapEvents = this.mapEvents;
            this.diagnosticsPanel.update();
          }
          
          // Save geocode cache
          this.eventPipeline.saveCache();
        } catch (error) {
          console.error('[SituationMonitorShell] Event pipeline error:', error);
        }
      }

      // Update map with earthquakes (unchanged - earthquakes work independently)
      // Clear old earthquake timeouts before adding new ones
      if (this.mapView) {
        this.mapView.clearEarthquakeTimeouts();
      }
      
      const earthquakes = this.panels.earthquakes.getEarthquakes();
      if (earthquakes && this.mapView) {
        earthquakes.slice(0, 20).forEach(eq => {
          this.mapView.addEarthquake(eq.lat, eq.lon, eq.magnitude);
        });
      }

      // Update status
      if (statusChip) {
        statusChip.textContent = 'Updated';
        statusChip.classList.remove('updating');
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        statusChip.title = `Last updated: ${timeStr}`;
      }
      
      if (refreshBtn) {
        refreshBtn.classList.remove('loading');
        refreshBtn.disabled = false;
      }
      
      // Show success toast
      this.showToast('All data refreshed successfully', 'success');

      console.log('[SituationMonitorShell] Refresh complete');
    } catch (error) {
      console.error('[SituationMonitorShell] Refresh error:', error);
      
      // CRITICAL: Ensure content stays visible even on error
      const container = document.getElementById(this.containerId);
      if (container) {
        container.style.display = 'block';
        container.style.visibility = 'visible';
        container.style.opacity = '1';
        const wrapper = container.querySelector('.sitmon-page-wrapper');
        if (wrapper) {
          wrapper.style.display = 'block';
          wrapper.style.visibility = 'visible';
          wrapper.style.opacity = '1';
        }
      }
      
      // Update status on error
      if (statusChip) {
        statusChip.textContent = 'Error';
        statusChip.classList.remove('updating');
      }
      
      if (refreshBtn) {
        refreshBtn.classList.remove('loading');
        refreshBtn.disabled = false;
      }
      
      // Show error toast
      this.showToast('Some data failed to refresh', 'error');
    } finally {
      // Always reset refreshing flag, even if error occurred
      this._refreshing = false;
    }
    })();
    
    // Store promise for single-flight pattern
    this._refreshPromise = refreshPromise;
    
    // Clear promise when done
    refreshPromise.finally(() => {
      this._refreshPromise = null;
    });
    
    return refreshPromise;
  }

  startVisibilityMonitor() {
    // Continuously monitor and force visibility to prevent content from being hidden
    this._visibilityMonitor = setInterval(() => {
      const container = document.getElementById(this.containerId);
      if (container) {
        const computed = window.getComputedStyle(container);
        if (computed.display === 'none' || computed.visibility === 'hidden' || computed.opacity === '0') {
          console.warn('[SituationMonitorShell] Container was hidden! Forcing visibility...');
          container.style.display = 'block';
          container.style.visibility = 'visible';
          container.style.opacity = '1';
          container.style.zIndex = '1';
        }
        
        const wrapper = container.querySelector('.sitmon-page-wrapper');
        if (wrapper) {
          const wrapperComputed = window.getComputedStyle(wrapper);
          if (wrapperComputed.display === 'none' || wrapperComputed.visibility === 'hidden' || wrapperComputed.opacity === '0') {
            console.warn('[SituationMonitorShell] Wrapper was hidden! Forcing visibility...');
            wrapper.style.display = 'block';
            wrapper.style.visibility = 'visible';
            wrapper.style.opacity = '1';
          }
        }
      }
      
      // Also check if loader is visible and hide it
      const loader = document.getElementById('nn-intel-loader');
      if (loader) {
        const loaderComputed = window.getComputedStyle(loader);
        if (loaderComputed.display !== 'none' && loaderComputed.visibility !== 'hidden') {
          console.warn('[SituationMonitorShell] Loader is still visible! Hiding it...');
          loader.style.display = 'none';
          loader.style.visibility = 'hidden';
          loader.style.opacity = '0';
          loader.style.zIndex = '-999999';
        }
      }
    }, 1000); // Check every second
  }

  destroy() {
    // Stop visibility monitor
    if (this._visibilityMonitor) {
      clearInterval(this._visibilityMonitor);
      this._visibilityMonitor = null;
    }
    
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    if (this.mapView) {
      this.mapView.destroy();
    }
    
    if (this.bigBoardOverlay) {
      this.bigBoardOverlay.destroy();
    }
    
    if (this.diagnosticsPanel) {
      this.diagnosticsPanel.destroy();
    }

    Object.values(this.panels).forEach(panel => {
      if (panel.destroy) {
        panel.destroy();
      }
    });
  }
}
