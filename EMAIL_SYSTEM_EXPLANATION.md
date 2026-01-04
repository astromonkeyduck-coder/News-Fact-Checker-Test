# Email System Explanation - How It Works & Safeguards

## 🔒 Authentication & Opt-In Requirements

**IMPORTANT:** All three email systems ONLY work for **logged-in users** who **opt-in**. Here's how each works:

---

## 1. Leaderboard Position Notifications

### How It Works:
1. **User must be logged in** (submits score via your game)
2. **User must provide email** when submitting score (opt-in)
3. **System tracks previous position** in leaderboard
4. **Only sends email if:**
   - User had a previous position
   - User got knocked out (new position > old position)
   - User provided email in score submission

### Who Gets Emails:
- ✅ Only users who submit scores WITH their email
- ✅ Only if they were previously on leaderboard
- ✅ Only if they got knocked out (not if they improved)

### When Emails Send:
- Immediately when someone beats their score
- Only once per position change
- Never sends if user improves their position

### Safeguards:
- ✅ Requires explicit email in score submission (opt-in)
- ✅ Only sends on position loss (not spam)
- ✅ Tracks previous position to avoid duplicates
- ✅ Includes unsubscribe link in every email

---

## 2. Visit Streak Celebrations

### How It Works:
1. **User must be logged in** (Auth0 authenticated)
2. **Client-side code calls function** when page loads
3. **Function checks if user visited today**
4. **Tracks consecutive days**
5. **Only sends email at milestones** (2, 3, 4, 6, 8, 11, 15, 31, 51, 101 days)

### Who Gets Emails:
- ✅ Only logged-in users (Auth0 authenticated)
- ✅ Only users who visit the site
- ✅ Only at milestone days (not every day)

### When Emails Send:
- Day 2 visit = "2-Day Streak!" email
- Day 3 visit = "3-Day Streak!" email
- Day 4 visit = "4-Day Streak!" email
- Then at milestones: 6, 8, 11, 15, 31, 51, 101 days
- **NOT every day** - only at specific milestones

### Safeguards:
- ✅ Only tracks if user is authenticated
- ✅ Only sends at milestones (not daily spam)
- ✅ Checks if already visited today (no duplicate tracking)
- ✅ Includes unsubscribe link
- ⚠️ **NEEDS FIX:** Function should verify Auth0 token

---

## 3. Location-Based Alerts

### How It Works:
1. **User must be logged in** (to set location preferences)
2. **User must opt-in** (enable location alerts in profile)
3. **User sets location** (city/coordinates) and radius
4. **Event engines check** if event is near user
5. **Only sends if event within radius**

### Who Gets Emails:
- ✅ Only users who opt-in (enable location alerts)
- ✅ Only users who set their location
- ✅ Only if event is within their radius
- ✅ Only for event types they selected

### When Emails Send:
- When new event is ingested near their location
- Only if within their radius (default 50 miles)
- Only for event types they selected
- ⚠️ **NOT YET INTEGRATED** - needs to be added to event engines

### Safeguards:
- ✅ Requires explicit opt-in (user enables in profile)
- ✅ User sets their own location and radius
- ✅ User chooses which event types to receive
- ✅ Includes unsubscribe link
- ⚠️ **NEEDS FIX:** Not integrated into event engines yet

---

## 🚨 Current Issues & Fixes Needed

### Issue 1: Streak Tracking - No Auth Verification
**Problem:** `track-visit-streak.js` accepts any email without verifying user is logged in.

**Fix Needed:** Verify Auth0 token before tracking.

### Issue 2: Location Alerts - Not Integrated
**Problem:** Location alerts function exists but isn't called by event engines.

**Fix Needed:** Add location check to event engines after storing events.

### Issue 3: No User Preference System
**Problem:** Users can't disable individual email types.

**Fix Needed:** Add email preferences to user-data and check before sending.

---

## ✅ Recommended Safeguards to Add

1. **Email Preferences System**
   - Let users enable/disable each email type
   - Store in user-data preferences
   - Check before sending any email

2. **Rate Limiting**
   - Max 1 leaderboard email per day per user
   - Max 1 streak email per milestone
   - Max 1 location alert per event per user

3. **Unsubscribe System**
   - Easy unsubscribe links in every email
   - Per-email-type unsubscribe
   - Update user preferences when unsubscribed

4. **Auth Verification**
   - Verify Auth0 token for streak tracking
   - Verify user owns email for leaderboard
   - Verify user is logged in for location alerts

---

## 📊 Email Frequency Summary

| Email Type | Frequency | Opt-In Required? |
|------------|-----------|------------------|
| Leaderboard | Only when knocked out | Yes (provide email) |
| Streak | Only at milestones | Yes (logged in) |
| Location | Only when event near | Yes (enable in profile) |

**Total possible emails per user:**
- Leaderboard: ~0-5 per week (depends on activity)
- Streak: ~10 total (only at milestones)
- Location: ~0-10 per week (depends on events near them)

---

## 🔧 Implementation Status

- ✅ Leaderboard notifications: **Working** (needs email in score submission)
- ⚠️ Streak tracking: **Needs auth verification**
- ⚠️ Location alerts: **Needs integration into event engines**

---

## Next Steps

1. Add Auth0 token verification to streak tracking
2. Add email preferences system
3. Integrate location alerts into event engines
4. Add rate limiting
5. Test with small group first

