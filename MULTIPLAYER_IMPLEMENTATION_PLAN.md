# Real-Time Multiplayer & Collaborative Fact-Checking
## Technical Implementation Plan

**Mission:** Signal over noise, media literacy, credibility at speed  
**Approach:** Lean, scalable, production-ready, mission-aligned

---

## 🎯 Core Architecture Principles

### Design Philosophy
- **Newsroom-first UX:** Clean, fast, credible — not arcade aesthetics
- **Incremental delivery:** Each phase delivers visible value
- **Serverless-first:** Netlify Functions + edge computing where possible
- **State management:** Redis for real-time, PostgreSQL for persistence
- **Anti-cheat:** Authoritative server-side validation
- **Graceful degradation:** Works even with network issues

### Technology Stack

**Real-Time Layer:**
- WebSocket server (Node.js on Netlify Edge Functions or separate service)
- Redis for pub/sub and state management
- Connection pooling and heartbeat management

**Data Layer:**
- PostgreSQL (via Supabase, Neon, or Railway) for persistent data
- Redis for session state, leaderboards, presence
- Netlify Blobs for user data (keep existing)

**Backend Services:**
- Netlify Functions for game logic and validation
- WebSocket server for real-time sync
- Rate limiting and anti-cheat validation

**Frontend:**
- Native WebSocket API (no heavy libraries)
- State management with lightweight patterns
- Optimistic UI updates with server reconciliation

---

## 📋 Phase 1: Real-Time Leaderboards & Presence
**Timeline:** 2-3 weeks  
**Goal:** Foundation for multiplayer — live updates, presence indicators

### 1.1 Architecture Overview

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└───────┬──────┘
        │ WebSocket
        │
┌───────▼────────┐      ┌──────────┐
│ WebSocket      │◄────►│  Redis   │
│ Server         │      │ (Pub/Sub) │
│ (Edge/Netlify) │      └──────────┘
└───────┬────────┘
        │
┌───────▼────────┐
│ Netlify        │
│ Functions      │
│ (Game Logic)   │
└───────┬────────┘
        │
┌───────▼────────┐
│ PostgreSQL     │
│ (Persistent)   │
└────────────────┘
```

### 1.2 Implementation Details

#### WebSocket Server Setup

**Option A: Netlify Edge Functions (Recommended)**
- Use Deno Deploy or Cloudflare Workers for WebSocket support
- Leverages existing Netlify infrastructure
- Low latency, edge-distributed

**Option B: Separate Node.js Service**
- Railway, Render, or Fly.io
- More control, easier debugging
- Requires separate deployment

**Decision:** Start with Option A, migrate to B if needed.

#### Redis Setup

**Use Cases:**
1. **Pub/Sub:** Broadcast leaderboard updates
2. **Presence:** Track active users (`SETEX user:${userId} 60 "online"`)
3. **Leaderboard:** Sorted sets for rankings
4. **Rate Limiting:** Sliding window counters

**Structure:**
```javascript
// Presence tracking
presence:user:${userId} = { status: "online", lastSeen: timestamp, gameId: null }

// Leaderboard sorted sets
leaderboard:fact-checker:all = { userId: score, ... }
leaderboard:fact-checker:today = { userId: score, ... }
leaderboard:fact-checker:week = { userId: score, ... }

// Active games
game:${gameId}:players = Set of userIds
game:${gameId}:state = JSON game state
```

#### WebSocket Protocol

**Message Types:**
```typescript
// Client → Server
interface ClientMessage {
  type: 'join-leaderboard' | 'leave-leaderboard' | 'heartbeat' | 'submit-score';
  payload: {
    userId: string;
    gameId?: string;
    score?: number;
  };
}

// Server → Client
interface ServerMessage {
  type: 'leaderboard-update' | 'presence-update' | 'score-accepted' | 'error';
  payload: {
    leaderboard?: LeaderboardEntry[];
    presence?: PresenceData;
    error?: string;
  };
  timestamp: number;
}
```

#### Implementation: WebSocket Server

```javascript
// netlify/functions/websocket-server.js
// This runs on a separate service (Railway/Render) or Edge Function

import Redis from 'ioredis';
import { WebSocketServer } from 'ws';

