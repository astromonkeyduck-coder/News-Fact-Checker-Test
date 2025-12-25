/**
 * Game Room Management API
 * Handles room creation, joining, leaving, and state management
 * Mission: Signal over noise, credibility at speed
 */

const { getStore } = require("@netlify/blobs");
const crypto = require("crypto");

// Room configuration
const MAX_PLAYERS = 8;
const MIN_PLAYERS = 2;
const ROOM_TTL = 3600; // 1 hour

// Generate unique room ID
function generateRoomId() {
  return `room_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  try {
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Game room service not configured" }),
      };
    }

    const store = getStore({
      name: "game-rooms",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
    });

    const body = event.body ? JSON.parse(event.body) : {};
    const { action, roomId, userId, userName, settings } = body;

    switch (action) {
      case 'create':
        return await createRoom(store, userId, userName, settings);
      case 'join':
        return await joinRoom(store, roomId, userId, userName);
      case 'leave':
        return await leaveRoom(store, roomId, userId);
      case 'get-state':
        return await getRoomState(store, roomId);
      case 'start':
        return await startGame(store, roomId, userId);
      case 'list':
        return await listRooms(store);
      case 'submit-answer':
        return await submitAnswer(store, roomId, userId, body.questionId, body.answer, body.timeSpent);
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Invalid action" }),
        };
    }
  } catch (error) {
    console.error("[GameRoom] Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

/**
 * Create a new game room
 */
async function createRoom(store, hostId, hostName, settings = {}) {
  const roomId = generateRoomId();
  const room = {
    id: roomId,
    hostId,
    hostName: hostName || 'Anonymous',
    players: [{
      userId: hostId,
      userName: hostName || 'Anonymous',
      joinedAt: Date.now(),
      isReady: false
    }],
    status: 'waiting', // waiting, starting, playing, finished
    createdAt: Date.now(),
    startedAt: null,
    settings: {
      difficulty: settings.difficulty || 'medium',
      questionCount: settings.questionCount || 10,
      timePerQuestion: settings.timePerQuestion || 20,
      ...settings
    },
    currentQuestion: null,
    questionIndex: 0,
    scores: {}
  };

  const roomKey = `room:${roomId}`;
  await store.set(roomKey, JSON.stringify(room), {
    contentType: "application/json",
  });

  console.log(`[GameRoom] Created room ${roomId} by ${hostId}`);

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ success: true, roomId, room }),
  };
}

/**
 * Join an existing game room
 */
async function joinRoom(store, roomId, userId, userName) {
  const roomKey = `room:${roomId}`;
  const roomData = await store.get(roomKey, { type: "json" });

  if (!roomData) {
    return {
      statusCode: 404,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Room not found" }),
    };
  }

  if (roomData.status !== 'waiting') {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Game already started" }),
    };
  }

  if (roomData.players.length >= MAX_PLAYERS) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Room is full" }),
    };
  }

  // Check if player already in room
  const existingPlayer = roomData.players.find(p => p.userId === userId);
  if (existingPlayer) {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ success: true, room: roomData }),
    };
  }

  // Add player
  roomData.players.push({
    userId,
    userName: userName || 'Anonymous',
    joinedAt: Date.now(),
    isReady: false
  });

  await store.set(roomKey, JSON.stringify(roomData), {
    contentType: "application/json",
  });

  console.log(`[GameRoom] ${userName} (${userId}) joined room ${roomId}`);

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ success: true, room: roomData }),
  };
}

/**
 * Leave a game room
 */
async function leaveRoom(store, roomId, userId) {
  const roomKey = `room:${roomId}`;
  const roomData = await store.get(roomKey, { type: "json" });

  if (!roomData) {
    return {
      statusCode: 404,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Room not found" }),
    };
  }

  // Remove player
  roomData.players = roomData.players.filter(p => p.userId !== userId);

  // If no players left, delete room
  if (roomData.players.length === 0) {
    await store.delete(roomKey);
    console.log(`[GameRoom] Room ${roomId} deleted (no players)`);
  } else {
    // If host left, assign new host
    if (roomData.hostId === userId) {
      roomData.hostId = roomData.players[0].userId;
      roomData.hostName = roomData.players[0].userName;
    }

    await store.set(roomKey, JSON.stringify(roomData), {
      contentType: "application/json",
    });
  }

  console.log(`[GameRoom] ${userId} left room ${roomId}`);

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ success: true, room: roomData }),
  };
}

/**
 * Get current room state
 */
async function getRoomState(store, roomId) {
  const roomKey = `room:${roomId}`;
  const roomData = await store.get(roomKey, { type: "json" });

  if (!roomData) {
    return {
      statusCode: 404,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Room not found" }),
    };
  }

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ success: true, room: roomData }),
  };
}

/**
 * Start the game (host only)
 */
async function startGame(store, roomId, userId) {
  const roomKey = `room:${roomId}`;
  const roomData = await store.get(roomKey, { type: "json" });

  if (!roomData) {
    return {
      statusCode: 404,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Room not found" }),
    };
  }

  if (roomData.hostId !== userId) {
    return {
      statusCode: 403,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Only the host can start the game" }),
    };
  }

  if (roomData.players.length < MIN_PLAYERS) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: `Need at least ${MIN_PLAYERS} players to start` }),
    };
  }

  if (roomData.status !== 'waiting') {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Game already started" }),
    };
  }

  roomData.status = 'starting';
  roomData.startedAt = Date.now();
  roomData.questionIndex = 0;

  // Initialize scores
  roomData.players.forEach(player => {
    roomData.scores[player.userId] = {
      score: 0,
      correct: 0,
      incorrect: 0,
      totalTime: 0,
      averageTime: 0
    };
  });

  await store.set(roomKey, JSON.stringify(roomData), {
    contentType: "application/json",
  });

  console.log(`[GameRoom] Game started in room ${roomId}`);

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ success: true, room: roomData }),
  };
}

/**
 * List available rooms
 */
async function listRooms(store) {
  // Note: Netlify Blobs doesn't have a list operation in the same way
  // In production, you'd maintain a separate index
  // For now, return empty list (rooms are accessed by ID)
  
  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ success: true, rooms: [] }),
  };
}

