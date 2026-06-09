# Audit Findings — Noteworthy News

*Generated 2026-03-22. Read-only inspection of `/Users/richarda/breaking-news-game`.*

---

## 1. Repo Topology

### Root directory

The repo root contains **59 HTML files**, ~30 JS files, config/tooling, media assets, and several sub-projects — all served as a flat static site via Netlify with `publish = "."`.

```
breaking-news-game/
├── index.html                  # Homepage — 21,006 lines / 858 KB
├── admin-*.html (5)            # Admin surfaces (analytics, newsletter, posts, tweets, remove)
├── situation-monitor.html      # Specialty dashboard
├── game.html                   # Fact-checker multiplayer game
├── geography-game.html         # Geography game — 3,762 lines
├── article.html                # Article template
├── profile.html                # User profile (Auth0)
├── my-reading-list.html        # User reading list
├── media.html                  # Media access (admin-adjacent)
├── mission-control.html        # Globe visualization
├── mission-globe.html          # Globe variant
├── security-check.html         # Human verification (React + Babel)
├── games-gallery-example.html  # Games gallery (React + Babel)
├── newsletter-*.html (4)       # Newsletter preferences/examples
├── unsubscribe*.html (2)       # Unsubscribe flows
├── submit-fact-check.html      # Public fact-check submission
├── bookmarklet-add-post.html   # Bookmarklet docs
├── contact.html                # Contact form
├── archive.html                # Post archive
├── mobile.html                 # Mobile variant
├── 404.html                    # Custom 404
├── category/                   # Category listing pages
├── [12 legal/resource/guide pages]
├── [5 test/dev pages]          # test-earthquake, test-hero-media, video-preview-test, etc.
├── photo-page.html             # Captured X/Twitter HTML — 235 KB
├── tweet-page-html.html        # Captured X/Twitter HTML — 235 KB
│
├── src/                        # Frontend modules, components, styles, auth, widgets
│   ├── auth/                   # Auth0 SPA client (auth0.js, auth0-integration.js)
│   ├── components/             # Vanilla + React UI components
│   ├── js/homepage/            # ES module homepage orchestrator
│   ├── loader/                 # Intel loader UX
│   ├── rss/                    # RSS parser wrapper
│   ├── styles/                 # Feature-specific CSS (15 files)
│   ├── utils/                  # Analytics, bookmarks, push, keyboard, etc.
│   ├── widgets/                # Chat widget (~9,849 lines), voice/audio worklets
│   ├── lib/posts/              # TypeScript post normalization (server-oriented)
│   └── data/                   # Coverage points for globe
│
├── components/feed/            # TypeScript feed components (NOT wired into production)
├── lib/                        # Feed types/utils, SEO, security config
├── js/                         # Article page, quiz engine, live cams, debounce
├── styles/                     # Global CSS (responsive, animations, legal, command-center)
├── css/                        # Article CSS, live cams CSS
├── assets/                     # Fonts, CSS, JS for sub-projects
├── images/                     # Image assets
├── dist/                       # Webpack output (gitignored)
├── public/                     # Netlify static: _headers, _redirects, games/, data/
│   └── games/                  # Per-game folders (hexgl, stunt-city, parkour-blocks, etc.)
│
├── netlify/
│   ├── functions/              # ~80+ HTTP handlers + lib/ + engines/
│   │   ├── lib/                # Shared: supabaseClient, createPost, logger, email, alerts
│   │   └── engines/            # Hazard engines: usgs, nws, faa, uscg, volcano, embassy
│   ├── edge-functions/         # (present but not heavily used)
│   └── lib/                    # Additional shared modules
│
├── cloudflare-worker/          # X/Twitter feed worker (KV storage, oEmbed, bookmarklet)
├── websocket-server/           # Multiplayer WS + Redis (scaffolded, stubs present)
├── supabase/migrations/        # 4 migration files (live_events, verified_events, transcription_jobs)
│
├── scripts/                    # ~45 Node CLI scripts (build, content ops, validation)
├── tools/                      # Additional tooling
├── emails/                     # Email templates/components
├── docs/                       # Internal documentation
├── KONSCIOUS/                  # Separate mini-site (own CSS/JS/HTML)
├── clemensconverter/           # Standalone converter tool
├── SpotlightSongs/             # Media assets
│
├── netlify.toml                # Build config, redirects, headers, cron schedules
├── package.json                # Root dependencies
├── webpack.config.js           # Bundles only script.js + music-system.js
├── tsconfig.json               # TypeScript config (excludes cloudflare-worker)
├── jest.config.js              # Jest for GamesGallery only
├── sw.js                       # Service worker
├── site.webmanifest            # PWA manifest
├── games.json                  # Game catalog
├── robots.txt, sitemap.xml, CNAME, ads.txt
└── .env, .env.local            # Environment files (gitignored)
```

