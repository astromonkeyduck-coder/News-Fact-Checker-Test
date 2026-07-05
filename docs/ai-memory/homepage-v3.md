# Homepage 3.0 (v2/index.html): DOM contracts and gotchas

Written after the "Noteworthy News 3.0" editorial reset (Jul 2026). Read this
before editing `v2/index.html` or its JS/CSS.

## Architecture

- Vanilla HTML/CSS/JS. `v2/index.html` is served at `/` via a Netlify rewrite
  (`netlify.toml`). Build = `update-last-modified.js` + `inject-auth0.js` +
  webpack minify (webpack only bundles legacy `script.js`/`music-system.js`,
  not v2 files; v2 JS ships as-is).
- CSS layers: `tokens.css` (all variables), then `base/layout/components/live-rail`,
  then `v3.css` (3.0 sections; loaded on the homepage only, safe for overrides).
- JS: `main.js` (module entry) imports `feed.js`, `auth.js`, etc.
  `live-rail.js` is a separate deferred IIFE.

## Design rules (from docs/design/noteworthy-redesign-critique.md)

- Real data or nothing. No invented telemetry, no decorative dashboards, no
  status badges without meaning, no filler metrics.
- House style: no U+2014 em dash anywhere in v2 code or copy. Use commas,
  colons, periods, or hyphens.
- Banned homepage vocabulary: radar, command center, live desk, verification
  queue, active alerts, source attribution, monitoring feeds, and any stat not
  backed by config or data.

## DOM contract, do not rename these

| Selector | Consumer |
|---|---|
| `#featured-story-container` (+ `.featured-skeleton` markup) | feed.js featured story (lives in the hero) |
| `#breaking-container`, `#breaking-filters`, `#load-more-btn` | feed.js top stories |
| `#alerts-container` | feed.js alerts |
| `#wire-container` + parent `.wire-section[hidden]` | feed.js wire feed |
| `#hero-ticker`, `#ticker-track` | feed.js ticker |
| `#live-stories`, `#live-rail`, `[data-nav-live]`, `[data-live-cta]` | live-rail.js |
| `#nav-auth-out/-in`, `#nav-user-name`, `#signinBtn`, `#signupBtn`, `#logoutBtn` | auth via main.js |
| `.newsletter-form`, `#newsletter-email`, `.newsletter-hint` | newsletter (`send-email` fn) |
| `#hero-time`, `#scrollTopBtn`, `#audioToggle`, `#audio-visualizer` | main.js / ambient-audio.js |
| `[data-open-chat]` | inline chat bootstrap (opens the AI widget) |

Removed on purpose (feed.js guards nulls): `#alert-count`, the trust strip
(`[data-count-target]` elements), and the old monitor teaser section.

## Key behaviors

- Feed failure states: breaking gets error + retry; the hero featured slot gets
  `.featured-fallback`; alerts get `.feed-state--fallback`. Retry re-skeletons
  breaking/alerts and re-runs everything. Never leave skeletons stuck.
- `live-rail.js` renders one flagship story (`.live-flagship`, pinned story
  preferred) plus up to 4 secondary cards. On success it unhides the header
  `[data-nav-live]` link and repoints `[data-live-cta]` at `#live-stories`.
  Section stays hidden when empty, by design.
- Values shown in the live section (status, follower count, "Updated Xm ago")
  come from real `live-stories` fields: status, follower_count, last_update_at.

## Gotchas

- The Auth0 marker comments (`<!-- Auth0 Configuration ... -->` and
  `<!-- /Auth0 Configuration -->`) are parsed by `scripts/inject-auth0.js` at
  build time. Keep both markers intact.
- Auth0 callback URL must stay `origin/`, not `/v2/...` (auth.js).
- Situation Monitor pages are temporarily 302-redirected to `/` in
  `netlify.toml`; the homepage links to it from the footer only.
- Chat widget: bottom-of-body scripts create `<noteworthy-chat-widget>` in
  shadow DOM; no DOM slot needed. `[data-open-chat]` clicks the shadow-root
  launcher.
- `netlify dev` requires the `[dev]` block in netlify.toml to NOT set
  `command = "netlify dev"` (self-spawn crash: "Cannot read properties of
  undefined (reading 'name')").
- `prefers-reduced-motion` is handled globally in tokens.css plus explicit
  `animation: none` guards in v3.css for looping animations.
- `live-rail.js` and chat use `localhost:8888` function base in local dev.
- A service worker (`/sw.js`) can serve stale v2 JS after deploys; hard reload
  when testing.
