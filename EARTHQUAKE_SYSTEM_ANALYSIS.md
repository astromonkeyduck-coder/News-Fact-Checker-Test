# Complete Earthquake System Analysis

This document provides a comprehensive breakdown of how the earthquake detection, processing, and alerting system works in this codebase.

---

## PART 1: DATA FETCHING & INGESTION

### 1.1 USGS Feed Polling

**Location**: `netlify/functions/engines/usgs.js` (main engine) and `netlify/functions/earthquake-poller.js` (legacy poller)

**How it works:**
- The system polls the USGS GeoJSON feed every 3 minutes (configured in Netlify scheduled functions)
- Uses two feed types:
  - `all_hour.geojson` - Earthquakes from the last hour (primary)
  - `all_day.geojson` - Earthquakes from the last 24 hours (fallback)
- Feed URL: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson`

**Data Structure:**
```javascript
{
  features: [
    {
      id: "us7000xxxxx",  // Unique event ID
      properties: {
        mag: 6.5,         // Magnitude
        place: "20 km SE of Watsonville, California",
        time: 1234567890, // Unix timestamp (ms)
        detail: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/{id}.geojson",
        url: "https://earthquake.usgs.gov/earthquakes/eventpage/{id}"
      },
      geometry: {
        coordinates: [lon, lat, depth]  // [longitude, latitude, depth in km]
      }
    }
  ]
}
```

**Filtering:**
- Minimum magnitude threshold: 0.5 (configurable)
- Events below 0.5 are processed but won't get images
- Events below 2.5 are skipped entirely in legacy poller

### 1.2 Event Detail Fetching

**Location**: `netlify/functions/engines/usgs.js` - `fetchUsgsDetailGeoJson()`

**Purpose**: Fetch detailed event data including product images

**Process:**
1. Constructs detail URL from event ID: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/{eventId}.geojson`
2. Fetches GeoJSON detail which contains:
   - Enhanced properties
   - Product images (shakemap, DYFI, etc.)
   - Additional metadata

**Critical Architecture Decision:**
- **EVENT-LOCKED**: Only uses GeoJSON detail products (no HTML scraping)
- Prevents cross-event contamination (images from wrong earthquakes)
- Images may take 5-15 minutes to appear, but ensures accuracy
- **Retry System**: For earthquakes M≥6.0, marks as `usgs_retry_pending` if no images found initially
- Separate retry function checks every minute for up to 30 minutes
- When USGS images appear, automatically regenerates branded image with real data

### 1.3 Image Extraction from USGS Products

**Location**: `netlify/functions/engines/usgs.js` - `extractUsgsProductImages()`

**Priority Order:**
1. **Shakemap products** (highest priority) - Best quality maps, available 5-10 min after event
2. **DYFI products** - "Did You Feel It" maps, available quickly
3. **Losspager/Pager products** - Loss estimation maps
4. **Origin/Location products** - Basic location maps
5. **Moment-tensor products** - Focal mechanism diagrams

**Extraction Logic:**
- Scans `properties.products[productType][].contents` for image files
- Validates images by:
  - File extension (.png, .jpg, .jpeg, .gif, .webp)
  - Content-Type header
  - Magic bytes (PNG: 89 50 4E 47, JPEG: FF D8 FF, etc.)
- Scores candidates by:
  - Product priority (lower = better)
  - Path preference (intensity, mmi, pga, pgv, map, plot)
  - Preferred weight (from product metadata)
  - Update time (newer = better)
- Returns top 6 candidates (only needs 2, but wants fallback options)

**Deduplication:**
- Tracks used URLs to avoid exact duplicates
- Normalizes filenames to avoid variants (e.g., "ciim.jpg" vs "ciim_geo.jpg")
- Ensures images are from different product types when possible

---

## PART 2: DATA PROCESSING & NORMALIZATION

### 2.1 Location Cleaning & Geocoding

**Location**: `netlify/functions/lib/normalize.js` - `cleanLocation()` and `enhanceLocationWithGeocoding()`

**Process:**
1. **Initial Cleaning**:
   - Removes distance/direction prefixes: "20 km SE of" → ""
   - Extracts city and country from comma-separated format
   - Converts to uppercase: "WATSONVILLE, CALIFORNIA"

