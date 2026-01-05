# DEBUG PACKET: Wrong USGS Images (India Maps for LA Events)

## 1) ROUTE + ENTRYPOINTS

### PNG Generation
- **File**: `netlify/functions/generate-earthquake-image.js`
- **Handler**: `exports.handler` (line 1756)
- **Direct Export**: `exports.generateImage` (line 1634)
- **HTTP Endpoint**: `POST /.netlify/functions/generate-earthquake-image`
- **Called From**: 
  - Direct: `netlify/functions/engines/usgs.js:870` (`generateBrandedImage` → `generateImage`)
  - HTTP: `netlify/functions/engines/usgs.js:924` (fallback HTTP call)

### GIF/Video Generation
- **File**: `netlify/functions/generate-earthquake-video.js`
- **Handler**: `exports.handler` (line 475)
- **Direct Export**: `exports.generateVideoFrames` (line 468)
- **HTTP Endpoint**: `POST /.netlify/functions/generate-earthquake-video`
- **Called From**: `netlify/functions/engines/usgs.js:1456` (HTTP call)

---

## 2) INPUTS PER REQUEST

### PNG Function (`generate-earthquake-image.js`)

**Direct Call Signature:**
```javascript
generateImage(magnitude, location, eventId, templateType = 'standard', coordinates = null, detailUrl = null)
```

**HTTP Request Body:**
```json
{
  "magnitude": 1.33,
  "location": "Los Angeles, California",
  "usgsImages": [],  // ⚠️ IGNORED - function now fetches internally
  "eventId": "ci41152183",
  "coordinates": [-118.2437, 34.0522]  // [lon, lat]
}
```

**Upstream Source:**
- **File**: `netlify/functions/engines/usgs.js`
- **Function**: `processEarthquake()` (line ~1300)
- **Extracts**: 
  - `eventId` from `feature.id`
  - `detailUrl` from `feature.properties.detail` (line 1303)
  - `coordinates` from `feature.geometry.coordinates` (line 1318)
  - `magnitude` from `feature.properties.mag`
  - `location` from geocoded location
- **Calls**: `generateBrandedImage(magnitude, locationDisplay, usgsImages, eventId, logger, coordinates, detailUrl)` (line 1430)
- **Note**: `usgsImages` parameter is **PASSED BUT IGNORED** - function fetches internally via `buildTwoImageSources()`

### GIF Function (`generate-earthquake-video.js`)

**HTTP Request Body:**
```json
{
  "magnitude": 4.0,
  "location": "Los Angeles, California",
  "eventId": "ci41152183",
  "lat": 34.0522,
  "lon": -118.2437,
  "usgsImages": []  // ⚠️ IGNORED - function now fetches internally
}
```

**Upstream Source:**
- **File**: `netlify/functions/engines/usgs.js`
- **Function**: `processEarthquake()` (line 1456)
- **Extracts**: Same as PNG, but converts `coordinates` to `{lat, lon}` object
- **Calls**: HTTP POST to `/.netlify/functions/generate-earthquake-video`

**⚠️ CRITICAL ISSUE**: Video handler converts `{lat, lon}` to `[lon, lat]` array (line 479), but this conversion may be incorrect.

---

## 3) EVENT LOCKING PROOF

### GeoJSON Event ID Verification
**Location**: `netlify/functions/generate-earthquake-image.js:651-659`

```javascript
// HARD EVENT BINDING: Verify GeoJSON is for the same eventId
const geoJsonEventId = detailJson.id || detailJson.properties?.ids?.split(',')[0]?.trim();
if (geoJsonEventId && eventId && !geoJsonEventId.includes(eventId) && !eventId.includes(geoJsonEventId.replace(/^(us|ak|ci|nc|nn|pr|tx|hv|mb|se|uw)/i, ''))) {
  logger.error(`❌ CRITICAL: GeoJSON eventId mismatch! Request: ${eventId}, GeoJSON: ${geoJsonEventId}`);
  logger.error(`❌ REJECTING ALL USGS IMAGES - will use fallback maps`);
  detailJson = null; // Force fallback
} else {
  logger.info(`✅ Event binding verified: eventId=${eventId}, geoJsonId=${geoJsonEventId}`);
}
```

