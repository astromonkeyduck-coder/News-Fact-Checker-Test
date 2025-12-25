# Email Verification Checklist - Post-Deployment

## ✅ What Will Happen When You Push

1. **Code deploys** to Netlify
2. **`ingest-all` function** will run automatically (scheduled every 5 minutes) OR you can trigger it manually
3. **USGS engine** fetches earthquakes from `all_hour` feed
4. **Most recent earthquake** (first in feed) will **ALWAYS send an email**, even if it was already sent before
5. **Email includes:**
   - Subject: "BREAKING: Strong Earthquake Near {LOCATION} (M{MAG})"
   - Body: Human-readable message with time and location
   - **Attached branded image** with magnitude, location, and USGS images

---

## ✅ Required Environment Variables (Must Be Set in Netlify)

Check these in **Netlify Dashboard → Site Settings → Environment Variables**:

### ✅ Minimum Required for Email (You Have These):
- ✅ `AI_NOTIFICATION_EMAILS` - Your email address(es) (comma-separated or JSON array)
- ✅ `RESEND_API_KEY` - Your Resend API key
- ✅ `ENABLE_USGS` - Set value to `true` (not `ENABLE_USGS=true` as the key name!)

### ⚠️ Also Required for Full Pipeline (Database & Posts):
- ⚠️ `SUPABASE_URL` - Your Supabase project URL
- ⚠️ `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- ⚠️ `NETLIFY_SITE_ID` - Your Netlify site ID (for website posts)
- ⚠️ `NETLIFY_BLOB_READ_WRITE_TOKEN` - For storing posts (optional, posts will fail gracefully)

### Optional:
- `RESEND_FROM_EMAIL` - (Optional) From email address, defaults to `richard@noteworthynews.co`
- `ALERT_TO_EMAIL` - (Optional) Fallback if `AI_NOTIFICATION_EMAILS` not set

---

## ✅ How to Verify It Will Work

### Step 1: Check Environment Variables
Go to **Netlify Dashboard → Site Settings → Environment Variables** and verify:

**Minimum for Email (You Have):**
- ✅ `AI_NOTIFICATION_EMAILS` is set with your email
- ✅ `RESEND_API_KEY` is valid
- ✅ `ENABLE_USGS` is set with value `true` (variable name is `ENABLE_USGS`, value is `true`)

**For Full Pipeline (Database):**
- ⚠️ `SUPABASE_URL` - If missing, database operations will fail but email might still work
- ⚠️ `SUPABASE_SERVICE_ROLE_KEY` - If missing, database operations will fail

**Note:** If Supabase credentials are missing, the function might fail before sending email. Check logs to see if database errors are blocking the email.

### Step 2: After Deployment, Trigger Function Manually (Recommended)

**Option A: Via Netlify Dashboard**
1. Go to **Functions** → `ingest-all`
2. Click **Invoke** or **Test**
3. This will run immediately and process earthquakes

**Option B: Via API**
```bash
curl -X POST "https://noteworthynews.co/.netlify/functions/ingest-all"
```

### Step 3: Check Logs
1. Go to **Netlify Dashboard → Functions → `ingest-all` → Logs**
2. Look for:
   - `[ingest-all] Starting ingestion run`
   - `[ingest-all] Running engine: usgs`
   - `[usgs] Forcing email for most recent earthquake` ← This confirms it will send
   - `[usgs] Email alert sent successfully`

### Step 4: Check Email
- Check your inbox (and spam folder)
- Email should arrive within 1-2 minutes of function running
- Email should have the branded image attached

---

## ✅ What the Code Does (Guaranteed Email)

The code is specifically designed to **ALWAYS send an email for the most recent earthquake**:

```javascript
// Line 624: First earthquake is marked as most recent
const isMostRecent = i === 0;

// Line 567-569: If most recent and alert_sent is true, we force it
if (forceEmail && storedEvent.alert_sent) {
  storedEvent.alert_sent = false;  // Temporarily reset
  logger.info('Forcing email for most recent earthquake');
}
```

**This means:**
- Even if the earthquake already exists in the database with `alert_sent = true`
- Even if you already got an email for it
- **The most recent earthquake will ALWAYS send an email when the function runs**

---

## ⚠️ Potential Issues (And Solutions)

### Issue 1: Missing Supabase Credentials (CRITICAL)
- **Problem:** Function requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to even start
- **Symptom:** Function will fail with "Missing Supabase credentials" error
- **Solution:** Add these environment variables in Netlify Dashboard:
  - `SUPABASE_URL` - Your Supabase project URL (from Supabase dashboard)
  - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (from Supabase dashboard → Settings → API)
- **Note:** Without these, the function cannot run at all, so email won't send

### Issue 2: No Earthquakes in Last Hour
- **Problem:** USGS `all_hour` feed might be empty
- **Solution:** The function will log "No earthquakes found in feed" but won't error
- **Workaround:** Use `all_day` feed instead (change in `usgs.js` line 602)

### Issue 3: Function Doesn't Run Automatically
- **Problem:** Scheduled function might not trigger immediately after deploy
- **Solution:** Manually trigger it (see Step 2 above)

### Issue 4: Email Not Received
- **Check:** Spam folder
- **Check:** Logs for errors (`[send-earthquake-alert]` function logs)
- **Check:** Resend dashboard for delivery status
- **Verify:** `AI_NOTIFICATION_EMAILS` is correct

---

## ✅ Final Verification Steps

Before pushing, confirm:
1. ✅ **Email variables (You Have):**
   - `AI_NOTIFICATION_EMAILS` is set with your email
   - `RESEND_API_KEY` is valid
   - `ENABLE_USGS=true` is set

2. ⚠️ **Database variables (Required for function to run):**
   - `SUPABASE_URL` is set (from Supabase dashboard)
   - `SUPABASE_SERVICE_ROLE_KEY` is set (from Supabase dashboard → Settings → API)
   
   **If these are missing, the function will fail to start!**

After pushing:
1. ✅ Wait for deployment to complete
2. ✅ Manually trigger `ingest-all` function (recommended for immediate test)
3. ✅ Check logs for "Forcing email for most recent earthquake"
4. ✅ Check your email inbox

---

## 🎯 Expected Result

You will receive an email with:
- **Subject:** "BREAKING: Strong Earthquake Near {LOCATION} (M{MAG})"
- **Body:** Human-readable message about the earthquake
- **Attachment:** Branded image showing magnitude, location, and USGS maps

This email proves the entire system is working:
- ✅ USGS feed fetching
- ✅ Image generation
- ✅ Database storage
- ✅ Email sending
- ✅ Image attachment

---

## 📝 Summary

**YES, you will get an email when you push!**

The code is specifically designed to force an email for the most recent earthquake every time the function runs, regardless of whether it was already sent. This ensures you get a verification email after deployment.

