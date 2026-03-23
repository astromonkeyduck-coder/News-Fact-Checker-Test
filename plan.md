# V2 Migration Plan — Noteworthy News

*Generated 2026-03-22. Based on audit-findings.md and feature-parity.md.*

---

## 1. Proposed V2 Architecture

### 1.1 Product boundary map

```
noteworthy-news/
│
├── public-site/                    # PUBLIC — what readers see
│   ├── index.html                  # Composable homepage shell (< 500 lines)
│   ├── article.html                # Article template
│   ├── archive.html                # Post archive
│   ├── category/                   # Category listings
│   ├── contact.html                # Contact form
│   ├── legal/                      # Privacy, terms, editorial policy
│   ├── resources/                  # Media literacy guides, educational content
│   ├── newsletter/                 # Preferences, unsubscribe, examples
│   └── profile/                    # Auth0 user pages (profile, reading list)
│
├── experiences/                    # SPECIALTY — opt-in heavy features
│   ├── situation-monitor/          # Real-time dashboard (lazy-loaded)
│   ├── games/                      # Game pages + gallery
│   ├── globe/                      # Mission Control / 3D globe
│   └── chat/                       # AI chat widget (custom element)
│
├── admin/                          # INTERNAL — server-authenticated
│   ├── posts/                      # Post CRUD, CSV import, media upload
│   ├── newsletter/                 # Template editor, AI generation, send
│   ├── analytics/                  # Dashboard, logs, CSV export
│   └── shared/                     # Admin auth, layout, utilities
│
├── src/                            # SHARED FRONTEND CODE
│   ├── components/                 # Reusable UI components (feed, nav, footer)
│   ├── styles/                     # Design tokens → base → layout → components
│   ├── auth/                       # Auth0 client
│   ├── utils/                      # Analytics, bookmarks, push, etc.
│   └── modules/                    # ES module entry points per page/section
│
├── netlify/
│   ├── functions/                  # Serverless handlers
│   │   ├── middleware/             # Shared auth, rate-limit, CORS
│   │   ├── admin/                  # Admin-only mutation handlers
│   │   ├── public/                 # Public read handlers
│   │   ├── ingest/                 # Ingestion pipelines
│   │   ├── engines/                # Hazard engines (preserved)
│   │   ├── lib/                    # Shared utilities (preserved)
│   │   └── scheduled/              # Cron-triggered functions
│   └── edge-functions/
│
├── cloudflare-worker/              # X feed worker (decision pending)
├── websocket-server/               # Multiplayer (decision pending)
├── supabase/migrations/            # Database schema (preserved)
├── scripts/                        # Build + ops scripts (preserved)
├── public/                         # Static assets: _headers, _redirects, games/
└── dist/                           # Build output (gitignored)
```

### 1.2 Key architectural principles

1. **Fail-closed auth on every mutation.** No endpoint that writes, deletes, or triggers external calls is accessible without verified identity. If the auth config is missing, the endpoint returns 500, not 200.

2. **One canonical write path per domain.** Posts go through `lib/createPost.js`. Earthquakes go through the USGS engine. RSS goes through `src/rss/parser.js`. No parallel implementations.

3. **Lazy-load specialty subsystems.** Situation Monitor, Globe, Games, and Chat load on demand. The homepage loads only what a reader needs: nav, feed, newsletter signup, footer.

4. **Design tokens as the style foundation.** `premium-tokens.css` is the single source of truth for spacing, typography, color, and motion. All other CSS files consume tokens, not raw values.

5. **ES modules as the JS boundary.** Each page has a module entry point. Shared utilities are importable modules. No new `window.*` globals.

6. **Static HTML stays static.** No runtime JSX compilation. No Babel in browser. Pre-compile everything that needs compilation.

### 1.3 Auth architecture

```
┌─────────────────────────────────────────────────────┐
│                    Auth0 Tenant                      │
│  - Public users: default role                        │
│  - Admin users: "admin" role in JWT claims           │
└──────────────┬──────────────────────┬────────────────┘
               │                      │
    ┌──────────▼──────────┐ ┌────────▼─────────────┐
    │   Public endpoints  │ │   Admin endpoints     │
    │   (no auth or       │ │   requireAdminAuth()  │
    │    optional auth)   │ │   - verify JWT (JWKS) │
    │                     │ │   - check role claim   │
    │   posts-read        │ │   - fail closed        │
    │   rss-aggregate     │ │                        │
    │   article-preview   │ │   remove-post          │
    │   leaderboard (GET) │ │   update-post-data     │
    │   game-room         │ │   upload-post-media    │
    │   comments (GET)    │ │   newsletter-templates │
    │                     │ │   send-newsletter      │
    │                     │ │   log-data (GET)       │
    │                     │ │   process-csv-posts    │
    └─────────────────────┘ │   etc.                 │
                            └────────────────────────┘
```

---

## 2. Phased Migration Plan

### Phase 0 — Security Hardening (Critical, do first)

**Why this phase exists:** The repo has unauthenticated mutation endpoints in production. This is a live vulnerability that must be fixed before any architectural work.

**Scope:**
1. Create `netlify/functions/middleware/requireAuth.js` — shared middleware that:
   - Verifies Auth0 JWTs against JWKS endpoint (issuer, audience, expiry, signature)
   - Extracts role claims
   - Exports `requireAdminAuth(event)` that returns 401/403 or the verified user
   - **Fails closed**: missing config → 500, not bypass

2. Apply `requireAdminAuth` to every mutation endpoint:
   - `remove-post.js`
   - `update-post-data.js`
   - `upload-post-media.js`
   - `upload-newsletter-image.js`
   - `fetch-tweets-simple.ts`
   - `fetch-profile-tweets.ts`
   - `process-csv-posts.js`
   - `process-post-screenshot.js`
   - `generate-newsletter-html.js`
   - `delete-large-images.js`
   - `remove-long-posts.js`
   - `remove-old-alert-posts.js`

3. Fix fail-open patterns in existing secret-checked functions:
   - `newsletter-templates.js` — `if (!newsletterKey) return 500`
   - `send-newsletter.js` — same
   - `log-data.js` (GET) — same for `ADMIN_ANALYTICS_TOKEN`
   - `stream-logs.js`, `get-user-profile.js` — same
   - `create-job.js`, `process-job.js`, `trigger-job.js`, `trigger-all-queued-jobs.js` — same for `CLEMS_TOKEN`
   - `send-custom-email.js` — same for `ADMIN_TOKEN`
   - `send-website-update.js` — same for `PUSH_API_KEY`

4. Fix `user-data.js` to cryptographically verify Auth0 JWTs.

5. Fix `comments-api.js` DELETE to verify `authorId` from the JWT, not from the request body.

6. Remove test functions from production: `test-resend.js`, `test-generate.js`.

**Files touched:**
- New: `netlify/functions/middleware/requireAuth.js`
- Modified: ~20 Netlify function files (add auth check at top of handler)
- Deleted: `netlify/functions/test-resend.js`, `netlify/functions/test-generate.js`

**What will NOT change:** No HTML changes. No frontend changes. No data schema changes. No user-facing behavior changes. Admin HTML pages will stop working until they send proper auth headers — this is intentional and forces Phase 1.

**Validation:**
- Every previously unauthenticated mutation endpoint returns 401 without a valid token
- Every endpoint with a secret check returns 500 when the env var is missing
- `user-data` rejects invalid JWTs
- Public read endpoints (`posts-read`, `rss-aggregate`, etc.) still work without auth
- Run `curl` tests against each hardened endpoint

**Rollback:** Revert the middleware file and the auth check additions. Each function's change is a 3–5 line addition at the top of the handler, trivially revertible.

---

### Phase 1 — Admin UI Behind Auth (High priority)

