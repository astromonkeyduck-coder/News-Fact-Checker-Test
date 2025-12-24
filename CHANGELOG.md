# Noteworthy News Changelog

## Release Checklist (vNext)

Before deploying vNext, verify:
- [ ] Lighthouse check (perf/accessibility/best practices) - Target: 90+ Performance
- [ ] Mobile sanity check (iPhone width 390px + Android width 414px)
- [ ] No console spam in production
- [ ] No broken links in header/footer
- [ ] Netlify deploy successful
- [ ] All forms work correctly
- [ ] Games load properly
- [ ] Real-time features work

---

## vNext - Performance + Mobile + Code Hygiene + Reliability

### Performance Improvements
- Deferred heavy animations (matrix rain, particles) until user interaction or idle
- Lazy-loaded game embeds using IntersectionObserver
- Deferred country spotlight fetch until section visible
- Deferred Twitter feed rendering until near viewport
- Added `loading="lazy"` to non-hero images
- Code splitting: Homepage split into modular components
- Throttled DOM updates (tickers, counters) using requestAnimationFrame
- Removed blocking scripts from initial load
- Audio files no longer auto-load (require user interaction)

### Mobile Responsiveness
- Fixed header overlap issues on mobile
- Ensured all tap targets >= 44px
- Fixed navigation consistency (desktop/mobile)
- Reduced heavy effects on mobile by default
- Added "Enable Effects" toggle for mobile users
- Respects `prefers-reduced-motion` media query
- Fixed game embeds for mobile (full-screen option)
- Improved modal sizing for mobile viewports

### Code Hygiene
- Replaced all `console.log` with logger utility (disabled in production)
- Removed localhost references from production code
- Fixed HTML validity issues (duplicate tags, nesting)
- Improved error handling with user-safe fallbacks
- Added retry logic for Country Spotlight with localStorage caching
- Removed debug code from production builds

### Reliability + Security
- Audited and sanitized all `innerHTML` usage
- Added input validation and sanitization
- Implemented rate limiting for tip submission
- Fixed XSS vulnerabilities in user-generated content
- Improved error boundaries

### UX Polish
- Collapsed secondary sections into accordions on mobile
- Improved "Latest Breaking News" visual hierarchy
- Fixed all footer links (removed dead admin links)
- Ensured consistent button behavior
- Added loading states for async content
- Improved error messages (user-friendly)

---

## Previous Releases

### Phase 2: Multiplayer v1 (December 2025)
- Added multiplayer game rooms (2-8 players)
- Real-time game synchronization
- Room management system
- WebSocket client for real-time updates

### Phase 1: Real-Time Leaderboards (December 2025)
- Real-time leaderboard updates via WebSocket
- Presence indicators (active users)
- Live score broadcasting
- Graceful degradation without WebSocket

