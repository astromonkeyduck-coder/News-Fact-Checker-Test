# Situation Monitor - PHASE 0 Audit Report

## File Structure

### Core Map Implementation
- **`src/components/situation-monitor/MapView.js`** (522 lines)
  - D3 + TopoJSON map rendering
  - Base map (world outline with countries)
  - Earthquake markers (`addEarthquake()`)
  - Custom monitor markers (`addMonitorMarker()`)
  - Tooltip system
  - Static overlay rendering (conflict zones, hotspots, chokepoints, cables, military bases, nuclear facilities) - currently disabled

### Main Shell Component
- **`src/components/situation-monitor/SituationMonitorShell.js`** (373 lines)
  - Orchestrates all panels and map
  - Handles refresh cycle (manual + auto every 5 minutes)
  - Coordinates data flow between panels

### Data Pipeline
- **`src/components/situation-monitor/Panels/NewsPanel.js`** (128 lines)
  - Fetches RSS feeds from `NEWS_FEEDS` config
  - Parses RSS via `parseRSS()` from parsers.js
  - Stores headlines in `this.headlines[]` array
  - Provides `getHeadlines()` method for other panels
  - Auto-refreshes every 5 minutes

- **`src/components/situation-monitor/data/fetchers.js`** (277 lines)
  - Memory + localStorage caching system
  - `fetchRSSFeed()` - fetches and caches RSS
  - `fetchJSON()` - generic JSON fetcher
  - Retry logic with exponential backoff
  - Cache TTL: news=2min, weather=5min, earthquakes=1min, markets=30s

- **`src/components/situation-monitor/data/parsers.js`** (127 lines)
  - `parseRSS()` - converts XML to headline objects
  - `parseGeoJSON()` - for earthquakes
  - `parseWeatherAlerts()` - for weather alerts
  - Headline object structure: `{title, link, description, pubDate, guid, timestamp}`

- **`src/components/situation-monitor/data/sources.js`** (243 lines)
  - `NEWS_FEEDS` - RSS feed configurations (world, tech, finance, gov)
  - Static data: `HOTSPOTS`, `CONFLICT_ZONES`, `CHOKEPOINTS`, `CABLE_POINTS`, `MILITARY_BASES`, `NUCLEAR_FACILITIES`

- **`src/components/situation-monitor/data/analysis.js`** (189 lines)
  - Entity extraction patterns (countries, leaders, organizations, companies, currencies)
  - `extractMainCharacters()` - top mentioned entities
  - `detectCorrelations()` - topic spiking detection
  - `trackNarratives()` - mainstream vs fringe tracking
  - Topic keywords dictionary (conflict, economy, technology, climate, health, politics)

### Analysis Panels
- **`src/components/situation-monitor/Panels/IntelFeedPanel.js`** - Main Characters
- **`src/components/situation-monitor/Panels/CorrelationPanel.js`** - Correlations
- **`src/components/situation-monitor/Panels/NarrativePanel.js`** - Narrative Signals
- **`src/components/situation-monitor/Panels/MonitorsPanel.js`** - Custom Monitors (can add markers to map if lat/lon provided)

### Other Panels
- **`src/components/situation-monitor/Panels/EarthquakePanel.js`** - Earthquake list
- **`src/components/situation-monitor/Panels/WeatherAlertsPanel.js`** - Weather alerts
- **`src/components/situation-monitor/Panels/MarketsPanel.js`** - Market data

### Styles
- **`src/styles/situation-monitor.css`** - All Situation Monitor styling

### Entry Point
- **`situation-monitor.html`** - HTML page that loads SituationMonitorShell

---

## Current Data Flow (8-12 Bullet Points)

1. **Page Load**: `situation-monitor.html` → loads D3/TopoJSON from CDN → initializes `SituationMonitorShell`

2. **Shell Init**: `SituationMonitorShell.init()` → creates layout HTML → calls `initMap()` → calls `initPanels()` → calls `refreshAll()`

3. **Map Init**: `MapView.init()` → loads world map TopoJSON from CDN → renders base map (countries) → `renderOverlays()` is called but currently does nothing (commented out)

4. **News Fetch**: `NewsPanel.loadNews()` → iterates `NEWS_FEEDS` → calls `fetchRSSFeed()` for each feed → `fetchRSSFeed()` checks cache → if miss, fetches via `fetchWithRetry()` → stores in memory + localStorage cache → returns feed data

5. **RSS Parsing**: `parseRSS()` → parses XML string → extracts `{title, link, description, pubDate, guid, timestamp}` → returns array of headline objects

6. **Headline Storage**: `NewsPanel` stores parsed headlines in `this.headlines[]` array (top 50, sorted by date) → renders to panel UI

