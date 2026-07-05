# API Keys & Environment Variables

## Breaking news cards (posts feed)

**No keys needed.** The `posts-read` function uses **Netlify Blob Storage**. When you deploy to Netlify or run `netlify dev`, Netlify sets these for you:

- `NETLIFY_SITE_ID` – set automatically by Netlify  
- `NETLIFY_BLOB_READ_WRITE_TOKEN` – set automatically by Netlify  

You don’t add these yourself unless you’re doing something custom.

---

## Optional keys (by feature)

| Variable | Used for | Where to get it |
|----------|----------|------------------|
| **RESEND_API_KEY** | Sending email (newsletter, tips, alerts, notifications) | [resend.com](https://resend.com) → API Keys |
| **RESEND_FROM_EMAIL** | Sender address (optional; has defaults) | e.g. `Noteworthy News <hello@yourdomain.com>` |
| **OPENAI_API_KEY** | AI image generation, voice summary | [platform.openai.com](https://platform.openai.com/api-keys) |
| **ELEVENLABS_API_KEY** | Earthquake / voice video generation | [elevenlabs.io](https://elevenlabs.io) |
| **SUPABASE_URL** | Live events ingest, some scripts | Supabase project → Settings → API |
| **SUPABASE_SERVICE_ROLE_KEY** | Same as above (server-only) | Supabase project → Settings → API |
| **ADMIN_ANALYTICS_TOKEN** | Protect admin/analytics endpoints (you choose the value) | Any secret string you create |
| **NEWSLETTER_KEY** | Protect newsletter admin (you choose the value) | Any secret string you create |
| **CAMS_TOKEN** | Optional: protect Live Cams API from abuse (you choose the value) | Any secret string; if unset, cams endpoints still work in dev |
| **WINDY_API_KEY** | Optional: more global webcams in Live Cams (Windy API) | [windy.com](https://www.windy.com) API |
| **NY511_API_KEY** | Optional: New York state traffic cams in Live Cams | NY511 developer program |

### Live Clip Pipeline (local scripts)

| Variable | Used for | Where to get it |
|----------|----------|-----------------|
| **YT_API_KEY** | YouTube Data API - **metadata only** (event discovery) | [Google Cloud Console](https://console.cloud.google.com/) → APIs → YouTube Data API v3 |
| **X_USER_ACCESS_TOKEN** | Optional: upload approved clips to X (OAuth 2.0 user context) | X Developer Portal → user access token with `tweet.write` + media upload scopes |
| **X_UPLOAD_ENABLED** | Set `true` to enable X upload from clip pipeline | Your choice (`true` / unset) |
| **CLIP_DRY_RUN** | Print FFmpeg/API commands without executing | Set `true` for dry-run |
| **CLIP_REVIEW_PORT** | Local review server port (default 8791) | Optional |
| **CLIP_REVIEW_TOKEN** | Optional auth token for local review server | Any secret string you create |
| **FFMPEG_PATH** / **FFPROBE_PATH** | Override bundled ffmpeg/ffprobe binaries | Optional |
| **OPENAI_API_KEY** | Transcribe local MP4/audio via `npm run clip:transcribe` (Whisper) | [platform.openai.com](https://platform.openai.com/api-keys) |

See `scripts/clip-pipeline/README.md` for full workflow. **Rights-cleared sources only** - do not use YouTube watch URLs as clip media sources.

---

## Video Watermarker (admin tool)

Lives in the admin app at `/admin/watermarker` (also reachable via `/admin/#watermarker`). It lets an authorized admin paste an authorized Facebook video link (compliant Meta Graph API retrieval) or upload a video manually, then exports a Noteworthy News watermarked MP4.

**Authentication:** uses the existing Auth0 admin login + server-side `requireAdminAuth`. No new auth - admins are whoever passes `ADMIN_EMAILS` / the admin role (same as the rest of `/admin`).

**Storage:** uses the existing **Cloudflare R2** variables for temporary originals and finished videos, and **Netlify Blobs** (`watermark-jobs` store) for job state.

| Variable | Used for | Notes |
|----------|----------|-------|
| **R2_ACCESS_KEY_ID** | Temp video storage (uploads + outputs) | Required for uploads/downloads; reuses the Clemens R2 bucket |
| **R2_SECRET_ACCESS_KEY** | Same | |
| **R2_BUCKET** | Same | |
| **R2_ENDPOINT** | Same | R2 S3-compatible endpoint URL |
| **META_ACCESS_TOKEN** | Optional: compliant Facebook video retrieval via Graph API `source` | Only works for videos the token may access; without it, the tool always falls back to manual upload |
| **META_APP_ID** | Optional: Meta app identity (future token refresh) | |
| **META_APP_SECRET** | Optional: Meta app secret (server-only) | Never sent to the client |
| **META_GRAPH_VERSION** | Optional: Graph API version | Defaults to `v19.0` |
| **MAX_VIDEO_MB** | Max accepted video size | Default `150` (keep well under Lambda's ~512MB `/tmp`, which holds source + output) |
| **MAX_VIDEO_DURATION_SECONDS** | Max accepted video duration | Default `600` |
| **TEMP_VIDEO_TTL_MINUTES** | How long finished videos/jobs are retained | Default `60`; expired outputs are deleted opportunistically |

### Required vs optional (production)

- **Required:** `AUTH0_DOMAIN` (admin auth), `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT` (storage). `NETLIFY_SITE_ID` + `NETLIFY_BLOB_READ_WRITE_TOKEN` are set by Netlify automatically (job state).
- **Recommended:** `ADMIN_EMAILS` (comma-separated admin allowlist).
- **Optional:** `META_ACCESS_TOKEN` (+ `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_VERSION`) to enable the compliant Facebook fetch path; `MAX_VIDEO_MB`, `MAX_VIDEO_DURATION_SECONDS`, `TEMP_VIDEO_TTL_MINUTES` to override defaults.
- If `R2_*` is missing, the tool returns a clear 503 ("Video storage is not configured…") instead of failing silently.

### Required R2 (S3) CORS settings

The browser uploads directly to R2 via a presigned `PUT` and plays/downloads the result via a presigned `GET`, so the bucket must allow your admin origin. In the R2 bucket → Settings → CORS policy:

```json
[
  {
    "AllowedOrigins": ["https://noteworthynews.co", "http://localhost:8888"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Replace the origins with your production domain(s) and dev origin. `content-type` must be allowed because the presigned PUT binds the upload's `Content-Type`.

### Known limitations

- **Arbitrary Facebook links usually cannot be fetched.** The only compliant automated path is the Meta Graph API `source` field, which returns media only for videos the configured token may access (typically videos on Pages/accounts you administer). For most pasted links the tool will (correctly) show the manual-upload fallback - **manual upload is the reliable path.**
- **Size/length caps exist for serverless reasons.** Defaults: 150 MB / 10 minutes. The processor runs as a Netlify background function (~15 min max) and Lambda gives ~512 MB of `/tmp` (must hold source + output). Very long/large videos are rejected with a clear message rather than timing out cryptically.
- **`ffprobe-static` is not bundled.** It ships ~300 MB of multi-platform binaries that would exceed Netlify's function-size limits. Dimensions/duration are read from `ffmpeg` itself, so only the single `ffmpeg-static` binary (~44 MB) is bundled.
- **No automatic background sweeper.** Expired outputs are cleaned opportunistically when a job is polled after its TTL, and manual originals are deleted right after processing. For a guaranteed backstop, add an R2 lifecycle rule (below).
- **Rotation metadata:** watermark *placement* uses ffmpeg overlay expressions (robust to rotation); font *size* is derived from probed width, which is correct for standard exports.

### Recommended R2 lifecycle rule (backstop cleanup)

Add a lifecycle rule on the bucket to auto-expire temp objects after 1 day, covering any orphans:

- Prefix `watermark-uploads/` → expire after 1 day
- Prefix `watermark-outputs/` → expire after 1 day

### Local test

```bash
npm install            # deps already present: ffmpeg-static, @resvg/resvg-js, sharp, @aws-sdk/*, @netlify/blobs
npm run dev            # netlify dev on http://localhost:8888
```

Then sign into `/admin`, open **Video Watermarker**, and upload a vertical (1080x1920), horizontal (1920x1080), and square video. Confirm: watermark scales per aspect and is readable, audio is intact, second line reads exactly `VIDEO: @username/FB`, and the download is an MP4.

### Production deploy checklist

1. Set required env vars in Netlify → Site settings → Environment variables: `AUTH0_DOMAIN`, `ADMIN_EMAILS`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT` (+ `META_ACCESS_TOKEN` if using the Facebook path).
2. Apply the R2 CORS policy above with your production origin.
3. (Recommended) Add the R2 lifecycle expiry rules above.
4. Deploy. Confirm the `watermark-process-background` function bundled successfully (it uses the `zisi` bundler + `ffmpeg-static`).
5. Sign into `/admin` as an allowlisted admin → **Video Watermarker**.
6. Manual upload test: vertical + horizontal + square → each completes, plays in the preview, downloads as MP4 with intact audio and a readable watermark.
7. Facebook test: paste a link the token cannot access → confirm the manual-upload fallback message appears (no crash, no false claim of download).
8. Abuse test: oversized/over-length/non-video file → confirm a clear rejection.

**Facebook retrieval is intentionally limited.** We never scrape Facebook or bypass login/DRM/anti-bot controls. The only automated path is the official Graph API `source` field for videos the configured token is permitted to access. If retrieval isn't permitted, the UI shows: *"Facebook does not allow this video to be fetched automatically. Upload the video file manually instead."*

---

## Follow Live Story (web push + iOS Live Activities)

Powers the "Follow Live" feature: editors create live stories in `/admin/#live-stories` and post timeline updates; followers get web push (PWA) and, if they install the iOS companion app, native Live Activities.

**Storage:** Supabase (migrations `005_create_live_stories.sql`, `006_create_ios_devices.sql`, `007_device_linked_profile.sql`, `008_ios_push.sql`) + the existing Netlify Blobs `push-subscriptions` store. Apply all migrations before use. Migration `008` is additive (adds `apns_token` + notification-preference columns to `live_story_devices`); no data migration required.

### Web push (Phase 1)

| Variable | Used for | Notes |
|----------|----------|-------|
| **VAPID_PUBLIC_KEY** | Web Push (VAPID) public key | Generate once: `npx web-push generate-vapid-keys` |
| **VAPID_PRIVATE_KEY** | Web Push (VAPID) private key (server-only) | Same command; never expose to the client |
| **VAPID_SUBJECT** | VAPID contact | Optional; defaults to `mailto:richard@noteworthynews.co` |
| **SUPABASE_URL**, **SUPABASE_SERVICE_ROLE_KEY** | Story/follow/device tables | Already used elsewhere |

### iOS Live Activities + standard push (Phase 2 / 2B / 2C - APNs)

Used by `netlify/functions/lib/apnsClient.js` with:
- `lib/liveActivityNotify.js` - update/end/push-to-start Live Activities (2A/2B), push type `liveactivity`, topic `<bundle>.push-type.liveactivity`.
- `lib/standardPushNotify.js` - standard alert notifications to the native app (2C), push type `alert`, topic `<bundle>`.

APNs uses HTTP/2 (Node's built-in `http2`) with a token-based `.p8` key signed via `jose` (ES256). No new npm dependency. Both push types share the same `.p8` key and env vars below.

| Variable | Used for | Where to get it |
|----------|----------|-----------------|
| **APNS_KEY_P8_BASE64** | APNs auth key (.p8), **base64-encoded** | Apple Developer → Certificates, IDs & Profiles → Keys → new key with "Apple Push Notifications service (APNs)". Encode: `base64 -i AuthKey_XXXX.p8` |
| **APNS_KEY_ID** | 10-char key ID for that key | Shown when you create the key |
| **APNS_TEAM_ID** | 10-char Apple Team ID | Apple Developer → Membership |
| **APNS_BUNDLE_ID** | App bundle id (topic base) | e.g. `co.noteworthynews.live` (must match the iOS app) |
| **APNS_DEFAULT_ENVIRONMENT** | `sandbox` or `production` fallback | Per-device env is stored at pairing; this is the default. Use `sandbox` only for local **development/debug device builds**. **TestFlight and App Store builds use `production`** APNs. |
| **APNS_KEY_STORE** | Optional: set to `blob` when the `.p8` is stored in Netlify Blobs instead of env | See **Netlify 4KB function env limit** below. Requires one-time `node scripts/upload-apns-key-to-blob.js`. |

> **Var name note:** the code reads **`APNS_KEY_P8_BASE64`** (base64 of the `.p8`). `APNS_KEY_P8` is a legacy alias - **do not set both** (wastes ~600 bytes toward Netlify's 4KB function env cap). The key value may also be stored as raw PEM (not base64); the client tolerates both. With **`APNS_KEY_STORE=blob`**, delete both env key vars after uploading via `scripts/upload-apns-key-to-blob.js`.

If the APNS_* vars are absent, **both** Live Activity and standard-push dispatch are a **no-op** - web push still works and the editorial write never fails. See `ios/NoteworthyLive/README.md` for the app/Xcode setup and `IOS_NOTIFICATIONS_TESTING.md` for real-device test steps.

**Verify the config without exposing secrets** (Milestone 2B/2C): signed into `/admin`, call the admin-authenticated diagnostic:

```bash
# Returns { configured, environment, bundleId, topic, liveActivityTopic, alertTopic, keyIdLast4, teamIdSet, keyP8Set }
curl -s "https://noteworthynews.co/.netlify/functions/admin-live-stories?action=apnsStatus" \
  -H "Authorization: Bearer <admin Auth0 token>"
```

It never returns the `.p8` key or a signed JWT - only whether each var is present and the derived topics/environment. `configured:false` means at least one of `APNS_KEY_P8_BASE64 / APNS_KEY_ID / APNS_TEAM_ID / APNS_BUNDLE_ID` is missing. `liveActivityTopic` = `<bundle>.push-type.liveactivity`; `alertTopic` = `<bundle>`.

**Sandbox vs production:** APNs picks the host per device from `live_story_devices.apns_environment` (set at pairing). Debug builds run on a real device register as `sandbox`; **TestFlight/App Store builds register as `production`**. A token created by a sandbox build will 400/`BadDeviceToken` on the production host and vice-versa - if a device "won't update," confirm its build type matches the environment. `APNS_DEFAULT_ENVIRONMENT` is only the fallback when a device has no stored environment.

### Native iOS app content API (no keys required)

The native iOS reader app consumes two **read-only, public** endpoints that normalize the existing content into a stable mobile contract:

- `mobile-feed` (alias `/api/mobile/feed`) - normalized post feed (`{ items, nextCursor, total }`)
- `mobile-story` (alias `/api/mobile/story?id=`) - single normalized post (`{ story }`)

These reuse the existing `x-posts` Netlify Blobs store (via `lib/postStore`) and the shared `lib/postNormalize` module. **No new environment variables are needed.** Live stories continue to use the existing `live-stories` endpoint. Full app setup: see `IOS_APP_SETUP.md`.

---

## Live Cams (Situation Monitor)

**You do not need any API keys** for the main camera list. These work without keys:

- **FL511** (Florida), **Caltrans** (California), **TxDOT** (Texas), **WYDOT** (Wyoming), plus a small curated set (EarthCam, etc.).

**Why only ~21 cameras sometimes?**

- If the app thinks the Netlify cams API is unavailable, it uses “fallback” mode and fetches **directly from your browser** (FL511, Caltrans, TxDOT, WYDOT). Some of those APIs (e.g. FL511, Caltrans) can be blocked by CORS when called from the browser, so you may only get **TxDOT + WYDOT + curated** (~21 cameras).
- **To get the full list again (hundreds of cams):** run or deploy the app on **Netlify** (e.g. `netlify dev` or deploy to Netlify). Then the cams search runs on the server (no CORS), and you get FL511 + Caltrans + TxDOT + WYDOT + optional Windy/NY511.
- The app now **merges Netlify results** when fallback returns few cameras, so if the site is on Netlify you should see the full list again even when the initial health check failed.

**Optional keys (more cameras):**

- **WINDY_API_KEY** – adds global Windy webcams (many more international cams).
- **NY511_API_KEY** – adds New York state traffic cams.
- **CAMS_TOKEN** – optional secret to protect `/api/cams/*` from abuse; if unset, endpoints still work (dev mode).

---

## Netlify 4KB function environment limit

Netlify attaches **all function-scoped env vars** to every function upload. The combined size of key names + values must stay **under 4KB** or deploy fails (often on `watermark-process-background` or the next new function).

**Fastest fixes (do all that apply):**

1. **Remove duplicate APNs key** - keep only `APNS_KEY_P8_BASE64`; delete legacy `APNS_KEY_P8` if both exist (~600 bytes saved).
2. **Move APNs .p8 to Netlify Blobs** (recommended when still over limit):
   ```bash
   # With site creds from: netlify env:list --json
   APNS_KEY_P8_BASE64="$(base64 -i AuthKey_XXXX.p8)" \
     NETLIFY_SITE_ID=... NETLIFY_BLOB_READ_WRITE_TOKEN=... \
     node scripts/upload-apns-key-to-blob.js
   ```
   Then in Netlify Dashboard: set **`APNS_KEY_STORE=blob`**, delete **`APNS_KEY_P8_BASE64`** and **`APNS_KEY_P8`**, redeploy (~600+ bytes saved).
3. **Scope build-only vars** - in Netlify Dashboard → Environment variables → each var → **Scopes**: uncheck **Functions** for vars only used at build time or in local scripts (e.g. `CLIP_*`, `YT_API_KEY`, `FFMPEG_PATH`, `FFPROBE_PATH`, `CLIP_REVIEW_*`). Keep `AUTH0_*`, `SUPABASE_*`, `APNS_*` (except the moved .p8), `R2_*`, etc. on Functions.
4. **Delete unused keys** - remove any obsolete or test secrets still listed in the site env.

Verify after deploy: `admin-live-stories?action=apnsStatus` should show `configured:true` and `keyP8Source:"blob"` when using blob storage.

---

## Local development

1. **Breaking news feed:** Run `netlify dev` so `/.netlify/functions/posts-read` works. No env keys required for the feed.
2. **Email / AI / etc.:** Copy the variables you need into `.env` or `.env.local` (do not commit these files). Netlify CLI will load them when you run `netlify dev`.

---

## Netlify (production)

In **Site settings → Environment variables** add only what you use, e.g.:

- `RESEND_API_KEY` if you use newsletter/tips/emails  
- `OPENAI_API_KEY` if you use image/voice AI  
- `ADMIN_ANALYTICS_TOKEN` and `NEWSLETTER_KEY` as your own secrets for protected routes  

`NETLIFY_SITE_ID` and `NETLIFY_BLOB_READ_WRITE_TOKEN` are set by Netlify; you don’t add them manually.
