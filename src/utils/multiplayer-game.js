/**
 * Multiplayer Game Client
 * Handles WebSocket connection and game state synchronization for multiplayer games
 * Mission: Signal over noise, credibility at speed
 */

class MultiplayerGameClient {
  constructor(roomId, userId, userName, wsUrl = null) {
    this.roomId = roomId;
    this.userId = userId;
    this.userName = userName;
    this.wsUrl = wsUrl || this.getWebSocketUrl();
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
    this.heartbeatInterval = null;
    this.gameState = null;
    this.players = [];
  }

  /**
   * Get WebSocket URL from environment or config
   */
  getWebSocketUrl() {
    if (window.NOTEWORTHY_CONFIG && window.NOTEWORTHY_CONFIG.websocketUrl) {
      return window.NOTEWORTHY_CONFIG.websocketUrl;
    }
    return null;
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    if (!this.wsUrl) {
      console.log('[MultiplayerGame] WebSocket URL not configured, multiplayer disabled');
      this.emit('error', { error: 'WebSocket not configured' });
      return;
    }

    try {
      console.log(`[MultiplayerGame] Connecting to ${this.wsUrl}...`);
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        console.log('[MultiplayerGame] Connected');
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
          console.error('[MultiplayerGame] Error parsing message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[MultiplayerGame] WebSocket error:', error);
        this.emit('error', { error: 'Connection error' });
      };

      this.ws.onclose = (event) => {
        console.log('[MultiplayerGame] Disconnected', event.code, event.reason);
        this.isConnected = false;
        this.stopHeartbeat();
        
        if (event.code !== 1000) {
          this.emit('disconnected');
          this.attemptReconnect();
        }
      };
    } catch (error) {
      console.error('[MultiplayerGame] Connection error:', error);
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
        roomId: this.roomId,
        userId: this.userId,
        userName: this.userName
      }
    });
  }

  /**
   * Join game room
   */
  joinRoom() {
    this.send({
      type: 'join-room',
      payload: {
        roomId: this.roomId,
        userId: this.userId,
        userName: this.userName
      }
    });
  }

  /**
   * Leave game room
   */
  leaveRoom() {
    this.send({
      type: 'leave-room',
      payload: {
        roomId: this.roomId,
        userId: this.userId
      }
    });
  }

  /**
   * Submit answer
   */
  submitAnswer(questionId, answer, timeSpent) {
    this.send({
      type: 'submit-answer',
      payload: {
        roomId: this.roomId,
        questionId,
        answer,
        timeSpent,
        timestamp: Date.now()
      }
    });
  }

  /**
   * Request next question (when all players ready)
   */
  requestNextQuestion() {
    this.send({
      type: 'request-next-question',
      payload: {
        roomId: this.roomId,
        userId: this.userId
      }
    });
  }

  /**
   * Handle incoming messages
   */
  handleMessage(message) {
    switch (message.type) {
      case 'room-update':
        this.gameState = message.payload.room;
        this.players = message.payload.room.players || [];
        this.emit('room-update', message.payload);
        break;

      case 'game-started':
        this.gameState = message.payload.room;
        this.emit('game-started', message.payload);
        break;

      case 'question-available':
        this.emit('question', message.payload);
        break;

      case 'question-results':
        this.emit('results', message.payload);
        break;

      case 'player-joined':
      case 'player-left':
        this.players = message.payload.players || [];
        this.emit('players-updated', message.payload);
        break;

      case 'game-ended':
        this.emit('game-ended', message.payload);
        break;

      case 'error':
        console.error('[MultiplayerGame] Server error:', message.payload);
        this.emit('error', message.payload);
        break;

      default:
        console.log('[MultiplayerGame] Unknown message type:', message.type);
    }
  }

  /**
   * Send message to server
   */
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[MultiplayerGame] Cannot send message, WebSocket not connected');
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

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(cb => {
      try {
        cb(data);
      } catch (error) {
        console.error(`[MultiplayerGame] Error in event listener for ${event}:`, error);
      }
    });
  }

  /**
   * Heartbeat
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'heartbeat' });
      }
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Reconnection
   */
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`[MultiplayerGame] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('[MultiplayerGame] Max reconnection attempts reached');
      this.emit('max-reconnect-attempts');
    }
  }

  /**
   * Disconnect gracefully
   */
  disconnect() {
    this.stopHeartbeat();
    this.leaveRoom();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.isConnected = false;
  }

  get connected() {
    return this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

export default MultiplayerGameClient;