2. **Enhanced Geocoding** (if coordinates available):
   - Uses reverse geocoding API (OpenStreetMap Nominatim)
   - Gets English name for non-English locations
   - Improves accuracy for ambiguous locations

**Example Transformations:**
- "20 km SE of Watsonville, California" → "WATSONVILLE, CALIFORNIA"
- "5 km N of Tokyo, Japan" → "TOKYO, JAPAN"
- "Near coast of Nicaragua" → "NICARAGUA" (with geocoding enhancement)

### 2.2 Severity Normalization

**Location**: `netlify/functions/lib/normalize.js` - `normalizeEarthquakeSeverity()`

**Mapping:**
- M ≥ 8.0 → "extreme"
- M ≥ 7.0 → "high"
- M ≥ 6.0 → "moderate"
- M ≥ 5.0 → "low"
- M < 5.0 → "minimal"

### 2.3 Canonical ID Generation

**Location**: `netlify/functions/lib/dedupe.js` - `buildCanonicalId()`

**Format**: `{source}:{eventId}`
- Example: `usgs:us7000xxxxx`

**Purpose**: Ensures unique identification across different sources and prevents duplicates

### 2.4 Event Storage

**Location**: `netlify/functions/engines/usgs.js` - `storeEvent()`

**Database**: Supabase `verified_events` table

**Event Object Structure:**
```javascript
{
  canonical_id: "usgs:us7000xxxxx",
  engine: "usgs",
  event_type: "earthquake",
  severity: "moderate",
  title: "M6.5 Earthquake Near WATSONVILLE, CALIFORNIA",
  summary: "A magnitude 6.5 earthquake was detected...",
  location_display: "WATSONVILLE, CALIFORNIA",
  lat: 36.9102,
  lon: -121.7569,
  source_name: "USGS",
  source_url: "https://earthquake.usgs.gov/earthquakes/eventpage/...",
  published_at: "2025-01-15T10:30:00Z",
  status: "active",
  tags: ["earthquake", "magnitude_6", "disaster", "breaking"],
  assets: {
    usgs_images: [...],           // Extracted USGS product images
    magnitude: 6.5,
    depth: 10.5,
    event_id: "us7000xxxxx",
    location_english_name: "Watsonville, California",
    impact_assessment: {...},      // See Part 4
    tsunami_assessment: {...},     // See Part 4
    aftershock_forecast: {...},    // See Part 4
    anomaly_detection: {...}       // See Part 4
  },
  image_url: "https://...",        // Generated branded image
  alert_sent: false,
  raw: {...}                       // Original USGS GeoJSON feature
}
```

**Update Logic:**
- Checks if event exists by `canonical_id`
- If exists: Updates all fields except `alert_sent` (preserved)
- If new: Inserts new event
- Tracks `hasNewImage` flag to detect when images are added later

---

## PART 3: IMAGE GENERATION

### 3.1 Image Generation Pipeline

**Location**: `netlify/functions/generate-earthquake-image.js`

**Trigger**: Called automatically during earthquake processing

**Input:**
```javascript
{
  magnitude: 6.5,
  location: "WATSONVILLE, CALIFORNIA",
  eventId: "us7000xxxxx",
  usgsImages: [
    { url: "https://...", type: "shakemap", filename: "intensity.jpg" },
    { url: "https://...", type: "dyfi", filename: "ciim.jpg" }
  ],
  coordinates: [lon, lat, depth]  // Optional, for location map
}
```

**Output**: Branded image URL (stored in Netlify Blob storage)

### 3.2 Image Generation Process

**Step 1: Download USGS Images**
- Attempts to download up to 2 USGS product images
- Validates each image:
  - HTTP status check
  - Content-Type validation
  - Magic bytes verification (PNG/JPEG/GIF/WebP)
  - Redirect validation (ensures event binding)
- Retries up to 5 times with exponential backoff
- Calculates SHA1 hash for forensic tracking

