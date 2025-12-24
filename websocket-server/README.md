# Multiplayer WebSocket Server

WebSocket server for real-time multiplayer game synchronization.

## Deployment

### Railway (Recommended)

1. Create new project on Railway
2. Connect GitHub repository
3. Set root directory to `websocket-server/`
4. Add environment variables:
   - `REDIS_URL` - Redis connection string
   - `PORT` - Server port (Railway sets this automatically)
5. Deploy

### Render

1. Create new Web Service
2. Set build command: `npm install`
3. Set start command: `npm start`
4. Add environment variables:
   - `REDIS_URL`
   - `PORT` (optional, defaults to 8080)
5. Deploy

## Environment Variables

- `REDIS_URL` (required) - Redis connection string
- `PORT` (optional) - Server port, defaults to 8080
- `NETLIFY_SITE_ID` (optional) - For Netlify Blobs access
- `NETLIFY_BLOB_READ_WRITE_TOKEN` (optional) - For Netlify Blobs access

## Local Development

```bash
cd websocket-server
npm install
npm run dev
```

## Architecture

- WebSocket server for real-time communication
- Redis for pub/sub and state management
- Room-based architecture (2-8 players per room)
- Authoritative server-side validation

## Integration

Once deployed, set the WebSocket URL in your site:

```javascript
window.NOTEWORTHY_CONFIG = {
  websocketUrl: 'wss://your-websocket-server.railway.app'
};
```

Or via environment variable in Netlify build.

