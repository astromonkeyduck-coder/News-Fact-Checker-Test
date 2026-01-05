# Critical Issue: USGS Images Not Appearing on Generated Earthquake Images/GIFs

## Context & System Overview

We're building an earthquake news website that automatically generates branded images and animated GIFs for earthquakes. The system:

1. **Fetches earthquakes** from USGS API
2. **Scrapes USGS event pages** for images (shakemaps, intensity maps, etc.)
3. **Generates branded images** by compositing:
   - Base template image (`3rdUSGSTemp.png`)
   - Dynamic text overlay (magnitude, location)
   - **USGS images** (shakemaps, intensity maps) - **THIS IS FAILING**
   - Location map (fallback when USGS images unavailable)
4. **Generates animated GIFs** for social media previews

**Critical Requirement**: Both PNG and GIF MUST have 2 images (either 2 USGS images, or 1 USGS + 1 location map, or 2 location maps if no USGS).

## The Problem

**USGS images are NOT appearing on the generated images/GIFs**, even though:
- The scraping logic finds images (or should find them)
- The download function exists
- The compositing logic exists
- The code attempts to add images

**Current Status**:
- ✅ Text overlay works perfectly
- ✅ Template loads correctly
- ✅ Image generation completes successfully
- ❌ **USGS images: 0 found/added**
- ❌ **Location maps: Download failing (network/DNS issues)**

## Technical Stack

- **Runtime**: Node.js (Netlify Functions)
- **Image Processing**: Sharp.js
- **SVG Rendering**: resvg (for text overlay)
- **GIF Encoding**: gifenc (pure JS)
- **Storage**: Netlify Blobs
- **Template**: 3rdUSGSTemp.png (940x788, scaled to 4K: 2577x2160)

## Code Architecture

### Image Generation Flow (`generate-earthquake-image.js`)

1. **Input**: `magnitude`, `location`, `usgsImages[]`, `eventId`, `coordinates`
2. **Load template** → ✅ Works
3. **Create text overlay SVG** → ✅ Works
4. **Render text overlay with resvg** → ✅ Works
5. **Process USGS images**:
   - Loop through `usgsImages` array
   - Call `downloadImage(url)` for each
   - Call `prepareUSGSImage(buffer, width, height)` to resize/crop
   - Add to `compositeInputs` array
   - **PROBLEM**: This step finds 0 images or downloads fail
6. **Add location map** (if coordinates available and < 2 images):
   - Generate map URL via `generateLocationMapUrl()`
   - Download map via `downloadImage()`
   - **PROBLEM**: Map downloads failing (network/DNS)
7. **Composite all layers** → ✅ Works (but no images to composite)

### USGS Image Scraping (`engines/usgs.js` + `test-full-pipeline-local.js`)

**Current Scraping Strategy**:
1. **Priority 1**: HTML scraping from USGS event page (immediate availability)
2. **Priority 2**: API product extraction (5-10 minute delay for shakemaps)

**Scraping Patterns** (in order):
1. `<img src="...">` tags
2. Shakemap URL construction (tries multiple URL patterns)
3. Background images in `style` attributes
4. Direct links (`<a href="...">`)
5. Pattern matching for any USGS image URLs
6. Lazy-loaded images (`data-src`, `data-lazy-src`)
7. JSON-LD structured data
8. Any attribute containing image URLs

**Current Issues**:
- Scraping finds **0 images** for recent earthquakes
- Recent earthquakes may not have images yet (5-10 minute delay)
- But even older earthquakes with known images aren't being found

## What We've Tried

### 1. Improved Scraping Aggressiveness
- ✅ Increased search limit from 2 to 10 images
- ✅ Added more flexible URL matching (accepts `shakemap`, `intensity`, `realtime`, `product` keywords)
- ✅ Expanded shakemap URL construction (more patterns, more file types)
- ✅ Added lazy-loading image detection
- ✅ Added pattern matching for any USGS image URLs in HTML
- **Result**: Still finding 0 images

### 2. Enhanced Image Validation
- ✅ Stricter filtering (must have image extension: `.png`, `.jpg`, etc.)
- ✅ Excludes known non-image files (`.xml`, `.json`, metadata)
- ✅ Validates image magic bytes after download
- **Result**: No images to validate (none found)

### 3. Better Error Handling
- ✅ Added detailed logging at every step
- ✅ Logs URL, type, filename for each image found
- ✅ Logs download attempts and failures
- ✅ Logs processing errors
- **Result**: Shows "0 images found" but doesn't explain why

