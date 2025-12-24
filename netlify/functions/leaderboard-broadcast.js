/**
 * Leaderboard Broadcast Function
 * Broadcasts score updates via Redis pub/sub for real-time updates
 * This is called after a score is submitted to notify connected clients
 */

const Redis = require('ioredis');

// Initialize Redis connection (optional - gracefully degrades if not configured)
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
      console.error('[LeaderboardBroadcast] Redis error:', err);
    });
    
    redis.on('connect', () => {
      console.log('[LeaderboardBroadcast] Redis connected');
    });
  }
} catch (error) {
  console.warn('[LeaderboardBroadcast] Redis not available:', error.message);
}

/**
 * Broadcast score update to all connected clients
 */
async function broadcastScoreUpdate(gameType, scoreData) {
  if (!redis) {
    // Redis not configured, skip broadcast (graceful degradation)
    return;
  }

  try {
    const message = JSON.stringify({
      type: 'score-updated',
      gameType,
      score: scoreData,
      timestamp: Date.now()
    });

    // Publish to Redis channel
    await redis.publish(`leaderboard-updates:${gameType}`, message);
    console.log(`[LeaderboardBroadcast] Broadcasted score update for ${gameType}`);
  } catch (error) {
    console.error('[LeaderboardBroadcast] Error broadcasting update:', error);
    // Don't throw - this is non-critical
  }
}

/**
 * Broadcast leaderboard refresh
 */
async function broadcastLeaderboardRefresh(gameType) {
  if (!redis) {
    return;
  }

  try {
    const message = JSON.stringify({
      type: 'leaderboard-refresh',
      gameType,
      timestamp: Date.now()
    });

    await redis.publish(`leaderboard-updates:${gameType}`, message);
    console.log(`[LeaderboardBroadcast] Broadcasted leaderboard refresh for ${gameType}`);
  } catch (error) {
    console.error('[LeaderboardBroadcast] Error broadcasting refresh:', error);
  }
}

/**
 * Update presence for a user
 */
async function updatePresence(userId, status, gameType = null) {
  if (!redis) {
    return;
  }

  try {
    const presenceData = {
      userId,
      status,
      lastSeen: Date.now(),
      gameType
    };

    // Store presence with 60 second TTL
    await redis.setex(
      `presence:user:${userId}`,
      60,
      JSON.stringify(presenceData)
    );

    // Broadcast presence update
    await redis.publish('presence-updates', JSON.stringify(presenceData));
  } catch (error) {
    console.error('[LeaderboardBroadcast] Error updating presence:', error);
  }
}

/**
 * Get active user count for a game type
 */
async function getActiveUserCount(gameType) {
  if (!redis) {
    return 0;
  }

  try {
    // Count users with presence in last 60 seconds
    const keys = await redis.keys(`presence:user:*`);
    let count = 0;

    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        const presence = JSON.parse(data);
        if (presence.status === 'online' && 
            (!gameType || presence.gameType === gameType)) {
          count++;
        }
      }
    }

    return count;
  } catch (error) {
    console.error('[LeaderboardBroadcast] Error getting active user count:', error);
    return 0;
  }
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    broadcastScoreUpdate,
    broadcastLeaderboardRefresh,
    updatePresence,
    getActiveUserCount
  };
}

// Netlify function handler (optional - can be called directly from leaderboard.js)
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  try {
    const { action, gameType, scoreData, userId, status } = JSON.parse(event.body || '{}');

    switch (action) {
      case 'broadcast-score':
        await broadcastScoreUpdate(gameType, scoreData);
        break;
      case 'refresh-leaderboard':
        await broadcastLeaderboardRefresh(gameType);
        break;
      case 'update-presence':
        await updatePresence(userId, status, gameType);
        break;
      case 'get-active-count':
        const count = await getActiveUserCount(gameType);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ count })
        };
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid action' })
        };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    console.error('[LeaderboardBroadcast] Handler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