const redis = new Redis(process.env.REDIS_URL);
const wss = new WebSocketServer({ port: 8080 });

// Connection management
const connections = new Map(); // userId → WebSocket

wss.on('connection', (ws, req) => {
  let userId = null;
  let heartbeatInterval = null;

  // Authenticate connection
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'authenticate':
          userId = await authenticateUser(message.token);
          if (!userId) {
            ws.close(1008, 'Unauthorized');
            return;
          }
          
          connections.set(userId, ws);
          await updatePresence(userId, 'online');
          await subscribeToLeaderboard(userId, ws);
          startHeartbeat(userId);
          break;
          
        case 'heartbeat':
          await updatePresence(userId, 'online');
          break;
          
        case 'submit-score':
          await handleScoreSubmission(userId, message.payload);
          break;
          
        case 'join-game':
          await handleJoinGame(userId, message.payload.gameId);
          break;
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        payload: { error: error.message }
      }));
    }
  });

  ws.on('close', async () => {
    if (userId) {
      connections.delete(userId);
      await updatePresence(userId, 'offline');
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    }
  });
});

// Presence management
async function updatePresence(userId, status) {
  await redis.setex(
    `presence:user:${userId}`,
    60, // 60 second TTL
    JSON.stringify({
      status,
      lastSeen: Date.now(),
      gameId: null
    })
  );
  
  // Broadcast presence update
  await redis.publish('presence-updates', JSON.stringify({
    userId,
    status,
    timestamp: Date.now()
  }));
}

// Leaderboard subscription
async function subscribeToLeaderboard(userId, ws) {
  const subscriber = redis.duplicate();
  await subscriber.subscribe('leaderboard-updates');
  
  subscriber.on('message', (channel, message) => {
    const update = JSON.parse(message);
    ws.send(JSON.stringify({
      type: 'leaderboard-update',
      payload: update,
      timestamp: Date.now()
    }));
  });
}

// Heartbeat to keep connections alive
function startHeartbeat(userId) {
  const interval = setInterval(() => {
    const ws = connections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    } else {
      clearInterval(interval);
    }
  }, 30000); // 30 seconds
}
```

#### Implementation: Client-Side Connection

```javascript
// src/utils/realtime-leaderboard.js

class RealtimeLeaderboard {
  constructor(userId, authToken) {
    this.userId = userId;
    this.authToken = authToken;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
  }

  connect() {
    const wsUrl = process.env.WEBSOCKET_URL || 'wss://ws.noteworthynews.co';
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.authenticate();
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onerror = (error) => {
      console.error('[RealtimeLeaderboard] WebSocket error:', error);
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.attemptReconnect();
    };
  };
  }

  authenticate() {
    this.send({
      type: 'authenticate',
      token: this.authToken
    });
  }

  subscribeToLeaderboard(timeframe = 'all') {
    this.send({
      type: 'join-leaderboard',
      payload: { timeframe }
    });
  }

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
      case 'error':
        console.error('[RealtimeLeaderboard] Error:', message.payload.error);
        break;
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(cb => cb(data));
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.send({ type: 'heartbeat' });
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`[RealtimeLeaderboard] Reconnecting (attempt ${this.reconnectAttempts})...`);
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
    }
  }
}

export default RealtimeLeaderboard;
```

#### Implementation: Leaderboard Component Integration

```javascript
// src/components/leaderboard-realtime.js

import RealtimeLeaderboard from '../utils/realtime-leaderboard.js';

class RealtimeLeaderboardComponent {
  constructor(container, userId, authToken) {
    this.container = container;
    this.realtime = new RealtimeLeaderboard(userId, authToken);
    this.currentLeaderboard = [];
    this.presence = new Map();
    
    this.setupEventListeners();
    this.render();
  }

  setupEventListeners() {
    this.realtime.on('leaderboard-update', (data) => {
      this.currentLeaderboard = data.leaderboard;
      this.render();
    });

    this.realtime.on('presence-update', (data) => {
      this.presence.set(data.userId, data);
      this.updatePresenceIndicators();
    });
  }

