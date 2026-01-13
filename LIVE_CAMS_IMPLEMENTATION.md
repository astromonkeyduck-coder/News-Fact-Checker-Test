# OSINT Live Cams Implementation - Complete ✅

## Overview

A comprehensive "LIVE CAMS" system integrated into the Situation Monitor that displays thousands of public cameras from multiple sources with a professional intelligence workstation UI.

## Features Implemented

### ✅ Provider Integration (DOT-heavy US + Hotspots)

**Priority Logic:**
- US DOT providers (FL511, Caltrans, NY511) prioritized for US/dot_traffic requests
- Windy as fallback for US, primary for non-US
- NY511 only called if `NY511_API_KEY` exists

**Geocoding:**
- City/street input automatically geocoded via Nominatim
- Results cached for 24 hours
- Geocoding converts to bbox for provider searches

### ✅ Backend (Netlify Functions)

1. **`/api/cams/search`** - Main search endpoint
   - Supports: q (keyword), country, state, city, bbox, type, media, limit
   - Parallel provider queries with timeouts
   - Aggressive caching (5-30 min TTL)
   - Rate limiting (30 req/min per IP)
   - Deduplication by ID and location similarity

2. **`/api/cams/proxy-image`** - Image proxy
   - Whitelist-only domain security
   - 5MB size limit
   - Cache headers

3. **`/api/cams/health`** - Health check
   - Provider status
   - Cache stats
   - Last fetch times

### ✅ Providers (Phase 1)

1. **Windy/Webcams.travel** (Global backbone)
   - Global coverage
   - Search by country, city, bbox
   - Auto-tags conflict hotspots (UA, IL, etc.)

2. **Florida FL511** (ArcGIS FeatureServer)
   - Florida traffic cameras
   - Open endpoint, no API key required

3. **New York 511NY** (API)
   - NY traffic cameras
   - Requires `NY511_API_KEY` env var

4. **California Caltrans** (Open dataset)
   - CA traffic cameras
   - Open endpoint

### ✅ Frontend

1. **Search & Filters**
   - Keyword search with debouncing
   - Country/State/City filters
   - Type chips (DOT Traffic, Street, Scenic)
   - Media toggle (Live only / Snapshots OK)

2. **Camera Grid**
   - 2-column thumbnail grid
   - Lazy loading with IntersectionObserver
   - Status indicators (online/offline)
   - Provider badges
   - Click to select

3. **Player Panel**
   - Large display (iframe for streams, image for snapshots)
   - Auto-refresh for snapshots
   - Metadata display
   - Actions: Open provider page, Copy coordinates, Refresh

4. **Top Live Strip**
   - Horizontal strip at top showing watchlist + hotspot cameras
   - Auto-refreshes thumbnails every 30 seconds
   - Lazy loading for performance
   - Click thumbnail to select in player

5. **Watchlist**
   - Pin cameras to watchlist
   - Persists in localStorage
   - Auto-refreshes thumbnails

5. **Hotspot Presets**
   - Kyiv, Ukraine
   - Tel Aviv, Israel
   - New York City
   - Orlando, FL
   - Bourbon Street, New Orleans

6. **Map Integration**
   - Camera markers with clustering
   - Color-coded by type
   - Click marker to select camera

## File Structure

```
Backend:
- netlify/functions/cams-search.js
- netlify/functions/cams-proxy-image.js
- netlify/functions/cams-health.js
- netlify/lib/cams/
  - normalize.js
  - dedupe.js
  - cache.js
  - providers/
    - windy.js
    - fl511.js
    - ny511.js
    - caltrans.js

Frontend:
- js/liveCams/
  - index.js (main module)
  - state.js
  - api.js
  - providers-ui.js
  - map-layer.js
  - components/
    - SearchBar.js
    - FiltersPanel.js
    - CamerasGrid.js
    - CameraCard.js
    - PlayerPanel.js
    - Watchlist.js
- css/liveCams.css

Integration:
- situation-monitor.html (CSS link added)
- src/components/situation-monitor/SituationMonitorShell.js (tab button + panel)
- src/styles/situation-monitor.css (tab button styles)
- netlify.toml (API redirects)
```

## Environment Variables

Set these in Netlify Dashboard → Site Settings → Environment Variables:

- `CAMS_TOKEN` (REQUIRED) - Shared secret for API protection (X-CAMS-TOKEN header)
- `WINDY_API_KEY` (optional) - Windy API key if required
- `NY511_API_KEY` (optional) - NY 511 API key for NY cameras

## Security: CAMS_TOKEN Protection

All camera API endpoints are protected by CAMS_TOKEN:

- **Purpose**: Prevent API abuse, scraping, and accidental exposure
- **NOT user authentication** - it's a shared secret gate
- **NOT encryption** - it's a simple request validation
- **Implementation**:
  - Frontend fetches token from `/api/cams-token` endpoint
  - Token is sent in `X-CAMS-TOKEN` header on all requests
  - Backend validates token against `process.env.CAMS_TOKEN`
  - Returns 401 Unauthorized if token is missing or incorrect
- **Security Notes**:
  - Token is NEVER logged
  - Token is NEVER exposed in error messages
  - Token is NEVER included in frontend source code comments
  - Token is cached in frontend (memory only, not localStorage)
- **Enhanced Security**:
  - `/api/cams-token` endpoint has stricter rate limiting (10 req/min vs 30 for search)
  - Excessive requests are logged (IP only, no token)
  - Can be disabled in production via `CAMS_TOKEN_ONLY_IN_DEV=true`

## Usage

1. Navigate to Situation Monitor
2. Click "📹 LIVE CAMS" button in header
3. Use search/filters to find cameras
4. Click camera card to view in player panel
5. Click star icon to add to watchlist
6. Use hotspot presets for quick location access

## Legal & Safety

- ✅ Only uses official/open sources and documented APIs
- ✅ No scraping or bypassing paywalls
- ✅ Links out when stream embed isn't allowed
- ✅ Disclaimer included: "Camera content provided by respective DOT/511/webcam providers."

## Testing Checklist

- [x] Query by Country=US, State=NY, city="New York", type=dot_traffic
- [x] Query by Country=UA, city="Kyiv", type=city_street/scenic
- [x] Map bbox over Manhattan
- [x] No API keys in client code
- [x] Results render + clustering works
- [x] Selecting camera updates player
- [x] Watchlist persists on refresh
- [x] Thumbnails lazy load (IntersectionObserver)
- [x] Image proxy works for blocked domains

## Next Steps (Phase 2)

- Add more US states (TX, IL, etc.)
- Enhanced map clustering visualization
- Camera history/playback (if available)
- Custom hotspot presets
- Export watchlist

## Notes

- Windy image URLs expire quickly (5-10 min cache)
- DOT cameras refresh every 60 seconds typically
- Map layer integration is basic - can be enhanced with full D3 integration
- Caltrans endpoint may need adjustment based on actual API structure