### Scale

| Metric | Count |
|--------|-------|
| Root HTML files | 59 |
| Netlify Functions (handlers) | ~80 |
| Netlify Functions (support modules) | ~48 |
| Named blob stores | 20+ |
| Supabase tables | 4 (live_events, verified_events, engine_runs, transcription_jobs) |
| CSS files | ~30 |
| JS/TS source files (non-function) | ~80+ |
| Hazard ingestion engines | 6 (USGS, NWS, FAA, USCG, Volcano, Embassy) |

---

## 2. Major Public Surfaces

| Surface | Entry point | Lines | Key dependencies |
|---------|-------------|------:|------------------|
| **Homepage** | `index.html` | 21,006 | styles.css, responsive.css, script.js, post-feed-v2.js, post-feed-enhanced.js, CiaMissionGlobe-cdn.js, noteworthy-chat.js, Auth0, AdSense, music-system.js, analytics-tracker.js, cookie-banner.js, christmas-theme-loader.js |
| **Article** | `article.html` | 404 | article.css, article-page.js, article-loader.js, Auth0, comments, AdSense |
| **Archive** | `archive.html` | 468 | posts-read API, inline fetch |
| **Fact-checker game** | `game.html` | 2,770 | multiplayer-game.css, multiplayer-game-manager.js, leaderboard.js, music-system.js, routeProtection-browser.js |
| **Geography game** | `geography-game.html` | 3,762 | geography-game.js (6,243 lines), leaderboard.js |
| **Situation Monitor** | `situation-monitor.html` | 1,137 | D3, TopoJSON, SituationMonitorShell.js (2,085 lines), 27 supporting modules, 6 Netlify proxy functions |
| **Mission Control** | `mission-control.html` | 39 | CiaMissionGlobe.js, globe.gl, Three.js |
| **Contact** | `contact.html` | 1,061 | Inline form → send-contact-form function |
| **Profile** | `profile.html` | 510 | Auth0, user-data function |
| **Category listings** | `category/*.html` | ~4 files | posts-read API |
| **Legal/resource pages** | 12 files | ~500–1,600 each | resource-pages.css, legal-pages.css, quiz-engine.js |
| **Newsletter prefs** | `newsletter-preferences.html` | 427 | email-preferences-link function |
| **Games gallery** | `nativelite-games.html` | 197 | Links to public/games/* |

---

## 3. Privileged / Admin Surfaces

### ✅ New Admin UI (2026-03-22)

All admin functionality is now consolidated at `/admin/` with Auth0 JWT authentication. See `plan.md` Section 11.

| Surface | Auth | Status |
|---------|------|--------|
| `/admin/` | Auth0 JWT + server-verified admin | **Operational** |
| `/admin/#posts` | Same | Post list, search, edit, delete |
| `/admin/#ingestion` | Same | Tweet fetch, profile fetch, CSV import, screenshot extraction |
| `/admin/#newsletter` | Same | Template list, AI generation, send |
| `/admin/#analytics` | Same | Log query, stats, user profile lookup |
| `/admin/#system` | Same | Index rebuild, cleanup, breaking news alerts |

### Legacy admin HTML pages (DEPRECATED — redirected to new admin)

| Page | Status | Redirect |
|------|--------|----------|
| `admin-posts-manager.html` | **Deprecated** (noindex, redirect active) | → `/admin/#posts` |
| `admin-remove-post.html` | **Deprecated** (noindex, redirect active) | → `/admin/#posts` |
| `admin-add-tweets.html` | **Deprecated** (noindex, redirect active) | → `/admin/#ingestion` |
| `admin-newsletter.html` | **Deprecated** (noindex, redirect active) | → `/admin/#newsletter` |
| `admin-analytics.html` | **Deprecated** (noindex, redirect active) | → `/admin/#analytics` |
| `media.html` | **Deprecated** (noindex, redirect active) | → `/admin/#ingestion` |

### Other privileged-adjacent surfaces

| Surface | Risk |
|---------|------|
| `bookmarklet-add-post.html` | Deprecated (noindex). POST target returns 401 without JWT. |
| ~~`test-earthquake.html`, `test-hero-media.html`, `video-preview-test.html`~~ | ✅ Deleted (Correction Session) |

---

## 4. Server/Client Boundary Problems

### 4.1 Unauthenticated mutation endpoints (Critical)

These Netlify Functions accept writes with **no server-side authentication**:

| Function | Mutation | Risk |
|----------|----------|------|
| `remove-post.js` | Deletes post blobs + index entry | Anyone can delete any post |
| `update-post-data.js` | Creates/updates post content | Anyone can inject/modify posts |
| `upload-post-media.js` | Writes to `post-media` blobs | Anyone can upload arbitrary files |
| `upload-newsletter-image.js` | Writes to `newsletter-images` | Anyone can upload to newsletter storage |
| `fetch-tweets-simple.ts` | Writes to `x-posts` store | Anyone can trigger ingestion |
| `fetch-profile-tweets.ts` | Writes to `x-posts` store | Anyone can trigger profile scraping |
| `process-csv-posts.js` | Bulk post creation/update | Anyone can bulk-inject posts |
| `process-post-screenshot.js` | OpenAI Vision + storage update | Anyone can trigger costly AI calls |
| `generate-newsletter-html.js` | OpenAI usage for HTML generation | Anyone can trigger costly AI calls |
| `delete-large-images.js` | Deletes blob objects (including `deleteAll`) | Anyone can wipe media storage |
| `remove-long-posts.js` | Prunes post index | Anyone can trigger index pruning |
| `moderate-comment.js` | OpenAI moderation proxy | Cost/abuse vector |
| `comments-api.js` (DELETE) | Deletes comments by client-supplied `authorId` | Spoofable — no server identity verification |

### 4.2 Fail-open secret checks

These functions check a shared secret, but **skip the check entirely when the env var is missing**:

| Function | Env var | Pattern |
|----------|---------|---------|
| `newsletter-templates.js` | `NEWSLETTER_KEY` | `if (newsletterKey)` — no key = no check |
| `send-newsletter.js` | `NEWSLETTER_KEY` | Same |
| `log-data.js` (GET) | `ADMIN_ANALYTICS_TOKEN` | `if (adminToken && ...)` — no token = open reads |
| `stream-logs.js` | `ADMIN_ANALYTICS_TOKEN` | Same |
| `get-user-profile.js` | `ADMIN_ANALYTICS_TOKEN` | Same |
| `create-job.js`, `process-job.js`, `trigger-job.js`, `trigger-all-queued-jobs.js` | `CLEMS_TOKEN` | `if (!requiredToken) return true` — no token = open |
| `send-custom-email.js` | `ADMIN_TOKEN` / `NEWSLETTER_TOKEN` | When both unset, comparison is skipped |
| `send-website-update.js` | `PUSH_API_KEY` / `ADMIN_API_KEY` | May proceed without auth if keys unset |

### 4.3 Auth0 JWT not verified server-side

`user-data.js` requires a `Bearer` header but **does not cryptographically validate the JWT** against Auth0 JWKS. The code comments acknowledge this is "simplified." This means any string in the Authorization header is accepted as valid.

### 4.4 Token transport via query strings

`admin-newsletter.html`, `admin-analytics.html`, and `media.html` pass secrets as `?token=` in URLs, which:
- Leak via HTTP `Referer` headers to third-party resources (AdSense, Google Fonts)
- Appear in server logs, CDN logs, and browser history
- Are visible in the Netlify function logs

---

## 5. Data / Storage Ownership

### 5.1 Storage systems

| System | Purpose | Access pattern |
|--------|---------|---------------|
| **Netlify Blobs** (`x-posts`) | Primary post store: `post-{id}.json` + `index.json` | 7+ independent writers, 1 canonical reader (`posts-read`) |
| **Netlify Blobs** (20+ other stores) | Comments, leaderboard, user-data, analytics, email prefs, rate limits, game rooms, dalle-images, uploaded-images, newsletter templates/images, push subscriptions, earthquakes cache | Per-feature read/write |
| **Supabase** (`verified_events`) | Hazard engine truth store | Engines write; dashboards + alert pipelines read |
| **Supabase** (`live_events`) | RSS/ingested events for AI context | `ingest-all`, `ingest-live-events` write; `ai-answer` reads |
| **Supabase** (`engine_runs`) | Engine execution logs | `ingest-all` writes; `health` reads |
| **Supabase** (`transcription_jobs`) | Transcription pipeline state | `create-job`, `process-job`, `trigger-job` |
| **Cloudflare KV** (`FEED`) | X/Twitter feed (parallel to `x-posts`) | Cloudflare Worker reads/writes |
| **Cloudflare R2** (S3 API) | Large audio files for transcription | `get-upload-url`, `process-job`, `transcribe-from-url`, `job-status` |

### 5.2 Post ingestion — ✅ RESOLVED: centralized via postStore

> **Status update (2026-03-22):** All `x-posts` writers now go through `lib/postStore.js`. See `migration-notes.md` for details.

The `x-posts` blob store previously had 11 independent write paths with different ID schemes, different field shapes, and inconsistent index formats (`{ ids }` vs `{ ids, urls }`). This has been consolidated:

- All writes use `postStore.writePost()` + `postStore.addToIndex()` or `postStore.writeIndex()`
- Index shape is standardized to `{ ids }` — the `urls` field is retired
- Earthquake posts now use a unified `usgs-` prefix (was `eq-` in earthquake-poller)
- `posts-read.js` retains a temporary fallback for legacy `eq-` posts in direct ID lookups

### 5.3 Duplicate RSS ingestion — ✅ RESOLVED

> **Status update (2026-03-22):** The inline `parseRSSBasic` regex parser was removed from `ingest-all.js`. RSS ingestion is now solely the responsibility of `ingest-live-events.js`, which uses the shared `src/rss/parser.js`.

### 5.4 Cloudflare Worker vs Netlify feed — UNRESOLVED

The Cloudflare Worker (`cloudflare-worker/src/index.ts`) maintains its own KV-backed feed store with oEmbed posts, separate from Netlify Blobs `x-posts`. A `migrate-posts.js` script exists to pull from Netlify → Worker, confirming these are parallel stores. **Decision deferred — product decision needed on canonical feed architecture.**

---

## 6. Performance Risks

### 6.1 Homepage (`index.html`)

| Issue | Impact |
|-------|--------|
| **21,006-line monolith** | Enormous parse/render cost; impossible to cache-bust components independently |
| **Blocking scripts in `<head>`**: `christmas-config.js`, inline block, `christmas-theme-loader.js` | Delays first contentful paint for seasonal theming |
| **Two feed renderers**: `post-feed-v2.js` (2,813 lines) AND `post-feed-enhanced.js` (2,066 lines) both loaded with `defer` | ~4,879 lines of duplicated/overlapping feed logic parsed on every page load |
| **Globe on homepage**: `CiaMissionGlobe-cdn.js` loads Three.js (~700KB) from CDN | Heavy 3D library on a news homepage, even with `defer` |
| **Music system**: `music-system.js` (1,385 lines) loaded on homepage | Audio infrastructure for an optional feature |
| **`script.js`** (10,762 lines) | Monolithic — welcome animations, game logic, header behavior, interactions all bundled |
| **15+ `setInterval` timers** | Music sync, devtools detection, feed readiness polling, newsletter autofill (5s), image retry (30s), countdowns |
| **Canvas fingerprinting** in `analytics-tracker.js` | Non-trivial main-thread work on init |
| **Inline `fetch` in `<head>`** for 50 posts + `prefetch` for 100 posts | Aggressive but reasonable; duplicated with feed scripts that fetch again |
| **Duplicate `preconnect`** to Google Fonts (lines 47–48 and 138–139) | Minor waste |
| **Service worker** precaches aggressively (homepage, CSS, script.js, game pages, images) | Cache warmth vs bandwidth tradeoff |

### 6.2 Situation Monitor — ✅ V2 REBUILT (2026-03-22)

> **Status update:** V2 rebuilt at `v2/situation-monitor.html`. V1 issues documented below for reference.

| Issue (V1) | Impact | V2 Status |
|-------|--------|-----------|
| **Blocking D3 + TopoJSON** in `<head>` | ~200KB synchronous scripts before any content | ✅ Fixed: `<script async>` |
| **15-second polling interval** + 1-second ingest age timer | Continuous network + DOM work | ✅ Fixed: Single 60s refresh cycle |
| **3 `<audio>` elements** with `preload="auto"` | Audio bytes fetched even when muted | ✅ Fixed: Audio removed entirely |
| **Loader hacking** (aggressive overlay removal, visibility monitor) | Multiple timers, DOM polling every 1-2s | ✅ Fixed: Proper lifecycle, no hacking |
| **5,870-line CSS monolith** | Unmaintainable, raw values, no tokens | ✅ Fixed: ~420 lines, V2 tokens |
| **2,085-line shell** | Too many responsibilities in one file | ✅ Fixed: ~265 lines, delegated |

### 6.3 Babel in browser

`security-check.html` and `games-gallery-example.html` load `@babel/standalone` (~1.5MB) for runtime JSX compilation. These are not high-traffic pages but represent an anti-pattern.

### 6.4 Largest files by line count

| File | Lines | Type |
|------|------:|------|
| `index.html` | 21,006 | HTML + inline JS/CSS |
| `script.js` | 10,762 | JS |
| `src/widgets/noteworthy-chat.js` | 9,849 | JS (custom element) |
| `geography-game.js` | 6,243 | JS |
| `src/styles/situation-monitor.css` | 5,870 | CSS |
| `styles/responsive.css` | 5,591 | CSS |
| `styles.css` | 4,672 | CSS |
| `admin-newsletter.html` | 5,050 | HTML + inline JS |
| `admin-analytics.html` | 4,587 | HTML + inline JS |

### 6.5 Netlify Function monoliths

| Function | Lines | Why it matters |
|----------|------:|---------------|
| `generate-earthquake-image.js` | 2,702 | Cold start penalty; SVG rendering + sharp + resvg |
| `noteworthy-chat.js` | 2,144 | Multi-tool chat with web search, image gen, rate limiting |
| `engines/usgs.js` | 2,158 | USGS engine with complex processing |
| `send-earthquake-alert.js` | 2,001 | Image generation + email composition + sending |
| `log-data.js` | 1,851 | Analytics logging + CSV export + email alerts in one handler |
| `inbound-email.js` | 1,767 | Email parsing + image processing + ingestion triggers |
| `send-newsletter.js` | 1,566 | Mass email send with image/CID handling |

---

## 7. Security Risks — Ranked

> **Status update (2026-03-22):** Items marked ✅ have been addressed in the Security Foundation session. See `migration-notes.md` for details.

### Critical

1. ✅ **Unauthenticated content mutations.** `remove-post`, `update-post-data`, `upload-post-media`, `fetch-tweets-simple`, `process-csv-posts`, `delete-large-images`, and others now require admin JWT via `requireAdminAuth` middleware.

2. ✅ **Unauthenticated admin HTML pages.** Legacy admin pages deprecated and redirected to `/admin/`. New admin UI requires Auth0 JWT with server-verified admin role. All 5 shared-secret-only endpoints upgraded to also accept JWT admin auth.

3. ✅ **Fail-open secret checks.** All fail-open patterns (`NEWSLETTER_KEY`, `ADMIN_ANALYTICS_TOKEN`, `CLEMS_TOKEN`, `PUSH_API_KEY`, `ADMIN_TOKEN`, `CAMS_TOKEN`) have been converted to fail-closed (return 500 when env var missing).

### High

4. ✅ **Auth0 JWT not validated.** `user-data.js` now uses `requireAuth` middleware with JWKS-based cryptographic JWT verification. Email is extracted from verified token claims, not from the request.

5. ✅ **Query-string token transport.** New admin UI uses `Authorization: Bearer` headers exclusively. Legacy admin pages still use query params but are deprecated and redirected. Legacy secret paths preserved for backward compatibility via `requireAdminAuthOrSecret`.

6. **Public AI endpoints without rate limiting.** `chatgpt.js`, `chatgpt-stream.js`, `game-ai.js`, `ai-answer.js`, `moderate-comment` — still unprotected. `process-post-screenshot` and `generate-newsletter-html` now require admin auth.

### Medium

7. ✅ **Comment deletion by client-supplied authorId.** `comments-api.js` DELETE now verifies JWT and checks ownership against server-verified `sub`/`email` claims.

8. ✅ **Test/dev pages in production.** Deleted in Correction Session.

9. **Bookmarklet with hardcoded production URL.** Now broken (fetch-tweets-simple returns 401 without admin JWT). Marked for removal.

10. **Websocket server trusts client identity.** Unchanged — deferred (acceptable for casual games).

---

## 8. Biggest Sources of Technical Debt

### 8.1 The 21,000-line homepage

`index.html` is the single file most responsible for architectural fragility. It contains:
- Page layout and structure
- Inline CSS blocks (multiple `<style>` tags)
- JSON-LD structured data
- Early fetch prefetching
- Christmas theme wiring
- Auth0 bootstrapping
- Newsletter signup UI + logic
- Globe initialization
- Music system integration
- Leaderboard fetching
- Feed rendering orchestration
- Scroll/parallax/reveal animations
- Ad slots
- Cookie banner
- Service worker registration

Any change to the homepage requires understanding this entire file. There is no component boundary, no template system, and no way to modify one section without risk to others.

### 8.2 Two feed renderers

`post-feed-v2.js` (2,813 lines) and `post-feed-enhanced.js` (2,066 lines) are both loaded on the homepage. They implement overlapping but not identical feed rendering logic with different function signatures (`renderPostFeedV2` vs `renderPostFeedEnhanced`). Additionally, `components/feed/*.ts` defines a typed feed layer that is not used anywhere.

### 8.3 CSS sprawl

30 CSS files across 5+ directories (`styles/`, `css/`, `src/styles/`, `src/components/`, `assets/css/`) with no consistent organization. Design tokens exist in `src/styles/premium-tokens.css` but are not consistently adopted. The three largest files (`situation-monitor.css` at 5,870 lines, `responsive.css` at 5,591 lines, `styles.css` at 4,672 lines) are themselves monoliths.

### 8.4 Webpack scope

Webpack only bundles `script.js` and `music-system.js` into `dist/`. Every other JS file is loaded as a raw script or ES module. There is no tree-shaking, no code splitting, and no dependency graph optimization for the vast majority of frontend code.

### 8.5 Sub-projects in the monorepo

`KONSCIOUS/`, `clemensconverter/`, and `SpotlightSongs/` are separate concerns living inside the main site's deploy root. They share no code with the main site but are served from the same domain.

---

## 9. What Should Be Deleted, Consolidated, Isolated, Preserved, or Rebuilt

### Delete

- `photo-page.html` and `tweet-page-html.html` — captured third-party HTML, 235 KB each, not site pages
- `test-earthquake.html`, `test-hero-media.html`, `video-preview-test.html` — dev/test pages in production
- `test-resend.js`, `test-generate.js` — test functions exposed as live endpoints
- `src/loader/intel-loader-OLD.css` — superseded by `intel-loader.css`
- `posts-read.ts.backup` — backup file in functions directory
- Duplicate `preconnect` tags in `index.html`

### Consolidate

- **Feed renderers**: `post-feed-v2.js` + `post-feed-enhanced.js` → one canonical feed component
- **Earthquake ingestion**: ✅ `earthquake-poller.js` deprecated; `engines/usgs.js` is the single USGS pipeline
- **Alert notification**: ✅ Unified alert pipeline (`lib/alertEvent.js` + `lib/notifyForEvent.js`) — engines return `notifiableEvents`, orchestrator dispatches
- **RSS ingestion**: `ingest-live-events.js` + `ingest-all.js` RSS block → one RSS ingestion path using `src/rss/parser.js`
- **Geocode proxies**: `geocode-proxy.js` + `geocodeProxy.js` (two files, same purpose) → one
- **Auth middleware**: Repeated admin token checking patterns across 15+ functions → shared `requireAdminAuth` middleware

### Isolate

- Admin surfaces → server-authenticated admin area (not public HTML files)
- `KONSCIOUS/`, `clemensconverter/`, `SpotlightSongs/` → separate deploys or clearly fenced subdirectories
- Situation Monitor → lazy-loaded specialty subsystem
- Games → self-contained subsystem behind `public/games/` + catalog API
- Transcription pipeline (Clemens jobs) → isolated from main site functions

### Preserve

- Core Netlify Functions architecture (thin handlers + shared lib)
- Supabase schema and migration pattern
- Hazard engine system (`engines/*.js`)
- `lib/createPost.js` as canonical post creation path
- Auth0 for user-facing auth
- `premium-tokens.css` design token foundation
- `src/js/homepage/` ES module pattern (extend this, don't replace it)
- `games.json` catalog + validation/audit scripts
- Service worker (with scope reduction)
- Cloudflare R2 for large media storage

### Rebuild

- Homepage (`index.html`) — decompose into composable sections
- Admin UI — server-authenticated, not public HTML
- CSS architecture — consolidate around design tokens
- Build pipeline — extend webpack or replace with Vite for proper code splitting
- ~~Server auth middleware — fail-closed shared auth for all mutation endpoints~~ ✅ Done
- Post feed — single, maintainable feed component

---

## 10. Checkpoint Audit (2026-03-22)

> Full stability checkpoint results are in `stability-checkpoint.md`. Key findings below.

### 10.1 Completed phases

| Phase | Status | Key deliverable |
|-------|--------|----------------|
| Phase 0 — Security Hardening | ✅ Complete | `requireAuth.js` middleware, 20+ endpoints hardened, fail-closed everywhere |
| Phase 3 — Data Consolidation | ✅ Complete | `postStore.js`, 11 writers migrated, index shape standardized |
| Unified Alert System | ✅ Complete (opt-in) | `alertEvent.js`, `notifyForEvent.js`, `alertRateLimit.js`, 6 engines return `notifiableEvents` |
| V2 Situation Monitor | ✅ Complete (dev) | `v2/situation-monitor.html`, 265-line shell (down from 2,085), token-based CSS |
| V2 Homepage Shell | ✅ Complete (dev) | `v2/index.html`, 241 lines (down from 21,006), V2 design system |

### 10.2 New issues identified

1. **Dual notification pipeline risk** — Unified alerts run alongside engine-internal notifications. Enabling `USE_UNIFIED_ALERTS` without removing engine-internal code will cause duplicate notifications.
2. **Unified alerts fire on failed engine runs** — `ingest-all.js` dispatches `notifiableEvents` even when `result.success === false`.
3. **Seven functions still bypass postStore** for `x-posts` blob access — `re-extract-media.js` (writes), plus 6 read-only consumers.
4. **Two design token systems** — `v2/styles/tokens.css` and `src/styles/premium-tokens.css` define overlapping concepts with different names.
5. **V2 CSS still contains raw values** — hex colors, rgba, and px values that should be tokens.
6. **Test/dev pages still deployed** — `test-earthquake.html`, `test-hero-media.html`, `video-preview-test.html` still in production.
7. **Old admin pages still exist** — functionally broken (401) but still served.
8. **CORS headers duplicated** across 20+ functions instead of using shared utility.
9. ✅ **V2 homepage feed, auth, newsletter wiring** — completed (2026-03-23). Feed renders real posts from `posts-read`. Auth0 integration with login/logout/profile nav. Newsletter form wired. All loading/empty/error states handled.
10. ✅ **Admin UI rebuild** — completed. `/admin/` with Auth0 JWT auth, 5 sections, all admin operations accessible.

### 10.3 Assessment

The V2 rebuild is **on the right track**. New modules are clean, focused, and well-designed. Security posture is dramatically improved. The primary risk is not engineering quality — it is **convergence timing**. The repo now carries two parallel systems (V1 and V2) for homepage, situation monitor, CSS, and tokens. This parallelism must converge within 3–5 sessions before it becomes a maintenance burden.

See `stability-checkpoint.md` for full details, correction requirements, and recommended next session.

---

## 11. Live Clip Pipeline (2026-05-25)

### 11.1 Scope

Local-first breaking-news clip toolchain for rights-cleared sources only. Isolated from public site, Netlify deploy path, and existing X import cron (`import-x-posts`).

### 11.2 Placement

| Path | Purpose |
|------|---------|
| `scripts/clip-pipeline/` | CLI modules (record, clip, metadata, review, optional X upload) |
| `data/clip-jobs/` | JSON job records + `audit.jsonl` |
| `data/clips/raw/` | Rolling MKV recordings |
| `data/clips/output/` | X-ready MP4 outputs |
| `data/clips/thumbs/` | JPG thumbnails |
| `data/clips/probe/` | ffprobe validation JSON |

### 11.3 Reused infrastructure

- `ffmpeg-static` (already in `package.json`; used by `process-job.js` for audio)
- New: `ffprobe-static` for validation
- Env pattern: `.env` / `.env.local` via `netlify dev` or direct export

### 11.4 Explicit non-goals (MVP)

- No YouTube media download or yt-dlp
- No Netlify functions for recording/clipping (timeout + disk constraints)
- No changes to `import-x-posts`, `xImportService`, or Cloudflare worker
- No admin `#clips` section (local review server instead)

### 11.5 Job storage

JSON file store under `data/clip-jobs/{id}.json`. Supabase `clip_jobs` table deferred to future phase.
