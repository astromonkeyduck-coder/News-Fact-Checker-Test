# Noteworthy News vNext - Implementation Plan

**Branch:** `vnext-performance-mobile`  
**Goal:** Performance overhaul, mobile polish, code hygiene, reliability hardening  
**No design changes** - maintain Noteworthy News style/branding

---

## Phase Status Verification

✅ **Phase 1:** Real-Time Leaderboards - COMPLETE  
✅ **Phase 2:** Multiplayer v1 - COMPLETE

---

## Current State Analysis

### Critical Issues Found:
1. **Massive HTML file:** `index.html` is 19,220 lines
2. **Console spam:** 3,929 console.log statements across 174 files
3. **Localhost references:** 28 files contain localhost/127.0.0.1
4. **Performance:** Heavy animations, large files, blocking scripts
5. **Mobile:** Needs responsive polish
6. **Code hygiene:** Debug code in production

---

## Implementation Plan

### PHASE 0: Safety / Baseline
- [x] Create branch: `vnext-performance-mobile`
- [ ] Create CHANGELOG.md with vNext section
- [ ] Add release checklist

### PHASE 1: Performance (Highest Priority)
- [ ] Defer heavy animations (matrix rain, particles)
- [ ] Lazy-load game embeds
- [ ] Defer country spotlight fetch
- [ ] Defer Twitter feed rendering
- [ ] Lazy-load images with loading="lazy"
- [ ] Code splitting for homepage
- [ ] Throttle DOM updates
- [ ] Add performance logging (dev only)

### PHASE 2: Mobile Responsiveness
- [ ] Audit layouts at 390px, 414px, 768px
- [ ] Fix header overlap
- [ ] Ensure tap targets >= 44px
- [ ] Fix navigation consistency
- [ ] Reduce effects on mobile
- [ ] Respect prefers-reduced-motion
- [ ] Fix game embeds on mobile

### PHASE 3: Code Hygiene
- [ ] Replace console.log with logger utility
- [ ] Remove localhost references
- [ ] Fix HTML validity
- [ ] Improve error handling
- [ ] Add retry logic for Spotlight

### PHASE 4: Reliability + Security
- [ ] Audit innerHTML usage
- [ ] Sanitize user input
- [ ] Add rate limiting (if needed)
- [ ] Validate all forms

### PHASE 5: UX Polish
- [ ] Collapse secondary sections on mobile
- [ ] Improve "Latest Breaking News" hierarchy
- [ ] Fix footer links
- [ ] Ensure button behavior consistency

---

## File Targets

### High Priority Files:
1. `index.html` - Main homepage (19,220 lines - needs splitting)
2. `script.js` - Main script file
3. `src/utils/logger.js` - Create logger utility
4. All files with console.log - Replace with logger
5. All files with localhost - Remove/replace

### Performance Targets:
- `index.html` - Split into modules
- Heavy animations - Defer initialization
- Images - Add lazy loading
- Audio - No auto-play

---

**Status:** Plan created, ready for implementation

