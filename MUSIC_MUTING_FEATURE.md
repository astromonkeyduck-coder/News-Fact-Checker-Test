# Background Music Muting During Voice Calls

## Feature Overview

When a user starts a voice call with Noteworthy AI, the website's background music automatically pauses to ensure clear audio during the conversation. When the call ends, the music automatically resumes if it was playing before.

## Implementation

### When Voice Call Starts (`startVoiceMode()`)

1. **Check for Global Music System**
   - Uses `window.pauseAllMusicTracks()` if available (from `music-system.js`)
   - This function pauses all music tracks and returns the current state

2. **Fallback Method**
   - If global music system isn't available, manually pauses all music elements:
     - `backgroundMusic`
     - `backgroundMusicSecond`
     - `backgroundMusicThird`
     - `backgroundMusicLoop`

3. **Store Music State**
   - Saves which track was playing
   - Saves current playback time
   - Stores in module-level variable `musicStateBeforeCall`

### When Voice Call Ends (`stopVoiceMode()`)

1. **Check if Music Was Playing**
   - If `musicStateBeforeCall.wasPlaying === true`

2. **Restore Music**
   - **Primary Method**: Uses `window.toggleGlobalMusic()` if available
     - Only restores if music is still enabled (user hasn't manually muted)
     - Uses saved state from music system
   - **Fallback Method**: Manually restores the specific track that was playing
     - Resumes from saved playback time

3. **Clear State**
   - Sets `musicStateBeforeCall = null` after restoration

## Code Locations

### File: `src/widgets/noteworthy-chat.js`

**Variable Declaration** (Line ~35):
```javascript
let musicStateBeforeCall = null; // Store music state when voice call starts
```

**Music Pausing** (Line ~4076-4114):
- Pauses music when `startVoiceMode()` is called
- Stores state for later restoration

**Music Restoration** (Line ~4530-4555):
- Restores music when `stopVoiceMode()` is called
- Uses global music system or fallback method

**Helper Function** (Line ~4586):
```javascript
function restoreMusicManually(musicState) {
  // Manually restores music track from saved state
}
```

## User Experience

### Before Call
- Background music is playing
- User clicks voice mode button

### During Call
- ✅ Background music automatically pauses
- ✅ Voice call audio is clear
- ✅ No audio conflicts

### After Call
- ✅ Background music automatically resumes
- ✅ Resumes from where it left off
- ✅ Only if music was enabled (respects user's mute preference)

## Edge Cases Handled

1. **Music System Not Available**
   - Falls back to manual pause/restore
   - Works even if `music-system.js` isn't loaded

2. **User Muted Music Before Call**
   - Music won't restore if user manually muted it
   - Respects user preference

3. **Multiple Music Tracks**
   - Pauses all tracks (only one should be playing)
   - Restores the correct track that was playing

4. **Music Already Paused**
   - No state stored if music wasn't playing
   - Nothing happens on call end (no unwanted music start)

## Testing Checklist

- [ ] Start voice call while music is playing → Music pauses
- [ ] End voice call → Music resumes from same position
- [ ] Start voice call while music is muted → No music starts on end
- [ ] Start voice call while music is paused → No music starts on end
- [ ] Multiple calls in sequence → Music state handled correctly
- [ ] Music system not loaded → Fallback method works

## Integration Points

### Global Music System (`music-system.js`)
- `window.pauseAllMusicTracks()` - Pauses all tracks, returns state
- `window.toggleGlobalMusic()` - Toggles music on/off, restores from saved state
- `window.getGlobalMusicState()` - Returns current music state

### Music Elements (in `index.html`)
- `#backgroundMusic`
- `#backgroundMusicSecond`
- `#backgroundMusicThird`
- `#backgroundMusicLoop`

---

**Status**: ✅ Implemented and Ready
**Date**: 2025-12-14
