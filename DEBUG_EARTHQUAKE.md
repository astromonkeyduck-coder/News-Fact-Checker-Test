# Debug Earthquake Pipeline - What's Not Working?

## Quick Diagnostic Steps

### 1. Check if USGS Engine is Enabled
**In Netlify Dashboard → Environment Variables:**
- `ENABLE_USGS` must be set to `true` or `1`
- If not set or set to `false`, the engine won't run

### 2. Check if ingest-all is Running
**In Netlify Dashboard → Functions → ingest-all:**
- Check if it's scheduled (every 5 minutes)
- Check the logs for recent runs
- Look for: `[ingest-all] Running engine: usgs`

### 3. Check USGS Engine Logs
**In Netlify Dashboard → Functions → ingest-all → Logs:**
- Look for: `[usgs] Starting USGS engine run`
- Look for: `[usgs] Processing earthquakes`
- Look for: `[usgs] Website post created`
- Look for: `[usgs] Email alert sent successfully`
- Look for any ERROR messages

### 4. Check Environment Variables
**Required variables:**
- ✅ `ENABLE_USGS=true`
- ✅ `AI_NOTIFICATION_EMAILS` or `ALERT_TO_EMAIL`
- ✅ `RESEND_API_KEY`
- ✅ `RESEND_FROM_EMAIL`
- ✅ `NETLIFY_SITE_ID` (auto-set)
- ✅ `NETLIFY_BLOB_READ_WRITE_TOKEN` (auto-set)
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`

### 5. Common Issues

#### Issue: No earthquakes being processed
**Check:**
- USGS feed is accessible
- `all_hour` feed has earthquakes
- Logs show: `[usgs] No earthquakes found in feed`

#### Issue: Posts not being created
**Check:**
- `NETLIFY_SITE_ID` is set
- `NETLIFY_BLOB_READ_WRITE_TOKEN` is set
- Logs show: `[createPost] Missing NETLIFY_SITE_ID or NETLIFY_BLOB_READ_WRITE_TOKEN`
- Logs show: `[usgs] Failed to create website post`

#### Issue: Emails not being sent
**Check:**
- `AI_NOTIFICATION_EMAILS` or `ALERT_TO_EMAIL` is set
- `RESEND_API_KEY` is set
- Logs show: `[usgs] Sending email alert`
- Logs show: `[usgs] Alert send failed` or `[usgs] Email alert sent successfully`

#### Issue: Images not being generated
**Check:**
- `2ndUSGSTemp.png` exists in `netlify/functions/`
- Logs show: `[usgs] Image generation failed`
- Logs show: `[generate-earthquake-image]` errors

---

## What to Check in Logs

### Success Indicators:
```
[ingest-all] Running engine: usgs
[usgs] Starting USGS engine run
[usgs] Processing earthquakes { count: X }
[usgs] Website post created { canonical_id: '...' }
[usgs] Email alert sent successfully
[usgs] USGS engine run completed
```

### Error Indicators:
```
[ingest-all] Engine usgs is disabled
[usgs] Failed to fetch USGS feed
[usgs] Failed to create website post
[usgs] Alert send failed
[usgs] Error processing earthquake
```

---

## Manual Test

You can manually trigger the pipeline:

```bash
curl -X POST "https://your-site.netlify.app/.netlify/functions/ingest-all"
```

This will run all enabled engines immediately and return results.

---

## Next Steps

1. **Check Netlify logs** for the specific error
2. **Verify environment variables** are all set
3. **Check if `ENABLE_USGS=true`** is set
4. **Verify `ingest-all` is scheduled** to run
5. **Check if there are any earthquakes** in the USGS feed

Tell me what you see in the logs and I can help fix the specific issue!

