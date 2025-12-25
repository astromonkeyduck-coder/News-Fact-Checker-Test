# Earthquake Email Fix - What's Happening

## The Situation

You have **TWO earthquake systems**, but only **ONE is needed**:

### System 1: `earthquake-poller.js` (Dedicated)
- **Status:** File exists, but may not be scheduled
- **Location:** `netlify/functions/earthquake-poller.js`
- **Sends emails for:** ALL earthquakes
- **Runs:** Every 3 minutes (if scheduled)

### System 2: `engines/usgs.js` (Via ingest-all) ✅ **THIS IS RUNNING**
- **Status:** ✅ Already running via `ingest-all` (every 5 minutes)
- **Location:** `netlify/functions/engines/usgs.js`
- **Sends emails for:** ✅ **NOW FIXED** - ALL earthquakes (was only >= 7.0)
- **Runs:** Every 5 minutes automatically

---

## The Fix I Just Made

**Updated `engines/usgs.js` to send emails for ALL earthquakes:**
- ✅ Removed magnitude >= 7.0 check
- ✅ Now sends emails for every earthquake
- ✅ Same as `earthquake-poller` behavior

**This means:**
- You don't need `earthquake-poller` scheduled
- `ingest-all` is already running and will send emails
- After you commit/push, emails will work!

---

## Why You Didn't Get Emails Before

**The problem:**
- `ingest-all` was running (every 5 minutes)
- It uses `engines/usgs.js`
- That function had `if (magnitude < 7.0) return false;`
- So earthquakes < 7.0 didn't trigger emails

**The fix:**
- Removed the magnitude check
- Now sends emails for ALL earthquakes

---

## What You Need to Do

### Option 1: Just Use ingest-all (Recommended)
1. **Commit and push** the fix I just made
2. **Verify email config** in Netlify:
   - `AI_NOTIFICATION_EMAILS` or `ALERT_TO_EMAIL` set?
   - `RESEND_API_KEY` set?
3. **Wait for next earthquake** - emails should work!

### Option 2: Also Schedule earthquake-poller (Optional)
If you want a separate dedicated function:
1. Go to **Netlify Dashboard** → **Site Settings** → **Scheduled Functions**
2. Add new scheduled function:
   - **Function name:** `earthquake-poller`
   - **Schedule:** `*/3 * * * *` (every 3 minutes)
3. Save

**But you don't need this** - `ingest-all` already handles it!

---

## How to Verify It's Working

### Check Logs:
1. Go to **Netlify Dashboard** → **Functions** → **ingest-all**
2. Click **Logs** tab
3. Look for:
   - `[usgs] Email alert sent` ✅
   - `[usgs] Alert send failed` ❌
   - `No email configuration found` ❌

### Check Database:
- Go to Supabase → `verified_events` table
- Look for recent earthquakes
- Check `alert_sent` column - should be `true` if email was sent

### Test Manually:
```bash
# Trigger ingest-all manually
curl -X POST "https://your-site.netlify.app/.netlify/functions/ingest-all"
```

---

## Summary

**The fix is ready:**
- ✅ `engines/usgs.js` now sends emails for ALL earthquakes
- ✅ `ingest-all` is already running (every 5 minutes)
- ✅ No need to schedule `earthquake-poller` separately

**Next steps:**
1. Commit and push the fix
2. Verify email config in Netlify
3. Wait for next earthquake - you should get an email!

The "earthquake-poller not found" message is fine - you don't need it. The `ingest-all` system is handling everything!

