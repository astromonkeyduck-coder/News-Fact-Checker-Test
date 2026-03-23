# Stability Checkpoint — Noteworthy News V2 Rebuild

*Audit date: 2026-03-22. Checkpoint after Security Foundation, Data Consolidation, Unified Alert System, and V2 Situation Monitor sessions.*

---

## 1. What Is Solid

### 1.1 Security middleware (`requireAuth.js`)
- Well-designed, fail-closed, JWKS-verified JWT authentication.
- `requireAdminAuth`, `requireAdminAuthOrSecret`, and `isAdminSecretValid` provide a clean, layered auth strategy.
- Timing-safe secret comparison implemented.
- Admin identity resolved via role claims OR email allowlist — pragmatic fallback when Auth0 roles aren't configured.
- **Applied consistently** to all critical mutation endpoints: `remove-post`, `update-post-data`, `upload-post-media`, `process-csv-posts`, `delete-large-images`, `remove-long-posts`, `remove-old-alert-posts`, `rebuild-index`, `re-extract-media`, `process-post-screenshot`, `fetch-tweets-simple` (POST only), `fetch-profile-tweets` (POST only), `cams-token`.
- `jose` dependency pinned in `package.json` at `^6.2.2`.

### 1.2 Post storage consolidation (`postStore.js`)
- Clean, focused module: 160 lines with clear responsibilities.
- All 11 identified writers migrated to use postStore.
- Index shape standardized (`{ ids }` — `urls` field retired).
- Earthquake ID scheme unified to `usgs-` prefix.
- Deduplication, bounded size (200 posts), consistent key format.
- `posts-read.js` migrated with temporary backward-compatible `eq-` fallback.

### 1.3 Unified alert system (`alertEvent.js`, `notifyForEvent.js`, `alertRateLimit.js`)
- Clean separation of concerns: event normalization, channel routing, dedup, delivery.
- Event schema is well-defined with validation.
- Opt-in via `USE_UNIFIED_ALERTS=true` — safe rollout strategy.
- All six engines return `notifiableEvents[]` in their `run()` result.
- `send-breaking-news-alert.js` is a clean, admin-authed endpoint.
- Alert dedup uses a dedicated blob store; prevents duplicate notifications.

### 1.4 V2 design system (`v2/styles/`)
- Token-based system with comprehensive coverage: spacing, typography, colors, radii, shadows, motion, glass effects, z-index, layout.
- `tokens.css` (147 lines) is the single source of truth for V2 visual system.
- Reduced motion support is built into the tokens layer.
- Responsive token overrides (font scaling by breakpoint) done correctly.
- CSS files are well-organized: tokens → base → layout → components → page-specific.

### 1.5 V2 homepage shell (`v2/index.html`)
- 241 lines (down from 21,006). Dramatic simplification.
- Semantic HTML, proper ARIA labels, mobile nav toggle, skip-to-content implicit via structure.
- Clean section architecture: header, hero, stories/feed, about/features, newsletter, footer.
- Skeleton loading state for feed.
- Single JS file (`main.js`, 69 lines) — scroll-aware header, active section tracking, mobile nav. No frameworks.
- `noindex` meta tag correctly prevents indexing of development surface.
- No inline JS (except newsletter form, which is just HTML).
- No inline CSS (one exception: `style="margin-top: var(--space-xl)"` — uses tokens).

### 1.6 V2 Situation Monitor shell (`SituationMonitorV2.js`)
- 360 lines (down from 2,085). Clean orchestrator.
- Single 60-second refresh cycle (down from 15s + multiple redundant timers).
- Proper lifecycle: loading state → init → content reveal → error handling.
- Reuses all existing panel classes and data layer without modification.
- D3 loaded async, not blocking.
- Audio, loader hacking, security theater, toast system, resize handles all removed.
- Situation Monitor CSS: 651 lines (down from 5,870), fully token-based, scoped to `.sitmon-v2`.

### 1.7 Fail-closed patterns
- `newsletter-templates.js`, `send-newsletter.js` → 500 when `NEWSLETTER_KEY` missing.
- `log-data.js` → 500 when `ADMIN_ANALYTICS_TOKEN` missing.
- `create-job.js` and Clemens functions → deny when `CLEMS_TOKEN` missing.
- `cams-token.js` → 503 when `CAMS_TOKEN` missing, plus requires admin JWT.
- `send-push-notification.js`, `send-website-update.js` → 500 when keys missing.
- `user-data.js` → JWKS-verified JWT; email from token claims.
- `comments-api.js` DELETE → JWT-verified ownership check.

---

## 2. What Is Fragile