**Step 2: Prepare Images**
- Uses Sharp library for image processing
- Resizes/crops USGS images to fit template (940x788 base, 3840x2160 4K output)
- Maintains aspect ratio with center crop
- Handles different image formats (PNG, JPEG, GIF, WebP)

**Step 3: Generate Location Map (Fallback)**
- If no USGS images available, generates map using:
  - Mapbox Static API (if coordinates available)
  - OpenStreetMap StaticMap (fallback)
- Adds epicenter marker at earthquake location
- Uses satellite imagery for better visual appeal

**Step 4: Create Text Overlay**
- Generates SVG with dynamic text positioning:
  - Line 1: "Breaking News:" (white, bold)
  - Line 2: "M6.5 EARTHQUAKE NEAR" (magnitude in red, rest in white)
  - Line 3: "WATSONVILLE, CALIFORNIA" (red, bold, all caps)
- Uses embedded Roboto fonts (base64) for consistent rendering
- Auto-scales text to fit safe area (left margin to 58% width)
- Calculates precise positioning to avoid overlap

**Step 5: Composite Final Image**
- Layers: Background (USGS image or map) → Text overlay → Visual effects
- Applies 4K enhancement filter (sharpening, contrast boost)
- Adds subtle flash effect (pulsing white glow)
- Adds roundabout animation (rotating circle indicator)
- Outputs in 4K resolution (3840x2160) for social media

**Step 6: Store Image**
- Uploads to Netlify Blob storage
- Filename: `earthquake-{eventId}-{templateType}-{timestamp}.png`
- Returns public URL for use in posts and emails

### 3.3 Template System

**Base Template**: 940x788 pixels
**Output Resolution**: 3840x2160 (4K UHD)

**Text Positioning Constants:**
- Anchor X: 50px
- Headline baseline Y: 200px (100 base + 100 offset)
- Location offset: 75px below headline
- Safe left margin: 40px
- Safe right boundary: 58% of width

**Font Sizes:**
- Headline base: 65px (scaled for 4K)
- Magnitude: 95% of headline size
- Location: 50px (min 42px, auto-scaled if needed)

**Colors:**
- Breaking News text: #FFFFFF (white)
- Magnitude: #FF0000 (red)
- Location: #FF0000 (red)
- Background: USGS image or generated map

---

## PART 4: ADVANCED ASSESSMENTS

### 4.1 Impact Assessment

**Location**: `netlify/functions/lib/impactAssessment.js`

**What it does**: Analyzes potential human and infrastructure impact

**Data Sources:**
1. **Population Data** (OpenStreetMap Overpass API):
   - Finds cities/towns within affected radius
   - Estimates population based on place type
   - Calculates total affected population

2. **Infrastructure** (OpenStreetMap Overpass API):
   - Hospitals and clinics
   - Schools and universities
   - Airports
   - Power plants
   - Dams

3. **Historical Context** (USGS Historical Database):
   - Similar earthquakes in region (last 100 years)
   - Largest earthquake in region
   - Recent similar events

**Risk Score Calculation** (0-100):
- Magnitude component: 0-40 points
- Depth component: 0-20 points (shallower = more dangerous)
- Population component: 0-20 points
- Infrastructure component: 0-20 points

**Severity Levels:**
- 80-100: Extreme
- 60-79: High
- 40-59: Moderate
- 20-39: Low
- 0-19: Minimal

**Output:**
```javascript
{
  magnitude: 6.5,
  depth: 10.5,
  location: { lat: 36.9102, lon: -121.7569 },
  affectedRadius: 97,  // km
  population: {
    total: 125000,
    cities: [{ name: "Watsonville", estimatedPopulation: 50000 }, ...],
    areaKm2: 29500
  },
  infrastructure: {
    hospitals: 3,
    schools: 12,
    airports: 1,
    powerPlants: 0,
    facilities: [...]
  },
  historical: {
    similarCount: 5,
    largestSimilar: { magnitude: 7.1, time: "...", location: "..." },
    recentSimilar: [...]
  },
  risk: {
    score: 65,
    severity: "High",
    level: "high"
  }
}
```

### 4.2 Tsunami Risk Assessment

**Location**: `netlify/functions/lib/tsunamiAssessment.js`

