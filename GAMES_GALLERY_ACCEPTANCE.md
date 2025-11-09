# Games Gallery - Acceptance Criteria & Testing Checklist

## ✅ Acceptance Criteria

### 1. Grid Display
- [ ] Grid displays all approved games from `games.json`
- [ ] Each game card shows: thumbnail, title, category pill, description, Play button
- [ ] Grid is responsive (single column on mobile, multi-column on desktop)
- [ ] Thumbnails load with lazy loading (`loading="lazy"`)

### 2. Search Functionality
- [ ] Search box filters games by title
- [ ] Search box filters games by description
- [ ] Search box filters games by category
- [ ] Search is case-insensitive
- [ ] Clear button (×) appears when search has text
- [ ] Clear button clears search and shows all games
- [ ] Keyboard shortcut `K` focuses search input
- [ ] Keyboard shortcut `/` focuses search input

### 3. Category Filter
- [ ] Category buttons show all unique categories from games
- [ ] "All" category shows all games
- [ ] Selecting a category shows only games in that category
- [ ] Active category button is visually highlighted
- [ ] Category filter works with search (both filters apply)

### 4. Modal Player
- [ ] Clicking "Play" button opens modal
- [ ] Modal displays game title in header
- [ ] Modal contains iframe with game
- [ ] Iframe has correct sandbox attributes
- [ ] Iframe has `referrerPolicy="no-referrer"`
- [ ] Modal shows security warning banner
- [ ] Modal can be closed with × button
- [ ] Modal can be closed with `Esc` key
- [ ] Focus trap works inside modal (Tab cycles through focusable elements)
- [ ] Focus returns to Play button after closing
- [ ] Modal is responsive (full screen on mobile)

### 5. Security & Approval
- [ ] Unapproved games show "⚠️ Pending Approval" badge
- [ ] Clicking Play on unapproved game shows alert and blocks play
- [ ] External embed URLs require `approved: true` to play
- [ ] Console warns when attempting to play unapproved external embed
- [ ] Local games (starting with `/`) can play if `approved: true`

### 6. Mobile Responsiveness
- [ ] Grid becomes single column on narrow screens (< 768px)
- [ ] Search box is full width on mobile
- [ ] Category buttons wrap on mobile
- [ ] Modal is full screen on mobile
- [ ] All controls are touch-friendly (adequate tap targets)
- [ ] Text is readable on mobile

### 7. Accessibility
- [ ] All interactive elements have ARIA labels
- [ ] Modal has `role="dialog"` and `aria-modal="true"`
- [ ] Category buttons have `role="tab"` and `aria-selected`
- [ ] Grid has `role="grid"` and `aria-label`
- [ ] Keyboard navigation works (Tab, Enter, Esc)
- [ ] Focus indicators are visible
- [ ] Screen reader can navigate and understand structure
- [ ] Reduced motion preferences are respected

### 8. Performance
- [ ] Thumbnails are lazy-loaded
- [ ] Modal iframe code is code-split (loads only when opened)
- [ ] No layout shift when images load
- [ ] Smooth animations (if motion not reduced)
- [ ] Bundle size is reasonable

### 9. Error Handling
- [ ] Shows error message if `games.json` fails to load
- [ ] Shows empty state when no games match filters
- [ ] Shows loading state while fetching games
- [ ] Handles missing thumbnails gracefully (placeholder)
- [ ] Handles invalid game data gracefully

### 10. Additional Features
- [ ] Recently played games are stored in localStorage
- [ ] Analytics event fires on Play (if `window.analytics` exists)
- [ ] Games are filtered to show approved games by default

## 🧪 Manual Testing Steps

### Setup
1. Ensure `games.json` exists with at least 3 sample games
2. Ensure at least one game has `approved: false`
3. Start dev server: `npm run dev` or `netlify dev`
4. Navigate to page with GamesGallery component

### Test 1: Grid Display
1. ✅ Verify all approved games appear in grid
2. ✅ Verify each card shows thumbnail, title, category, description
3. ✅ Resize browser window - verify responsive layout

### Test 2: Search
1. ✅ Type "stunt" in search box
2. ✅ Verify only "Stunt City" appears (if exists)
3. ✅ Clear search - verify all games reappear
4. ✅ Press `K` key - verify search input is focused
5. ✅ Press `/` key - verify search input is focused

### Test 3: Category Filter
1. ✅ Click "Parkour" category button
2. ✅ Verify only Parkour games appear
3. ✅ Click "All" - verify all games reappear
4. ✅ Combine with search - verify both filters work

### Test 4: Modal Player
1. ✅ Click "Play" on an approved game
2. ✅ Verify modal opens with game title
3. ✅ Verify iframe loads game
4. ✅ Press `Esc` - verify modal closes
5. ✅ Click × button - verify modal closes
6. ✅ Verify focus returns to Play button after close
7. ✅ Tab through modal - verify focus trap works

### Test 5: Security
1. ✅ Find unapproved game (if exists)
2. ✅ Verify "Pending Approval" badge is visible
3. ✅ Click Play - verify alert appears and game doesn't open
4. ✅ Check console for warning message

### Test 6: Mobile
1. ✅ Open browser DevTools → Toggle device toolbar
2. ✅ Select mobile device (e.g., iPhone 12)
3. ✅ Verify single column layout
4. ✅ Verify all controls are touch-accessible
5. ✅ Open modal - verify full screen
6. ✅ Test on actual mobile device if possible

### Test 7: Accessibility
1. ✅ Enable screen reader (VoiceOver on Mac, NVDA on Windows)
2. ✅ Navigate through gallery with keyboard
3. ✅ Verify all elements are announced correctly
4. ✅ Verify focus indicators are visible
5. ✅ Test with keyboard only (no mouse)

### Test 8: Error Cases
1. ✅ Rename `games.json` temporarily
2. ✅ Reload page - verify error message appears
3. ✅ Restore `games.json`
4. ✅ Search for "nonexistent" - verify empty state

## 🧪 Automated Tests

Run Jest tests:

```bash
npm test -- GamesGallery.test.js
```

Expected test results:
- ✅ All tests pass
- ✅ Search functionality tested
- ✅ Category filter tested
- ✅ Modal open/close tested
- ✅ Unapproved game blocking tested

## 📊 Sample Test Data

Use these games in `games.json` for testing:

```json
[
  {
    "id": "stunt-city",
    "title": "Stunt City",
    "category": "Driving",
    "src": "/games/stunt-city/index.html",
    "thumb": "/games/stunt-city/cover.jpg",
    "description": "Open-map stunt driving",
    "approved": true
  },
  {
    "id": "parkour-blocks",
    "title": "Parkour Blocks",
    "category": "Parkour",
    "src": "/games/parkour-blocks/index.html",
    "thumb": "/games/parkour-blocks/cover.jpg",
    "description": "Navigate through challenging parkour courses",
    "approved": true
  },
  {
    "id": "unapproved-test",
    "title": "Unapproved Test Game",
    "category": "Puzzle",
    "src": "/games/unapproved/index.html",
    "thumb": "/games/unapproved/cover.jpg",
    "description": "This game is not approved",
    "approved": false
  }
]
```

## ✅ Sign-off

Once all criteria are met:

- [ ] All manual tests pass
- [ ] All automated tests pass
- [ ] Code review completed
- [ ] Documentation reviewed
- [ ] Security headers configured
- [ ] Ready for production

**Tested by:** _________________  
**Date:** _________________  
**Approved by:** _________________

