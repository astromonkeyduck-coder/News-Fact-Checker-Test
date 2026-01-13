# OSINT Live Cams Implementation Plan

## Architecture Overview

### Endpoints
- `GET /api/cams/search` - Main search endpoint (q, country, state, city, bbox, type, media, limit)
- `GET /api/cams/proxy-image` - Image proxy for hotlink-blocked providers (optional)
- `GET /api/cams/health` - Provider status + last fetch times

### Provider List (Phase 1)
1. **Windy/Webcams.travel** (Global backbone)
   - API: https://api.windy.com/webcams/api/v2.0/list
   - Coverage: Global, search by country/city/bbox
   - Media: Snapshots (expiring URLs), some streams
   - Tags: Auto-tag by location (UA, IL, etc.)

2. **Florida FL511** (ArcGIS FeatureServer)
   - Endpoint: https://www.fl511.com/arcgis/rest/services/FL511/TrafficCameras/FeatureServer/0/query
   - Coverage: Florida traffic cameras
   - Media: Snapshots
   - Type: dot_traffic

3. **New York 511NY** (API key required)
   - Endpoint: https://511ny.org/api/cameras
   - Coverage: New York traffic cameras
   - Media: Snapshots
   - Type: dot_traffic

4. **California Caltrans** (Open dataset)
   - Endpoint: Caltrans CCTV open dataset
   - Coverage: California traffic cameras
   - Media: Snapshots
   - Type: dot_traffic

5. **NYC DOT** (If available)
   - Coverage: NYC street cameras
   - Media: Snapshots
   - Type: city_street

### Schema (Canonical Camera Object)
```javascript
{
  id: "windy:12345",
  provider: "windy",
  country: "US",
  region1: "NY",
  city: "New York",
  road: "I-95",
  title: "I-95 at Exit 5",
  description: "Traffic camera on I-95",
  lat: 40.7128,
  lon: -74.0060,
  type: "dot_traffic",
  media: {
    mode: "snapshot",
    snapshotUrl: "https://...",
    streamUrl: null,
    providerPageUrl: "https://..."
  },
  refreshSec: 300,
  status: "online",
  tags: ["nyc", "i-95", "traffic"],
  updatedAt: "2025-01-15T10:30:00Z"
}
```

### UI Layout
- **Top Tab**: "LIVE CAMS" button in Situation Monitor header
- **Left Panel**: Camera Browser
  - Search box
  - Filters (Country, State, City, Type, Media)
  - Results grid (2 columns, thumbnails)
  - Watchlist section at top
- **Map Layer**: Camera markers with clustering
- **Right Panel**: Player
  - Large display (iframe or snapshot)
  - Metadata
  - Actions (Open provider, Copy coords, Add to watchlist)

### Hotspots Presets
- Kyiv, Ukraine: bbox [30.2, 50.2, 30.8, 50.6]
- Tel Aviv, Israel: bbox [34.7, 32.0, 34.9, 32.2]
- New York City: bbox [-74.1, 40.6, -73.9, 40.8]
- Orlando, FL: bbox [-81.5, 28.4, -81.3, 28.6]
- Bourbon St, New Orleans: bbox [-90.08, 29.96, -90.06, 29.98]

### Code Structure
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
    - nycdot.js

Frontend:
- js/liveCams/
  - index.js
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
```

### Environment Variables
- `WINDY_API_KEY` (if required)
- `NY511_API_KEY` (if required)
- `CAMS_TOKEN` (optional, for internal endpoints)

### Caching Strategy
- In-memory cache per function instance
- Cache keys: `windy:bbox:...`, `fl511:all`
- TTL: Windy 5-10min, DOT 10-30min
- Stale-while-revalidate pattern
