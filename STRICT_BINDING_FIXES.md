# Strict Event Binding Fixes - Implementation Summary

## Files Changed

1. **`netlify/functions/generate-earthquake-image.js`**
   - ✅ Replaced `verifyEventBinding()` with strict path segment matching
   - ✅ Replaced GeoJSON event ID verification with strict equality (no `includes()`)
   - ✅ Updated `downloadImage()` to accept `eventId` parameter and validate redirects
   - ✅ Removed duplicate `extractUsgsProductImages` definition (now imports from `engines/usgs.js`)
   - ✅ Removed duplicate `fetchUsgsDetailGeoJson` definition (now imports from `engines/usgs.js`)
   - ✅ Added `stripPrefix()` helper for normalized ID comparison
   - ✅ Enhanced forensic logging with strict match status

2. **`netlify/functions/engines/usgs.js`**
   - ✅ Exported `fetchUsgsDetailGeoJson` and `extractUsgsProductImages` as single source of truth

3. **`netlify/functions/generate-earthquake-video.js`**
   - ✅ Added forensic logging for coordinate conversion

## Key Changes

### 1. Strict GeoJSON Event ID Verification

**Before:**
```javascript
if (geoJsonEventId && eventId && !geoJsonEventId.includes(eventId) && !eventId.includes(...)) {
  // reject
}
```

**After:**
```javascript
function stripPrefix(id = '') {
  return id.toLowerCase().replace(/^(us|ak|ci|nc|nn|pr|tx|hv|mb|se|uw)/, '');
}

const geoId = geoJsonEventId.toLowerCase();
const reqId = eventId.toLowerCase();
const geoIdStripped = stripPrefix(geoId);
const reqIdStripped = stripPrefix(reqId);

const strictMatch = geoId === reqId || geoIdStripped === reqIdStripped;

if (!strictMatch) {
  // reject ALL USGS images
  detailJson = null;
}
```

**Result**: Only accepts exact match or prefix-stripped match. No partial matching.

### 2. Strict URL Event Binding

**Before:**
```javascript
if (urlLower.includes(`/${eventIdLower}/`) || 
    urlLower.includes(`/${eventIdLower}.`) ||
    urlLower.includes(`eventpage/${eventIdLower}`) ||
    urlLower.includes(`product/`) && urlLower.includes(eventIdLower)) {
  return true;
}
```

**After:**
```javascript
function verifyEventBinding(url, eventId) {
  if (!url || !eventId) return false;
  const u = url.toLowerCase();
  const id = eventId.toLowerCase();
  
  // Split URL into segments
  const segments = u.split(/[\/?#]/g);
  
  // STRICT: Exact segment match
  if (segments.includes(id)) return true;
  
  // Common USGS patterns
  if (u.includes(`/eventpage/${id}/`)) return true;
  if (u.includes(`/product/`) && u.includes(`/${id}/`)) return true;
  
  return false;
}
```

**Result**: Requires exact path segment match. No partial matching (e.g., `ci411` won't match `ci41152183`).

### 3. Redirect Validation

**Before:**
```javascript
const response = await fetch(url, {
  signal: controller.signal,
  // ... (follows redirects automatically)
});
```

**After:**
```javascript
const response = await fetch(url, {
  signal: controller.signal,
  redirect: 'manual',  // Don't follow automatically
  // ...
});

// Validate redirects
if ([301, 302, 303, 307, 308].includes(response.status)) {
  const redirectUrl = response.headers.get('location');
  const absoluteRedirectUrl = new URL(redirectUrl, url).toString();
  
  if (eventId && !verifyEventBinding(absoluteRedirectUrl, eventId)) {
    throw new Error(`Redirect URL not bound to eventId ${eventId}`);
  }
  
  return downloadImage(absoluteRedirectUrl, retries - attempt, eventId);
}
```

**Result**: Redirects are validated before following. If redirect URL doesn't contain eventId, download fails.

### 4. Removed Duplicate Functions

**Before:**
- `extractUsgsProductImages` defined in both `engines/usgs.js` and inline in `generate-earthquake-image.js`
- `fetchUsgsDetailGeoJson` defined in both places

**After:**
- Single source of truth: imports from `engines/usgs.js`
- Both functions exported from `engines/usgs.js`

**Result**: No duplicate code paths that could diverge.

## Enhanced Forensic Logging

### Products Present Log
Now includes:
- `eventId`: Request eventId
- `geoJsonEventId`: GeoJSON eventId
- `strictMatch`: Boolean indicating strict match passed
- `topCandidates`: Each candidate includes `urlBindingPassed` boolean

### Final Selected Images Log
Now includes:
- `strictMatch`: GeoJSON strict match status
- `selectedImages`: Each image includes `urlBindingPassed` boolean

## Expected Behavior After Fix

1. **If GeoJSON eventId doesn't match request eventId strictly**:
   - ❌ All USGS images rejected
   - ✅ Falls back to location maps
   - 📋 Logs show `strictMatch: false`

2. **If URLs don't contain eventId in path segment**:
   - ❌ Candidates filtered out
   - ✅ Falls back to location maps if <2 USGS images
   - 📋 Logs show `urlBindingPassed: false` for rejected candidates

3. **If redirect doesn't contain eventId**:
   - ❌ Download fails
   - ✅ Tries next candidate
   - 📋 Logs show redirect validation error

## Test Instructions

Run `node test-debug-packet.js` and check logs for:

1. **"Products present" log block**:
   - `strictMatch: true/false`
   - `geoJsonEventId` matches `eventId`
   - `topCandidates` with `urlBindingPassed: true/false`

2. **"Final selected images" log block**:
   - `strictMatch: true`
   - `selectedImages` with `urlBindingPassed: true` for USGS images
   - Different `bufferHash` for different events

If `strictMatch: false` appears, the GeoJSON is for a different event (upstream issue).

If `strictMatch: true` but `urlBindingPassed: false` for all candidates, USGS URLs don't contain eventId (may need to relax URL binding and trust GeoJSON products only).