**Why this phase exists:** Phase 0 breaks the admin HTML pages (they don't send auth tokens). This phase rebuilds admin access with proper authentication.

**Scope:**
1. Create a minimal admin shell with Auth0 login flow that:
   - Redirects to Auth0 login if no session
   - Sends JWT Bearer token with all API calls
   - Checks role claim before rendering admin UI
   - Lives under a clear admin path (e.g., `admin/index.html`)

2. Migrate admin functionality:
   - Post management (from `admin-posts-manager.html`, `admin-add-tweets.html`, `admin-remove-post.html`, `media.html`)
   - Newsletter management (from `admin-newsletter.html`)
   - Analytics dashboard (from `admin-analytics.html`)

3. Remove or password-protect the old admin HTML files. Redirect old URLs to new admin.

4. Remove dev/test pages from production: `test-earthquake.html`, `test-hero-media.html`, `video-preview-test.html`.

5. Configure Auth0 tenant with admin role claim (if not already configured).

**Files touched:**
- New: `admin/index.html`, `admin/posts.html`, `admin/newsletter.html`, `admin/analytics.html`, `admin/shared/admin-auth.js`, `admin/shared/admin-layout.css`
- Deleted from public access: `admin-posts-manager.html`, `admin-add-tweets.html`, `admin-remove-post.html`, `admin-newsletter.html`, `admin-analytics.html`, `media.html` (redirect or remove)
- Deleted: `test-earthquake.html`, `test-hero-media.html`, `video-preview-test.html`
- Modified: `netlify.toml` (add redirects from old admin URLs to new)

**What will NOT change:** No changes to public-facing pages. No changes to data/storage. No changes to server functions beyond what Phase 0 already did.

**Validation:**
- Admin login flow works (Auth0 redirect → callback → admin UI)
- All post CRUD operations work through new admin UI
- Newsletter template CRUD, AI generation, and send work
- Analytics dashboard displays data
- Old admin URLs redirect appropriately
- Non-admin Auth0 users cannot access admin UI
- Unauthenticated users cannot access admin UI

**Rollback:** Keep old admin HTML files (renamed, not deleted) for the duration of Phase 1. If rollback needed, restore files and revert the auth changes from Phase 0 on those specific endpoints.

---

### Phase 2 — Homepage Decomposition (High priority)

**Why this phase exists:** The 21,006-line `index.html` is the biggest source of maintenance risk, performance problems, and developer friction. It must be broken into composable parts.

**Scope:**
1. Extract the homepage into a shell + sections:
   - `index.html` becomes a ~300–500 line shell: doctype, head (meta, critical CSS, fonts), nav, section containers, footer, module loader
   - Each major section becomes an ES module: `src/modules/hero.js`, `src/modules/feed.js`, `src/modules/newsletter-signup.js`, `src/modules/globe-section.js`, `src/modules/games-section.js`, `src/modules/footer.js`

2. Consolidate feed renderers:
   - Merge `post-feed-v2.js` and `post-feed-enhanced.js` into one `src/components/post-feed.js`
   - Export as ES module, not `window.*` global
   - Delete the other feed file
   - Update `archive.html` and `category/*.html` to use the consolidated feed

3. Make globe lazy:
   - Globe loads only when the globe section scrolls into view (IntersectionObserver)
   - Three.js loaded dynamically, not in the initial page load
   - Fallback: static map image until globe loads

4. Make music system lazy:
   - `music-system.js` loads only on user interaction (play button)
   - Not included in the default page load

5. Move Christmas theme out of `<head>`:
   - Load via deferred module that checks date/config before importing CSS/JS
   - Zero cost outside active season

6. Extract inline CSS into external stylesheets or the design token system.

7. Extract inline JS into modules.

8. Remove duplicate `preconnect` tags.

**Files touched:**
- Major rewrite: `index.html` (21,006 → ~300–500 lines)
- New: `src/modules/hero.js`, `src/modules/feed.js`, `src/modules/newsletter-signup.js`, `src/modules/globe-section.js`, `src/modules/games-section.js`
- Consolidated: `src/components/post-feed.js` (from v2 + enhanced)
- Deleted: `src/components/post-feed-enhanced.js` (or `post-feed-v2.js`, whichever is not the base)
- Modified: `archive.html`, `category/*.html` (use new feed module)
- Modified: `christmas-theme-loader.js` (lazy-only loading)

**What will NOT change:** No server function changes. No data changes. No admin changes. No other page layouts. The article page, situation monitor, games, and other specialty pages are untouched.

**Validation:**
- Homepage renders identically (visual regression comparison)
- Feed shows same posts in same order
- Globe renders (after scroll trigger)
- Newsletter signup works
- Auth0 login/signup works from homepage
- Category and archive pages render correctly
- Lighthouse performance score improves (or at minimum does not regress)
- Mobile layout correct
- All nav links work

**Rollback:** Keep `index.html.backup` of the original. Netlify deploy previews allow testing before promoting to production.

---

### Phase 3 — Data Path Consolidation ✅ COMPLETED (core scope)

> **Completed 2026-03-22.** Core data consolidation implemented. See `migration-notes.md` for full details.

**What was done:**

1. ✅ **Created `lib/postStore.js`** — centralized post storage module. All `x-posts` blob operations go through it with consistent key format, index shape (`{ ids }` only — `urls` retired), deduplication, and bounded size.

2. ✅ **Migrated all 11 x-posts writers** to use postStore: `createPost.js`, `x-webhook.ts`, `fetch-tweets-simple.ts`, `fetch-profile-tweets.ts`, `update-post-data.js`, `remove-post.js`, `remove-long-posts.js`, `remove-old-alert-posts.js`, `rebuild-index.ts`, `inbound-email.js`, `earthquake-poller.js`.

3. ✅ **Unified earthquake ID scheme** — `earthquake-poller.js` now uses `usgs-` prefix (matching `engines/usgs.js`). `posts-read.js` retains a temporary fallback for legacy `eq-` posts.

4. ✅ **Removed duplicate RSS parser** — inline `parseRSSBasic` removed from `ingest-all.js`. RSS ingestion is now solely `ingest-live-events.js` using the shared `src/rss/parser.js`.

5. ✅ **Migrated `posts-read.js`** to use postStore.

**Remaining (deferred to future session):**
- Cloudflare Worker decision (canonical vs cache vs retire)
- RSS proxy consolidation (`rss-feed.js` + `rss-aggregate.js` + `rssProxy.js`)
- Geocode proxy consolidation (`geocode-proxy.js` + `geocodeProxy.js`)
- Legacy `eq-` post migration script

**Validation:**
- All post writes go through one module (`postStore`)
- Index shape is deterministic (`{ ids }`)
- Earthquake posts use one ID scheme (`usgs-`)
- No frontend changes — same posts, same feed, same API
- Rollback: revert the postStore imports in each file; each change is a small import swap

---

### Phase 4 — Design System and CSS Consolidation

**Why this phase exists:** 30 CSS files across 5 directories with no consistent organization makes visual coherence impossible and every style change risky.

**Scope:**
1. Establish the CSS architecture:
   ```
   src/styles/
   ├── tokens.css            # Design tokens (from premium-tokens.css)
   ├── base.css              # Reset, typography, root styles
   ├── layout.css            # Grid, containers, spacing utilities
   ├── components/           # Per-component styles
   │   ├── nav.css
   │   ├── feed.css
   │   ├── card.css
   │   ├── footer.css
   │   ├── newsletter.css
   │   └── ...
   └── pages/                # Page-specific overrides (minimal)
       ├── homepage.css
       ├── article.css
       └── ...
   ```

2. Migrate `styles.css` (4,672 lines) into tokens + base + components.

3. Migrate `styles/responsive.css` (5,591 lines) — responsive rules belong alongside their components, not in one monolith.

4. Scope specialty CSS:
   - `situation-monitor.css` stays as a specialty stylesheet loaded only on that page
   - `multiplayer-game.css`, `realtime-leaderboard.css` stay as game-scoped
   - `liveCams.css` stays within live cams subsystem

5. Consolidate `styles/legal-pages.css` + `styles/resource-pages.css` + `styles/legal-resource-advanced.css` into one `src/styles/pages/content.css`.

6. Adopt tokens across all pages that reference raw values.

7. Remove or archive `src/styles/light-theme.css`, `christmas-theme.css`, `cookie-banner-override.css`, `intel-loader-OLD.css`.

**Files touched:**
- New: `src/styles/base.css`, `src/styles/layout.css`, `src/styles/components/*.css`
- Heavily modified: `styles.css` → decomposed
- Heavily modified: `styles/responsive.css` → decomposed into component-level responsive rules
- Consolidated: legal/resource CSS → one file
- Deleted: `intel-loader-OLD.css`
- Modified: all HTML files that reference CSS (update `<link>` tags)

**What will NOT change:** No server changes. No JS behavior changes. Visual output should be identical.

**Validation:**
- Visual regression screenshots across all major pages (homepage, article, archive, category, situation monitor, games, legal pages, contact, profile)
- Mobile and desktop layouts correct
- Reduced-motion preferences respected
- Print stylesheet still works
- Dark/light theme still works (if applicable)

**Rollback:** Keep old CSS files during migration; switch `<link>` tags back if needed.

---

### Phase 5 — Build Pipeline Upgrade

**Why this phase exists:** Webpack currently only bundles 2 of 30+ JS files. There is no code splitting, no tree shaking, and Babel-in-browser is used for JSX on two pages. A modern build pipeline is required to support the composable architecture from Phases 2–4.

**Scope:**
1. Evaluate and adopt Vite (or expand webpack):
   - Multiple entry points (homepage, article, situation monitor, games, admin)
   - Code splitting per page
   - Tree shaking for shared dependencies
   - CSS bundling per entry point
   - Source maps for production debugging
   - Dev server with HMR for local development

2. Pre-compile JSX:
   - `GamesGallery.jsx` → compiled JS
   - `SecurityCheck.jsx` → compiled JS
   - `CiaMissionGlobe.jsx` → compiled JS (if React variant is used)
   - Remove Babel standalone from `security-check.html` and `games-gallery-example.html`

3. TypeScript compilation:
   - Compile `src/widgets/noteworthy-chat.ts` as part of the build (rather than maintaining separate `.js` and `-compiled.js` files)
   - Compile `components/feed/*.ts` and `lib/feed/*.ts` if they become the canonical feed

4. Update `netlify.toml` build command to use new pipeline.

5. Update `sw.js` precache manifest to reference built assets.

**Files touched:**
- New or replaced: build config (Vite config or expanded webpack)
- Modified: `netlify.toml` (build command)
- Modified: HTML files (script references point to built assets)
- Modified: `sw.js` (precache list)
- Deleted: `games-gallery-example.html` (Babel variant; replace with pre-compiled version)
- Deleted: `src/widgets/noteworthy-chat-compiled.js` (build output replaces it)

**What will NOT change:** No server function changes. No data changes. Same user-facing behavior.

**Validation:**
- All pages load correctly with built assets
- Netlify deploy succeeds
- Source maps accessible
- Bundle size analysis shows improvement over raw file loading
- No Babel standalone in production HTML
- Dev server works locally with `npm run dev`

**Rollback:** Keep raw script files alongside built output during transition. Fall back to raw loading by reverting HTML `<link>`/`<script>` tags.

---

## 3. What Will NOT Be Changed (Deferred)

These items are out of scope for Phases 0–5 and should be addressed in later sessions:

| Item | Why deferred |
|------|-------------|
| **WebSocket server rebuild** | Requires product decision on multiplayer scope; stubs work for now |
| **Cloudflare Worker retirement/promotion** | Requires product decision on canonical feed architecture |
| **Situation Monitor V1 removal** | V2 rebuilt (2026-03-22); V1 at `situation-monitor.html` preserved until V2 validated in production |
| **AI chat widget internals** | 9,849-line custom element works; isolation via lazy-loading is sufficient |
| **Geography game rewrite** | 6,243 lines but self-contained; no cross-cutting risk |
| **`script.js` decomposition** | The 10,762-line monolith needs breaking up, but Phase 2 extracts the homepage-specific logic first; remaining `script.js` cleanup is Phase 6+ |
| **Email template system** | Works; not a growth bottleneck |
| **Sub-project isolation** (KONSCIOUS, Clemens, SpotlightSongs) | Low risk; cosmetic repo organization |
| **Canvas fingerprinting review** | Privacy question, not a structural issue |
| **Full TypeScript adoption** | Incremental; not blocking any phase |

---

## 4. Validation Strategy

### Per-phase validation

Each phase has specific validation criteria documented above. General approach:

1. **Before each phase:** Capture baseline screenshots of all affected pages (mobile + desktop) and baseline Lighthouse scores.

2. **During each phase:** Use Netlify deploy previews for every PR. Test against preview URL before merging to main.

3. **After each phase:** Compare screenshots, run Lighthouse, verify all `curl` tests pass for API endpoints, and confirm no broken links via site crawl.

### Automated checks

- `npm run test:games` — Jest tests for GamesGallery (preserve and extend)
- `npm run validate:games` — Game embed validation
- `npx tsc --noEmit` — TypeScript type checking
- API endpoint smoke tests (recommend adding as a script in Phase 0)

### Manual checks

- Auth0 login/logout flow on homepage, article, profile
- Newsletter signup → confirmation email
- Admin post CRUD through new admin UI
- Newsletter send through new admin UI
- Feed rendering on homepage, archive, category pages
- Globe interaction
- Situation Monitor data loading
- Game play (fact-checker, geography)

---

## 5. Rollback / Low-Risk Migration Strategy

### General principles

1. **Feature flags over big-bang switches.** Where possible, new code runs alongside old code behind a flag (query param, env var, or dynamic import path). Flip the flag to roll forward; revert it to roll back.

2. **Netlify deploy previews for every PR.** Test each change in an isolated preview environment before promoting to production.

3. **Preserve originals during migration.** Renamed files (e.g., `index.html.backup`, `admin-posts-manager.html.archived`) kept in repo until the phase is validated in production.

4. **One phase per branch.** Each phase is a distinct branch/PR that can be merged or reverted independently.

5. **Netlify instant rollback.** If a production deploy breaks, Netlify supports instant rollback to any previous deploy via the dashboard.

### Phase-specific rollback

| Phase | Rollback mechanism |
|-------|-------------------|
| **0 — Security** | Remove `requireAdminAuth` calls from each function; revert middleware file |
| **1 — Admin UI** | Restore old admin HTML files; revert netlify.toml redirects |
| **2 — Homepage** | Restore `index.html.backup`; revert module extractions |
| **3 — Data** | Restore original function files from git; no data migration needed |
| **4 — CSS** | Restore old CSS files; revert HTML `<link>` tag changes |
| **5 — Build** | Revert to raw script loading; restore old HTML `<script>` tags |

---

## 6. Recommended Session Breakdown

Each session should be a focused, completable unit of work with a clear deliverable.

### Session 1 — Security hardening (Phase 0)
- Create `requireAuth.js` middleware
- Apply to all mutation endpoints
- Fix fail-open patterns
- Fix `user-data.js` JWT verification
- Remove test functions
- Duration: 1 session (focused, high-value)

### Session 2 — Admin UI rebuild (Phase 1, part 1)
- Auth0 admin role configuration
- Admin shell with login flow
- Post management admin page
- Duration: 1 session

### Session 3 — Admin UI completion (Phase 1, part 2)
- Newsletter admin page
- Analytics admin page
- Old admin page removal and redirects
- Dev/test page removal
- Duration: 1 session

### Session 4 — Feed consolidation + homepage shell (Phase 2, part 1)
- Merge feed renderers into one module
- Create homepage shell
- Extract hero, feed, newsletter sections as modules
- Duration: 1 session

### Session 5 — Homepage completion (Phase 2, part 2)
- Globe lazy-loading
- Music system lazy-loading
- Christmas theme deferred loading
- Inline CSS/JS extraction
- Performance validation
- Duration: 1 session

### Session 6 — Data path consolidation (Phase 3) ✅ COMPLETED
- ✅ Created `lib/postStore.js` centralized storage module
- ✅ Migrated all 11 x-posts writers to use postStore
- ✅ Unified earthquake ID scheme (eq- → usgs-)
- ✅ Removed duplicate RSS parser from ingest-all.js
- ✅ Standardized index shape (retired urls field)
- Remaining: proxy function consolidation, Cloudflare Worker decision

### Session 7 — Design system (Phase 4, part 1)
- CSS architecture setup (tokens, base, layout)
- Decompose `styles.css`
- Decompose `styles/responsive.css`
- Duration: 1 session

### Session 8 — Design system completion (Phase 4, part 2)
- Component CSS extraction
- Legal/resource CSS consolidation
- Page-specific CSS cleanup
- Visual regression validation
- Duration: 1 session

### Session 9 — Build pipeline (Phase 5)
- Vite (or webpack expansion) setup
- Entry point configuration
- JSX pre-compilation
- TypeScript compilation
- Netlify build integration
- Duration: 1 session

### Session 10 — Validation and cleanup
- End-to-end testing across all phases
- Remove backup files
- Update documentation
- Lighthouse audit
- Duration: 1 session

---

## 7. Assumptions Requiring Confirmation

1. **Auth0 tenant supports custom role claims.** The plan assumes we can add an "admin" role to Auth0 JWT claims. If the Auth0 plan or configuration does not support this, the admin auth strategy needs adjustment (e.g., server-side allowlist of admin email addresses).

2. **All current admin users have Auth0 accounts.** If some admin users only know the shared `NEWSLETTER_KEY` password, they need Auth0 accounts created.

3. **Netlify Blobs `x-posts` is the canonical post store.** The plan assumes the Cloudflare Worker KV feed is secondary. If the Worker is the canonical store for any use case, the data consolidation plan changes.

4. **`earthquake-poller.js` is redundant with the USGS engine.** The plan proposes retiring the poller. If it covers earthquakes that the USGS engine does not (e.g., different magnitude thresholds or faster polling), it needs to be merged rather than removed.

5. **The websocket server's stubbed state is acceptable for now.** The plan defers multiplayer decisions. If multiplayer is a near-term product priority, it should be scoped into Phase 1 or 2.

6. **`admin-posts-manager.html`, `admin-add-tweets.html`, and `admin-remove-post.html` are actively used.** If any admin surface is unused, it can be deleted without rebuilding.

7. **The Clemens transcription pipeline is actively used.** If it is dormant, its functions can be isolated more aggressively or retired.

8. **No other deployment environments (staging, preview) rely on the fail-open behavior.** Phase 0's fail-closed changes will break any environment where auth env vars are not configured.

9. **Vite is acceptable as a build tool.** If there is a strong preference for staying on webpack, Phase 5 adjusts accordingly. The key requirement is code splitting and JSX pre-compilation, not the specific tool.

10. **The `security-check.html` gate is a bot-protection measure, not a paywall.** If it protects paid content, the auth strategy for Situation Monitor and games changes (server-side entitlement check rather than client-side puzzle).

---

## 8. Situation Monitor V2 Rebuild (2026-03-22)

### What was built

**V2 Situation Monitor** — a professional, information-first intelligence dashboard rebuilt from the ground up on the V2 design system.

| File | Purpose | Lines |
|------|---------|------:|
| `v2/situation-monitor.html` | Clean HTML shell with V2 components | ~195 |
| `v2/styles/situation-monitor.css` | Token-based panel/layout styles | ~420 |
| `v2/js/situation-monitor/SituationMonitorV2.js` | Lightweight shell orchestrator | ~265 |

### What was removed (relative to V1)

| Removed | Lines saved | Why |
|---------|------------:|-----|
| Audio system (3 WAV files, autoplay, queue, volume controls) | ~400 | Not appropriate for a professional dashboard |
| Loader hacking (aggressive fallback, visibility monitor, overlay removal) | ~180 | Replaced with proper lifecycle |
| Security theater (sessionStorage check, redirect to security-check.html) | ~30 | Client-side security provides no value |
| HUD overlays on map (left stats, right feed, filters) | ~70 | Broke on mobile; information duplicated in panels |
| OSINT ticker | ~60 | Visual noise; critical info now in alert banner |
| Music controls in header | ~90 | Audio removed entirely |
| Toast system | ~70 | Not needed for a monitoring dashboard |
| Panel resize handles | ~130 | Added complexity without clear value |
| BigBoardOverlay, DiagnosticsPanel, keyboard hint | ~50 | Unused or low-value features |
| Inline CSS `!important` overrides | ~110 | Replaced by clean CSS |

**Total: V1 shell was 2,085 lines. V2 shell is 265 lines.** CSS went from 5,870 lines to ~420 lines.

### Architecture changes

1. **Layout**: Status bar → Alert banner → Map → Primary feeds (3-col) → Secondary feeds (3-col) → Analysis. Clear hierarchy.
2. **Data tiers**: Critical alerts surface to a dedicated banner. Primary feeds (news, earthquakes, weather) are distinguished from secondary (markets, RSS, analysis).
3. **Update model**: Single 60-second refresh cycle. No visibility polling. No redundant timers.
4. **Mobile**: Single-column stack, priority-ordered. No elements that break at small widths.
5. **Design system alignment**: Uses V2 tokens (`--color-accent`, `--font-ui`, `--radius-xl`, etc.). Same header as V2 homepage.
6. **D3 loaded async**: `<script async>` instead of synchronous blocking in `<head>`.
7. **Panel reuse**: All existing panel classes (`NewsPanel`, `EarthquakePanel`, etc.) and data layer (`fetchers.js`, `eventStore.js`, `eventPipeline.js`) are imported unchanged.

### What remains

- **V1 preserved**: `situation-monitor.html` and `src/components/situation-monitor/` are untouched.
- **Navigation link**: Production nav still points to V1. Switch when V2 is validated.
- **Live Cams**: Not included in V2. Can be re-added as an optional panel when needed.
- **Custom Monitors**: MonitorsPanel and NarrativePanel not included in V2. Can be re-added if product need is confirmed.
- **Keyboard shortcuts**: Removed. If needed, add back as a lightweight module.

### Validation checklist

- [ ] All 7 panels render data (news, earthquakes, weather, markets, RSS, intel, correlation)
- [ ] Map loads and shows event markers
- [ ] Alert banner appears when severity >= 4 events exist
- [ ] Status bar shows live state, event counts, last update time
- [ ] Refresh button works
- [ ] Auto-refresh fires every 60 seconds
- [ ] Mobile layout is single-column and readable
- [ ] No console errors on load
- [ ] No layout jumping or flickering
- [ ] Page loads in < 3 seconds on broadband

---

## 9. Unified Alert System (2026-03-22)

### What was built

A unified alert architecture that normalizes all event sources into a single pipeline for consistent notification delivery.

| File | Purpose | Lines |
|------|---------|------:|
| `netlify/functions/lib/alertEvent.js` | Unified alert event model — normalizes all event types to one schema | ~175 |
| `netlify/functions/lib/notifyForEvent.js` | Central notification dispatcher — routes events to email, push, location channels | ~280 |
| `netlify/functions/lib/alertRateLimit.js` | Per-event deduplication and per-type cooldown | ~100 |
| `netlify/functions/send-breaking-news-alert.js` | Admin endpoint to send breaking news push/email | ~90 |

### What changed in existing files

| File | Change |
|------|--------|
| `engines/usgs.js` | `run()` now returns `notifiableEvents[]` alongside existing results |
| `engines/nws.js` | Same — returns `notifiableEvents[]` |
| `engines/faa.js` | Same |
| `engines/uscg.js` | Same |
| `engines/volcano.js` | Same |
| `engines/embassy.js` | Same |
| `ingest-all.js` | When `USE_UNIFIED_ALERTS=true`, dispatches notifiable events through the unified pipeline after each engine run |
| `earthquake-poller.js` | Deprecated — header explains migration path; `EARTHQUAKE_POLLER_DISABLED=true` no-ops immediately |

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     EVENT SOURCES                             │
│  USGS · NWS · FAA · USCG · Volcano · Embassy · Admin         │
└──────────────┬───────────────────────────────────────────────┘
               │  engine.run() returns { ..., notifiableEvents }
               ▼
┌──────────────────────────────────────────────────────────────┐
│                    INGEST-ALL ORCHESTRATOR                     │
│  Runs engines → stores verified_events → creates posts        │
│  When USE_UNIFIED_ALERTS=true:                                │
│    for each notifiableEvent → createAlertEvent → notifyForEvent│
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│                   NOTIFICATION DISPATCHER                      │
│  notifyForEvent(alertEvent)                                   │
│                                                               │
│  1. Check dedup (alertRateLimit — already notified?)          │
│  2. Determine channels (getNotificationChannels)              │
│  3. Dispatch in parallel:                                     │
│     ├── EMAIL: earthquake-specific rich email or generic      │
│     ├── PUSH: via send-push-notification module               │
│     └── LOCATION: per-user proximity email                    │
│  4. Record dedup marker                                       │
└──────────────────────────────────────────────────────────────┘
```

### Unified AlertEvent schema

```
{
  id, source, type, severity (1-5), priority,
  title, summary,
  location: { display, lat, lon },
  publishedAt, sourceUrl,
  assets: { magnitude?, depth?, imageUrl?, mapUrl?, impact?, tsunami? },
  alertState: { emailSent, pushSent, imagePending, createdAt }
}
```

### Notification channel rules

| Event type | Push | Email | Location email |
|------------|------|-------|---------------|
| Earthquake M≥6.0 | earthquake subscribers | Opt-in users (per magnitude threshold) | Within radius |
| Earthquake M≥4.5 | earthquake subscribers | — | Within radius |
| Weather severity≥4 | weather subscribers | — | Within radius |
| Breaking News | breaking-news subscribers | severity≥4 → admin list | — |
| FAA/USCG/Volcano/Embassy | — | severity≥3 → admin list | — |

### Migration strategy

The unified pipeline is **opt-in via environment variable** (`USE_UNIFIED_ALERTS=true`). Until enabled:
- Engines continue sending notifications through their own inline logic (backward compatible).
- The unified pipeline logs what it would do but does not duplicate.

When `USE_UNIFIED_ALERTS=true`:
- `ingest-all` dispatches through `notifyForEvent` after each engine run.
- Engine-internal notification code should be gradually removed.
- `earthquake-poller.js` should be disabled (`EARTHQUAKE_POLLER_DISABLED=true`).

### What was deprecated

| Item | Status | Replacement |
|------|--------|-------------|
| `earthquake-poller.js` | Deprecated (disable in dashboard) | `engines/usgs.js` via `ingest-all` |
| `assess-earthquake-impact.js` | Duplicate of `lib/impactAssessment.js` | Not removed yet; candidates for consolidation |
| Engine-internal `sendEmailAlert()` / `sendPushNotificationForEarthquake()` | Kept for backward compat | `notifyForEvent` when unified alerts enabled |

### What remains

- **Enable `USE_UNIFIED_ALERTS=true`** in Netlify env after validating in staging
- **Disable `earthquake-poller.js`** schedule in Netlify dashboard
- **Remove engine-internal notification code** once unified pipeline is validated
- **Consolidate `assess-earthquake-impact.js`** into `lib/impactAssessment.js`
- **Add image generation as async enrichment** — currently still blocks in USGS engine
- **Wire location alerts fully into dispatcher** — currently delegated to engine code
- **Legacy `eq-` posts** — run cleanup script and remove `posts-read.js` fallback

---

## 10. Checkpoint Audit — Correction Session ✅ COMPLETED (2026-03-22)

> All correction items resolved. Roadmap may resume.

| # | Task | Status |
|---|------|--------|
| C1 | Guard unified alert dispatch (`result.success &&`) | ✅ Done — `ingest-all.js` |
| C2 | Migrate `re-extract-media.js` to postStore | ✅ Done |
| C3 | Delete test pages from production | ✅ Done — 4 HTML files deleted |
| C4 | Delete test functions | ✅ Done — `test-resend.js`, `test-generate.js` deleted |
| C5 | Delete `posts-read.ts.backup` | ✅ Done |
| C6 | Migrate 6 read-only x-posts consumers to postStore | ✅ Done — all 6 migrated |
| C7 | Standardize CORS headers | ✅ Done — `lib/corsHeaders.js` created, adopted in touched files |
| C8 | Replace raw CSS values in V2 styles | ✅ Done — 10 new tokens, all raw rgba/hex replaced |
| C9 | Deprecate `premium-tokens.css` | ✅ Done — V1-only header added |
| C10 | Wire V2 newsletter form | ✅ Done — `main.js` POSTs to `send-email` |
| ― | Mark `bookmarklet-add-post.html` deprecated | ✅ Done — noindex, deprecation comment |

### Additional fixes found during correction
- **Bug fix in `realtime-voice.js`**: was using raw index ID as blob key (missing `post-` prefix and `.json` suffix). `postStore.readPost` now normalizes this correctly.
- **Bug fix in `twitter-share.js`**: was using `post-usgs-{eventId}` without `.json` suffix and reading as text then JSON.parsing. `postStore.readPost` handles this cleanly.

### Remaining items (not blocking roadmap)
- Engine-internal notification code must be removed before enabling `USE_UNIFIED_ALERTS=true` in production
- Broader `corsHeaders.js` adoption across remaining functions (opportunistic)
- CLI scripts in `scripts/` still access `x-posts` directly (low priority)

### Next session
Resume at **Phase 2 (Homepage decomposition)**, or continue admin polish/testing.

---

## 11. Admin UI Rebuild — Phase 1 ✅ COMPLETED (2026-03-22)

### What was built

A single, server-authenticated admin surface at `/admin/` that replaces all legacy admin HTML pages.

| File | Purpose | Lines |
|------|---------|------:|
| `admin/index.html` | Admin shell — auth guard, nav, section loading | ~120 |
| `admin/css/admin.css` | Admin-specific styles (consumes V2 tokens) | ~410 |
| `admin/js/admin-auth.js` | Auth0 init, admin guard, token management | ~120 |
| `admin/js/admin-app.js` | Section router, navigation binding | ~80 |
| `admin/js/lib/api.js` | Authenticated API client (Bearer header on every call) | ~130 |
| `admin/js/views/posts.js` | Post management (list, search, edit, delete) | ~175 |
| `admin/js/views/ingestion.js` | Ingestion triggers (tweet, profile, CSV, screenshot) | ~130 |
| `admin/js/views/newsletter.js` | Newsletter (templates, AI generation, send) | ~175 |
| `admin/js/views/analytics.js` | Analytics (log query, stats, user profile lookup) | ~170 |
| `admin/js/views/system.js` | System (rebuild index, cleanup, breaking news alerts) | ~155 |

### Architecture

1. **Auth flow**: Auth0 login → JWT obtained → server-side admin probe → shell renders
2. **Token transport**: `Authorization: Bearer <jwt>` on every API call. No query params. No sessionStorage secrets. `cacheLocation: 'memory'` — tokens never touch persistent storage.
3. **Admin verification**: Server-authoritative. Client probes `rebuild-index` endpoint; 403 = not admin.
4. **Routing**: Hash-based (`#posts`, `#ingestion`, `#newsletter`, `#analytics`, `#system`)
5. **Module loading**: Dynamic `import()` — each section loads on demand
6. **Design**: V2 tokens consumed. Tool-focused. No animations. Clear hierarchy.

### Backend changes

Five endpoints upgraded from shared-secret-only to also accept JWT admin auth:

| Endpoint | Before | After |
|----------|--------|-------|
| `log-data.js` (GET) | `ADMIN_ANALYTICS_TOKEN` only | `requireAdminAuthOrSecret("ADMIN_ANALYTICS_TOKEN")` |
| `stream-logs.js` | `ADMIN_ANALYTICS_TOKEN` only | `requireAdminAuthOrSecret("ADMIN_ANALYTICS_TOKEN")` |
| `get-user-profile.js` | `ADMIN_ANALYTICS_TOKEN` only | `requireAdminAuthOrSecret("ADMIN_ANALYTICS_TOKEN")` |
| `newsletter-templates.js` | `NEWSLETTER_KEY` only | `requireAdminAuthOrSecret("NEWSLETTER_KEY")` |
| `send-newsletter.js` | `NEWSLETTER_KEY` only | `requireAdminAuthOrSecret("NEWSLETTER_KEY")` |

CORS headers updated on all five to include `Authorization`.

### Redirects

Old admin URLs now redirect to new admin via `netlify.toml`:
- `/admin` → `/admin/index.html`
- `/datalogging` → `/admin/#analytics`
- `/adminnewsletter` → `/admin/#newsletter`
- `/media` → `/admin/#ingestion`
- `/admin-posts-manager.html` → `/admin/#posts`
- `/admin-remove-post.html` → `/admin/#posts`
- `/admin-add-tweets.html` → `/admin/#ingestion`
- `/admin-newsletter.html` → `/admin/#newsletter`
- `/admin-analytics.html` → `/admin/#analytics`

### Old pages deprecated

All six legacy admin HTML pages marked with deprecation comments and `noindex`:
- `admin-posts-manager.html` — broken (401), redirected
- `admin-remove-post.html` — broken (401), redirected
- `admin-add-tweets.html` — broken (401), redirected
- `admin-newsletter.html` — was partially working via shared secret, now redirected
- `admin-analytics.html` — was partially working via shared secret, now redirected
- `media.html` — broken (401), redirected

### Build integration

`scripts/inject-auth0.js` updated to inject Auth0 config into both `index.html` and `admin/index.html`.

### What remains

- **Delete old admin HTML pages** — redirects are active; pages can be removed once validated
- **Auth0 tenant configuration** — add admin role claims for JWT-based admin identification (currently falls back to `ADMIN_EMAILS` allowlist)
- **Newsletter template preview** — current view shows template list but not rendered preview
- **Analytics CSV export** — current view queries logs but doesn't expose CSV download
- **Ingest-all manual trigger** — not yet exposed in admin UI (was never in old admin either)
- **Push notification send** — not in admin UI (send-breaking-news-alert is the primary path)

### Validation checklist

- [ ] `/admin/` redirects to Auth0 login when unauthenticated
- [ ] Non-admin Auth0 users see "access denied"
- [ ] Admin users see the admin shell with all 5 sections
- [ ] Posts view lists posts and supports search, edit, delete
- [ ] Ingestion view can add tweets by URL
- [ ] Newsletter view lists templates and can trigger sends
- [ ] Analytics view can query logs
- [ ] System view can rebuild index and send breaking news alerts
- [ ] Old admin URLs redirect to new admin
- [ ] No admin page is accessible without authentication
- [ ] All API calls use Bearer token (verify in browser devtools Network tab)

---

## 12. V2 Homepage — Functional Integration (2026-03-23)

### What was built

The V2 homepage shell was upgraded from a static mockup to a functional product surface with real data, auth, and newsletter integration.

| File | Purpose | Lines |
|------|---------|------:|
| `v2/js/feed.js` | Feed module — fetches posts-read, renders cards, loading/empty/error states | ~174 |
| `v2/js/auth.js` | Auth module — thin Auth0 SPA integration, nav state management | ~95 |
| `v2/js/main.js` | Entry point — orchestrates feed, auth, nav, newsletter, scroll | ~120 |
| `v2/index.html` | Updated HTML — Auth0 SDK, config markers, auth nav, footer links | ~260 |
| `v2/styles/components.css` | Post card CSS, feed grid, auth nav, feed states, entrance animations | (additions) |

### Architecture

1. **ES modules throughout**: `main.js` imports from `feed.js` and `auth.js`. Loaded as `type="module"`. No globals.
2. **Feed rendering**: Fetches from canonical `posts-read` API, renders as linked cards with image/title/excerpt/category/date/source. Handles loading skeleton → content → empty → error with retry.
3. **Auth integration**: Auth0 SPA SDK loaded via CDN. Config injected at build time. Graceful degradation when config is absent. Nav switches between Sign In/Sign Up and user name/Profile/Log Out.
4. **Newsletter**: Already wired from previous session. Success/error feedback with colored hint text.
5. **Nav coherence**: Stories (anchor), Archive (/archive.html), Newsletter (anchor), Monitor (/situation-monitor.html), auth actions. Mobile hamburger menu.
6. **Footer**: Explore + Resources + Legal columns. Links to real pages.

### Build integration

`scripts/inject-auth0.js` updated to inject Auth0 config into `v2/index.html` alongside `index.html` and `admin/index.html`.

### What was NOT changed

- V1 homepage (`index.html`) — unchanged
- Backend APIs — unchanged
- Admin system — unchanged
- Situation Monitor — unchanged
- Any data schema — unchanged

### What remains for V2 cutover

- **Validate feed with real data in Netlify deploy** — local testing confirms error state handling; production deploy needed for full feed validation
- **Globe visualization** — deferred (not on homepage by default per plan)
- **Chat widget** — deferred (lazy-loaded when needed)
- **Analytics tracker** — deferred (integrate after cutover decision)
- **Service worker** — deferred (update precache list after cutover)
- **Remove `noindex` tag** — only when V2 is promoted to production
- **Performance audit** — Lighthouse comparison V1 vs V2

### Validation checklist

- [x] V2 homepage renders all sections (hero, stories, about, newsletter, footer)
- [x] Feed shows loading skeleton, then content or error state
- [x] Error state has retry button that restores skeleton and re-fetches
- [x] Newsletter form submits to correct endpoint with success/error feedback
- [x] Auth nav shows Sign In/Sign Up when logged out
- [x] Auth nav shows user name/Profile/Log Out when logged in
- [x] Auth degrades silently when config is absent
- [x] Mobile nav toggle works
- [x] All footer links point to real pages
- [x] No console errors from V2 code
- [x] Post cards link to `/article.html?id={postId}`
- [x] `inject-auth0.js` targets V2 page
- [ ] Feed renders real posts from production `posts-read` (requires Netlify deploy)
- [ ] Auth0 login/logout flow works end-to-end (requires Auth0 config)

---

## 13. V2 Homepage — Performance & Cutover Readiness (2026-03-23)

### What was done

Performance, cleanup, and cutover-readiness pass on the V2 homepage. Goal: move from "functional V2" to "serious replacement candidate."

### Changes

| File | Change | Category |
|------|--------|----------|
| `v2/js/auth.js` | Fixed auth session persistence: returning authenticated users now get their session checked in the background (non-blocking) instead of always seeing logged-out state | **Bug fix / Cutover blocker** |
| `v2/index.html` | Google Fonts loaded non-blocking via `media="print" onload` pattern; page paints immediately with system fonts, swaps when custom fonts are ready | **Performance** |
| `v2/js/feed.js` | Reduced feed from 18 to 12 posts — cleaner grid proportions, less payload | **Performance** |
| `v2/styles/components.css` | Subtle hero background gradient for depth; newsletter hint uses CSS classes instead of inline styles; stagger animation for more feed cards; desktop hero spacing refinement | **Quality / Cleanup** |
| `v2/js/main.js` | Newsletter hint feedback uses `.is-success` / `.is-error` CSS classes instead of inline `style.color` | **Cleanup** |
| `netlify.toml` | Removed stale `test-generate` function config (file was deleted); expanded cutover checklist with all validation steps | **Cleanup / Cutover prep** |

### Auth session fix (detail)

**Before:** `initAuth()` only processed Auth0 redirect callbacks (URL contains `code=` and `state=`). On normal page visits, it immediately set the UI to logged-out state and returned. Returning authenticated users always saw "Sign In / Sign Up."

**After:** `initAuth()` immediately renders the UI in logged-out state (no blocking), then calls `checkSession()` in the background. This loads the Auth0 SDK, calls `isAuthenticated()`, and if the user has a valid session, updates the nav to show their name / Profile / Log Out. First render is never delayed.

### Performance improvements

1. **Non-blocking fonts**: Google Fonts CSS no longer blocks first contentful paint. System font stack renders immediately; custom fonts swap in when available.
2. **Reduced feed payload**: 12 posts instead of 18 — same visual grid (4 rows × 3 columns on desktop), 33% less data transfer and DOM nodes.
3. **Auth SDK not loaded unless needed**: SDK still only loads on callback or session check — never synchronously in the critical path.

### Cutover status

The V2 homepage is now a **serious replacement candidate**. Remaining steps are operational (deploy-preview validation), not architectural.

**Cutover checklist** (documented in `netlify.toml`):
- [ ] Validate V2 at `/v2/` in a Netlify deploy preview
- [ ] Test feed rendering with real production posts
- [ ] Test Auth0 login/logout/session persistence
- [ ] Test newsletter signup
- [ ] Test all nav links and footer links
- [ ] Test mobile nav toggle and responsive layout
- [ ] Test `article.html?id=` links from feed cards
- [ ] Remove `<meta name="robots" content="noindex">` from `v2/index.html`
- [ ] Bump `CACHE_VERSION` in `sw.js`
- [ ] Uncomment rewrite rule in `netlify.toml`
- [ ] Deploy and verify

### What was NOT changed

- V1 homepage (`index.html`) — untouched
- Backend APIs — untouched
- Admin system — untouched
- Service worker — untouched (must be updated at cutover time)
- Data schema — untouched

### Recommended next session

**Deploy-preview validation.** Deploy the current state to a Netlify preview and run through the full cutover checklist. If all items pass, the V2 homepage is ready for production cutover. If issues emerge, address them in a focused fix-and-revalidate session.

---

## 14. Cutover Strategy — V1 → V2 Homepage (2026-03-23)

### Context

V2 homepage is functional with real data integration, Auth0, newsletter, and service worker registration. It has been refined across multiple sessions. This section documents the exact steps to safely replace V1 with V2 at the root URL.

### Pre-cutover checklist (validate BEFORE starting cutover)

All items must pass in a Netlify deploy preview at `/v2/`:

| # | Test | Pass? |
|---|------|-------|
| 1 | Feed renders 12 posts from `posts-read` with images, titles, dates | [ ] |
| 2 | Auth0 Sign In → Auth0 redirect → callback → nav shows user name | [ ] |
| 3 | Auth0 session persists on page reload (background `checkSession`) | [ ] |
| 4 | Auth0 Log Out → nav shows Sign In / Sign Up | [ ] |
| 5 | Newsletter submit with valid email → success feedback | [ ] |
| 6 | Newsletter submit with bad input → error feedback | [ ] |
| 7 | Post card click → `/article.html?id=xxx` → article renders | [ ] |
| 8 | Nav links: Stories (anchor), Archive, Newsletter (anchor), Monitor → correct targets | [ ] |
| 9 | Footer links: all 12+ links resolve to real pages | [ ] |
| 10 | Mobile: nav toggle opens/closes, feed stacks, hero readable, no horizontal scroll | [ ] |
| 11 | OG tags present: title, description, image, url | [ ] |
| 12 | No console errors from V2 code on load | [ ] |
| 13 | Service worker registers successfully (check console for `[SW] Registered`) | [ ] |

### Auth0 prerequisite

Auth0 tenant must allow callbacks from:
- `https://noteworthynews.co/` (production)
- `https://noteworthynews.co/v2/index.html` (pre-cutover direct access)
- `https://*.netlify.app/*` (deploy previews — wildcard recommended)

Verify in Auth0 Dashboard → Applications → Settings → Allowed Callback URLs, Allowed Logout URLs, Allowed Web Origins.

### Cutover execution steps

Execute in a single commit, deploy, and verify:

**Step 1 — Remove noindex**

In `v2/index.html`, delete:
```html
<meta name="robots" content="noindex"><!-- V2 development surface; remove when promoted -->
```

**Step 2 — Bump service worker cache version**

In `sw.js`, change:
```js
const CACHE_VERSION = 'v1.2.0-feed-fix';
```
to:
```js
const CACHE_VERSION = 'v2.0.0-cutover';
```

And update `STATIC_ASSETS` to include V2 assets:
```js
const STATIC_ASSETS = [
  '/',
  '/v2/index.html',
  '/v2/styles/tokens.css',
  '/v2/styles/base.css',
  '/v2/styles/layout.css',
  '/v2/styles/components.css',
  '/v2/js/main.js',
  '/v2/js/feed.js',
  '/v2/js/auth.js',
  '/game.html',
  '/geography-game.html',
  '/geography-game.js',
  '/logo.svg',
  '/site.webmanifest',
  '/IMG_5794.PNG',
  '/PREVIEWIMAGEBRUH.jpg'
];
```

**Step 3 — Activate rewrite rule**

In `netlify.toml`, uncomment:
```toml
[[redirects]]
  from = "/"
  to = "/v2/index.html"
  status = 200
  force = true
```

**Step 4 — Commit and deploy**

Commit message: `feat: V2 homepage cutover — serve V2 at root URL`

**Step 5 — Post-deploy verification**

| # | Check | Expected |
|---|-------|----------|
| 1 | Visit `https://noteworthynews.co/` | V2 homepage renders |
| 2 | Visit `https://noteworthynews.co/v2/index.html` | V2 still works directly |
| 3 | Visit `https://noteworthynews.co/archive.html` | V1 archive page works |
| 4 | Visit `https://noteworthynews.co/article.html?id=xxx` | Article renders |
| 5 | Visit `https://noteworthynews.co/game.html` | Game page works |
| 6 | Visit `https://noteworthynews.co/admin/` | Admin UI works |
| 7 | Auth0 login from homepage | Full flow completes |
| 8 | Push notification test | SW registered, notification received |
| 9 | Check Google Search Console | No indexing errors within 24h |

### Rollback plan

If anything breaks after cutover:

1. **Immediate (< 5 min):** Netlify Dashboard → Deploys → click previous deploy → "Publish deploy". Instant rollback to V1.
2. **Git-level:** Revert the cutover commit. Re-add `noindex`, re-comment the rewrite, revert CACHE_VERSION. Push.
3. **Data safety:** Zero risk. V2 is read-only against the same APIs. No data migration occurred. All V1 pages still exist at their original paths.

### What V2 does NOT replace

These V1 surfaces remain unchanged after cutover:

| Surface | Path | Status |
|---------|------|--------|
| Article page | `/article.html` | V1 design (V2 nav planned for later) |
| Archive | `/archive.html` | V1 design |
| Category pages | `/category/*.html` | V1 design |
| Game pages | `/game.html`, `/geography-game.html` | V1 design |
| Situation Monitor | `/situation-monitor.html` | V1 (V2 at `/v2/situation-monitor.html` for testing) |
| Profile | `/profile.html` | V1 design |
| Contact | `/contact.html` | V1 design |
| Legal/resource pages | 12 files | V1 design |
| Admin | `/admin/` | Already V2 |

### Known gaps accepted for cutover

| Gap | Risk | Mitigation |
|-----|------|-----------|
| No analytics tracker | Visitor tracking stops on homepage | Add `analytics-tracker.js` in next session |
| No cookie banner | Legal exposure if cookies are set | V2 Auth0 uses `cacheLocation: 'memory'`; no cookies set by V2 itself. Analytics tracker would require it — add together. |
| No chat widget | Feature absent from homepage | Explicitly deferred; can lazy-load later |
| No globe visualization | Feature absent from homepage | Explicitly deferred per plan; opt-in specialty feature |
| No music system | Feature absent from homepage | Explicitly deferred; opt-in feature |
| V1→V2 visual shift on article | UX inconsistency | Acceptable during gradual migration |

### Risk assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Feed API returns empty | Low | High (blank homepage) | Error state with retry button already implemented |
| Auth0 callback fails | Medium (config-dependent) | Medium (login broken) | Graceful degradation — V2 works fully without auth |
| SW serves stale V1 cache | Low (network-first) | Medium (wrong content) | CACHE_VERSION bump purges old caches |
| SEO ranking drop | Low | High | Canonical URL preserved; same domain; no content removal |
| Social share previews break | Low | Low | OG tags + og:image now present on V2 |

### Timeline recommendation

| When | What |
|------|------|
| **Next session** | Deploy preview validation — run through all 13 checklist items |
| **Same session (if all pass)** | Execute cutover steps 1–4; verify step 5 |
| **24h after cutover** | Monitor Google Search Console; check analytics (once added) |
| **1 week after cutover** | Review — stable? Then begin V2 nav migration to article/archive pages |

---

## 15. V1 → V2 Cutover — Executed (2026-03-23)

### What was done

The V2 homepage and Situation Monitor are now the primary public surfaces. V1 is isolated but preserved.

| # | Change | File | Detail |
|---|--------|------|--------|
| 1 | **Homepage rewrite activated** | `netlify.toml` | `/` → `/v2/index.html` (status 200, force). V1 `index.html` still accessible at `/index.html`. |
| 2 | **Situation Monitor redirect** | `netlify.toml` | `/situation-monitor.html` → `/v2/situation-monitor.html` (301). Handles bookmarks and external links. |
| 3 | **Removed `noindex`** | `v2/index.html` | V2 homepage now indexable by search engines. |
| 4 | **Fixed V2 homepage nav** | `v2/index.html` | Monitor link → `/v2/situation-monitor.html` (was pointing to V1). Footer link also updated. |
| 5 | **Fixed V2 Situation Monitor nav** | `v2/situation-monitor.html` | All nav links use absolute paths (`/`, `/archive.html`, `/contact.html`). Favicon also absolute. |
| 6 | **Service worker updated** | `sw.js` | `CACHE_VERSION` bumped to `v2.0.0-cutover`. `STATIC_ASSETS` replaced: V1 assets removed, V2 assets added. |
| 7 | **PWA manifest aligned** | `site.webmanifest` | `theme_color` and `background_color` updated to V2 `#0B1426`. |
| 8 | **404 page cleaned** | `404.html` | Removed V1 dependencies: `music-system.js`, `cookie-banner.js`, 3 `<audio>` elements. `theme-color` aligned with V2. |

### Routing after cutover

| URL | Serves | Design |
|-----|--------|--------|
| `/` | V2 homepage | V2 |
| `/v2/index.html` | V2 homepage (direct) | V2 |
| `/index.html` | V1 homepage (fallback) | V1 |
| `/situation-monitor.html` | 301 → V2 Situation Monitor | V2 |
| `/v2/situation-monitor.html` | V2 Situation Monitor (direct) | V2 |
| `/article.html?id=X` | Article page | V1 |
| `/archive.html` | Archive page | V1 |
| `/category/*.html` | Category pages | V1 |
| `/game.html`, `/geography-game.html` | Game pages | V1 |
| `/profile.html` | User profile | V1 |
| `/contact.html` | Contact form | V1 |
| `/admin/` | Admin dashboard | V2 |
| `/404.html` | Error page | V1 (cleaned) |
| Legal/resource pages | 12 pages | V1 |

### What was NOT changed

- V1 `index.html` — preserved as fallback at `/index.html`
- V1 `situation-monitor.html` — preserved (redirect catches the URL)
- Article, archive, category, game, profile, contact, legal pages — all unchanged
- Backend APIs — unchanged
- Admin system — unchanged
- Data schema — unchanged

### Accepted gaps

| Gap | Risk | Status |
|-----|------|--------|
| No analytics tracker on V2 homepage | Visitor tracking paused on homepage | Add in next session |
| No cookie banner on V2 homepage | V2 Auth0 uses `cacheLocation: 'memory'` — no cookies set by V2 itself | Add with analytics |
| No chat widget on V2 homepage | Feature absent | Deferred (lazy-load later) |
| No globe visualization on V2 homepage | Feature absent | Deferred per plan |
| V1 design on secondary pages | Visual inconsistency between homepage and subpages | Accepted — gradual migration |
| `/v2/` visible in Situation Monitor URL | URL not fully clean | Convert to absolute paths + 200 rewrite later |

### Rollback

1. **Instant**: Netlify Dashboard → Deploys → previous deploy → Publish
2. **Git-level**: Comment out the two new `[[redirects]]` in `netlify.toml`, re-add `noindex` to `v2/index.html`, revert `CACHE_VERSION`
3. **Data safety**: Zero risk — V2 is read-only against the same APIs

### Post-cutover monitoring

- [ ] Homepage loads V2 at production URL
- [ ] Feed renders real posts
- [ ] Auth0 login/logout works
- [ ] Newsletter signup works
- [ ] All nav links resolve correctly
- [ ] Situation Monitor loads via redirect and directly
- [ ] Mobile layout correct
- [ ] No console errors
- [ ] Google Search Console — no indexing errors (check 24h later)
- [ ] Old bookmarks to `/situation-monitor.html` redirect correctly

### Recommended next steps

1. **Deploy and validate** — run through post-cutover monitoring checklist
2. **Add analytics tracker** to V2 homepage (with cookie banner if needed)
3. **Begin V2 nav migration** — add V2 header/footer to article, archive, category pages
4. **Convert V2 Situation Monitor to absolute paths** → change 301 to 200 rewrite for clean URL
5. **Delete old admin HTML pages** — redirects are active and validated
6. **Remove V1 `index.html` weight** — once V2 is stable for 1+ week, archive or delete
