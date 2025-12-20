# Voice Overlap Fix + Premium Call UI Implementation

## Part A: Overlap Fix (COMPLETED)

### Root Cause Identified
**Line 471 in voice-playback-manager.js**: `source.start(0)` - All chunks started at time 0, causing simultaneous playback.

### Solution Implemented

#### A1: VoiceAudioEngine Singleton ✅
- **File**: `src/widgets/voice-audio-engine.js` (NEW)
- Single AudioContext ownership
- Proper `nextStartTime` scheduling prevents overlapping chunks
- Generation + response_id gating drops old chunks
- AnalyserNode for real-time amplitude (for UI waves)

#### A2: Generation + Response ID Gating ✅
- Tracks `activeGen` and `activeResponseId`
- `response.created` handler sets new generation/response_id
- Chunks with mismatched gen/response_id are immediately discarded

#### A3: WebSocket Handler Deduplication ✅
- Already guarded with `websocket._messageHandlerBound` flag
- Uses `websocket.onmessage = handler` (not addEventListener)

#### A4: Proper Audio Scheduling ✅
- **CRITICAL FIX**: `nextStartTime` scheduling in `pushPcmChunk()`
- Each chunk scheduled with: `source.start(actualStartTime)`
- `nextStartTime` increments: `actualStartTime + duration`
- Prevents overlapping chunk starts

#### A5: Hard Stop ✅
- `hardStop()` stops all active sources immediately
- Disconnects nodes, clears queue, resets scheduling

#### A6: Debug Logging ✅
- Engine ID tracking
- Generation/response_id logging
- Scheduled start times logged
- Chunk discard logging

## Part B: Premium Call UI (IN PROGRESS)

### B1: Visual Structure
- Premium call panel with NW logo centered
- Status line: "Connecting..." / "Listening..." / "Speaking..."
- Large End Call button (always visible)

### B2: Listening State
- Blue glow ring around NW logo
- Breathing pulse animation (scale 1.0 → 1.03 → 1.0)
- Subtle dotted ring rotation

### B3: Speaking State
- Animated audio waves using AnalyserNode
- Real-time amplitude from `voiceAudioEngine.getAmplitude()`
- SVG radial waveform rings
- Smooth 60fps animation

### B4: Transitions
- Crossfade between states
- Dark/glass background with blue glow accents
- Glass button styles

## Files Changed

1. **src/widgets/voice-audio-engine.js** (NEW)
   - Singleton audio engine with proper scheduling
   - Generation + response_id gating
   - AnalyserNode for amplitude

2. **src/widgets/noteworthy-chat.js**
   - Replaced VoicePlaybackManager with VoiceAudioEngine
   - Added `response.created` handler
   - Updated audio delta handling to use PCM Float32Array
   - Added state change callbacks

3. **index.html**
   - Updated script loading order (voice-audio-engine.js before noteworthy-chat.js)

## Next Steps

1. Add premium call UI HTML/CSS
2. Implement `updateCallUIState()` function
3. Add audio wave animation using AnalyserNode
4. Add listening pulse animation
5. Test overlap fix with rapid speech

## Testing

### Overlap Test
```javascript
// In browser console:
window.voiceTest = {
  spamPlay: () => {
    // Fire 5 play requests 200ms apart
    // Expected: Only last plays
  },
  testOverlap: () => {
    // Start first, then second immediately
    // Expected: Second cancels first
  }
};
```

### Expected Logs
- Single engine ID
- Monotonically increasing `nextStartTime` values
- Chunks discarded when gen/response_id mismatch
- Only one active playback at a time