**⚠️ POTENTIAL BUG**: The verification logic uses `includes()` which is too loose. For example:
- `eventId = "ci41152183"`
- `geoJsonEventId = "us7000rmhe"` 
- `"us7000rmhe".includes("ci41152183")` = `false` ✅ (correctly rejects)
- But: `"ci41152183".includes("ci411")` = `true` (could match wrong event)

**Better check needed**: Exact match or proper prefix matching.

### URL Event Binding Check
**Location**: `netlify/functions/generate-earthquake-image.js:607-626`

```javascript
function verifyEventBinding(url, eventId) {
  if (!url || !eventId) return false;
  const urlLower = url.toLowerCase();
  const eventIdLower = eventId.toLowerCase();
  
  // Check if URL contains eventId in path
  if (urlLower.includes(`/${eventIdLower}/`) || 
      urlLower.includes(`/${eventIdLower}.`) ||
      urlLower.includes(`eventpage/${eventIdLower}`) ||
      (urlLower.includes(`product/`) && urlLower.includes(eventIdLower))) {
    return true;
  }
  
  return false;
}
```

**⚠️ POTENTIAL BUG**: The check `urlLower.includes(eventIdLower)` is too loose. If:
- `eventId = "ci41152183"`
- `url = ".../ci41152183/..."` ✅ (correct)
- But: `url = ".../ci411/..."` would also match ❌ (wrong)

**Better check needed**: Require exact eventId match in path segment.

---

## 4) IMAGE SELECTION PIPELINE

### Step 1: Fetch GeoJSON Detail
**Location**: `netlify/functions/generate-earthquake-image.js:883-910`

