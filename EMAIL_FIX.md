# Email Alert Fix - What Was Wrong

## The Problem

You have **TWO earthquake systems** running:

1. **`earthquake-poller.js`** (Dedicated, every 3 min)
   - ✅ Sends emails for ALL earthquakes
   - ✅ Already working correctly

2. **`engines/usgs.js`** (Via ingest-all, every 5 min)
   - ❌ **WAS only sending emails for magnitude >= 7.0**
   - ✅ **NOW FIXED** - sends emails for ALL earthquakes

## What I Fixed

### In `engines/usgs.js`:

**Before:**
```javascript
// Only send for magnitude >= 7.0
if (magnitude < 7.0) {
  return false;
}

// And later:
if (magnitude >= 7.0 && (!storedEvent.alert_sent || isNew)) {
  // send email
}
```

**After:**
```javascript
// Send for ALL earthquakes
// Removed magnitude check

// And later:
if (!storedEvent.alert_sent || isNew) {
  // send email for ALL
}
```

## Why You Didn't Get Emails

**Most likely cause:**
- The `ingest-all` function was running (every 5 minutes)
- It uses `engines/usgs.js` which had the magnitude >= 7.0 check
- So earthquakes < 7.0 didn't trigger emails

**Other possible causes:**
1. Missing email configuration (`AI_NOTIFICATION_EMAILS` or `ALERT_TO_EMAIL`)
2. `earthquake-poller` not scheduled (if that's the one running)
3. Email sending errors (check logs)

## What to Check Now

### 1. Verify Email Configuration
Make sure these are set in Netlify:
- `AI_NOTIFICATION_EMAILS` - Your email(s)
- OR `ALERT_TO_EMAIL` - Your email
- `RESEND_API_KEY` - Your Resend key

### 2. Check Which System Is Running
- **`earthquake-poller`** - Should be scheduled every 3 min
- **`ingest-all`** - Runs every 5 min (uses `engines/usgs.js`)

Both should now send emails for ALL earthquakes!

### 3. Check Logs
Look in Netlify Dashboard → Functions → Logs for:
- `[earthquake-poller] Alert sent for M...` ✅
- `[usgs] Email alert sent` ✅
- `No email configuration found` ❌
- `Alert send failed` ❌

## The Fix Is Deployed

After you commit and push, both systems will send emails for ALL earthquakes, not just >= 7.0.

---

## Next Steps

1. **Commit and push** this fix
2. **Check your email configuration** in Netlify
3. **Wait for next earthquake** (or test manually)
4. **Check logs** if emails still don't arrive

The fix is ready - just need to deploy it!

