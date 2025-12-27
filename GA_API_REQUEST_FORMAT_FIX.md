# GA API Request Format Fix

## Problem

**Error**: `Unknown parameter: 'session.voice'`

**Root Cause**: 
- The GA endpoint `/v1/realtime/client_secrets` has a different request format than the beta endpoint
- `voice` parameter was incorrectly placed at `session.voice` level
- Model name was incorrect (`gpt-4o-realtime-preview` instead of `gpt-realtime`)
- Some parameters like `temperature`, `max_response_output_tokens`, and `turn_detection` at session level are not supported

---

## Solution

**Fixed Request Format**:
1. ✅ Removed `session.voice` (invalid parameter)
2. ✅ Voice goes in `session.audio.output.voice` (correct location)
3. ✅ Changed model from `gpt-4o-realtime-preview` to `gpt-realtime` (GA API model)
4. ✅ Moved `turn_detection` to `session.audio.input.turn_detection`
5. ✅ Removed unsupported parameters (`temperature`, `max_response_output_tokens` at session level)

---

## Changes Made

### File: `netlify/functions/realtime-voice.js`

#### Before (INCORRECT):
```javascript
{
  session: {
    type: 'realtime',
    model: 'gpt-4o-realtime-preview', // ❌ Wrong model name
    voice: voice, // ❌ Invalid parameter location
    instructions: '...',
    audio: {
      input: {
        format: { type: 'audio/pcm', rate: 24000 }
      },
      output: {
        format: { type: 'audio/pcm', rate: 24000 },
        voice: voice,
        speed: 1.0
      }
    },
    temperature: 0.6, // ❌ Not supported at session level
    max_response_output_tokens: 4096, // ❌ Not supported at session level
    turn_detection: { // ❌ Wrong location
      type: 'server_vad',
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 500,
    }
  }
}
```

#### After (CORRECT):
```javascript
{
  session: {
    type: 'realtime',
    model: 'gpt-realtime', // ✅ GA API model name
    instructions: '...',
    audio: {
      input: {
        format: { type: 'audio/pcm', rate: 24000 },
        turn_detection: { // ✅ Correct location
          type: 'server_vad'
        }
      },
      output: {
        format: { type: 'audio/pcm', rate: 24000 },
        voice: voice, // ✅ Correct location
        speed: 1.0
      }
    }
  }
}
```

---

## Key Differences

### Model Name
- ❌ **Beta**: `gpt-4o-realtime-preview`
- ✅ **GA**: `gpt-realtime`

### Voice Parameter
- ❌ **Wrong**: `session.voice`
- ✅ **Correct**: `session.audio.output.voice`

### Turn Detection
- ❌ **Wrong**: `session.turn_detection`
- ✅ **Correct**: `session.audio.input.turn_detection`

### Unsupported Parameters (GA API)
- ❌ `session.temperature` (not supported in GA format)
- ❌ `session.max_response_output_tokens` (not supported in GA format)
- ❌ `session.turn_detection.threshold` (simplified to just `type: 'server_vad'`)

---

## GA API Request Format (Correct)

```javascript
POST https://api.openai.com/v1/realtime/client_secrets
{
  "expires_after": {
    "anchor": "created_at",
    "seconds": 600
  },
  "session": {
    "type": "realtime",
    "model": "gpt-realtime",
    "instructions": "...",
    "audio": {
      "input": {
        "format": {
          "type": "audio/pcm",
          "rate": 24000
        },
        "turn_detection": {
          "type": "server_vad"
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
    }
  }
}
```

---

## Verification

### ✅ What Changed
1. **Model**: `gpt-4o-realtime-preview` → `gpt-realtime`
2. **Voice location**: `session.voice` → `session.audio.output.voice`
3. **Turn detection**: `session.turn_detection` → `session.audio.input.turn_detection`
4. **Removed**: `temperature`, `max_response_output_tokens` at session level
5. **Simplified**: `turn_detection` to just `{ type: 'server_vad' }`

### ✅ Expected Behavior
- ✅ No more "Unknown parameter: 'session.voice'" errors
- ✅ Request format matches GA API specification
- ✅ Client secrets created successfully

---

## Status

✅ **FIXED**

Both GET and POST handlers now use the correct GA API request format.

---

**Date**: December 14, 2025  
**Files Modified**: `netlify/functions/realtime-voice.js`  
**Issue**: Invalid request format for GA `/v1/realtime/client_secrets` endpoint