  render() {
    const html = `
      <div class="leaderboard-realtime">
        <div class="leaderboard-header">
          <h3>🏆 Top Scores</h3>
          <div class="presence-indicator">
            <span class="active-users">${this.getActiveUserCount()} active</span>
          </div>
        </div>
        <div class="leaderboard-list">
          ${this.currentLeaderboard.map((entry, index) => `
            <div class="leaderboard-item ${entry.userId === this.userId ? 'current-user' : ''}">
              <span class="rank">${index + 1}</span>
              <span class="name">${this.escapeHtml(entry.userName)}</span>
              ${this.presence.has(entry.userId) ? '<span class="presence-badge">●</span>' : ''}
              <span class="score">${entry.score.toLocaleString()}</span>
              <span class="metrics">
                <span class="accuracy">${entry.accuracy}%</span>
                <span class="speed">${entry.avgSpeed}s</span>
              </span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    this.container.innerHTML = html;
  }

  getActiveUserCount() {
    return Array.from(this.presence.values()).filter(p => p.status === 'online').length;
  }

  updatePresenceIndicators() {
    const badges = this.container.querySelectorAll('.presence-badge');
    badges.forEach(badge => {
      const item = badge.closest('.leaderboard-item');
      const userId = item.dataset.userId;
      if (this.presence.has(userId)) {
        badge.style.display = 'inline';
        badge.classList.add('active');
      } else {
        badge.style.display = 'none';
      }
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

export default RealtimeLeaderboardComponent;
```

### 1.3 Score Submission Flow

```javascript
// netlify/functions/submit-score-realtime.js

const { getStore } = require("@netlify/blobs");
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);

exports.handler = async (event) => {
  // CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: getCorsHeaders() };
  }

  try {
    const { userId, score, difficulty, level, streak, accuracy, avgSpeed } = JSON.parse(event.body);
    
    // Validate score (anti-cheat)
    if (!validateScore(score, difficulty, level, streak)) {
      return {
        statusCode: 400,
        headers: getCorsHeaders(),
        body: JSON.stringify({ error: 'Invalid score' })
      };
    }

    // Update PostgreSQL (persistent)
    await updateDatabaseScore(userId, {
      score, difficulty, level, streak, accuracy, avgSpeed
    });

    // Update Redis leaderboard (real-time)
    await updateRedisLeaderboard(userId, {
      score, difficulty, level, streak, accuracy, avgSpeed
    });

    // Broadcast update via Redis pub/sub
    await redis.publish('leaderboard-updates', JSON.stringify({
      type: 'score-updated',
      userId,
      score,
      timestamp: Date.now()
    }));

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({ error: error.message })
    };
  }
};

function validateScore(score, difficulty, level, streak) {
  // Anti-cheat: reasonable bounds
  const maxPossibleScore = (level * 100) + (streak * 50);
  return score <= maxPossibleScore * 1.1; // 10% tolerance
}
```

### 1.4 CSS Styling (Newsroom Aesthetic)

```css
/* src/styles/realtime-leaderboard.css */

.leaderboard-realtime {
  background: rgba(15, 15, 35, 0.6);
  border: 1px solid rgba(74, 144, 226, 0.2);
  border-radius: 8px;
  padding: 20px;
}

.leaderboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(74, 144, 226, 0.2);
}

.presence-indicator {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.6);
}

.active-users {
  color: #4A90E2;
}

.leaderboard-item {
  display: grid;
  grid-template-columns: 40px 1fr auto 100px 120px;
  gap: 12px;
  padding: 12px;
  margin-bottom: 8px;
  background: rgba(74, 144, 226, 0.05);
  border: 1px solid rgba(74, 144, 226, 0.1);
  border-radius: 6px;
  transition: all 0.2s ease;
}

.leaderboard-item:hover {
  background: rgba(74, 144, 226, 0.1);
  border-color: rgba(74, 144, 226, 0.3);
}

.leaderboard-item.current-user {
  background: rgba(74, 144, 226, 0.15);
  border-color: #4A90E2;
}

.presence-badge {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: #2ecc71;
  border-radius: 50%;
  margin-left: 8px;
  animation: pulse 2s ease-in-out infinite;
}

.presence-badge.active {
  background: #2ecc71;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.metrics {
  display: flex;
  gap: 12px;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.7);
}

