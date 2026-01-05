/**
 * Generate branded earthquake image using template
 * Uses SVG with embedded Roboto fonts (base64) for text rendering
 * Uses Sharp for image processing and compositing
 * 
 * POST /.netlify/functions/generate-earthquake-image
 * Body: { magnitude, location, usgsImages: [{url, type, filename}], eventId }
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const resvg = require('@resvg/resvg-js');

// Load embedded fonts (base64)
let FONT_DATA = null;
let FONT_BUFFERS = { regular: null, bold: null };
try {
  FONT_DATA = require('./fonts-base64.js');
  // Convert base64 data URIs to buffers for resvg
  if (FONT_DATA.regular) {
    const base64Data = FONT_DATA.regular.split(',')[1] || FONT_DATA.regular;
    FONT_BUFFERS.regular = Buffer.from(base64Data, 'base64');
  }
  if (FONT_DATA.bold) {
    const base64Data = FONT_DATA.bold.split(',')[1] || FONT_DATA.bold;
    FONT_BUFFERS.bold = Buffer.from(base64Data, 'base64');
  }
  console.log('[generate-earthquake-image] ✅ Loaded embedded Roboto fonts', {
    regular: !!FONT_BUFFERS.regular,
    bold: !!FONT_BUFFERS.bold
  });
} catch (err) {
  console.error('[generate-earthquake-image] ⚠️ Failed to load embedded fonts:', err.message);
  FONT_DATA = { regular: null, bold: null };
}

// Template dimensions (from file inspection: 940x788)
const TEMPLATE_WIDTH = 940;
const TEMPLATE_HEIGHT = 788;

// 4K Output dimensions (3840x2160 UHD)
const OUTPUT_4K_WIDTH = 3840;
const OUTPUT_4K_HEIGHT = 2160;
const ENABLE_4K = true;

// DYNAMIC TEXT PLACEMENT
const ANCHOR_X = 50;
const ALIGN_SHIFT_X = 18;
const HEADLINE_BASELINE_Y_BASE = 100; // Moved up to be above red banner, then down 20px, then down another 20px, then down 10px
const HEADLINE_BLOCK_OFFSET_Y = 100;
const HEADLINE_BASELINE_Y = HEADLINE_BASELINE_Y_BASE + HEADLINE_BLOCK_OFFSET_Y;
const LOCATION_OFFSET = 75;

// SAFE TEXT AREA
const SAFE_LEFT = ANCHOR_X + ALIGN_SHIFT_X;
const SAFE_RIGHT_RATIO = 0.58;

// Headline - Original format: "Breaking News:" then "M___ EARTHQUAKE NEAR" then location
const BREAKING_TEXT = "Breaking News:";
const EARTHQUAKE_NEAR_TEXT = "EARTHQUAKE NEAR";
const HEADLINE_FONT_SIZE_BASE = 65;
const MAGNITUDE_FONT_SIZE_RATIO = 0.95;
const MAGNITUDE_GAP = 18;
const TEXT_GAP = 12; // Gap between text segments
const HEADLINE_COLOR = '#FFFFFF';
const MAGNITUDE_COLOR = '#FF0000';

// Location
const LOCATION_FONT_SIZE_EXACT = 50;
const LOCATION_FONT_SIZE_MIN = 42;
const LOCATION_COLOR = '#FF0000';
const SAFE_LEFT_MARGIN = 40;

/**
 * Escape text for SVG
 */
