/**
 * Multiplayer Game Manager
 * Manages multiplayer game rooms, synchronization, and UI
 * Mission: Signal over noise, credibility at speed
 */

import MultiplayerGameClient from '../utils/multiplayer-game.js';

// Logger fallback
const logger = {
  error: (...args) => console.error('[MultiplayerGameManager]', ...args),
  warn: (...args) => console.warn('[MultiplayerGameManager]', ...args),
  log: (...args) => console.log('[MultiplayerGameManager]', ...args),
  debug: (...args) => console.debug('[MultiplayerGameManager]', ...args)
};

class MultiplayerGameManager {
  constructor(container, userId, userName) {
    this.container = container;
    this.userId = userId;
    this.userName = userName;
    this.roomId = null;
    this.room = null;
    this.client = null;
    this.gameState = 'idle'; // idle, waiting, starting, playing, finished
    this.players = [];
    this.currentQuestion = null;
    this.questionStartTime = null;
    this.myAnswer = null;
    this.results = null;
    
    this.setupEventListeners();
    // Render initial UI (lobby)
    this.render();
  }

  /**
   * Create a new game room
   */
  async createRoom(settings = {}) {
    try {
      const response = await fetch('/.netlify/functions/game-room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create',
          userId: this.userId,
          userName: this.userName,
          settings
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create room');
      }

      const data = await response.json();
      this.roomId = data.roomId;
      this.room = data.room;
      this.players = data.room.players || [];
      
      // Connect WebSocket (optional - will work without it using polling)
      try {
        this.connectWebSocket();
      } catch (wsError) {
        logger.warn('[MultiplayerGameManager] WebSocket connection failed, will use polling:', wsError);
        // Start polling for updates if WebSocket fails
        this.startPolling();
      }
      
      this.emit('room-created', { roomId: this.roomId, room: this.room });
      this.render();
      
      return { roomId: this.roomId, room: this.room };
    } catch (error) {
      logger.error('[MultiplayerGameManager] Error creating room:', error);
      this.emit('error', { error: error.message });
      throw error;
    }
  }

  /**
   * Join an existing game room
   */
  async joinRoom(roomId) {
    try {
      const response = await fetch('/.netlify/functions/game-room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'join',
          roomId,
          userId: this.userId,
          userName: this.userName
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to join room');
      }

      const data = await response.json();
      this.roomId = roomId;
      this.room = data.room;
      this.players = data.room.players || [];
      
      // Connect WebSocket (optional - will work without it using polling)
      try {
        this.connectWebSocket();
      } catch (wsError) {
        logger.warn('[MultiplayerGameManager] WebSocket connection failed, will use polling:', wsError);
        // Start polling for updates if WebSocket fails
        this.startPolling();
      }
      
      this.emit('room-joined', { roomId, room: this.room });
      this.render();
      
      return { room: this.room };
    } catch (error) {
      logger.error('[MultiplayerGameManager] Error joining room:', error);
      this.emit('error', { error: error.message });
      throw error;
    }
  }

