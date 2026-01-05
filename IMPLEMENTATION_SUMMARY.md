# Implementation Summary: USGS Image Fix

## Files Changed

1. **netlify/functions/engines/usgs.js**
   - Added `fetchUsgsDetailGeoJson()` - Primary method for fetching GeoJSON detail
   - Added `extractUsgsProductImages()` - New extraction method using products.contents
   - Updated `extractUSGSImages()` - Legacy wrapper that uses new method internally
   - Exported new functions

2. **netlify/functions/generate-earthquake-image.js**
   - Updated `downloadImage()` - Enhanced logging, better validation, fails on HTML/JSON
   - Added `renderFallbackMapPng()` - Server-side map generation (no DNS dependency)
   - Added `buildTwoImageSources()` - Guarantees exactly 2 images (USGS or fallback)
   - Updated `generateImage()` - Now accepts eventId/detailUrl, fetches GeoJSON internally
   - Updated HTTP handler - Accepts eventId/detailUrl instead of usgsImages

3. **netlify/functions/generate-earthquake-video.js**
   - Updated `generateVideoFrames()` - Uses new signature (eventId/detailUrl)
   - Updated HTTP handler - Accepts eventId/detailUrl instead of usgsImages

## Key Changes

### Phase 1: GeoJSON Product Extraction (PRIMARY METHOD)
- **Replaced HTML scraping** with GeoJSON detail endpoint extraction
- Extracts images from `properties.products[productType][].contents` 
- Priority order: shakemap > dyfi > losspager/pager > others
- Path preference: intensity > mmi > pga > pgv > map > plot
- Returns top 6 candidates (we only need 2, but want fallback options)

### Phase 2: Enhanced Download Reliability
- Detailed logging: URL, attempt #, status, content-type, buffer size
- Fails if content-type is text/html or application/json
- Validates magic bytes (PNG/JPEG/GIF/WebP)
- Increased retries from 3 to 5

### Phase 3: Fallback Map (No DNS Dependency)
- **Removed dependency on staticmap.openstreetmap.de**
- New `renderFallbackMapPng()` generates maps server-side using Sharp
- Creates gradient background + pin icon + location text + coordinates
- No external network calls required

### Phase 4: Guarantee 2 Images Always
- `buildTwoImageSources()` ensures exactly 2 images:
  1. Try USGS images in priority order (up to 2)
  2. Fill remaining slots with fallback maps
  3. If only 1 image, duplicate it
  4. If 0 images, create 2 generic fallback maps

### Phase 5 & 6: Updated Function Signatures
- `generateImage()` now accepts: `(magnitude, location, eventId, templateType, coordinates, detailUrl)`
- Fetches GeoJSON detail internally and extracts products
- All callers updated to use new signature

## Testing

The test script (`test-full-pipeline-local.js`) needs to be updated to:
1. Use new function signatures
2. Test with known event that has products (TEST MODE A)
3. Test with recent event without products (TEST MODE B)

## Next Steps

1. Update test script with two test modes
2. Test locally to verify:
   - GeoJSON extraction works
   - 2 images always appear
   - Fallback maps work without DNS
   - Logging explains why 0 images if that happens

