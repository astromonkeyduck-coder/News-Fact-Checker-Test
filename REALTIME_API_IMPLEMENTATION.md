# OpenAI Realtime API - Complete Implementation Guide

## Authentication Method: Browser WebSocket

### The Problem
Browser WebSocket API **cannot send custom headers**. This is a fundamental limitation of the browser WebSocket API - there's no way to include an `Authorization: Bearer <token>` header.

### The Solution
OpenAI Realtime API accepts the ephemeral token as a **query parameter** in the WebSocket URL for browser connections.

### Implementation

#### 1. Backend: Generate Ephemeral Token
```javascript
// netlify/functions/realtime-voice.js
const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,  // Your permanent API key
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4o-realtime-preview',
    voice: 'alloy',
    // ... other config
  }),
});

const sessionData = await response.json();
// Token is in: sessionData.client_secret.value
```

#### 2. Frontend: Include Token in WebSocket URL
```javascript
// src/widgets/noteworthy-chat.js
const wsUrl = sessionData.websocket_url; // e.g., "wss://api.openai.com/v1/realtime?model=...&session_id=..."

// Add ephemeral token as query parameter
const separator = wsUrl.includes('?') ? '&' : '?';
const encodedToken = encodeURIComponent(sessionData.ephemeral_token);
const finalUrl = `${wsUrl}${separator}ephemeral_token=${encodedToken}`;

// Connect with token in URL
const websocket = new WebSocket(finalUrl);
```

### Why This Works

1. **Browser Limitation**: `new WebSocket(url, protocols)` - no headers parameter
2. **OpenAI Support**: Realtime API accepts `ephemeral_token` as query parameter
3. **Security**: Token is still encrypted via WSS (WebSocket Secure)
4. **URL Encoding**: Token is properly encoded to handle special characters

### Authentication Flow

```
1. Client requests session from backend
   ↓
2. Backend creates OpenAI session, gets ephemeral token
   ↓
3. Backend returns: { session_id, ephemeral_token, websocket_url }
   ↓
4. Client constructs WebSocket URL with token:
   wss://api.openai.com/v1/realtime?model=...&session_id=...&ephemeral_token=...
   ↓
5. Client connects: new WebSocket(url)
   ↓
6. OpenAI authenticates during WebSocket handshake (automatic)
   ↓
7. Connection opens - already authenticated, ready to use
```

### Important Notes

- **No Auth Message Needed**: When token is in URL, authentication happens during handshake
- **auth.success Optional**: OpenAI may send `auth.success` message, but it's not required
- **Token Expiration**: Ephemeral tokens expire quickly (1-10 minutes typically)
- **URL Encoding**: Always use `encodeURIComponent()` to handle special characters
- **One Token Per Connection**: Each WebSocket connection needs its own token

### Error Handling

#### Authentication Errors
If you receive `auth.error` or errors mentioning "authentication", "bearer", or "token":

1. **Token Expired**: Get a fresh token from backend
2. **Token Invalid**: Verify token format and encoding
3. **Token Missing**: Ensure token is in URL before connecting
4. **Session Closed**: Create a new session

#### Automatic Retry
The implementation automatically:
- Detects authentication errors
- Closes the failed connection
- Requests a new session from backend
- Retries with fresh token

### Code Verification Checklist

✅ **Backend** (`realtime-voice.js`):
- [x] Creates session with OpenAI API
- [x] Extracts `client_secret.value` as ephemeral token
- [x] Falls back to `/sessions/{id}/tokens` endpoint if needed
- [x] Returns `ephemeral_token` in response
- [x] Returns `websocket_url` with session_id

✅ **Frontend** (`noteworthy-chat.js`):
- [x] Requests session from backend
- [x] Receives `ephemeral_token` and `websocket_url`
- [x] Validates token exists before connecting
- [x] URL-encodes token with `encodeURIComponent()`
- [x] Adds token to WebSocket URL as query parameter
- [x] Connects with `new WebSocket(urlWithToken)`
- [x] Starts audio capture immediately (auth is automatic)
- [x] Handles `auth.success` if received (optional)
- [x] Handles `auth.error` with automatic retry
- [x] Handles generic errors mentioning authentication

### Testing

1. **Connection Test**:
   ```javascript
   // Should connect immediately without auth errors
   // Check console for: "✅ WebSocket connected and authenticated"
   ```

2. **Token Validation**:
   ```javascript
   // Verify token is in URL (redacted in logs)
   // Check: "✅ Added ephemeral token to WebSocket URL"
   ```

3. **Error Recovery**:
   ```javascript
   // If auth fails, should automatically retry
   // Check: "🔄 Restarting with fresh session..."
   ```

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "Missing bearer authentication" | Token not in URL | Add `ephemeral_token` query parameter |
| "Invalid token" | Token expired | Get fresh token from backend |
| "Token malformed" | Not URL-encoded | Use `encodeURIComponent()` |
| Connection fails immediately | Token missing | Verify backend returns token |
| Auth errors after connection | Token expired during use | Implement token refresh |

### Security Considerations

1. **Token Lifetime**: Ephemeral tokens are short-lived (minutes, not hours)
2. **HTTPS/WSS Only**: Always use secure connections
3. **Token Storage**: Never store tokens in localStorage or cookies
4. **One-Time Use**: Each connection should use a fresh token
5. **Backend Security**: Keep permanent API key on server only

### References

- OpenAI Realtime API Docs: https://platform.openai.com/docs/guides/realtime-websocket
- Browser WebSocket API: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- Implementation File: `src/widgets/noteworthy-chat.js` (lines ~4217-4293)

---

**Status**: ✅ Fully Implemented and Verified
**Last Updated**: 2025-12-14
**Method**: URL Query Parameter (Browser-Compatible)