# GA API Request Format Fix

## Problem

**Error**: `Unknown parameter: 'session.voice'`

**Root Cause**: 
- The GA endpoint `/v1/realtime/client_secrets` has a different request format than the beta endpoint
- `voice` parameter was incorrectly placed at `session.voice` level
- Model name was incorrect (`gpt-4o-realtime-preview` instead of `gpt-realtime`)
- Some parameters like `temperature`, `max_response_output_tokens`, and `turn_detection` at session level are not supported

---

## Solution

**Fixed Request Format**:
1. ✅ Removed `session.voice` (invalid parameter)
2. ✅ Voice goes in `session.audio.output.voice` (correct location)
3. ✅ Changed model from `gpt-4o-realtime-preview` to `gpt-realtime` (GA API model)
4. ✅ Moved `turn_detection` to `session.audio.input.turn_detection`
5. ✅ Removed unsupported parameters (`temperature`, `max_response_output_tokens` at session level)

---

## Changes Made

### File: `netlify/functions/realtime-voice.js`

#### Before (INCORRECT):
```javascript
{
  session: {
    type: 'realtime',
    model: 'gpt-4o-realtime-preview', // ❌ Wrong model name
    voice: voice, // ❌ Invalid parameter location
    instructions: '...',
    audio: {
      input: {
        format: { type: 'audio/pcm', rate: 24000 }
      },
      output: {
        format: { type: 'audio/pcm', rate: 24000 },
        voice: voice,
        speed: 1.0
      }
    },
    temperature: 0.6, // ❌ Not supported at session level
    max_response_output_tokens: 4096, // ❌ Not supported at session level
    turn_detection: { // ❌ Wrong location
      type: 'server_vad',
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 500,
    }
  }
}
```

#### After (CORRECT):
```javascript
{
  session: {
    type: 'realtime',
    model: 'gpt-realtime', // ✅ GA API model name
    instructions: '...',
    audio: {
      input: {
        format: { type: 'audio/pcm', rate: 24000 },
        turn_detection: { // ✅ Correct location
          type: 'server_vad'
        }
      },
      output: {
        format: { type: 'audio/pcm', rate: 24000 },
        voice: voice, // ✅ Correct location
        speed: 1.0
      }
    }
  }
}
```

---

## Key Differences

### Model Name
- ❌ **Beta**: `gpt-4o-realtime-preview`
- ✅ **GA**: `gpt-realtime`

### Voice Parameter
- ❌ **Wrong**: `session.voice`
- ✅ **Correct**: `session.audio.output.voice`

### Turn Detection
- ❌ **Wrong**: `session.turn_detection`
- ✅ **Correct**: `session.audio.input.turn_detection`

### Unsupported Parameters (GA API)
- ❌ `session.temperature` (not supported in GA format)
- ❌ `session.max_response_output_tokens` (not supported in GA format)
- ❌ `session.turn_detection.threshold` (simplified to just `type: 'server_vad'`)

---

## GA API Request Format (Correct)

```javascript
POST https://api.openai.com/v1/realtime/client_secrets
{
  "expires_after": {
    "anchor": "created_at",
    "seconds": 600
  },
  "session": {
    "type": "realtime",
    "model": "gpt-realtime",
    "instructions": "...",
    "audio": {
      "input": {
        "format": {
          "type": "audio/pcm",
          "rate": 24000
        },
        "turn_detection": {
          "type": "server_vad"
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
    }
  }
}
```

---

## Verification

### ✅ What Changed
1. **Model**: `gpt-4o-realtime-preview` → `gpt-realtime`
2. **Voice location**: `session.voice` → `session.audio.output.voice`
3. **Turn detection**: `session.turn_detection` → `session.audio.input.turn_detection`
4. **Removed**: `temperature`, `max_response_output_tokens` at session level
5. **Simplified**: `turn_detection` to just `{ type: 'server_vad' }`

### ✅ Expected Behavior
- ✅ No more "Unknown parameter: 'session.voice'" errors
- ✅ Request format matches GA API specification
- ✅ Client secrets created successfully

---

## Status

✅ **FIXED**

Both GET and POST handlers now use the correct GA API request format.

---

**Date**: December 14, 2025  
**Files Modified**: `netlify/functions/realtime-voice.js`  
**Issue**: Invalid request format for GA `/v1/realtime/client_secrets` endpoint





