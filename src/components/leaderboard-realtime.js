/**
 * Real-Time Leaderboard Component
 * Enhanced leaderboard with live updates and presence indicators
 * Maintains newsroom aesthetic - clean, fast, credible
 */

import RealtimeLeaderboard from '../utils/realtime-leaderboard.js';

class RealtimeLeaderboardComponent {
  constructor(container, userId, gameType = 'fact-checker', options = {}) {
    this.container = container;
    this.userId = userId;
    this.gameType = gameType;
    this.options = {
      showPresence: true,
      showMetrics: true,
      limit: 10,
      ...options
    };
    
    this.currentLeaderboard = [];
    this.presence = new Map(); // userId → { status, lastSeen, gameId }
    this.realtime = null;
    this.isInitialized = false;
    
    // Initialize
    this.init();
  }

  /**
   * Initialize component
   */
  async init() {
    if (this.isInitialized) return;
    
    // Create real-time connection (gracefully degrades if WebSocket not available)
    this.realtime = new RealtimeLeaderboard(this.userId, this.gameType);
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Connect (will gracefully fail if WebSocket URL not configured)
    this.realtime.connect();
    
    // Wait a bit for connection, then subscribe
    setTimeout(() => {
      if (this.realtime.connected) {
        this.realtime.subscribeToLeaderboard('all');
      }
    }, 500);
    
    this.isInitialized = true;
  }

  /**
   * Set up real-time event listeners
   */
  setupEventListeners() {
    // Leaderboard updates
    this.realtime.on('leaderboard-update', (data) => {
      if (data.leaderboard) {
        this.currentLeaderboard = data.leaderboard;
        this.render();
      }
    });

    // Presence updates
    this.realtime.on('presence-update', (data) => {
      if (data.userId && data.status) {
        this.presence.set(data.userId, {
          status: data.status,
          lastSeen: data.lastSeen || Date.now(),
          gameId: data.gameId || null
        });
        this.updatePresenceIndicators();
      }
    });

    // Connection status
    this.realtime.on('connected', () => {
      console.log('[RealtimeLeaderboardComponent] Real-time connection established');
      this.updateConnectionStatus(true);
    });

    this.realtime.on('disconnected', () => {
      console.log('[RealtimeLeaderboardComponent] Real-time connection lost');
      this.updateConnectionStatus(false);
    });

    this.realtime.on('error', (error) => {
      console.error('[RealtimeLeaderboardComponent] Real-time error:', error);
    });
  }

  /**
   * Update leaderboard data (can be called from external source)
   */
  updateLeaderboard(scores) {
    this.currentLeaderboard = scores;
    this.render();
  }

  /**
   * Render leaderboard
   * Note: This enhances the existing leaderboard list, doesn't replace the entire structure
   */
  render() {
    if (!this.container) return;

    // If container already has content, just update the scores
    // Otherwise, create the real-time enhanced structure
    const existingContent = this.container.innerHTML.trim();
    
    if (existingContent && !existingContent.includes('leaderboard-realtime')) {
      // Container has existing leaderboard content, enhance it
      // Add presence indicators and real-time badge to existing structure
      this.enhanceExistingLeaderboard();
      return;
    }

    const activeUserCount = this.getActiveUserCount();
    const hasRealtime = this.realtime && this.realtime.connected;

    const html = `
      <div class="leaderboard-realtime">
        <div class="leaderboard-header">
          <h3>Top Scores</h3>
          <div class="leaderboard-meta">
            ${this.options.showPresence && hasRealtime ? `
              <div class="presence-indicator">
                <span class="presence-dot"></span>
                <span class="active-users">${activeUserCount} active</span>
              </div>
            ` : ''}
            ${hasRealtime ? `
              <span class="realtime-badge" title="Live updates enabled">
                <span class="realtime-dot"></span>
                <span>Live</span>
              </span>
            ` : ''}
          </div>
        </div>
        <div class="leaderboard-list" id="leaderboardListRealtime">
          ${this.renderScores()}
        </div>
      </div>
    `;
    
    this.container.innerHTML = html;
    
    // Update presence indicators after render
    this.updatePresenceIndicators();
  }
  
  /**
   * Enhance existing leaderboard with real-time features
   */
  enhanceExistingLeaderboard() {
    // Add presence indicators to existing items
    this.updatePresenceIndicators();
    
    // Add real-time badge if connected
    const header = this.container.closest('.leaderboard-modal')?.querySelector('.leaderboard-header');
    if (header && this.realtime && this.realtime.connected) {
      const existingBadge = header.querySelector('.realtime-badge');
      if (!existingBadge) {
        const badge = document.createElement('span');
        badge.className = 'realtime-badge connected';
        badge.innerHTML = '<span class="realtime-dot"></span><span>Live</span>';
        badge.title = 'Live updates enabled';
        header.appendChild(badge);
      }
    }
  }

  /**
   * Render scores list
   */
  renderScores() {
    if (!this.currentLeaderboard || this.currentLeaderboard.length === 0) {
      return `
        <div class="leaderboard-empty">
          <p>No scores yet</p>
        </div>
      `;
    }

    return this.currentLeaderboard
      .slice(0, this.options.limit)
      .map((entry, index) => {
        const isCurrentUser = entry.userId === this.userId;
        const isOnline = this.presence.has(entry.userId) && 
                        this.presence.get(entry.userId).status === 'online';
        
        return `
          <div class="leaderboard-item ${isCurrentUser ? 'current-user' : ''}" 
               data-user-id="${this.escapeHtml(entry.userId)}">
            <span class="rank">${index + 1}</span>
            <span class="name">
              ${this.escapeHtml(entry.userName || 'Anonymous')}
              ${isOnline && this.options.showPresence ? '<span class="presence-badge" title="Active now"></span>' : ''}
            </span>
            <span class="score">${entry.score.toLocaleString()}</span>
            ${this.options.showMetrics ? `
              <span class="metrics">
                ${entry.accuracy !== undefined ? `<span class="metric accuracy">${entry.accuracy}%</span>` : ''}
                ${entry.avgSpeed !== undefined ? `<span class="metric speed">${entry.avgSpeed}s</span>` : ''}
              </span>
            ` : ''}
          </div>
        `;
      })
      .join('');
  }

  /**
   * Get active user count
   */
  getActiveUserCount() {
    return Array.from(this.presence.values())
      .filter(p => p.status === 'online')
      .length;
  }

  /**
   * Update presence indicators
   */
  updatePresenceIndicators() {
    if (!this.container) return;
    
    const items = this.container.querySelectorAll('.leaderboard-item');
    items.forEach(item => {
      const userId = item.dataset.userId;
      if (userId) {
        const badge = item.querySelector('.presence-badge');
        const isOnline = this.presence.has(userId) && 
                        this.presence.get(userId).status === 'online';
        
        if (badge) {
          if (isOnline && this.options.showPresence) {
            badge.style.display = 'inline';
            badge.classList.add('active');
          } else {
            badge.style.display = 'none';
            badge.classList.remove('active');
          }
        }
      }
    });
  }

  /**
   * Update connection status indicator
   */
  updateConnectionStatus(isConnected) {
    if (!this.container) return;
    
    const badge = this.container.querySelector('.realtime-badge');
    if (badge) {
      if (isConnected) {
        badge.classList.add('connected');
        badge.textContent = '● Live';
      } else {
        badge.classList.remove('connected');
        badge.textContent = '○ Offline';
      }
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.realtime) {
      this.realtime.disconnect();
    }
    this.isInitialized = false;
  }
}

export default RealtimeLeaderboardComponent;

