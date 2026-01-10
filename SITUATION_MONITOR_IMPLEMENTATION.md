# Situation Monitor - CIA "Big Board" Implementation Summary

## Overview

The Situation Monitor map has been transformed into a CIA-style intelligence dashboard that automatically displays important news events on the world map in real-time, with smart clustering to prevent clutter.

## Implementation Status

✅ **PHASE 1**: MapEvent model and conversion pipeline - COMPLETE  
✅ **PHASE 2**: Geocoding system (location extraction + Nominatim) - COMPLETE  
✅ **PHASE 3**: Severity/category classification - COMPLETE  
✅ **PHASE 4**: D3 clustering (max 25 individual markers) - COMPLETE  
🔄 **PHASE 5**: Continuous 24/7 updates - IN PROGRESS (basic refresh working)  
⏳ **PHASE 6**: Diagnostics mode - PENDING  

## File Structure

### New Files Created

1. **`src/components/situation-monitor/data/MapEvent.js`**
   - `MapEvent` class - canonical event model
   - `LocationCandidate` class - location extraction results
   - Event ID generation (stable hashing)
   - Deduplication and filtering utilities

2. **`src/components/situation-monitor/data/geocoding.js`**
   - Location extraction from headlines (datelines, parenthetical, keywords)
   - Country alias dictionary (200+ countries with centroids)
   - Nominatim geocoding integration (free, no API key)
   - `GeocodeQueue` class - rate-limited geocoding queue

3. **`src/components/situation-monitor/data/classification.js`**
   - Category classification (conflict, terror, crime, disaster, weather, cyber, health, economy, politics, nuclear)
   - Severity scoring (1-5) based on keywords
   - Topic tag extraction
   - Region tag extraction
   - Multi-source mention detection (severity boost)

4. **`src/components/situation-monitor/data/eventPipeline.js`**
   - `EventPipeline` class - main orchestration
   - Converts headlines → MapEvents → geocoded events
   - Merges with existing events
   - Manages geocode queue

5. **`src/components/situation-monitor/data/clustering.js`**
   - D3-based point clustering
   - Distance-based clustering algorithm
   - Cluster visualization (count, category, severity)
   - Max 25 individual markers enforcement

### Modified Files

1. **`src/components/situation-monitor/MapView.js`**
   - Added `updateEvents()` method
   - Added `renderEvents()` with clustering
   - Added `renderEventMarker()` for individual markers
   - Added `renderCluster()` for cluster visualization
   - Added event/cluster click handlers
   - Added tooltip system for events/clusters

2. **`src/components/situation-monitor/SituationMonitorShell.js`**
   - Integrated `EventPipeline`
   - Processes headlines in `refreshAll()`
   - Updates map with events
   - Maintains event state across refreshes

3. **`src/styles/situation-monitor.css`**
   - Added CSS for event markers
   - Added pulsing animation for severity 5 events
   - Added cluster styling

## Data Pipeline Flow

1. **RSS Feed Fetch** → `NewsPanel.loadNews()` → headlines array
2. **Event Conversion** → `EventPipeline.processHeadlines()` → MapEvents (no location yet)
3. **Location Extraction** → `extractLocationCandidates()` → LocationCandidate[]
4. **Geocoding Queue** → `GeocodeQueue.enqueue()` → rate-limited geocoding (max 5/cycle)
5. **Geocoding** → `geocodeNominatim()` → lat/lon coordinates
6. **Classification** → `calculateSeverity()` + `classifyCategory()` → severity 1-5, category
7. **Filtering** → `filterEvents()` → only events with location + sufficient severity/confidence
8. **Deduplication** → `deduplicateEvents()` → stable ID-based dedupe
9. **Clustering** → `clusterEvents()` → individual markers (max 25) + clusters
10. **Map Rendering** → `MapView.updateEvents()` → SVG markers + clusters

## Default Thresholds

### Severity Thresholds
- **Min severity for map display**: 2 (configurable)
- **Severity 5 (CRITICAL)**: Nuclear, mass casualties, terror attacks, invasion, genocide
- **Severity 4 (HIGH)**: Attacks, strikes, major disasters, cyberattacks, economic crashes
- **Severity 3 (ELEVATED)**: Protests, shootings, storms, hacks, outbreaks
- **Severity 2 (LOW)**: Routine political/economic items
- **Severity 1 (IGNORE)**: Generic commentary, opinion pieces

### Clustering Configuration
- **Max individual markers at world zoom**: 25 (HARD RULE)
- **Cluster distance threshold**: 28 pixels
- **Min zoom for aggressive clustering**: 0.5 (below this, threshold × 1.5)
- **Max cluster radius**: 50 pixels