# GA API Request Format Fix

## Problem

**Error**: `Unknown parameter: 'session.voice'`

**Root Cause**: 
- The GA endpoint `/v1/realtime/client_secrets` has a different request format than the beta endpoint
- `voice` parameter was incorrectly placed at `session.voice` level
- Model name was incorrect (`gpt-4o-realtime-preview` instead of `gpt-realtime`)
- Some parameters like `temperature`, `max_response_output_tokens`, and `turn_detection` at session level are not supported

---

## Solution

**Fixed Request Format**:
1. ✅ Removed `session.voice` (invalid parameter)
2. ✅ Voice goes in `session.audio.output.voice` (correct location)
3. ✅ Changed model from `gpt-4o-realtime-preview` to `gpt-realtime` (GA API model)
4. ✅ Moved `turn_detection` to `session.audio.input.turn_detection`
5. ✅ Removed unsupported parameters (`temperature`, `max_response_output_tokens` at session level)

---

## Changes Made

### File: `netlify/functions/realtime-voice.js`

#### Before (INCORRECT):
```javascript
{
  session: {
    type: 'realtime',
    model: 'gpt-4o-realtime-preview', // ❌ Wrong model name
    voice: voice, // ❌ Invalid parameter location
    instructions: '...',
    audio: {
      input: {
        format: { type: 'audio/pcm', rate: 24000 }
      },
      output: {
        format: { type: 'audio/pcm', rate: 24000 },
        voice: voice,
        speed: 1.0
      }
    },
    temperature: 0.6, // ❌ Not supported at session level
    max_response_output_tokens: 4096, // ❌ Not supported at session level
    turn_detection: { // ❌ Wrong location
      type: 'server_vad',
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 500,
    }
  }
}
```

#### After (CORRECT):
```javascript
{
  session: {
    type: 'realtime',
    model: 'gpt-realtime', // ✅ GA API model name
    instructions: '...',
    audio: {
      input: {
        format: { type: 'audio/pcm', rate: 24000 },
        turn_detection: { // ✅ Correct location
          type: 'server_vad'
        }
      },
      output: {
        format: { type: 'audio/pcm', rate: 24000 },
        voice: voice, // ✅ Correct location
        speed: 1.0
      }
    }
  }
}
```

---

## Key Differences

### Model Name
- ❌ **Beta**: `gpt-4o-realtime-preview`
- ✅ **GA**: `gpt-realtime`

### Voice Parameter
- ❌ **Wrong**: `session.voice`
- ✅ **Correct**: `session.audio.output.voice`

### Turn Detection
- ❌ **Wrong**: `session.turn_detection`
- ✅ **Correct**: `session.audio.input.turn_detection`

### Unsupported Parameters (GA API)
- ❌ `session.temperature` (not supported in GA format)
- ❌ `session.max_response_output_tokens` (not supported in GA format)
- ❌ `session.turn_detection.threshold` (simplified to just `type: 'server_vad'`)

---

## GA API Request Format (Correct)

```javascript
POST https://api.openai.com/v1/realtime/client_secrets
{
  "expires_after": {
    "anchor": "created_at",
    "seconds": 600
  },
  "session": {
    "type": "realtime",
    "model": "gpt-realtime",
    "instructions": "...",
    "audio": {
      "input": {
        "format": {
          "type": "audio/pcm",
          "rate": 24000
        },
        "turn_detection": {
          "type": "server_vad"
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
    }
  }
}
```

---

## Verification

### ✅ What Changed
1. **Model**: `gpt-4o-realtime-preview` → `gpt-realtime`
2. **Voice location**: `session.voice` → `session.audio.output.voice`
3. **Turn detection**: `session.turn_detection` → `session.audio.input.turn_detection`
4. **Removed**: `temperature`, `max_response_output_tokens` at session level
5. **Simplified**: `turn_detection` to just `{ type: 'server_vad' }`

### ✅ Expected Behavior
- ✅ No more "Unknown parameter: 'session.voice'" errors
- ✅ Request format matches GA API specification
- ✅ Client secrets created successfully

---

## Status

✅ **FIXED**

Both GET and POST handlers now use the correct GA API request format.

---

**Date**: December 14, 2025  
**Files Modified**: `netlify/functions/realtime-voice.js`  
**Issue**: Invalid request format for GA `/v1/realtime/client_secrets` endpoint





