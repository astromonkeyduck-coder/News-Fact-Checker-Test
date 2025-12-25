# All Alert Types - Current Status

## Overview

Your system has **6 different alert engines** that can monitor different types of events. Currently, only **USGS (Earthquakes)** is fully implemented and active.

---

## ✅ Active: USGS Engine (Earthquakes)

**Status:** ✅ **FULLY IMPLEMENTED & ACTIVE**

**What it does:**
- Monitors USGS earthquake feed every 3 minutes
- Generates 4K branded images for every earthquake
- Creates website posts automatically
- Sends email alerts for all earthquakes (currently configured)

**Configuration:**
- Function: `earthquake-poller.js` (runs every 3 minutes)
- Also: `ingest-all.js` → `engines/usgs.js` (runs every 5 minutes)
- Enable: `ENABLE_USGS=true` (already enabled)

**Email Alerts:** ✅ Enabled for ALL earthquakes

---

## ⏳ Pending: NWS Engine (Weather Alerts)

**Status:** ⏳ **STAGE 4 - NOT YET IMPLEMENTED**

**What it will do:**
- Monitor National Weather Service alerts
- Track severe weather warnings (tornadoes, hurricanes, floods, etc.)
- Create website posts for significant weather events
- Send email alerts for high-severity weather

**Data Source:** NWS API (weather.gov)

**Enable:** `ENABLE_NWS=true` (when implemented)

**Current Status:** Code exists but not fully implemented

---

## ⏳ Pending: FAA Engine (Airspace)

**Status:** ⏳ **STAGE 5 - NOT YET IMPLEMENTED**

**What it will do:**
- Monitor FAA airspace restrictions
- Track NOTAMs (Notices to Airmen)
- Alert on significant airspace closures or restrictions
- Create website posts for major airspace events

**Data Source:** FAA API

**Enable:** `ENABLE_FAA=true` (when implemented)

**Current Status:** Code exists but not fully implemented

---

## ⏳ Pending: USCG Engine (Maritime)

**Status:** ⏳ **STAGE 6 - NOT YET IMPLEMENTED**

**What it will do:**
- Monitor US Coast Guard maritime alerts
- Track marine warnings, search & rescue operations
- Alert on significant maritime incidents
- Create website posts for major maritime events

**Data Source:** USCG API/feeds

**Enable:** `ENABLE_USCG=true` (when implemented)

**Current Status:** Code exists but not fully implemented

---

## ⏳ Pending: Volcano Engine

**Status:** ⏳ **STAGE 7 - NOT YET IMPLEMENTED**

**What it will do:**
- Monitor volcano activity alerts
- Track volcanic eruptions and warnings
- Alert on significant volcanic activity
- Create website posts for major volcanic events

**Data Source:** USGS Volcano Hazards Program

**Enable:** `ENABLE_VOLCANO=true` (when implemented)

**Current Status:** Code exists but not fully implemented

---

## ⏳ Pending: Embassy Engine

**Status:** ⏳ **STAGE 8 - NOT YET IMPLEMENTED**

**What it will do:**
- Monitor embassy travel advisories
- Track State Department alerts
- Alert on significant travel warnings
- Create website posts for major travel advisories

**Data Source:** State Department API/feeds

**Enable:** `ENABLE_EMBASSY=true` (when implemented)

**Current Status:** Code exists but not fully implemented

---

## How They Work Together

### Current Setup

**Two Systems Running:**

1. **`earthquake-poller.js`** (Dedicated earthquake pipeline)
   - Runs every 3 minutes
   - Only processes earthquakes
   - Generates images, creates posts, sends emails
   - ✅ **ACTIVE**

2. **`ingest-all.js`** (Unified ingestion system)
   - Runs every 5 minutes
   - Orchestrates all engines
   - Currently only USGS is enabled
   - Stores events in Supabase `verified_events` table
   - ⚠️ **USGS engine here doesn't generate images or send emails yet**

### Future: Unified System

When other engines are implemented, they'll all run through `ingest-all.js`:
- Each engine fetches its data source
- Normalizes into `verified_events` table
- Website posts auto-created
- Email alerts for high-severity events

---

## Current Configuration

**Active Engines:**
- ✅ `ENABLE_USGS=true` (earthquakes via `earthquake-poller.js`)

**Disabled Engines:**
- ❌ `ENABLE_NWS=false` (weather - not implemented)
- ❌ `ENABLE_FAA=false` (airspace - not implemented)
- ❌ `ENABLE_USCG=false` (maritime - not implemented)
- ❌ `ENABLE_VOLCANO=false` (volcanoes - not implemented)
- ❌ `ENABLE_EMBASSY=false` (embassy - not implemented)

---

## What Happens Now

**For Earthquakes:**
1. ✅ Image generated (4K)
2. ✅ Post created on website
3. ✅ Email alert sent

**For Other Event Types:**
- ⏳ Nothing yet (engines not implemented)

---

## To Enable Other Engines (When Implemented)

1. Set environment variable: `ENABLE_NWS=true` (or FAA, USCG, etc.)
2. Ensure data source APIs are accessible
3. Configure email alerts (same as earthquakes)
4. Engines will run automatically via `ingest-all.js`

---

## Summary

**Currently Active:**
- ✅ **Earthquakes** - Full pipeline (images, posts, emails)

**Coming Soon:**
- ⏳ Weather alerts (NWS)
- ⏳ Airspace alerts (FAA)
- ⏳ Maritime alerts (USCG)
- ⏳ Volcano alerts
- ⏳ Embassy advisories

All other engines follow the same pattern as earthquakes once implemented!

