# GA API Version Mismatch Fix

## Problem

**Error**: `API version mismatch. You cannot start a Realtime GA session with a beta client secret.`

**Root Cause**: 
- Backend was using `/v1/realtime/sessions` endpoint (BETA API)
- This creates beta client secrets that are incompatible with GA WebSocket endpoint
- Frontend connects to GA WebSocket endpoint, but receives beta tokens

**Error Message**:
```
"code": "api_version_mismatch",
"message": "API version mismatch. You cannot start a Realtime GA session with a beta client secret. Please ensure that you are using endpoints for the same API version. If you want to use the Realtime GA API, please create a client secret using the /v1/realtime/client_secrets endpoint."
```

---

## Solution

**Changed**: Use `/v1/realtime/client_secrets` endpoint as PRIMARY method (GA API)

**Why**: 
- `/v1/realtime/client_secrets` creates GA-compatible client secrets
- These tokens work with the GA WebSocket endpoint
- Matches the API version used by the frontend

---

## Changes Made

### File: `netlify/functions/realtime-voice.js`

#### GET Handler (Lines ~44-177)
**Before**:
```javascript
// Used beta endpoint
const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
  method: 'POST',
  // ... beta session creation
});
```

**After**:
```javascript
// Use GA endpoint
const clientSecretResponse = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
  method: 'POST',
  body: JSON.stringify({
    expires_after: { anchor: 'created_at', seconds: 600 },
    session: {
      type: 'realtime',
      model: 'gpt-4o-realtime-preview',
      voice: voice,
      // ... GA session config
    }
  })
});
```

#### POST Handler (Lines ~179-496)
**Before**:
```javascript
// Used beta endpoint with fallback to GA
const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
  // ... beta session
});
// Then fallback to /client_secrets if no token
```

**After**:
```javascript
// Use GA endpoint as PRIMARY method
const clientSecretResponse = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
  method: 'POST',
  // ... GA client secret creation
});
```

---

## Key Differences

### Beta Endpoint (`/v1/realtime/sessions`)
- ❌ Creates beta sessions
- ❌ Beta client secrets incompatible with GA WebSocket
- ❌ Causes "API version mismatch" error

### GA Endpoint (`/v1/realtime/client_secrets`)
- ✅ Creates GA-compatible client secrets
- ✅ Works with GA WebSocket endpoint
- ✅ No version mismatch errors

---

## API Request Format

### GA Client Secrets Endpoint
```javascript
POST https://api.openai.com/v1/realtime/client_secrets
{
  "expires_after": {
    "anchor": "created_at",
    "seconds": 600
  },
  "session": {
    "type": "realtime",
    "model": "gpt-4o-realtime-preview",
    "voice": "alloy",
    "instructions": "...",
    "audio": {
      "input": {
        "format": {
          "type": "audio/pcm",
          "rate": 24000
        }
      },
      "output": {
        "format": {
          "type": "audio/pcm",
          "rate": 24000
        },
        "voice": "alloy",
        "speed": 1.0
      }
    },
    "temperature": 0.6,
    "max_response_output_tokens": 4096,
    "turn_detection": {
      "type": "server_vad",
      "threshold": 0.5,
      "prefix_padding_ms": 300,
      "silence_duration_ms": 500
    }
  }
}
```

### Response Format
```javascript
{
  "value": "ek_...",  // GA-compatible ephemeral token
  "expires_at": 1234567890,
  "session": {
    "id": "session_...",
    // ... session details
  }
}
```

---

## Verification

### ✅ What Changed
1. **GET handler**: Now uses `/v1/realtime/client_secrets` (GA)
2. **POST handler**: Now uses `/v1/realtime/client_secrets` (GA) as primary
3. **Removed**: Beta `/v1/realtime/sessions` endpoint usage
4. **Removed**: Fallback logic (no longer needed)

### ✅ Expected Behavior
- ✅ No more "API version mismatch" errors
- ✅ GA tokens work with GA WebSocket endpoint
- ✅ Consistent API version across backend and frontend

---

## Testing

**Test Steps**:
1. Call `/realtime-voice` endpoint (GET or POST)
2. Receive GA-compatible token (`ek_...`)
3. Connect to WebSocket using subprotocols
4. Should connect without "API version mismatch" error

**Success Criteria**:
- ✅ WebSocket connects successfully
- ✅ No "api_version_mismatch" errors
- ✅ Voice mode works end-to-end

---

## Status

✅ **FIXED**

Both GET and POST handlers now use the GA endpoint `/v1/realtime/client_secrets` to create GA-compatible client secrets that work with the GA WebSocket endpoint.

---

**Date**: December 14, 2025  
**Files Modified**: `netlify/functions/realtime-voice.js`  
**Issue**: API version mismatch between beta sessions and GA WebSocket