**What it does**: Evaluates tsunami risk based on earthquake characteristics

**Factors:**
- Magnitude (≥7.0 = higher risk)
- Depth (shallow = higher risk, especially <30km)
- Location (oceanic/coastal = higher risk)
- Distance to coastline (calculated using Overpass API)
- Historical tsunami events in region

**Calculation Process:**
1. Calculates distance to nearest coastline using OpenStreetMap Overpass API
2. Determines if earthquake is oceanic (depth < 30km suggests oceanic)
3. Estimates tsunami travel time to coastline (average speed ~360 km/h)
4. Calculates risk score based on magnitude, depth, and location

**Risk Levels:**
- HIGH: M≥7.5, depth<30km, oceanic
- MODERATE: M≥7.0, depth<50km, coastal
- LOW: M≥6.5, depth<70km, near coast
- MINIMAL: Otherwise

**Output:**
```javascript
{
  riskLevel: "HIGH",
  riskScore: 85,
  factors: {
    magnitude: 7.5,
    depth: 15,
    isOceanic: true,
    distanceToCoastline: 50,  // km
    tsunamiTravelTime: 0.14   // hours
  },
  warning: "HIGH TSUNAMI RISK - Evacuation may be necessary"
}
```

### 4.3 Aftershock Prediction

**Location**: `netlify/functions/lib/aftershockModeling.js`

**What it does**: Predicts likelihood and magnitude of aftershocks

**Model**: Based on Omori's Law and Bath's Law

**Key Principles:**
- **Bath's Law**: Largest aftershock is typically ~1.2 magnitude units smaller than main shock
- **Omori's Law**: Aftershock frequency decreases with time (exponential decay)
- **Empirical Relationships**: Based on historical earthquake statistics

**Probability Calculation:**
- Base probability depends on magnitude:
  - M≥7.0: 95% base probability
  - M≥6.0: 85% base probability
  - M≥5.0: 70% base probability
  - M<5.0: 50% base probability
- Time decay factor: Probability decreases over 7 days
- 24h probability: Base × max(0.8, timeDecay)
- 7d probability: Base × max(0.4, timeDecay × 0.7)

**Count Estimation:**
- Uses logarithmic relationship: log₁₀(N) ≈ 3.5 - 0.5×M
- Distribution:
  - ~30% of aftershocks in first 24 hours
  - ~50% in first 48 hours
  - ~80% in first week

**Output:**
```javascript
{
  probability24h: 85,                // 85% chance (as percentage)
  probability48h: 80,                // 80% chance in 48h
  probability7d: 95,                  // 95% chance in 7 days
  expectedLargestAftershock: 5.4,    // Expected magnitude (M - 1.2)
  expectedCount24h: 12,               // Expected number in 24h
  expectedCount48h: 20,               // Expected number in 48h
  expectedCount7d: 45,                // Expected number in 7 days
  expectedTotal: 56,                  // Total expected aftershocks
  confidence: "MEDIUM",               // HIGH, MEDIUM, or LOW
  forecast: "⚠️ HIGH PROBABILITY: There is a 85% chance...",
  recommendation: "Be prepared for aftershocks..."
}
```

### 4.4 Anomaly Detection

**Location**: `netlify/functions/lib/anomalyDetection.js`

**What it detects:**
1. **Earthquake Swarms**: Unusual clusters of earthquakes
   - Normal: 1-5 per day in active regions
   - Swarm: >10 in 24h or >5 in 6h

2. **Unusual Magnitude**: Larger than typical for region
   - Compares to historical data (last 10 years)
   - Flags if within 0.5 magnitude of largest in region

3. **Aftershock Sequences**: Part of ongoing sequence
   - Checks for larger earthquakes in same region (past 7 days)
   - Identifies main shock vs aftershock

**Anomaly Score**: 0-100 (higher = more anomalous)

**Output:**
```javascript
{
  anomalies: [
    { type: "swarm", severity: "moderate", description: "..." },
    { type: "unusual_magnitude", severity: "high", description: "..." }
  ],
  anomalyLevel: "HIGH",  // HIGH, MODERATE, LOW, NONE
  anomalyScore: 75
}
```