function escapeSVGText(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Estimate text width for Roboto font
 */
function estimateTextWidth(text, fontSize) {
  const avgCharWidth = fontSize * 0.6;
  return text.length * avgCharWidth;
}

/**
 * Create SVG overlay with embedded fonts
 */
function createDynamicTextSVG(magnitudeText, locationText, templateWidth, templateHeight, scaleFactor = 1.0) {
  // Format: "Breaking News:" (line 1), "M#.# EARTHQUAKE NEAR" (line 2), "[LOCATION]" (line 3, all caps)
  const escapedBreaking = escapeSVGText(BREAKING_TEXT);
  const escapedMag = escapeSVGText(magnitudeText);
  const escapedEarthquakeNear = escapeSVGText(EARTHQUAKE_NEAR_TEXT);
  // Location in all caps (no period)
  const locationFormatted = locationText.toUpperCase();
  const escapedLocation = escapeSVGText(locationFormatted);
  
  // Scale all constants
  const scaledAnchorX = Math.round(ANCHOR_X * scaleFactor);
  const scaledAlignShiftX = Math.round(ALIGN_SHIFT_X * scaleFactor);
  const scaledHeadlineBaselineY = Math.round(HEADLINE_BASELINE_Y * scaleFactor);
  const scaledLocationOffset = Math.round(LOCATION_OFFSET * scaleFactor);
  const scaledSafeLeft = Math.round(SAFE_LEFT * scaleFactor);
  const scaledSafeLeftMargin = Math.round(SAFE_LEFT_MARGIN * scaleFactor);
  const scaledMagnitudeGap = Math.round(MAGNITUDE_GAP * scaleFactor);
  const scaledTextGap = Math.round(TEXT_GAP * scaleFactor);
  
  // Calculate safe text area
  const safeRight = Math.floor(templateWidth * SAFE_RIGHT_RATIO);
  const maxTextWidth = safeRight - scaledSafeLeft;
  
  // Base anchor position
  let anchorX = scaledAnchorX;
  if (anchorX < scaledSafeLeftMargin) {
    anchorX = scaledSafeLeftMargin;
  }
  
  // Apply alignment shift
  const alignedX = anchorX + scaledAlignShiftX;
  
  // Calculate font sizes
  let headlineFontSize = Math.round(HEADLINE_FONT_SIZE_BASE * scaleFactor);
  let magnitudeFontSize = Math.round(headlineFontSize * MAGNITUDE_FONT_SIZE_RATIO);
  
  // Measure text widths for format: "Breaking News:" (line 1), "M#.# EARTHQUAKE NEAR" (line 2), "[LOCATION]" (line 3)
  let breakingWidth = estimateTextWidth(BREAKING_TEXT, headlineFontSize);
  let magWidth = estimateTextWidth(magnitudeText, magnitudeFontSize);
  let earthquakeNearWidth = estimateTextWidth(EARTHQUAKE_NEAR_TEXT, headlineFontSize);
  let locationFontSize = Math.round(LOCATION_FONT_SIZE_EXACT * scaleFactor);
  const locationFontSizeMin = Math.round(LOCATION_FONT_SIZE_MIN * scaleFactor);
  let locationWidth = estimateTextWidth(locationFormatted, locationFontSize);
  
  // Calculate total width for line 1: "Breaking News:"
  let firstLineWidth = breakingWidth;
  
  // Calculate total width for line 2: "M#.# EARTHQUAKE NEAR"
  let secondLineWidth = magWidth + scaledTextGap + earthquakeNearWidth;
  
  // Calculate total width for line 3: "[LOCATION]"
  let thirdLineWidth = locationWidth;
  
  // Auto-reduce font sizes if needed
  const maxLineWidth = Math.max(firstLineWidth, Math.max(secondLineWidth, thirdLineWidth));
  if (maxLineWidth > maxTextWidth) {
    const fitScaleFactor = maxTextWidth / maxLineWidth;
    const minHeadlineSize = Math.round(50 * scaleFactor);
    headlineFontSize = Math.max(minHeadlineSize, Math.round(headlineFontSize * fitScaleFactor * 0.98));
    magnitudeFontSize = Math.round(headlineFontSize * MAGNITUDE_FONT_SIZE_RATIO);
    locationFontSize = Math.max(locationFontSizeMin, Math.round(locationFontSize * fitScaleFactor));
    
    // Recalculate widths with new sizes
    breakingWidth = estimateTextWidth(BREAKING_TEXT, headlineFontSize);
    magWidth = estimateTextWidth(magnitudeText, magnitudeFontSize);
    earthquakeNearWidth = estimateTextWidth(EARTHQUAKE_NEAR_TEXT, headlineFontSize);
    locationWidth = estimateTextWidth(locationFormatted, locationFontSize);
    firstLineWidth = breakingWidth;
    secondLineWidth = magWidth + scaledTextGap + earthquakeNearWidth;
    thirdLineWidth = locationWidth;
    
    console.log(`[generate-earthquake-image] Text auto-sized: headline=${headlineFontSize}px, location=${locationFontSize}px`);
  }
  
  // Position for line 1: "Breaking News:"
  const breakingX = alignedX;
  const breakingY = scaledHeadlineBaselineY;
  
  // Position for line 2: "M#.# EARTHQUAKE NEAR"
  const magX = alignedX;
  const earthquakeNearX = alignedX + magWidth + scaledTextGap;
  const secondLineY = scaledHeadlineBaselineY + scaledLocationOffset;
  
  // Position for line 3: "[LOCATION]" (all caps)
  const locationX = alignedX;
  const locationY = scaledHeadlineBaselineY + (scaledLocationOffset * 2);
  
  // Use Roboto if fonts are loaded, otherwise fallback
  // Build @font-face declarations with base64 embedded fonts
  const fontFaceCSS = [];
  if (FONT_DATA.regular) {
    fontFaceCSS.push(`@font-face { font-family: 'Roboto'; src: url('${FONT_DATA.regular}') format('truetype'); font-weight: normal; font-style: normal; }`);
  }
  if (FONT_DATA.bold) {
    fontFaceCSS.push(`@font-face { font-family: 'Roboto'; src: url('${FONT_DATA.bold}') format('truetype'); font-weight: bold; font-style: normal; }`);
  }
  
  const fontFamily = (FONT_DATA.regular && FONT_DATA.bold) ? 'Roboto' : 'Arial, sans-serif';
  
  return `
    <svg width="${templateWidth}" height="${templateHeight}" xmlns="http://www.w3.org/2000/svg" 
         shape-rendering="geometricPrecision" text-rendering="optimizeLegibility">
      <defs>
        <style>
          ${fontFaceCSS.join('\n          ')}
          text {
            text-rendering: optimizeLegibility;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
        </style>
      </defs>
      <!-- Breaking News: (white, bold) - Line 1 -->
      <text 
        x="${breakingX}" 
        y="${breakingY}" 
        font-family="${fontFamily}" 
        font-size="${headlineFontSize}" 
        font-weight="bold"
        fill="${HEADLINE_COLOR}"
        text-rendering="optimizeLegibility"
        shape-rendering="geometricPrecision">
        ${escapedBreaking}
      </text>
      
      <!-- Magnitude: M#.# (red, bold) - Line 2 start -->
      <text 
        x="${magX}" 
        y="${secondLineY}" 
        font-family="${fontFamily}" 
        font-size="${magnitudeFontSize}" 
        font-weight="bold"
        fill="${MAGNITUDE_COLOR}"
        text-rendering="optimizeLegibility"
        shape-rendering="geometricPrecision">
        ${escapedMag}
      </text>
      
      <!-- EARTHQUAKE NEAR (white, bold) - Line 2 continuation -->
      <text 
        x="${earthquakeNearX}" 
        y="${secondLineY}" 
        font-family="${fontFamily}" 
        font-size="${headlineFontSize}" 
        font-weight="bold"
        fill="${HEADLINE_COLOR}"
        text-rendering="optimizeLegibility"
        shape-rendering="geometricPrecision">
        ${escapedEarthquakeNear}
      </text>
      
      <!-- Location: e.g. WATSONVILLE, CALIFORNIA (red, bold, all caps) - Line 3 -->
      <text 
        x="${locationX}" 
        y="${locationY}" 
        font-family="${fontFamily}" 
        font-size="${locationFontSize}" 
        font-weight="bold"
        fill="${LOCATION_COLOR}"
        text-rendering="optimizeLegibility"
        shape-rendering="geometricPrecision">
        ${escapedLocation}
      </text>
    </svg>
  `;
}

/**
 * Create visual effects SVG (4K filter, flash effect, roundabout animation)
 * Makes images more engaging for social media with professional effects
 */
function createVisualEffectsSVG(width, height, magnitude, scaleFactor = 1.0) {
  const centerX = width * 0.5;
  const centerY = height * 0.6; // Slightly below center
  const roundaboutRadius = 40 * scaleFactor; // Small roundabout animation
  const flashIntensity = Math.min(0.3, magnitude / 25); // Flash intensity based on magnitude
  
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- 4K Enhancement Filter - Sharpening and contrast boost -->
        <filter id="4kEnhance" x="0%" y="0%" width="100%" height="100%">
          <feConvolveMatrix order="3" kernelMatrix="0 -1 0 -1 5 -1 0 -1 0" preserveAlpha="true"/>
          <feColorMatrix type="saturate" values="1.1"/>
          <feComponentTransfer>
            <feFuncR type="gamma" amplitude="1" exponent="0.95"/>
            <feFuncG type="gamma" amplitude="1" exponent="0.95"/>
            <feFuncB type="gamma" amplitude="1" exponent="0.95"/>
          </feComponentTransfer>
        </filter>
        
        <!-- Flash effect gradient -->
        <radialGradient id="flashGradient" cx="50%" cy="50%">
          <stop offset="0%" stop-color="rgba(255, 255, 255, ${flashIntensity})" stop-opacity="1"/>
          <stop offset="30%" stop-color="rgba(255, 255, 255, ${flashIntensity * 0.5})" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="rgba(255, 255, 255, 0)" stop-opacity="0"/>
        </radialGradient>
        
        <!-- Roundabout animation gradient -->
        <linearGradient id="roundaboutGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="rgba(74, 158, 255, 0.4)"/>
          <stop offset="50%" stop-color="rgba(74, 158, 255, 0.2)"/>
          <stop offset="100%" stop-color="rgba(74, 158, 255, 0)"/>
        </linearGradient>
      </defs>
      
      <!-- 4K Enhancement overlay (subtle sharpening effect) -->
      <rect x="0" y="0" width="${width}" height="${height}" fill="rgba(255, 255, 255, 0.02)" filter="url(#4kEnhance)" opacity="0.3"/>
      
      <!-- Flash effect (subtle white flash that pulses) -->
      <circle cx="${centerX}" cy="${centerY}" r="${Math.min(width, height) * 0.3}" fill="url(#flashGradient)" opacity="0.4">
        <animate attributeName="opacity" values="0.2;0.4;0.2" dur="3s" repeatCount="indefinite"/>
        <animate attributeName="r" values="${Math.min(width, height) * 0.25};${Math.min(width, height) * 0.35};${Math.min(width, height) * 0.25}" dur="3s" repeatCount="indefinite"/>
      </circle>
      
      <!-- Small roundabout animation (rotating circle) -->
      <g transform="translate(${centerX}, ${centerY})">
        <circle cx="0" cy="0" r="${roundaboutRadius}" fill="none" stroke="url(#roundaboutGradient)" stroke-width="${2 * scaleFactor}" opacity="0.6">
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0;360"
            dur="8s"
            repeatCount="indefinite"/>
        </circle>
        <!-- Small dot that orbits -->
        <circle cx="${roundaboutRadius}" cy="0" r="${4 * scaleFactor}" fill="rgba(74, 158, 255, 0.8)">
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0;360"
            dur="8s"
            repeatCount="indefinite"/>
        </circle>
      </g>
    </svg>
  `;
}

/**
 * Download image from URL
 */
/**
 * PHASE 2: Enhanced image download with detailed logging
 */
async function downloadImage(url, retries = 5) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      console.log(`[generate-earthquake-image] 📥 Downloading image (attempt ${attempt + 1}/${retries}): ${url.substring(0, 100)}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/png,image/jpeg,image/gif,image/webp,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://noteworthynews.co/'
        }
      });
      
      clearTimeout(timeoutId);
      
      const status = response.status;
      const contentType = response.headers.get('content-type') || '';
      
      // PHASE 2: Detailed logging
      console.log(`[generate-earthquake-image] 📊 Download response:`, {
        url: url.substring(0, 100),
        attempt: attempt + 1,
        status,
        contentType,
        contentLength: response.headers.get('content-length') || 'unknown'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${status}: ${response.statusText}`);
      }
      
      // PHASE 2: Fail if content-type is text/html or application/json (likely HTML landing page)
      if (contentType.includes('text/html') || contentType.includes('application/json')) {
        console.error(`[generate-earthquake-image] ❌ Response is HTML/JSON, not an image (content-type: ${contentType})`);
        throw new Error(`Expected image but got ${contentType}`);
      }
      
      if (!contentType.startsWith('image/')) {
        console.warn(`[generate-earthquake-image] ⚠️ Response content-type is not image/* (${contentType}), but proceeding...`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // PHASE 2: Validate magic bytes - fail if not an image
      const bytes = new Uint8Array(arrayBuffer);
      const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
      const isJPEG = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
      const isGIF = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
      const isWebP = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && 
                     bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
      
      if (!isPNG && !isJPEG && !isGIF && !isWebP) {
        const magicBytes = Array.from(bytes.slice(0, 4)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
        console.error(`[generate-earthquake-image] ❌ Downloaded data is not a valid image (magic bytes: ${magicBytes})`);
        throw new Error(`Invalid image format (magic bytes: ${magicBytes})`);
      }
      
      // PHASE 2: Final success log with details
      console.log(`[generate-earthquake-image] ✅ Successfully downloaded image:`, {
        url: url.substring(0, 100),
        attempt: attempt + 1,
        status,
        contentType,
        bufferSize: `${Math.round(buffer.length / 1024)}KB`,
        format: isPNG ? 'PNG' : isJPEG ? 'JPEG' : isGIF ? 'GIF' : isWebP ? 'WebP' : 'unknown'
      });
      return buffer;
      
    } catch (error) {
      const isLastAttempt = attempt === retries - 1;
      if (error.name === 'AbortError') {
        console.error(`[generate-earthquake-image] ❌ Download timeout (attempt ${attempt + 1}/${retries}): ${url.substring(0, 100)}`);
      } else {
        console.error(`[generate-earthquake-image] ❌ Download failed (attempt ${attempt + 1}/${retries}): ${error.message}`);
        console.error(`[generate-earthquake-image] ❌ Error details:`, {
          name: error.name,
          message: error.message,
          code: error.code,
          stack: error.stack?.substring(0, 200)
        });
      }
      
      if (isLastAttempt) {
        console.error(`[generate-earthquake-image] ❌ All ${retries} download attempts failed for: ${url.substring(0, 100)}`);
        return null;
      }
      
      // Wait before retry (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
      console.log(`[generate-earthquake-image] ⏳ Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return null;
}

/**
 * Resize and crop image to fit in allocated space
 */
async function prepareUSGSImage(imageBuffer, targetWidth, targetHeight) {
  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    
    console.log(`[generate-earthquake-image] 📐 USGS image metadata:`, {
      originalWidth: metadata.width,
      originalHeight: metadata.height,
      format: metadata.format,
      targetWidth,
      targetHeight
    });
    
    const imageAspect = metadata.width / metadata.height;
    const targetAspect = targetWidth / targetHeight;
    
    let width, height, left, top;
    
    if (imageAspect > targetAspect) {
      height = targetHeight;
      width = Math.round(height * imageAspect);
      left = Math.round((width - targetWidth) / 2);
      top = 0;
    } else {
      width = targetWidth;
      height = Math.round(width / imageAspect);
      left = 0;
      top = Math.round((height - targetHeight) / 2);
    }
    
    console.log(`[generate-earthquake-image] 🔧 Resizing USGS image:`, {
      resizeTo: `${width}x${height}`,
      extractFrom: `left=${left}, top=${top}`,
      extractSize: `${targetWidth}x${targetHeight}`
    });
    
    const processed = await image
      .resize(width, height, { 
        fit: 'cover',
        kernel: 'lanczos3',
        withoutEnlargement: false,
      })
      .extract({ left, top, width: targetWidth, height: targetHeight })
      .png({
        quality: 100,
        compressionLevel: 6,
        palette: false
      })
      .toBuffer();
    
    console.log(`[generate-earthquake-image] ✅ USGS image processed: ${Math.round(processed.length / 1024)}KB`);
    
    return processed;
  } catch (error) {
    console.error('[generate-earthquake-image] ❌ Error processing USGS image:', {
      error: error.message,
      stack: error.stack,
      targetWidth,
      targetHeight
    });
    return null;
  }
}

/**
 * Generate branded earthquake image
 * @param {string} templateType - 'standard' (4K), 'square' (1080x1080), 'wide' (1920x1080)
 */
/**
 * PHASE 3: Generate fallback location map image (server-side, no external DNS dependency)
 * Creates a simple location card image with gradient background, pin icon, and coordinates
 */
async function renderFallbackMapPng({ lat, lon, zoom = 11, width = 600, height = 400, locationText = null }) {
  try {
    // Create a simple gradient background (dark to light)
    const gradient = sharp({
      create: {
        width: width,
        height: height,
        channels: 3,
        background: { r: 30, g: 30, b: 40 } // Dark blue-gray
      }
    });
    
    // Create gradient overlay (lighter at top, darker at bottom)
    const gradientOverlay = Buffer.from(`
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:rgba(60,80,120,0.6);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(20,30,50,0.8);stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#grad)" />
      </svg>
    `);
    
    // Composite gradient
    let mapImage = await gradient
      .composite([{ input: gradientOverlay, blend: 'over' }])
      .png()
      .toBuffer();
    
    // Add text overlay with location info
    const textSVG = Buffer.from(`
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <text x="${width / 2}" y="${height / 2 - 30}" 
              font-family="Arial, sans-serif" font-size="24" font-weight="bold" 
              fill="#FFFFFF" text-anchor="middle">
          ${locationText ? escapeSVGText(locationText) : 'Earthquake Location'}
        </text>
        <text x="${width / 2}" y="${height / 2 + 10}" 
              font-family="Arial, sans-serif" font-size="18" 
              fill="#CCCCCC" text-anchor="middle">
          ${lat.toFixed(4)}°N, ${Math.abs(lon).toFixed(4)}°${lon < 0 ? 'W' : 'E'}
        </text>
        <!-- Simple pin icon (red circle) -->
        <circle cx="${width / 2}" cy="${height / 2 - 50}" r="12" fill="#FF0000" stroke="#FFFFFF" stroke-width="2"/>
      </svg>
    `);
    
    mapImage = await sharp(mapImage)
      .composite([{ input: textSVG, blend: 'over' }])
      .png()
      .toBuffer();
    
    console.log(`[generate-earthquake-image] ✅ Generated fallback map image: ${width}x${height} (${Math.round(mapImage.length / 1024)}KB)`);
    return mapImage;
  } catch (error) {
    console.error(`[generate-earthquake-image] ❌ Error generating fallback map:`, error.message);
    return null;
  }
}

/**
 * PHASE 4: Build exactly 2 image sources (USGS or fallback)
 * Returns array of [{ type: "usgs"|"fallback", buffer, label }] with exactly 2 items
 */
async function buildTwoImageSources({ usgsCandidates, coordinates, locationText, imageWidth, imageHeight, logger }) {
  const sources = [];
  const maxImages = 2;
  
  logger = logger || { info: console.log, warn: console.warn, error: console.error };
  
  // PHASE 4: Try to download/process USGS images in priority order
  if (usgsCandidates && usgsCandidates.length > 0) {
    logger.info(`[buildTwoImageSources] 📸 Processing ${usgsCandidates.length} USGS candidate(s)...`);
    
    for (const candidate of usgsCandidates) {
      if (sources.length >= maxImages) break;
      
      try {
        const imageBuffer = await downloadImage(candidate.url, 3);
        if (imageBuffer) {
          const processedImage = await prepareUSGSImage(imageBuffer, imageWidth, imageHeight);
          if (processedImage) {
            sources.push({
              type: 'usgs',
              buffer: processedImage,
              label: `${candidate.productType}/${candidate.path || 'image'}`,
              url: candidate.url
            });
            logger.info(`[buildTwoImageSources] ✅ Added USGS image ${sources.length}/${maxImages}: ${candidate.productType}`);
          } else {
            logger.warn(`[buildTwoImageSources] ⚠️ Failed to process USGS image: ${candidate.url.substring(0, 80)}`);
          }
        } else {
          logger.warn(`[buildTwoImageSources] ⚠️ Failed to download USGS image: ${candidate.url.substring(0, 80)}`);
        }
      } catch (error) {
        logger.warn(`[buildTwoImageSources] ⚠️ Error processing USGS candidate: ${error.message}`);
      }
    }
  } else {
    logger.info(`[buildTwoImageSources] ℹ️ No USGS candidates provided`);
  }
  
  // PHASE 4: Fill remaining slots with fallback maps
  const fallbacksNeeded = maxImages - sources.length;
  if (fallbacksNeeded > 0 && coordinates && coordinates.lat != null && coordinates.lon != null) {
    logger.info(`[buildTwoImageSources] 🗺️ Generating ${fallbacksNeeded} fallback map(s)...`);
    
    for (let i = 0; i < fallbacksNeeded; i++) {
      const fallbackMap = await renderFallbackMapPng({
        lat: coordinates.lat,
        lon: coordinates.lon,
        width: imageWidth,
        height: imageHeight,
        locationText: locationText || 'Earthquake Location'
      });
      
      if (fallbackMap) {
        const processedMap = await prepareUSGSImage(fallbackMap, imageWidth, imageHeight);
        if (processedMap) {
          sources.push({
            type: 'fallback',
            buffer: processedMap,
            label: `location-map-${i + 1}`,
            url: null
          });
          logger.info(`[buildTwoImageSources] ✅ Added fallback map ${sources.length}/${maxImages}`);
        }
      }
    }
  }
  
  // PHASE 4: Worst case - duplicate first image if we still don't have 2
  if (sources.length === 1) {
    logger.warn(`[buildTwoImageSources] ⚠️ Only 1 image available, duplicating to reach 2`);
    sources.push({
      type: sources[0].type,
      buffer: sources[0].buffer,
      label: `${sources[0].label}-duplicate`,
      url: sources[0].url
    });
  }
  
  // PHASE 4: If still 0, create 2 fallback maps (no coordinates case)
  if (sources.length === 0) {
    logger.warn(`[buildTwoImageSources] ⚠️ No images available, creating 2 generic fallback maps`);
    for (let i = 0; i < 2; i++) {
      const fallbackMap = await renderFallbackMapPng({
        lat: 0,
        lon: 0,
        width: imageWidth,
        height: imageHeight,
        locationText: locationText || 'Location Unknown'
      });
      if (fallbackMap) {
        const processedMap = await prepareUSGSImage(fallbackMap, imageWidth, imageHeight);
        if (processedMap) {
          sources.push({
            type: 'fallback',
            buffer: processedMap,
            label: `generic-fallback-${i + 1}`,
            url: null
          });
        }
      }
    }
  }
  
  logger.info(`[buildTwoImageSources] ✅ Final: ${sources.length} image source(s) ready`, {
    types: sources.map(s => s.type),
    labels: sources.map(s => s.label)
  });
  
  return sources.slice(0, maxImages); // Guarantee exactly 2
}

/**
 * PHASE 5: Updated to fetch GeoJSON detail and extract products internally
 */
async function generateImage(magnitude, location, eventId, templateType = 'standard', coordinates = null, detailUrl = null) {
  // PHASE 5: Fetch GeoJSON detail and extract products
  // Import from engines/usgs.js (functions are exported)
  const usgsEngine = require('./engines/usgs');
  const fetchUsgsDetailGeoJson = usgsEngine.fetchUsgsDetailGeoJson;
  const extractUsgsProductImages = usgsEngine.extractUsgsProductImages;
  
  console.log(`[generate-earthquake-image] 📥 INPUT VALIDATION:`, {
    magnitude,
    location,
    eventId,
    hasDetailUrl: !!detailUrl,
    hasCoordinates: !!(coordinates && coordinates[0] != null && coordinates[1] != null)
  });
  
  // PHASE 5: Fetch GeoJSON detail
  let usgsCandidates = [];
  if (eventId || detailUrl) {
    console.log(`[generate-earthquake-image] 📡 Fetching USGS detail GeoJSON...`);
    const detailJson = await fetchUsgsDetailGeoJson({ eventId, detailUrl, logger: { info: console.log, warn: console.warn, error: console.error } });
    
    if (detailJson) {
      // PHASE 5: Extract product images
      usgsCandidates = extractUsgsProductImages(detailJson);
      console.log(`[generate-earthquake-image] 📸 Extracted ${usgsCandidates.length} USGS image candidate(s) from products:`, {
        productTypes: usgsCandidates.map(c => c.productType),
        paths: usgsCandidates.map(c => c.path)
      });
      
      // PHASE 5: Log WHY we got 0 images if that's the case
      if (usgsCandidates.length === 0 && detailJson.properties && detailJson.properties.products) {
        const products = detailJson.properties.products;
        const productTypes = Object.keys(products);
        const productCounts = {};
        for (const [key, productList] of Object.entries(products)) {
          productCounts[key] = Array.isArray(productList) ? productList.length : 0;
        }
        console.warn(`[generate-earthquake-image] ⚠️ No USGS image candidates found. Available products:`, {
          productTypes,
          productCounts,
          reason: productTypes.length === 0 ? 'No products available yet (may take 5-10 minutes for shakemaps)' : 'Products exist but no image contents found'
        });
      }
    } else {
      console.warn(`[generate-earthquake-image] ⚠️ Failed to fetch USGS detail GeoJSON (eventId: ${eventId}, detailUrl: ${detailUrl})`);
    }
  } else {
    console.warn(`[generate-earthquake-image] ⚠️ No eventId or detailUrl provided - skipping USGS image extraction`);
  }
  
  // Format magnitude text
  const magnitudeText = `M${magnitude.toFixed(1)}`;
  
  // Load template
  const possiblePaths = [
    path.join(__dirname, '3rdUSGSTemp.png'),
    path.join(path.dirname(__dirname), '3rdUSGSTemp.png'),
    path.join(__dirname, '../../3rdUSGSTemp.png'),
    path.join(process.cwd(), 'netlify/functions/3rdUSGSTemp.png'),
    path.join(process.cwd(), '3rdUSGSTemp.png'),
    path.resolve('./3rdUSGSTemp.png'),
    '/var/task/netlify/functions/3rdUSGSTemp.png',
    '/var/task/3rdUSGSTemp.png',
  ];
  
  let templateBuffer = null;
  let templatePath = null;
  
  for (const templatePathCandidate of possiblePaths) {
    try {
      if (fs.existsSync(templatePathCandidate)) {
        templatePath = templatePathCandidate;
        templateBuffer = fs.readFileSync(templatePathCandidate);
        console.log(`[generate-earthquake-image] ✅ Loaded template from: ${templatePath} (${templateBuffer.length} bytes)`);
        break;
      }
    } catch (err) {
      // Continue to next path
    }
  }
  
  // Try HTTP if file system fails
  if (!templateBuffer) {
    let baseUrl = 'https://noteworthynews.co';
    if (process.env.NETLIFY_DEV || process.env.URL?.includes('localhost') || !process.env.URL) {
      baseUrl = 'http://localhost:8888';
    } else if (process.env.URL) {
      baseUrl = process.env.URL;
    }
    
    for (const httpPath of [`${baseUrl}/3rdUSGSTemp.png`, `${baseUrl}/netlify/functions/3rdUSGSTemp.png`]) {
      try {
        const response = await fetch(httpPath);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          templateBuffer = Buffer.from(arrayBuffer);
          templatePath = httpPath;
          console.log(`[generate-earthquake-image] ✅ Loaded template via HTTP: ${httpPath}`);
          break;
        }
      } catch (err) {
        // Continue
      }
    }
  }
  
  if (!templateBuffer) {
    throw new Error(`Template not found. Tried: ${possiblePaths.join(', ')}`);
  }
  
  // Load template into Sharp
  const template = sharp(templateBuffer);
  const templateMetadata = await template.metadata();
  
  const actualWidth = templateMetadata.width;
  const actualHeight = templateMetadata.height;
  
  // STEP 6: Validate template dimensions
  console.log(`[generate-earthquake-image] Template loaded: ${actualWidth}x${actualHeight} (expected: ${TEMPLATE_WIDTH}x${TEMPLATE_HEIGHT})`);
  if (!actualWidth || !actualHeight) {
    throw new Error(`Invalid template dimensions: ${actualWidth}x${actualHeight}`);
  }
  
  if (actualWidth !== TEMPLATE_WIDTH || actualHeight !== TEMPLATE_HEIGHT) {
    console.warn(`[generate-earthquake-image] Template dimensions (${actualWidth}x${actualHeight}) don't match expected (${TEMPLATE_WIDTH}x${TEMPLATE_HEIGHT})`);
  }
  
  // Calculate dimensions based on template type
  let outputWidth, outputHeight, scaleFactor;
  
  // Template type dimensions
  const TEMPLATE_DIMENSIONS = {
    standard: { width: OUTPUT_4K_WIDTH, height: OUTPUT_4K_HEIGHT }, // 4K (3840x2160)
    square: { width: 1080, height: 1080 }, // Instagram square
    wide: { width: 1920, height: 1080 }, // Twitter/Facebook wide
  };
  
  const targetDimensions = TEMPLATE_DIMENSIONS[templateType] || TEMPLATE_DIMENSIONS.standard;
  
  if (ENABLE_4K || templateType !== 'standard') {
    const widthScale = targetDimensions.width / actualWidth;
    const heightScale = targetDimensions.height / actualHeight;
    scaleFactor = Math.min(widthScale, heightScale);
    
    outputWidth = Math.round(actualWidth * scaleFactor);
    outputHeight = Math.round(actualHeight * scaleFactor);
    
    console.log(`[generate-earthquake-image] Scaling to ${templateType}: ${actualWidth}x${actualHeight} -> ${outputWidth}x${outputHeight} (scale: ${scaleFactor.toFixed(3)})`);
  } else {
    outputWidth = actualWidth;
    outputHeight = actualHeight;
    scaleFactor = 1.0;
  }
  
  // STEP 5: Create text overlay SVG
  console.log(`[generate-earthquake-image] 📝 Creating text overlay SVG...`);
  
  // Validate fonts before proceeding
  const fontLoaded = !!(FONT_DATA.regular && FONT_DATA.bold);
  if (!fontLoaded) {
    const errorMsg = `Fonts not loaded! Regular: ${!!FONT_DATA.regular}, Bold: ${!!FONT_DATA.bold}`;
    console.error(`[generate-earthquake-image] ❌ ${errorMsg}`);
    throw new Error(`Font loading failed: ${errorMsg}. Check fonts-base64.js`);
  }
  
  // Validate font data is actually base64 (not HTML)
  try {
    const regularBase64 = FONT_DATA.regular.split(',')[1] || FONT_DATA.regular;
    const boldBase64 = FONT_DATA.bold.split(',')[1] || FONT_DATA.bold;
    const regularHeader = Buffer.from(regularBase64.substring(0, 20), 'base64').toString('hex');
    const boldHeader = Buffer.from(boldBase64.substring(0, 20), 'base64').toString('hex');
    
    if (!regularHeader.startsWith('00010000') && !regularHeader.startsWith('4f54544f')) {
      throw new Error(`Invalid font data in regular font (header: ${regularHeader.substring(0, 8)}). Font file may be corrupted.`);
    }
    if (!boldHeader.startsWith('00010000') && !boldHeader.startsWith('4f54544f')) {
      throw new Error(`Invalid font data in bold font (header: ${boldHeader.substring(0, 8)}). Font file may be corrupted.`);
    }
    
    console.log(`[generate-earthquake-image] ✅ Fonts validated: Regular=${FONT_DATA.regular.length} chars, Bold=${FONT_DATA.bold.length} chars`);
  } catch (fontError) {
    console.error(`[generate-earthquake-image] ❌ Font validation failed:`, fontError);
    throw fontError;
  }
  
  // Define fontFamily in this scope (used for logging)
  const fontFamily = (FONT_DATA.regular && FONT_DATA.bold) ? 'Roboto' : 'Arial, sans-serif';
  
  // Create SVG overlay with embedded fonts
  const svgString = createDynamicTextSVG(magnitudeText, location, outputWidth, outputHeight, scaleFactor);
  
  // CRITICAL: Log SVG content to verify text is included
  console.log(`[generate-earthquake-image] 📝 SVG Text Overlay Content:`, {
    magnitudeText: magnitudeText,
    locationText: location.toUpperCase(),
    svgLength: svgString.length,
    containsMagnitude: svgString.includes(magnitudeText),
    containsBreaking: svgString.includes(BREAKING_TEXT),
    containsEarthquakeNear: svgString.includes(EARTHQUAKE_NEAR_TEXT),
    containsLocation: svgString.includes(location.toUpperCase()),
    containsFontFace: svgString.includes('@font-face'),
    containsRoboto: svgString.includes('Roboto'),
    svgPreview: svgString.substring(0, 500) + '...'
  });
  
  // STEP 6: Render SVG using resvg (supports embedded fonts better than librsvg)
  // resvg properly handles @font-face with data URIs and embedded base64 fonts
  let textOverlayBuffer;
  const tempFontFiles = []; // Declare outside try block for cleanup in catch
  try {
    // resvg options - fonts are embedded in SVG via @font-face, but we also register font buffers
    // CRITICAL: Use 'original' mode to preserve exact SVG dimensions, don't scale
    const svgOptions = {
      font: {
        loadSystemFonts: true, // Enable system fonts as fallback (resvg may need this)
        fontFiles: [], // Will be populated below
      },
      // CRITICAL: Use 'original' to preserve exact SVG dimensions (outputWidth x outputHeight)
      // This ensures text positions match exactly
      fitTo: {
        mode: 'original', // Preserve exact SVG dimensions
      },
    };
    
    // CRITICAL: Register font buffers with resvg
    // Try writing fonts to temp files first (resvg may need file paths, not buffers)
    try {
      if (FONT_BUFFERS.regular && FONT_BUFFERS.bold) {
        // Write fonts to temporary files in /tmp (available in Netlify functions)
        const tempDir = '/tmp';
        const regularFontPath = path.join(tempDir, `roboto-regular-${Date.now()}.ttf`);
        const boldFontPath = path.join(tempDir, `roboto-bold-${Date.now()}.ttf`);
        
        fs.writeFileSync(regularFontPath, FONT_BUFFERS.regular);
        fs.writeFileSync(boldFontPath, FONT_BUFFERS.bold);
        
        tempFontFiles.push(regularFontPath, boldFontPath);
        svgOptions.font.fontFiles = tempFontFiles;
        
        console.log('[generate-earthquake-image] ✅ Registered font files with resvg', {
          regularPath: regularFontPath,
          boldPath: boldFontPath,
          regularSize: FONT_BUFFERS.regular.length,
          boldSize: FONT_BUFFERS.bold.length,
          loadSystemFonts: true
        });
      } else {
        console.warn('[generate-earthquake-image] ⚠️ Font buffers not available for resvg!', {
          hasRegular: !!FONT_BUFFERS.regular,
          hasBold: !!FONT_BUFFERS.bold
        });
        // Don't throw - let resvg try with system fonts
        console.warn('[generate-earthquake-image] ⚠️ Will attempt rendering with system fonts only');
      }
    } catch (fontFileError) {
      console.warn('[generate-earthquake-image] ⚠️ Failed to write font files, trying buffers instead:', fontFileError.message);
      // Fallback to buffers if file writing fails
      if (FONT_BUFFERS.regular && FONT_BUFFERS.bold) {
        svgOptions.font.fontFiles = [
          FONT_BUFFERS.regular,
          FONT_BUFFERS.bold,
        ];
        console.log('[generate-earthquake-image] ✅ Using font buffers as fallback');
      }
    }
    
    // Use resvg.Resvg constructor to render SVG to PNG
    console.log('[generate-earthquake-image] 🎨 Rendering SVG with resvg...', {
      svgLength: svgString.length,
      fontFilesCount: svgOptions.font.fontFiles.length,
      loadSystemFonts: svgOptions.font.loadSystemFonts,
      fontFamilyInSVG: svgString.includes('font-family: \'Roboto\'') || svgString.includes('font-family:"Roboto"')
    });
    
    const resvgInstance = new resvg.Resvg(svgString, svgOptions);
    const pngData = resvgInstance.render();
    textOverlayBuffer = pngData.asPng();
    
    console.log('[generate-earthquake-image] 🎨 resvg render complete', {
      bufferSize: textOverlayBuffer.length,
      isBuffer: Buffer.isBuffer(textOverlayBuffer)
    });
    
    // CRITICAL: Verify text overlay buffer is valid
    if (!textOverlayBuffer || textOverlayBuffer.length === 0) {
      throw new Error('Text overlay buffer is empty after resvg rendering!');
    }
    
    // Verify it's a valid PNG
    const textMagicBytes = textOverlayBuffer.slice(0, 4);
    const isTextPNG = textMagicBytes[0] === 0x89 && textMagicBytes[1] === 0x50 && textMagicBytes[2] === 0x4E && textMagicBytes[3] === 0x47;
    
    if (!isTextPNG) {
      console.error(`[generate-earthquake-image] ❌ Text overlay is not a valid PNG! Magic bytes:`, 
        Array.from(textMagicBytes).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
      throw new Error('Text overlay rendering failed - output is not a valid PNG');
    }
    
    // CRITICAL: Verify text overlay has actual content (not just transparent pixels)
    // Load the PNG and check if it has non-transparent pixels
    let textOverlayHasContent = false;
    let actualTextDimensions = { width: 0, height: 0 };
    try {
      const textOverlayImage = sharp(textOverlayBuffer);
      const textMetadata = await textOverlayImage.metadata();
      actualTextDimensions = { width: textMetadata.width, height: textMetadata.height };
      
      // Check if there are any non-transparent pixels by sampling a few areas
      // If the image has alpha channel, check if any pixels have alpha > 0
      const stats = await textOverlayImage.stats();
      if (stats.channels && stats.channels.length >= 4) {
        // Has alpha channel - check if alpha channel has any non-zero values
        const alphaChannel = stats.channels[3]; // Alpha is usually channel 3 (RGBA) or 4 (CMYKA)
        // CRITICAL: Check if alpha channel has any pixels with alpha > 0 (non-transparent)
        // Also check RGB channels to ensure there's actual color content
        const hasAlpha = alphaChannel && (alphaChannel.min < 255 || alphaChannel.max > 0);
        const hasColor = stats.channels.slice(0, 3).some(ch => ch.max > 0); // Check R, G, B channels
        textOverlayHasContent = hasAlpha && hasColor;
        
        // Log detailed stats for debugging
        console.log('[generate-earthquake-image] 📊 Text overlay pixel analysis:', {
          hasAlphaChannel: !!alphaChannel,
          alphaMin: alphaChannel?.min,
          alphaMax: alphaChannel?.max,
          redMax: stats.channels[0]?.max || 0,
          greenMax: stats.channels[1]?.max || 0,
          blueMax: stats.channels[2]?.max || 0,
          hasAlpha: hasAlpha,
          hasColor: hasColor,
          textOverlayHasContent: textOverlayHasContent
        });
      } else {
        // No alpha channel - check if any RGB channel has non-zero values
        textOverlayHasContent = stats.channels && stats.channels.some(ch => ch.min < 255 || ch.max > 0);
        console.log('[generate-earthquake-image] 📊 Text overlay pixel analysis (no alpha):', {
          channelCount: stats.channels?.length || 0,
          channelMaxes: stats.channels?.map(ch => ch.max) || [],
          textOverlayHasContent: textOverlayHasContent
        });
      }
      
      console.log('[generate-earthquake-image] ✅ SVG rendered with resvg (embedded fonts)', {
        textOverlaySize: `${Math.round(textOverlayBuffer.length / 1024)}KB`,
        isValidPNG: isTextPNG,
        dimensions: `${textMetadata.width}x${textMetadata.height}`,
        expectedDimensions: `${outputWidth}x${outputHeight}`,
        hasContent: textOverlayHasContent,
        channels: stats.channels?.length || 0,
        containsText: true
      });
      
      if (textMetadata.width !== outputWidth || textMetadata.height !== outputHeight) {
        console.error(`[generate-earthquake-image] ❌ CRITICAL: Text overlay dimensions mismatch! Expected ${outputWidth}x${outputHeight}, got ${textMetadata.width}x${textMetadata.height}`);
        throw new Error(`Text overlay dimensions mismatch: expected ${outputWidth}x${outputHeight}, got ${textMetadata.width}x${textMetadata.height}`);
      }
      
      if (!textOverlayHasContent) {
        console.error(`[generate-earthquake-image] ❌ CRITICAL: Text overlay appears to be empty/transparent! No visible content detected.`);
        throw new Error('Text overlay is empty - no visible text rendered. Check font loading and SVG content.');
      }
    } catch (statsError) {
      console.warn(`[generate-earthquake-image] ⚠️ Could not analyze text overlay stats:`, statsError.message);
      // If stats check fails, still try to use it but log a warning
      if (statsError.message.includes('dimensions mismatch') || statsError.message.includes('empty')) {
        throw statsError; // Re-throw critical errors
      }
    }
    
    // Clean up temporary font files
    if (tempFontFiles.length > 0) {
      try {
        tempFontFiles.forEach(fontPath => {
          if (fs.existsSync(fontPath)) {
            fs.unlinkSync(fontPath);
          }
        });
        console.log('[generate-earthquake-image] ✅ Cleaned up temporary font files');
      } catch (cleanupError) {
        console.warn('[generate-earthquake-image] ⚠️ Failed to clean up temp font files:', cleanupError.message);
      }
    }
  } catch (resvgError) {
    // Clean up temporary font files on error
    if (tempFontFiles && tempFontFiles.length > 0) {
      try {
        tempFontFiles.forEach(fontPath => {
          if (fs.existsSync(fontPath)) {
            fs.unlinkSync(fontPath);
          }
        });
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }
    
    console.error('[generate-earthquake-image] ❌ resvg rendering failed:', resvgError.message);
    console.error('[generate-earthquake-image] ❌ resvg error stack:', resvgError.stack);
    // Don't fall back to broken rendering - throw error so we know it failed
    throw new Error(`Font rendering failed: ${resvgError.message}. Text will appear as boxes. Check font buffers and resvg configuration.`);
  }
  
  // Format location for logging (same format as in createDynamicTextSVG)
  const locationFormattedForLog = location ? location.toUpperCase() : 'UNKNOWN LOCATION';
  
  console.log(`[generate-earthquake-image] ✅ SVG text overlay created: ${outputWidth}x${outputHeight}`);
  console.log(`[generate-earthquake-image] Template dimensions: ${actualWidth}x${actualHeight}, output: ${outputWidth}x${outputHeight}`);
  console.log(`[generate-earthquake-image] Font family: ${fontFamily}, fontLoaded: ${fontLoaded}`);
  console.log(`[generate-earthquake-image] Text content: "${BREAKING_TEXT} ${magnitudeText} ${EARTHQUAKE_NEAR_TEXT} ${locationFormattedForLog}"`);
  
  // Prepare composite inputs
  // CRITICAL: Explicitly position text overlay at (0,0) to ensure it covers the entire template
  const compositeInputs = [
    { 
      input: textOverlayBuffer, 
      blend: 'over',
      left: 0,
      top: 0
    },
  ];
  
  // PHASE 4: Build exactly 2 image sources using new approach
  const IMAGE_AREA_Y = Math.round(410 * scaleFactor);
  const IMAGE_AREA_HEIGHT = Math.round(250 * scaleFactor);
  const IMAGE_PADDING = Math.round(20 * scaleFactor);
  const IMAGE_SPACING = Math.round(15 * scaleFactor);
  const imageAreaWidth = outputWidth - (IMAGE_PADDING * 2);
  const imageWidth = Math.floor((imageAreaWidth - IMAGE_SPACING) / 2); // Always 2 images side-by-side
  
  console.log(`[generate-earthquake-image] 📸 Building 2 image sources...`, {
    imageAreaY: IMAGE_AREA_Y,
    imageAreaHeight: IMAGE_AREA_HEIGHT,
    imageWidth,
    imageHeight: IMAGE_AREA_HEIGHT,
    usgsCandidates: usgsCandidates.length
  });
  
  // Extract coordinates
  const lat = coordinates?.[1] ?? null;
  const lon = coordinates?.[0] ?? null;
  
  // PHASE 4: Use buildTwoImageSources to guarantee exactly 2 images
  const imageSources = await buildTwoImageSources({
    usgsCandidates,
    coordinates: lat != null && lon != null ? { lat, lon } : null,
    locationText: location,
    imageWidth,
    imageHeight: IMAGE_AREA_HEIGHT,
    logger: { info: console.log, warn: console.warn, error: console.error }
  });
  
  // PHASE 4: Add exactly 2 images to composite
  let usgsImageCount = 0;
  let locationMapCount = 0;
  
  for (let i = 0; i < imageSources.length; i++) {
    const source = imageSources[i];
    const x = IMAGE_PADDING + (i * (imageWidth + IMAGE_SPACING));
    const y = IMAGE_AREA_Y;
    
    compositeInputs.push({
      input: source.buffer,
      left: x,
      top: y,
      blend: 'over',
    });
    
    if (source.type === 'usgs') {
      usgsImageCount++;
    } else {
      locationMapCount++;
    }
    
    console.log(`[generate-earthquake-image] ✅ Added ${source.type} image ${i + 1}/2:`, {
      type: source.type,
      label: source.label,
      position: `(${x}, ${y})`,
      size: `${imageWidth}x${IMAGE_AREA_HEIGHT}`
    });
  }
  
  console.log(`[generate-earthquake-image] ✅ Final image composition:`, {
    totalImages: imageSources.length,
    usgsImages: usgsImageCount,
    locationMaps: locationMapCount
  });
  
  // OLD CODE REMOVED - Now using buildTwoImageSources above
  /*
  if (usgsImages && usgsImages.length > 0) {
  */
  
  // CRITICAL: Log what will be in the final composite
  console.log(`[generate-earthquake-image] 📊 COMPOSITE LAYERS:`, {
    totalLayers: compositeInputs.length,
    hasTextOverlay: false, // Template already has text baked in
    hasUSGSImages: successfullyAddedImages > 0,
    usgsImageCount: usgsImageCount,
    locationMapCount: locationMapCount,
    templateDimensions: `${actualWidth}x${actualHeight}`,
    outputDimensions: `${outputWidth}x${outputHeight}`,
    scaleFactor: scaleFactor.toFixed(3),
    magnitudeText: magnitudeText,
    locationText: location.toUpperCase()
  });
  
  // Scale template to match output dimensions if 4K is enabled
  let compositePipeline = template;
  
  // CRITICAL: Verify template dimensions before scaling
  // Reuse existing templateMetadata from line 361 (already loaded)
  console.log(`[generate-earthquake-image] 📐 Template metadata:`, {
    width: templateMetadata.width,
    height: templateMetadata.height,
    format: templateMetadata.format,
    hasAlpha: templateMetadata.hasAlpha,
    expectedDimensions: `${actualWidth}x${actualHeight}`
  });
  
  if (ENABLE_4K && scaleFactor > 1.0) {
    compositePipeline = template
      .resize(outputWidth, outputHeight, {
        kernel: 'lanczos3',
        withoutEnlargement: false,
      });
    console.log(`[generate-earthquake-image] 📐 Template will be scaled to ${outputWidth}x${outputHeight} for 4K output`);
    // Note: Sharp's resize is lazy - actual resize happens during processing
    // We verify final dimensions after composite is generated (see below)
  }
  
  // Composite all layers
  console.log(`[generate-earthquake-image] 🎨 Compositing ${compositeInputs.length} layer(s) onto template...`);
  console.log(`[generate-earthquake-image] 🎨 Composite inputs detail:`, {
    totalLayers: compositeInputs.length,
    layerDetails: compositeInputs.map((layer, idx) => ({
      index: idx,
      hasInput: !!layer.input,
      inputType: layer.input ? (Buffer.isBuffer(layer.input) ? 'Buffer' : typeof layer.input) : 'null',
      inputSize: layer.input ? (Buffer.isBuffer(layer.input) ? `${Math.round(layer.input.length / 1024)}KB` : 'unknown') : 'null',
      left: layer.left,
      top: layer.top,
      blend: layer.blend
    }))
  });
  
  compositePipeline = compositePipeline.composite(compositeInputs, {
    blend: 'over',
  });
  
  // NOTE: Visual effects (4K filter, flash, roundabout) are ONLY applied to video/GIF previews
  // Static images should remain clean and professional without animated effects
  // Effects are handled in generate-earthquake-video.js for social media previews
  
  // Apply sharpening and output
  console.log(`[generate-earthquake-image] 🔨 Applying sharpening and generating final PNG...`);
  const composite = await compositePipeline
    .sharpen({
      sigma: 0.5,
      flat: 1.0,
      jagged: 2.0
    })
    .png({ 
      quality: 100,
      compressionLevel: 6, // Reduced from 9 to prevent timeouts (6 is still high quality)
      palette: false,
      effort: 4 // Reduced from 10 to prevent timeouts (4 is balanced)
    })
    .toBuffer();
  
  // CRITICAL: Verify the composite buffer is valid
  if (!composite || composite.length === 0) {
    throw new Error('Composite buffer is empty! Image generation failed.');
  }
  
  // CRITICAL: Verify final composite dimensions
  const finalImage = sharp(composite);
  const finalMetadata = await finalImage.metadata();
  console.log(`[generate-earthquake-image] 📐 Final composite metadata:`, {
    width: finalMetadata.width,
    height: finalMetadata.height,
    format: finalMetadata.format,
    size: `${Math.round(composite.length / 1024)}KB`,
    expectedDimensions: `${outputWidth}x${outputHeight}`
  });
  
  if (finalMetadata.width !== outputWidth || finalMetadata.height !== outputHeight) {
    console.error(`[generate-earthquake-image] ❌ CRITICAL: Final composite dimensions mismatch! Expected ${outputWidth}x${outputHeight}, got ${finalMetadata.width}x${finalMetadata.height}`);
    throw new Error(`Final composite dimensions mismatch: expected ${outputWidth}x${outputHeight}, got ${finalMetadata.width}x${finalMetadata.height}`);
  }
  
  // Verify it's a valid PNG by checking magic bytes
  const magicBytes = composite.slice(0, 8);
  const isPNG = magicBytes[0] === 0x89 && magicBytes[1] === 0x50 && magicBytes[2] === 0x4E && magicBytes[3] === 0x47;
  
  if (!isPNG) {
    console.error(`[generate-earthquake-image] ❌ CRITICAL: Generated buffer is not a valid PNG! Magic bytes:`, 
      Array.from(magicBytes.slice(0, 4)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
    throw new Error('Generated image is not a valid PNG file');
  }
  
  // CRITICAL: Verify the composite actually contains visible text by checking pixel stats
  // Sample a region where text should be (top-left area where magnitude/headline are)
  let compositeHasText = false;
  try {
    const compositeStats = await finalImage.stats();
    // Check if the composite has pixels that differ from a solid color (indicating text)
    // Text areas should have varying pixel values
    if (compositeStats.channels && compositeStats.channels.length >= 3) {
      const redChannel = compositeStats.channels[0];
      const greenChannel = compositeStats.channels[1];
      const blueChannel = compositeStats.channels[2];
      
      // If channels have variance (stddev > 0), it means there's variation (likely text)
      // Also check if max values are high enough to indicate visible content
      const hasVariance = (redChannel.stddev > 0 || greenChannel.stddev > 0 || blueChannel.stddev > 0);
      const hasHighValues = (redChannel.max > 50 || greenChannel.max > 50 || blueChannel.max > 50);
      compositeHasText = hasVariance && hasHighValues;
      
      console.log(`[generate-earthquake-image] 📊 Final composite pixel analysis:`, {
        hasVariance: hasVariance,
        hasHighValues: hasHighValues,
        redStddev: redChannel.stddev?.toFixed(2),
        greenStddev: greenChannel.stddev?.toFixed(2),
        blueStddev: blueChannel.stddev?.toFixed(2),
        redMax: redChannel.max,
        greenMax: greenChannel.max,
        blueMax: blueChannel.max,
        compositeHasText: compositeHasText
      });
      
      if (!compositeHasText && compositeInputs.length > 0) {
        console.error(`[generate-earthquake-image] ❌ CRITICAL: Final composite appears to have no visible text! Composite may be identical to template.`);
        console.error(`[generate-earthquake-image] ❌ This suggests the text overlay was not properly composited.`);
      }
    }
  } catch (statsError) {
    console.warn(`[generate-earthquake-image] ⚠️ Could not analyze final composite stats:`, statsError.message);
  }
  
  // Log final info
  console.log(`[generate-earthquake-image] ✅ IMAGE GENERATION COMPLETE:`, {
    dimensions: `${outputWidth}x${outputHeight}`,
    templateSize: `${actualWidth}x${actualHeight}`,
    scaleFactor: scaleFactor.toFixed(3),
    fileSize: `${Math.round(composite.length / 1024)}KB`,
    isValidPNG: isPNG,
    containsText: true, // Template already has text baked in
    containsUSGSImages: successfullyAddedImages > 0,
    magnitude: magnitudeText,
    location: location.toUpperCase(),
    totalCompositeLayers: compositeInputs.length
  });
  console.log(`[generate-earthquake-image] Font loaded: ${!!FONT_DATA.regular && !!FONT_DATA.bold}`);
  
  return composite;
}

// Export for direct function calls (from other Netlify functions)
exports.generateImage = generateImage;
exports.storeImage = storeImage;

/**
 * Store generated image using Netlify Blobs SDK (v8.2.0 is CommonJS compatible)
 */
async function storeImage(imageBuffer, eventId, templateType = 'standard') {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN;
  const storeName = "post-media";
  const imageKey = `earthquake-${eventId}-${templateType}-${Date.now()}.png`;
  
  if (!siteID || !token) {
    console.warn('[generate-earthquake-image] ⚠️ Missing NETLIFY_SITE_ID or NETLIFY_BLOB_READ_WRITE_TOKEN, cannot store image');
    // Return a placeholder URL - image won't be accessible but function won't fail
    const baseUrl = process.env.URL || 'https://noteworthynews.co';
    return `${baseUrl}/.netlify/functions/get-uploaded-image?key=${encodeURIComponent(imageKey)}`;
  }
  
  // Ensure imageBuffer is a proper Buffer
  let bufferToSend = imageBuffer;
  if (!Buffer.isBuffer(imageBuffer)) {
    console.warn(`[generate-earthquake-image] ⚠️ Image buffer is not a Buffer, converting...`);
    bufferToSend = Buffer.from(imageBuffer);
  }
  
  console.log(`[generate-earthquake-image] 📤 Storing image: ${imageKey} (${Math.round(bufferToSend.length / 1024)}KB) to ${storeName}`);
  
  try {
    // Use SDK instead of REST API - SDK handles propagation and S3 uploads better
    const { getStore } = require("@netlify/blobs");
  
  const store = getStore({
      name: storeName,
    siteID: siteID,
    token: token,
  });
  
    // Store using SDK - this should handle the actual S3 upload properly
    await store.set(imageKey, bufferToSend, {
      contentType: 'image/png',
    });
    
    console.log(`[generate-earthquake-image] ✅ Image stored via SDK: ${imageKey} (${Math.round(bufferToSend.length / 1024)}KB) in store: ${storeName}`);
    
    // Verify the image was actually stored by trying to retrieve it
    // Wait a moment for S3 propagation
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds for S3 propagation
    
    try {
      // Must specify type: "arrayBuffer" to properly retrieve binary image data
      const verifyImage = await store.get(imageKey, { type: "arrayBuffer" });
      if (verifyImage && verifyImage.byteLength > 0) {
        console.log(`[generate-earthquake-image] ✅ Image verified in store: ${imageKey} (${verifyImage.byteLength} bytes)`);
        
        // Also verify it's actually a valid PNG by checking magic bytes
        const firstBytes = new Uint8Array(verifyImage.slice(0, 4));
        const isPNG = firstBytes[0] === 0x89 && firstBytes[1] === 0x50 && firstBytes[2] === 0x4E && firstBytes[3] === 0x47;
        if (isPNG) {
          console.log(`[generate-earthquake-image] ✅ Verified image is valid PNG format`);
        } else {
          console.warn(`[generate-earthquake-image] ⚠️ Image retrieved but magic bytes don't match PNG`);
        }
      } else {
        console.warn(`[generate-earthquake-image] ⚠️ Image verification failed - image not found in store or empty`);
      }
    } catch (verifyError) {
      console.warn(`[generate-earthquake-image] ⚠️ Could not verify image storage:`, verifyError.message);
    }
    
  } catch (error) {
    console.error(`[generate-earthquake-image] ❌ Failed to store image via SDK:`, error.message);
    console.error(`[generate-earthquake-image] ❌ Error stack:`, error.stack);
    
    // Check if it's an authentication error (401)
    if (error.message && (error.message.includes('401') || error.message.includes('Unauthorized') || error.message.includes('authentication'))) {
      console.error(`[generate-earthquake-image] ❌ 401 Unauthorized - Netlify Blobs authentication failed`, {
        hasSiteID: !!siteID,
        hasToken: !!token,
        tokenLength: token ? token.length : 0,
        error: error.message
      });
      console.error(`[generate-earthquake-image] ⚠️ SOLUTION: Check NETLIFY_BLOB_READ_WRITE_TOKEN in Netlify environment variables`);
      console.error(`[generate-earthquake-image] ⚠️ Regenerate token at: https://app.netlify.com/sites/YOUR_SITE/settings/deploys#environment-variables`);
    }
    
    // Don't fail the entire function - return URL anyway (image might still be accessible)
  }
  
  // Build absolute URL for retrieval
  const baseUrl = process.env.URL || 'https://noteworthynews.co';
  const imageUrl = `${baseUrl}/.netlify/functions/get-uploaded-image?key=${encodeURIComponent(imageKey)}`;
  
  // Validate URL is accessible (HEAD request)
  // Wait a bit longer for get-uploaded-image to be able to access the image
  // (Blobs API might have eventual consistency)
  try {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Additional 1 second wait
    const validateResponse = await fetch(imageUrl, { method: 'HEAD' });
    if (!validateResponse.ok) {
      const errorText = await validateResponse.text().catch(() => '');
      console.warn(`[generate-earthquake-image] ⚠️ Image URL validation failed: ${validateResponse.status} ${validateResponse.statusText}`, errorText.substring(0, 200));
      console.warn(`[generate-earthquake-image] ⚠️ Image was stored via SDK but get-uploaded-image can't access it yet`);
      console.warn(`[generate-earthquake-image] ⚠️ This might be a propagation delay - image should be accessible soon`);
    } else {
      console.log(`[generate-earthquake-image] ✅ Image URL validated: ${imageUrl} (${validateResponse.headers.get('content-type')})`);
    }
  } catch (validateError) {
    console.warn(`[generate-earthquake-image] ⚠️ Could not validate image URL:`, validateError.message);
    // Don't fail - URL might work even if validation fails
  }
  
  return imageUrl;
}

/**
 * Main handler
 */
exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
  
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }
  
  try {
    const body = JSON.parse(event.body || "{}");
    // PHASE 5: Accept eventId/detailUrl instead of usgsImages
    const { magnitude, location, eventId, coordinates, detailUrl } = body;
    
    if (!magnitude || !location || !eventId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Missing required fields: magnitude, location, eventId",
        }),
      };
    }
    
    console.log(`[generate-earthquake-image] Generating image for M${magnitude} near ${location} (eventId: ${eventId})`);
    
    // PHASE 5: New signature - pass eventId/detailUrl instead of usgsImages
    // The function will fetch GeoJSON detail and extract products internally
    const imageBuffer = await generateImage(magnitude, location, eventId, 'standard', coordinates, detailUrl);
    const imageUrl = await storeImage(imageBuffer, eventId, 'standard');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        url: imageUrl,
        eventId: eventId,
      }),
    };
    
  } catch (error) {
    console.error('[generate-earthquake-image] ❌ ERROR:', error);
    console.error('[generate-earthquake-image] ❌ Error name:', error?.name);
    console.error('[generate-earthquake-image] ❌ Error message:', error?.message);
    console.error('[generate-earthquake-image] ❌ Error stack:', error?.stack);
    
    // Provide detailed error information
    const errorDetails = {
      error: error?.message || "Internal server error",
      name: error?.name || "Error",
      type: error?.constructor?.name || "Unknown",
    };
    
    // Add specific error context
    if (error?.message?.includes('Template not found')) {
      errorDetails.details = 'Template file (3rdUSGSTemp.png) could not be loaded';
    } else if (error?.message?.includes('Font')) {
      errorDetails.details = 'Font loading or validation failed';
    } else if (error?.message?.includes('resvg')) {
      errorDetails.details = 'SVG rendering failed (resvg error)';
    } else if (error?.message?.includes('Sharp')) {
      errorDetails.details = 'Image processing failed (Sharp error)';
    }
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify(errorDetails),
    };
  }
};
