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
    
    // Don't await - let it run asynchronously
    this.init().catch(err => {
      console.error('[SituationMonitorShell] Init error:', err);
    });
  }

  async init() {
    // Show loader immediately
    showLoader({ phase: 'AUTH' });
    setLoaderProgress(0.05);
    
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`[SituationMonitorShell] Container #${this.containerId} not found`);
      hideLoader();
      return;
    }

    // Create layout - matches Noteworthy News container system
    container.innerHTML = `
      <div class="sitmon-page-wrapper">
        <!-- Page Header -->
        <div class="sitmon-page-header">
          <div class="sitmon-header-left">
            <h1 class="sitmon-page-title">Situation Monitor</h1>
            <p class="sitmon-page-subtitle">Global Intelligence Dashboard</p>
            <div class="sitmon-status-chip" id="sitmon-status-chip">Updated</div>
          </div>
          <div class="sitmon-header-right">
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
          </div>
        </div>

        <!-- Main Dashboard Grid -->
        <div class="sitmon-dashboard-grid">
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
        <div class="sitmon-secondary-grid">
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
        </div>
      </div>
    `;

    setLoaderPhase('DECRYPT');
    setLoaderProgress(0.15);
    
    // Initialize map
    await this.initMap();
    
    setLoaderPhase('SYNC');
    setLoaderProgress(0.35);

    // Initialize panels
    this.initPanels();
    
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
    
    // All systems ready - hide loader
    setLoaderPhase('READY');
    setLoaderProgress(1.0);
    
    // Small delay for "READY" phase to be visible
    setTimeout(() => {
      hideLoader();
    }, 500);
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

  initPanels() {
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
      this.panels.intel.update(headlines);
      this.panels.correlation.update(headlines);
      this.panels.narrative.update(headlines);
      this.panels.monitors.updateMatches(headlines);
      
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
    }
  }

  destroy() {
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