.metrics .accuracy,
.metrics .speed {
  padding: 2px 8px;
  background: rgba(74, 144, 226, 0.1);
  border-radius: 4px;
}
```

---

## 📋 Phase 2: Multiplayer v1
**Timeline:** 3-4 weeks  
**Goal:** Synchronized multiplayer fact-checking games (2-8 players)

### 2.1 Game Room Architecture

```
Game Room Lifecycle:
1. Host creates room → Room ID generated
2. Players join → WebSocket connection to room
3. Game starts → Synchronized countdown
4. Questions appear → All players see same question simultaneously
5. Answers submitted → Server validates, calculates scores
6. Results shown → All players see results at same time
7. Next question → Repeat until game ends
8. Final scores → Leaderboard update
```

### 2.2 Room Management

```javascript
// netlify/functions/game-room.js

const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

// Room structure in Redis
const ROOM_PREFIX = 'game-room:';
const MAX_PLAYERS = 8;
const MIN_PLAYERS = 2;

exports.handler = async (event) => {
  const { action, roomId, userId } = JSON.parse(event.body);

  switch (action) {
    case 'create':
      return await createRoom(userId);
    case 'join':
      return await joinRoom(roomId, userId);
    case 'leave':
      return await leaveRoom(roomId, userId);
    case 'start':
      return await startGame(roomId, userId);
    case 'get-state':
      return await getRoomState(roomId);
  }
};

async function createRoom(hostId) {
  const roomId = generateRoomId();
  const room = {
    id: roomId,
    hostId,
    players: [hostId],
    status: 'waiting',
    createdAt: Date.now(),
    settings: {
      difficulty: 'medium',
      questionCount: 10,
      timePerQuestion: 20
    }
  };

  await redis.setex(
    `${ROOM_PREFIX}${roomId}`,
    3600, // 1 hour TTL
    JSON.stringify(room)
  );

  await redis.sadd(`room:${roomId}:players`, hostId);

  return {
    statusCode: 200,
    body: JSON.stringify({ roomId, room })
  };
}

async function joinRoom(roomId, userId) {
  const roomKey = `${ROOM_PREFIX}${roomId}`;
  const roomData = await redis.get(roomKey);
  
  if (!roomData) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Room not found' }) };
  }

  const room = JSON.parse(roomData);
  
  if (room.status !== 'waiting') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Game already started' }) };
  }

  if (room.players.length >= MAX_PLAYERS) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Room full' }) };
  }

  if (room.players.includes(userId)) {
    return { statusCode: 200, body: JSON.stringify({ room }) };
  }

  room.players.push(userId);
  await redis.setex(roomKey, 3600, JSON.stringify(room));
  await redis.sadd(`room:${roomId}:players`, userId);

  // Broadcast player joined
  await redis.publish(`room:${roomId}:updates`, JSON.stringify({
    type: 'player-joined',
    userId,
    players: room.players
  }));

  return { statusCode: 200, body: JSON.stringify({ room }) };
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
```

### 2.3 Game State Synchronization

```javascript
// WebSocket server: game-state.js

class GameRoomManager {
  constructor(redis) {
    this.redis = redis;
    this.rooms = new Map(); // roomId → Set of WebSocket connections
  }

  async handleGameAction(roomId, userId, action, payload) {
    const room = await this.getRoom(roomId);
    if (!room) return { error: 'Room not found' };

    switch (action) {
      case 'submit-answer':
        return await this.handleAnswerSubmission(roomId, userId, payload);
      case 'request-next-question':
        return await this.handleNextQuestion(roomId, userId);
    }
  }

  async handleAnswerSubmission(roomId, userId, { questionId, answer, timeSpent }) {
    // Validate answer server-side (authoritative)
    const question = await this.getQuestion(questionId);
    const isCorrect = this.validateAnswer(question, answer);
    
    // Calculate score
    const score = this.calculateScore(isCorrect, timeSpent, question.difficulty);
    
    // Store answer
    await this.redis.hset(
      `room:${roomId}:answers:${questionId}`,
      userId,
      JSON.stringify({ answer, isCorrect, score, timeSpent })
    );

    // Check if all players answered
    const room = await this.getRoom(roomId);
    const answers = await this.redis.hgetall(`room:${roomId}:answers:${questionId}`);
    
    if (Object.keys(answers).length === room.players.length) {
      // All players answered, show results
      await this.broadcastToRoom(roomId, {
        type: 'question-results',
        questionId,
        answers: this.formatAnswers(answers),
        correctAnswer: question.correctAnswer
      });
    } else {
      // Acknowledge answer received
      await this.sendToUser(userId, {
        type: 'answer-received',
        questionId
      });
    }

    return { success: true, score };
  }