# GA API Request Format Fix

## Problem

**Error**: `Unknown parameter: 'session.voice'`

**Root Cause**: 
- The GA endpoint `/v1/realtime/client_secrets` has a different request format than the beta endpoint
- `voice` parameter was incorrectly placed at `session.voice` level
- Model name was incorrect (`gpt-4o-realtime-preview` instead of `gpt-realtime`)
- Some parameters like `temperature`, `max_response_output_tokens`, and `turn_detection` at session level are not supported

---

## Solution

**Fixed Request Format**:
1. ✅ Removed `session.voice` (invalid parameter)
2. ✅ Voice goes in `session.audio.output.voice` (correct location)
3. ✅ Changed model from `gpt-4o-realtime-preview` to `gpt-realtime` (GA API model)
4. ✅ Moved `turn_detection` to `session.audio.input.turn_detection`
5. ✅ Removed unsupported parameters (`temperature`, `max_response_output_tokens` at session level)

---

## Changes Made

### File: `netlify/functions/realtime-voice.js`

#### Before (INCORRECT):
```javascript
{
  session: {
    type: 'realtime',
    model: 'gpt-4o-realtime-preview', // ❌ Wrong model name
    voice: voice, // ❌ Invalid parameter location
    instructions: '...',
    audio: {
      input: {
        format: { type: 'audio/pcm', rate: 24000 }
      },
      output: {
        format: { type: 'audio/pcm', rate: 24000 },
        voice: voice,
        speed: 1.0
      }
    },
    temperature: 0.6, // ❌ Not supported at session level
    max_response_output_tokens: 4096, // ❌ Not supported at session level
    turn_detection: { // ❌ Wrong location
      type: 'server_vad',
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 500,
    }
  }
}
```

#### After (CORRECT):
```javascript
{
  session: {
    type: 'realtime',
    model: 'gpt-realtime', // ✅ GA API model name
    instructions: '...',
    audio: {
      input: {
        format: { type: 'audio/pcm', rate: 24000 },
        turn_detection: { // ✅ Correct location
          type: 'server_vad'
        }
      },
      output: {
        format: { type: 'audio/pcm', rate: 24000 },
        voice: voice, // ✅ Correct location
        speed: 1.0
      }
    }
  }
}
```

---

## Key Differences

### Model Name
- ❌ **Beta**: `gpt-4o-realtime-preview`
- ✅ **GA**: `gpt-realtime`

### Voice Parameter
- ❌ **Wrong**: `session.voice`
- ✅ **Correct**: `session.audio.output.voice`

### Turn Detection
- ❌ **Wrong**: `session.turn_detection`
- ✅ **Correct**: `session.audio.input.turn_detection`

### Unsupported Parameters (GA API)
- ❌ `session.temperature` (not supported in GA format)
- ❌ `session.max_response_output_tokens` (not supported in GA format)
- ❌ `session.turn_detection.threshold` (simplified to just `type: 'server_vad'`)

---

## GA API Request Format (Correct)

```javascript
POST https://api.openai.com/v1/realtime/client_secrets
{
  "expires_after": {
    "anchor": "created_at",
    "seconds": 600
  },
  "session": {
    "type": "realtime",
    "model": "gpt-realtime",
    "instructions": "...",
    "audio": {
      "input": {
        "format": {
          "type": "audio/pcm",
          "rate": 24000
        },
        "turn_detection": {
          "type": "server_vad"
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
    }
  }
}
```

---

## Verification

### ✅ What Changed
1. **Model**: `gpt-4o-realtime-preview` → `gpt-realtime`
2. **Voice location**: `session.voice` → `session.audio.output.voice`
3. **Turn detection**: `session.turn_detection` → `session.audio.input.turn_detection`
4. **Removed**: `temperature`, `max_response_output_tokens` at session level
5. **Simplified**: `turn_detection` to just `{ type: 'server_vad' }`

### ✅ Expected Behavior
- ✅ No more "Unknown parameter: 'session.voice'" errors
- ✅ Request format matches GA API specification
- ✅ Client secrets created successfully

---

## Status

✅ **FIXED**

Both GET and POST handlers now use the correct GA API request format.

---

**Date**: December 14, 2025  
**Files Modified**: `netlify/functions/realtime-voice.js`  
**Issue**: Invalid request format for GA `/v1/realtime/client_secrets` endpoint





