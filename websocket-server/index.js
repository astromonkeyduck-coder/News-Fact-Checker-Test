/**
 * Multiplayer Game WebSocket Server
 * Handles real-time game state synchronization
 * Deploy to Railway, Render, or similar service
 * 
 * Environment Variables Required:
 * - REDIS_URL: Redis connection string
 * - PORT: Server port (default: 8080)
 * - NETLIFY_SITE_ID: For accessing Netlify Blobs (optional)
 * - NETLIFY_BLOB_READ_WRITE_TOKEN: For accessing Netlify Blobs (optional)
 */

const WebSocket = require('ws');
const Redis = require('ioredis');
const http = require('http');

// Initialize Redis
let redis = null;
try {
  if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });
    
    redis.on('error', (err) => {
      console.error('[WebSocketServer] Redis error:', err);
    });
    
    redis.on('connect', () => {
      console.log('[WebSocketServer] Redis connected');
    });
  } else {
    console.warn('[WebSocketServer] REDIS_URL not set, some features disabled');
  }
} catch (error) {
  console.warn('[WebSocketServer] Redis not available:', error.message);
}

// Room management
const rooms = new Map(); // roomId → Set of WebSocket connections
const connections = new Map(); // userId → WebSocket

// Create HTTP server
const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  let userId = null;
  let roomId = null;
  let heartbeatInterval = null;

  console.log('[WebSocketServer] New connection');

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'authenticate':
          userId = message.payload.userId;
          roomId = message.payload.roomId;
          
          if (!userId || !roomId) {
            ws.send(JSON.stringify({
              type: 'error',
              payload: { error: 'Missing userId or roomId' }
            }));
            return;
          }
          
          connections.set(userId, ws);
          await joinRoom(roomId, userId, ws);
          startHeartbeat();
          break;
          
        case 'join-room':
          roomId = message.payload.roomId;
          userId = message.payload.userId;
          await joinRoom(roomId, userId, ws);
          break;
          
        case 'leave-room':
          if (roomId && userId) {
            await leaveRoom(roomId, userId);
          }
          break;
          
        case 'submit-answer':
          if (roomId && userId) {
            await handleAnswerSubmission(roomId, userId, message.payload);
          }
          break;
          
        case 'request-next-question':
          if (roomId && userId) {
            await handleNextQuestion(roomId);
          }
          break;
          
        case 'heartbeat':
          // Keep connection alive
          break;
      }
    } catch (error) {
      console.error('[WebSocketServer] Error handling message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        payload: { error: error.message }
      }));
    }
  });

  ws.on('close', async () => {
    console.log('[WebSocketServer] Connection closed');
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    if (roomId && userId) {
      await leaveRoom(roomId, userId);
    }
    if (userId) {
      connections.delete(userId);
    }
  });

  ws.on('error', (error) => {
    console.error('[WebSocketServer] WebSocket error:', error);
  });

  function startHeartbeat() {
    heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'pong' }));
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 30000);
  }
});

/**
 * Join a game room
 */
async function joinRoom(roomId, userId, ws) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  
  rooms.get(roomId).add(ws);
  
  // Subscribe to Redis channel for room updates
  if (redis) {
    const subscriber = redis.duplicate();
    await subscriber.subscribe(`room:${roomId}:updates`);
    
    subscriber.on('message', (channel, message) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
    
    ws._subscriber = subscriber;
  }
  
  // Broadcast player joined
  await broadcastToRoom(roomId, {
    type: 'player-joined',
    payload: {
      userId,
      roomId,
      timestamp: Date.now()
    }
  });
  
  console.log(`[WebSocketServer] ${userId} joined room ${roomId}`);
}

/**
 * Leave a game room
 */
async function leaveRoom(roomId, userId) {
  const roomConnections = rooms.get(roomId);
  if (roomConnections) {
    // Find and remove this connection
    for (const ws of roomConnections) {
      if (ws === connections.get(userId)) {
        roomConnections.delete(ws);
        
        // Unsubscribe from Redis
        if (ws._subscriber) {
          ws._subscriber.quit();
        }
        break;
      }
    }
    
    if (roomConnections.size === 0) {
      rooms.delete(roomId);
    }
  }
  
  // Broadcast player left
  await broadcastToRoom(roomId, {
    type: 'player-left',
    payload: {
      userId,
      roomId,
      timestamp: Date.now()
    }
  });
  
  console.log(`[WebSocketServer] ${userId} left room ${roomId}`);
}

/**
 * Handle answer submission
 */
