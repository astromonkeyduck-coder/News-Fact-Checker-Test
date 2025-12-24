# vNext - Next Steps & Remaining Work

## ✅ Recently Completed

1. **Accordion System** - Mobile secondary sections can now collapse
2. **DOM Throttling Utilities** - Created utilities to prevent layout thrashing
3. **Integration** - Accordions integrated into homepage initialization

---

## 🚧 Immediate Next Steps (Priority Order)

### 1. Test Mobile Layouts (Critical)
- [ ] Test at 390px (iPhone)
- [ ] Test at 414px (Android)
- [ ] Test at 768px (Tablet)
- [ ] Verify header doesn't overlap
- [ ] Verify tap targets are >= 44px
- [ ] Test accordion functionality
- [ ] Test reduced motion behavior

### 2. Apply DOM Throttling (High Priority)
- [ ] Find timer/counter updates in `script.js`
- [ ] Apply `throttleCounter` to game timers
- [ ] Apply `throttleRAF` to scroll handlers
- [ ] Apply `batchDOMUpdates` to ticker updates

### 3. Footer Links Audit (Medium Priority)
- [ ] Search for footer in `index.html`
- [ ] Remove any admin links from public footer
- [ ] Verify all footer links work
- [ ] Test footer on mobile

### 4. Console.log Replacement (Can Be Automated)
- [ ] Create script to batch replace console.log
- [ ] Focus on critical files first:
  - `script.js`
  - `src/components/*.js`
  - `src/widgets/*.js`
- [ ] Test after replacement

### 5. innerHTML Security Audit (High Priority)
- [ ] Focus on user-generated content first
- [ ] Comment sections (already fixed)
- [ ] Post feeds
- [ ] Form submissions
- [ ] Apply sanitization utilities

---

## 📋 Detailed Tasks

### DOM Throttling Application

**Files to Update:**
1. `script.js` - Game timers (line ~3219)
2. `script.js` - Question timers (line ~3822)
3. Any scroll handlers with frequent updates

**Pattern:**
```javascript
// Before
this.timer = setInterval(() => {
  this.updateDisplay();
}, 100);

// After
import { throttleCounter } from './src/js/utils/dom-throttle.js';
const throttledUpdate = throttleCounter(this.displayElement, () => {
  this.updateDisplay();
});
this.timer = setInterval(throttledUpdate, 100);
```

### Footer Links

**Check:**
- Footer section in `index.html`
- Any links to `/admin*` pages
- Any links to localhost
- Broken external links

**Fix:**
- Remove admin links from public footer
- Keep only public pages (About, Contact, Privacy, Terms)
- Verify all links work

### Console.log Replacement

**Strategy:**
1. Start with critical files
2. Replace `console.log` → `logger.log`
3. Replace `console.error` → `logger.error`
4. Replace `console.warn` → `logger.warn`
5. Add import: `import { logger } from '../utils/logger.js';`

**Files Priority:**
1. `script.js` (main game logic)
2. `src/components/leaderboard.js`
3. `src/components/post-feed.js`
4. Other component files

---

## 🎯 Success Criteria

### Mobile Testing
- ✅ No horizontal scroll
- ✅ Header doesn't overlap content
- ✅ All buttons tappable (>= 44px)
- ✅ Accordions work smoothly
- ✅ Reduced motion respected

### Performance
- ✅ No layout thrashing
- ✅ Smooth animations
- ✅ Fast first paint
- ✅ No console spam in production

### Security
- ✅ No XSS vulnerabilities
- ✅ User input sanitized
- ✅ No admin links in footer

---

## 📊 Progress Summary

**Completed:**
- ✅ Modular homepage system
- ✅ Mobile CSS fixes
- ✅ Security utilities
- ✅ Accordion system
- ✅ DOM throttling utilities

**In Progress:**
- 🚧 DOM throttling application
- 🚧 Footer links audit
- 🚧 Mobile testing

**Pending:**
- ⏳ Console.log replacement
- ⏳ innerHTML audit
- ⏳ Rate limiting

---

**Status:** Ready for testing and refinement