### 2.1 Dual notification pipeline (HIGH RISK)
The unified alert pipeline (`USE_UNIFIED_ALERTS`) runs **alongside** each engine's own inline notification code. Until engine-internal notification code is removed, enabling the unified pipeline will cause **duplicate notifications** (duplicate emails, duplicate push notifications). The `ingest-all.js` comment acknowledges this but the risk is active.

**Additionally**, the unified alert dispatch fires even when `result.success === false`. If an engine fails but still populates `notifiableEvents`, notifications will fire for potentially incomplete or errored data.

### 2.2 Location alerts delegation
`notifyForEvent.js` → `sendLocationNotifications()` currently returns `{ sent: 0, skipped: 0, reason: 'delegated_to_engines' }`. The location alert channel is declared in the schema but **not actually implemented** in the unified dispatcher. It's a stub that always reports zero. Users who depend on location-based earthquake alerts are still served by the engine-internal code, creating a hidden dependency on the old path.

### 2.3 V1↔V2 coexistence without clear switch
Both V1 and V2 versions of the homepage and Situation Monitor exist with no feature flag, route parameter, or environment variable to switch between them. The production nav still points to V1 Situation Monitor. V2 lives under `/v2/` but is not linked from anywhere in production. This is acceptable during development but becomes fragile if V2 work stalls — two codepaths drift with no merging strategy.

### 2.4 Seven functions still bypass postStore
The following Netlify functions access `x-posts` blobs directly (bypassing `postStore`):
- `noteworthy-chat.js` — reads posts for AI context
- `auto-sync-posts.ts` — dormant but still has direct blob access
- `realtime-voice.js` — reads posts
- `article-preview.js` — reads posts
- `twitter-share.js` — reads posts
- `check-earthquake-posts.js` — reads posts
- `re-extract-media.js` — reads/writes posts

Most are **read-only** paths, which is less risky, but `re-extract-media.js` **writes** to `x-posts` outside postStore. This creates an inconsistency path.

### 2.5 CSS token adoption incomplete in V2
V2 CSS files (base, layout, components, situation-monitor) still contain:
- Raw hex colors: `#fff`, `#ccc`, `#333`, `#d32f2f`, etc.
- Raw `rgba()` values not defined as tokens
- Raw pixel values for borders, widths, heights

This dilutes the purpose of the token system. The token layer exists but is not yet enforced as the sole source of visual values.

---

## 3. What Is Duplicated

### 3.1 Two design token systems
- `v2/styles/tokens.css` — V2 tokens (Sora, Source Serif 4, dark navy palette, `--color-*`, `--text-*`)
- `src/styles/premium-tokens.css` — V1 tokens (system-ui stack, different naming: `--font-family-base`, `--font-size-*`, `--color-bg-primary`)

Both exist, both are used. V1 tokens are consumed by V1 pages. V2 tokens are consumed by V2 pages. They define overlapping concepts with different names and different values. Neither one is deprecated or marked as canonical.

### 3.2 Two homepages
- `index.html` (21,006 lines) — V1, live in production
- `v2/index.html` (241 lines) — V2, development surface

### 3.3 Two Situation Monitors
- `situation-monitor.html` + `src/components/situation-monitor/` (27 files) — V1, live
- `v2/situation-monitor.html` + `v2/js/situation-monitor/SituationMonitorV2.js` — V2, development

### 3.4 Two feed renderers (still)
- `post-feed-v2.js` (2,813 lines)
- `post-feed-enhanced.js` (2,066 lines)

Both loaded on the V1 homepage. Consolidation has not started.

### 3.5 Notification code duplication
Each engine still has its own inline notification logic (email, push) alongside the new unified pipeline. The unified pipeline's earthquake email code (`notifyForEvent.js` → `sendEarthquakeEmail`) reimplements what `send-earthquake-alert.js` (2,001 lines) already does, creating a third notification code path.

### 3.6 Two CSS architectures
- V1: `styles.css` (4,672 lines), `responsive.css` (5,591 lines), `src/styles/` (15 files)
- V2: `v2/styles/` (5 files, ~1,300 lines total)

No shared CSS between V1 and V2. No migration path defined.

---

## 4. What Is Inconsistent

### 4.1 Auth check ordering in handlers
- Most handlers: OPTIONS → method check → auth
- `update-post-data.js`: OPTIONS → auth → method check (auth runs even for unsupported methods)
- `delete-large-images.js`: OPTIONS → auth (no explicit method check)
- `fetch-tweets-simple.ts`: POST gated, GET open (intentional but different pattern)

Minor but creates confusion about the expected middleware pattern.

