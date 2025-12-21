# Voice Overlap Fix + Premium Call UI - Implementation Plan

## Root Cause Analysis

**Primary Issue**: Audio chunks are being scheduled with `source.start(0)` or immediate starts, causing multiple chunks to play simultaneously.

**Secondary Issues**:
- No response_id tracking (old chunks from previous responses can still play)
- Multiple audio pipelines possible
- No proper scheduling with nextStartTime

## Part A: Overlap Fix (CRITICAL)

### A1: Replace VoicePlaybackManager with VoiceAudioEngine ✅
- File: `src/widgets/voice-audio-engine.js` (already exists with proper scheduling)
- Single AudioContext ownership
- Proper `nextStartTime` scheduling prevents overlapping chunks
- Generation + response_id gating drops old chunks
- AnalyserNode for real-time amplitude (for UI waves)

### A2: Add response.created Handler
- Track `activeResponseId` and increment `activeGen`
- Call `voiceAudioEngine.reset(activeGen, activeResponseId)` on new response

### A3: Update Audio Delta Handler
- Convert base64 to Float32Array PCM
- Call `voiceAudioEngine.pushPcmChunk(pcmFloat32Array, activeGen, activeResponseId)`
- Engine handles scheduling automatically

### A4: WebSocket Handler Deduplication ✅
- Already guarded with `websocket._messageHandlerBound` flag
- Uses `websocket.onmessage = handler` (not addEventListener)

### A5: Hard Stop ✅
- `voiceAudioEngine.hardStop()` stops all active sources immediately
- Disconnects nodes, clears queue, resets scheduling

## Part B: Premium Call UI

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
- Crossfade between Listening and Speaking states
- Keep background consistent with Noteworthy style

## Implementation Steps

1. ✅ Replace VoicePlaybackManager initialization with VoiceAudioEngine
2. ✅ Add response.created handler
3. ✅ Update audio delta handler
4. ✅ Build premium UI components
5. ✅ Add audio wave animation
6. ✅ Test and verify
