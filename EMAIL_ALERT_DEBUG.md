# Email Alert Debugging Guide

## Why You Didn't Get Earthquake Emails

Let's check the most common issues:

---

## Issue 1: Function Not Running

**Check if `earthquake-poller` is scheduled:**

1. Go to **Netlify Dashboard** → Your Site → **Functions**
2. Find `earthquake-poller`
3. Check if it has a **Schedule** configured
4. If not, add schedule: `*/3 * * * *` (every 3 minutes)

**OR check if it's running via `ingest-all`:**
- The `ingest-all` function runs every 5 minutes
- But it uses `engines/usgs.js` which only sends emails for magnitude >= 7.0
- The dedicated `earthquake-poller.js` sends emails for ALL earthquakes

---

## Issue 2: Missing Email Configuration

**Check environment variables:**

1. Go to **Netlify Dashboard** → **Site Settings** → **Environment Variables**
2. Verify these are set:
   - `AI_NOTIFICATION_EMAILS` - Your email(s)
   - OR `ALERT_TO_EMAIL` - Your email (fallback)
   - `RESEND_API_KEY` - Your Resend API key
   - `RESEND_FROM_EMAIL` - (Optional) From email

**The code checks for:**
```javascript
const hasEmailConfig = process.env.AI_NOTIFICATION_EMAILS || process.env.ALERT_TO_EMAIL;
```

If neither is set, it logs: `"No email configuration found"`

---

## Issue 3: Email Sending Failed

**Check Netlify logs:**

1. Go to **Netlify Dashboard** → **Functions** → `earthquake-poller`
2. Click **Logs** tab
3. Look for:
   - `[earthquake-poller] Alert sent for M...` ✅ Success
   - `[earthquake-poller] Alert response not OK: ...` ❌ Failed
   - `[earthquake-poller] Alert error: ...` ❌ Error
   - `[earthquake-poller] No email configuration found` ❌ Missing config

**Also check `send-earthquake-alert` function logs:**
- Look for errors in email sending
- Check if Resend API key is valid
- Check if email addresses are valid

---

## Issue 4: Wrong Function Running

**There are TWO earthquake systems:**

1. **`earthquake-poller.js`** (Dedicated, runs every 3 min)
   - ✅ Sends emails for ALL earthquakes
   - ✅ Creates posts with images
   - ✅ Uses Netlify Blob storage

2. **`engines/usgs.js`** (Via ingest-all, runs every 5 min)
   - ⚠️ Only sends emails for magnitude >= 7.0
   - ✅ Stores in Supabase `verified_events`
   - ✅ Uses shared alert system

**Which one is running?**
- Check Netlify logs to see which function is processing earthquakes
- If `ingest-all` is running but `earthquake-poller` is not, you won't get emails for < 7.0

---

## Quick Diagnostic Steps

### Step 1: Check Function Logs
```bash
# Check if earthquake-poller is running
# Look in Netlify Dashboard → Functions → earthquake-poller → Logs
```

### Step 2: Check Environment Variables
```bash
# Verify these are set in Netlify:
# - AI_NOTIFICATION_EMAILS or ALERT_TO_EMAIL
# - RESEND_API_KEY
# - RESEND_FROM_EMAIL (optional)
```

### Step 3: Test Email Function Manually
```bash
curl -X POST "https://your-site.netlify.app/.netlify/functions/send-earthquake-alert" \
  -H "Content-Type: application/json" \
  -d '{
    "earthquake": {
      "event_id": "test-123",
      "magnitude": 6.5,
      "location_display": "TEST LOCATION",
      "time_ms": 1234567890,
      "usgs_event_url": "https://earthquake.usgs.gov"
    },
    "imageUrl": null
  }'
```

### Step 4: Check Recent Earthquakes
- Go to USGS website and check recent earthquakes
- See if they were processed (check your website for posts)
- Check logs to see if they triggered email attempts

---

## Most Likely Issues

1. **`earthquake-poller` not scheduled** - Function isn't running
2. **Missing email config** - `AI_NOTIFICATION_EMAILS` or `ALERT_TO_EMAIL` not set
3. **Wrong function running** - `ingest-all` is running but only sends for >= 7.0
4. **Email sending failed** - Resend API issue or invalid email address

---

## Fix: Ensure Both Systems Send Emails

The `engines/usgs.js` only sends for >= 7.0. Let's fix it to send for ALL earthquakes like `earthquake-poller` does.

