# How to Schedule ingest-all Function

## ⚠️ IMPORTANT: Netlify Scheduled Functions May Not Be Available

If you don't see a "Schedule" tab in Netlify Dashboard, you need to use an **external cron service** instead.

---

## ✅ Solution: Use External Cron Service (FREE & RELIABLE)

### Option 1: cron-job.org (Recommended - Free & Easy)

1. **Sign up for free account:**
   - Go to: https://cron-job.org
   - Sign up (free, no credit card needed)

2. **Create a new cron job:**
   - Click **"Create cronjob"**
   - **Title:** `Noteworthy News - Ingest All Events`
   - **Address (URL):** 
     ```
     https://noteworthynews.co/.netlify/functions/ingest-all
     ```
   - **Schedule:** Select **"Every 5 minutes"** or enter: `*/5 * * * *`
   - **Request method:** `GET` or `POST` (both work)
   - **Active:** ✅ Checked
   - Click **"Create cronjob"**

3. **Test it:**
   - Click **"Run now"** to test
   - Check Netlify logs to verify it ran

---

### Option 2: EasyCron (Free Tier Available)

1. **Sign up:** https://www.easycron.com
2. **Create cron job:**
   - **URL:** `https://noteworthynews.co/.netlify/functions/ingest-all`
   - **Schedule:** `*/5 * * * *` (every 5 minutes)
   - **HTTP Method:** `GET` or `POST`

---

### Option 3: GitHub Actions (If you use GitHub)

Create `.github/workflows/ingest-all.yml`:

```yaml
name: Ingest All Events

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:  # Allow manual trigger

jobs:
  ingest:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger ingest-all
        run: |
          curl -X POST https://noteworthynews.co/.netlify/functions/ingest-all
```

---

### Option 4: Uptime Robot (Free - 50 monitors)

1. **Sign up:** https://uptimerobot.com
2. **Add Monitor:**
   - **Type:** HTTP(s)
   - **URL:** `https://noteworthynews.co/.netlify/functions/ingest-all`
   - **Interval:** 5 minutes
   - **Alert Contacts:** (optional)

---

## 🧪 Test the Function First

Before setting up the cron, test that the function works:

```bash
curl -X POST "https://noteworthynews.co/.netlify/functions/ingest-all"
```

Or use the Netlify Dashboard:
1. Go to **Functions** → `ingest-all`
2. Click **"Invoke"** or **"Test"**

---

## ✅ Verify It's Working

### Check Netlify Logs:
1. Go to **Netlify Dashboard** → **Functions** → `ingest-all` → **Logs**
2. You should see runs every 5 minutes with:
   - `[ingest-all] Starting ingestion run`
   - `[ingest-all] Running engine: usgs`
   - `[ingest-all] Completed: X successful, Y failed`

### Check for New Events:
- Go to your website and check for new earthquake posts
- Check your email for alerts (if earthquakes occur)

---

## 📋 Quick Setup Checklist

- [ ] Function `ingest-all` exists and works (test manually)
- [ ] External cron service account created
- [ ] Cron job created pointing to: `https://noteworthynews.co/.netlify/functions/ingest-all`
- [ ] Schedule set to every 5 minutes (`*/5 * * * *`)
- [ ] Cron job is **active/enabled**
- [ ] Tested with "Run now" button
- [ ] Verified in Netlify logs that it's running

---

## 🔧 Troubleshooting

### Function Not Running:
1. **Check Netlify logs** for errors
2. **Verify environment variables** are set:
   - `ENABLE_USGS=true`
   - `RESEND_API_KEY` (for emails)
   - `NETLIFY_SITE_ID` and `NETLIFY_BLOB_READ_WRITE_TOKEN` (for posts)
   - `AI_NOTIFICATION_EMAILS` or `ALERT_TO_EMAIL` (for alerts)
3. **Test manually** with curl to see if function works
4. **Check cron service logs** to see if it's calling the URL

### Cron Service Not Working:
- Make sure the URL is correct (no trailing slash)
- Try both GET and POST methods
- Check if your Netlify site requires authentication (it shouldn't)
- Verify the cron service is actually running (check their dashboard)

---

## 📝 Current Function Configuration

The function is already configured with:
```javascript
exports.config = {
  schedule: '*/5 * * * *', // Every 5 minutes
};
```

But since Netlify's scheduled functions feature isn't available, **you must use an external cron service** to actually trigger it.

---

## 🎯 Recommended: cron-job.org

**Why cron-job.org?**
- ✅ Free forever
- ✅ No credit card required
- ✅ Reliable (used by thousands)
- ✅ Easy to set up
- ✅ Can test immediately
- ✅ Email notifications if cron fails

**Setup time:** ~2 minutes

---

## 🚀 Next Steps

1. **Fix the syntax error first** (commit the fix)
2. **Deploy successfully**
3. **Set up cron-job.org** (or another service)
4. **Test it works**
5. **Monitor logs** for the next earthquake

---

## 📞 Need Help?

If the function still doesn't work after setting up the cron:
1. Check Netlify function logs
2. Verify all environment variables
3. Test the function manually with curl
4. Check the cron service's execution logs