```javascript
async function fetchUsgsDetailGeoJson({ eventId, detailUrl, logger }) {
  let url = detailUrl;
  if (!url && eventId) {
    url = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/${eventId}.geojson`;
  }
  // ... fetch and return JSON
}
```

**Called From**: `buildTwoImageSources()` (line 648)

### Step 2: Extract Product Images
**Location**: `netlify/functions/engines/usgs.js:102-208` (exported)
**Also**: `netlify/functions/generate-earthquake-image.js:912-1007` (inline duplicate)

```javascript
function extractUsgsProductImages(detailJson) {
  const candidates = [];
  const products = detailJson.properties.products;
  
  // Priority order: shakemap > dyfi > losspager/pager > others
  const productPriority = {
    'shakemap': 1,
    'dyfi': 2,
    'losspager': 3,
    'pager': 3,
    'origin': 4,
    'location': 4,
    'moment-tensor': 5,
    'focal-mechanism': 5
  };
  
  // Path preference: intensity, mmi, pga, pgv, map, plot
  const pathPreference = ['intensity', 'mmi', 'pga', 'pgv', 'map', 'plot'];
  
  // For each product type
  for (const [productType, productList] of Object.entries(products)) {
    const priority = productPriority[productType] || 999;
    
    for (const product of productList) {
      const preferredWeight = product.preferredWeight || 0;
      const updateTime = product.updateTime || 0;
      
      // Extract all image contents
      for (const [path, content] of Object.entries(product.contents)) {
        if (!isImageContent(content)) continue;  // Checks contentType and URL extension
        
        // Calculate score: priority * 1000 - pathScore * 10 - preferredWeight
        const pathScore = scorePath(path);
        const candidateScore = priority * 1000 - pathScore * 10 - preferredWeight;
        
        candidates.push({
          url: content.url,
          contentType: content.contentType || 'image/jpeg',
          productType: productType,
          path: path,
          updateTime: updateTime,
          weight: preferredWeight,
          score: candidateScore,
          productId: product.id
        });
      }
    }
  }
  
  // Sort by score (lower = better), then by updateTime (newer first)
  candidates.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return b.updateTime - a.updateTime;
  });
  
  return candidates.slice(0, 6);  // Return top 6
}
```

**⚠️ CRITICAL**: This function does NOT verify that URLs contain the eventId. It trusts the GeoJSON structure.

### Step 3: Filter by Event Binding
**Location**: `netlify/functions/generate-earthquake-image.js:668-680`

```javascript
// HARD EVENT BINDING: Filter candidates to only those with eventId in URL
const originalCount = usgsCandidates.length;
usgsCandidates = usgsCandidates.filter(candidate => {
  const isBound = verifyEventBinding(candidate.url, eventId);
  if (!isBound) {
    logger.warn(`⚠️ REJECTED candidate (no eventId in URL): ${candidate.url.substring(0, 100)}`);
  }
  return isBound;
});
```

### Step 4: Download Top Candidates
**Location**: `netlify/functions/generate-earthquake-image.js:710-750`

- Downloads top 4 candidates (maxCandidatesToDownload = 4)
- Picks first 2 successful downloads
- Each download is validated with `verifyEventBinding()` again (line 715)

---

## 5) CACHING / REUSE

### Netlify Blobs Storage (Generated Images)
**Location**: `netlify/functions/generate-earthquake-image.js:1644-1751`

```javascript
async function storeImage(imageBuffer, eventId, templateType = 'standard') {
  const imageKey = `earthquake-${eventId}-${templateType}-${Date.now()}.png`;
  // ... stores to "post-media" store
}
```

**✅ Cache Key Includes eventId**: `earthquake-${eventId}-${templateType}-${timestamp}.png`

### Video Storage
**Location**: `netlify/functions/generate-earthquake-video.js:413-450`

```javascript
async function storeVideo(videoBuffer, eventId) {
  const videoKey = `earthquake-${eventId}-video-${Date.now()}.gif`;
  // ... stores to "post-media" store
}
```

**✅ Cache Key Includes eventId**: `earthquake-${eventId}-video-${timestamp}.gif`

### USGS Image Download Cache
**Location**: `netlify/functions/generate-earthquake-image.js:344-445`

**❌ NO CACHING**: The `downloadImage()` function does NOT cache downloaded buffers. Each request downloads fresh.

**⚠️ POTENTIAL ISSUE**: If the same URL is downloaded multiple times (e.g., for PNG and GIF), it's downloaded twice. But this shouldn't cause cross-event contamination.

### In-Memory Caches
**Searched for**: `Map()`, `cache`, `store.set`, `store.get`

**Result**: 
- ✅ No in-memory caches found for USGS images
- ✅ No module-level caches found
- ✅ Only Netlify Blobs storage (which includes eventId in key)

---

## 6) GLOBAL / MODULE-LEVEL STATE

**Location**: `netlify/functions/generate-earthquake-image.js:17-18`

```javascript
let FONT_DATA = null;
let FONT_BUFFERS = { regular: null, bold: null };
```

**✅ SAFE**: These are font data, not event-specific. They're loaded once and reused.

**Searched for**: `lastEventId`, `lastImages`, `global.*`, module-level `let/const` caches

**Result**: 
- ✅ No `lastEventId` found
- ✅ No `lastImages` found
- ✅ No `global.*` state found
- ✅ No module-level caches found

**Conclusion**: No state leakage possible from module-level variables.

---

## 7) DOWNLOADER DETAILS

**Location**: `netlify/functions/generate-earthquake-image.js:344-445`

```javascript
async function downloadImage(url, retries = 5) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/png,image/jpeg,image/gif,image/webp,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://noteworthynews.co/'
        }
      });
      
      // Validate content-type
      if (contentType.includes('text/html') || contentType.includes('application/json')) {
        throw new Error(`Expected image but got ${contentType}`);
      }
      
      // Validate magic bytes (PNG, JPEG, GIF, WebP)
      const bytes = new Uint8Array(arrayBuffer);
      const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
      // ... (JPEG, GIF, WebP checks)
      
      if (!isPNG && !isJPEG && !isGIF && !isWebP) {
        throw new Error(`Invalid image format (magic bytes: ${magicBytes})`);
      }
      
      return buffer;
    } catch (error) {
      // Retry with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return null;
}
```

**Current Logging**:
- ✅ URL (first 100 chars)
- ✅ Attempt number
- ✅ HTTP status
- ✅ Content-type
- ✅ Buffer size
- ✅ Format (PNG/JPEG/GIF/WebP)

**Missing Logging** (needs to be added):
- ❌ Buffer hash (SHA1 first 8 chars)

**Redirect Handling**: 
- ❌ NOT EXPLICIT: Uses default `fetch()` behavior (follows redirects automatically)

**⚠️ POTENTIAL ISSUE**: If USGS redirects to a different event's image, `fetch()` will follow it without validation.

---

## 8) COMPOSITING DETAILS

**Location**: `netlify/functions/generate-earthquake-image.js:1408-1457`

```javascript
// PHASE 4: Add exactly 2 images to composite
for (let i = 0; i < imageSources.length; i++) {
  const source = imageSources[i];
  const x = IMAGE_PADDING + (i * (imageWidth + IMAGE_SPACING));
  const y = IMAGE_AREA_Y;
  
  compositeInputs.push({
    input: source.buffer,  // ✅ Uses buffer from buildTwoImageSources()
    left: x,
    top: y,
    blend: 'over',
  });
  
  if (source.type === 'usgs') {
    usgsImageCount++;
  } else {
    locationMapCount++;
  }
}
```

**Image Sources**: 
- ✅ Always exactly 2 images (guaranteed by `buildTwoImageSources()`)
- ✅ Sources come from `buildTwoImageSources()` which validates event binding
- ✅ Buffers are fresh downloads (not cached)

**⚠️ VERIFICATION NEEDED**: Confirm that `imageSources[0]` and `imageSources[1]` are actually the buffers selected by `buildTwoImageSources()` and not replaced elsewhere.

---

## 9) MISMATCH DETECTION / RETRY LOGIC

**Searched for**: `mismatch`, `retry`, `coordinate.*match`, `validate.*coordinate`

**Result**: 
- ✅ **NO POST-GENERATION MISMATCH DETECTION**: The old coordinate validation code was removed.
- ✅ **NO RETRY LOOP**: There's no retry with different images after generation.
- ✅ **PRE-VALIDATION ONLY**: Event binding is checked before downloading (lines 668-680, 715-718).

**Conclusion**: The system does NOT generate and then check for mismatches. It validates before compositing.

---

## 10) REPRO STEPS + LOGS

### Current Logging Structure

**Render Request Log** (line 1000):
```javascript
console.log(`[generate-earthquake-image] 🔍 FORENSIC: Render request:`, {
  eventId,
  detailUrl,
  coordinates: { lat, lon },
  magnitude,
  location,
  timestamp: new Date().toISOString()
});
```

**Products Present Log** (line 690):
```javascript
logger.info(`[buildTwoImageSources] 📦 FORENSIC: Products present:`, {
  eventId,
  detailUrl,
  coordinates: { lat, lon },
  productKeys,
  productCounts,
  candidateCount: usgsCandidates.length,
  topCandidates: usgsCandidates.slice(0, 6).map(c => ({
    url: c.url,
    productType: c.productType,
    path: c.path,
    updateTime: c.updateTime,
    eventIdInUrl: verifyEventBinding(c.url, eventId)
  }))
});
```

**Final Selected Images Log** (line 843):
```javascript
logger.info(`[buildTwoImageSources] ✅ FORENSIC: Final selected images:`, {
  eventId,
  detailUrl,
  coordinates: { lat, lon },
  selectedImages: finalImages,  // Includes bufferHash, url, productType, path, cacheKey
  usgsCount,
  fallbackCount,
  totalSources
});
```

**Final Composition Log** (line 1453):
```javascript
console.log(`[generate-earthquake-image] 🔍 FORENSIC: Final image composition:`, {
  eventId,
  detailUrl,
  coordinates: { lat, lon },
  totalImages: imageSources.length,
  usgsImages: usgsImageCount,
  locationMaps: locationMapCount,
  selectedImages: finalSelectedImages  // Includes bufferHash for each
});
```

### Missing Logging (Needs to be Added)

1. **Download Logging**: Add buffer hash to `downloadImage()` (line 408)
2. **GeoJSON Fetch Logging**: Log the actual GeoJSON `id` field when fetched (line 904)
3. **Event Binding Verification Log**: Log when candidates are filtered (line 670)

---

## 11) OUTPUT: ROOT CAUSE ANALYSIS

### Files Inspected
1. `netlify/functions/generate-earthquake-image.js`
2. `netlify/functions/generate-earthquake-video.js`
3. `netlify/functions/engines/usgs.js`

### Most Likely Root Causes (Ranked)

#### 1. **LOOSE EVENT BINDING VERIFICATION** (HIGH PROBABILITY)
**Issue**: The `verifyEventBinding()` function uses `includes()` which is too loose:
- `"ci41152183".includes("ci411")` = `true` (could match wrong event)
- `url.includes(eventId)` without requiring exact path segment match

**Fix**: Require exact eventId match in path segment:
```javascript
function verifyEventBinding(url, eventId) {
  if (!url || !eventId) return false;
  const urlLower = url.toLowerCase();
  const eventIdLower = eventId.toLowerCase();
  
  // Require exact eventId in path segment (between slashes or before extension)
  const pathSegments = urlLower.split('/');
  const hasExactMatch = pathSegments.some(segment => 
    segment === eventIdLower || 
    segment.startsWith(eventIdLower + '.') ||
    segment.startsWith(eventIdLower + '-')
  );
  
  return hasExactMatch || urlLower.includes(`/eventpage/${eventIdLower}/`);
}
```

#### 2. **GEOJSON EVENT ID VERIFICATION TOO LOOSE** (MEDIUM PROBABILITY)
**Issue**: The check `geoJsonEventId.includes(eventId)` is too loose.

**Fix**: Require exact match or proper prefix:
```javascript
const geoJsonEventId = detailJson.id || detailJson.properties?.ids?.split(',')[0]?.trim();
const eventIdBase = eventId.replace(/^(us|ak|ci|nc|nn|pr|tx|hv|mb|se|uw)/i, '');
const geoJsonBase = geoJsonEventId.replace(/^(us|ak|ci|nc|nn|pr|tx|hv|mb|se|uw)/i, '');

