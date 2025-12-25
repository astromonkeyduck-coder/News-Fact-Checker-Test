# Next Steps - All Alert Engines

## ✅ What's Complete (Ready to Enable!)

### 1. USGS (Earthquakes)
- **Status:** ✅ Already working!
- **Action:** None needed

### 2. NWS (Weather Alerts)
- **Status:** ✅ Fully implemented
- **Data Source:** `https://api.weather.gov/alerts/active` (public API)
- **Action:** Add `ENABLE_NWS=true` to Netlify environment variables

### 3. Volcano (USGS)
- **Status:** ✅ Fully implemented
- **Data Source:** `https://volcanoes.usgs.gov/rss/vhpcaprss.xml` (RSS feed)
- **Action:** Add `ENABLE_VOLCANO=true` to Netlify environment variables

### 4. Embassy (State Department)
- **Status:** ✅ Fully implemented
- **Data Sources:** 11 RSS feeds (travel advisories, security, regional, press)
- **Action:** Add `ENABLE_EMBASSY=true` to Netlify environment variables

---

## ⚠️ What's Left (Need Data Sources)

### 5. FAA (Airspace/NOTAMs)
- **Status:** ⚠️ Code ready, needs data source
- **What's Needed:** Find FAA NOTAM API endpoint or public feed
- **Options:**
  - FAA NOTAM API (may require authentication)
  - Aviation Weather Center NOTAM endpoint
  - Public NOTAM feeds

### 6. USCG (Maritime)
- **Status:** ⚠️ Code ready, needs data source
- **What's Needed:** Find USCG maritime alert feed
- **Options:**
  - USCG Navigation Center feeds
  - Local Notice to Mariners RSS
  - Maritime alert APIs

---

## 🚀 Immediate Next Steps

### Step 1: Enable Completed Engines (Do This Now!)

1. **Go to Netlify Dashboard:**
   - Your Site → **Site Settings** → **Environment Variables**

2. **Add these environment variables:**
   ```
   ENABLE_NWS=true
   ENABLE_VOLCANO=true
   ENABLE_EMBASSY=true
   ```

3. **Deploy:**
   - The engines will start running automatically via `ingest-all.js` (every 5 minutes)

### Step 2: Test the Engines

After enabling, you can test by:
- Checking Netlify function logs
- Checking Supabase `verified_events` table
- Checking your website for new posts
- Checking email for alerts (if notable events occur)

### Step 3: Find Data Sources for FAA & USCG

**For FAA:**
- Research FAA NOTAM API access
- Check Aviation Weather Center for NOTAM endpoints
- Look for public NOTAM feeds

**For USCG:**
- Research USCG Navigation Center feeds
- Check for Local Notice to Mariners RSS
- Look for maritime alert APIs

Once you find the data sources, I can integrate them quickly!

---

## 📊 Current Status Summary

**✅ Ready to Use (4 engines):**
- USGS (Earthquakes) - Working
- NWS (Weather) - Ready
- Volcano - Ready
- Embassy - Ready

**⚠️ Need Data Sources (2 engines):**
- FAA (Airspace) - Code ready
- USCG (Maritime) - Code ready

---

## 🎯 Recommended Action Plan

1. **Right Now:** Enable NWS, Volcano, and Embassy engines
2. **Test:** Let them run for a day and see what alerts come through
3. **Then:** Research FAA and USCG data sources
4. **Finally:** Complete the last 2 engines

---

## What Each Engine Does

### NWS (Weather)
- Fetches active weather alerts
- Filters for notable alerts (Tornado, Hurricane, Flood, Severe Weather)
- Creates posts and sends emails for severity >= 3

### Volcano
- Fetches volcano alerts from USGS RSS
- Filters for Watch/Warning/Advisory levels
- Creates posts and sends emails for severity >= 3

### Embassy
- Fetches from 11 State Department RSS feeds
- Processes travel advisories, security alerts, regional updates
- Creates posts and sends emails for Level 3+ or security alerts

All engines:
- ✅ Store events in database
- ✅ Create website posts automatically
- ✅ Send email alerts for notable events
- ✅ Deduplicate by canonical_id
- ✅ No image generation (as requested)

---

## Ready to Enable?

Just add those 3 environment variables and you'll have 4 working alert engines! 🚀