7. **Analysis Pipeline**: `SituationMonitorShell.refreshAll()` → gets headlines via `this.panels.news.getHeadlines()` → passes to analysis panels:
   - `this.panels.intel.update(headlines)` - extracts main characters
   - `this.panels.correlation.update(headlines)` - detects correlations
   - `this.panels.narrative.update(headlines)` - tracks narratives
   - `this.panels.monitors.updateMatches(headlines)` - matches custom monitor keywords

8. **Earthquake Pipeline**: `EarthquakePanel.loadEarthquakes()` → calls `fetchEarthquakes()` → fetches USGS GeoJSON → parses via `parseGeoJSON()` → stores in panel → `SituationMonitorShell.refreshAll()` gets earthquakes → calls `this.mapView.addEarthquake()` for each (max 20, M4.5+)

9. **Map Markers**: `MapView.addEarthquake()` → projects lat/lon to x/y → creates SVG circle → adds tooltip handlers → fades out after 15 seconds

10. **Auto-Refresh**: `SituationMonitorShell.setupAutoRefresh()` → sets `setInterval` to call `refreshAll()` every 5 minutes → can be toggled via checkbox

11. **Custom Monitors**: `MonitorsPanel` allows users to create monitors with keywords → `updateMatches()` checks headlines for keyword matches → if monitor has `lat/lon`, calls `this.mapView.addMonitorMarker()` to plot on map

12. **Current Limitation**: **RSS/news items are NOT geocoded or plotted on map** - they only flow to analysis panels and News Feed panel. Map only shows: world outline + earthquakes (M4.5+) + custom monitors (if user manually entered coordinates).

---

## What Will Change vs What Will NOT Change

### ✅ WILL NOT CHANGE (Preserve Current Behavior)
- **Earthquake system**: Keep `addEarthquake()` exactly as-is. Earthquakes continue to work independently.
- **Custom monitors**: Keep `addMonitorMarker()` for user-created monitors with manual lat/lon.
- **Analysis panels**: Keep existing intel/correlation/narrative/monitors analysis unchanged.
- **News Feed panel**: Keep displaying headlines in list format.
- **Refresh cycle**: Keep 5-minute auto-refresh mechanism.
- **Base map rendering**: Keep D3 + TopoJSON world map rendering.
- **Caching system**: Keep existing memory + localStorage cache in fetchers.js.

### 🔄 WILL CHANGE (New Functionality)
- **New Map Event Pipeline**: Create `MapEvent` model and conversion system from news headlines.
- **Geocoding System**: Add location extraction + geocoding service integration (Nominatim/GeoNames by default).
- **Severity/Category Classification**: Add keyword-based classification system for events.
- **Clustering System**: Implement D3-based point clustering for map markers (max 25 individual markers at world zoom).
- **Map Layers**: Add layer toggles (Quakes, News Events, Monitors).
- **Event Drawer**: Add side panel for event details on click.
- **Time Decay**: Add automatic event expiration (6h fade, 12h cluster, 24h remove).
- **Big Board Overlays**: Add stats overlay (active events, critical count, hotspots).
- **Deduplication**: Add stable event ID hashing to prevent duplicate markers.
- **Geocode Cache**: Extend cache system for geocoding results (30-day TTL).

---

## Current State Summary

**Map Currently Shows:**
- World country outlines (cyan/teal colors)
- Earthquakes (M4.5+, fade after 15 seconds)
- Custom monitor markers (only if user manually entered lat/lon)

**Map Does NOT Show:**
- RSS/news items (no geocoding)
- Static overlays (hotspots, conflict zones, etc. - code exists but disabled)

**Data Available But Not Used for Map:**
- `NewsPanel.headlines[]` - array of headline objects with title, link, description, timestamp
- Analysis results (main characters, correlations, narratives) - used only for panels

**Refresh Cycle:**
- Manual refresh button
- Auto-refresh every 5 minutes (toggleable)
- Each panel also has its own refresh interval (news=5min, earthquakes=1min, markets=30s)

**No Existing:**
- Geocoding service integration
- Event severity/category classification
- Clustering algorithm
- Event deduplication
- Time decay system
- Map layer toggles
- Event detail drawer

---

## Next Steps

After audit approval, proceed with:
1. **PHASE 1**: Create MapEvent model and conversion pipeline
2. **PHASE 2**: Implement geocoding system (location extraction + API calls)
3. **PHASE 3**: Add severity/category classification
4. **PHASE 4**: Implement clustering and map presentation
5. **PHASE 5**: Add continuous updates and reliability
6. **PHASE 6**: Add diagnostics and testing
