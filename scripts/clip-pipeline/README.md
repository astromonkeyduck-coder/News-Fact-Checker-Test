# Live Clip Pipeline

**Rights-cleared sources only.** This toolchain creates short X-ready clips from authorized direct media feeds or local files you already have rights to use.

## Legal guardrails

- **Do not** use YouTube watch pages as clip sources. The YouTube Data API is **metadata-only** (event discovery).
- **Do not** scrape, rip, or bypass platform restrictions on arbitrary streams.
- Government/public-domain events may still contain third-party music, graphics, or broadcaster-owned coverage — **human review required**.
- Fair use is **not** a default automation strategy.
- Every job must document `rights_basis` before clipping or uploading.
- **Human approval is required** before posting to X.

## Prerequisites

- Node 20+
- `npm install` at repo root (includes `ffmpeg-static`; adds `ffprobe-static`)
- Optional: `YT_API_KEY` for metadata, `X_USER_ACCESS_TOKEN` + `X_UPLOAD_ENABLED=true` for X upload

## Quick start (local file clip)

```bash
# 1. Create a job
npm run clip:job:create -- \
  --title "WH Press Briefing excerpt" \
  --source-type local_file \
  --local-file data/clips/raw/briefing.mkv \
  --rights-basis "Official White House government-produced feed" \
  --source-attribution "@WhiteHouse"

# 2. Cut and transcode (use job id from step 1)
npm run clip:make -- data/clips/raw/briefing.mkv 00:17:12 00:17:45 \
  data/clips/output/clip.mp4 --job-id YOUR_JOB_ID

# 3. Review (CLI)
npm run clip:review:cli -- show YOUR_JOB_ID
npm run clip:review:cli -- approve YOUR_JOB_ID --post-text "WATCH: President remarks on..."

# 4. Review (browser)
npm run clip:review
# Open http://127.0.0.1:8791/

# 5. Export or upload
npm run clip:review:cli -- export YOUR_JOB_ID ~/Desktop/
# or (if configured):
npm run clip:upload -- --job-id YOUR_JOB_ID --post-text "WATCH: ..."
```

## Live recording (rights-cleared HLS/RTMP)

```bash
npm run clip:record -- "https://rights-cleared-feed.example/live.m3u8" data/clips/raw/event.mkv --job-id YOUR_JOB_ID
```

Use `--segment` for hourly MKV segments. Recording logs go to `{output}.record.log`.

## Save last 30 seconds (rolling buffer)

**YouTube watch pages cannot be recorded directly.** Typical breaking-news workflow:

1. Watch the YouTube livestream for discovery (metadata via `clip:metadata`).
2. In parallel, buffer a **rights-cleared feed** (White House HLS, pool feed, your encoder, C-SPAN direct stream, etc.).
3. When something clip-worthy happens, save the last 30 seconds instantly.

```bash
# Terminal 1 — start rolling buffer (keeps ~90s of 5s segments)
npm run clip:record:buffer -- "https://RIGHTS_CLEARED_HLS_URL"

# Terminal 2 — when you want the last 30 seconds
npm run clip:save-last -- --seconds 30 --rights-basis "Official government feed"

# Check buffer status
npm run clip:record:buffer -- --status

# Stop buffer
npm run clip:record:buffer -- --stop
```

**Alternative:** If you record your screen/window with OBS to a local file:

```bash
npm run clip:save-last -- --from /path/to/obs-recording.mkv --seconds 30 --rights-basis "Manual review required"
```

You are responsible for rights on any capture method.

## YouTube — save last 30s with a button

Server-side tools **cannot** record YouTube URLs. For a **click-to-save button on YouTube watch pages**, install the browser userscript:

1. Install [Tampermonkey](https://www.tampermonkey.net/)
2. Add script from [`browser/youtube-save-last.user.js`](browser/youtube-save-last.user.js)
3. Watch any YouTube video → click **Save last 30s** (bottom-right)
4. Convert download to MP4: `npm run clip:convert-webm -- ~/Downloads/youtube-last-30s-....webm --rights-basis "..."`

See [`browser/README.md`](browser/README.md) for details and limitations (DRM, ToS, copyright).

## YouTube metadata (metadata only)

```bash
npm run clip:metadata -- VIDEO_ID
npm run clip:job:create -- --title "..." --source-type youtube_metadata_only \
  --youtube-video-id VIDEO_ID --fetch-youtube --rights-basis "..." ...
```

## Environment variables

| Variable | Purpose |
|----------|---------|
| `YT_API_KEY` | YouTube Data API (metadata only) |
| `X_USER_ACCESS_TOKEN` | OAuth 2.0 user token for media upload + post |
| `X_UPLOAD_ENABLED` | Set `true` to enable X upload |
| `CLIP_DRY_RUN` | Set `true` for dry-run mode |
| `CLIP_REVIEW_PORT` | Review server port (default 8791) |
| `CLIP_REVIEW_TOKEN` | Optional token for review server |
| `FFMPEG_PATH` / `FFPROBE_PATH` | Override bundled binaries |

## Dry-run mode

```bash
CLIP_DRY_RUN=true npm run clip:make -- input.mkv 0:00:05 0:00:10 out.mp4 --rights-basis "Owned stream"
```

Prints FFmpeg commands without executing destructive actions.

## Retract uploaded clip

```bash
npm run clip:retract -- --job-id YOUR_JOB_ID
```

## Folder layout

```
data/clip-jobs/       Job JSON + audit.jsonl
data/clips/raw/       Recordings (MKV)
data/clips/output/    X-ready MP4s
data/clips/thumbs/    JPG thumbnails
data/clips/probe/     ffprobe validation JSON
```

## npm scripts

| Script | Command |
|--------|---------|
| `clip:metadata` | YouTube metadata lookup |
| `clip:job:create` | Create clip job |
| `clip:record` | Record HLS/RTMP |
| `clip:record:buffer` | Rolling buffer for save-last |
| `clip:save-last` | Save last N seconds (default 30) |
| `clip:make` | Cut + transcode + thumb + probe |
| `clip:probe` | Standalone ffprobe |
| `clip:review` | Local review server |
| `clip:review:cli` | CLI review commands |
| `clip:upload` | Upload approved clip to X |
| `clip:retract` | Delete X post + mark retracted |
| `test:clip-pipeline` | Run manual test suite |

## X output specs

- H.264, AAC, MP4, yuv420p, +faststart
- 30 fps, max width 1280px, ~3500k video, 128k audio @ 48kHz
- Default max clip length: 2 minutes (`--max-duration` to override)

## Isolation from production site

This pipeline is **local-only**. It does not modify Netlify functions, public routes, or the `import-x-posts` cron.
