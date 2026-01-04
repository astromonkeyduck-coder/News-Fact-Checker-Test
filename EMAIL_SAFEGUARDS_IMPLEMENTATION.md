# Email Safeguards Implementation Guide

## Current Status

✅ **Leaderboard Notifications:** Working, requires email in score submission  
⚠️ **Streak Tracking:** Added auth check, but needs email preferences  
⚠️ **Location Alerts:** Not integrated into event engines yet  

---

## How Each System Works (Detailed)

### 1. Leaderboard Position Notifications

**Flow:**
```
User submits score → leaderboard.js receives score
  → Checks if userEmail provided (opt-in)
  → Gets previous position from storage
  → Compares with new position
  → If knocked out AND email provided → Send email
  → Save new position
```

**Who Gets Emails:**
- ✅ User must provide `userEmail` in score submission (explicit opt-in)
- ✅ User must have been on leaderboard before
- ✅ User must have gotten knocked out (position got worse)

**When:**
- Only when someone beats their score
- Only once per position change
- Never if they improve

**Safeguards:**
- ✅ Requires explicit email (opt-in)
- ✅ Only sends on position loss
- ✅ Tracks previous position (no duplicates)
- ✅ Includes unsubscribe link

---

### 2. Visit Streak Celebrations

**Flow:**
```
User visits site (logged in) → Client calls track-visit-streak
  → Verifies Auth0 token (NEW - just added)
  → Checks if visited today (skip if yes)
  → Checks if consecutive day
  → Updates streak count
  → If milestone reached AND not sent before → Send email
```

**Who Gets Emails:**
- ✅ Only logged-in users (Auth0 authenticated) - **NOW VERIFIED**
- ✅ Only users who visit site
- ✅ Only at milestone days (2, 3, 4, 6, 8, 11, 15, 31, 51, 101)

**When:**
- Day 2 = "2-Day Streak!" email
- Day 3 = "3-Day Streak!" email
- Day 4 = "4-Day Streak!" email
- Then milestones: 6, 8, 11, 15, 31, 51, 101 days
- **NOT every day** - only milestones

**Safeguards:**
- ✅ Verifies Auth0 token (just added)
- ✅ Only sends at milestones (not daily)
- ✅ Tracks if email already sent for milestone (prevents duplicates)
- ✅ Checks if already visited today (no duplicate tracking)
- ⚠️ **TODO:** Add email preferences check

---

### 3. Location-Based Alerts

**Flow:**
```
Event engine ingests event → Stores in database
  → [NOT YET] Check all users with location alerts enabled
  → [NOT YET] For each user, check if event within radius
  → [NOT YET] If yes AND user opted in → Send email
```

**Who Gets Emails:**
- ✅ Only users who opt-in (enable in profile)
- ✅ Only users who set location
- ✅ Only if event within their radius
- ✅ Only for event types they selected

**When:**
- When new event ingested near their location
- Only if within radius (default 50 miles)
- Only for selected event types

**Safeguards:**
- ✅ Requires explicit opt-in
- ✅ User sets own location/radius
- ✅ User chooses event types
- ⚠️ **NOT YET INTEGRATED** - needs to be added to engines

---

## Integration Steps Needed

### Step 1: Add Email Preferences System

Add to `user-data.js`:

```javascript
// Email preferences structure
preferences: {
  emails: {
    leaderboard: true,  // Default: enabled if email provided
    streak: true,        // Default: enabled
    location: false,     // Default: disabled (must opt-in)
  }
}
```

### Step 2: Check Preferences Before Sending

Update each email function to check preferences:

```javascript
// In send-leaderboard-notification.js
const userData = await getUserData(userEmail);
if (!userData?.preferences?.emails?.leaderboard) {
  return { success: false, reason: 'User disabled leaderboard emails' };
}

// In track-visit-streak.js
const userData = await getUserData(userEmail);
if (!userData?.preferences?.emails?.streak) {
  return { success: false, reason: 'User disabled streak emails' };
}

// In send-location-alert.js
const prefs = await getUserLocationPreferences(userEmail);
if (!prefs?.enabled) {
  return { success: false, reason: 'Location alerts disabled' };
}
```

### Step 3: Integrate Location Alerts into Event Engines

Add to each engine (usgs.js, nws.js, faa.js, etc.) after storing event:

```javascript
// After storing event in storeEvent() function
if (event.lat && event.lon) {
  // Get all users with location alerts enabled
  // Check if event is near each user
  // Send alert if within radius
  // This is a batch operation - you'll want to optimize this
}
```

**Note:** For production, you'll want to:
- Store location preferences in queryable database
- Batch check events against users
- Rate limit (max 1 alert per event per user)
- Cache results to avoid duplicate checks

---

## Client-Side Integration

### For Streak Tracking

Add to your main pages (index.html, game.html, etc.):

```javascript
// Only track if user is authenticated
if (window.auth0 && window.auth0.isAuthenticated()) {
  window.auth0.getTokenSilently().then(token => {
    window.auth0.getUser().then(user => {
      if (user && user.email) {
        // Track visit with auth token
        fetch('/.netlify/functions/track-visit-streak', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // Include auth token
          },
          body: JSON.stringify({
            userEmail: user.email,
            userName: user.name || user.nickname || null
          })
        }).catch(err => {
          // Silently fail - don't interrupt user
          console.log('Streak tracking failed:', err);
        });
      }
    });
  });
}
```

### For Leaderboard Notifications

When submitting scores, include email (only if user wants notifications):

```javascript
// In your game score submission
const user = await window.auth0.getUser();
const userData = await getUserData(user.email);

// Only include email if user wants leaderboard notifications
const includeEmail = userData?.preferences?.emails?.leaderboard !== false;

fetch('/.netlify/functions/leaderboard', {
  method: 'POST',
  body: JSON.stringify({
    gameType: 'fact-checker',
    score: 1250,
    userName: 'Player Name',
    userEmail: includeEmail ? user.email : undefined, // Only if opted in
    // ...
  })
});
```

---

## Testing Checklist

Before going live:

- [ ] Test streak tracking with logged-in user
- [ ] Test streak tracking with logged-out user (should fail)
- [ ] Test leaderboard notification (submit score with email)
- [ ] Test leaderboard notification (submit score without email - should not send)
- [ ] Test location alert (set location, create test event)
- [ ] Test email preferences (disable each type, verify no emails)
- [ ] Test unsubscribe links
- [ ] Test rate limiting (multiple events near user)
- [ ] Test with small group first

---

## Recommended Rollout

1. **Phase 1:** Test with yourself and 2-3 users
2. **Phase 2:** Add email preferences UI
3. **Phase 3:** Integrate location alerts into engines
4. **Phase 4:** Roll out to all users with opt-in

---

## Questions?

- Check function logs in Netlify Dashboard
- Test each function individually
- Verify Auth0 tokens are working
- Make sure Resend API key is set