### 4.2 HTTP status codes for config errors
- Most fail-closed handlers return **500** when env vars are missing
- `cams-token.js` returns **503** ("Service unavailable")
- `create-job.js` and Clemens functions return **401** (unauthorized) when token is missing

These are semantically different error classes for the same root cause.

### 4.3 CORS headers defined per-function
Every function defines its own CORS headers object. `requireAuth.js` exports `AUTH_HEADERS` but most functions don't use it, defining their own copy. This creates maintenance burden and inconsistency risk (some functions allow different methods/headers).

### 4.4 V2 nav links point to V1 routes
`v2/index.html` footer links to V1 routes (`/archive.html`, `/game.html`, `/situation-monitor.html`, `/contact.html`). V2 Situation Monitor nav links to `../index.html` (V1 homepage). This is acceptable during development but indicates the V2 surface is not self-contained.

### 4.5 Mixed module systems
- `requireAuth.js`: CommonJS (`require`/`module.exports`)
- `SituationMonitorV2.js`: ES modules (`import`/`export`)
- `postStore.js`: CommonJS
- Engine files: CommonJS
- V2 frontend: ES modules

This is the expected split (Node = CJS, browser = ESM) but some TypeScript function files (`x-webhook.ts`, `fetch-tweets-simple.ts`) use `require` for `postStore` despite being `.ts` files — works due to Netlify's bundler but is technically mixing paradigms.

---

## 5. What Is Incomplete

### 5.1 V2 homepage has no feed rendering
`v2/index.html` has skeleton placeholders but no actual feed component. The `main.js` file handles nav/scroll only — no data fetching, no post rendering. The feed consolidation (merging `post-feed-v2.js` and `post-feed-enhanced.js`) has not started.

### 5.2 V2 homepage has no Auth0 integration
No login/signup, no user state, no profile link. V1 homepage has full Auth0 integration.

### 5.3 V2 homepage has no globe, music, games section, or AI chat
These are intentionally deferred (lazy-loaded later) but represent a significant feature gap before V2 can replace V1.

### 5.4 V2 newsletter form has no backend wiring
The newsletter signup form in `v2/index.html` is pure HTML — no JavaScript handles the form submission.

### 5.5 Admin UI rebuild has not started
Phase 1 (Admin UI Behind Auth) has not been implemented. The old admin HTML pages exist but are functionally broken (API calls return 401). This means admin operations currently require:
- Manually constructing curl commands with admin JWT tokens
- Or using the partially-working newsletter/analytics pages that still accept legacy secrets

### 5.6 Legacy cleanup not done
- Test pages still deployed: `test-earthquake.html`, `test-hero-media.html`, `video-preview-test.html` (x2)
- Old admin pages still exist: `admin-posts-manager.html`, `admin-remove-post.html`, `admin-add-tweets.html`
- Test functions: `test-resend.js`, `test-generate.js` — not confirmed deleted
- `posts-read.ts.backup` still present
- `bookmarklet-add-post.html` still deployed (now broken but still accessible)
- Legacy `eq-` earthquake posts not cleaned up

### 5.7 Unified alert migration not complete
- `USE_UNIFIED_ALERTS` not yet enabled in production
- Engine-internal notification code not removed
- `earthquake-poller.js` not disabled (just marked deprecated)
- Location alerts stub in unified pipeline
- `assess-earthquake-impact.js` not consolidated into `lib/impactAssessment.js`

---

## 6. Correction Items — Status

> **Correction session completed 2026-03-22.** All items resolved.

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Dual notification path | **Acknowledged** | Engine-internal code remains for backward compat. Unified pipeline has dedup. Must remove engine code before enabling `USE_UNIFIED_ALERTS=true`. |
| 2 | Guard unified alert dispatch against failed runs | ✅ **Fixed** | `result.success &&` guard added to `ingest-all.js` |
| 3 | Migrate `re-extract-media.js` to postStore | ✅ **Fixed** | Uses `getPostStore`, `readIndex`, `readPost` |
| 4 | Delete test pages and test functions | ✅ **Fixed** | Deleted: `test-earthquake.html`, `test-hero-media.html`, `video-preview-test.html` (×2), `test-resend.js`, `test-generate.js`, `posts-read.ts.backup` |
| 5 | Standardize CORS headers | ✅ **Fixed** | Created `lib/corsHeaders.js`; adopted in touched files; pattern ready for broader adoption |
| 6 | Migrate read-only x-posts consumers to postStore | ✅ **Fixed** | Migrated: `noteworthy-chat.js`, `article-preview.js`, `twitter-share.js`, `check-earthquake-posts.js`, `realtime-voice.js`, `auto-sync-posts.ts` |
| 7 | Enforce token-only values in V2 CSS | ✅ **Fixed** | Added 10 new semantic tokens; replaced all raw rgba/hex in V2 CSS consumer files |
| 8 | Deprecate `premium-tokens.css` | ✅ **Fixed** | Header marks it as V1-only legacy |
| 9 | Wire V2 newsletter form | ✅ **Fixed** | `v2/js/main.js` POSTs to `send-email` endpoint |
| ― | Bookmarklet page | ✅ **Marked deprecated** | `noindex` added, deprecation comment, title updated |