### 4. Location Map Fallback
- ✅ Code ensures 2 images always (adds location maps if USGS unavailable)
- ✅ Location map URL generation works
- ❌ **Location map downloads failing** (network/DNS issue with `staticmap.openstreetmap.de`)
- **Result**: Can't even test the fallback

### 5. Test Script Improvements
- ✅ Test script fetches real earthquakes from USGS
- ✅ Scrapes event page HTML
- ✅ Prioritizes shakemap/intensity images
- **Result**: Still 0 images found

## Current Code Snippets

### Image Download Function
```javascript
async function downloadImage(url, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
          'Accept': 'image/png,image/jpeg,image/gif,image/webp,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://noteworthynews.co/'
        }
      });
      // ... validation and return buffer
    } catch (error) {
      // Retry logic
    }
  }
  return null;
}
```

### USGS Image Processing
```javascript
if (usgsImages && usgsImages.length > 0) {
  for (let i = 0; i < imagesToTry.length && successfullyAddedImages < 2; i++) {
    const imageBuffer = await downloadImage(usgsImage.url);
    if (imageBuffer) {
      const processedImage = await prepareUSGSImage(imageBuffer, imageWidth, IMAGE_AREA_HEIGHT);
      if (processedImage) {
        compositeInputs.push({
          input: processedImage,
          left: x,
          top: y,
          blend: 'over',
        });
        successfullyAddedImages++;
      }
    }
  }
}
```

### Scraping Function (Key Patterns)
```javascript
// Pattern 1: <img src="...">
const imgTagPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
// Checks: isUSGSImage && isImageFile

// Pattern 2: Shakemap URL construction
const shakemapUrlPattern = /https?:\/\/[^"'\s<>]+(?:usgs\.gov|earthquake\.usgs\.gov)[^"'\s<>]*(?:\/realtime\/product\/shakemap\/|shakemap|intensity|mmi|pga|pgv)[^"'\s<>]*/gi;
// Tries multiple URL patterns with various image extensions

// Pattern 3: Any USGS image URL
const usgsImagePattern = /https?:\/\/[^"'\s<>]+(?:usgs\.gov|earthquake\.usgs\.gov)[^"'\s<>]*(?:shakemap|intensity|pga|pgv|mmi|map|plot|image|download)[^"'\s<>]*\.(png|jpg|jpeg|gif|webp)/gi;
```

## Test Results

**Test Command**: `node test-full-pipeline-local.js`

**Output**:
```
📥 Step 1: Fetching recent earthquake...
  ✅ Found: M6.8 near Los Angeles, California
  Event ID: [some-id]

🌐 Step 2: Scraping USGS event page HTML for images...
  Event page URL: https://earthquake.usgs.gov/earthquakes/eventpage/[event-id]
  ⚠️  No USGS images found via HTML scraping
  💡 This is normal - not all earthquakes have images immediately available

📊 Test Parameters:
  USGS Images: 0  ← PROBLEM: 0 images found

🖼️ Step 3: Generating static image...
  [generate-earthquake-image] ⚠️ No USGS images provided
  [generate-earthquake-image] 🗺️ Location map calculation: { mapsNeeded: 2, ... }
  [generate-earthquake-image] 📥 Downloading image (attempt 1/3): [map-url]
  [generate-earthquake-image] ❌ All 3 download attempts failed
  [generate-earthquake-image] ⚠️ Failed to download location map 1
  [generate-earthquake-image] ⚠️ Failed to download location map 2
  [generate-earthquake-image] ✅ IMAGE GENERATION COMPLETE: { containsUSGSImages: false }
```

## Key Findings

1. **Scraping finds 0 images**:
   - Recent earthquakes: Images may not be available yet (5-10 min delay)
   - But even when testing, scraping returns empty array
   - HTML scraping patterns may not match current USGS page structure

2. **Location map downloads failing**:
   - Service: `staticmap.openstreetmap.de`
   - Error: DNS resolution failure (`Could not resolve host`)
   - This prevents testing the fallback mechanism

3. **Code logic appears correct**:
   - Image processing pipeline exists
   - Compositing logic is correct
   - Error handling is in place
   - **But no images reach the processing stage**

## Research Questions for Deep Investigation

1. **USGS Image Availability**:
   - What is the EXACT timeline for when images become available?
   - Are images available via HTML before they're in the API?
   - What is the current HTML structure of USGS event pages?
   - Are images loaded via JavaScript/dynamic content that our scraping misses?

2. **USGS Image URLs**:
   - What is the EXACT URL pattern for shakemap images?
   - Do URLs require authentication or special headers?
   - Are images behind CDN that requires specific referrers?
   - Are there CORS restrictions?

