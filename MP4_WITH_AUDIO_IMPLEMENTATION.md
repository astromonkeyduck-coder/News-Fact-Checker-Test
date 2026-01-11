# MP4 Video with Audio Implementation

## Overview
This implementation adds MP4 video generation with mixed audio:
- **TTS Audio**: AI-generated speech saying the earthquake text (magnitude, location, timestamp)
- **Background Music**: Part of `datacenter.wav` mixed in
- **Format**: MP4 for X/Twitter Player Cards (with audio)
- **Fallback**: GIF still generated for email compatibility

## Implementation Status

### ✅ Completed:
1. TTS audio generation using ElevenLabs API
2. Audio mixing structure (loads datacenter.wav)
3. MP4 encoding function structure
4. Dual format support (MP4 + GIF)

### ⚠️ TODO:
1. **Add @ffmpeg/ffmpeg library** for MP4 encoding:
   ```bash
   npm install @ffmpeg/ffmpeg @ffmpeg/util
   ```

2. **Implement actual MP4 encoding** in `framesToMP4WithAudio()`:
   - Convert PNG frames to video
   - Add audio track
   - Encode as MP4

3. **Implement audio mixing** in `mixAudioWithDatacenter()`:
   - Use audio processing library (node-wav, audiomixer, or ffmpeg)
   - Mix TTS (foreground) with datacenter.wav (background, lower volume)
   - Match video duration

## Text on Video
The TTS will say:
```
"BREAKING: M{magnitude} Earthquake Near {location}. {timestamp}"
```

Example:
```
"BREAKING: M4.5 Earthquake Near San Francisco, California. 11:00:00 PST"
```

## Audio Mixing
- **TTS**: Foreground, full volume
- **datacenter.wav**: Background, ~30% volume, looped to match video duration

## Next Steps

1. **Install dependencies**:
   ```bash
   npm install @ffmpeg/ffmpeg @ffmpeg/util
   ```

2. **Complete MP4 encoding** (see TODO in `framesToMP4WithAudio()`)

3. **Complete audio mixing** (see TODO in `mixAudioWithDatacenter()`)

4. **Test**:
   - Generate video with audio
   - Verify MP4 plays with sound
   - Check X Player Card preview

## Environment Variables Required
- `ELEVENLABS_API_KEY`: For TTS generation

## File Locations
- `datacenter.wav`: Should be in project root or `/tmp/` for Netlify Functions