# GA API Request Format Fix

## Problem

**Error**: `Unknown parameter: 'session.voice'`

**Root Cause**: 
- The GA endpoint `/v1/realtime/client_secrets` has a different request format than the beta endpoint
- `voice` parameter was incorrectly placed at `session.voice` level
- Model name was incorrect (`gpt-4o-realtime-preview` instead of `gpt-realtime`)
- Some parameters like `temperature`, `max_response_output_tokens`, and `turn_detection` at session level are not supported

---

## Solution

**Fixed Request Format**:
1. ✅ Removed `session.voice` (invalid parameter)
2. ✅ Voice goes in `session.audio.output.voice` (correct location)
3. ✅ Changed model from `gpt-4o-realtime-preview` to `gpt-realtime` (GA API model)
4. ✅ Moved `turn_detection` to `session.audio.input.turn_detection`
5. ✅ Removed unsupported parameters (`temperature`, `max_response_output_tokens` at session level)

---

## Changes Made

### File: `netlify/functions/realtime-voice.js`

#### Before (INCORRECT):
```javascript
{
  session: {
    type: 'realtime',
    model: 'gpt-4o-realtime-preview', // ❌ Wrong model name
    voice: voice, // ❌ Invalid parameter location
    instructions: '...',
    audio: {
      input: {
        format: { type: 'audio/pcm', rate: 24000 }
      },
      output: {
        format: { type: 'audio/pcm', rate: 24000 },
        voice: voice,
        speed: 1.0
      }
    },
    temperature: 0.6, // ❌ Not supported at session level
    max_response_output_tokens: 4096, // ❌ Not supported at session level
    turn_detection: { // ❌ Wrong location
      type: 'server_vad',
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 500,
    }
  }
}
```

#### After (CORRECT):
```javascript
{
  session: {
    type: 'realtime',
    model: 'gpt-realtime', // ✅ GA API model name
    instructions: '...',
    audio: {
      input: {
        format: { type: 'audio/pcm', rate: 24000 },
        turn_detection: { // ✅ Correct location
          type: 'server_vad'
        }
      },
      output: {
        format: { type: 'audio/pcm', rate: 24000 },
        voice: voice, // ✅ Correct location
        speed: 1.0
      }
    }
  }
}
```

---

## Key Differences

### Model Name
- ❌ **Beta**: `gpt-4o-realtime-preview`
- ✅ **GA**: `gpt-realtime`

### Voice Parameter
- ❌ **Wrong**: `session.voice`
- ✅ **Correct**: `session.audio.output.voice`

### Turn Detection
- ❌ **Wrong**: `session.turn_detection`
- ✅ **Correct**: `session.audio.input.turn_detection`

### Unsupported Parameters (GA API)
- ❌ `session.temperature` (not supported in GA format)
- ❌ `session.max_response_output_tokens` (not supported in GA format)
- ❌ `session.turn_detection.threshold` (simplified to just `type: 'server_vad'`)

---

## GA API Request Format (Correct)

```javascript
POST https://api.openai.com/v1/realtime/client_secrets
{
  "expires_after": {
    "anchor": "created_at",
    "seconds": 600
  },
  "session": {
    "type": "realtime",
    "model": "gpt-realtime",
    "instructions": "...",
    "audio": {
      "input": {
        "format": {
          "type": "audio/pcm",
          "rate": 24000
        },
        "turn_detection": {
          "type": "server_vad"
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
    }
  }
}
```

---

## Verification

### ✅ What Changed
1. **Model**: `gpt-4o-realtime-preview` → `gpt-realtime`
2. **Voice location**: `session.voice` → `session.audio.output.voice`
3. **Turn detection**: `session.turn_detection` → `session.audio.input.turn_detection`
4. **Removed**: `temperature`, `max_response_output_tokens` at session level
5. **Simplified**: `turn_detection` to just `{ type: 'server_vad' }`

### ✅ Expected Behavior
- ✅ No more "Unknown parameter: 'session.voice'" errors
- ✅ Request format matches GA API specification
- ✅ Client secrets created successfully

---

## Status

✅ **FIXED**

Both GET and POST handlers now use the correct GA API request format.

---

**Date**: December 14, 2025  
**Files Modified**: `netlify/functions/realtime-voice.js`  
**Issue**: Invalid request format for GA `/v1/realtime/client_secrets` endpoint





