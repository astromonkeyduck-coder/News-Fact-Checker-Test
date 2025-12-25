# Verified Events Engine - Implementation Guide

## Overview

The Verified Events Engine transforms Noteworthy News into a professional, always-up-to-date "Verified Events" platform that ingests structured official data from multiple sources, normalizes it into a unified database schema, and automatically creates website posts with map overlays and email alerts.

## Architecture

```
┌─────────────────┐
│  ingest-all     │  Scheduled function (every 5 min)
│  (orchestrator) │  Runs all enabled engines
└────────┬────────┘
         │
         ├─► USGS Engine (earthquakes)
         ├─► NWS Engine (weather alerts) [Stage 4]
         ├─► FAA Engine (airspace) [Stage 5]
         ├─► USCG Engine (maritime) [Stage 6]
         ├─► Volcano Engine [Stage 7]
         └─► Embassy Engine [Stage 8]
         │
         ▼
┌─────────────────┐
│  Supabase DB    │
│  verified_events│  Normalized event data
│  engine_runs    │  Run tracking & metrics
└────────┬────────┘
         │
         ├─► Website Posts (auto-created)
         ├─► Email Alerts (high severity only)
         └─► Map Overlays (Stage 9)
```

## Implementation Status

### ✅ Stage 0: Baseline + Safety (COMPLETE)
- Feature flags (ENV vars) for each engine
- Structured logging with engine name, run_id, metrics
- Health endpoint (`/netlify/functions/health`)
- DRY_RUN mode support

### ✅ Stage 1: Database Foundation (COMPLETE)
- `verified_events` table with normalized schema
- `engine_runs` table for tracking ingestion runs
- Indexes for performance

### ✅ Stage 2: Core Ingestion Framework (COMPLETE)
- Engine plugin system (`netlify/functions/engines/`)
- Shared libraries (`netlify/functions/lib/`)
- `ingest-all` scheduled function
- Error handling and isolation

### ✅ Stage 3: USGS Engine (COMPLETE)
- Fetches earthquakes from USGS GeoJSON feed
- Normalizes into `verified_events` table
- Generates branded images using template
- Sends email alerts for magnitude >= 7.0
- Respects DRY_RUN mode

### ⏳ Stage 4-12: Pending
- Stage 4: NWS Engine (weather alerts)
- Stage 5: FAA Engine (airspace)
- Stage 6: USCG Engine (maritime)
- Stage 7: Volcano Engine
- Stage 8: Embassy Engine
- Stage 9: Website UI + Map Upgrade
- Stage 10: AI "Up-to-Date" Layer
- Stage 11: Email Rate Limits
- Stage 12: Test Mode + Simulations

## Setup Instructions

### 1. Database Migration

Run the migration to create the tables:

```bash
# Using Supabase CLI
supabase db push

# OR manually via Supabase Dashboard SQL Editor
# Copy contents of: supabase/migrations/002_create_verified_events.sql
```

### 2. Environment Variables

Set these in Netlify Dashboard → Site Settings → Environment Variables:

**Required:**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Feature Flags (all default to false):**
```
ENABLE_USGS=true          # Enable USGS earthquake engine
ENABLE_NWS=false          # Enable NWS weather alerts (Stage 4)
ENABLE_FAA=false          # Enable FAA airspace (Stage 5)
ENABLE_USCG=false         # Enable USCG maritime (Stage 6)
ENABLE_VOLCANO=false      # Enable volcano alerts (Stage 7)
ENABLE_EMBASSY=false      # Enable embassy advisories (Stage 8)
DRY_RUN=false            # When true: no emails, no posts; only logs + DB writes
```

**Email Configuration (for alerts):**
```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Noteworthy News <richard@noteworthynews.co>
AI_NOTIFICATION_EMAILS=email1@example.com,email2@example.com
# OR (backwards compatible):
ALERT_TO_EMAIL=email@example.com
```

### 3. Schedule the Ingestion Function

After deployment, configure the schedule in Netlify Dashboard:

1. Go to **Netlify Dashboard** → Your Site → **Functions**
2. Find `ingest-all`
3. Click **Schedule** tab
4. Set schedule to: `*/5 * * * *` (every 5 minutes)
5. Save

**Or trigger manually:**
```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/ingest-all
```

## Usage

### Health Check

Check the status of all engines:

```bash
curl https://your-site.netlify.app/.netlify/functions/health
```

Response:
```json
{
  "dry_run": false,
  "engines": {
    "usgs": {
      "enabled": true,
      "last_success": {
        "started_at": "2025-12-24T12:00:00Z",
        "finished_at": "2025-12-24T12:00:05Z",
        "count_new": 2,
        "count_updated": 0,
        "count_total_seen": 5
      },
      "last_error": null
    },
    ...
  },
  "timestamp": "2025-12-24T12:10:00Z"
}
```

### Testing with DRY_RUN

Enable DRY_RUN mode to test without sending emails or creating posts:

```
DRY_RUN=true
```

In DRY_RUN mode:
- ✅ Events are stored in database
- ✅ Logs are written
- ✅ Images are generated (but not used)
- ❌ No emails sent
- ❌ No website posts created

### Viewing Events

Query the database directly:

