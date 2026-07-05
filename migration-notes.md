# Migration Notes - Noteworthy News

*Generated 2026-03-22. Documents changes made during the Security + Admin Foundation session, legacy paths marked for removal, and remaining work.*

---

## What Changed (This Session)

### 1. Auth middleware created

**File:** `netlify/functions/middleware/requireAuth.js`

- `verifyToken(event)` - cryptographic JWT verification via Auth0 JWKS (using `jose`)
- `requireAuth(event)` - require any authenticated user (returns 401 or `{ user }`)
- `requireAdminAuth(event)` - require admin (returns 401/403 or `{ user }`)
- `requireAdminAuthOrSecret(event, envVarName)` - accept JWT admin OR legacy shared secret
- `isAdminSecretValid(event, envVarName)` - check legacy secret with timing-safe compare
- **Fail-closed everywhere**: missing AUTH0_DOMAIN → 500, not bypass

Admin identity resolved via:
1. Auth0 role claims (multiple namespace paths checked)
2. `ADMIN_EMAILS` env var allowlist (fallback when Auth0 roles aren't configured)

### 2. Content mutation endpoints now require admin auth

These functions now call `requireAdminAuth(event)` at the top of the handler:

| Function | File | What it protects |
|----------|------|-----------------|
| `remove-post` | `remove-post.js` | Post deletion |
| `update-post-data` | `update-post-data.js` | Post creation/update |
| `upload-post-media` | `upload-post-media.js` | Media upload to post-media blobs |
| `process-csv-posts` | `process-csv-posts.js` | Bulk CSV post import |
| `delete-large-images` | `delete-large-images.js` | Media deletion |
| `remove-long-posts` | `remove-long-posts.js` | Verbose post pruning |
| `remove-old-alert-posts` | `remove-old-alert-posts.js` | Alert post cleanup |
| `rebuild-index` | `rebuild-index.ts` | Index rewrite |
| `re-extract-media` | `re-extract-media.js` | Media field rewrite |
| `process-post-screenshot` | `process-post-screenshot.js` | OpenAI Vision extraction |

These functions now require admin auth on POST (GET remains public for reads):

| Function | File |
|----------|------|
| `fetch-tweets-simple` | `fetch-tweets-simple.ts` |
| `fetch-profile-tweets` | `fetch-profile-tweets.ts` |

These functions now use `requireAdminAuthOrSecret` (accept JWT or legacy secret):

| Function | File | Secret |
|----------|------|--------|
| `upload-newsletter-image` | `upload-newsletter-image.js` | `NEWSLETTER_KEY` |
| `generate-newsletter-html` | `generate-newsletter-html.js` | `NEWSLETTER_KEY` |

### 3. Fail-open patterns fixed to fail-closed

| Function(s) | Env var | Before | After |
|-------------|---------|--------|-------|
| `newsletter-templates.js` | `NEWSLETTER_KEY` | Skip check when unset | Return 500 when unset |
| `send-newsletter.js` | `NEWSLETTER_KEY` | Skip check when unset | Return 500 when unset |
| `log-data.js` (GET) | `ADMIN_ANALYTICS_TOKEN` | Skip check when unset | Return 500 when unset |
| `stream-logs.js` | `ADMIN_ANALYTICS_TOKEN` | Skip check when unset | Return 500 when unset |
| `get-user-profile.js` | `ADMIN_ANALYTICS_TOKEN` | Skip check when unset | Return 500 when unset |
| 9 Clemens functions | `CLEMS_TOKEN` | `checkToken` returns true | `checkToken` returns false |
| `send-push-notification.js` | `PUSH_API_KEY` | Skip check when unset | Return 500 when unset |
| `send-website-update.js` | `PUSH_API_KEY`/`ADMIN_API_KEY` | Skip check when unset | Return 500 when unset |
| `send-custom-email.js` | `ADMIN_TOKEN`/`NEWSLETTER_TOKEN` | Any non-empty password works | Return 500 when unset |
| `requireCamsToken.js` (shared) | `CAMS_TOKEN` | Allow in "dev mode" | Return 500 when unset |
| `cams-token.js` | - | Public token distribution | Requires admin JWT |

### 4. User identity now verified server-side

| Function | Before | After |
|----------|--------|-------|
| `user-data.js` | Bearer header required but never verified; email from query/body | JWT verified via JWKS; email extracted from verified token claims |
| `comments-api.js` DELETE | `authorId` from request body (spoofable) | JWT verified; ownership checked against token's `sub`/`email` |
| `track-visit-streak.js` | Bearer presence check only; email from body | JWT verified via `requireAuth`; email from token claims |

---

## Environment Variables Required for Production

After these changes, the following env vars MUST be configured in Netlify for the system to function. Missing any of them will cause the corresponding endpoints to return 500 (fail-closed).

| Variable | Used by | Required |
|----------|---------|----------|
| `AUTH0_DOMAIN` | All JWT-protected endpoints | **Yes** (for admin mutations) |
| `AUTH0_AUDIENCE` or `AUTH0_CLIENT_ID` | JWT verification audience check | **Yes** |
| `ADMIN_EMAILS` | Admin identity fallback | **Recommended** (comma-separated admin email list). `mr.pangolinman@gmail.com` is always allowlisted in code (`requireAuth.js`); add others via this env var. |
| `NEWSLETTER_KEY` | Newsletter templates, send, generation | **Yes** |
| `ADMIN_ANALYTICS_TOKEN` | Analytics dashboard, log export, profiles | **Yes** |
| `CLEMS_TOKEN` | Transcription pipeline (9 functions) | **Yes** |
| `PUSH_API_KEY` | Push notification send | **Yes** |
| `ADMIN_API_KEY` or `PUSH_API_KEY` | Website update notifications | **Yes** |
| `ADMIN_TOKEN` or `NEWSLETTER_TOKEN` | Custom email send | **Yes** |
| `CAMS_TOKEN` | CAMS search/proxy/health | **Yes** |

---

## Legacy Paths Marked for Removal (Phase 1)

These are NOT deleted yet. They will be removed when the new admin UI is built (Phase 1 of plan.md).

### Admin HTML pages (no server auth, URL-is-the-gate)

| File | Current state | Replacement |
|------|--------------|-------------|
| `admin-posts-manager.html` | **Broken** - the API calls it makes will now return 401 | V2 admin UI with Auth0 login |
| `admin-remove-post.html` | **Broken** - same | V2 admin UI |
| `admin-add-tweets.html` | **Broken** - same | V2 admin UI |
| `admin-newsletter.html` | Partially works (uses `NEWSLETTER_KEY` secret) | V2 admin UI with JWT |
| `admin-analytics.html` | Partially works (uses `ADMIN_ANALYTICS_TOKEN`) | V2 admin UI with JWT |
| `media.html` | **Broken** - post API calls return 401, auth probe still works | V2 admin UI |

### Test/dev pages deployed to production

| File | Action |
|------|--------|
| `test-earthquake.html` | Delete |
| `test-hero-media.html` | Delete |
| `video-preview-test.html` | Delete |

### Test functions deployed to production

| File | Action |
|------|--------|
| `netlify/functions/test-resend.js` | Delete |
| `netlify/functions/test-generate.js` | Delete |

### Client-side security theater

| File | Issue | Action |
|------|-------|--------|
| `security-check.html` | sessionStorage-based "verification" - not real auth | Rebuild as server-side check or remove |
| `lib/security/routeProtection-browser.js` | Client-side route gating via sessionStorage | Remove once server auth covers protected routes |
| `lib/security/routeProtection.js` | Same | Remove |
| `lib/security/securityConfig.js` | Configuration for above | Remove |

### Token-in-URL patterns (leaks via Referer, logs, history)

| Surface | Pattern | Fix |
|---------|---------|-----|
| `admin-newsletter.html` | `?token=X` on API calls | Use `Authorization: Bearer` header instead |
| `admin-analytics.html` | `?token=X` on `log-data` calls | Use `Authorization: Bearer` header instead |
| `media.html` | `?token=X` on auth probe | Use `Authorization: Bearer` header instead |

### Bookmarklet

| File | Issue |
|------|-------|
| `bookmarklet-add-post.html` | Hardcoded POST to production `fetch-tweets-simple` with no auth. Now broken (401). Remove or update to prompt for auth. |

---

## Remaining Security Work (Future Sessions)

### Near-term (Phase 1 - Admin UI)

1. **Build server-authenticated admin UI** with Auth0 login flow
2. **Delete old admin HTML pages** once new admin UI is validated
3. **Configure Auth0 tenant** with admin role claims for JWT-based admin identification
4. **Add `Authorization: Bearer` headers** to all admin API calls (replacing `?token=` pattern)
5. **Delete test pages and test functions** from production

### Medium-term

6. **CAMS architecture redesign**: The current pattern of distributing `CAMS_TOKEN` to browsers is wrong. CAMS requests should be proxied server-side so the token never leaves the server.
7. **Rate limiting on public AI endpoints**: `chatgpt.js`, `chatgpt-stream.js`, `game-ai.js`, `ai-answer.js`, `elevenlabs-tts.js`, `noteworthy-chat.js`, `generate-image.js` - these call paid external APIs with no server-enforced rate limiting.
8. **Webhook signature verification**: `x-webhook.ts` POST and `resend-webhook.js` do not verify request signatures, allowing spoofed webhook deliveries.
9. **`x-netlify-deploy` header bypass** in `send-website-update.js`: This header is spoofable. Replace with a proper deploy hook secret.

### Deferred

10. **Websocket server identity**: `websocket-server/index.js` trusts client-supplied `userId`. Acceptable for casual games but not a trust boundary.
11. **Leaderboard score validation**: No server-side reasonableness check on submitted scores.
12. **`comments-api.js` POST**: Comment creation has no auth - this is by design (public comments) but should have rate limiting and abuse detection.
13. **Email-based flows** (`unsubscribe`, `email-preferences-link`): Use base64-encoded email as identifier - should move to signed tokens.

---

## How to Verify the Changes

### Quick smoke test (requires AUTH0_DOMAIN + ADMIN_EMAILS configured)

```bash
# Should return 401 (no token)
curl -s -X POST https://YOUR-SITE/.netlify/functions/remove-post \
  -H "Content-Type: application/json" \
  -d '{"postId":"test"}' | jq .error

# Should return 500 if NEWSLETTER_KEY is not set
curl -s https://YOUR-SITE/.netlify/functions/newsletter-templates | jq .error

# Should return 401 (no token for analytics)
curl -s "https://YOUR-SITE/.netlify/functions/log-data" | jq .error

# Public read endpoints should still work
curl -s "https://YOUR-SITE/.netlify/functions/posts-read?limit=1" | jq length
```

### Full validation checklist

- [ ] All mutation endpoints return 401 without a valid admin JWT
- [ ] All fail-closed endpoints return 500 when their env var is missing
- [ ] `user-data` rejects invalid/missing JWTs
- [ ] `comments-api` DELETE requires a valid JWT and checks ownership
- [ ] `track-visit-streak` requires a valid JWT
- [ ] Public read endpoints (`posts-read`, `rss-aggregate`, `health`, etc.) still work without auth
- [ ] `cams-token` requires admin JWT
- [ ] Admin HTML pages no longer function (expected - they'll be rebuilt)

---

## Data Architecture Session (2026-03-22)

### What Changed

#### 1. Centralized post storage module created

**File:** `netlify/functions/lib/postStore.js`

All read/write operations to the `x-posts` Netlify Blob store now go through this module. It enforces:
- Consistent key format (`post-{id}.json`)
- Consistent index shape (`{ ids: string[] }`) - the unreliable `urls` field is permanently retired
- Deduplication on index writes
- Bounded index size (200 posts)

Exported functions: `getPostStore()`, `readPost()`, `writePost()`, `readIndex()`, `addToIndex()`, `removeFromIndex()`, `writeIndex()`, `deletePost()`

#### 2. All x-posts writers migrated to postStore

| File | Before | After |
|------|--------|-------|
| `lib/createPost.js` | Direct `getStore` + `store.set` + manual index | Uses `postStore.writePost` + `postStore.addToIndex` |
| `x-webhook.ts` | Direct `getStore`, wrote `{ ids }` only index | Uses `postStore` read/write/index |
| `fetch-tweets-simple.ts` | Direct `getStore`, wrote `{ ids, urls }` index | Uses `postStore` - `urls` field retired |
| `fetch-profile-tweets.ts` | Direct `getStore`, wrote `{ ids, urls }` index | Uses `postStore` - `urls` field retired |
| `update-post-data.js` | Direct `getStore`, wrote `{ ids, urls }` index | Uses `postStore` - `urls` field retired |
| `remove-post.js` | Direct `getStore`, wrote `{ ids, urls }` index | Uses `postStore.deletePost` |
| `remove-long-posts.js` | Direct `getStore`, wrote `{ ids }` only | Uses `postStore.writeIndex` |
| `remove-old-alert-posts.js` | Direct `getStore`, wrote `{ ids }` only | Uses `postStore.writeIndex` |
| `rebuild-index.ts` | Direct `getStore`, wrote `{ ids }` only | Uses `postStore.writeIndex` |
| `inbound-email.js` | Inline `getStore` per call | Uses `postStore.readPost` + `postStore.writePost` |
| `posts-read.js` | Direct `getStore` with fallback key logic | Uses `postStore.readIndex` + `postStore.readPost` |
| `earthquake-poller.js` | Direct `getStore`, wrote `{ ids, urls }`, used `eq-` prefix | Uses `postStore`, now uses `usgs-` prefix |

#### 3. Earthquake ID scheme unified

**Before:** Two ID schemes existed for earthquake posts:
- `engines/usgs.js` via `createPost` → `usgs-{eventId}`
- `earthquake-poller.js` → `eq-{eventId}`
- `posts-read.js` had fallback logic trying both `usgs-` and `eq-` keys

**After:** `earthquake-poller.js` now uses `usgs-{eventId}` prefix (matching the USGS engine path). The fallback in `posts-read.js` is retained temporarily for any legacy `eq-` posts still in storage, but no new `eq-` posts will be created.

#### 4. Index shape standardized

**Before:** The `index.json` shape varied by writer:
- Some wrote `{ ids, urls }` - e.g., `fetch-tweets-simple`, `update-post-data`, `remove-post`
- Some wrote `{ ids }` only - e.g., `x-webhook`, `rebuild-index`, `remove-long-posts`, `createPost`
- Whichever writer ran last determined whether `urls` existed

**After:** All writers go through `postStore`, which always writes `{ ids }`. The `urls` field is retired. `posts-read.js` never used it - it reads posts by ID and sorts by date.

#### 5. Duplicate RSS ingestion removed from ingest-all.js

**Before:** `ingest-all.js` contained an inline `parseRSSBasic` regex XML parser that duplicated the `src/rss/parser.js` (rss-parser library) functionality. Both wrote to the same `live_events` table.

**After:** The inline RSS parser is removed from `ingest-all.js`. RSS ingestion is the responsibility of `ingest-live-events.js`, which uses the shared `src/rss/parser.js`. `ingest-all.js` now focuses solely on hazard engine orchestration.

### Index shape retirement: urls field

The `urls` field in `index.json` was never consistently maintained:
- `createPost.js` never wrote it for engine posts
- `x-webhook.ts`, `rebuild-index.ts`, `remove-long-posts.js`, `remove-old-alert-posts.js` all dropped it
- `posts-read.js` never used it (reads posts by ID)
- Keeping it created a false sense of parity that would break silently

Decision: permanently retire `urls` from the index. All readers already work without it.

### Legacy paths still present

| Path | Status | Notes |
|------|--------|-------|
| `eq-` earthquake posts in storage | **Legacy** | Old posts may still have `eq-` prefix. `posts-read.js` retains a fallback for direct ID lookups. Will age out naturally as new posts use `usgs-`. |
| Cloudflare Worker KV feed | **Parallel** | Still exists with its own `FEED` namespace. Not touched in this session. Decision deferred. |
| `auto-sync-posts.ts` | **Dormant** | Schedule commented out, `checkForNewPosts()` returns 0. Not a real writer. |
| `ingest-live-events.js` | **Not scheduled in TOML** | May be scheduled externally. Now the sole owner of RSS → `live_events` ingestion. |

### What did NOT change

- Supabase tables (`verified_events`, `live_events`, `engine_runs`, `transcription_jobs`) - unchanged
- Engine files (`engines/*.js`) - unchanged (they already used `createPost`)
- All other Netlify Blob stores (20 stores besides `x-posts`) - unchanged
- Cloudflare Worker - unchanged
- Frontend - unchanged
- Auth middleware - unchanged
- All scheduled functions (`ingest-all`, `retry-usgs-images`) - schedules unchanged

### What should happen next

1. **Monitor production** after deploy: verify posts appear in feed, earthquake posts use `usgs-` prefix, no index corruption
2. **Schedule `ingest-live-events`** in `netlify.toml` if RSS ingestion to `live_events` is desired
3. **Decide on Cloudflare Worker**: canonical, cache, or retire
4. **Clean up legacy `eq-` posts**: run a one-time script to rename `eq-{id}` blobs to `usgs-{id}` and update the index
5. **Phase 2 (Homepage)** and **Phase 4 (CSS)** per `plan.md` can proceed independently

---

## Unified Alert System Session (2026-03-22)

### What Changed

#### 1. Unified alert event model

**File:** `netlify/functions/lib/alertEvent.js`

All alert-worthy events are now normalized into a single schema before notification. The `createAlertEvent()` function validates and normalizes raw engine output. `getNotificationChannels()` determines which delivery channels apply based on event type and severity. `shouldNotify()` checks if any notification should fire at all.

#### 2. Central notification dispatcher

**File:** `netlify/functions/lib/notifyForEvent.js`

Single entry point for all alert delivery. Given an AlertEvent, it:
- Checks dedup (has this event been notified already?)
- Determines channels (email, push, location)
- Dispatches in parallel (one channel failure doesn't block others)
- Records dedup marker on success

Email delivery handles two paths:
- **Earthquake-specific**: Rich HTML with map images, sent to opted-in users per magnitude threshold
- **Generic**: Simple event email to admin/notification recipients

#### 3. Alert deduplication

**File:** `netlify/functions/lib/alertRateLimit.js`

Uses a dedicated `alert-dedup` Netlify Blob store to track which events have been notified. Prevents duplicate notifications when the same event is processed in consecutive engine runs.

#### 4. Engines return notifiable events

All six engines (`usgs`, `nws`, `faa`, `uscg`, `volcano`, `embassy`) now return a `notifiableEvents[]` array in their `run()` result. This array contains raw event data in a consistent shape that `createAlertEvent()` can normalize.

**Backward compatible**: Engines still run their own inline notification code. The new data is additional - nothing is removed.

#### 5. Orchestrator dispatches unified alerts

**File:** `netlify/functions/ingest-all.js`

When `USE_UNIFIED_ALERTS=true` is set in environment, `ingest-all` takes each engine's `notifiableEvents[]`, creates AlertEvents, and dispatches them through `notifyForEvent()`.

#### 6. Breaking news push endpoint

**File:** `netlify/functions/send-breaking-news-alert.js`

New admin-authenticated endpoint that creates a breaking news AlertEvent and dispatches it. This wires up the `breaking-news` push notification type that subscribers could opt into but had no server-side sender.

#### 7. Earthquake poller deprecated

**File:** `netlify/functions/earthquake-poller.js`

Marked as deprecated with a clear header explaining the migration path. Set `EARTHQUAKE_POLLER_DISABLED=true` to no-op immediately. All earthquake processing should go through `engines/usgs.js` via `ingest-all`.

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `USE_UNIFIED_ALERTS` | Set to `true` to enable the unified notification pipeline in `ingest-all` |
| `EARTHQUAKE_POLLER_DISABLED` | Set to `true` to disable the legacy earthquake poller |

### Files Created

| File | Purpose |
|------|---------|
| `netlify/functions/lib/alertEvent.js` | Unified alert event model |
| `netlify/functions/lib/notifyForEvent.js` | Notification dispatcher |
| `netlify/functions/lib/alertRateLimit.js` | Alert deduplication |
| `netlify/functions/send-breaking-news-alert.js` | Breaking news alert endpoint |

### Files Modified

| File | Change |
|------|--------|
| `netlify/functions/engines/usgs.js` | Returns `notifiableEvents[]` from `run()` |
| `netlify/functions/engines/nws.js` | Same |
| `netlify/functions/engines/faa.js` | Same |
| `netlify/functions/engines/uscg.js` | Same |
| `netlify/functions/engines/volcano.js` | Same |
| `netlify/functions/engines/embassy.js` | Same |
| `netlify/functions/ingest-all.js` | Unified alert dispatch when `USE_UNIFIED_ALERTS=true` |
| `netlify/functions/earthquake-poller.js` | Deprecated header + `EARTHQUAKE_POLLER_DISABLED` guard |
| `audit-findings.md` | Updated consolidation status |
| `plan.md` | Added Section 9: Unified Alert System |

### What did NOT change

- `send-earthquake-alert.js` (2,001 lines) - preserved as-is; will be replaced by the unified pipeline
- `send-push-notification.js` - called by the unified dispatcher as a module, no changes
- `send-location-alert.js` - referenced by the dispatcher, no changes
- Supabase `verified_events` schema - unchanged
- Service worker push handling - unchanged
- Situation Monitor V2 - unchanged (still polls APIs; future work: server-push)
- All public read endpoints - unchanged

### How to verify

```bash
# 1. Deploy with USE_UNIFIED_ALERTS=false (default) - backward compatible, no behavior change
# 2. Check that engines still notify through their own code
# 3. Enable USE_UNIFIED_ALERTS=true in staging
# 4. Trigger an engine run and verify:
#    - Dedup prevents duplicate notifications
#    - Email sent for qualifying events
#    - Push sent to subscribers
#    - Breaking news endpoint works with admin JWT

# Test breaking news endpoint
curl -X POST https://YOUR-SITE/.netlify/functions/send-breaking-news-alert \
  -H "Authorization: Bearer YOUR_ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Breaking News","summary":"This is a test","severity":4}'
```

### What should happen next

1. **Enable `USE_UNIFIED_ALERTS=true`** in staging environment
2. **Validate** that engine runs produce correct notifications via the unified path
3. **Disable `earthquake-poller.js`** schedule in Netlify dashboard + set `EARTHQUAKE_POLLER_DISABLED=true`
4. **Gradually remove** engine-internal notification code (sendEmailAlert, sendPushNotificationForEarthquake, sendEventAlert calls)
5. **Make image generation async** - decouple from email delivery in USGS engine
6. **Wire location alerts fully** into the dispatcher (currently delegated to engine code)
7. **Consolidate** `assess-earthquake-impact.js` into `lib/impactAssessment.js`

---

## Checkpoint Audit (2026-03-22)

### Findings

A full stability checkpoint was conducted after the Security Foundation, Data Consolidation, Unified Alert System, and V2 Situation Monitor sessions. Key migration-relevant findings:

#### Issues that must be fixed before enabling unified alerts

1. **Dual notification risk:** `ingest-all.js` dispatches unified alerts alongside each engine's own inline notification code. Enabling `USE_UNIFIED_ALERTS=true` without first removing engine-internal notification code will cause **duplicate notifications**. The dedup store (`alert-dedup`) prevents re-notifying for the same event ID across unified pipeline runs, but does NOT prevent the engine's own code from sending independently.

2. **Dispatch on failed engine runs:** The `USE_UNIFIED_ALERTS` block in `ingest-all.js` fires when `result.notifiableEvents?.length > 0` regardless of `result.success`. A failed engine run could still trigger notifications for incomplete data. Fix: add `result.success &&` guard.

3. **Location alerts are a stub:** `notifyForEvent.js` → `sendLocationNotifications()` always returns `{ sent: 0, reason: 'delegated_to_engines' }`. The unified pipeline does not actually send location-based alerts; that still depends on engine-internal code.

#### PostStore migration gaps

Seven Netlify functions still access `x-posts` blobs directly (not through `postStore`):
- **Write path:** `re-extract-media.js` - must be migrated before it's used again
- **Read-only:** `noteworthy-chat.js`, `article-preview.js`, `twitter-share.js`, `check-earthquake-posts.js`, `realtime-voice.js`, `auto-sync-posts.ts`

Several scripts also access `x-posts` directly: `find-high-view-post.js`, `re-extract-media-for-posts.js`, `add-post-to-index.js`, `remove-post-from-index.js`. These are CLI tools, not production paths, but should be migrated for consistency.

#### Files still not deleted

| File | Status | Original target |
|------|--------|----------------|
| `test-earthquake.html` | Still deployed | Phase 0 (delete) |
| `test-hero-media.html` | Still deployed | Phase 0 (delete) |
| `video-preview-test.html` (×2) | Still deployed (root + public/) | Phase 0 (delete) |
| `admin-posts-manager.html` | Broken (401) but still served | Phase 1 (delete) |
| `admin-remove-post.html` | Broken (401) but still served | Phase 1 (delete) |
| `admin-add-tweets.html` | Broken (401) but still served | Phase 1 (delete) |
| `bookmarklet-add-post.html` | Broken (401) but still served | Phase 1 (delete) |
| `posts-read.ts.backup` | Backup file in functions dir | Delete now |

### Correction plan

See `plan.md` Section 10 and `stability-checkpoint.md` Sections 6–8 for the full correction session scope.

---

## Correction Session (2026-03-22)

### What Changed

#### 1. Unified alert dispatch guard

**File:** `netlify/functions/ingest-all.js`

The `USE_UNIFIED_ALERTS` block now requires `result.success` before dispatching notifications. Previously, a failed engine run could still trigger notifications if it populated `notifiableEvents`.

#### 2. PostStore migration completed for all x-posts consumers

**All production-path functions now use `lib/postStore.js`** for x-posts blob access. No Netlify function in `netlify/functions/` accesses `x-posts` directly anymore (except `postStore.js` itself).

| File | Before | After |
|------|--------|-------|
| `re-extract-media.js` | Direct `getStore('x-posts')` + manual keys | `getPostStore()` + `readIndex()` + `readPost()` |
| `noteworthy-chat.js` | Direct `getStore('x-posts')` | `postStore.getPostStore()` + `postStore.readIndex()` + `postStore.readPost()` |
| `realtime-voice.js` | Direct `getStore('x-posts')`, **bug: raw ID as key** | `postStoreLib.getPostStore()` + `readPost()` (key normalized) |
| `article-preview.js` | Direct `getStore('x-posts')` + manual key-building | `getPostStore()` + `readPost()` with ID normalization |
| `twitter-share.js` | Direct `getStore('x-posts')`, text type + JSON.parse | `getPostStore()` + `readPost()` (JSON type, normalized key) |
| `check-earthquake-posts.js` | Direct `getStore('x-posts')` | `getPostStore()` + `readIndex()` + `readPost()` |
| `auto-sync-posts.ts` | Direct `getStore('x-posts')` | `postStoreLib.getPostStore()` + `readIndex()` |

#### 3. Shared CORS utility created

**File:** `netlify/functions/lib/corsHeaders.js`

Exports `corsHeaders` (standard headers object) and `optionsResponse` (pre-built 204 response). Adopted in `re-extract-media.js`, `check-earthquake-posts.js`, `send-breaking-news-alert.js`. Available for broader adoption.

#### 4. Legacy debris deleted

| File | Action |
|------|--------|
| `test-earthquake.html` | Deleted |
| `test-hero-media.html` | Deleted |
| `video-preview-test.html` (root) | Deleted |
| `public/video-preview-test.html` | Deleted |
| `netlify/functions/test-resend.js` | Deleted |
| `netlify/functions/test-generate.js` | Deleted |
| `netlify/functions/posts-read.ts.backup` | Deleted |
| `bookmarklet-add-post.html` | Marked deprecated (noindex, comment, title) |

#### 5. V2 CSS token consistency

**Files:** `v2/styles/tokens.css`, `v2/styles/base.css`, `v2/styles/components.css`, `v2/styles/situation-monitor.css`

Added 10 new semantic color tokens to `tokens.css`:
- `--color-white`, `--color-accent-subtle`, `--color-accent-border`, `--color-accent-ring`
- `--color-success-muted`, `--color-success-border`
- `--color-warning-muted`, `--color-warning-border`
- `--color-error-muted`, `--color-error-border`, `--color-error-badge`, `--color-error-panel`

All raw `rgba()` and `#hex` values in V2 CSS consumer files replaced with token references. Print media query `#ccc` retained (print context is independent).

#### 6. V1 premium-tokens.css deprecated

**File:** `src/styles/premium-tokens.css`

Header updated to mark as V1-only legacy. New UI work must use `v2/styles/tokens.css`.

#### 7. V2 newsletter form wired to backend

**File:** `v2/js/main.js`

Newsletter signup form now POSTs to `/.netlify/functions/send-email` with `{ email }`. Handles success/error states and provides user feedback via the hint text.

---

## Admin UI Rebuild Session (2026-03-22)

### What Changed

#### 1. New authenticated admin surface at `/admin/`

**Directory:** `admin/`

| File | Purpose |
|------|---------|
| `admin/index.html` | Admin shell - Auth0 guard, sidebar nav, section container |
| `admin/css/admin.css` | Admin-specific styles consuming V2 design tokens |
| `admin/js/admin-auth.js` | Auth0 initialization, login redirect, server-authoritative admin probe |
| `admin/js/admin-app.js` | Hash-based section router, navigation binding |
| `admin/js/lib/api.js` | Authenticated API client - every call uses `Authorization: Bearer <jwt>` |
| `admin/js/views/posts.js` | Post management (list, search, edit fields, delete) |
| `admin/js/views/ingestion.js` | Ingestion triggers (tweet URL, profile fetch, CSV import, screenshot extraction) |
| `admin/js/views/newsletter.js` | Newsletter management (template list, AI generation, send) |
| `admin/js/views/analytics.js` | Analytics (log query, stats breakdown, user profile lookup) |
| `admin/js/views/system.js` | System maintenance (rebuild index, cleanup, breaking news alerts) |

#### 2. Five endpoints upgraded to accept JWT admin auth

Previously, these endpoints only accepted legacy shared secrets. They now also accept Auth0 JWT admin auth via `requireAdminAuthOrSecret`:

| Endpoint | Secret env var | Change |
|----------|---------------|--------|
| `log-data.js` (GET) | `ADMIN_ANALYTICS_TOKEN` | Added `requireAdminAuthOrSecret` |
| `stream-logs.js` | `ADMIN_ANALYTICS_TOKEN` | Added `requireAdminAuthOrSecret` |
| `get-user-profile.js` | `ADMIN_ANALYTICS_TOKEN` | Added `requireAdminAuthOrSecret` |
| `newsletter-templates.js` | `NEWSLETTER_KEY` | Replaced inline secret check with `requireAdminAuthOrSecret` |
| `send-newsletter.js` | `NEWSLETTER_KEY` | Replaced inline secret check with `requireAdminAuthOrSecret` |

CORS headers on all five updated to include `Authorization`.

#### 3. Legacy admin pages deprecated and redirected

All six legacy admin HTML pages marked with deprecation comments and `noindex`. Redirects added in `netlify.toml`:

| Old URL | New destination |
|---------|----------------|
| `/admin` | `/admin/index.html` |
| `/datalogging` | `/admin/#analytics` |
| `/adminnewsletter` | `/admin/#newsletter` |
| `/media` | `/admin/#ingestion` |
| `/admin-posts-manager.html` | `/admin/#posts` |
| `/admin-remove-post.html` | `/admin/#posts` |
| `/admin-add-tweets.html` | `/admin/#ingestion` |
| `/admin-newsletter.html` | `/admin/#newsletter` |
| `/admin-analytics.html` | `/admin/#analytics` |

#### 4. Build integration

`scripts/inject-auth0.js` updated to inject Auth0 config into both `index.html` and `admin/index.html`.

### What did NOT change

- All existing API endpoints preserve backward compatibility (shared secrets still accepted)
- Public site pages - unchanged
- V2 homepage and situation monitor - unchanged
- Data schema - unchanged
- Engine system - unchanged
- Auth0 tenant configuration - unchanged (admin identity still uses `ADMIN_EMAILS` fallback)

### What should happen next

1. **Validate in staging** - deploy and test the full admin flow
2. **Configure Auth0 admin role claims** - add `admin` role to JWT claims for admin users
3. **Delete old admin HTML pages** - once redirects are validated in production
4. **Add newsletter template preview** - render HTML in an iframe within the newsletter view
5. **Add CSV export to analytics** - expose the existing CSV export capability via admin UI
6. **Consider adding ingest-all manual trigger** - for ad-hoc engine runs