---

## PART 5: POST CREATION & STORAGE

### 5.1 Post Creation

**Location**: `netlify/functions/lib/createPost.js` - `createPostFromEvent()`

**Process:**
1. Generates post ID: `eq-{eventId}` or `{canonical_id}`
2. Checks if post already exists in Netlify Blob storage
3. Creates post object with all metadata
4. Stores in `x-posts` blob store
5. Updates index.json (list of all post IDs)

**Post Structure:**
```javascript
{
  id: "eq-us7000xxxxx",
  title: "M6.5 Earthquake Near WATSONVILLE, CALIFORNIA",
  story: "A magnitude 6.5 earthquake was detected...",
  text: "A magnitude 6.5 earthquake was detected...",
  primary_image_url: "https://...",  // Canonical primary image
  image: "https://...",               // Legacy compatibility
  image_url: "https://...",           // Legacy compatibility
  video_url: "https://...",           // Social media video (if generated)
  images: [...],                      // Secondary images (excludes primary)
  secondary_images: [...],            // Same as images
  link: "https://earthquake.usgs.gov/...",
  url: "https://earthquake.usgs.gov/...",
  datePosted: "2025-01-15T10:30:00Z",
  createdAt: "2025-01-15T10:30:00Z",
  category: "Earthquake",
  source: "USGS",
  location: "WATSONVILLE, CALIFORNIA",
  location_display: "WATSONVILLE, CALIFORNIA",
  eventId: "usgs:us7000xxxxx",
  severity: "moderate",
  event_type: "earthquake",
  lat: 36.9102,
  lon: -121.7569,
  magnitude: 6.5,
  assets: {...}  // Full assessment data
}
```

**Storage:**
- Primary: Netlify Blob storage (`x-posts` store)
- Key format: `post-{postId}.json`
- Index: `index.json` contains array of all post IDs (max 200)

### 5.2 Video Generation (Optional)

**Location**: `netlify/functions/generate-earthquake-video.js`

**Trigger**: Only for earthquakes M≥4.0

**Purpose**: Creates animated video for social media previews

**Process:**
- Generates animated GIF or MP4
- Includes visual effects (flash, pulse, text animations)
- Stores in blob storage
- URL stored in `video_url` field

---

## PART 6: EMAIL ALERTS

### 6.1 Alert Triggering

**Location**: `netlify/functions/engines/usgs.js` - `sendEmailAlert()`

**Conditions for Sending:**
1. New earthquake (not in database)
2. Alert not sent yet (`alert_sent = false`)
3. New image generated (image was added after initial processing)

**Duplicate Prevention:**
- Checks `alert_sent` flag before sending
- Marks as sent immediately after successful send
- Never re-sends unless new image is available

### 6.2 Email Generation

**Location**: `netlify/functions/send-earthquake-alert.js`

**Email Content:**
- Subject: "BREAKING: M6.5 Earthquake Near WATSONVILLE, CALIFORNIA"
- Body includes:
  - Magnitude and location
  - Time (formatted in ET timezone)
  - USGS event link
  - Impact assessment summary
  - Tsunami risk (if applicable)
  - Aftershock forecast
  - Anomaly alerts (if any)
  - Map image (if coordinates available)
  - Branded earthquake image (attached)
  - Share text with hashtags

**Hashtags**: Language-specific based on location
- Spanish regions: #terremoto
- Japanese regions: #地震
- Chinese regions: #地震
- French regions: #séisme
- Turkish regions: #deprem
- Plus location-specific tags

**Recipients:**
- `ALERT_TO_EMAIL`: Primary alert email
- `AI_NOTIFICATION_EMAILS`: Comma-separated list or JSON array

**Email Service**: Resend API

---

## PART 7: UI DISPLAY

### 7.1 Situation Monitor Panel

**Location**: `src/components/situation-monitor/Panels/EarthquakePanel.js`

**What it shows:**
- List of recent earthquakes (M≥4.5, last 24 hours)
- Sorted by magnitude (highest first)
- Displays: Magnitude, time, location, depth, USGS link
- Auto-refreshes every minute