### Geocoding Limits
- **Max geocode lookups per refresh cycle**: 5
- **Rate limit delay**: 1 second between requests (Nominatim policy)
- **Geocode cache TTL**: 30 days (locations don't change)

### Time Decay
- **Fade after**: 6 hours (configurable)
- **Collapse to clusters after**: 12 hours (configurable)
- **Remove after**: 24 hours (configurable, default)

### Confidence Scoring
- **Dateline extraction** ("City, Country —"): 0.9
- **"in City" patterns**: 0.7
- **Country-only matches**: 0.5
- **Region-only inference**: 0.2
- **Min confidence for display**: 0.6 (unless severity ≥ 4)

## Visual Hierarchy

### Individual Markers
- **Severity 5**: Bright red, pulsing ring, 8px radius
- **Severity 4**: Red, solid ring, 6px radius
- **Severity 3**: Orange, normal marker, 5px radius
- **Severity 1-2**: Hidden unless filters enabled or zoomed in

### Clusters
- **Size**: Based on event count (8px + sqrt(count) × 2, max 20px)
- **Color**: Dominant category color
- **Ring**: Shown for severity ≥ 4 clusters
- **Label**: Event count in white text

### Category Colors
- Conflict: `#ff6b6b` (red)
- Terror: `#ff3333` (bright red)
- Crime: `#ff8c42` (orange-red)
- Disaster: `#ffaa00` (orange)
- Weather: `#4A90E2` (blue)
- Cyber: `#9b59b6` (purple)
- Health: `#e74c3c` (red)
- Economy: `#f39c12` (orange)
- Politics: `#3498db` (blue)
- Nuclear: `#ff0000` (bright red)
- Other: `#95a5a6` (gray)

## Interaction Model

### Hover (Desktop)
- **Individual markers**: Tooltip shows title, source, time, location, severity, category
- **Clusters**: Tooltip shows count, dominant category, max severity

### Click/Tap
- **Individual markers**: Dispatches `sitmon:event-click` custom event (for event drawer)
- **Clusters**: Dispatches `sitmon:cluster-click` custom event (for cluster drawer)

### Event Drawer (TODO)
- Title, source, time
- Category/severity badge
- Location details
- Link to article
- Related headlines in same cluster

### Cluster Drawer (TODO)
- Top events sorted by severity then recency
- Filter chips for categories inside cluster
- "Zoom to cluster bounds" button

## Current Behavior (Preserved)

✅ **Earthquakes**: Work exactly as before - independent system, M4.5+, fade after 15 seconds  
✅ **Custom Monitors**: Work exactly as before - user-created monitors with manual lat/lon  
✅ **Analysis Panels**: Unchanged - intel, correlation, narrative, monitors  
✅ **News Feed Panel**: Unchanged - displays headlines in list format  
✅ **Refresh Cycle**: 5-minute auto-refresh (unchanged)  
✅ **Base Map**: D3 + TopoJSON world map (unchanged)  

## What's New

🆕 **Automatic Event Plotting**: RSS/news items are now geocoded and plotted on map  
🆕 **Smart Clustering**: Max 25 individual markers, everything else clustered  
🆕 **Severity Hierarchy**: Only important events shown (severity ≥ 2 by default)  
🆕 **Category Classification**: Events categorized automatically  
🆕 **Time Decay**: Events fade/remove after configurable time windows  
🆕 **Deduplication**: Stable event IDs prevent duplicate markers  
🆕 **Geocode Caching**: 30-day cache for geocoding results  

## Known Limitations / TODO

- [ ] Event drawer panel (click handler exists, UI pending)
- [ ] Cluster drawer panel (click handler exists, UI pending)
- [ ] Big board overlays (stats: active events, critical count, hotspots)
- [ ] Timeline controls (last 1h / 6h / 24h toggles)
- [ ] Layer toggles (Quakes, News Events, Monitors)
- [ ] Diagnostics mode (?debug=1 query param)
- [ ] Geocode queue status panel
- [ ] Filter UI (show low confidence, category filters)
- [ ] Zoom-based clustering refinement (currently uses fixed threshold)

## Testing

To test the implementation:

1. Open `situation-monitor.html` in browser
2. Wait for initial data load (RSS feeds fetch)
3. Check browser console for:
   - `[SituationMonitorShell] Refreshing all data...`
   - `[Geocoding]` messages (if geocoding occurs)
   - `[EventPipeline]` messages (if any)
4. Observe map for:
   - Individual event markers (max 25)
   - Clusters (if > 25 events)
   - Earthquakes (still work independently)
5. Hover over markers/clusters to see tooltips
6. Click markers/clusters (check console for custom events)

## Performance Considerations

- **Geocoding rate limit**: Max 5 per cycle prevents API throttling
- **Event deduplication**: Prevents duplicate markers on refresh
- **Clustering**: Ensures map never has > 25 individual markers
- **Cache**: 30-day geocode cache reduces API calls
- **Time decay**: Removes old events automatically

## Reliability

- **Offline resilience**: If feeds fail, map still shows existing events
- **Geocoding fallback**: If Nominatim fails, uses country centroids from alias dictionary
- **Error handling**: All geocoding errors are caught and logged, don't break page
- **Cache persistence**: Geocode cache saved to localStorage

## Next Steps

1. **PHASE 5 Completion**: Add event drawer, cluster drawer, big board overlays
2. **PHASE 6**: Add diagnostics mode and testing harness
3. **Polish**: Improve tooltip styling, add animations, refine clustering algorithm
4. **Documentation**: Add inline code comments, API documentation
