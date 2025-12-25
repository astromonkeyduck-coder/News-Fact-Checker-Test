# API Setup Guide - Step-by-Step Instructions

This guide walks you through getting API access for each alert engine.

---

## ✅ 1. USGS (Earthquakes) - NO SETUP NEEDED

**Status:** Already working! No API key required.

**What it uses:**
- Public GeoJSON feed: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson`
- No authentication needed
- No rate limits for normal use

**Action Required:** None - it's already working!

---

## ✅ 2. NWS (Weather Alerts) - NO SETUP NEEDED

**Status:** Ready to use! No API key required.

**What it uses:**
- Public API: `https://api.weather.gov/alerts/active`
- No authentication needed
- Rate limits: Reasonable (generous for normal use)

**Action Required:** 
1. Just set `ENABLE_NWS=true` in Netlify environment variables
2. That's it! It will work immediately.

**Optional (Recommended):**
- Add a User-Agent header (already included in code):
  - `NoteworthyNews/1.0 (contact@noteworthynews.co)`
- This helps NWS identify your app (good practice)

---

## ⚠️ 3. FAA (Airspace/NOTAMs) - NEEDS SETUP

**Status:** Requires FAA API access

**Options:**

### Option A: FAA NOTAM API (Official - May Require Registration)
1. **Go to:** https://www.faa.gov/air_traffic/flight_info/aeronav/notams/
2. **Check for API access:**
   - Look for "API" or "Developer" section
   - May require registration with FAA
   - Some NOTAM data available via Aviation Weather Center

### Option B: Aviation Weather Center (Easier Alternative)
1. **Go to:** https://www.aviationweather.gov/
2. **Check for API access:**
   - Look for "API" or "Data Services"
   - May have NOTAM data available
   - Usually requires free registration

### Option C: Use Public NOTAM Feeds (Simplest)
1. **Go to:** https://notams.aim.faa.gov/
2. **Check for:**
   - RSS feeds
   - Public data feeds
   - May need to parse HTML/XML

**Action Required:**
1. Choose one of the options above
2. If API key/credentials are provided, add to Netlify:
   - `FAA_API_KEY=your_key_here` (if needed)
3. Update `netlify/functions/engines/faa.js` with the actual API endpoint
4. Set `ENABLE_FAA=true`

**Current Status:** Code is ready, just needs API endpoint configured.

---

## ⚠️ 4. USCG (Maritime) - NEEDS SETUP

**Status:** Requires USCG Navigation Center access

**Steps:**

1. **Go to:** https://www.navcen.uscg.gov/
2. **Look for:**
   - "Local Notice to Mariners" (LNM)
   - "Broadcast Notice to Mariners"
   - "Navigation Warnings"
   - "Data Feeds" or "API" section

3. **Check for:**
   - RSS feeds
   - JSON/XML data feeds
   - Public API access

4. **Alternative Sources:**
   - Check if USCG has a developer portal
   - Look for maritime alert feeds
   - May need to contact USCG for API access

**Action Required:**
1. Find the data source URL/endpoint
2. If authentication needed, add to Netlify:
   - `USCG_API_KEY=your_key_here` (if needed)
3. Update `netlify/functions/engines/uscg.js` with the actual endpoint
4. Set `ENABLE_USCG=true`

**Current Status:** Code is ready, needs data source URL.

---

## ⚠️ 5. Volcano (USGS) - EASIEST SETUP

**Status:** Uses RSS feeds (free, no API key needed)

**Steps:**

1. **Go to:** https://volcanoes.usgs.gov/vns2/
2. **Find RSS feeds:**
   - Look for "RSS" or "Feed" links
   - Common format: `https://volcanoes.usgs.gov/vns2/atom.php`
   - Or country-specific feeds

3. **Test the feed:**
   ```bash
   curl https://volcanoes.usgs.gov/vns2/atom.php
   ```

**Action Required:**
1. Find the RSS feed URL
2. Install RSS parser (if not already):
   ```bash
   npm install rss-parser
   ```
3. Update `netlify/functions/engines/volcano.js` to parse RSS
4. Set `ENABLE_VOLCANO=true`

**Current Status:** Code structure ready, needs RSS parsing implementation.

**Implementation Note:** You'll need to add RSS parsing code. I can help implement this!

---

## ⚠️ 6. Embassy (State Department) - EASIEST SETUP

**Status:** Uses RSS feeds (free, no API key needed)

**Steps:**

1. **Go to:** https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html
2. **Find RSS feeds:**
   - Look for RSS icon or "Subscribe" links
   - May be country-specific feeds
   - Common format: `https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/[country].xml`

3. **Alternative:**
   - Check if State Department has a developer portal
   - Look for JSON/API access

4. **Test the feed:**
   ```bash
   # Try to find RSS feed URL
   curl https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html
   ```

**Action Required:**
1. Find the RSS feed URL(s)
2. Install RSS parser (if not already):
   ```bash
   npm install rss-parser
   ```
3. Update `netlify/functions/engines/embassy.js` to parse RSS
4. Set `ENABLE_EMBASSY=true`

**Current Status:** Code structure ready, needs RSS parsing implementation.

**Implementation Note:** You'll need to add RSS parsing code. I can help implement this!

---

## Quick Setup Priority

### ✅ Ready Now (No Setup):
1. **USGS** - Already working
2. **NWS** - Just enable it: `ENABLE_NWS=true`

### 🟡 Easy Setup (RSS Feeds):
3. **Volcano** - Find RSS feed, add RSS parser
4. **Embassy** - Find RSS feed, add RSS parser

### 🟠 Medium Setup (Need API Access):
5. **FAA** - Find API endpoint or use public feeds
6. **USCG** - Find data source URL

---

## Environment Variables to Add

Once you have API keys/credentials, add them to Netlify:

1. Go to **Netlify Dashboard** → Your Site → **Environment Variables**
2. Add these (only if needed):
   ```
   FAA_API_KEY=your_key_here          # Only if FAA requires it
   USCG_API_KEY=your_key_here         # Only if USCG requires it
   ```

3. Enable engines:
   ```
   ENABLE_NWS=true
   ENABLE_FAA=true
   ENABLE_USCG=true
   ENABLE_VOLCANO=true
   ENABLE_EMBASSY=true
   ```

---

## Next Steps

1. **Start with NWS** - Just enable it, it works immediately!
2. **Then Volcano & Embassy** - I can help implement RSS parsing
3. **Then FAA & USCG** - Find the data sources, I'll help integrate them

Want me to help implement RSS parsing for Volcano and Embassy first? That's the quickest way to get them working!

