# API Error Handling & Potential Issues

## ✅ What WILL Work

### 1. NWS (Weather) - Should Work Fine
- **API:** `https://api.weather.gov/alerts/active`
- **Status:** ✅ Public API, no authentication needed
- **Rate Limits:** Reasonable limits, but generous for normal use
- **Error Handling:** ✅ Catches errors, logs them, continues
- **Potential Issues:**
  - Rate limiting (unlikely with 5-minute intervals)
  - Network timeouts (handled gracefully)

### 2. Volcano (USGS) - Should Work Fine
- **Feed:** `https://volcanoes.usgs.gov/rss/vhpcaprss.xml`
- **Status:** ✅ Public RSS feed, no authentication
- **Error Handling:** ✅ Catches errors, returns empty array if feed fails
- **Potential Issues:**
  - RSS feed format changes (unlikely)
  - Network timeouts (handled gracefully)

### 3. Embassy (State Department) - Should Work Fine
- **Feeds:** 11 RSS feeds from state.gov
- **Status:** ✅ Public RSS feeds
- **Error Handling:** ✅ **Best error handling** - tries each feed individually, continues if one fails
- **Potential Issues:**
  - Some feeds might be temporarily unavailable (handled - skips and continues)
  - Network timeouts (handled gracefully)

---

## ⚠️ Potential API Issues & How They're Handled

### Issue 1: Rate Limiting
**What it is:** API limits how many requests you can make

**How it's handled:**
- ✅ Engines run every 5 minutes (not too frequent)
- ✅ NWS has generous rate limits
- ✅ RSS feeds typically don't have strict limits
- ⚠️ **If rate limited:** The engine will log an error and return `success: false`, but won't crash

**What happens:**
- Engine logs the error
- Returns `success: false` with error message
- Other engines continue running
- Next run (5 minutes later) will try again

### Issue 2: Network Timeouts
**What it is:** API takes too long to respond

**How it's handled:**
- ✅ Netlify Functions have default timeouts (10 seconds for free tier, 26 seconds for paid)
- ✅ Errors are caught and logged
- ⚠️ **If timeout:** Engine fails gracefully, logs error, continues to next engine

**What happens:**
- Function times out
- Error is logged
- Engine returns `success: false`
- Other engines still run

### Issue 3: Feed Format Changes
**What it is:** RSS feed structure changes

**How it's handled:**
- ✅ Code has fallbacks for missing fields
- ✅ Parsing errors are caught per-item
- ⚠️ **If format changes:** Some items might fail to parse, but others will still work

**What happens:**
- Individual items that fail are skipped
- Valid items are still processed
- Errors are logged for debugging

### Issue 4: Feed Unavailability
**What it is:** RSS feed temporarily down

**How it's handled:**
- ✅ **Embassy engine:** Tries all 11 feeds, continues if one fails
- ✅ **Volcano engine:** Returns empty array if feed fails
- ✅ **NWS engine:** Returns error, but doesn't crash

**What happens:**
- Failed feed is logged
- Engine continues (Embassy) or returns empty (Volcano/NWS)
- Next run will try again

---

## 🛡️ Error Handling Summary

### All Engines Have:
1. ✅ **Try/catch blocks** around API calls
2. ✅ **Individual item error handling** (one bad item doesn't stop the whole run)
3. ✅ **Graceful failure** (returns `success: false` instead of crashing)
4. ✅ **Error logging** (all errors are logged for debugging)
5. ✅ **Isolation** (one engine failing doesn't affect others)

### Embassy Engine (Best Error Handling):
- ✅ Tries each feed individually
- ✅ Continues to next feed if one fails
- ✅ Processes all successful feeds
- ✅ Only fails if ALL feeds fail

---

## 📊 What Happens When Errors Occur

### Scenario 1: NWS API is Down
- NWS engine logs error
- Returns `success: false`
- Volcano and Embassy engines still run
- Next run (5 min) will try again

### Scenario 2: One Embassy Feed Fails
- That feed is logged as failed
- Other 10 feeds still process
- Engine returns `success: true` with results from working feeds
- Next run will try the failed feed again

### Scenario 3: Network Timeout
- Engine times out
- Error is logged
- Returns `success: false`
- Other engines continue
- Next run will try again

### Scenario 4: Invalid Data in Feed
- Bad items are skipped (logged)
- Good items are still processed
- Engine returns `success: true` with partial results

---

## 🔍 How to Monitor for Issues

### Check Netlify Logs:
1. Go to **Netlify Dashboard** → **Functions** → **ingest-all**
2. Check **Logs** tab
3. Look for:
   - `[ingest-all] Engine nws: success: false` - API issue
   - `Failed to fetch` - Network/API problem
   - `Error processing` - Data parsing issue

### Check Database:
- If `engine_runs` table shows `ok: false`, check the `error` column
- This tells you what went wrong

### Check Function Response:
- Call `/.netlify/functions/ingest-all` manually
- Check the JSON response for `success: false` and `error` fields

---

## ✅ Bottom Line

**Will they work?** Yes, with proper error handling:

1. **NWS:** Should work fine (public API, good rate limits)
2. **Volcano:** Should work fine (public RSS feed)
3. **Embassy:** Should work fine (multiple feeds, best error handling)

**If something fails:**
- ✅ Errors are logged (you'll know what happened)
- ✅ Engines don't crash (they fail gracefully)
- ✅ Other engines continue running
- ✅ Next run will retry automatically

**Most likely issues:**
- Temporary network problems (auto-retry in 5 min)
- Rate limiting (unlikely with 5-min intervals)
- Feed format changes (rare, but handled gracefully)

**The code is designed to be resilient** - errors won't break the system, they'll just be logged and retried.

---

## 🚀 Recommendation

**Start with the engines enabled** - they should work fine. If you see errors in the logs, we can:
1. Add retry logic
2. Add timeout handling
3. Add rate limit detection
4. Improve error messages

But the current error handling should be sufficient for most cases!

