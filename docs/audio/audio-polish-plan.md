# UI Sound Effects Polish Plan

Audit and implementation guide for Noteworthy News V4 homepage UI sound effects.

## 1. Existing audio-related code found

| Location | Purpose |
|----------|---------|
| `v2/js/ui-sounds.js` | Web Audio synthesized tones (tap, success, error, notify, sweep, flashlight, toggle). Uses `localStorage` key `nw-ui-sounds` === `off`. |
| `v2/js/ambient-audio.js` | Background music loop (`NewsfeedGlow.mp3`) with header `#audioToggle` and CRT visualizer canvas. Opt-in via `nw-ambient-audio`. |
| `v2/js/main.js` | Calls `UISounds` for nav, newsletter, auth, strip arrows. Initializes ambient audio. |
| `v2/js/feed.js` | `UISounds` on filter chips, load more, feed retry, feed load success/error. |
| `v2/js/phone-stage.js` | `UISounds.flashlight()` for lock-screen demo toggle. |
| `v2/js/video-audio.js` | Video volume fade utilities; no UI sounds. |
| `v2/js/video-controls.js` | Custom video toolbar (not yet wired on homepage cards). |
| `v2/js/post-media.js` | Muted inline video preview; native controls; no UI sounds. |
| `v2/js/situation-monitor/SituationMonitorV2.js` | Uses `UISounds` for refresh, alerts, taps. |
| `src/widgets/noteworthy-chat.js` | Own `playCallSound()` for voice mode; internal `#audioToggle` for TTS read-aloud (not site SFX). |
| `src/widgets/voice-audio-engine.js` | Realtime voice pipeline; separate AudioContext. |
| `music-system.js`, `script.js`, legacy `index.html` | Game/legacy background music; not on V4 homepage. |
| `src/components/post-feed-enhanced.js` | Scroll sound on legacy feed (not V4). |

## 2. Where sound effects should be added

**Homepage (priority)**

- Primary CTAs (`.btn-primary`, hero follow live)
- Secondary CTAs (`.btn-outline`, ghost buttons)
- Story cards (hero, lead, dev strip) on click
- Featured hero card hover (desktop only)
- Mobile nav open/close
- Header sound toggle
- Newsletter submit success/error
- Filter chips, load more, strip carousel arrows
- AI widget launcher open/close, send, file selected, voice panel open/close
- Auth buttons (secondary click)

**Archive / story (light touch via delegation + data attributes)**

- Story card open, filters, load more, clear filters
- Follow live where present

**Situation monitor**

- Keep existing programmatic calls via `UISounds` shim mapped to new palette.

## 3. Where sound effects should NOT be added

- Every nav link hover, text link, scroll, ticker item, mouse move
- Form keystrokes, focus events, page load, feed-loaded chime
- Background music or ambient loops
- Native HTML5 video control clicks
- AI TTS playback, voice recording, voice call audio
- Decorative animations without user action

## 4. Audio engine architecture

New module: `v2/js/sfx-engine.js`

- Single shared `AudioContext` created after first trusted user gesture (click, keydown, touchstart)
- Master gain + dynamics compressor to prevent clipping
- `window.NoteworthySFX` global API: `play`, `enable`, `disable`, `toggle`, `setVolume`, `isEnabled`, `setVoiceModeActive`, `refreshVideoDuck`
- Event delegation on `document` for `[data-sfx]` clicks and `[data-sfx-hover]` / hero card hovers
- Automatic selector mapping for `.btn-primary`, story links, filter chips
- Throttle map per sound name; hover throttled separately (120ms)
- `localStorage` key `nw-sfx-enabled` (default on); migrates legacy `nw-ui-sounds` off state
- Video ducking: when any unmuted playing video detected, master gain reduced 75%
- Voice mode ducking: when AI voice mode active, UI SFX suppressed

`v2/js/ui-sounds.js` becomes a thin backward-compatible shim re-exporting mapped calls.

Header `#audioToggle` controls UI sound effects (not background music). Ambient music init removed from homepage.

## 5. Accessibility and mute strategy

- No audio before user gesture
- Persistent mute via `localStorage`
- Toggle: accessible label "Toggle site sound effects", keyboard operable
- Hover sounds disabled when `prefers-reduced-motion: reduce` or coarse pointer
- No sound-only information; errors also show visible text
- Quiet error tone; success tone restrained

## 6. Browser autoplay strategy

- `AudioContext` starts suspended; resumed only after user interaction unlock
- No sounds on `DOMContentLoaded` or feed fetch completion
- Background music autoplay removed from V4 homepage
- Video preview stays muted until user unmutes via native controls

## 7. Verification checklist

- [ ] Primary/secondary CTA clicks sound correct
- [ ] Story card click uses story-open
- [ ] Mobile menu open/close distinct
- [ ] AI widget open/close, send, file upload
- [ ] Newsletter success/error
- [ ] No audio before first interaction
- [ ] Mute toggle persists after reload
- [ ] Video playback unchanged
- [ ] AI voice and file upload unchanged
- [ ] Reduced motion disables hover sounds
- [ ] Console clean
- [ ] No U+2014 em dash in changed files
