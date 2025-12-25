# Netlify Scheduled Functions - How It Works

## Automatic Scheduling

**Netlify automatically schedules functions based on the `exports.config` export in the function file.**

There is **NO dashboard step required**. When the function is deployed, Netlify automatically detects the schedule and sets it up.

## Current Configuration

The `ingest-all` function is configured in `netlify/functions/ingest-all.js`:

```javascript
exports.config = {
  schedule: '*/5 * * * *', // Every 5 minutes
};
```

## Requirements

✅ **Function location:** `netlify/functions/ingest-all.js` - CORRECT  
✅ **Config export:** `exports.config` - CORRECT  
✅ **Schedule format:** `'*/5 * * * *'` - CORRECT  
✅ **Handler format:** `exports.handler` - CORRECT  

## What Happens on Deploy

1. Netlify builds the function
2. Detects `exports.config` with `schedule` property
3. **Automatically schedules** the function to run every 5 minutes
4. No dashboard configuration needed!

## Verify It's Scheduled

After deployment, check:
1. **Netlify Dashboard** → **Functions** → `ingest-all`
2. Look for schedule indicator or "Scheduled" badge
3. Check **Logs** - should see runs every 5 minutes automatically

## Manual Trigger (For Testing)

You can still manually trigger it:
```bash
curl -X POST "https://noteworthynews.co/.netlify/functions/ingest-all"
```

Or in Dashboard: Functions → `ingest-all` → Invoke

---

## Summary

**The function is already configured correctly!**  
Once deployed successfully (after the syntax error fix), Netlify will automatically schedule it to run every 5 minutes.

No dashboard steps needed - it's all automatic! 🎉

