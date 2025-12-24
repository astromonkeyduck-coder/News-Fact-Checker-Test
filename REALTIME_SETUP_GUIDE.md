# Real-Time Leaderboard Setup Guide

## Overview

This guide explains how to set up the real-time leaderboard system for Noteworthy News. The system provides live leaderboard updates and presence indicators using WebSockets and Redis.

## Architecture

```
Client (Browser)
    ↓ WebSocket
WebSocket Server (Railway/Render/Netlify Edge)
    ↓ Redis Pub/Sub
Redis (Upstash/Redis Cloud)
    ↑
Netlify Functions (Score Submission)
```

## Phase 1: Basic Setup (Works Without WebSocket)

The system is designed to **gracefully degrade** - it works without WebSocket/Redis configured, just without real-time updates.

### Current Status: ✅ Ready to Use

The code is already integrated and will work in "degraded mode" (no real-time updates) until you configure Redis and WebSocket server.

## Phase 2: Enable Real-Time Updates

### Step 1: Set Up Redis

**Option A: Upstash Redis (Recommended - Serverless)**
1. Go to [upstash.com](https://upstash.com)
2. Create a Redis database
3. Copy the `REDIS_URL` from the dashboard
4. Add to Netlify environment variables:
   ```
   REDIS_URL=redis://default:password@host:port
   ```

**Option B: Redis Cloud**
1. Go to [redis.com/cloud](https://redis.com/cloud)
2. Create a free database
3. Copy connection string
4. Add to Netlify environment variables

### Step 2: Set Up WebSocket Server

**Option A: Railway (Recommended)**
1. Go to [railway.app](https://railway.app)
2. Create new project
3. Deploy the WebSocket server (see `websocket-server/` directory)
4. Get the WebSocket URL (e.g., `wss://your-app.railway.app`)
5. Add to Netlify environment variables:
   ```
   WEBSOCKET_URL=wss://your-app.railway.app
   ```

**Option B: Render**
1. Go to [render.com](https://render.com)
2. Create new Web Service
3. Deploy WebSocket server
4. Get WebSocket URL
5. Add to environment variables

**Option C: Netlify Edge Functions (Future)**
- When Netlify adds WebSocket support to Edge Functions, we can migrate

### Step 3: Configure Frontend

Add WebSocket URL to your site configuration:

**Option A: Environment Variable (Build Time)**
```javascript
// In your build process or netlify.toml
[build.environment]
  WEBSOCKET_URL = "wss://your-websocket-server.com"
```

**Option B: Global Config (Runtime)**
```javascript
// In index.html or main script
window.NOTEWORTHY_CONFIG = {
  websocketUrl: 'wss://your-websocket-server.com'
};
```

### Step 4: Include CSS

Add the real-time leaderboard CSS to your HTML:

```html
<link rel="stylesheet" href="src/styles/realtime-leaderboard.css">
```

Or in your main stylesheet, import it:
```css
@import url('src/styles/realtime-leaderboard.css');
```

## Testing

### Test Without WebSocket (Degraded Mode)
1. Don't set `WEBSOCKET_URL`
2. Leaderboard should work normally
3. No real-time updates, but everything else functions

### Test With WebSocket
1. Set up Redis and WebSocket server
2. Submit a score
3. Open leaderboard in two browser windows
4. Submit score in one window
5. Should see update in other window within ~100ms

## WebSocket Server Implementation

Create a new directory `websocket-server/` with:

```javascript
// websocket-server/index.js
const WebSocket = require('ws');
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);
const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

const connections = new Map(); // userId → WebSocket

wss.on('connection', (ws) => {
  let userId = null;

  ws.on('message', async (data) => {
    const message = JSON.parse(data.toString());
    
    switch (message.type) {
      case 'authenticate':
        userId = message.payload.userId;
        connections.set(userId, ws);
        await updatePresence(userId, 'online');
        await subscribeToLeaderboard(userId, ws, message.payload.gameType);
        break;
        
      case 'heartbeat':
        await updatePresence(userId, 'online');
        break;
    }
  });

  ws.on('close', async () => {
    if (userId) {
      connections.delete(userId);
      await updatePresence(userId, 'offline');
    }
  });
});

async function subscribeToLeaderboard(userId, ws, gameType) {
  const subscriber = redis.duplicate();
  await subscriber.subscribe(`leaderboard-updates:${gameType}`);
  
  subscriber.on('message', (channel, message) => {
    ws.send(message);
  });
}

async function updatePresence(userId, status) {
  await redis.setex(
    `presence:user:${userId}`,
    60,
    JSON.stringify({ userId, status, lastSeen: Date.now() })
  );
  
  await redis.publish('presence-updates', JSON.stringify({
    userId,
    status,
    timestamp: Date.now()
  }));
}
```

## Environment Variables Summary

**Netlify:**
- `REDIS_URL` - Redis connection string
- `WEBSOCKET_URL` - WebSocket server URL (optional, for frontend)

**WebSocket Server:**
- `REDIS_URL` - Redis connection string
- `PORT` - Server port (default: 8080)

## Monitoring

### Check Redis Connection
```javascript
// In Netlify function
const redis = require('ioredis');
const client = new Redis(process.env.REDIS_URL);
client.ping().then(() => console.log('Redis connected'));
```

### Check WebSocket Connections
Monitor active connections in your WebSocket server logs.

### Check Presence
```javascript
// Get active user count
const keys = await redis.keys('presence:user:*');
console.log(`Active users: ${keys.length}`);
```

## Troubleshooting

### Real-time updates not working
1. Check Redis connection in Netlify function logs
2. Check WebSocket server is running
3. Check browser console for WebSocket connection errors
4. Verify `WEBSOCKET_URL` is set correctly

### Presence indicators not showing
1. Check Redis is storing presence data
2. Check WebSocket is broadcasting presence updates
3. Check browser console for errors

### Scores not broadcasting
1. Check `leaderboard-broadcast.js` is being called
2. Check Redis pub/sub is working
3. Check WebSocket server is subscribed to correct channels

## Next Steps

Once Phase 1 (Real-Time Leaderboards) is working:
1. Move to Phase 2: Multiplayer v1
2. Add tournament mode
3. Add collaborative fact-checking

## Support

For issues or questions:
1. Check browser console for errors
2. Check Netlify function logs
3. Check WebSocket server logs
4. Verify all environment variables are set

---

**Status:** Phase 1 implementation complete. Ready for Redis/WebSocket setup.

