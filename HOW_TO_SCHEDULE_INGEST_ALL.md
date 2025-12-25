# How Netlify Scheduled Functions Work

## Automatic Scheduling (No Dashboard Step Needed!)

**Netlify automatically schedules functions based on the `exports.config` export in the function file.**

When the function is deployed, Netlify automatically detects the schedule configuration and sets it up. **There is no dashboard step required.**

---

## Current Configuration

The `ingest-all` function is already configured in `netlify/functions/ingest-all.js`:

```javascript
exports.config = {
  schedule: '*/5 * * * *', // Every 5 minutes
};
```

**This is all you need!** Once deployed, Netlify will automatically schedule it.

---

## Requirements for Scheduled Functions

✅ **Function location:** `netlify/functions/ingest-all.js`  
✅ **Config export:** `exports.config` with `schedule` property  
✅ **Schedule format:** Valid cron expression (e.g., `'*/5 * * * *'`)  
✅ **Handler export:** `exports.handler` (standard Netlify function format)  

All of these are already correct!

---

## What Happens on Deploy

1. Netlify builds the function
2. Detects `exports.config` with `schedule` property
3. **Automatically schedules** the function to run every 5 minutes
4. No dashboard configuration needed!

---

## Verify It's Scheduled

After deployment, check:
1. **Netlify Dashboard** → **Functions** → `ingest-all`
2. Look for schedule indicator or "Scheduled" badge
3. Check **Logs** - should see runs every 5 minutes automatically

---

## Manual Trigger (For Testing)

You can manually trigger the function to test it:

```bash
curl -X POST "https://noteworthynews.co/.netlify/functions/ingest-all"
```

Or use the Netlify Dashboard:
1. Go to **Functions** → `ingest-all`
2. Click **Invoke** or **Test**
3. This will run it immediately

---

## Verify It's Working

### Check Logs:
1. Go to **Functions** → `ingest-all` → **Logs**
2. Look for recent runs (should appear every 5 minutes)
3. Check for:
   - `[ingest-all] Starting ingestion run`
   - `[ingest-all] Running engine: usgs`
   - `[ingest-all] Completed: X successful, Y failed`

### Check Function Status:
- The function should show as "Scheduled" or have a schedule icon
- You should see recent invocations in the logs

---

## Schedule Format (Cron)

The schedule uses cron syntax:
- `*/5 * * * *` = Every 5 minutes
- `0 * * * *` = Every hour (at :00)
- `0 */2 * * *` = Every 2 hours
- `0 0 * * *` = Every day at midnight

For every 5 minutes, use: `*/5 * * * *`

---

## Troubleshooting

### If Schedule Doesn't Appear:
1. Make sure you're on a Netlify plan that supports scheduled functions
2. Check if the function has `exports.config` with schedule (it does)
3. Try the manual trigger first to verify the function works

### If Function Doesn't Run:
1. Check logs for errors
2. Verify `ENABLE_USGS=true` is set
3. Check all environment variables are configured
4. Try manual trigger to see if function works at all

---

## Quick Checklist

- [ ] Function `ingest-all` exists in Netlify Dashboard
- [ ] Schedule is configured (every 5 minutes)
- [ ] `ENABLE_USGS=true` is set in environment variables
- [ ] All required environment variables are set
- [ ] Logs show function running every 5 minutes

---

## Summary

**The function is already configured correctly!**  
Once deployed successfully, Netlify will automatically schedule it to run every 5 minutes.

**No dashboard steps needed - it's all automatic!** 🎉

The only thing preventing it from being scheduled right now is the syntax error in `usgs.js`, which is being fixed.