**Data Source**: `src/components/situation-monitor/data/fetchers.js` - `fetchEarthquakes()`
- Fetches from USGS feed: `{magnitude}_day.geojson`
- Parses GeoJSON into structured format
- Caches results

### 7.2 Post Feed Display

**Location**: `src/components/post-feed-enhanced.js` and related components

**How posts appear:**
- Card deck layout
- Shows primary image (`primary_image_url` or `image`)
- Displays title, location, magnitude
- Links to USGS event page
- Category badge: "Earthquake"
- Source badge: "USGS"

---

## PART 8: SCHEDULING & AUTOMATION

### 8.1 Scheduled Functions

**Netlify Configuration**: `netlify.toml`

**Functions:**
1. **USGS Engine** (`netlify/functions/engines/usgs.js`):
   - Runs every 3 minutes
   - Fetches `all_hour` feed
   - Processes all earthquakes
   - Creates posts and sends alerts

2. **USGS Image Retry** (`netlify/functions/retry-usgs-images.js`):
   - Runs every minute
   - Checks earthquakes M≥6.0 that don't have USGS images yet
   - Retries image extraction (images may take 5-15 min to appear)
   - Regenerates branded image when USGS images become available
   - **Retry Logic**:
     - Finds events with `assets.usgs_retry_pending = true`
     - Maximum 30 retries (30 minutes)
     - Fetches event detail and extracts images
     - If images found: Regenerates branded image, updates post, marks as complete
     - If max retries reached: Stops retrying, marks as stopped

3. **Legacy Poller** (`netlify/functions/earthquake-poller.js`):
   - Backup/legacy system
   - Similar to USGS engine but uses blob storage instead of Supabase

### 8.2 Processing Flow

```
1. Scheduled function triggers (every 3 min)
   ↓
2. Fetch USGS feed (all_hour.geojson)
   ↓
3. For each earthquake in feed:
   a. Check if already processed (canonical_id lookup)
   b. If new:
      - Extract location and normalize
      - Fetch event detail (for images)
      - Extract USGS product images
      - Generate branded image
      - Run impact assessment
      - Run tsunami assessment
      - Run aftershock prediction
      - Run anomaly detection
      - Store in verified_events table
      - Create post in blob storage
      - Send email alert
   c. If existing:
      - Check for new images
      - Update if new data available
      - Regenerate image if USGS images now available
```

---

## PART 9: IMAGE RETRY SYSTEM

### 9.1 Why Retry is Needed

**Problem**: USGS product images (especially shakemaps) can take 5-15 minutes to appear after an earthquake is detected. The initial processing may find no images available.

**Solution**: Automatic retry system for high-magnitude earthquakes (M≥6.0)

### 9.2 Retry Process

**Location**: `netlify/functions/retry-usgs-images.js`

**Trigger**: Runs every minute via scheduled function

**Process:**
1. **Find Pending Events**:
   - Queries Supabase for events with `assets.usgs_retry_pending = true`
   - Filters for M≥6.0 earthquakes
   - Checks retry count (max 30 retries = 30 minutes)

2. **For Each Pending Event**:
   - Fetches event detail GeoJSON (using stored `usgs_detail_url`)
   - Extracts USGS product images
   - If images found:
     - Regenerates branded image with real USGS data
     - Updates event in database with new image
     - Updates website post with new image
     - Marks `usgs_retry_pending = false`
   - If no images yet:
     - Increments retry count
     - Continues checking next minute
   - If max retries reached:
     - Stops retrying
     - Marks as stopped (keeps fallback map image)

3. **Image Update Flow**:
   - New branded image replaces fallback map
   - Post is updated (not recreated)
   - Email is NOT re-sent (prevents spam)

**Marking for Retry:**
- Happens automatically in main processing if:
  - Magnitude ≥ 6.0
  - No USGS images found initially
  - Detail URL is available
- Sets in `assets`:
  ```javascript
  {
    usgs_retry_pending: true,
    usgs_retry_started_at: "2025-01-15T10:30:00Z",
    usgs_retry_count: 0,
    usgs_detail_url: "https://..."
  }
  ```