  async broadcastToRoom(roomId, message) {
    const connections = this.rooms.get(roomId) || new Set();
    const messageStr = JSON.stringify(message);
    
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  }
}
```

### 2.4 Client-Side Game Synchronization

```javascript
// src/utils/multiplayer-game.js

class MultiplayerGameClient {
  constructor(roomId, userId, ws) {
    this.roomId = roomId;
    this.userId = userId;
    this.ws = ws;
    this.gameState = null;
    this.listeners = new Map();
    
    this.setupWebSocket();
  }

  setupWebSocket() {
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };
  }

  handleMessage(message) {
    switch (message.type) {
      case 'game-started':
        this.gameState = message.payload;
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
        this.emit('players-updated', message.payload);
        break;
      case 'game-ended':
        this.emit('game-ended', message.payload);
        break;
    }
  }

  submitAnswer(questionId, answer, timeSpent) {
    this.send({
      type: 'game-action',
      action: 'submit-answer',
      payload: { questionId, answer, timeSpent }
    });
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(cb => cb(data));
  }
}
```

---

## 📋 Phase 3: Collaborative Fact-Checking
**Timeline:** 4-5 weeks  
**Goal:** Multiple users reviewing same claim/article with evidence linking

### 3.1 Collaboration Model

```
Claim/Article Structure:
{
  id: "claim-123",
  headline: "...",
  source: "...",
  status: "pending" | "verified" | "disputed" | "false",
  reviews: [
    {
      userId: "...",
      verdict: "factual" | "misleading" | "false",
      confidence: 0-100,
      evidence: ["source1", "source2"],
      reasoning: "...",
      timestamp: "..."
    }
  ],
  consensus: {
    verdict: "factual",
    confidence: 85,
    agreementCount: 7,
    disagreementCount: 1
  }
}
```

### 3.2 Implementation

```javascript
// netlify/functions/collaborative-review.js

exports.handler = async (event) => {
  const { action, claimId, userId, review } = JSON.parse(event.body);

  switch (action) {
    case 'submit-review':
      return await submitReview(claimId, userId, review);
    case 'get-claim':
      return await getClaim(claimId);
    case 'get-consensus':
      return await getConsensus(claimId);
  }
};

async function submitReview(claimId, userId, review) {
  // Validate review
  if (!review.verdict || !review.evidence || review.evidence.length === 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid review' })
    };
  }

  // Store review
  await redis.hset(
    `claim:${claimId}:reviews`,
    userId,
    JSON.stringify({
      ...review,
      timestamp: Date.now()
    })
  );

  // Recalculate consensus
  const consensus = await calculateConsensus(claimId);

  // Update claim status
  await updateClaimStatus(claimId, consensus);

  // Broadcast update
  await redis.publish(`claim:${claimId}:updates`, JSON.stringify({
    type: 'review-added',
    userId,
    review,
    consensus
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, consensus })
  };
}

