# vNext Phase-by-Phase Audit

## PHASE 0 — Safety / Baseline ✅

### Requirements:
- [x] Create branch: `vnext-performance-mobile`
- [x] Add CHANGELOG.md section "vNext" listing each fix
- [x] Add lightweight "release checklist" comment at top

### Status: ✅ COMPLETE

---

## PHASE 1 — Performance

### A) Reduce initial load / "first interaction"

**Requirements:**
- [x] Defer heavy animations (matrix rain, particles) - ✅ Done in `initEffects.js`
- [x] Defer game embeds - ✅ Done in `initGames.js`
- [x] Defer country spotlight fetch - ✅ Done in `initSpotlight.js`
- [x] Defer Twitter feed rendering - ✅ Done in `initFeeds.js`
- [x] Use requestIdleCallback - ✅ Done in `initCore.js` deferInit()
- [x] Use IntersectionObserver - ✅ Done in all lazy-load modules
- [ ] **MISSING:** Verify audio does not auto-play
- [ ] **MISSING:** Verify large images/audio are deferred

**Status: ⚠️ MOSTLY COMPLETE - Need audio check**

### B) Lazy-load images + media

**Requirements:**
- [x] Add loading="lazy" to non-hero images - ✅ `initLazyImages()` created
- [x] Add decoding="async" where appropriate - ✅ Included in `initLazyImages()`
- [ ] **MISSING:** Verify audio does not auto-play
- [ ] **MISSING:** Audio loads only after user clicks "Play"

**Status: ⚠️ PARTIAL - Need audio verification**

### C) Code splitting / modularization

**Requirements:**
- [x] /js/homepage/initCore.js (critical) - ✅ Created
- [x] /js/homepage/initEffects.js (matrix/particles) - ✅ Created
- [x] /js/homepage/initFeeds.js (X feed, live updates) - ✅ Created
- [x] /js/homepage/initGames.js (geography + fact-checker) - ✅ Created
- [x] /js/homepage/initSpotlight.js - ✅ Created
- [x] /js/utils/ shared helpers - ✅ Created (throttle, sanitize, dom-throttle)
- [x] Only initCore.js runs immediately - ✅ Verified

**Status: ✅ COMPLETE**

### D) Reduce DOM churn

**Requirements:**
- [x] Throttle utilities created - ✅ `throttle.js`, `dom-throttle.js`
- [ ] **MISSING:** Apply throttling to tickers/counters in `script.js`
- [ ] **MISSING:** Apply measure once, write once patterns

**Status: ⚠️ PARTIAL - Utilities created but not applied**

### E) Measure

**Requirements:**
- [x] Logger has performance() method - ✅ Created
- [ ] **MISSING:** Time-to-first-interaction logging
- [ ] **MISSING:** Module initialization timing logs
- [x] Disabled in production - ✅ Logger checks production

**Status: ⚠️ PARTIAL - Need timing logs**

---

## PHASE 2 — Mobile Responsiveness

### A) Remove "desktop-only" feel

**Requirements:**
- [x] Mobile fixes CSS created - ✅ `mobile-fixes.css`
- [x] Header overlap fixes - ✅ CSS includes fixes
- [x] Tap targets >= 44px - ✅ CSS enforces this
- [x] Font sizes readable (16px base) - ✅ CSS includes
- [x] Modals fit viewport - ✅ CSS includes
- [ ] **MISSING:** Actual testing at 390px, 414px, 768px

**Status: ⚠️ CSS COMPLETE - Needs testing**

### B) Navigation consistency

**Requirements:**
- [ ] **MISSING:** Audit anchor mismatches
- [ ] **MISSING:** Verify IDs exist and are unique
- [x] Reduced motion support - ✅ CSS includes `@media (prefers-reduced-motion)`

**Status: ⚠️ PARTIAL - Needs anchor audit**

### C) Effects behavior on mobile

**Requirements:**
- [x] Disable matrix rain/particles on mobile - ✅ `initEffects.js` checks `isMobile()`
- [x] "Enable Effects" toggle - ✅ `initEffects.js` includes toggle
- [x] Respect prefers-reduced-motion - ✅ CSS and JS check

**Status: ✅ COMPLETE**

### D) Game embeds on mobile

**Requirements:**
- [x] "Open game in full screen" button - ✅ `initGames.js` shows mobile button
- [x] No broken iframes - ✅ Mobile shows button instead

**Status: ✅ COMPLETE**

---

## PHASE 3 — Code Hygiene

