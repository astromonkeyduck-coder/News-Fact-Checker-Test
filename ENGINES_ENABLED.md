# Engines Enabled - What Happens Next

## ✅ You've Enabled:
- `ENABLE_NWS=true` - Weather alerts
- `ENABLE_VOLCANO=true` - Volcano alerts  
- `ENABLE_EMBASSY=true` - Travel advisories & security alerts

---

## 🚀 What Happens Now

### Automatic Schedule
The `ingest-all.js` function runs **every 5 minutes** automatically and will:
1. Check which engines are enabled
2. Run NWS, Volcano, and Embassy engines
3. Fetch data from their sources
4. Process notable alerts
5. Create website posts
6. Send email alerts (for notable events)

### First Run
The engines will start running on the next scheduled run (within 5 minutes), or you can trigger them manually.

---

## 📊 How to Check if It's Working

### Option 1: Check Netlify Function Logs
1. Go to **Netlify Dashboard** → Your Site → **Functions**
2. Click on `ingest-all`
3. Check the **Logs** tab
4. You should see logs like:
   ```
   [ingest-all] Starting ingestion run
   [ingest-all] Running engine: nws
   [ingest-all] Running engine: volcano
   [ingest-all] Running engine: embassy
   ```

### Option 2: Check Your Database
1. Go to **Supabase Dashboard** → Your Project → **Table Editor**
2. Check the `verified_events` table
3. You should see new rows for:
   - Weather alerts (engine = 'nws')
   - Volcano alerts (engine = 'volcano')
   - Travel advisories (engine = 'embassy')

### Option 3: Check Your Website
- New posts should appear automatically for notable alerts
- Check your website's post feed

### Option 4: Check Email
- You'll receive email alerts for notable events (severity >= 3)
- Check your inbox (the email addresses in `AI_NOTIFICATION_EMAILS` or `ALERT_TO_EMAIL`)

---

## 🔍 Manual Test (Optional)

You can manually trigger the engines right now:

1. Go to **Netlify Dashboard** → Your Site → **Functions**
2. Find `ingest-all`
3. Click **Invoke** or use the function URL
4. Or use curl:
   ```bash
   curl -X POST https://your-site.netlify.app/.netlify/functions/ingest-all
   ```

---

## 📈 What to Expect

### NWS (Weather)
- Fetches active weather alerts every 5 minutes
- Creates posts for notable alerts (Tornado, Hurricane, Flood, Severe Weather)
- Sends emails for severity >= 3

### Volcano
- Fetches volcano alerts from USGS RSS feed every 5 minutes
- Creates posts for Watch/Warning/Advisory levels
- Sends emails for severity >= 3

### Embassy
- Fetches from 11 State Department RSS feeds every 5 minutes
- Creates posts for Level 3+ travel advisories and security alerts
- Sends emails for Level 3+ or security alerts

---

## ⚠️ If Nothing Happens

1. **Check logs** - Look for errors in Netlify function logs
2. **Verify environment variables** - Make sure they're set correctly
3. **Check schedule** - Make sure `ingest-all` is scheduled (should be automatic)
4. **Wait a few minutes** - First run might take a moment

---

## 🎉 Success Indicators

You'll know it's working when you see:
- ✅ New rows in `verified_events` table
- ✅ New posts on your website
- ✅ Function logs showing successful runs
- ✅ Email alerts (if notable events occur)

---

## Next Steps

1. **Wait 5 minutes** for the first automatic run
2. **Check the logs** to see what happened
3. **Check your database** for new events
4. **Check your website** for new posts

Everything should be working now! 🚀

