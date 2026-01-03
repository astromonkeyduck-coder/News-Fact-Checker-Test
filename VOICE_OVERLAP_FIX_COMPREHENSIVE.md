# Voice Overlap Fix - Comprehensive Implementation

## Problem Analysis

**Found Multiple Audio Playback Sources:**
1. ✅ **VoicePlaybackManager** (now singleton) - PRIMARY PATH
2. ❌ **speechSynthesis.speak()** - Multiple direct calls (lines 3383, 3394, 3409)
3. ❌ **AudioBufferSourceNode.start()** - Direct calls in compiled.js (line 1681)
4. ❌ **Old queue system** - `audioPlayQueue` in compiled.js (lines 1582-1593)
5. ❌ **Multiple WebSocket handlers** - Could create duplicate listeners

## Solution Implemented

### 1. Singleton VoicePlaybackManager ✅

**File:** `src/widgets/voice-playback-manager.js`

- Converted to singleton pattern
- Global instance: `window.voiceManager`
- Only ONE instance exists globally
- All audio MUST go through this singleton

**Key Changes:**
- Added `getVoiceManager()` function
- Exported `voiceManager` singleton instance
- Added `initialize(audioContext)` method for reinitialization

### 2. Global Audio Guards ✅

**File:** `src/widgets/noteworthy-chat.js`

**AudioBufferSourceNode.start() Override:**
- Blocks ALL direct `source.start()` calls
- Only allows playback when `window._allowAudioPlayback = true`
- Flag is set ONLY in `voiceManager._playChunk()` and cleared immediately
- Any other call-site is BLOCKED

**speechSynthesis.speak() Override:**
- Blocks ALL TTS during voice mode
- Aggressive cancellation (quadruple cancel)
- Periodic checks to ensure TTS stays blocked

### 3. Old Queue System Disabled ✅

**File:** `src/widgets/noteworthy-chat-compiled.js`

- `processAudioQueueCompiled()` - Now does nothing (blocked)
- `playAudioChunkCompiled()` - Now does nothing (blocked)
- `playAudioChunk()` - Now does nothing (blocked)
- Old `audioPlayQueue` system completely disabled

**Note:** This file should NOT be loaded. If it is, it will error and redirect to singleton.

### 4. Single WebSocket Handler ✅

**File:** `src/widgets/noteworthy-chat.js`

- Added guard to prevent duplicate message handlers
- `websocket._messageHandlerBound` flag prevents duplicates
- Only ONE handler is ever attached

### 5. Generation-Based Cancellation ✅

**File:** `src/widgets/voice-playback-manager.js`

- `playbackGeneration` increments on each new play/stop
- `currentGeneration` tracks active playback
- All async operations check `_isCancelled(generation)`
- Old chunks are automatically discarded

### 6. Hard Stop Implementation ✅

**File:** `src/widgets/voice-playback-manager.js`

- `_hardStopAllSources()` stops ALL sources immediately
- Calls `source.stop(0)` (stop now)
- Disconnects all sources
- Removes all event listeners
- Clears active sources array

### 7. Comprehensive Debug Logging ✅

**Enabled by default:** `DEBUG_VOICE = true`

**Logs:**
- Every `play()` call with generation ID and call stack
- Every `stop()` call with before/after state
- Every chunk received with generation check
- Every chunk discarded (old generation)
- Every audio start/end event
- State transitions
- Generation mismatches

**Console Commands:**
```javascript
window.voiceTest.spamPlay()      // Test overlap prevention
window.voiceTest.stopSpam()      // Test stop during playback
window.voiceTest.getState()      // Check manager state
window.voiceTest.testOverlap()   // Test cancellation
```

### 8. Trigger Discipline ✅

**File:** `src/widgets/noteworthy-chat.js`

- Audio playback ONLY triggered on `response.output_audio.delta`
- First chunk: calls `voiceManager.play()` (stops old, starts new)
- Subsequent chunks: calls `voiceManager.addChunks()` (only if generation matches)
- `response.done` does NOT trigger playback (only marks completion)
- `response.output_audio.done` does NOT trigger playback (only marks server completion)

## Files Changed

1. **src/widgets/voice-playback-manager.js**
   - Converted to singleton
   - Added `initialize()` method
   - Enhanced debug logging
   - Added call stack traces