### A) Remove debug + localhost references

**Requirements:**
- [x] Logger utility exists - ✅ `src/utils/logger.js`
- [x] Logger production detection fixed - ✅ Updated
- [ ] **MISSING:** Replace console.log with logger (3,929 instances)
- [ ] **MISSING:** Remove localhost references (28 files)

**Status: ⚠️ PARTIAL - Logger ready, replacement pending**

### B) Fix HTML validity issues

**Requirements:**
- [ ] **MISSING:** Validate index.html structure
- [ ] **MISSING:** Check for duplicate closing tags
- [ ] **MISSING:** Check for unique IDs
- [ ] **MISSING:** Clean up broken ARIA attributes

**Status: ❌ NOT STARTED**

### C) Error handling

**Requirements:**
- [x] Spotlight has timeout handling - ✅ `initSpotlight.js` has 10s timeout
- [x] Spotlight has retry button - ✅ `showSpotlightError()` includes retry
- [x] Spotlight has localStorage caching - ✅ `cacheSpotlight()` implemented
- [x] User-safe fallback UI - ✅ Error states show retry buttons
- [ ] **MISSING:** Replace silent catch blocks elsewhere

**Status: ⚠️ MOSTLY COMPLETE - Spotlight done, others pending**

---

## PHASE 4 — Reliability + Security

### A) InnerHTML audit

**Requirements:**
- [x] Sanitization utilities created - ✅ `sanitize.js`
- [x] Comment section fixed - ✅ Uses DOM creation
- [ ] **MISSING:** Audit remaining innerHTML (361 instances)
- [ ] **MISSING:** Fix user-generated content injection
- [ ] **MISSING:** Fix external feeds injection

**Status: ⚠️ PARTIAL - Utilities created, audit pending**

### B) Rate limiting / spam protection

**Requirements:**
- [x] submit-tip.js exists - ✅ Found
- [ ] **MISSING:** Add rate limiting to submit-tip.js
- [ ] **MISSING:** Add honeypot field
- [ ] **MISSING:** Server-side HTML stripping

**Status: ❌ NOT STARTED**

---

## PHASE 5 — UX Polish

### A) Collapse secondary sections

**Requirements:**
- [x] Accordion system created - ✅ `accordion.js`
- [x] Accordion integrated - ✅ In `index.js`
- [x] Mobile-only collapse - ✅ Checks `isMobile()`

**Status: ✅ COMPLETE**

### B) "Latest Breaking News" hierarchy

**Requirements:**
- [ ] **MISSING:** Make visually dominant
- [ ] **MISSING:** Clearer hierarchy
- [ ] **MISSING:** Consistent button behavior

**Status: ❌ NOT STARTED**

### C) Footer links

**Requirements:**
- [x] Admin link removed - ✅ Fixed
- [ ] **MISSING:** Verify all footer links work

**Status: ⚠️ PARTIAL - Admin removed, verification pending**

---

## Summary

### ✅ Complete Phases:
- Phase 0: Safety / Baseline
- Phase 1C: Code splitting
- Phase 2C: Effects behavior on mobile
- Phase 2D: Game embeds on mobile
- Phase 3C: Error handling (Spotlight)
- Phase 5A: Accordion system

### ⚠️ Partial Phases:
- Phase 1A: Initial load (needs audio check)
- Phase 1B: Lazy-load (needs audio verification)
- Phase 1D: DOM churn (utilities created, not applied)
- Phase 1E: Measure (needs timing logs)
- Phase 2A: Mobile feel (CSS done, needs testing)
- Phase 2B: Navigation (needs anchor audit)
- Phase 3A: Debug removal (logger ready, replacement pending)
- Phase 3C: Error handling (Spotlight done, others pending)
- Phase 4A: InnerHTML (utilities created, audit pending)
- Phase 5C: Footer links (admin removed, verification pending)

### ❌ Not Started:
- Phase 3B: HTML validity
- Phase 4B: Rate limiting
- Phase 5B: Breaking News hierarchy

---

## Critical Missing Items

1. **Audio auto-play verification** - Must ensure no auto-play
2. **DOM throttling application** - Apply to game timers
3. **Console.log replacement** - Start with critical files
4. **innerHTML audit** - Focus on user content
5. **Rate limiting** - Add to submit-tip.js
6. **HTML validation** - Check structure
7. **Mobile testing** - Test at 390px, 414px, 768px
8. **Performance timing logs** - Add TTI and module timing

