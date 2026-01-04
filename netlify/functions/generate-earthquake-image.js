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
const HEADLINE_BASELINE_Y_BASE = 200;
const HEADLINE_BLOCK_OFFSET_Y = 100;
const HEADLINE_BASELINE_Y = HEADLINE_BASELINE_Y_BASE + HEADLINE_BLOCK_OFFSET_Y;
const LOCATION_OFFSET = 75;

// SAFE TEXT AREA
const SAFE_LEFT = ANCHOR_X + ALIGN_SHIFT_X;
const SAFE_RIGHT_RATIO = 0.58;

// Headline - Updated format: "BREAKING: M___ Earthquake Near ___."
const BREAKING_TEXT = "BREAKING:";
const EARTHQUAKE_NEAR_TEXT = "Earthquake Near";
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
  // Format: "BREAKING: M#.# Earthquake Near [Location]."
  const escapedBreaking = escapeSVGText(BREAKING_TEXT);
  const escapedMag = escapeSVGText(magnitudeText);
  const escapedEarthquakeNear = escapeSVGText(EARTHQUAKE_NEAR_TEXT);
  // Location with proper capitalization and period
  const locationFormatted = locationText.charAt(0).toUpperCase() + locationText.slice(1).toLowerCase() + '.';
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
  
  // Measure text widths for new format: "BREAKING: M#.# Earthquake Near [Location]."
  let breakingWidth = estimateTextWidth(BREAKING_TEXT, headlineFontSize);
  let magWidth = estimateTextWidth(magnitudeText, magnitudeFontSize);
  let earthquakeNearWidth = estimateTextWidth(EARTHQUAKE_NEAR_TEXT, headlineFontSize);
  let locationFontSize = Math.round(LOCATION_FONT_SIZE_EXACT * scaleFactor);
  const locationFontSizeMin = Math.round(LOCATION_FONT_SIZE_MIN * scaleFactor);
  let locationWidth = estimateTextWidth(locationFormatted, locationFontSize);
  
  // Calculate total width for first line: "BREAKING: M#.# Earthquake Near"
  let firstLineWidth = breakingWidth + scaledTextGap + magWidth + scaledTextGap + earthquakeNearWidth;
  
  // Calculate total width for second line: "[Location]."
  let secondLineWidth = locationWidth;
  
  // Auto-reduce font sizes if needed
  const maxLineWidth = Math.max(firstLineWidth, secondLineWidth);
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
    firstLineWidth = breakingWidth + scaledTextGap + magWidth + scaledTextGap + earthquakeNearWidth;
    secondLineWidth = locationWidth;
    
    console.log(`[generate-earthquake-image] Text auto-sized: headline=${headlineFontSize}px, location=${locationFontSize}px`);
  }
  
  // Position for first line: "BREAKING: M#.# Earthquake Near"
  const breakingX = alignedX;
  const magX = alignedX + breakingWidth + scaledTextGap;
  const earthquakeNearX = alignedX + breakingWidth + scaledTextGap + magWidth + scaledTextGap;
  const firstLineY = scaledHeadlineBaselineY;
  
  // Position for second line: "[Location]."
  const locationX = alignedX;
  const locationY = scaledHeadlineBaselineY + scaledLocationOffset;
  
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
      <!-- BREAKING: (white, bold) -->
      <text 
        x="${breakingX}" 
        y="${firstLineY}" 
        font-family="${fontFamily}" 
        font-size="${headlineFontSize}" 
        font-weight="bold"
        fill="${HEADLINE_COLOR}"
        text-rendering="optimizeLegibility"
        shape-rendering="geometricPrecision">
        ${escapedBreaking}
      </text>
      
      <!-- Magnitude: M#.# (red, bold) -->
      <text 
        x="${magX}" 
        y="${firstLineY}" 
        font-family="${fontFamily}" 
        font-size="${magnitudeFontSize}" 
        font-weight="bold"
        fill="${MAGNITUDE_COLOR}"
        text-rendering="optimizeLegibility"
        shape-rendering="geometricPrecision">
        ${escapedMag}
      </text>
      
      <!-- Earthquake Near (white, bold) -->
      <text 
        x="${earthquakeNearX}" 
        y="${firstLineY}" 
        font-family="${fontFamily}" 
        font-size="${headlineFontSize}" 
        font-weight="bold"
        fill="${HEADLINE_COLOR}"
        text-rendering="optimizeLegibility"
        shape-rendering="geometricPrecision">
        ${escapedEarthquakeNear}
      </text>
      
      <!-- Location: e.g. California. (red, bold) -->
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
async function downloadImage(url, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      console.log(`[generate-earthquake-image] 📥 Downloading image (attempt ${attempt + 1}/${retries}): ${url.substring(0, 100)}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NoteworthyNews/1.0)',
          'Accept': 'image/png,image/jpeg,image/gif,image/webp,*/*'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) {
        console.warn(`[generate-earthquake-image] ⚠️ Response is not an image (content-type: ${contentType}), but proceeding...`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      // Validate it's actually an image by checking magic bytes
      const bytes = new Uint8Array(arrayBuffer);
      const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
      const isJPEG = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
      const isGIF = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
      const isWebP = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && 
                     bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
      
      if (!isPNG && !isJPEG && !isGIF && !isWebP) {
        console.warn(`[generate-earthquake-image] ⚠️ Downloaded data doesn't appear to be a valid image (magic bytes: ${Array.from(bytes.slice(0, 4)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}), but proceeding...`);
      }
      
      const buffer = Buffer.from(arrayBuffer);
      console.log(`[generate-earthquake-image] ✅ Successfully downloaded image: ${Math.round(buffer.length / 1024)}KB (${contentType})`);
      return buffer;
      
    } catch (error) {
      const isLastAttempt = attempt === retries - 1;
      if (error.name === 'AbortError') {
        console.error(`[generate-earthquake-image] ❌ Download timeout (attempt ${attempt + 1}/${retries}): ${url.substring(0, 100)}`);
      } else {
        console.error(`[generate-earthquake-image] ❌ Download failed (attempt ${attempt + 1}/${retries}): ${error.message}`);
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
 * Generate location map image URL from coordinates
 * CREDIBILITY REQUIREMENTS:
 * - Always includes epicenter marker (red dot/pin)
 * - Marker size scales with magnitude (subtle for M<3, more visible for M5+)
 * - Uses terrain map style (NOT satellite imagery)
 * - Returns null if coordinates are missing (map omitted entirely)
 */
function generateLocationMapUrl(lat, lon, magnitude = 0, zoom = 11, width = 600, height = 400) {
  if (lat == null || lon == null) return null;
  
  // Scale marker prominence by magnitude for credibility
  // Always use red-pushpin (standard supported marker style)
  // Adjust zoom level to control marker prominence:
  // - M < 3: Lower zoom (wider view) = marker appears smaller/more subtle
  // - M 3-5: Medium zoom = balanced view
  // - M 5+: Higher zoom (closer view) = marker appears larger/more prominent
  const markerStyle = 'red-pushpin'; // Standard marker, always visible
  
  // Adjust zoom level based on magnitude for marker prominence and context
  let adjustedZoom = zoom;
  if (magnitude >= 6.0) {
    adjustedZoom = 11; // Closer view for major quakes (marker more prominent)
  } else if (magnitude >= 5.0) {
    adjustedZoom = 11; // Standard zoom for significant quakes
  } else if (magnitude >= 3.0) {
    adjustedZoom = 10; // Slightly wider view for medium quakes
  } else {
    adjustedZoom = 9; // Wider view for small quakes (marker appears more subtle)
  }
  
  // Primary: OpenStreetMap France static map service (terrain style, NOT satellite)
  // Always includes epicenter marker for credibility
  const mapUrl = `https://staticmap.openstreetmap.fr/staticmap.php?center=${lat},${lon}&zoom=${adjustedZoom}&size=${width}x${height}&markers=${lat},${lon},${markerStyle}&maptype=terrain`;
  
  return mapUrl;
}

async function generateImage(magnitude, location, usgsImages, eventId, templateType = 'standard', coordinates = null) {
  // CRITICAL: Validate usgsImages is an array BEFORE any operations
  // This prevents TypeError from .slice() or .length on non-array types
  if (!Array.isArray(usgsImages)) {
    console.warn(`[generate-earthquake-image] ⚠️ usgsImages is not an array, converting:`, {
      type: typeof usgsImages,
      value: usgsImages
    });
    usgsImages = usgsImages ? [usgsImages] : [];
  }
  
  // Now safe to log with array operations
  console.log(`[generate-earthquake-image] 📥 INPUT VALIDATION:`, {
    magnitude,
    location,
    eventId,
    hasUsgsImages: !!(usgsImages && usgsImages.length > 0),
    usgsImageCount: usgsImages?.length || 0,
    usgsImagesType: typeof usgsImages,
    isArray: Array.isArray(usgsImages),
    usgsImagesPreview: usgsImages && usgsImages.length > 0 ? JSON.stringify(usgsImages.slice(0, 2).map(img => ({
      hasUrl: !!img?.url,
      url: img?.url?.substring(0, 80),
      type: img?.type,
      filename: img?.filename
    }))) : 'null'
  });
  // Load template
  const possiblePaths = [
    path.join(__dirname, '2ndUSGSTemp.png'),
    path.join(path.dirname(__dirname), '2ndUSGSTemp.png'),
    path.join(__dirname, '../../2ndUSGSTemp.png'),
    path.join(process.cwd(), 'netlify/functions/2ndUSGSTemp.png'),
    path.join(process.cwd(), '2ndUSGSTemp.png'),
    path.resolve('./2ndUSGSTemp.png'),
    '/var/task/netlify/functions/2ndUSGSTemp.png',
    '/var/task/2ndUSGSTemp.png',
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
    
    for (const httpPath of [`${baseUrl}/2ndUSGSTemp.png`, `${baseUrl}/netlify/functions/2ndUSGSTemp.png`]) {
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
  
  // Format magnitude text
  const magnitudeText = `M${magnitude.toFixed(1)}`;
  
  // STEP 6: Validate font loading (MANDATORY - THROW ERROR IF FAILS)
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
  const locationFormattedForLog = location ? (location.charAt(0).toUpperCase() + location.slice(1).toLowerCase() + '.') : 'Unknown Location.';
  
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
  
  // Add USGS images if provided
  // CRITICAL: We need at least one image, so log if none are provided
  const IMAGE_AREA_Y = Math.round(410 * scaleFactor);
  const IMAGE_AREA_HEIGHT = Math.round(250 * scaleFactor);
  const IMAGE_PADDING = Math.round(20 * scaleFactor);
  const IMAGE_SPACING = Math.round(15 * scaleFactor);
  
  console.log(`[generate-earthquake-image] 📸 USGS Image Processing:`, {
    hasUsgsImages: !!(usgsImages && usgsImages.length > 0),
    usgsImageCount: usgsImages?.length || 0,
    imageAreaY: IMAGE_AREA_Y,
    imageAreaHeight: IMAGE_AREA_HEIGHT,
    imagePadding: IMAGE_PADDING,
    imageSpacing: IMAGE_SPACING,
    scaleFactor: scaleFactor.toFixed(3)
  });
  
  let successfullyAddedImages = 0;
  let usgsImageCount = 0; // Track how many USGS images were successfully added
  let locationMapCount = 0; // Track how many location maps were successfully added
  
  // Extract coordinates if provided
  const lat = coordinates?.[1] ?? null;
  const lon = coordinates?.[0] ?? null;
  const hasCoordinates = lat != null && lon != null;
  
  console.log(`[generate-earthquake-image] 🗺️ Coordinate check:`, {
    hasCoordinates,
    lat,
    lon,
    coordinatesProvided: !!coordinates
  });
  
  // CRITICAL: Calculate total number of images upfront to determine correct width for all images
  // This prevents misalignment when location map is added after USGS images
  const maxUsgsImages = Math.min(usgsImages?.length || 0, 2);
  const willAddMap = hasCoordinates && maxUsgsImages < 2;
  const totalImages = maxUsgsImages + (willAddMap ? 1 : 0);
    const imageAreaWidth = outputWidth - (IMAGE_PADDING * 2);
  // Calculate image width based on TOTAL images (USGS + location map), not just USGS
  const imageWidth = totalImages === 2 
      ? Math.floor((imageAreaWidth - IMAGE_SPACING) / 2)
      : imageAreaWidth;
  
  console.log(`[generate-earthquake-image] 📐 Image dimension calculation:`, {
    maxUsgsImages,
    willAddMap,
    totalImages,
    imageAreaWidth,
    imageWidth,
    imageHeight: IMAGE_AREA_HEIGHT
  });
  
  if (usgsImages && usgsImages.length > 0) {
    const numImages = Math.min(usgsImages.length, 2);
    
    console.log(`[generate-earthquake-image] 📸 Processing ${numImages} USGS image(s) with width ${imageWidth}px (total images will be ${totalImages}):`, {
      imageAreaWidth,
      imageWidth,
      imageHeight: IMAGE_AREA_HEIGHT,
      totalImages,
      usgsImageUrls: usgsImages.slice(0, 2).map(img => img.url?.substring(0, 100))
    });
    
    // CRITICAL: Try ALL USGS images, not just the first 2, in case some fail
    const imagesToTry = usgsImages.slice(0, Math.min(usgsImages.length, 4)); // Try up to 4 in case some fail
    
    for (let i = 0; i < imagesToTry.length && successfullyAddedImages < 2; i++) {
      const usgsImage = imagesToTry[i];
      if (!usgsImage || !usgsImage.url) {
        console.warn(`[generate-earthquake-image] ⚠️ USGS image ${i + 1} missing URL, skipping`);
        continue;
      }
      
      try {
        console.log(`[generate-earthquake-image] 📥 Downloading USGS image ${i + 1}/${imagesToTry.length} from: ${usgsImage.url}`);
        const imageBuffer = await downloadImage(usgsImage.url);
        if (imageBuffer) {
          console.log(`[generate-earthquake-image] ✅ Downloaded USGS image ${i + 1}: ${Math.round(imageBuffer.length / 1024)}KB`);
          console.log(`[generate-earthquake-image] 🔧 Processing USGS image ${i + 1} to ${imageWidth}x${IMAGE_AREA_HEIGHT}`);
          const processedImage = await prepareUSGSImage(imageBuffer, imageWidth, IMAGE_AREA_HEIGHT);
          if (processedImage) {
            const x = IMAGE_PADDING + (successfullyAddedImages * (imageWidth + IMAGE_SPACING));
            const y = IMAGE_AREA_Y;
            
            console.log(`[generate-earthquake-image] 📍 Positioning USGS image ${successfullyAddedImages + 1} at (${x}, ${y})`);
            
            compositeInputs.push({
              input: processedImage,
              left: x,
              top: y,
              blend: 'over',
            });
            successfullyAddedImages++;
            usgsImageCount++;
            console.log(`[generate-earthquake-image] ✅ Added USGS image ${usgsImageCount}/2 to composite`, { 
              url: usgsImage.url.substring(0, 80),
              position: `(${x}, ${y})`,
              size: `${imageWidth}x${IMAGE_AREA_HEIGHT}`,
              bufferSize: `${Math.round(processedImage.length / 1024)}KB`,
              type: usgsImage.type,
              scraped: usgsImage.scraped || false
            });
            
            // Stop if we have 2 images
            if (successfullyAddedImages >= 2) {
              console.log(`[generate-earthquake-image] ✅ Reached maximum of 2 images, stopping`);
              break;
            }
          } else {
            console.error(`[generate-earthquake-image] ❌ prepareUSGSImage returned null for image ${i + 1} - will try next image`);
          }
        } else {
          console.error(`[generate-earthquake-image] ❌ downloadImage returned null for image ${i + 1} (URL may be invalid or inaccessible) - will try next image`);
        }
      } catch (error) {
        console.error(`[generate-earthquake-image] ❌ Error processing USGS image ${i + 1}:`, {
          error: error.message,
          stack: error.stack,
          url: usgsImage.url?.substring(0, 100),
          type: usgsImage.type,
          scraped: usgsImage.scraped || false
        });
        // Continue to next image instead of failing completely
      }
    }
    
    // CRITICAL: Warn if we had USGS images but none succeeded
    if (usgsImages.length > 0 && successfullyAddedImages === 0) {
      console.error(`[generate-earthquake-image] ❌ CRITICAL: ${usgsImages.length} USGS image(s) were provided but ALL failed to download/process!`);
      console.error(`[generate-earthquake-image] ❌ This should not happen - check image URLs and download function`);
      console.error(`[generate-earthquake-image] ❌ Failed URLs:`, usgsImages.map(img => img.url?.substring(0, 150)));
    }
  } else {
    console.warn(`[generate-earthquake-image] ⚠️ No USGS images provided - image will use template only (no earthquake-specific maps)`);
  }
  
  // Add location map image if coordinates are available and we have space
  // CREDIBILITY: Map always includes epicenter marker, only shown if coordinates are precise
  // This ensures we always have 2 images when coordinates are available (1 USGS + 1 map, or 2 maps if no USGS)
  if (hasCoordinates) {
    const maxTotalImages = 2; // We can fit 2 images side-by-side
    const slotsRemaining = maxTotalImages - successfullyAddedImages;
    
    // Always add location map if we have coordinates and space
    // CRITICAL: Map includes epicenter marker for credibility
    if (slotsRemaining > 0) {
      try {
        // Generate map URL with epicenter marker (scaled by magnitude)
        const mapUrl = generateLocationMapUrl(lat, lon, magnitude, 11, outputWidth, IMAGE_AREA_HEIGHT);
        
        if (mapUrl) {
          console.log(`[generate-earthquake-image] 🗺️ Generating location map with epicenter marker:`, {
            lat,
            lon,
            magnitude,
            url: mapUrl.substring(0, 100)
          });
          
          const mapBuffer = await downloadImage(mapUrl);
          
          if (mapBuffer) {
            console.log(`[generate-earthquake-image] ✅ Downloaded location map: ${Math.round(mapBuffer.length / 1024)}KB`);
            console.log(`[generate-earthquake-image] 🔧 Processing location map to ${imageWidth}x${IMAGE_AREA_HEIGHT}`);
            const processedMap = await prepareUSGSImage(mapBuffer, imageWidth, IMAGE_AREA_HEIGHT);
            
            if (processedMap) {
              // Position map: if we have 1 USGS image, put map next to it; otherwise center it
              const x = IMAGE_PADDING + (successfullyAddedImages * (imageWidth + IMAGE_SPACING));
              const y = IMAGE_AREA_Y;
              
              console.log(`[generate-earthquake-image] 📍 Positioning location map at (${x}, ${y})`);
              
              compositeInputs.push({
                input: processedMap,
                left: x,
                top: y,
                blend: 'over',
              });
              successfullyAddedImages++;
              locationMapCount++;
              console.log(`[generate-earthquake-image] ✅ Added location map to composite (with epicenter marker)`, { 
                position: `(${x}, ${y})`,
                size: `${imageWidth}x${IMAGE_AREA_HEIGHT}`,
                bufferSize: `${Math.round(processedMap.length / 1024)}KB`,
                magnitude,
                hasEpicenterMarker: true
              });
            } else {
              console.error(`[generate-earthquake-image] ❌ prepareUSGSImage returned null for location map`);
            }
          } else {
            console.warn(`[generate-earthquake-image] ⚠️ Failed to download location map`);
          }
        } else {
          console.warn(`[generate-earthquake-image] ⚠️ Could not generate location map URL (missing coordinates)`);
        }
      } catch (error) {
        console.error(`[generate-earthquake-image] ❌ Error processing location map:`, {
          error: error.message,
          stack: error.stack,
          lat,
          lon,
          magnitude
        });
      }
    } else {
      console.log(`[generate-earthquake-image] ℹ️ Location map skipped - all image slots filled (${successfullyAddedImages} USGS images)`);
    }
  } else {
    console.log(`[generate-earthquake-image] ℹ️ No coordinates provided - skipping location map (credibility requirement: map only shown with precise coordinates)`);
  }
  
  // Log final image count
  if (successfullyAddedImages === 0) {
    console.warn(`[generate-earthquake-image] ⚠️ WARNING: No images were successfully added to the final image!`);
    console.warn(`[generate-earthquake-image] ⚠️ The template may have baked-in images, but no earthquake-specific maps will appear.`);
    
    // CRITICAL: If we had USGS images but none worked, this is a problem
    if (usgsImages && usgsImages.length > 0) {
      console.error(`[generate-earthquake-image] ❌ CRITICAL ERROR: ${usgsImages.length} USGS image(s) were provided but NONE were successfully added!`);
      console.error(`[generate-earthquake-image] ❌ This means all image downloads/processing failed.`);
      console.error(`[generate-earthquake-image] ❌ Image will be generated with only location map (if available) or template only.`);
      console.error(`[generate-earthquake-image] ❌ Failed USGS image URLs:`, usgsImages.map(img => ({
        url: img.url?.substring(0, 150),
        type: img.type,
        filename: img.filename,
        scraped: img.scraped || false
      })));
    }
  } else {
    console.log(`[generate-earthquake-image] ✅ Successfully added ${successfullyAddedImages} image(s) to final image:`, {
      usgsImages: usgsImageCount,
      locationMaps: locationMapCount,
      total: successfullyAddedImages
    });
    
    // CRITICAL: Warn if we only have location map when USGS images were expected
    if (usgsImages && usgsImages.length > 0 && usgsImageCount === 0) {
      console.error(`[generate-earthquake-image] ❌ CRITICAL: USGS images were provided (${usgsImages.length}) but NONE were successfully added!`);
      console.error(`[generate-earthquake-image] ❌ Only location map will appear (${locationMapCount} map(s)) - this is NOT acceptable!`);
      console.error(`[generate-earthquake-image] ❌ All USGS image downloads/processing failed. Check URLs and network connectivity.`);
    }
  }
  
  // CRITICAL: Log what will be in the final composite
  console.log(`[generate-earthquake-image] 📊 COMPOSITE LAYERS:`, {
    totalLayers: compositeInputs.length,
    hasTextOverlay: true, // Always first layer
    hasUSGSImages: successfullyAddedImages > 0,
    usgsImageCount: successfullyAddedImages,
    templateDimensions: `${actualWidth}x${actualHeight}`,
    outputDimensions: `${outputWidth}x${outputHeight}`,
    scaleFactor: scaleFactor.toFixed(3),
    magnitudeText: magnitudeText,
    locationText: location.toUpperCase(),
    textOverlaySize: `${Math.round(textOverlayBuffer.length / 1024)}KB`
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
    containsText: compositeHasText || compositeInputs.length > 0, // Use actual check if available
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
    const { magnitude, location, usgsImages, eventId, coordinates } = body;
    
    if (!magnitude || !location || !eventId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Missing required fields: magnitude, location, eventId",
        }),
      };
    }
    
    console.log(`[generate-earthquake-image] Generating image for M${magnitude} near ${location}`);
    
    // Generate single standard image (multi-template can be enabled later if needed)
    // For now, keep it simple and backward compatible
    // coordinates format: [lon, lat, depth] or null
    const imageBuffer = await generateImage(magnitude, location, usgsImages || [], eventId, 'standard', coordinates);
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
      errorDetails.details = 'Template file (2ndUSGSTemp.png) could not be loaded';
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