# GA API Request Format Fix

## Problem

**Error**: `Unknown parameter: 'session.voice'`

**Root Cause**: 
- The GA endpoint `/v1/realtime/client_secrets` has a different request format than the beta endpoint
- `voice` parameter was incorrectly placed at `session.voice` level
- Model name was incorrect (`gpt-4o-realtime-preview` instead of `gpt-realtime`)
- Some parameters like `temperature`, `max_response_output_tokens`, and `turn_detection` at session level are not supported

---

## Solution

**Fixed Request Format**:
1. ✅ Removed `session.voice` (invalid parameter)
2. ✅ Voice goes in `session.audio.output.voice` (correct location)
3. ✅ Changed model from `gpt-4o-realtime-preview` to `gpt-realtime` (GA API model)
4. ✅ Moved `turn_detection` to `session.audio.input.turn_detection`
5. ✅ Removed unsupported parameters (`temperature`, `max_response_output_tokens` at session level)

---

## Changes Made

### File: `netlify/functions/realtime-voice.js`

#### Before (INCORRECT):
```javascript
{
  session: {
    type: 'realtime',
    model: 'gpt-4o-realtime-preview', // ❌ Wrong model name
    voice: voice, // ❌ Invalid parameter location
    instructions: '...',
    audio: {
      input: {
        format: { type: 'audio/pcm', rate: 24000 }
      },
      output: {
        format: { type: 'audio/pcm', rate: 24000 },
        voice: voice,
        speed: 1.0
      }
    },
    temperature: 0.6, // ❌ Not supported at session level
    max_response_output_tokens: 4096, // ❌ Not supported at session level
    turn_detection: { // ❌ Wrong location
      type: 'server_vad',
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 500,
    }
  }
}
```

#### After (CORRECT):
```javascript
{
  session: {
    type: 'realtime',
    model: 'gpt-realtime', // ✅ GA API model name
    instructions: '...',
    audio: {
      input: {
        format: { type: 'audio/pcm', rate: 24000 },
        turn_detection: { // ✅ Correct location
          type: 'server_vad'
        }
      },
      output: {
        format: { type: 'audio/pcm', rate: 24000 },
        voice: voice, // ✅ Correct location
        speed: 1.0
      }
    }
  }
}
```

---

## Key Differences

### Model Name
- ❌ **Beta**: `gpt-4o-realtime-preview`
- ✅ **GA**: `gpt-realtime`

### Voice Parameter
- ❌ **Wrong**: `session.voice`
- ✅ **Correct**: `session.audio.output.voice`

### Turn Detection
- ❌ **Wrong**: `session.turn_detection`
- ✅ **Correct**: `session.audio.input.turn_detection`

### Unsupported Parameters (GA API)
- ❌ `session.temperature` (not supported in GA format)
- ❌ `session.max_response_output_tokens` (not supported in GA format)
- ❌ `session.turn_detection.threshold` (simplified to just `type: 'server_vad'`)

---

## GA API Request Format (Correct)

```javascript
POST https://api.openai.com/v1/realtime/client_secrets
{
  "expires_after": {
    "anchor": "created_at",
    "seconds": 600
  },
  "session": {
    "type": "realtime",
    "model": "gpt-realtime",
    "instructions": "...",
    "audio": {
      "input": {
        "format": {
          "type": "audio/pcm",
          "rate": 24000
        },
        "turn_detection": {
          "type": "server_vad"
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
    }
  }
}
```

---

## Verification

### ✅ What Changed
1. **Model**: `gpt-4o-realtime-preview` → `gpt-realtime`
2. **Voice location**: `session.voice` → `session.audio.output.voice`
3. **Turn detection**: `session.turn_detection` → `session.audio.input.turn_detection`
4. **Removed**: `temperature`, `max_response_output_tokens` at session level
5. **Simplified**: `turn_detection` to just `{ type: 'server_vad' }`

### ✅ Expected Behavior
- ✅ No more "Unknown parameter: 'session.voice'" errors
- ✅ Request format matches GA API specification
- ✅ Client secrets created successfully

---

## Status

✅ **FIXED**

Both GET and POST handlers now use the correct GA API request format.

---

**Date**: December 14, 2025  
**Files Modified**: `netlify/functions/realtime-voice.js`  
**Issue**: Invalid request format for GA `/v1/realtime/client_secrets` endpoint