  /**
   * Leave the current room
   */
  async leaveRoom() {
    if (!this.roomId) return;

    try {
      await fetch('/.netlify/functions/game-room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'leave',
          roomId: this.roomId,
          userId: this.userId
        }),
      });

      if (this.client) {
        this.client.disconnect();
        this.client = null;
      }

      this.roomId = null;
      this.room = null;
      this.players = [];
      this.gameState = 'idle';
      
      this.emit('room-left');
      this.render();
    } catch (error) {
      logger.error('[MultiplayerGameManager] Error leaving room:', error);
    }
  }

  /**
   * Start the game (host only)
   */
  async startGame() {
    if (!this.roomId || !this.isHost()) {
      throw new Error('Only the host can start the game');
    }

    try {
      const response = await fetch('/.netlify/functions/game-room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'start',
          roomId: this.roomId,
          userId: this.userId
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start game');
      }

      const data = await response.json();
      this.room = data.room;
      this.gameState = 'starting';
      
      this.emit('game-starting', { room: this.room });
      this.render();
    } catch (error) {
      logger.error('[MultiplayerGameManager] Error starting game:', error);
      this.emit('error', { error: error.message });
      throw error;
    }
  }

  /**
   * Connect WebSocket for real-time updates
   */
  connectWebSocket() {
    if (this.client) {
      this.client.disconnect();
    }

    try {
      this.client = new MultiplayerGameClient(this.roomId, this.userId, this.userName);
      
      // Set up event listeners
      this.client.on('connected', () => {
        this.client.joinRoom();
      });

      this.client.on('room-update', (data) => {
        this.room = data.room;
        this.players = data.room.players || [];
        this.render();
        this.emit('room-updated', data);
      });

      this.client.on('game-started', (data) => {
        this.room = data.room;
        this.gameState = 'playing';
        this.emit('game-started', data);
        this.render();
      });

      this.client.on('question', (data) => {
        // Handle both data formats: { question } or { payload: { question } }
        this.currentQuestion = data.payload?.question || data.question;
        // Ensure question has an ID
        if (this.currentQuestion && !this.currentQuestion.id) {
          const questionIndex = data.payload?.questionIndex || data.questionIndex || 0;
          this.currentQuestion.id = `q_${questionIndex}`;
        }
        this.questionStartTime = Date.now();
        this.myAnswer = null;
        this.results = null;
        this.emit('question-received', data);
        this.render();
      });

      this.client.on('results', (data) => {
        this.results = data;
        this.emit('results-received', data);
        this.render();
      });

      this.client.on('game-ended', (data) => {
        this.gameState = 'finished';
        this.emit('game-ended', data);
        this.render();
      });

      this.client.on('players-updated', (data) => {
        this.players = data.players || [];
        this.render();
      });

      this.client.on('error', (error) => {
        logger.warn('[MultiplayerGameManager] WebSocket error, falling back to polling:', error);
        // Fallback to polling if WebSocket fails
        if (!this.pollingInterval) {
          this.startPolling();
        }
        this.emit('error', error);
      });

      this.client.connect();
      
      // If WebSocket URL is not configured, it will emit an error and we'll use polling
      if (!this.client.wsUrl) {
        logger.warn('[MultiplayerGameManager] WebSocket URL not configured, using polling fallback');
        this.startPolling();
      }
    } catch (error) {
      logger.error('[MultiplayerGameManager] Failed to initialize WebSocket client:', error);
      this.startPolling();
    }
  }
  
  /**
   * Start polling for room updates (fallback when WebSocket is unavailable)
   */
  startPolling() {
    if (this.pollingInterval) {
      return; // Already polling
    }
    
    logger.log('[MultiplayerGameManager] Starting polling for room updates');
    this.pollingInterval = setInterval(async () => {
      if (!this.roomId) {
        this.stopPolling();
        return;
      }
      
      try {
        const response = await fetch('/.netlify/functions/game-room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'get-state',
            roomId: this.roomId
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.room) {
            // Update room state
            const oldStatus = this.room?.status;
            this.room = data.room;
            this.players = data.room.players || [];
            
            // Handle status changes
            if (oldStatus !== this.room.status) {
              if (this.room.status === 'playing' && this.gameState !== 'playing') {
                this.gameState = 'playing';
                this.emit('game-started', { room: this.room });
              } else if (this.room.status === 'finished' && this.gameState !== 'finished') {
                this.gameState = 'finished';
                this.emit('game-ended', { room: this.room });
              }
            }
            
            this.render();
          }
        }
      } catch (error) {
        logger.error('[MultiplayerGameManager] Polling error:', error);
      }
    }, 2000); // Poll every 2 seconds
  }
  
  /**
   * Stop polling
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Submit answer
   */
  submitAnswer(answer) {
    if (!this.currentQuestion || this.myAnswer !== null) {
      return; // Already answered or no question
    }

    const timeSpent = this.questionStartTime ? (Date.now() - this.questionStartTime) / 1000 : 0;
    this.myAnswer = answer;

    if (this.client && this.client.isConnected) {
      // Use question ID if available, otherwise use index or generate one
      const questionId = this.currentQuestion.id || 
                        `q_${this.room.questionIndex || 0}_${Date.now()}`;
      this.client.submitAnswer(questionId, answer, timeSpent);
    } else {
      // Fallback: submit answer via API if WebSocket not available
      this.submitAnswerViaAPI(answer, timeSpent);
    }

    this.render();
  }

  /**
   * Request next question (when ready)
   */
  requestNextQuestion() {
    if (this.client && this.client.isConnected) {
      this.client.requestNextQuestion();
    }
    // If using polling, the next question will come automatically
  }
  
  /**
   * Submit answer via API (fallback when WebSocket unavailable)
   */
  async submitAnswerViaAPI(answer, timeSpent) {
    if (!this.roomId || !this.currentQuestion) return;
    
    try {
      const questionId = this.currentQuestion.id || `q_${this.room.questionIndex || 0}`;
      const response = await fetch('/.netlify/functions/game-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit-answer',
          roomId: this.roomId,
          userId: this.userId,
          questionId: questionId,
          answer: answer,
          timeSpent: timeSpent
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.results) {
          this.results = data.results;
          this.render();
        }
      }
    } catch (error) {
      logger.error('[MultiplayerGameManager] Error submitting answer via API:', error);
    }
  }

  /**
   * Check if user is host
   */
  isHost() {
    return this.room && this.room.hostId === this.userId;
  }

  /**
   * Get current player
   */
  getCurrentPlayer() {
    return this.players.find(p => p.userId === this.userId);
  }

  /**
   * Render UI
   */
  render() {
    if (!this.container) return;

    if (!this.roomId) {
      this.renderLobby();
    } else if (this.gameState === 'waiting' || this.gameState === 'idle') {
      this.renderWaitingRoom();
    } else if (this.gameState === 'starting') {
      this.renderStarting();
    } else if (this.gameState === 'playing') {
      this.renderGame();
    } else if (this.gameState === 'finished') {
      this.renderFinished();
    }
  }

  /**
   * Render lobby (create/join room)
   */
  renderLobby() {
    this.container.innerHTML = `
      <div class="multiplayer-lobby">
        <div class="lobby-header">
          <h3>Multiplayer Game</h3>
          <p class="lobby-subtitle">Play synchronized fact-checking with others</p>
        </div>
        <div class="lobby-actions">
          <button class="btn btn-primary" id="createRoomBtn">
            Create Room
          </button>
          <div class="lobby-divider">
            <span>or</span>
          </div>
          <div class="join-room-form">
            <input 
              type="text" 
              id="roomIdInput" 
              class="room-id-input" 
              placeholder="Enter room code"
              maxlength="20"
            />
            <button class="btn btn-secondary" id="joinRoomBtn">
              Join Room
            </button>
          </div>
        </div>
      </div>
    `;

    // Bind events
    const createBtn = document.getElementById('createRoomBtn');
    const joinBtn = document.getElementById('joinRoomBtn');
    const roomIdInput = document.getElementById('roomIdInput');

    if (createBtn) {
      createBtn.addEventListener('click', () => {
        this.createRoom({
          difficulty: 'medium',
          questionCount: 10,
          timePerQuestion: 20
        });
      });
    }

    if (joinBtn && roomIdInput) {
      joinBtn.addEventListener('click', () => {
        const roomId = roomIdInput.value.trim();
        if (roomId) {
          this.joinRoom(roomId);
        }
      });

      roomIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const roomId = roomIdInput.value.trim();
          if (roomId) {
            this.joinRoom(roomId);
          }
        }
      });
    }
  }

  /**
   * Render waiting room
   */
  renderWaitingRoom() {
    const isHost = this.isHost();
    const canStart = isHost && this.players.length >= 2;

    this.container.innerHTML = `
      <div class="multiplayer-waiting-room">
        <div class="waiting-header">
          <h3>Room: ${this.roomId.substring(0, 8)}</h3>
          <button class="btn btn-secondary btn-small" id="leaveRoomBtn">Leave</button>
        </div>
        
        <div class="room-settings">
          <div class="setting-item">
            <span class="setting-label">Difficulty:</span>
            <span class="setting-value">${this.room.settings.difficulty}</span>
          </div>
          <div class="setting-item">
            <span class="setting-label">Questions:</span>
            <span class="setting-value">${this.room.settings.questionCount}</span>
          </div>
          <div class="setting-item">
            <span class="setting-label">Time per question:</span>
            <span class="setting-value">${this.room.settings.timePerQuestion}s</span>
          </div>
        </div>

        <div class="players-list">
          <h4>Players (${this.players.length}/${8})</h4>
          <div class="players-grid">
            ${this.players.map((player, index) => `
              <div class="player-item ${player.userId === this.userId ? 'current-player' : ''}">
                <span class="player-name">${this.escapeHtml(player.userName)}</span>
                ${player.userId === this.room.hostId ? '<span class="host-badge">Host</span>' : ''}
              </div>
            `).join('')}
          </div>
        </div>

        ${isHost ? `
          <div class="waiting-actions">
            <button 
              class="btn btn-primary" 
              id="startGameBtn"
              ${!canStart ? 'disabled' : ''}
            >
              Start Game
            </button>
            ${!canStart ? '<p class="waiting-hint">Need at least 2 players to start</p>' : ''}
          </div>
        ` : `
          <div class="waiting-message">
            <p>Waiting for host to start the game...</p>
          </div>
        `}
      </div>
    `;

    // Bind events
    const leaveBtn = document.getElementById('leaveRoomBtn');
    const startBtn = document.getElementById('startGameBtn');

    if (leaveBtn) {
      leaveBtn.addEventListener('click', () => {
        this.leaveRoom();
      });
    }

    if (startBtn && canStart) {
      startBtn.addEventListener('click', () => {
        this.startGame();
      });
    }
  }

  /**
   * Render starting state
   */
  renderStarting() {
    this.container.innerHTML = `
      <div class="multiplayer-starting">
        <h3>Game Starting...</h3>
        <p>Get ready!</p>
      </div>
    `;
  }

  /**
   * Render game state
   */
  renderGame() {
    if (!this.currentQuestion) {
      return this.renderWaitingForQuestion();
    }

    const timeLeft = this.room.settings.timePerQuestion - 
      (this.questionStartTime ? Math.floor((Date.now() - this.questionStartTime) / 1000) : 0);

    this.container.innerHTML = `
      <div class="multiplayer-game">
        <div class="game-header">
          <div class="game-info">
            <span>Question ${this.room.questionIndex + 1} / ${this.room.settings.questionCount}</span>
            <span class="time-left">${Math.max(0, timeLeft)}s</span>
          </div>
          <div class="players-status">
            ${this.players.map(p => `
              <div class="player-status ${p.userId === this.userId ? 'current' : ''}">
                <span class="player-name">${this.escapeHtml(p.userName)}</span>
                <span class="player-score">${this.room.scores[p.userId]?.score || 0}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="question-card">
          <div class="question-header">
            <span class="source">${this.escapeHtml(this.currentQuestion.source)}</span>
          </div>
          <h2 class="question-headline">${this.escapeHtml(this.currentQuestion.headline)}</h2>
        </div>

        <div class="answer-buttons">
          <button 
            class="btn btn-fact ${this.myAnswer === true ? 'selected' : ''}" 
            id="factBtn"
            ${this.myAnswer !== null ? 'disabled' : ''}
          >
            Factual
          </button>
          <button 
            class="btn btn-fake ${this.myAnswer === false ? 'selected' : ''}" 
            id="fakeBtn"
            ${this.myAnswer !== null ? 'disabled' : ''}
          >
            Misleading
          </button>
        </div>

        ${this.myAnswer !== null ? `
          <div class="answer-submitted">
            <p>Answer submitted. Waiting for other players...</p>
          </div>
        ` : ''}
      </div>
    `;

    // Bind answer buttons
    const factBtn = document.getElementById('factBtn');
    const fakeBtn = document.getElementById('fakeBtn');

    if (factBtn) {
      factBtn.addEventListener('click', () => {
        this.submitAnswer(true);
      });
    }

    if (fakeBtn) {
      fakeBtn.addEventListener('click', () => {
        this.submitAnswer(false);
      });
    }
  }

  /**
   * Render waiting for question
   */
  renderWaitingForQuestion() {
    this.container.innerHTML = `
      <div class="multiplayer-waiting-question">
        <h3>Waiting for next question...</h3>
      </div>
    `;
  }

  /**
   * Render finished state
   */
  renderFinished() {
    const sortedScores = Object.entries(this.room.scores || {})
      .map(([userId, score]) => ({
        userId,
        ...score,
        userName: this.players.find(p => p.userId === userId)?.userName || 'Unknown'
      }))
      .sort((a, b) => b.score - a.score);

    this.container.innerHTML = `
      <div class="multiplayer-finished">
        <h3>Game Complete</h3>
        <div class="final-scores">
          <h4>Final Scores</h4>
          ${sortedScores.map((player, index) => `
            <div class="score-item ${player.userId === this.userId ? 'current-player' : ''}">
              <span class="rank">${index + 1}</span>
              <span class="name">${this.escapeHtml(player.userName)}</span>
              <span class="score">${player.score}</span>
            </div>
          `).join('')}
        </div>
        <button class="btn btn-primary" id="playAgainBtn">Play Again</button>
      </div>
    `;

    const playAgainBtn = document.getElementById('playAgainBtn');
    if (playAgainBtn) {
      playAgainBtn.addEventListener('click', () => {
        this.leaveRoom();
        this.render();
      });
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(cb => {
      try {
        cb(data);
      } catch (error) {
        logger.error(`[MultiplayerGameManager] Error in event listener:`, error);
      }
    });
  }

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
    this.stopPolling();
    if (this.client) {
      this.client.disconnect();
    }
    this.leaveRoom();
  }
}

export default MultiplayerGameManager;

// Make it globally available for non-module scripts
if (typeof window !== 'undefined') {
  window.MultiplayerGameManager = MultiplayerGameManager;
}