if (geoJsonEventId && eventId && geoJsonEventId !== eventId && geoJsonBase !== eventIdBase) {
  // Reject
}
```

#### 3. **REDIRECT FOLLOWING WITHOUT VALIDATION** (LOW PROBABILITY)
**Issue**: `fetch()` automatically follows redirects. If USGS redirects to a different event's image, it's not caught.

**Fix**: Add redirect validation:
```javascript
const response = await fetch(url, {
  signal: controller.signal,
  redirect: 'manual'  // Don't follow redirects automatically
});

if (response.status === 301 || response.status === 302) {
  const redirectUrl = response.headers.get('location');
  if (!verifyEventBinding(redirectUrl, eventId)) {
    throw new Error(`Redirect URL does not contain eventId: ${redirectUrl}`);
  }
  // Follow redirect manually
  return downloadImage(redirectUrl, retries - attempt);
}
```

#### 4. **DUPLICATE FUNCTION DEFINITIONS** (LOW PROBABILITY)
**Issue**: `extractUsgsProductImages` is defined in both `engines/usgs.js` and inline in `generate-earthquake-image.js`. If the wrong one is used, it might not have event binding checks.

**Fix**: Ensure only one version is used, and it includes event binding.

---

## RECOMMENDED FIXES (Priority Order)

1. **Fix `verifyEventBinding()`** to require exact eventId match in path segment
2. **Fix GeoJSON event ID verification** to require exact match
3. **Add buffer hash logging** to `downloadImage()` for forensic tracking
4. **Add redirect validation** in `downloadImage()`
5. **Test with two different events** and verify different buffer hashes

---

## TEST PLAN

1. Generate image for LA event (`ci41152183`)
2. Generate image for India event (`us7000rmhe`)
3. Compare logs:
   - Different buffer hashes ✅
   - URLs contain correct eventId ✅
   - GeoJSON eventId matches request eventId ✅
4. If same buffer hash appears for both events → cache collision bug
5. If URLs don't contain eventId → event binding bug
6. If GeoJSON eventId doesn't match → GeoJSON fetch bug

