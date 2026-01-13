/**
 * Live Cams State Management
 */

export class LiveCamsState {
  constructor() {
    this.filters = {
      q: '',
      country: 'US',
      state: '',
      city: '',
      type: 'any',
      media: 'any',
      bbox: null
    };
    
    this.results = [];
    this.selectedCamera = null;
    this.watchlist = this.loadWatchlist();
    this.loading = false;
    this.error = null;
    this.mapBounds = null;
    
    // Listeners
    this.listeners = new Set();
  }
  
  /**
   * Subscribe to state changes
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  
  /**
   * Notify all listeners
   */
  notify() {
    this.listeners.forEach(cb => {
      try {
        cb(this);
      } catch (error) {
        console.error('[LiveCamsState] Listener error:', error);
      }
    });
  }
  
  /**
   * Update filters
   */
  setFilters(newFilters) {
    this.filters = { ...this.filters, ...newFilters };
    this.notify();
  }
  
  /**
   * Set search results
   */
  setResults(results) {
    this.results = results;
    this.notify();
  }
  
  /**
   * Select a camera
   */
  selectCamera(camera) {
    this.selectedCamera = camera;
    this.notify();
  }
  
  /**
   * Add camera to watchlist
   */
  addToWatchlist(camera) {
    if (!this.watchlist.find(c => c.id === camera.id)) {
      this.watchlist.push(camera);
      this.saveWatchlist();
      this.notify();
    }
  }
  
  /**
   * Remove camera from watchlist
   */
  removeFromWatchlist(cameraId) {
    this.watchlist = this.watchlist.filter(c => c.id !== cameraId);
    this.saveWatchlist();
    this.notify();
  }
  
  /**
   * Load watchlist from localStorage
   */
  loadWatchlist() {
    try {
      const stored = localStorage.getItem('liveCamsWatchlist');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('[LiveCamsState] Error loading watchlist:', error);
    }
    return [];
  }
  
  /**
   * Save watchlist to localStorage
   */
  saveWatchlist() {
    try {
      localStorage.setItem('liveCamsWatchlist', JSON.stringify(this.watchlist));
    } catch (error) {
      console.error('[LiveCamsState] Error saving watchlist:', error);
    }
  }
  
  /**
   * Set loading state
   */
  setLoading(loading) {
    this.loading = loading;
    this.notify();
  }
  
  /**
   * Set error
   */
  setError(error) {
    this.error = error;
    this.notify();
  }
  
  /**
   * Update map bounds
   */
  setMapBounds(bounds) {
    this.mapBounds = bounds;
    this.notify();
  }
}
