/**
 * Real-Time Leaderboard Client
 * WebSocket-based real-time leaderboard updates with presence tracking
 * Mission: Signal over noise, credibility at speed
 */

class RealtimeLeaderboard {
  constructor(userId, gameType = 'fact-checker') {
    this.userId = userId;
    this.gameType = gameType;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
    this.isConnected = false;
    this.heartbeatInterval = null;
    this.presenceTimeout = null;
    
    // WebSocket URL - will be set via environment or fallback
    this.wsUrl = this.getWebSocketUrl();
  }

  /**
   * Get WebSocket URL from environment or use fallback
   * In production, this should be set via environment variable
   */
  getWebSocketUrl() {
    // Check for environment variable first
    if (typeof process !== 'undefined' && process.env && process.env.WEBSOCKET_URL) {
      return process.env.WEBSOCKET_URL;
    }
    
    // Check for global config
    if (window.NOTEWORTHY_CONFIG && window.NOTEWORTHY_CONFIG.websocketUrl) {
      return window.NOTEWORTHY_CONFIG.websocketUrl;
    }
    
    // Fallback: Use Netlify function proxy (we'll create this)
    // For now, return null to indicate WebSocket is optional
    return null;
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    // If no WebSocket URL is configured, gracefully degrade
    if (!this.wsUrl) {
      console.log('[RealtimeLeaderboard] WebSocket URL not configured, real-time updates disabled');
      return;
    }

    try {
      console.log(`[RealtimeLeaderboard] Connecting to ${this.wsUrl}...`);
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        console.log('[RealtimeLeaderboard] Connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.authenticate();
        this.startHeartbeat();
        this.emit('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('[RealtimeLeaderboard] Error parsing message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[RealtimeLeaderboard] WebSocket error:', error);
        this.emit('error', { error: 'Connection error' });
      };

      this.ws.onclose = (event) => {
        console.log('[RealtimeLeaderboard] Disconnected', event.code, event.reason);
        this.isConnected = false;
        this.stopHeartbeat();
        
        // Only attempt reconnect if it wasn't a clean close
        if (event.code !== 1000) {
          this.emit('disconnected');
          this.attemptReconnect();
        }
      };
    } catch (error) {
      console.error('[RealtimeLeaderboard] Connection error:', error);
      this.emit('error', { error: error.message });
    }
  }

  /**
   * Authenticate with server
   */
  authenticate() {
    this.send({
      type: 'authenticate',
      payload: {
        userId: this.userId,
        gameType: this.gameType
      }
    });
  }

  /**
   * Subscribe to leaderboard updates
   */
  subscribeToLeaderboard(timeframe = 'all') {
    this.send({
      type: 'join-leaderboard',
      payload: {
        gameType: this.gameType,
        timeframe
      }
    });
  }

  /**
   * Unsubscribe from leaderboard
   */
  unsubscribeFromLeaderboard() {
    this.send({
      type: 'leave-leaderboard',
      payload: {
        gameType: this.gameType
      }
    });
  }

  /**
   * Handle incoming messages
   */
  handleMessage(message) {
    switch (message.type) {
      case 'leaderboard-update':
        this.emit('leaderboard-update', message.payload);
        break;
        
      case 'presence-update':
        this.emit('presence-update', message.payload);
        break;
        
      case 'score-accepted':
        this.emit('score-accepted', message.payload);
        break;
        
      case 'pong':
        // Heartbeat response
        break;
        
      case 'error':
        console.error('[RealtimeLeaderboard] Server error:', message.payload);
        this.emit('error', message.payload);
        break;
        
      default:
        console.log('[RealtimeLeaderboard] Unknown message type:', message.type);
    }
  }

  /**
   * Send message to server
   */
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[RealtimeLeaderboard] Cannot send message, WebSocket not connected');
    }
  }

  /**
   * Event listener system
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   */
  emit(event, data) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(cb => {
      try {
        cb(data);
      } catch (error) {
        console.error(`[RealtimeLeaderboard] Error in event listener for ${event}:`, error);
      }
    });
  }

  /**
   * Start heartbeat to keep connection alive
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'heartbeat' });
      }
    }, 30000); // 30 seconds
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Attempt to reconnect
   */
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
      
      console.log(`[RealtimeLeaderboard] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('[RealtimeLeaderboard] Max reconnection attempts reached');
      this.emit('max-reconnect-attempts');
    }
  }

  /**
   * Disconnect gracefully
   */
  disconnect() {
    this.stopHeartbeat();
    this.unsubscribeFromLeaderboard();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.isConnected = false;
  }

  /**
   * Check if connected
   */
  get connected() {
    return this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

export default RealtimeLeaderboard;