```sql
-- Recent earthquakes
SELECT 
  title,
  severity,
  location_display,
  published_at,
  image_url,
  alert_sent
FROM verified_events
WHERE engine = 'usgs'
  AND event_type = 'earthquake'
ORDER BY published_at DESC
LIMIT 20;

-- Engine run history
SELECT 
  engine,
  started_at,
  finished_at,
  ok,
  count_new,
  count_updated,
  count_total_seen,
  error
FROM engine_runs
ORDER BY started_at DESC
LIMIT 10;
```

## USGS Engine Details

### How It Works

1. **Fetches** USGS `all_hour` GeoJSON feed (last hour of earthquakes)
2. **Processes** each earthquake:
   - Builds canonical_id: `usgs:{event_id}`
   - Normalizes severity (1-5 based on magnitude)
   - Cleans location text (removes "XX km SE of" prefixes)
   - Fetches event detail for USGS images
   - Generates branded image using template
   - Stores in `verified_events` table
3. **Sends alerts** for magnitude >= 7.0 (severity >= 4):
   - Email with branded image attachment
   - Only once per canonical_id
   - Respects DRY_RUN mode

### Severity Mapping

- Magnitude < 5.5 → Severity 1
- Magnitude 5.5-6.4 → Severity 2
- Magnitude 6.5-6.9 → Severity 3
- Magnitude 7.0-7.9 → Severity 4
- Magnitude >= 8.0 → Severity 5

### Email Alerts

- **Trigger**: Magnitude >= 7.0
- **Subject**: `BREAKING: Strong Earthquake Near {LOCATION} (M{MAG})`
- **Body**: Plain English, 1-2 lines, mentions USGS once
- **Attachment**: Branded image (if generated)
- **Recipients**: `AI_NOTIFICATION_EMAILS` or `ALERT_TO_EMAIL`

## Acceptance Tests

### Stage 0-2 Tests

1. **Health endpoint works:**
   ```bash
   curl https://your-site.netlify.app/.netlify/functions/health
   ```
   ✅ Should return JSON with engine statuses

2. **ingest-all runs with all engines disabled:**
   ```bash
   curl -X POST https://your-site.netlify.app/.netlify/functions/ingest-all
   ```
   ✅ Should return success with 0 enabled engines
   ✅ Should create `engine_runs` entry

3. **DRY_RUN mode prevents emails:**
   - Set `DRY_RUN=true`
   - Run ingest-all
   - ✅ No emails sent (check logs)
   - ✅ Events still stored in DB

### Stage 3 Tests (USGS)

1. **Enable USGS engine:**
   ```
   ENABLE_USGS=true
   ```

2. **Run ingest-all:**
   ```bash
   curl -X POST https://your-site.netlify.app/.netlify/functions/ingest-all
   ```

3. **Verify:**
   - ✅ New earthquakes create rows in `verified_events`
   - ✅ Duplicate polls don't create duplicates (dedupe by canonical_id)
   - ✅ If magnitude >= 7.0: exactly one email sent + `alert_sent` set true
   - ✅ If image missing: event still posts; `image_url` can update later
   - ✅ Logs show structured output with engine name, run_id, metrics

4. **Check database:**
   ```sql
   SELECT * FROM verified_events WHERE engine = 'usgs' ORDER BY fetched_at DESC LIMIT 5;
   SELECT * FROM engine_runs WHERE engine = 'usgs' ORDER BY started_at DESC LIMIT 1;
   ```

## File Structure

```
netlify/functions/
├── ingest-all.js              # Main orchestrator (scheduled)
├── health.js                  # Health check endpoint
├── engines/
│   ├── usgs.js               # ✅ USGS engine (Stage 3)
│   ├── nws.js                # ⏳ NWS engine (Stage 4)
│   ├── faa.js                # ⏳ FAA engine (Stage 5)
│   ├── uscg.js               # ⏳ USCG engine (Stage 6)
│   ├── volcano.js            # ⏳ Volcano engine (Stage 7)
│   └── embassy.js            # ⏳ Embassy engine (Stage 8)
└── lib/
    ├── supabaseClient.js     # Shared Supabase client
    ├── normalize.js          # Severity mapping, location cleaning
    ├── dedupe.js             # Canonical ID builders
    └── logger.js             # Structured logging

supabase/migrations/
└── 002_create_verified_events.sql  # Database schema
```

## Next Steps

1. **Test Stage 0-3** with acceptance tests above
2. **Implement Stage 4** (NWS Engine) when ready
3. **Build Stage 9** (Website UI + Map) to display events
4. **Implement Stage 10** (AI Layer) for up-to-date answers

## Troubleshooting

### Engine not running?
- Check `ENABLE_*` flag is set to `true`
- Check function logs in Netlify Dashboard
- Verify Supabase credentials are set

### No events in database?
- Check USGS feed is returning data: `curl https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson`
- Check `engine_runs` table for errors
- Verify database migration ran successfully

### Emails not sending?
- Check `RESEND_API_KEY` is set
- Check `AI_NOTIFICATION_EMAILS` or `ALERT_TO_EMAIL` is set
- Check `DRY_RUN` is not `true`
- Check magnitude >= 7.0 (only high-severity events trigger alerts)

### Images not generating?
- Check `generate-earthquake-image` function is deployed
- Check template file `1stUSGSTemp.png` exists
- Check logs for image generation errors (non-fatal - events still post)

## Rollback Discipline

Each stage is implemented in its own commit. If acceptance tests fail:

1. **Revert to last passing commit**
2. **Fix issues**
3. **Re-test before proceeding**

Never proceed to next stage if current stage fails acceptance tests.