---

## 7. What Can Safely Wait

1. **Feed component consolidation** (merging `post-feed-v2.js` and `post-feed-enhanced.js`) — V1 homepage works. V2 needs this before launch but not before corrections.

2. **Admin UI rebuild** — Broken admin pages are an inconvenience but not a security risk (APIs now return 401). Can be addressed now.

3. **Homepage decomposition** — The 21,006-line `index.html` is technical debt but is stable. V2 shell exists as the target. No urgency.

4. **`script.js` decomposition** — Same: stable, large, but not blocking anything.

5. **Cloudflare Worker decision** — Parallel feed store. Not causing conflicts. Product decision needed.

6. **WebSocket server build-out** — Stubs work. Low risk.

7. **CSS consolidation for V1 pages** — Will be addressed when V2 replaces V1.

8. **Legacy `eq-` earthquake post cleanup** — Posts will age out naturally; `posts-read.js` fallback handles them.

9. **RSS proxy consolidation** (`rss-feed.js`, `rss-aggregate.js`, `rssProxy.js`) — Three overlapping functions, but all work. Low urgency.

10. **Build pipeline upgrade** (webpack → Vite) — Needed for V2 launch but not for corrections.

---

## 8. Recommended Next Session

### ✅ Correction session completed. Roadmap may resume.

**Recommended next phase:** Phase 1 (Admin UI rebuild) or Phase 2 (Homepage decomposition), based on product priority.

**Remaining pre-production items** (not blocking roadmap continuation):
- Remove engine-internal notification code before enabling `USE_UNIFIED_ALERTS=true`
- Broader adoption of `corsHeaders.js` across remaining functions (opportunistic, not urgent)
- CLI scripts in `scripts/` still access `x-posts` directly (low priority — not production paths)

---

## Appendix: Architecture Evaluation Summary

| Dimension | Rating | Notes |
|-----------|--------|-------|
| **V2 structure coherence** | Good | Clear separation: tokens → base → layout → components → pages. V2 shell is exemplary. |
| **Boundary clarity** | Mixed | V2 vs V1 boundary is clear (separate `v2/` directory). But server-side boundaries (public vs admin vs ingest) still overlap. |
| **Plan adherence** | Good | Phases 0 and 3 completed as planned. V2 Situation Monitor done ahead of schedule. No significant drift. |
| **Product cohesion** | Partial | V2 components feel like one product. But the repo as a whole still feels like two products (V1 and V2) plus several appendages. |
| **Code quality** | Improved | New modules (postStore, requireAuth, alertEvent, notifyForEvent, SituationMonitorV2) are clean, focused, well-documented. Legacy modules unchanged. |
| **Unnecessary abstractions** | None detected | All new modules have clear justification and single responsibility. |
| **Security posture** | Strong | Fail-closed on all mutation endpoints. JWT verification via JWKS. Legacy secret fallback for transition period. |
| **Data sanity** | Good | Post storage canonicalized. Alert pipeline normalized. Remaining outliers identified (7 read-only bypasses + 1 write). |
| **Performance trajectory** | Positive | V2 Situation Monitor dramatically lighter. V2 homepage shell is optimal. V1 performance unchanged (not worse). |
| **Mobile-first execution** | Good | V2 CSS is mobile-first throughout. Grid layouts collapse correctly. Token-based responsive breakpoints. |
| **Migration discipline** | Good | V1 preserved alongside V2. Feature flags for alert pipeline. `noindex` on V2 pages. No premature V1 removal. |
| **Parallel complexity risk** | Medium | Two of everything (homepage, situation monitor, token system, CSS architecture) is manageable now but must converge within 3-5 sessions. |

### Verdict

**The rebuild is on the right path.** The V2 work is genuinely cleaner, safer, and more coherent than V1. The new modules are well-designed and the architectural decisions are sound. The primary risk is not bad engineering — it's **convergence timing**: the repo is carrying two parallel systems and needs to merge them before the parallel complexity becomes a maintenance burden. The correction items above are minor and can be addressed in one session.