2. **src/widgets/noteworthy-chat.js**
   - Uses `window.voiceManager` singleton
   - Added `AudioBufferSourceNode.start()` override
   - Enhanced `speechSynthesis.speak()` override
   - Added WebSocket handler guard
   - Enhanced debug logging
   - Removed old `audioQueue` variable
   - Added acceptance test functions

3. **src/widgets/noteworthy-chat-compiled.js**
   - Disabled old queue system
   - All old functions now do nothing (blocked)
   - Added error messages directing to singleton

## Debug Log Sample (Expected)

```
[Voice Mode] ✅ Using SINGLETON VoicePlaybackManager (only ONE instance globally)
[Voice Mode] 📊 Singleton state: { state: 'idle', generation: null }
[Voice Mode] ✅ CASE MATCHED: response.output_audio.delta (VoicePlaybackManager)
[Voice Mode] 📢 New response started (first audio chunk)
[Voice Mode] 🛑 Stopping previous playback for new response
[VoicePlaybackManager] 🛑 STOP requested, current generation: 1, state: playing
[VoicePlaybackManager] 🛑 Hard-stopping 2 audio source(s)
[VoicePlaybackManager] ✅ All 2 source(s) hard-stopped
[VoicePlaybackManager] ✅ STOP complete, old gen: 1 → new playbackGen: 2, state: playing → idle
[Voice Mode] ▶️ CALLING voiceManager.play() - SINGLE PLAYBACK PATH
[VoicePlaybackManager] ▶️ PLAY requested, generation: 2, chunks: 1
[VoicePlaybackManager] 📊 State before play: idle, currentGen: null, playbackGen: 2
[VoicePlaybackManager] 🔄 State: idle → loading (generation 2)
[VoicePlaybackManager] 🔄 State: loading → playing (generation 2)
[VoicePlaybackManager] 🔊 Playing chunk (gen 2), duration: 0.125s
[Voice Mode] 📌 Started new playback, generation ID: 2
[Voice Mode] 📦 Adding chunk to generation 2 (current gen in manager: 2)
[VoicePlaybackManager] 📦 addChunks() called, requested gen: 2, current gen: 2, state: playing, chunks: 1
[VoicePlaybackManager] ✅ Chunk added successfully to generation 2
[VoicePlaybackManager] ✅ Chunk finished (gen 2), duration: 0.125s
[VoicePlaybackManager] ✅ Generation 2 completed
[VoicePlaybackManager] 🔄 State: playing → idle (playback complete)
```

## Acceptance Tests

Run in browser console:

```javascript
// Test 1: Spam play requests
window.voiceTest.spamPlay();
// Expected: Only last request plays, others are cancelled

// Test 2: Stop during playback
window.voiceTest.stopSpam();
// Expected: Immediate silence

// Test 3: Overlap prevention
window.voiceTest.testOverlap();
// Expected: Second playback cancels first

// Test 4: Check state
window.voiceTest.getState();
// Expected: Shows current state and generation
```

## Critical Guarantees

1. ✅ **Only ONE audio playback at any moment**
2. ✅ **Only voiceManager singleton can play audio**
3. ✅ **All direct audio calls are blocked**
4. ✅ **Old generation chunks are discarded**
5. ✅ **Hard stop kills ALL sources immediately**
6. ✅ **Only ONE WebSocket message handler**
7. ✅ **Playback only on audio chunks, not on final messages**

## Verification Checklist

- [x] Singleton pattern implemented
- [x] Global audio guards active
- [x] Old queue system disabled
- [x] WebSocket handler deduplication
- [x] Generation-based cancellation
- [x] Hard stop implementation
- [x] Debug logging comprehensive
- [x] Acceptance tests available
- [x] Call stack traces enabled
- [x] Old compiled.js functions blocked

## Next Steps

1. **Test in browser** - Check console logs for overlap
2. **Run acceptance tests** - Verify spam/stop/overlap prevention
3. **Monitor logs** - Look for "BLOCKED" messages (indicates bypass attempts)
4. **Check for old file loading** - Ensure compiled.js is NOT being used

## If Overlap Still Occurs

Check console for:
1. `BLOCKED AudioBufferSourceNode.start()` - Good! Means guards are working
2. `BLOCKED speechSynthesis.speak()` - Good! Means TTS is blocked
3. `COMPILED FILE DETECTED` - Bad! Means wrong file is loaded
4. `voiceManager not available` - Bad! Means singleton not initialized
5. Multiple `PLAY requested` without `STOP` - Bad! Means multiple play calls






