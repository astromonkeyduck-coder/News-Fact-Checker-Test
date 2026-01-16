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
import { globalEventStore, normalizeEarthquake, normalizeWeatherAlert, normalizeNewsHeadline } from './data/eventStore.js';
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
    this.eventStore = globalEventStore; // Use global event store
    this.pinnedEventId = null; // Currently pinned event
    this.lastIngestTime = null; // Last successful data fetch
    this.updateInterval = null; // Live update interval
    this.ingestTimer = null; // Timer for updating ingest time display
    
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
    
    // Create layout - OSINT Control Room
    container.innerHTML = `
      <!-- OSINT Ticker (Top) - Horizontal Feed Lines -->
      <div class="sitmon-osint-ticker" id="sitmon-osint-ticker">
        <div class="sitmon-ticker-feed" id="sitmon-ticker-content">
          <div class="sitmon-ticker-line">LIVE: Monitoring global intelligence feeds...</div>
        </div>
      </div>
      
      <div class="sitmon-page-wrapper" style="display: block !important; visibility: visible !important; opacity: 1 !important; position: relative !important; z-index: 1 !important; padding-top: 130px;">
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

        <!-- OSINT Grid Layout -->
        <div class="sitmon-osint-grid">
          <!-- Map: Columns 1-7 (Tactical Node, not hero) -->
          <div class="sitmon-intel-wall" style="grid-column: 1 / 8;">
          <!-- Map Container (Full Canvas) -->
          <div class="sitmon-map-container">
            <div id="sitmon-map" class="sitmon-map"></div>
            
            <!-- Left HUD: Stats + Filters -->
            <div class="sitmon-hud sitmon-hud-left">
              <div class="sitmon-hud-card">
                <div class="sitmon-hud-header">
                  <h3 class="sitmon-hud-title">STATS</h3>
                </div>
                <div class="sitmon-hud-body" id="sitmon-hud-stats">
                  <div class="sitmon-stat-item">
                    <span class="sitmon-stat-label">Active Events</span>
                    <span class="sitmon-stat-value" id="sitmon-stat-events">0</span>
                  </div>
                  <div class="sitmon-stat-item">
                    <span class="sitmon-stat-label">Critical</span>
                    <span class="sitmon-stat-value sitmon-stat-critical" id="sitmon-stat-critical">0</span>
                  </div>
                  <div class="sitmon-stat-item">
                    <span class="sitmon-stat-label">High</span>
                    <span class="sitmon-stat-value sitmon-stat-high" id="sitmon-stat-high">0</span>
                  </div>
            </div>
          </div>

              <div class="sitmon-hud-card">
                <div class="sitmon-hud-header">
                  <h3 class="sitmon-hud-title">FILTERS</h3>
                </div>
                <div class="sitmon-hud-body" id="sitmon-hud-filters">
                  <div class="sitmon-filter-group">
                    <label class="sitmon-filter-label">Severity</label>
                    <div class="sitmon-filter-buttons">
                      <button class="sitmon-filter-btn active" data-severity="all">All</button>
                      <button class="sitmon-filter-btn" data-severity="4">4+</button>
                      <button class="sitmon-filter-btn" data-severity="5">5</button>
                    </div>
                  </div>
                  <div class="sitmon-filter-group">
                    <label class="sitmon-filter-label">Category</label>
                    <div class="sitmon-filter-checkboxes">
                      <label><input type="checkbox" checked data-category="conflict"> Conflict</label>
                      <label><input type="checkbox" checked data-category="disaster"> Disaster</label>
                      <label><input type="checkbox" checked data-category="weather"> Weather</label>
                      <label><input type="checkbox" checked data-category="other"> Other</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Right HUD: Live Feed + Pinned Event -->
            <div class="sitmon-hud sitmon-hud-right">
              <!-- Live Feed -->
              <div class="sitmon-hud-card">
                <div class="sitmon-hud-header">
                  <h3 class="sitmon-hud-title">LIVE FEED</h3>
                  <span class="sitmon-hud-badge" id="sitmon-feed-count">0</span>
                </div>
                <div class="sitmon-hud-body sitmon-feed-list" id="sitmon-hud-feed">
                  <div class="sitmon-feed-empty">No events yet</div>
                </div>
              </div>
              
              <!-- Pinned Event Detail -->
              <div class="sitmon-hud-card" id="sitmon-pinned-event" style="display: none;">
                <div class="sitmon-hud-header">
                  <h3 class="sitmon-hud-title">EVENT DETAIL</h3>
                  <button class="sitmon-hud-close" id="sitmon-pinned-close">×</button>
                </div>
                <div class="sitmon-hud-body" id="sitmon-pinned-content">
                  <!-- Populated by JS -->
                </div>
              </div>
            </div>
            
            <!-- Bottom Status Bar (OSINT Status Strip) -->
            <div class="sitmon-osint-status-strip">
              <div class="sitmon-osint-status-item">
                <span class="sitmon-osint-status-label">INGEST:</span>
                <span class="sitmon-osint-status-value sitmon-telemetry" id="sitmon-status-last-ingest">--</span>
              </div>
              <div class="sitmon-osint-status-item">
                <span class="sitmon-osint-status-label">SOURCES:</span>
                <span class="sitmon-osint-status-value sitmon-telemetry online" id="sitmon-status-sources">ONLINE</span>
              </div>
              <div class="sitmon-osint-status-item">
                <span class="sitmon-osint-status-label">EVENTS/MIN:</span>
                <span class="sitmon-osint-status-value sitmon-telemetry sitmon-count" id="sitmon-status-events-min">0</span>
              </div>
              <div class="sitmon-osint-status-item">
                <label class="sitmon-status-toggle" style="font-family: 'SF Mono', 'Monaco', 'Consolas', monospace; font-size: 0.7rem;">
                  <input type="checkbox" id="sitmon-auto-refresh-hud" checked>
                  <span>AUTO</span>
                </label>
              </div>
            </div>
          </div>
          </div>
          
          <!-- Right Stack: Columns 8-12 (Micro-panels) -->
          <div class="sitmon-panels-stack" style="grid-column: 8 / 13;">
            <div class="sitmon-panel-card" id="sitmon-panel-intel">
              <div class="sitmon-card-header">
                <h2 class="sitmon-card-title">Main Characters</h2>
              </div>
              <div class="sitmon-card-body" id="sitmon-panel-intel-body"></div>
              <div class="sitmon-panel-resize-handle" data-panel-id="sitmon-panel-intel"></div>
            </div>

            <div class="sitmon-panel-card" id="sitmon-panel-correlation">
              <div class="sitmon-card-header">
                <h2 class="sitmon-card-title">Correlations</h2>
              </div>
              <div class="sitmon-card-body" id="sitmon-panel-correlation-body"></div>
              <div class="sitmon-panel-resize-handle" data-panel-id="sitmon-panel-correlation"></div>
            </div>

            <div class="sitmon-panel-card" id="sitmon-panel-narrative">
              <div class="sitmon-card-header">
                <h2 class="sitmon-card-title">Narrative Signals</h2>
              </div>
              <div class="sitmon-card-body" id="sitmon-panel-narrative-body"></div>
              <div class="sitmon-panel-resize-handle" data-panel-id="sitmon-panel-narrative"></div>
            </div>

            <div class="sitmon-panel-card" id="sitmon-panel-monitors">
              <div class="sitmon-card-header">
                <h2 class="sitmon-card-title">Custom Monitors</h2>
              </div>
              <div class="sitmon-card-body" id="sitmon-panel-monitors-body"></div>
              <div class="sitmon-panel-resize-handle" data-panel-id="sitmon-panel-monitors"></div>
            </div>
          </div>
        </div>

        <!-- Secondary Panels Grid (Below) - 12-Column OSINT Layout -->
        <div class="sitmon-secondary-grid" style="display: grid !important; visibility: visible !important; opacity: 1 !important;">
          <div class="sitmon-panel-card" id="sitmon-panel-news">
            <div class="sitmon-card-header">
              <h2 class="sitmon-card-title">News Feed</h2>
            </div>
            <div class="sitmon-card-body" id="sitmon-panel-news-body"></div>
            <div class="sitmon-panel-resize-handle" data-panel-id="sitmon-panel-news"></div>
          </div>

          <div class="sitmon-panel-card" id="sitmon-panel-markets">
            <div class="sitmon-card-header">
              <h2 class="sitmon-card-title">Markets</h2>
            </div>
            <div class="sitmon-card-body" id="sitmon-panel-markets-body"></div>
            <div class="sitmon-panel-resize-handle" data-panel-id="sitmon-panel-markets"></div>
          </div>

          <div class="sitmon-panel-card" id="sitmon-panel-earthquakes">
            <div class="sitmon-card-header">
              <h2 class="sitmon-card-title">Earthquakes</h2>
            </div>
            <div class="sitmon-card-body" id="sitmon-panel-earthquakes-body"></div>
            <div class="sitmon-panel-resize-handle" data-panel-id="sitmon-panel-earthquakes"></div>
          </div>

          <div class="sitmon-panel-card" id="sitmon-panel-weather">
            <div class="sitmon-card-header">
              <h2 class="sitmon-card-title">Weather Alerts</h2>
            </div>
            <div class="sitmon-card-body" id="sitmon-panel-weather-body"></div>
            <div class="sitmon-panel-resize-handle" data-panel-id="sitmon-panel-weather"></div>
          </div>

          <div class="sitmon-panel-card" id="sitmon-panel-rss">
            <div class="sitmon-card-header">
              <h2 class="sitmon-card-title">RSS Intelligence</h2>
            </div>
            <div class="sitmon-card-body" id="sitmon-panel-rss-body"></div>
            <div class="sitmon-panel-resize-handle" data-panel-id="sitmon-panel-rss"></div>
          </div>
          
          <div class="sitmon-panel-card" id="sitmon-panel-livecams" style="display: none; grid-column: 1 / -1; min-height: calc(100vh - 200px); height: auto; max-height: none;">
            <div class="sitmon-card-header">
              <h2 class="sitmon-card-title">LIVE CAMS</h2>
            </div>
            <div class="sitmon-card-body" id="sitmon-panel-livecams-body" style="padding: 0; height: auto; min-height: calc(100vh - 250px); overflow: visible;"></div>
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
    
    // Initialize panel resize functionality
    this.initPanelResize();
    
    // Setup HUD components
    this.setupHUD();
    
    // Subscribe to event store updates
    this.eventStore.onUpdate((events) => {
      this.updateMapEvents(events);
      this.updateHUDStats(events);
      this.updateLiveFeed(events);
    });
    
    // Initialize enhancement features
    this.initToastSystem();
    this.initKeyboardShortcuts();
    
    // Start live updates
    this.startLiveUpdates();
    
    setLoaderProgress(0.70);
    
    // Initialize drawers and overlays
    this.initDrawers();
    // BigBoardOverlay removed - stats are now in left HUD
    // this.initBigBoardOverlay();
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
    // Retry up to 10 times (2 seconds total) for libraries to load
    let retries = 0;
    const maxRetries = 10;
    while ((typeof window.d3 === 'undefined' || typeof window.topojson === 'undefined') && retries < maxRetries) {
    await new Promise(resolve => setTimeout(resolve, 200));
      retries++;
      if (retries < maxRetries) {
        console.log(`[SituationMonitorShell] Waiting for D3/TopoJSON... (attempt ${retries}/${maxRetries})`);
      }
    }

    // Check if D3 and TopoJSON are available
    if (typeof window.d3 === 'undefined') {
      console.error('[SituationMonitorShell] D3.js not available after', maxRetries, 'retries');
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
          <p style="font-size: 0.9rem;">D3.js library not loaded</p>
          <p style="font-size: 0.75rem; color: rgba(255,255,255,0.5); margin-top: 0.5rem;">Please refresh the page</p>
        </div>
      `;
      return;
    }

    // TopoJSON is optional - map will use fallback if not available
    if (typeof window.topojson === 'undefined') {
      console.warn('[SituationMonitorShell] TopoJSON not available, map will use fallback rendering');
    }

    try {
      // Clear placeholder before initializing map
      mapContainer.innerHTML = '';

      // MapView now uses ResizeObserver internally, no need to pass dimensions
      this.mapView = new MapView('sitmon-map');
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

    // Check which panel body elements exist (some may be optional in new layout)
    const panelBodies = {
      news: 'sitmon-panel-news-body',
      earthquakes: 'sitmon-panel-earthquakes-body',
      weather: 'sitmon-panel-weather-body',
      markets: 'sitmon-panel-markets-body',
      intel: 'sitmon-panel-intel-body',
      correlation: 'sitmon-panel-correlation-body',
      narrative: 'sitmon-panel-narrative-body',
      monitors: 'sitmon-panel-monitors-body',
      rss: 'sitmon-panel-rss-body'
    };
    
    // Check which panels are available
    const availablePanels = {};
    const missingBodies = [];
    
    for (const [key, id] of Object.entries(panelBodies)) {
      const el = document.getElementById(id);
      if (el && el.nodeType === 1) {
        availablePanels[key] = id;
      } else {
        missingBodies.push(id);
      }
    }
    
    if (missingBodies.length > 0) {
      console.warn('[SituationMonitorShell] Some panel body elements are missing (may be expected in new layout):', missingBodies);
    }

    // Only initialize panels that have their containers available

    // Data panels - only initialize if containers exist
    if (availablePanels.news) {
    this.panels.news = new NewsPanel('sitmon-panel-news-body');
    }
    if (availablePanels.markets) {
    this.panels.markets = new MarketsPanel('sitmon-panel-markets-body');
    }
    if (availablePanels.earthquakes) {
    this.panels.earthquakes = new EarthquakePanel('sitmon-panel-earthquakes-body');
    }
    if (availablePanels.weather) {
    this.panels.weather = new WeatherAlertsPanel('sitmon-panel-weather-body');
    }

    // Analysis panels - only initialize if containers exist
    if (availablePanels.intel) {
    this.panels.intel = new IntelFeedPanel('sitmon-panel-intel-body');
    }
    if (availablePanels.correlation) {
    this.panels.correlation = new CorrelationPanel('sitmon-panel-correlation-body');
    }
    if (availablePanels.narrative) {
    this.panels.narrative = new NarrativePanel('sitmon-panel-narrative-body');
    }
    if (availablePanels.monitors) {
    this.panels.monitors = new MonitorsPanel('sitmon-panel-monitors-body', this.mapView);
    }
    
    // RSS Intelligence panel
    if (availablePanels.rss) {
    this.panels.rss = new RSSIntelligencePanel('sitmon-panel-rss-body');
    }

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
  
  initPanelResize() {
    const resizeHandles = document.querySelectorAll('.sitmon-panel-resize-handle');
    
    resizeHandles.forEach(handle => {
      let isResizing = false;
      let startY = 0;
      let startHeight = 0;
      let panel = null;
      let originalHeight = null;
      
      const panelId = handle.getAttribute('data-panel-id');
      if (!panelId) return;
      
      panel = document.getElementById(panelId);
      if (!panel) return;
      
      // Add tooltip data attribute
      handle.setAttribute('data-tooltip', 'Drag to resize • Double-click to reset');
      
      // Store original height for reset
      originalHeight = panel.offsetHeight;
      
      // Load saved height from localStorage
      const savedHeight = localStorage.getItem(`sitmon-panel-height-${panelId}`);
      if (savedHeight) {
        const height = parseInt(savedHeight, 10);
        if (height > 0) {
          panel.style.height = `${height}px`;
          panel.style.maxHeight = 'none';
          panel.style.flexShrink = '0';
        }
      }
      
      // Double-click to reset to original/default height
      handle.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Remove saved height
        localStorage.removeItem(`sitmon-panel-height-${panelId}`);
        
        // Reset to default (remove inline height)
        panel.style.height = '';
        panel.style.maxHeight = '';
        panel.style.flexShrink = '';
        
        // Show brief feedback
        handle.style.background = 'rgba(34, 211, 238, 0.4)';
        setTimeout(() => {
          handle.style.background = '';
        }, 300);
      });
      
      const startResize = (e) => {
        isResizing = true;
        startY = e.clientY || e.touches[0].clientY;
        startHeight = panel.offsetHeight;
        
        // Add visual feedback class
        document.body.classList.add('resizing-panel');
        panel.classList.add('sitmon-panel-resizing');
        handle.classList.add('sitmon-resize-active');
        
        e.preventDefault();
        e.stopPropagation();
      };
      
      const doResize = (e) => {
        if (!isResizing) return;
        
        const currentY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : startY);
        const deltaY = currentY - startY;
        
        // Calculate new height with min/max constraints
        // Minimum: 320px, Maximum: 90vh or 2500px (whichever is smaller)
        const minHeight = 320;
        const maxHeight = Math.min(window.innerHeight * 0.9, 2500);
        const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY));
        
        // Apply height and override flex constraints
        panel.style.height = `${newHeight}px`;
        panel.style.maxHeight = 'none';
        panel.style.flexShrink = '0';
        panel.style.flexGrow = '0';
        panel.style.flexBasis = 'auto';
        
        // Prevent default to avoid scrolling
        e.preventDefault();
        e.stopPropagation();
        
        // Update handle position indicator
        const percent = ((newHeight - minHeight) / (maxHeight - minHeight)) * 100;
        handle.setAttribute('data-resize-percent', Math.round(percent));
      };
      
      const stopResize = () => {
        if (!isResizing) return;
        isResizing = false;
        
        // Remove visual feedback classes
        document.body.classList.remove('resizing-panel');
        panel.classList.remove('sitmon-panel-resizing');
        handle.classList.remove('sitmon-resize-active');
        
        // Save height to localStorage
        if (panel) {
          const height = panel.offsetHeight;
          localStorage.setItem(`sitmon-panel-height-${panelId}`, height.toString());
          
          // Show save confirmation briefly
          handle.style.background = 'rgba(74, 222, 128, 0.3)';
          setTimeout(() => {
            handle.style.background = '';
          }, 200);
        }
      };
      
      // Mouse events - use capture phase to ensure we catch events
      handle.addEventListener('mousedown', startResize, true);
      document.addEventListener('mousemove', doResize, true);
      document.addEventListener('mouseup', stopResize, true);
      
      // Touch events
      handle.addEventListener('touchstart', startResize, { passive: false, capture: true });
      document.addEventListener('touchmove', (e) => {
        if (isResizing) {
          e.preventDefault();
          e.stopPropagation();
          doResize(e);
        }
      }, { passive: false, capture: true });
      document.addEventListener('touchend', stopResize, true);
    });
  }
  
  setupHUD() {
    // Setup filters
    const filterButtons = document.querySelectorAll('.sitmon-filter-btn');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.applyFilters();
      });
    });
    
    const filterCheckboxes = document.querySelectorAll('.sitmon-filter-checkboxes input[type="checkbox"]');
    filterCheckboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        this.applyFilters();
      });
    });
    
    // Setup pinned event close
    const pinnedClose = document.getElementById('sitmon-pinned-close');
    if (pinnedClose) {
      pinnedClose.addEventListener('click', () => {
        this.unpinEvent();
      });
    }
    
    // Setup auto-refresh toggle
    const autoRefreshToggle = document.getElementById('sitmon-auto-refresh-hud');
    if (autoRefreshToggle) {
      autoRefreshToggle.addEventListener('change', (e) => {
        this.autoRefresh = e.target.checked;
        if (this.autoRefresh) {
          this.startLiveUpdates();
        } else {
          this.stopLiveUpdates();
        }
      });
    }
    
    // Listen for event clicks
    document.addEventListener('sitmon:event-click', (e) => {
      this.pinEvent(e.detail.event);
    });
  }
  
  applyFilters() {
    const activeSeverity = document.querySelector('.sitmon-filter-btn.active')?.getAttribute('data-severity');
    const activeCategories = Array.from(document.querySelectorAll('.sitmon-filter-checkboxes input[type="checkbox"]:checked'))
      .map(cb => cb.getAttribute('data-category'));
    
    const filters = {
      minSeverity: activeSeverity === 'all' ? undefined : parseInt(activeSeverity) || undefined,
      categories: activeCategories.length > 0 ? activeCategories : undefined
    };
    
    const filtered = this.eventStore.getFilteredEvents(filters);
    this.updateMapEvents(filtered);
  }
  
  updateMapEvents(events) {
    if (!this.mapView) return;
    
    // Filter events that have location
    const mappableEvents = events.filter(e => e.location && e.location.lat && e.location.lon);
    this.mapView.updateEvents(mappableEvents);
  }
  
  updateHUDStats(events) {
    const total = events.length;
    const critical = events.filter(e => e.severity >= 5).length;
    const high = events.filter(e => e.severity >= 4 && e.severity < 5).length;
    
    const totalEl = document.getElementById('sitmon-stat-events');
    const criticalEl = document.getElementById('sitmon-stat-critical');
    const highEl = document.getElementById('sitmon-stat-high');
    
    // Animate value changes
    const animateValueChange = (el, newValue, oldValue) => {
      if (el && newValue !== oldValue) {
        el.classList.add('updated');
        setTimeout(() => el.classList.remove('updated'), 600);
      }
    };
    
    const oldTotal = totalEl ? parseInt(totalEl.textContent) || 0 : 0;
    const oldCritical = criticalEl ? parseInt(criticalEl.textContent) || 0 : 0;
    const oldHigh = highEl ? parseInt(highEl.textContent) || 0 : 0;
    
    if (totalEl) {
      totalEl.textContent = total;
      animateValueChange(totalEl, total, oldTotal);
    }
    if (criticalEl) {
      criticalEl.textContent = critical;
      animateValueChange(criticalEl, critical, oldCritical);
    }
    if (highEl) {
      highEl.textContent = high;
      animateValueChange(highEl, high, oldHigh);
    }
    
    // Mark panels with critical events
    const panels = document.querySelectorAll('.sitmon-panel-card');
    panels.forEach(panel => {
      const hasCritical = panel.querySelector('[data-severity="5"]');
      if (hasCritical) {
        panel.classList.add('has-critical');
      } else {
        panel.classList.remove('has-critical');
      }
    });
    
    // Update OSINT status strip
    const eventsMinEl = document.getElementById('sitmon-status-events-min');
    if (eventsMinEl && this.lastIngestTime) {
      // Calculate events per minute (simplified - could track over time window)
      const timeSinceLastIngest = (Date.now() - this.lastIngestTime.getTime()) / 1000 / 60;
      const eventsPerMin = timeSinceLastIngest > 0 ? Math.round(total / timeSinceLastIngest) : 0;
      eventsMinEl.textContent = eventsPerMin;
    }
    
    // Update ticker with latest critical events
    this.updateOsintTicker(events);
  }
  
  updateOsintTicker(events) {
    const tickerContent = document.getElementById('sitmon-ticker-content');
    if (!tickerContent) return;
    
    // Get latest 8-10 events (mix of critical/high and recent)
    const criticalEvents = events
      .filter(e => e.severity >= 4)
      .sort((a, b) => b.severity - a.severity || new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, 5);
    
    const recentEvents = events
      .filter(e => e.severity < 4)
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, 5);
    
    // Combine and deduplicate
    const allEvents = [...criticalEvents, ...recentEvents]
      .filter((event, index, self) => index === self.findIndex(e => e.id === event.id))
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, 8);
    
    if (allEvents.length === 0) {
      tickerContent.innerHTML = '<div class="sitmon-ticker-line">LIVE: Monitoring global intelligence feeds...</div>';
      return;
    }
    
    // Create horizontal lines for each event
    const tickerLines = allEvents.map(event => {
      const age = event.getAgeHours ? event.getAgeHours() : 0;
      const ageText = age < 1 ? `${Math.floor(age * 60)}m` : 
                      age < 24 ? `${Math.floor(age)}h` : 
                      `${Math.floor(age / 24)}d`;
      
      const severityColor = event.severity >= 5 ? '#ff6b6b' : 
                            event.severity >= 4 ? '#ffaa00' : 
                            event.severity >= 3 ? '#ffd93d' : 
                            '#22d3ee';
      
      const category = event.category || event.kind || event.type || 'UPDATE';
      const time = new Date(event.publishedAt || event.timestamp).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
      
      return `
        <div class="sitmon-ticker-line" data-severity="${event.severity || 1}">
          <span class="sitmon-ticker-time">${time}</span>
          <span class="sitmon-ticker-category">[${category.toUpperCase()}]</span>
          <span class="sitmon-ticker-severity" style="color: ${severityColor}">[${event.severity || 1}/5]</span>
          <span class="sitmon-ticker-title">${this.escapeHtml(event.title || event.headline || 'Update')}</span>
          <span class="sitmon-ticker-age">${ageText} ago</span>
        </div>
      `;
    }).join('');
    
    tickerContent.innerHTML = tickerLines;
  }
  
  updateLiveFeed(events) {
    const feedEl = document.getElementById('sitmon-hud-feed');
    const countEl = document.getElementById('sitmon-feed-count');
    
    if (!feedEl) return;
    
    // Sort by recency and severity
    const sorted = [...events].sort((a, b) => {
      if (b.severity !== a.severity) {
        return b.severity - a.severity;
      }
      return new Date(b.publishedAt) - new Date(a.publishedAt);
    }).slice(0, 20); // Top 20
    
    if (countEl) countEl.textContent = events.length;
    
    if (sorted.length === 0) {
      feedEl.innerHTML = '<div class="sitmon-feed-empty">No events yet</div>';
      return;
    }
    
    feedEl.innerHTML = sorted.map(event => {
      const age = event.getAgeHours ? event.getAgeHours() : 0;
      const ageText = age < 1 ? `${Math.floor(age * 60)}m` : 
                      age < 24 ? `${Math.floor(age)}h` : 
                      `${Math.floor(age / 24)}d`;
      const severityColor = event.severity >= 5 ? '#ff6b6b' : 
                           event.severity >= 4 ? '#ffaa00' : 
                           event.severity >= 3 ? '#4ade80' : '#22d3ee';
      const isCritical = event.severity >= 5;
      
      return `
        <div class="sitmon-feed-item ${isCritical ? 'critical' : ''}" data-event-id="${event.id}">
          <div class="sitmon-feed-item-title">
            <span class="sitmon-feed-item-severity" style="background: ${severityColor}"></span>
            <span style="${isCritical ? 'font-weight: 600;' : ''}">${this.escapeHtml(event.title)}</span>
          </div>
          <div class="sitmon-feed-item-meta">
            <span style="font-family: 'SF Mono', 'Monaco', 'Consolas', monospace; font-size: 0.7rem;">${this.escapeHtml(event.source)}</span>
            <span style="font-family: 'SF Mono', 'Monaco', 'Consolas', monospace; font-size: 0.7rem; color: rgba(255,255,255,0.5);">${ageText}</span>
          </div>
        </div>
      `;
    }).join('');
    
    if (countEl) {
      const oldCount = parseInt(countEl.textContent) || 0;
      countEl.textContent = events.length;
      if (events.length > oldCount) {
        countEl.style.animation = 'statPulse 0.6s ease-out';
        setTimeout(() => countEl.style.animation = '', 600);
      }
    }
    
    // Add click handlers
    feedEl.querySelectorAll('.sitmon-feed-item').forEach(item => {
      item.addEventListener('click', () => {
        const eventId = item.getAttribute('data-event-id');
        const event = this.eventStore.getEvent(eventId);
        if (event) {
          this.pinEvent(event);
        }
      });
    });
  }
  
  pinEvent(event) {
    this.pinnedEventId = event.id;
    const pinnedEl = document.getElementById('sitmon-pinned-event');
    const contentEl = document.getElementById('sitmon-pinned-content');
    
    if (!pinnedEl || !contentEl) return;
    
    const age = event.getAgeHours ? event.getAgeHours() : 0;
    const ageText = age < 1 ? `${Math.floor(age * 60)}m ago` : 
                    age < 24 ? `${Math.floor(age)}h ago` : 
                    `${Math.floor(age / 24)}d ago`;
    
    contentEl.innerHTML = `
      <div class="sitmon-pinned-title">${this.escapeHtml(event.title)}</div>
      <div class="sitmon-pinned-meta">
        ${this.escapeHtml(event.source)} • ${ageText} • Severity ${event.severity}/5
      </div>
      ${event.location ? `
        <div class="sitmon-pinned-location">
          📍 ${this.escapeHtml(event.location.label || 'Unknown location')}
        </div>
      ` : ''}
      ${event.summary ? `
        <div class="sitmon-pinned-summary">${this.escapeHtml(event.summary)}</div>
      ` : ''}
      <div class="sitmon-pinned-actions">
        ${event.url ? `<a href="${this.escapeHtml(event.url)}" target="_blank" class="sitmon-pinned-btn">Open Source</a>` : ''}
        <button class="sitmon-pinned-btn" onclick="navigator.clipboard.writeText('${this.escapeHtml(event.url || '')}')">Copy Link</button>
      </div>
    `;
    
    pinnedEl.style.display = 'block';
  }
  
  unpinEvent() {
    this.pinnedEventId = null;
    const pinnedEl = document.getElementById('sitmon-pinned-event');
    if (pinnedEl) {
      pinnedEl.style.display = 'none';
    }
  }
  
  startLiveUpdates() {
    this.stopLiveUpdates(); // Clear any existing interval
    
    // Initial load
    this.fetchAndUpdateEvents();
    
    // Set up polling every 15 seconds
    this.updateInterval = setInterval(() => {
      if (this.autoRefresh) {
        this.fetchAndUpdateEvents();
      }
    }, 15000);
  }
  
  stopLiveUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
  
  async fetchAndUpdateEvents() {
    try {
      // Fetch from all sources and normalize
      const events = [];
      
      // Fetch earthquakes
      if (this.panels.earthquakes && typeof this.panels.earthquakes.getEarthquakes === 'function') {
        try {
          const eqs = this.panels.earthquakes.getEarthquakes() || [];
          for (const eq of eqs) {
            events.push(normalizeEarthquake(eq));
          }
        } catch (e) {
          console.warn('[SituationMonitorShell] Error fetching earthquakes:', e);
        }
      }
      
      // Fetch weather alerts
      if (this.panels.weather && this.panels.weather.alerts) {
        try {
          const alerts = this.panels.weather.alerts || [];
          for (const alert of alerts) {
            events.push(normalizeWeatherAlert(alert));
          }
        } catch (e) {
          console.warn('[SituationMonitorShell] Error fetching weather alerts:', e);
        }
      }
      
      // Fetch news headlines and process through pipeline
      if (this.panels.news && typeof this.panels.news.getHeadlines === 'function') {
        try {
          const headlines = this.panels.news.getHeadlines() || [];
          const processed = await this.eventPipeline.processHeadlines(headlines);
          for (const event of processed) {
            events.push(event);
          }
        } catch (e) {
          console.warn('[SituationMonitorShell] Error processing news:', e);
        }
      }
      
      // Add all events to store
      this.eventStore.addEvents(events);
      
      // Update last ingest time
      this.lastIngestTime = new Date();
      const ingestEl = document.getElementById('sitmon-status-last-ingest');
      if (ingestEl) {
        ingestEl.textContent = '0s';
        // Update every second
        if (this.ingestTimer) clearInterval(this.ingestTimer);
        this.ingestTimer = setInterval(() => {
          if (this.lastIngestTime && ingestEl) {
            const seconds = Math.floor((Date.now() - this.lastIngestTime.getTime()) / 1000);
            ingestEl.textContent = `${seconds}s`;
          }
        }, 1000);
      }
      
      // Update status
      const sourcesEl = document.getElementById('sitmon-status-sources');
      if (sourcesEl) {
        sourcesEl.textContent = 'ONLINE';
        sourcesEl.className = 'sitmon-osint-status-value sitmon-telemetry online';
      }
      
    } catch (error) {
      console.error('[SituationMonitorShell] Error fetching events:', error);
      const sourcesEl = document.getElementById('sitmon-status-sources');
      if (sourcesEl) {
        sourcesEl.textContent = 'OFFLINE';
        sourcesEl.className = 'sitmon-osint-status-value sitmon-telemetry offline';
      }
    }
  }
  
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
      container.style.cssText = 'position: fixed; top: 100px; right: 20px; z-index: 10000 !important; display: flex; flex-direction: column; gap: 0.75rem; pointer-events: none; max-width: calc(100vw - 40px);';
      document.body.appendChild(container);
    }
    this.toastContainer = container;
  }
  
  showToast(message, type = 'info', title = null) {
    // Ensure toast system is initialized
    if (!this.toastContainer) {
      this.initToastSystem();
    }
    if (!this.toastContainer) {
      console.warn('[SituationMonitorShell] Toast container not available');
      return;
    }
    
    const toast = document.createElement('div');
    toast.className = `sitmon-toast ${type}`;
    toast.style.cssText = 'display: flex !important; flex-direction: row !important; position: relative !important; z-index: 10001 !important; color: #fff !important; writing-mode: horizontal-tb !important; text-orientation: mixed !important; transform: none !important;';
    
    // Icon based on type
    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    } else {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    }
    
    // Escape HTML in message to prevent injection, but allow line breaks
    const safeMessage = String(message).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeTitle = title ? String(title).replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
    
    toast.innerHTML = `
      <div class="sitmon-toast-icon" style="color: ${type === 'success' ? '#4ecdc4' : type === 'error' ? '#ff6b6b' : '#4A90E2'}">${iconSvg}</div>
      <div class="sitmon-toast-content">
        ${safeTitle ? `<div class="sitmon-toast-title">${safeTitle}</div>` : ''}
        <div class="sitmon-toast-message">${safeMessage}</div>
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
    // BigBoardOverlay removed - stats are now displayed in the left HUD panel
    // This overlay was covering too much space and is better integrated into the HUD
    return;
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
      // Refresh data panels (only if they exist)
      const refreshPromises = [];
      
      if (this.panels.news && typeof this.panels.news.loadNews === 'function') {
        refreshPromises.push(this.panels.news.loadNews().catch(err => {
          console.warn('[SituationMonitorShell] Error refreshing news:', err);
        }));
      }
      
      if (this.panels.markets && typeof this.panels.markets.loadMarkets === 'function') {
        refreshPromises.push(this.panels.markets.loadMarkets().catch(err => {
          console.warn('[SituationMonitorShell] Error refreshing markets:', err);
        }));
      }
      
      if (this.panels.earthquakes && typeof this.panels.earthquakes.loadEarthquakes === 'function') {
        refreshPromises.push(this.panels.earthquakes.loadEarthquakes().catch(err => {
          console.warn('[SituationMonitorShell] Error refreshing earthquakes:', err);
        }));
      }
      
      if (this.panels.weather && typeof this.panels.weather.loadAlerts === 'function') {
        refreshPromises.push(this.panels.weather.loadAlerts().catch(err => {
          console.warn('[SituationMonitorShell] Error refreshing weather:', err);
        }));
      }
      
      await Promise.all(refreshPromises);

      // Update analysis panels with news data
      const headlines = this.panels.news && typeof this.panels.news.getHeadlines === 'function' 
        ? this.panels.news.getHeadlines() 
        : [];
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
          // BigBoardOverlay removed - stats are now in left HUD
          // if (this.bigBoardOverlay) {
          //   this.bigBoardOverlay.update(this.mapEvents);
          // }
          
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
    
    // Clear ingest timer to prevent memory leak
    if (this.ingestTimer) {
      clearInterval(this.ingestTimer);
      this.ingestTimer = null;
    }

    if (this.mapView) {
      this.mapView.destroy();
    }
    
    // BigBoardOverlay removed
    // if (this.bigBoardOverlay) {
    //   this.bigBoardOverlay.destroy();
    // }
    
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