async function handleAnswerSubmission(roomId, userId, { questionId, answer, timeSpent }) {
  // Get room state from Netlify Blobs (or Redis)
  const room = await getRoomState(roomId);
  if (!room) {
    return;
  }
  
  // Get question to validate answer
  const question = await getQuestion(questionId);
  if (!question) {
    return;
  }
  
  // Validate answer (authoritative server-side)
  const isCorrect = answer === question.isFactual;
  
  // Calculate score
  const score = calculateScore(isCorrect, timeSpent, room.settings.difficulty);
  
  // Store answer in Redis
  if (redis) {
    await redis.hset(
      `room:${roomId}:answers:${questionId}`,
      userId,
      JSON.stringify({
        answer,
        isCorrect,
        score,
        timeSpent,
        timestamp: Date.now()
      })
    );
    
    // Update player score
    const currentScore = room.scores[userId] || { score: 0, correct: 0, incorrect: 0 };
    currentScore.score += score;
    if (isCorrect) {
      currentScore.correct += 1;
    } else {
      currentScore.incorrect += 1;
    }
    room.scores[userId] = currentScore;
    
    // Check if all players answered
    const answers = await redis.hgetall(`room:${roomId}:answers:${questionId}`);
    
    if (Object.keys(answers).length === room.players.length) {
      // All players answered, broadcast results
      await broadcastToRoom(roomId, {
        type: 'question-results',
        payload: {
          questionId,
          question,
          answers: formatAnswers(answers),
          correctAnswer: question.isFactual,
          scores: room.scores
        }
      });
    } else {
      // Acknowledge answer received
      const ws = connections.get(userId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'answer-received',
          payload: { questionId }
        }));
      }
    }
  }
}

/**
 * Handle next question request
 */
async function handleNextQuestion(roomId) {
  const room = await getRoomState(roomId);
  if (!room) {
    return;
  }
  
  // Get next question
  const questions = await getQuestionsForRoom(roomId, room.settings);
  const questionIndex = room.questionIndex || 0;
  
  if (questionIndex >= questions.length) {
    // Game ended
    await broadcastToRoom(roomId, {
      type: 'game-ended',
      payload: {
        roomId,
        scores: room.scores,
        finalScores: calculateFinalScores(room.scores)
      }
    });
    return;
  }
  
  const question = questions[questionIndex];
  room.questionIndex = questionIndex + 1;
  room.currentQuestion = question;
  
  // Update room state
  await updateRoomState(roomId, room);
  
  // Clear previous answers
  if (redis) {
    await redis.del(`room:${roomId}:answers:${question.id}`);
  }
  
  // Broadcast question
  await broadcastToRoom(roomId, {
    type: 'question-available',
    payload: {
      question,
      questionIndex: questionIndex + 1,
      totalQuestions: questions.length
    }
  });
}

/**
 * Broadcast message to all players in a room
 */
async function broadcastToRoom(roomId, message) {
  const roomConnections = rooms.get(roomId);
  if (!roomConnections) {
    return;
  }
  
  const messageStr = JSON.stringify(message);
  
  // Broadcast via WebSocket
  roomConnections.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
    }
  });
  
  // Also publish to Redis for persistence
  if (redis) {
    await redis.publish(`room:${roomId}:updates`, messageStr);
  }
}

/**
 * Get room state (from Netlify Blobs or Redis)
 */
async function getRoomState(roomId) {
  // In production, fetch from Netlify Blobs or Redis
  // For now, return null (needs implementation)
  return null;
}

/**
 * Get question by ID
 */
async function getQuestion(questionId) {
  // Fetch from question pool or database
  // For now, return null (needs implementation)
  return null;
}

/**
 * Get questions for a room (deterministic based on seed)
 */
async function getQuestionsForRoom(roomId, settings) {
  // Fetch questions from game-questions API or generate deterministically
  // For now, return empty array (needs implementation)
  return [];
}

/**
 * Update room state
 */
async function updateRoomState(roomId, room) {
  // Update in Netlify Blobs or Redis
  // For now, no-op (needs implementation)
}

/**
 * Calculate score
 */
function calculateScore(isCorrect, timeSpent, difficulty) {
  if (!isCorrect) return 0;
  
  const baseScore = 10;
  const difficultyMultiplier = { easy: 1, medium: 1.5, hard: 2 }[difficulty] || 1;
  const timeBonus = timeSpent < 3 ? 50 : timeSpent < 5 ? 30 : timeSpent < 8 ? 15 : 0;
  
  return Math.floor(baseScore * difficultyMultiplier) + timeBonus;
}

/**
 * Format answers for broadcast
 */
function formatAnswers(answers) {
  const formatted = {};
  for (const [userId, answerData] of Object.entries(answers)) {
    formatted[userId] = JSON.parse(answerData);
  }
  return formatted;
}

/**
 * Calculate final scores
 */
function calculateFinalScores(scores) {
  return Object.entries(scores)
    .map(([userId, score]) => ({ userId, ...score }))
    .sort((a, b) => b.score - a.score);
}

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`[WebSocketServer] Server listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[WebSocketServer] SIGTERM received, shutting down gracefully');
  wss.close(() => {
    if (redis) {
      redis.quit();
    }
    server.close(() => {
      process.exit(0);
    });
  });
});