3. **Scraping Strategy**:
   - Should we use headless browser (Puppeteer) instead of HTML scraping?
   - Are images loaded via AJAX/fetch that we need to intercept?
   - Do we need to wait for JavaScript to execute?
   - Are images in iframes or shadow DOM?

4. **Alternative Approaches**:
   - Should we use USGS API products directly instead of HTML scraping?
   - Can we construct image URLs from event metadata?
   - Are there alternative image sources (other agencies, APIs)?
   - Should we cache/store images for retry later?

5. **Location Map Service**:
   - Why is `staticmap.openstreetmap.de` not resolving?
   - What are alternative free map services?
   - Should we use a different approach (tile-based, different provider)?

6. **Testing Strategy**:
   - How to test with earthquakes that DEFINITELY have images?
   - Should we use known earthquake IDs with confirmed images?
   - How to verify scraping works independently of image availability?

## Specific Technical Questions

1. **HTML Scraping**:
   - Is the current regex pattern matching the actual USGS HTML structure?
   - Are images in `<picture>` tags, `<source>` tags, or other modern HTML5 elements?
   - Do we need to parse the HTML with a proper parser (cheerio, jsdom) instead of regex?

2. **Image URLs**:
   - What is the actual format of USGS shakemap image URLs?
   - Example: `https://earthquake.usgs.gov/realtime/product/shakemap/[event-id]/[timestamp]/download/intensity.jpg`?
   - Do URLs have query parameters, authentication tokens, or time-based expiration?

3. **Network Issues**:
   - Why is the map service not resolving? (DNS, firewall, service down?)
   - Should we use a different map service or self-host maps?
   - Are there rate limits or IP blocking?

4. **Production vs Local**:
   - Does this work in production but fail locally? (Different network, DNS, etc.)
   - Are there environment-specific issues?

## What We Need

**Primary Goal**: Get USGS images to appear on generated PNG and GIF files.

**Requirements**:
1. Find USGS images reliably (even if delayed)
2. Download images successfully
3. Process and composite images correctly
4. Ensure 2 images always appear (USGS or location map fallback)

**Success Criteria**:
- Generated PNG shows 2 images (USGS or location maps)
- Generated GIF shows 2 images (USGS or location maps)
- Works for both recent earthquakes (with retry) and older earthquakes (immediate)

## Request for Deep Research

Please conduct deep research on:

1. **USGS Event Page Structure**: Analyze current USGS earthquake event pages to understand:
   - How images are embedded (HTML structure)
   - Whether images are loaded dynamically (JavaScript)
   - Exact URL patterns for different image types
   - When images become available (timeline)

2. **USGS API Products**: Research the USGS API to understand:
   - Product structure and image URLs
   - How to construct image URLs from product metadata
   - Product availability timeline
   - Alternative endpoints for images

3. **Web Scraping Best Practices**: Research modern web scraping for:
   - Handling JavaScript-rendered content
   - Best tools/libraries for this use case
   - Headless browser vs static HTML scraping
   - Handling lazy-loaded images

4. **Map Service Alternatives**: Research free map services that:
   - Provide static map images
   - Support markers/pins
   - Are reliable and don't require API keys
   - Work from server environments

5. **Testing Strategy**: Research how to:
   - Test with known earthquakes that have images
   - Verify scraping independently
   - Mock image downloads for testing
   - Handle delayed image availability

## Expected Deliverables

Please provide:

1. **Root Cause Analysis**: Why images aren't being found/downloaded
2. **Recommended Solution**: Step-by-step approach to fix the issue
3. **Code Changes**: Specific code modifications needed
4. **Alternative Approaches**: Backup solutions if primary doesn't work
5. **Testing Strategy**: How to verify the fix works
6. **Production Considerations**: How this will work in production environment

## Additional Context

- **Production Environment**: Netlify Functions (serverless, Node.js)
- **Network**: Production has different network/DNS than local
- **Timing**: Images need to be available within 60 seconds (function timeout)
- **Reliability**: System must work for earthquakes of all magnitudes
- **Fallback**: Location maps should work when USGS images unavailable

## Critical Files

- `netlify/functions/generate-earthquake-image.js` - Main image generation
- `netlify/functions/generate-earthquake-video.js` - GIF generation
- `netlify/functions/engines/usgs.js` - USGS scraping and processing
- `test-full-pipeline-local.js` - Local testing script

---

**Please provide a comprehensive, research-backed solution to get USGS images appearing on our generated earthquake images and GIFs. This is critical for the product's functionality.**

