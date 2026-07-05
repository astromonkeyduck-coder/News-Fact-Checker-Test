# Feature Parity - Noteworthy News V2

*Generated 2026-03-22. Each subsystem listed with business purpose, current implementation, disposition, V2 destination, migration dependencies, and validation notes.*

---

## Legend

| Disposition | Meaning |
|-------------|---------|
| **Preserve** | Keep as-is; low risk, working correctly |
| **Rebuild** | Rewrite with better architecture; current version is the source of significant debt |
| **Isolate** | Move to a clear boundary (separate directory, build target, or deploy) without rewriting internals |
| **Consolidate** | Merge duplicated implementations into one canonical path |
| **Retire** | Remove from production; not providing value or actively harmful |
| **Defer** | Not in scope for V2 phases 1–3; revisit later |

---

## 1. Public Homepage

| Field | Value |
|-------|-------|
| **Business purpose** | Primary public entry point. Breaking news feed, globe, newsletter signup, game/resource discovery, brand impression. |
| **Current source** | `index.html` (21,006 lines), `script.js` (10,762 lines), `post-feed-v2.js`, `post-feed-enhanced.js`, `CiaMissionGlobe-cdn.js`, `music-system.js`, `analytics-tracker.js`, `christmas-theme-loader.js`, `src/js/homepage/index.js` + modules, `premium-features.js`, `keyboard-shortcuts.js`, `leaderboard.js`, `comment-section.js` |
| **Disposition** | **Rebuild** |
| **V2 destination** | Composable HTML shell + ES module sections. Feed, globe, newsletter, games, and navigation as independently loadable/cacheable components. Inline JS/CSS extracted. Christmas theme → opt-in lazy module. |
| **Migration dependencies** | Unified feed component (see #3), build pipeline upgrade (see #19), design token adoption (see #17) |
| **Validation** | Same visual output at each URL; same feed content from `posts-read`; lighthouse scores equal or better; no broken nav/links; Auth0 login still works; globe still renders; newsletter signup still works |

---

## 2. Article Page

| Field | Value |
|-------|-------|
| **Business purpose** | Individual article/post view with comments, sharing, related content. |
| **Current source** | `article.html` (404 lines), `js/article-page.js`, `js/article-loader.js` (Three.js 3D visualization), `css/article.css`, `comment-section.js`, Auth0 integration |
| **Disposition** | **Preserve** (minor improvements) |
| **V2 destination** | Keep structure; extract inline JS; adopt shared nav/footer from homepage rebuild; replace Three.js article visualization with lighter alternative or make opt-in. |
| **Migration dependencies** | Shared nav component from homepage rebuild |
| **Validation** | Article loads by ID; comments display and submit; Auth0 profile visible; OG tags correct |

---

## 3. Post Feed System

| Field | Value |
|-------|-------|
| **Business purpose** | Renders the news feed from `x-posts` blob store on homepage, archive, categories, and admin pages. |
| **Current source** | `src/components/post-feed-v2.js` (2,813 lines), `src/components/post-feed-enhanced.js` (2,066 lines), `components/feed/*.ts` (unused typed implementation), `posts-read.js` (Netlify function, 188 lines) |
| **Disposition** | **Consolidate + Rebuild** |
| **V2 destination** | Single `PostFeed` module (ES module, no global `window.*`). Server contract unchanged (`posts-read`). Typed if the build pipeline supports TS→JS. Kill the unused `components/feed/*.ts` tree or wire it in as the canonical implementation. |
| **Migration dependencies** | Build pipeline for ES modules; homepage rebuild to consume new feed |
| **Validation** | Feed renders same posts in same order; search/filter works; category pages still work; infinite scroll or pagination behavior preserved |

---

## 4. Post Ingestion Pipeline

| Field | Value |
|-------|-------|
| **Business purpose** | Gets content into the `x-posts` store from X/Twitter, hazard engines, CSV, email, and manual admin entry. |
| **Current source** | `x-webhook.ts`, `fetch-tweets-simple.ts`, `fetch-profile-tweets.ts`, `auto-sync-posts.ts`, `earthquake-poller.js`, `engines/usgs.js` via `lib/createPost.js`, `process-csv-posts.js`, `inbound-email.js`, `update-post-data.js`, `re-extract-media.js`, `scripts/add-post-to-index.js` |
| **Disposition** | ✅ **Consolidated** (2026-03-22) |
| **V2 destination** | All post writes now go through `lib/postStore.js`. Earthquake poller and USGS engine use unified `usgs-` ID scheme. Index shape standardized to `{ ids }`. Auth required on all HTTP-exposed writers (from security session). |
| **Migration dependencies** | ✅ Auth middleware; ✅ earthquake ID scheme resolution |
| **Validation** | Posts appear in feed within expected latency; earthquake posts have consistent `usgs-` IDs; CSV import calls `update-post-data` which uses postStore; webhook delivery uses postStore |

---

## 5. Hazard Engine System

| Field | Value |
|-------|-------|
| **Business purpose** | Monitors USGS, NWS, FAA, USCG, Volcano, and Embassy feeds for hazard events. Writes to `verified_events` (Supabase) and creates posts. |
| **Current source** | `netlify/functions/engines/` (usgs.js 2,158 lines, nws.js, faa.js, uscg.js, volcano.js, embassy.js), `netlify/functions/lib/` (supabaseClient, createPost, logger, normalize, dedupe, impactAssessment, tsunamiAssessment, aftershockModeling, anomalyDetection), `ingest-all.js` (orchestrator, 641 lines, cron every 5 min) |
| **Disposition** | **Preserve** |
| **V2 destination** | Keep engine architecture. Consolidate earthquake-poller into USGS engine. Ensure `ingest-all` is the single orchestrator. |
| **Migration dependencies** | Post ingestion consolidation (#4) |
| **Validation** | `verified_events` populated correctly; `engine_runs` logged; posts created for qualifying events; alert pipeline triggered |

---

## 6. Earthquake Alert Pipeline

| Field | Value |
|-------|-------|
| **Business purpose** | Sends email/push alerts to subscribers when significant earthquakes are detected. Generates map images for alerts. |
| **Current source** | `send-earthquake-alert.js` (2,001 lines), `generate-earthquake-image.js` (2,702 lines), `generate-earthquake-video.js` (769 lines), `generate-earthquake-animation.js` (137 lines), `generate-sample-earthquake-map.js` (87 lines), `lib/impactAssessment.js`, `lib/tsunamiAssessment.js`, `lib/aftershockModeling.js`, `lib/anomalyDetection.js`, `lib/sendAlert.js`, `lib/getEarthquakeAlertUsers.js` |
| **Disposition** | **Preserve** (with isolation) |
| **V2 destination** | Keep functionality. Extract `send-earthquake-alert` image generation into a callable sub-module to reduce monolith size. Ensure scheduled-only invocation with cron secret. |
| **Migration dependencies** | Auth middleware for non-cron invocation paths |
| **Validation** | Alert emails delivered with correct map images; subscriber targeting correct; rate limits honored |

---

## 7. Situation Monitor

| Field | Value |
|-------|-------|
| **Business purpose** | Real-time intelligence dashboard: news feeds, weather, earthquakes, markets, live cams, D3 map, correlation/narrative analysis. Premium specialty feature. |
| **Current source** | `situation-monitor.html` (1,137 lines), `src/components/situation-monitor/` (27 files: SituationMonitorShell.js 2,085 lines, MapView.js, panels, data fetchers, event pipeline/store), `src/styles/situation-monitor.css` (5,870 lines), `src/loader/IntelLoader.js`, Netlify proxy functions (rssProxy, weatherProxy, marketsProxy, geocodeProxy, get-verified-earthquakes, rss-aggregate) |
| **Disposition** | **Isolate** |
| **V2 destination** | Lazy-loaded subsystem. D3/TopoJSON loaded async, not blocking. Own CSS scope. Entry via dynamic `import()` from main nav. Security gate preserved but moved to server-side check if it protects paid content. |
| **Migration dependencies** | Shared nav from homepage rebuild; async loading infrastructure |
| **Validation** | All panels render; live data flows; map markers display; refresh/polling works; mobile layout functions |

---

## 8. Games System

| Field | Value |
|-------|-------|
| **Business purpose** | Educational and entertainment games (fact-checker, geography, third-party embeds) for engagement and media literacy. |
| **Current source** | `game.html` (2,770 lines), `geography-game.html` (3,762 lines), `geography-game.js` (6,243 lines), `games.json`, `public/games/` (hexgl, stunt-city, parkour-blocks, etc.), `src/components/GamesGallery.jsx` + test, `games-gallery-example.html`, `nativelite-games.html`, `scripts/validate-game-embeds.js`, `scripts/security-audit-game.js`, `scripts/safe-add-game.js`, `multiplayer-game-manager.js`, `game-room.js`, `game-ai.js`, `game-questions.js` |
| **Disposition** | **Isolate** |
| **V2 destination** | Games as a self-contained subsystem. Gallery rendered without Babel-in-browser (pre-built or vanilla JS). Game HTML pages keep working. Validation/audit scripts preserved. Multiplayer infrastructure cleaned up (websocket server stubs resolved). |
| **Migration dependencies** | Build pipeline for JSX pre-compilation; websocket server decisions |
| **Validation** | Games load in iframe; gallery displays with search/filter; leaderboard works; multiplayer room creation works |

---

## 9. Multiplayer / WebSocket Server

| Field | Value |
|-------|-------|
| **Business purpose** | Real-time multiplayer game rooms with shared questions and answers. |
| **Current source** | `websocket-server/index.js` (ws + ioredis), `websocket-server/package.json`, `src/utils/multiplayer-helpers.js`, `src/components/multiplayer-game-manager.js`, `src/styles/multiplayer-game.css` |
| **Disposition** | **Defer** |
| **V2 destination** | Currently scaffolded with stub implementations (`getRoomState`, `getQuestion` return null/empty). Decision needed: either build out the multiplayer game loop or remove the websocket server and simplify game.html to single-player with leaderboard. |
| **Migration dependencies** | Product decision on multiplayer scope |
| **Validation** | If kept: room creation, join, question flow, answer submission, score tracking all work end-to-end |

---

## 10. Admin - Post Management

| Field | Value |
|-------|-------|
| **Business purpose** | Create, edit, delete posts. CSV import. Screenshot-to-post extraction. Media upload. |
| **Current source** | `admin-posts-manager.html` (1,748 lines), `admin-add-tweets.html` (418 lines), `admin-remove-post.html` (209 lines), `media.html` (873 lines), `bookmarklet-add-post.html` (151 lines) |
| **Disposition** | **Rebuild** |
| **V2 destination** | Server-authenticated admin interface. All mutation endpoints require verified admin identity (JWT or server session). No public HTML admin pages. Consolidate into one admin post management surface. |
| **Migration dependencies** | Auth middleware; admin auth strategy decision (Auth0 roles vs shared secret with fail-closed) |
| **Validation** | All CRUD operations work; CSV import works; screenshot extraction works; media upload works - all behind auth |

---

## 11. Admin - Newsletter

| Field | Value |
|-------|-------|
| **Business purpose** | Create newsletter templates, generate HTML via AI, send newsletters to subscribers, manage images. |
| **Current source** | `admin-newsletter.html` (5,050 lines), `newsletter-templates.js` (822 lines), `generate-newsletter-html.js` (720 lines), `send-newsletter.js` (1,566 lines), `upload-newsletter-image.js` (167 lines), `send-email.js` (931 lines - signup/audience), `house-style-template.js` |
| **Disposition** | **Rebuild** (auth and UI) |
| **V2 destination** | Same functionality behind server-enforced auth. `NEWSLETTER_KEY` check must fail closed. Template CRUD, AI generation, and send operations preserved. Consolidate with post admin into unified admin surface. |
| **Migration dependencies** | Auth middleware; admin UI framework decision |
| **Validation** | Template CRUD; AI HTML generation; send to audience; image upload - all work and all require auth |

---

## 12. Admin - Analytics

| Field | Value |
|-------|-------|
| **Business purpose** | View site analytics, user profiles, session data, CSV export, email alerts on anomalies. |
| **Current source** | `admin-analytics.html` (4,587 lines), `log-data.js` (1,851 lines), `stream-logs.js` (109 lines), `get-user-profile.js` (342 lines), `src/utils/analytics-tracker.js` |
| **Disposition** | **Rebuild** (auth and UI) |
| **V2 destination** | Analytics dashboard behind server-enforced auth. `ADMIN_ANALYTICS_TOKEN` check must fail closed. Logging endpoint (`log-data` POST) rate-limited. Consolidate into unified admin surface. |
| **Migration dependencies** | Auth middleware; admin UI framework decision |
| **Validation** | Log data queryable; CSV export works; user profile lookup works; email alerts fire - all behind auth |

---

## 13. Newsletter Signup / Preferences / Unsubscribe

| Field | Value |
|-------|-------|
| **Business purpose** | Public newsletter subscription, preference management, and unsubscribe flows. |
| **Current source** | Newsletter signup in `script.js` (`initNewsletterSubscription`), `newsletter-preferences.html` (427 lines), `unsubscribe.html` (248 lines), `unsubscribe-survey.html` (455 lines), `send-email.js` (signup + Resend audience), `email-preferences-link.js`, `unsubscribe.js`, `submit-survey.js`, `lib/emailPreferences.js`, `lib/emailRateLimit.js`, `lib/name-inference.js` |
| **Disposition** | **Preserve** |
| **V2 destination** | Keep functionality. Extract signup UI from `script.js` monolith into standalone module during homepage rebuild. Preference/unsubscribe pages are clean enough to keep. |
| **Migration dependencies** | Homepage rebuild |
| **Validation** | Signup works; confirmation email sent; preferences page loads via signed link; unsubscribe works; survey submits |

---

## 14. Auth0 User System

| Field | Value |
|-------|-------|
| **Business purpose** | User login/signup, profile, reading list, comment identity. |
| **Current source** | `src/auth/auth0.js`, `src/auth/auth0-integration.js`, `get-auth0-config.js`, `user-data.js` (289 lines), `profile.html` (510 lines), `my-reading-list.html` (417 lines), `scripts/inject-auth0.js` |
| **Disposition** | **Preserve + Fix** |
| **V2 destination** | Keep Auth0 for user-facing auth. Fix: server-side JWT verification in `user-data.js` (validate against Auth0 JWKS, check issuer/audience/expiry). Add Auth0 role claims for admin users to enable server-enforced admin auth. |
| **Migration dependencies** | Auth0 tenant configuration for role claims |
| **Validation** | Login/signup flow; profile page loads user data; reading list persists; comments attribute to correct user |

---

## 15. AI Chat Widget

| Field | Value |
|-------|-------|
| **Business purpose** | AI-powered assistant branded **Noteworthy News AI** for news questions, image generation, web search. |
| **Current source** | `src/widgets/noteworthy-chat.js` (custom element; optional `data-brand-title`, `data-logo`), `src/widgets/noteworthy-chat.ts` (TS source), `src/widgets/noteworthy-chat-compiled.js` (compiled), `src/widgets/voice-audio-engine.js`, `noteworthy-chat.js` (Netlify function), `realtime-voice.js`, `chatgpt.js`, `chatgpt-stream.js` |
| **Disposition** | **Isolate** |
| **V2 destination** | **V2 homepage** (`v2/index.html`): same widget, deferred init (~1s + first interaction), `data-brand-title="Noteworthy News AI"`, `data-logo="/IMG_5794.PNG"`, endpoint `/.netlify/functions/noteworthy-chat`. Legacy `index.html` uses widget defaults (same branding + `/IMG_5794.PNG` when `data-logo` omitted). Server/system prompts use **Noteworthy News AI** (`noteworthy-chat.js`, `realtime-voice.js`). |
| **Migration dependencies** | Homepage rebuild (ensure lazy loading) |
| **Validation** | Chat opens; text responses work; image generation works; voice mode works; rate limiting works |

---

## 16. Transcription Pipeline (Clemens)

| Field | Value |
|-------|-------|
| **Business purpose** | Upload audio → chunked transcription via OpenAI Whisper → downloadable transcript. |
| **Current source** | `create-job.js`, `process-job.js` (769 lines), `job-status.js`, `trigger-job.js`, `trigger-all-queued-jobs.js`, `transcribe-direct.js`, `transcribe-from-url.js`, `get-upload-url.js`, `clemensconverter/`, Supabase `transcription_jobs`, R2 storage |
| **Disposition** | **Isolate** |
| **V2 destination** | Keep functionality. Ensure `CLEMS_TOKEN` check fails closed. Consider whether `clemensconverter/` should be a separate deploy. |
| **Migration dependencies** | Auth middleware for fail-closed token checks |
| **Validation** | Upload → job created → processing → transcript downloadable |

---

## 17. Design System / Shared Styles

| Field | Value |
|-------|-------|
| **Business purpose** | Visual coherence across all public pages. |
| **Current source** | `src/styles/premium-tokens.css` (145 lines - design tokens), `src/styles/premium-components.css` (442 lines), `styles.css` (4,672 lines - global), `styles/responsive.css` (5,591 lines), `styles/animations.css` (552 lines), `styles/interactive-components.css` (700 lines), `styles/resource-pages.css`, `styles/legal-pages.css`, `styles/legal-resource-advanced.css`, `christmas-theme.css`, `src/styles/light-theme.css`, `mobile.css`, `src/styles/mobile-fixes.css`, `src/styles/print.css` |
| **Disposition** | **Consolidate + Rebuild** |
| **V2 destination** | `premium-tokens.css` as the canonical token layer. Consolidate global styles into a structured system: tokens → base → layout → components → pages. Eliminate duplicate responsive rules. Scope feature CSS (situation monitor, games, admin) to their subsystems. |
| **Migration dependencies** | None (can begin independently) |
| **Validation** | Visual regression testing across key pages; no broken layouts on mobile or desktop |

---

## 18. Cloudflare X/Twitter Feed Worker

| Field | Value |
|-------|-------|
| **Business purpose** | Alternative X/Twitter feed ingestion via oEmbed + KV storage, with bookmarklet for quick post addition. |
| **Current source** | `cloudflare-worker/src/index.ts`, `src/utils.ts`, `src/types.ts`, `bookmarklet.js`, `bookmarklet-minified.js`, `migrate-posts.js` |
| **Disposition** | **Defer** (decision needed) |
| **V2 destination** | Decide whether this is the canonical X feed path or Netlify `x-posts` is. If both are needed, define clear ownership. If not, retire one. The worker has its own KV store and admin Bearer token - it is a parallel system to the Netlify post pipeline. |
| **Migration dependencies** | Product decision on canonical feed architecture |
| **Validation** | If kept: bookmarklet adds posts; feed endpoint returns posts; sync works |

---

## 19. Build Pipeline

| Field | Value |
|-------|-------|
| **Business purpose** | Production asset preparation - minification, auth injection, timestamp updates. |
| **Current source** | `webpack.config.js` (bundles only `script.js` + `music-system.js`), `scripts/inject-auth0.js`, `scripts/update-last-modified.js`, `netlify.toml` build command: `npm run build` |
| **Disposition** | **Rebuild** |
| **V2 destination** | Extend build pipeline to cover all JS entry points. Options: expand webpack config, or migrate to Vite for faster builds + native ES module support + code splitting. Pre-compile JSX (kill Babel-in-browser). Bundle and tree-shake vendor dependencies. |
| **Migration dependencies** | Homepage rebuild; feed component consolidation |
| **Validation** | All pages load correctly in production build; no regressions in Netlify deploy; source maps available for debugging |

---

## 20. Push Notifications

| Field | Value |
|-------|-------|
| **Business purpose** | Browser push notifications for site updates and content alerts. |
| **Current source** | `push-subscribe.js` (359 lines), `send-push-notification.js` (334 lines), `send-website-update.js` (115 lines), `notification-preferences.js` (228 lines), `src/utils/push-notifications.js`, `scripts/generate-vapid-keys.js`, `sw.js` push event handler |
| **Disposition** | **Preserve** |
| **V2 destination** | Keep as-is. Ensure `PUSH_API_KEY` / `ADMIN_API_KEY` checks fail closed. |
| **Migration dependencies** | Auth middleware |
| **Validation** | Subscribe works; notifications received; preferences persist |

---

## 21. RSS Aggregation / Proxy

| Field | Value |
|-------|-------|
| **Business purpose** | Aggregate and proxy external RSS feeds for display in Situation Monitor and other widgets. |
| **Current source** | `rss-feed.js` (174 lines), `rss-aggregate.js` (288 lines), `rssProxy.js` (302 lines), `src/rss/parser.js`, `src/rss/feeds.js`, `rss-feeds-config.js` |
| **Disposition** | **Consolidate** |
| **V2 destination** | One RSS proxy function with feed allowlisting. `rss-feed.js`, `rss-aggregate.js`, and `rssProxy.js` have overlapping functionality - merge into one with mode parameter. The inline `parseRSSBasic` in `ingest-all.js` should use the shared parser. |
| **Migration dependencies** | None |
| **Validation** | Situation Monitor panels receive RSS data; feeds render correctly |

---

## 22. Live Cams

| Field | Value |
|-------|-------|
| **Business purpose** | Live camera feeds from CAMS network, displayed in Situation Monitor. |
| **Current source** | `js/liveCams/` (index.js 566 lines + components + providers + map layer), `css/liveCams.css` (1,821 lines), `cams-health.js`, `cams-proxy-image.js`, `cams-search.js`, `cams-token.js` |
| **Disposition** | **Preserve** (within Situation Monitor isolation) |
| **V2 destination** | Lives as a sub-module of Situation Monitor. No changes needed unless Monitor is restructured. |
| **Migration dependencies** | Situation Monitor isolation (#7) |
| **Validation** | Cams search works; images load; map markers display |

---

## 23. Leaderboard System

| Field | Value |
|-------|-------|
| **Business purpose** | Per-game leaderboards with score tracking and notifications. |
| **Current source** | `leaderboard.js` (function, 271 lines), `leaderboard-broadcast.js` (206 lines), `send-leaderboard-notification.js` (301 lines), `src/components/leaderboard-display.js`, `src/styles/realtime-leaderboard.css`, `src/utils/leaderboard-realtime.js` |
| **Disposition** | **Preserve** |
| **V2 destination** | Keep. Ensure leaderboard write endpoint validates score reasonableness. |
| **Migration dependencies** | None |
| **Validation** | Scores submit; leaderboard displays; notifications send |

---

## 24. Globe / 3D Visualization

| Field | Value |
|-------|-------|
| **Business purpose** | Interactive 3D globe showing global news coverage. Premium visual feature. |
| **Current source** | `src/components/CiaMissionGlobe.js` (ES module, globe.gl), `src/components/CiaMissionGlobe-cdn.js` (CDN loader variant), `src/components/CiaMissionGlobe.jsx` (React variant), `src/styles/ciaGlobe.css`, `styles/command-center.css`, `mission-control.html`, `mission-globe.html`, `src/data/coveragePoints.json` |
| **Disposition** | **Isolate** |
| **V2 destination** | Keep as lazy-loaded specialty visualization. Remove from default homepage load - make it opt-in or behind a "View Globe" interaction. Three.js (~700KB) should not be in the critical path of a news homepage. |
| **Migration dependencies** | Homepage rebuild |
| **Validation** | Globe renders; coverage points display; search works; full-page mission-control still works |

---

## 25. Service Worker / PWA

| Field | Value |
|-------|-------|
| **Business purpose** | Offline support, asset caching, push notification handling, newsletter background sync. |
| **Current source** | `sw.js` (447 lines), `site.webmanifest` |
| **Disposition** | **Preserve** (with scope reduction) |
| **V2 destination** | Keep service worker. Reduce precache list as homepage is decomposed. Ensure cache versioning stays in sync with deploys. |
| **Migration dependencies** | Homepage rebuild |
| **Validation** | Pages load offline from cache; push events handled; cache updates on new deploy |

---

## 26. Contact / Tips / Fact-Check Submission

| Field | Value |
|-------|-------|
| **Business purpose** | Public forms for contacting the team, submitting tips, and requesting fact-checks. |
| **Current source** | `contact.html` (1,061 lines), `submit-fact-check.html` (344 lines), `send-contact-form.js` (179 lines), `submit-tip.js` (681 lines), `submit-fact-check.js` (122 lines) |
| **Disposition** | **Preserve** |
| **V2 destination** | Keep. Extract inline CSS from `contact.html` during design system work. Ensure forms have server-side rate limiting. |
| **Migration dependencies** | Design system consolidation |
| **Validation** | Forms submit; emails received; rate limits honored |

---

## 27. Legal / Resource / Guide Pages

| Field | Value |
|-------|-------|
| **Business purpose** | Privacy policy, terms, editorial policy, media literacy guides, fact-checking tips, educational resources, geopolitics guide, news types guide, how we verify, critical reading guide. |
| **Current source** | 12 HTML files (400–1,600 lines each), `styles/resource-pages.css`, `styles/legal-pages.css`, `styles/legal-resource-advanced.css`, `js/resource-page-utils.js`, `js/quiz-engine.js`, `legal-resource-enhance.js` |
| **Disposition** | **Preserve** |
| **V2 destination** | Keep content. Adopt shared layout/nav from homepage rebuild. Consolidate the three legal/resource CSS files into one scoped stylesheet. |
| **Migration dependencies** | Design system consolidation; shared nav |
| **Validation** | All pages render; quiz functionality works; mobile layout correct |

---

## 28. Security Check / Route Protection

| Field | Value |
|-------|-------|
| **Business purpose** | Human verification gate before certain pages (game, situation monitor). |
| **Current source** | `security-check.html` (254 lines - React + Babel in browser), `src/components/SecurityCheck.jsx`, `src/components/security-check.css`, `lib/security/routeProtection.js`, `lib/security/routeProtection-browser.js`, `lib/security/securityConfig.js` |
| **Disposition** | **Rebuild** |
| **V2 destination** | Pre-compile JSX (no Babel-in-browser). If this is a bot-protection gate, consider whether it should be server-side. If it protects premium content, move to server-enforced auth. |
| **Migration dependencies** | Build pipeline; auth strategy |
| **Validation** | Protected pages still require verification; verification flow completes; redirect to intended page works |

---

## 29. Christmas / Seasonal Theme

| Field | Value |
|-------|-------|
| **Business purpose** | Seasonal visual theming (snow, holiday colors). |
| **Current source** | `christmas-config.js`, `christmas-theme-loader.js`, `christmas-theme.css`, `src/components/christmas/snowfall.css`, related components |
| **Disposition** | **Defer** (then rebuild as lazy) |
| **V2 destination** | Make fully opt-in and lazy-loaded. Remove from `<head>` blocking position. Load only during active season with zero cost outside season. |
| **Migration dependencies** | Homepage rebuild |
| **Validation** | Theme activates during configured season; no cost when inactive |

---

## 30. Category Pages

| Field | Value |
|-------|-------|
| **Business purpose** | Browse posts by category (breaking news, analysis, fact-checks). |
| **Current source** | `category/index.html`, `category/breaking-news.html`, `category/analysis.html`, `category/fact-checks.html` |
| **Disposition** | **Preserve** |
| **V2 destination** | Keep. Consume unified feed component when rebuilt. |
| **Migration dependencies** | Feed component consolidation |
| **Validation** | Categories display correct filtered posts |

---

## 31. Sub-Projects (KONSCIOUS, Clemens Converter, SpotlightSongs)

| Field | Value |
|-------|-------|
| **Business purpose** | Separate creative/tool projects sharing the deploy. |
| **Current source** | `KONSCIOUS/` (mini-site with own CSS/JS), `clemensconverter/` (standalone tool), `SpotlightSongs/` (media assets) |
| **Disposition** | **Isolate** |
| **V2 destination** | Either move to separate deploys or ensure they are fully self-contained with no shared dependencies. Already effectively isolated but clutter the repo root. |
| **Migration dependencies** | None |
| **Validation** | Each sub-project loads independently |

---

## 32. Music / Audio System

| Field | Value |
|-------|-------|
| **Business purpose** | Background music and UI sounds across site. |
| **Current source** | `music-system.js` (1,385 lines), audio files (`.wav`, `.mp3`), `situation-monitor.html` audio elements, `src/widgets/voice-audio-engine.js` |
| **Disposition** | **Isolate + Defer** |
| **V2 destination** | Make fully opt-in. Do not load on homepage by default. Keep as lazy module for pages that use it (game, situation monitor). Separate voice/audio engine (chat widget) from background music. |
| **Migration dependencies** | Homepage rebuild |
| **Validation** | Music plays when opted in; mute persists; no audio on first visit without interaction |

---

## 33. Analytics (First-Party)

| Field | Value |
|-------|-------|
| **Business purpose** | Session tracking, scroll depth, click tracking, fingerprinting, server-side log storage. |
| **Current source** | `src/utils/analytics-tracker.js`, `log-data.js` (1,851 lines), `stream-logs.js`, `admin-analytics.html` |
| **Disposition** | **Preserve + Fix** |
| **V2 destination** | Keep analytics pipeline. Fix: `log-data` GET must require auth (fail closed). Consider whether canvas fingerprinting is justified - it has privacy implications and main-thread cost. |
| **Migration dependencies** | Auth middleware |
| **Validation** | Events logged; admin dashboard displays data; CSV export works |

---

## 34. Email Infrastructure (Resend)

| Field | Value |
|-------|-------|
| **Business purpose** | Transactional and marketing email: newsletter sends, earthquake alerts, contact forms, tips, leaderboard notifications, visit streak milestones, voice call summaries, inbound email processing. |
| **Current source** | 18+ Netlify Functions using Resend. `api/send-email.js` (separate from netlify/functions). `lib/sendAlert.js`, `lib/emailPreferences.js`, `lib/emailRateLimit.js`, `lib/name-inference.js`, `email-name-mapping.js`, `emails/` templates. |
| **Disposition** | **Preserve** |
| **V2 destination** | Keep Resend as email provider. Ensure all send functions use shared rate-limit and preference-check utilities. Consolidate the two `send-email` locations (`api/send-email.js` vs `netlify/functions/send-email.js`). |
| **Migration dependencies** | None |
| **Validation** | All email types deliver; rate limits honored; unsubscribe works; webhooks process |