async function calculateConsensus(claimId) {
  const reviews = await redis.hgetall(`claim:${claimId}:reviews`);
  const reviewArray = Object.values(reviews).map(r => JSON.parse(r));

  // Weighted consensus
  const verdicts = {};
  let totalConfidence = 0;

  reviewArray.forEach(review => {
    const key = review.verdict;
    if (!verdicts[key]) {
      verdicts[key] = { count: 0, totalConfidence: 0 };
    }
    verdicts[key].count++;
    verdicts[key].totalConfidence += review.confidence;
    totalConfidence += review.confidence;
  });

  // Find majority verdict
  let majorityVerdict = null;
  let maxCount = 0;
  let avgConfidence = 0;

  Object.entries(verdicts).forEach(([verdict, data]) => {
    if (data.count > maxCount) {
      maxCount = data.count;
      majorityVerdict = verdict;
      avgConfidence = data.totalConfidence / data.count;
    }
  });

  return {
    verdict: majorityVerdict,
    confidence: Math.round(avgConfidence),
    agreementCount: maxCount,
    disagreementCount: reviewArray.length - maxCount,
    totalReviews: reviewArray.length
  };
}
```

---

## 🔧 Infrastructure Setup

### Redis Configuration

**Recommended:** Upstash Redis (serverless, auto-scaling) or Redis Cloud

**Environment Variables:**
```bash
REDIS_URL=redis://...
REDIS_PASSWORD=...
```

### PostgreSQL Setup

**Recommended:** Supabase, Neon, or Railway PostgreSQL

**Schema:**
```sql
-- Users table (extend existing)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Game sessions
CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  room_id TEXT,
  score INTEGER,
  accuracy DECIMAL,
  difficulty TEXT,
  started_at TIMESTAMP,
  ended_at TIMESTAMP
);

-- Leaderboard (materialized view)
CREATE MATERIALIZED VIEW leaderboard_all AS
SELECT 
  user_id,
  MAX(score) as high_score,
  AVG(accuracy) as avg_accuracy,
  COUNT(*) as games_played
FROM game_sessions
GROUP BY user_id
ORDER BY high_score DESC;

-- Collaborative reviews
CREATE TABLE IF NOT EXISTS claim_reviews (
  id UUID PRIMARY KEY,
  claim_id TEXT,
  user_id UUID REFERENCES users(id),
  verdict TEXT,
  confidence INTEGER,
  evidence JSONB,
  reasoning TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 📊 Tradeoffs & Decisions

### What We're Building

✅ **Real-time multiplayer** with small rooms (2-8 players)  
✅ **Authoritative server-side** game state (anti-cheat)  
✅ **WebSocket-based** synchronization  
✅ **Redis** for real-time state, PostgreSQL for persistence  
✅ **Clean, newsroom aesthetic** (no arcade UI)  
✅ **Graceful degradation** (works with network issues)

### What We're Deferring

❌ **Tournament mode** (build after v1 proves successful)  
❌ **Large lobbies** (start with small rooms, scale later)  
❌ **Voice chat** (low ROI, adds complexity)  
❌ **Complex ML** (data volume doesn't justify yet)  
❌ **Microservices migration** (premature optimization)

### Architecture Decisions

1. **WebSocket Server:** Separate service (Railway/Render) for now, migrate to edge if needed
2. **State Management:** Redis for real-time, PostgreSQL for persistence
3. **Anti-Cheat:** Server-side validation, rate limiting, score bounds checking
4. **Scaling:** Start simple, add complexity only when needed

---

## 🚀 Rollout Plan

### Week 1-2: Foundation
- [ ] Set up Redis (Upstash)
- [ ] Set up PostgreSQL (Supabase/Neon)
- [ ] WebSocket server deployment
- [ ] Basic connection management

### Week 3-4: Real-Time Leaderboards
- [ ] WebSocket client library
- [ ] Presence tracking
- [ ] Live leaderboard updates
- [ ] UI integration

### Week 5-8: Multiplayer v1
- [ ] Room management
- [ ] Game state synchronization
- [ ] Answer submission flow
- [ ] Results display
- [ ] Testing with 2-8 players

### Week 9-12: Collaborative Fact-Checking
- [ ] Review submission system
- [ ] Consensus calculation
- [ ] Evidence linking
- [ ] Real-time updates

---

## ✅ Success Criteria

**Technical:**
- WebSocket connection stability: >99%
- Latency: <100ms for leaderboard updates
- Game synchronization: <200ms for all players
- Zero data loss on disconnects

**User Experience:**
- Leaderboard updates feel instant
- Game state stays synchronized
- Presence indicators accurate
- Graceful handling of network issues

**Mission Alignment:**
- Features strengthen media literacy
- Collaborative fact-checking increases credibility
- Real-time updates maintain "credibility at speed"
- Clean, newsroom aesthetic maintained

---

**This plan delivers production-ready, mission-aligned features that scale incrementally.**