**Benefits:**
- Ensures high-magnitude earthquakes get real USGS data when available
- Automatically upgrades from fallback maps to real shakemaps
- No manual intervention needed
- Prevents duplicate emails (only updates images)

---

## PART 10: ERROR HANDLING & RESILIENCE

### 9.1 Image Download Failures

**Handling:**
- Retries up to 5 times with exponential backoff
- Falls back to location map if USGS images unavailable
- Validates images (magic bytes, content-type)
- Logs detailed error information

### 9.2 API Failures

**USGS API:**
- Graceful degradation if feed unavailable
- Continues processing other earthquakes
- Logs errors but doesn't crash

**Assessment APIs:**
- Uses `Promise.allSettled()` to continue even if one fails
- Returns null/empty data if assessment fails
- Doesn't block post creation

### 9.3 Database Failures

**Supabase:**
- Retries on transient errors
- Logs errors but continues processing
- Preserves `alert_sent` status on updates

### 9.4 Email Failures

**Resend API:**
- Logs errors but doesn't crash pipeline
- Marks `alert_sent` only on success
- Allows retry on next run if failed

---

## PART 11: DATA FLOW SUMMARY

```
USGS Feed (GeoJSON)
    ↓
[Fetch Feed] (every 3 min)
    ↓
[Parse Features]
    ↓
[For Each Earthquake]
    ├─→ [Check if Exists] (canonical_id)
    ├─→ [Normalize Location] (clean + geocode)
    ├─→ [Fetch Event Detail] (for images)
    ├─→ [Extract USGS Images] (from products)
    ├─→ [Generate Branded Image] (with fallback map)
    ├─→ [Impact Assessment] (population, infrastructure)
    ├─→ [Tsunami Assessment] (risk evaluation)
    ├─→ [Aftershock Prediction] (forecast)
    ├─→ [Anomaly Detection] (swarms, unusual patterns)
    ├─→ [Store Event] (Supabase verified_events)
    ├─→ [Create Post] (Netlify Blob storage)
    └─→ [Send Email Alert] (Resend API)
```

---

## KEY ARCHITECTURAL DECISIONS

1. **Event-Locked Images**: Only uses GeoJSON detail products, no HTML scraping (prevents cross-event contamination)

2. **Dual Storage**: 
   - Supabase for event data (searchable, relational)
   - Netlify Blob for posts (fast, CDN-backed)

3. **Assessment Pipeline**: Runs in parallel, doesn't block post creation

4. **Image Generation Threshold**: Only generates images for M≥0.5 (configurable)

5. **Alert Deduplication**: Multiple checks prevent duplicate emails

6. **Retry System**: Separate function retries image extraction for large earthquakes

7. **4K Output**: All images generated in 4K for social media quality

8. **Language-Aware Hashtags**: Automatically selects relevant hashtags based on location

---

## CONFIGURATION & ENVIRONMENT VARIABLES

**Required:**
- `NETLIFY_SITE_ID`: Netlify site ID (auto-set)
- `NETLIFY_BLOB_READ_WRITE_TOKEN`: Blob storage token (auto-set)
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `RESEND_API_KEY`: Resend API key for emails
- `ALERT_TO_EMAIL`: Primary alert recipient
- `AI_NOTIFICATION_EMAILS`: Additional recipients (comma-separated or JSON)

**Optional:**
- `MAPBOX_ACCESS_TOKEN`: For location map generation (fallback to OSM)
- `DRY_RUN`: Set to "true" to skip actual operations (testing)
- `EARTHQUAKE_TEST_MODE`: Enable test mode in legacy poller

---

## TESTING & DEBUGGING

**Test Files:**
- `test-full-earthquake-pipeline.js`: End-to-end pipeline test
- `test-earthquake-image.js`: Image generation test
- `test-earthquake-visual.js`: Visual output test
- `test-last-earthquake.js`: Latest earthquake fetch test

**Debugging:**
- Extensive logging throughout pipeline
- Forensic logging for image tracking (SHA1 hashes)
- Event binding verification (ensures images match events)

---

This system is highly complex with many moving parts, but it's designed to be resilient, accurate, and provide comprehensive earthquake information to users.
