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
const crypto = require('crypto');

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
function createDynamicTextSVG(magnitudeText, locationText, templateWidth, templateHeight, scaleFactor = 1.0, earthquakeTimestamp = null, coordinates = null) {
  // Format: "Breaking News:" (line 1), "M#.# EARTHQUAKE NEAR" (line 2), "[LOCATION]" (line 3, all caps), "[TIMESTAMP]" (line 4)
  const escapedBreaking = escapeSVGText(BREAKING_TEXT);
  const escapedMag = escapeSVGText(magnitudeText);
  const escapedEarthquakeNear = escapeSVGText(EARTHQUAKE_NEAR_TEXT);
  // Location in all caps (no period)
  const locationFormatted = locationText.toUpperCase();
  const escapedLocation = escapeSVGText(locationFormatted);
  
  // Format timestamp with milliseconds - show local time and all US timezones
  let timestampText = '';
  if (earthquakeTimestamp) {
    const date = new Date(earthquakeTimestamp);
    
    // Helper function to format time in a specific timezone
    const formatTimeInTimezone = (date, timezone, includeDate = false) => {
      const options = {
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZoneName: 'short'
      };
      if (includeDate) {
        options.month = 'short';
        options.day = 'numeric';
        options.year = 'numeric';
      }
      
      const formatter = new Intl.DateTimeFormat('en-US', options);
      const parts = formatter.formatToParts(date);
      
      let hour = parts.find(p => p.type === 'hour').value;
      const minute = parts.find(p => p.type === 'minute').value;
      const second = parts.find(p => p.type === 'second').value;
      const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value || '';
      const tzName = parts.find(p => p.type === 'timeZoneName')?.value || '';
      
      // Get milliseconds (need to calculate from UTC)
      const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
      
      let result = `${hour}:${minute}:${second}.${ms} ${dayPeriod} ${tzName}`;
      
      if (includeDate) {
        const month = parts.find(p => p.type === 'month').value;
        const day = parts.find(p => p.type === 'day').value;
        const year = parts.find(p => p.type === 'year').value;
        result = `${month} ${day}, ${year} • ${result}`;
      }
      
      return result;
    };
    
    // Estimate local timezone from coordinates (rough approximation)
    let localTimezone = 'UTC';
    if (coordinates) {
      const lat = coordinates[1] ?? coordinates?.lat ?? null;
      const lon = coordinates[0] ?? coordinates?.lon ?? null;
      
      if (lon != null) {
        // Rough timezone estimation based on longitude
        // Each 15 degrees of longitude ≈ 1 hour timezone difference
        if (lon >= -67.5 && lon < -52.5) {
          localTimezone = 'America/New_York'; // EST/EDT
        } else if (lon >= -82.5 && lon < -67.5) {
          localTimezone = 'America/New_York'; // EST/EDT (eastern US)
        } else if (lon >= -97.5 && lon < -82.5) {
          localTimezone = 'America/Chicago'; // CST/CDT (central US)
        } else if (lon >= -112.5 && lon < -97.5) {
          localTimezone = 'America/Denver'; // MST/MDT (mountain US)
        } else if (lon >= -127.5 && lon < -112.5) {
          localTimezone = 'America/Los_Angeles'; // PST/PDT (pacific US)
        } else if (lon >= -142.5 && lon < -127.5) {
          localTimezone = 'America/Anchorage'; // AKST/AKDT (Alaska)
        } else if (lon >= -157.5 && lon < -142.5) {
          localTimezone = 'Pacific/Honolulu'; // HST (Hawaii)
        }
      }
    }
    
    // Format local time at earthquake location
    const localTime = formatTimeInTimezone(date, localTimezone, true);
    
    // Format all US timezones
    const estTime = formatTimeInTimezone(date, 'America/New_York');
    const cstTime = formatTimeInTimezone(date, 'America/Chicago');
    const mstTime = formatTimeInTimezone(date, 'America/Denver');
    const pstTime = formatTimeInTimezone(date, 'America/Los_Angeles');
    const akstTime = formatTimeInTimezone(date, 'America/Anchorage');
    const hstTime = formatTimeInTimezone(date, 'Pacific/Honolulu');
    
    // Build timestamp text: Local time first, then all US timezones
    // Format: "Local: Jan 10, 2026 • 4:20:36.261 PM EST | EST: 4:20:36.261 PM EST | CST: 3:20:36.261 PM CST | ..."
    timestampText = `Local: ${localTime} | EST: ${estTime} | CST: ${cstTime} | MST: ${mstTime} | PST: ${pstTime} | AKST: ${akstTime} | HST: ${hstTime}`;
  }
  const escapedTimestamp = escapeSVGText(timestampText);
  
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
  
  // Position for line 4: "[TIMESTAMP]" (if available)
  // Position timestamp at top left of image
  // Use smaller font since we're showing multiple timezones
  const timestampX = Math.round(20 * scaleFactor); // 20px from left edge
  const timestampY = Math.round(30 * scaleFactor); // 30px from top edge
  const timestampFontSize = Math.round(14 * scaleFactor); // Smaller font for multiple timezones
  
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
      
      ${timestampText ? `
      <!-- Timestamp: Shows local time and all US timezones (EST, CST, MST, PST, AKST, HST) with milliseconds - Top left corner -->
      <text 
        x="${timestampX}" 
        y="${timestampY}" 
        font-family="${fontFamily}" 
        font-size="${timestampFontSize}" 
        font-weight="normal"
        fill="${HEADLINE_COLOR}"
        opacity="0.9"
        text-rendering="optimizeLegibility"
        shape-rendering="geometricPrecision">
        ${escapedTimestamp}
      </text>
      ` : ''}
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
  
  // Fading ripple rings - progressively fainter
  const ringCount = 5; // Number of rings
  const maxRingRadius = Math.min(width, height) * 0.4; // Maximum ring radius
  const ringSpacing = maxRingRadius / ringCount; // Space between rings
  
  // Magnitude-based color (red for high, yellow for medium, white for low)
  const magnitudeColor = magnitude >= 6.0 ? 'rgba(255, 30, 30, 0.9)' : 
                         magnitude >= 4.0 ? 'rgba(255, 180, 40, 0.8)' : 
                         'rgba(255, 255, 255, 0.7)';
  
  // Generate ripple rings with fading opacity
  const rippleRings = [];
  for (let i = 0; i < ringCount; i++) {
    const ringRadius = ringSpacing * (i + 1);
    // Opacity decreases from 0.6 to 0.05 (fainter and fainter)
    const ringOpacity = 0.6 - (i * 0.11); // 0.6, 0.49, 0.38, 0.27, 0.16
    const ringThickness = (3 - i * 0.4) * scaleFactor; // Thinner rings as they get fainter
    rippleRings.push({ radius: ringRadius, opacity: ringOpacity, thickness: ringThickness });
  }
  
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
        
        <!-- Ripple ring gradients (fading outward) -->
        ${rippleRings.map((ring, i) => `
        <radialGradient id="rippleGradient${i}" cx="50%" cy="50%">
          <stop offset="0%" stop-color="${magnitudeColor}" stop-opacity="${ring.opacity}"/>
          <stop offset="50%" stop-color="${magnitudeColor}" stop-opacity="${ring.opacity * 0.6}"/>
          <stop offset="100%" stop-color="${magnitudeColor}" stop-opacity="0"/>
        </radialGradient>
        `).join('')}
      </defs>
      
      <!-- 4K Enhancement overlay (subtle sharpening effect) -->
      <rect x="0" y="0" width="${width}" height="${height}" fill="rgba(255, 255, 255, 0.02)" filter="url(#4kEnhance)" opacity="0.3"/>
      
      <!-- Fading ripple rings (progressively fainter) -->
      ${rippleRings.map((ring, i) => `
      <circle 
        cx="${centerX}" 
        cy="${centerY}" 
        r="${ring.radius}" 
        fill="none" 
        stroke="${magnitudeColor}" 
        stroke-width="${ring.thickness}" 
        opacity="${ring.opacity}"
        stroke-dasharray="${i % 2 === 0 ? '5,5' : 'none'}"
      />
      `).join('')}
      
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
async function downloadImage(url, retries = 5, eventId = null) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      console.log(`[generate-earthquake-image] 📥 Downloading image (attempt ${attempt + 1}/${retries}): ${url.substring(0, 100)}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      // STRICT: Manual redirect handling to validate event binding
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'manual',  // Don't follow redirects automatically
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/png,image/jpeg,image/gif,image/webp,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://noteworthynews.co/'
        }
      });
      
      clearTimeout(timeoutId);
      
      // STRICT: Validate redirects before following
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const redirectUrl = response.headers.get('location');
        if (!redirectUrl) {
          throw new Error(`Redirect with no location header (status ${response.status})`);
        }
        
        // Resolve absolute URL
        const absoluteRedirectUrl = new URL(redirectUrl, url).toString();
        
        // STRICT: Verify redirect URL is bound to eventId
        if (eventId && !verifyEventBinding(absoluteRedirectUrl, eventId)) {
          throw new Error(`Redirect URL not bound to eventId ${eventId}: ${absoluteRedirectUrl.substring(0, 100)}`);
        }
        
        console.log(`[generate-earthquake-image] 🔄 Following validated redirect: ${absoluteRedirectUrl.substring(0, 100)}`);
        
        // Recursively follow redirect (with remaining retries)
        return downloadImage(absoluteRedirectUrl, retries - attempt, eventId);
      }
      
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
      
      // FORENSIC: Calculate buffer hash for tracking
      const bufferHash = crypto.createHash('sha1').update(buffer).digest('hex').substring(0, 8);
      
      // PHASE 2: Final success log with details + buffer hash
      console.log(`[generate-earthquake-image] ✅ Successfully downloaded image:`, {
        url: url.substring(0, 100),
        attempt: attempt + 1,
        status,
        contentType,
        bufferSize: `${Math.round(buffer.length / 1024)}KB`,
        format: isPNG ? 'PNG' : isJPEG ? 'JPEG' : isGIF ? 'GIF' : isWebP ? 'WebP' : 'unknown',
        bufferHash: bufferHash  // FORENSIC: Hash for cross-event contamination detection
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
 * PHASE 3: Generate fallback location map image (server-side, with actual map tiles)
 * DEPRECATED: Replaced by generateMapboxSatelliteImage
 * Attempts to fetch OpenStreetMap tiles and stitch them, falls back to gradient card if tiles fail
 */
async function renderFallbackMapPng({ lat, lon, zoom = 11, width = 600, height = 400, locationText = null, logger = null }) {
  try {
    // Try to fetch actual map tiles first
    try {
      const mapImage = await fetchAndStitchMapTiles({ lat, lon, zoom, width, height, logger });
      if (mapImage) {
        // Add location pin and text overlay
        const overlaySVG = Buffer.from(`
          <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <!-- Red pin marker at center -->
            <circle cx="${width / 2}" cy="${height / 2}" r="8" fill="#FF0000" stroke="#FFFFFF" stroke-width="2"/>
            <polygon points="${width / 2},${height / 2 + 8} ${width / 2 - 6},${height / 2 + 18} ${width / 2 + 6},${height / 2 + 18}" fill="#FF0000" stroke="#FFFFFF" stroke-width="1"/>
            ${locationText ? `
            <rect x="${width / 2 - 100}" y="${height - 60}" width="200" height="40" fill="rgba(0,0,0,0.7)" rx="4"/>
            <text x="${width / 2}" y="${height - 35}" 
                  font-family="Arial, sans-serif" font-size="14" font-weight="bold" 
                  fill="#FFFFFF" text-anchor="middle">
              ${escapeSVGText(locationText)}
            </text>
            ` : ''}
          </svg>
        `);
        
        const finalImage = await sharp(mapImage)
          .composite([{ input: overlaySVG, blend: 'over' }])
          .png()
          .toBuffer();
        
        if (logger) logger.info(`[renderFallbackMapPng] ✅ Generated map with tiles: ${width}x${height}`);
        return finalImage;
      }
    } catch (tileError) {
      if (logger) logger.warn(`[renderFallbackMapPng] ⚠️ Map tiles failed, using gradient fallback: ${tileError.message}`);
    }
    
    // FALLBACK: Create a simple gradient background (dark to light)
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
    
    if (logger) logger.info(`[renderFallbackMapPng] ✅ Generated gradient fallback map: ${width}x${height}`);
    return mapImage;
  } catch (error) {
    if (logger) logger.error(`[renderFallbackMapPng] ❌ Error generating fallback map: ${error.message}`);
    return null;
  }
}

/**
 * Generate Mapbox Satellite image with epicenter overlay
 * Uses Mapbox Static Images API for satellite imagery
 */
async function generateMapboxSatelliteImage({ lat, lon, zoom, width, height, logger }) {
  // Sanity checks
  if (lat < -85 || lat > 85) {
    throw new Error(`Invalid latitude: ${lat} (must be between -85 and 85)`);
  }
  if (lon < -180 || lon > 180) {
    throw new Error(`Invalid longitude: ${lon} (must be between -180 and 180)`);
  }
  
  const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
  if (!MAPBOX_TOKEN) {
    if (logger) logger.warn(`[generateMapboxSatelliteImage] ⚠️ MAPBOX_TOKEN not set, cannot generate satellite image`);
    throw new Error('MAPBOX_TOKEN environment variable not set');
  }
  
  // Mapbox Static Images API URL
  // Format: https://api.mapbox.com/styles/v1/{username}/{style_id}/static/{lon},{lat},{zoom}/{width}x{height}@{2x}?access_token={token}
  // We use mapbox/satellite-v9 for satellite imagery
  // No overlay markers from Mapbox - we'll add our own
  // Note: URL format is {lon},{lat},{zoom} (lon first, then lat)
  const baseUrl = 'https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static';
  const url = `${baseUrl}/${lon},${lat},${zoom}/${width}x${height}@2x?access_token=${MAPBOX_TOKEN}`;
  
  // CRITICAL: Log the URL (without token) for debugging
  if (logger) {
    const urlWithoutToken = url.replace(/access_token=[^&]+/, 'access_token=***');
    logger.info(`[generateMapboxSatelliteImage] 🔗 Mapbox API URL: ${urlWithoutToken}`);
  }
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'NoteworthyNews/1.0'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Mapbox API error: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`);
    }
    
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    
    if (logger) {
      const bufferHash = getBufferHash(imageBuffer);
      logger.info(`[generateMapboxSatelliteImage] ✅ Mapbox satellite image fetched: ${width}x${height}, bufferHash: ${bufferHash}`);
    }
    
    return imageBuffer;
  } catch (error) {
    if (logger) {
      logger.error(`[generateMapboxSatelliteImage] ❌ Failed to fetch Mapbox satellite image: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Overlay epicenter graphics on satellite image (NO TEXT)
 * Epicenter is at center of image (width/2, height/2) since Mapbox centers on coordinates
 * Includes accurate earthquake rings based on magnitude and zoom level
 */
async function overlayEpicenterGraphics(imageBuffer, width, height, logger, magnitude = null, zoom = null) {
  // Epicenter is at center of image
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Calculate accurate earthquake ring radii based on magnitude and zoom
  // Ring sizes represent approximate felt radius in kilometers
  // At zoom 7 (regional): ~50km per 100px
  // At zoom 11 (local): ~1.5km per 100px
  let ringRadii = [];
  let ringColors = [];
  let ringOpacities = [];
  
  if (magnitude && zoom) {
    // Calculate approximate felt radius in km based on magnitude
    // Formula: felt radius ≈ 10^(magnitude - 3) km (rough approximation)
    const feltRadiusKm = Math.pow(10, magnitude - 3);
    
    // Convert km to pixels based on zoom level
    // Approximate: zoom 7 = ~50km/100px, zoom 11 = ~1.5km/100px
    const kmPerPixel = zoom <= 7 ? 0.5 : (zoom <= 9 ? 0.2 : 0.015);
    const feltRadiusPx = Math.min(feltRadiusKm / kmPerPixel, Math.min(width, height) * 0.4);
    
    // Create multiple rings representing different wave phases
    // Ring 1: P-wave (primary, fastest) - inner ring
    const pWaveRadius = feltRadiusPx * 0.3;
    // Ring 2: S-wave (secondary) - middle ring
    const sWaveRadius = feltRadiusPx * 0.6;
    // Ring 3: Surface wave (most destructive) - outer ring
    const surfaceWaveRadius = feltRadiusPx;
    
    ringRadii = [pWaveRadius, sWaveRadius, surfaceWaveRadius];
    ringColors = ['#60A5FA', '#FBBF24', '#DC2626']; // Blue (P-wave), Yellow (S-wave), Red (Surface)
    ringOpacities = [0.4, 0.5, 0.6];
  } else {
    // Fallback: use fixed-size rings if magnitude/zoom not provided
    ringRadii = [30, 60, 100];
    ringColors = ['#60A5FA', '#FBBF24', '#DC2626'];
    ringOpacities = [0.4, 0.5, 0.6];
  }
  
  // Build SVG rings
  let ringsSVG = '';
  for (let i = 0; i < ringRadii.length; i++) {
    const radius = Math.max(ringRadii[i], 20); // Minimum 20px radius
    ringsSVG += `      <!-- ${i === 0 ? 'P-wave' : i === 1 ? 'S-wave' : 'Surface wave'} ring (${Math.round(radius)}px radius) -->\n`;
    ringsSVG += `      <circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="${ringColors[i]}" stroke-width="${i === ringRadii.length - 1 ? '3' : '2'}" opacity="${ringOpacities[i]}"/>\n`;
  }
  
  // Create SVG overlay with epicenter graphics (NO TEXT)
  const overlaySVG = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
${ringsSVG}      <!-- Crosshair - horizontal line -->
      <line x1="${centerX - 100}" y1="${centerY}" x2="${centerX + 100}" y2="${centerY}" stroke="#FFFFFF" stroke-width="2" opacity="0.9"/>
      
      <!-- Crosshair - vertical line -->
      <line x1="${centerX}" y1="${centerY - 100}" x2="${centerX}" y2="${centerY + 100}" stroke="#FFFFFF" stroke-width="2" opacity="0.9"/>
      
      <!-- Epicenter dot (12px radius, red fill, white stroke) -->
      <circle cx="${centerX}" cy="${centerY}" r="12" fill="#DC2626" stroke="#FFFFFF" stroke-width="3"/>
    </svg>
  `);
  
  try {
    const finalImage = await sharp(imageBuffer)
      .composite([{ input: overlaySVG, blend: 'over' }])
      .png()
      .toBuffer();
    
    if (logger) {
      const overlayHash = getBufferHash(finalImage);
      logger.info(`[overlayEpicenterGraphics] ✅ Epicenter graphics overlaid, bufferHash: ${overlayHash}`);
    }
    
    return finalImage;
  } catch (error) {
    if (logger) {
      logger.error(`[overlayEpicenterGraphics] ❌ Failed to overlay epicenter graphics: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Fetch and stitch OpenStreetMap tiles into a single image
 * CRITICAL: lon is X-axis, lat is Y-axis in Web Mercator
 * DEPRECATED: This function is replaced by generateMapboxSatelliteImage
 */
async function fetchAndStitchMapTiles({ lat, lon, zoom, width, height, logger }) {
  // FORENSIC LOGGING: Log input parameters
  if (logger) {
    logger.info(`[fetchAndStitchMapTiles] 🔍 FORENSIC: Input parameters:`, {
      inputLat: lat,
      inputLon: lon,
      zoom: zoom,
      width: width,
      height: height
    });
  }
  
  const TILE_SIZE = 256;
  const tilesX = Math.ceil(width / TILE_SIZE);
  const tilesY = Math.ceil(height / TILE_SIZE);
  
  // Convert lat/lon to tile coordinates (Web Mercator projection)
  // CRITICAL: lon is X-axis, lat is Y-axis
  function deg2num(lat, lon, zoom) {
    const n = Math.pow(2, zoom);
    // X tile: based on longitude (lon is X-axis)
    const xtile = Math.floor((lon + 180) / 360 * n);
    // Y tile: based on latitude (lat is Y-axis, but Web Mercator uses inverted Y)
    const ytile = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
    return { x: xtile, y: ytile };
  }
  
  const centerTile = deg2num(lat, lon, zoom);
  const startX = centerTile.x - Math.floor(tilesX / 2);
  const startY = centerTile.y - Math.floor(tilesY / 2);
  const endX = startX + tilesX - 1;
  const endY = startY + tilesY - 1;
  
  // FORENSIC LOGGING: Log computed tile coordinates
  if (logger) {
    logger.info(`[fetchAndStitchMapTiles] 🔍 FORENSIC: Computed tile coordinates:`, {
      centerTileX: centerTile.x,
      centerTileY: centerTile.y,
      tileRangeX: { min: startX, max: endX },
      tileRangeY: { min: startY, max: endY },
      tilesX: tilesX,
      tilesY: tilesY,
      stitchedWidth: tilesX * TILE_SIZE,
      stitchedHeight: tilesY * TILE_SIZE
    });
  }
  
  // SANITY CHECK: Verify tile coordinates are reasonable for the input location
  // For LA (lon ~ -118, lat ~ 34), at zoom 11:
  // Expected X tile range: approximately 200-300 (Western US)
  // Expected Y tile range: approximately 300-400 (Southern US)
  // If computed tiles are way off (e.g., X > 1000 or Y > 1000 for zoom 11), something is wrong
  const maxReasonableTile = Math.pow(2, zoom);
  if (centerTile.x < 0 || centerTile.x >= maxReasonableTile || 
      centerTile.y < 0 || centerTile.y >= maxReasonableTile) {
    if (logger) {
      logger.error(`[fetchAndStitchMapTiles] ❌ SANITY CHECK FAILED: Invalid tile coordinates`, {
        centerTileX: centerTile.x,
        centerTileY: centerTile.y,
        maxReasonableTile: maxReasonableTile,
        zoom: zoom,
        inputLat: lat,
        inputLon: lon
      });
    }
    throw new Error(`Invalid tile coordinates: x=${centerTile.x}, y=${centerTile.y} for zoom=${zoom}`);
  }
  
  // Additional sanity check: For Western US (lon < -100), X tile should be roughly in first half
  // For Eastern US (lon > -100), X tile should be roughly in second half
  // This is a rough check - if lon is -118 but X tile is > 500 at zoom 11, something is swapped
  if (lon < -100 && centerTile.x > maxReasonableTile * 0.6) {
    if (logger) {
      logger.error(`[fetchAndStitchMapTiles] ❌ SANITY CHECK FAILED: X tile too high for Western US longitude`, {
        inputLon: lon,
        computedXTile: centerTile.x,
        maxReasonableTile: maxReasonableTile,
        expectedRange: `0-${Math.floor(maxReasonableTile * 0.6)}`
      });
    }
    throw new Error(`X tile coordinate mismatch: lon=${lon} but xTile=${centerTile.x} (expected < ${Math.floor(maxReasonableTile * 0.6)})`);
  }
  
  // Fetch all tiles
  const tilePromises = [];
  for (let y = 0; y < tilesY; y++) {
    for (let x = 0; x < tilesX; x++) {
      const tileX = startX + x;
      const tileY = startY + y;
      const tileUrl = `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;
      
      tilePromises.push(
        fetch(tileUrl, {
          headers: { 'User-Agent': 'NoteworthyNews/1.0' }
        })
          .then(res => res.ok ? res.arrayBuffer() : null)
          .then(buf => buf ? Buffer.from(buf) : null)
          .catch(() => null)
          .then(buffer => ({ x, y, buffer }))
      );
    }
  }
  
  const tiles = await Promise.all(tilePromises);
  const validTiles = tiles.filter(t => t.buffer);
  
  if (validTiles.length === 0) {
    throw new Error('No tiles fetched');
  }
  
  // Stitch tiles together
  const stitchedWidth = tilesX * TILE_SIZE;
  const stitchedHeight = tilesY * TILE_SIZE;
  const composites = [];
  
  for (const tile of validTiles) {
    if (tile.buffer) {
      composites.push({
        input: tile.buffer,
        left: tile.x * TILE_SIZE,
        top: tile.y * TILE_SIZE
      });
    }
  }
  
  let stitched = sharp({
    create: {
      width: stitchedWidth,
      height: stitchedHeight,
      channels: 3,
      background: { r: 200, g: 200, b: 200 }
    }
  });
  
  if (composites.length > 0) {
    stitched = stitched.composite(composites);
  }
  
  // Crop to desired size and center on coordinates
  const cropX = Math.max(0, Math.floor((stitchedWidth - width) / 2));
  const cropY = Math.max(0, Math.floor((stitchedHeight - height) / 2));
  
  const finalImage = await stitched
    .extract({ left: cropX, top: cropY, width: Math.min(width, stitchedWidth - cropX), height: Math.min(height, stitchedHeight - cropY) })
    .resize(width, height, { fit: 'cover' })
    .png()
    .toBuffer();
  
  return finalImage;
}

/**
 * ARCHITECTURE CHANGE: Build exactly 2 validated image sources (EVENT-LOCKED)
 * 
 * MANDATORY FLOW:
 * 1. Fetch GeoJSON detail for eventId (validates event-locking)
 * 2. Extract products ONLY from this eventId's GeoJSON
 * 3. Build ranked candidate list (shakemap/dyfi, intensity/mmi/pga/pgv first)
 * 4. Download and validate top candidates (cap at 4, pick first 2 successful)
 * 5. Fill remaining slots with fallback maps
 * 
 * Returns array of [{ type: "usgs"|"fallback", buffer, label, source }] with exactly 2 items
 */
/**
 * Helper: Generate buffer hash for forensic tracking
 */
function getBufferHash(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) return 'null';
  return crypto.createHash('sha1').update(buffer).digest('hex').substring(0, 8);
}

/**
 * Helper: Normalize event ID by removing prefix
 */
function stripPrefix(id = '') {
  return id.toLowerCase().replace(/^(us|ak|ci|nc|nn|pr|tx|hv|mb|se|uw)/, '');
}

/**
 * Helper: Verify URL is from the same eventId (STRICT event binding)
 * Requires exact path segment match - no partial matching
 */
function verifyEventBinding(url, eventId) {
  if (!url || !eventId) return false;
  const u = url.toLowerCase();
  const id = eventId.toLowerCase();
  
  // Split URL into segments (path + query, but not fragment)
  const segments = u.split(/[\/?#]/g);
  
  // STRICT: Exact segment match (strongest check)
  if (segments.includes(id)) return true;
  
  // Common USGS patterns: ".../eventpage/{id}/..."
  if (u.includes(`/eventpage/${id}/`)) return true;
  
  // Common USGS product patterns: ".../product/{type}/{id}/..."
  if (u.includes(`/product/`) && u.includes(`/${id}/`)) return true;
  
  // NO PARTIAL MATCHES - reject if we get here
  return false;
}

async function buildTwoImageSources({ eventId, detailUrl, coordinates, locationText, imageWidth, imageHeight, logger, magnitude = null }) {
  const sources = [];
  const maxImages = 2;
  const maxCandidatesToDownload = 4; // Download up to 4, pick best 2
  
  logger = logger || { info: console.log, warn: console.warn, error: console.error };
  
  // STEP 0: Extract coordinates for logging
  // CRITICAL: Ensure correct coordinate order
  // coordinates can be: [lon, lat] array OR {lat, lon} object
  const lat = coordinates?.lat ?? coordinates?.[1] ?? null;
  const lon = coordinates?.lon ?? coordinates?.[0] ?? null;
  
  // CRITICAL VALIDATION: Log coordinates to catch mismatches
  if (lat != null && lon != null) {
    logger.info(`[buildTwoImageSources] 🔍 COORDINATE VALIDATION:`, {
      eventId,
      extractedLat: lat,
      extractedLon: lon,
      coordinateFormat: Array.isArray(coordinates) ? 'array [lon, lat]' : 'object {lat, lon}',
      rawCoordinates: coordinates
    });
    
    // Sanity check: lat should be between -90 and 90, lon between -180 and 180
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      logger.error(`[buildTwoImageSources] ❌ INVALID COORDINATES: lat=${lat}, lon=${lon} - OUT OF RANGE!`);
      throw new Error(`Invalid coordinates: lat=${lat}, lon=${lon} (must be lat: -90 to 90, lon: -180 to 180)`);
    }
  }
  
  // STEP 1: Fetch GeoJSON detail for THIS eventId (event-locked)
  let detailJson = null;
  let usgsCandidates = [];
  
  if (eventId || detailUrl) {
    logger.info(`[buildTwoImageSources] 🔒 Fetching event-locked GeoJSON detail for eventId: ${eventId}`);
    
    // Define functions inline (to avoid Supabase dependency in engines/usgs.js)
    // These match the implementation in engines/usgs.js exactly
    async function fetchUsgsDetailGeoJson({ eventId, detailUrl, logger }) {
      let url = detailUrl;
      if (!url && eventId) {
        url = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/${eventId}.geojson`;
      }
      if (!url) {
        if (logger) logger.warn('No detailUrl or eventId provided for GeoJSON fetch');
        return null;
      }
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; NoteworthyNews/1.0)',
            'Accept': 'application/geo+json, application/json'
          }
        });
        if (!response.ok) {
          if (logger) logger.warn('Failed to fetch USGS detail GeoJSON', { url, status: response.status });
          return null;
        }
        const json = await response.json();
        if (logger) logger.info('✅ Fetched USGS detail GeoJSON', { eventId, url, hasProperties: !!json.properties });
        return json;
      } catch (error) {
        if (logger) logger.warn('Error fetching USGS detail GeoJSON', { error: error.message, url, eventId });
        return null;
      }
    }
    
    function extractUsgsProductImages(detailJson) {
      const candidates = [];
      if (!detailJson || !detailJson.properties || !detailJson.properties.products) {
        return candidates;
      }
      const products = detailJson.properties.products;
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
      const pathPreference = ['intensity', 'mmi', 'pga', 'pgv', 'map', 'plot'];
      function scorePath(path) {
        const lowerPath = path.toLowerCase();
        for (let i = 0; i < pathPreference.length; i++) {
          if (lowerPath.includes(pathPreference[i])) {
            return pathPreference.length - i;
          }
        }
        return 0;
      }
      function isImageContent(content) {
        if (!content || !content.url) return false;
        if (content.contentType && content.contentType.startsWith('image/')) {
          return true;
        }
        const url = content.url.toLowerCase();
        if (/\.(png|jpg|jpeg|gif|webp)(\?|$)/.test(url)) {
          if (url.includes('.xml') || url.includes('.json') || url.includes('.txt') ||
              url.includes('/contents') || url.includes('/metadata') || url.includes('/attenuation')) {
            return false;
          }
          return true;
        }
        return false;
      }
      for (const [productType, productList] of Object.entries(products)) {
        if (!Array.isArray(productList) || productList.length === 0) continue;
        const priority = productPriority[productType] || 999;
        for (const product of productList) {
          if (!product || !product.contents || typeof product.contents !== 'object') continue;
          const preferredWeight = product.preferredWeight || 0;
          const updateTime = product.updateTime || 0;
          for (const [path, content] of Object.entries(product.contents)) {
            if (!isImageContent(content)) continue;
            const url = content.url;
            if (candidates.some(c => c.url === url)) continue;
            const pathScore = scorePath(path);
            const candidateScore = priority * 1000 - pathScore * 10 - preferredWeight;
            candidates.push({
              url: url,
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
      candidates.sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        return b.updateTime - a.updateTime;
      });
      return candidates.slice(0, 6);
    }
    
    detailJson = await fetchUsgsDetailGeoJson({ eventId, detailUrl, logger });
    
    if (detailJson) {
      // STRICT EVENT BINDING: Verify GeoJSON is for the same eventId (exact match only)
      const geoJsonEventId = detailJson.id || detailJson.properties?.ids?.split(',')[0]?.trim() || '';
      const geoId = geoJsonEventId.toLowerCase();
      const reqId = (eventId || '').toLowerCase();
      
      // STRICT: Only accept if exact match OR prefix-stripped match
      const geoIdStripped = stripPrefix(geoId);
      const reqIdStripped = stripPrefix(reqId);
      
      const strictMatch = geoId === reqId || geoIdStripped === reqIdStripped;
      
      if (!strictMatch) {
        logger.error(`[buildTwoImageSources] ❌ CRITICAL: GeoJSON eventId STRICT mismatch!`);
        logger.error(`[buildTwoImageSources]   Request eventId: ${reqId} (stripped: ${reqIdStripped})`);
        logger.error(`[buildTwoImageSources]   GeoJSON eventId: ${geoId} (stripped: ${geoIdStripped})`);
        logger.error(`[buildTwoImageSources] ❌ REJECTING ALL USGS IMAGES - will use fallback maps`);
        detailJson = null; // Force fallback
  } else {
        logger.info(`[buildTwoImageSources] ✅ STRICT Event binding verified: eventId=${reqId}, geoJsonId=${geoId}, match=${strictMatch}`);
      }
      
      if (detailJson) {
        // STEP 2: Extract products ONLY from this eventId's GeoJSON
        usgsCandidates = extractUsgsProductImages(detailJson);
        
        // HARD EVENT BINDING: Filter candidates to only those with eventId in URL
        const originalCount = usgsCandidates.length;
        const rejectedCandidates = [];
        usgsCandidates = usgsCandidates.filter(candidate => {
          const isBound = verifyEventBinding(candidate.url, eventId);
          if (!isBound) {
            rejectedCandidates.push({
              url: candidate.url.substring(0, 100),
              productType: candidate.productType,
              path: candidate.path,
              reason: 'eventId not found in URL'
            });
          }
          return isBound;
        });
        
        if (usgsCandidates.length < originalCount) {
          logger.warn(`[buildTwoImageSources] ⚠️ Filtered ${originalCount - usgsCandidates.length} candidates due to event binding check`, {
            eventId,
            rejectedCount: rejectedCandidates.length,
            rejectedCandidates: rejectedCandidates.slice(0, 5)  // Log first 5 rejected
          });
        }
        
        // Log products present (FORENSIC LOGGING)
        const products = detailJson.properties?.products || {};
        const productKeys = Object.keys(products);
        const productCounts = {};
        for (const [key, productList] of Object.entries(products)) {
          productCounts[key] = Array.isArray(productList) ? productList.length : 0;
        }
        
        // FORENSIC: Log products present with strict match status
        const geoJsonEventId = detailJson.id || detailJson.properties?.ids?.split(',')[0]?.trim() || '';
        const geoId = geoJsonEventId.toLowerCase();
        const reqId = (eventId || '').toLowerCase();
        const geoIdStripped = stripPrefix(geoId);
        const reqIdStripped = stripPrefix(reqId);
        const strictMatch = geoId === reqId || geoIdStripped === reqIdStripped;
        
        logger.info(`[buildTwoImageSources] 📦 FORENSIC: Products present:`, {
          eventId: reqId,
          geoJsonEventId: geoId,
          strictMatch: strictMatch,
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
            eventIdInUrl: verifyEventBinding(c.url, eventId),
            urlBindingPassed: verifyEventBinding(c.url, eventId)
          }))
        });
        
        // HARD GUARD: If no candidates, force fallback-only mode
        const forceFallbackOnly = usgsCandidates.length === 0;
        if (forceFallbackOnly) {
          logger.warn(`[buildTwoImageSources] 🔒 FORCE FALLBACK-ONLY: candidateCount=0, skipping ALL USGS downloads`);
          logger.warn(`[buildTwoImageSources] 🔒 This event has NO shakemap/dyfi/pager products - will generate fallback maps only`);
        } else {
          // STEP 3: Download and validate top candidates (cap at 4)
          const candidatesToDownload = usgsCandidates.slice(0, maxCandidatesToDownload);
          logger.info(`[buildTwoImageSources] 📥 Downloading top ${candidatesToDownload.length} candidate(s) (max ${maxCandidatesToDownload})...`);
          
          for (const candidate of candidatesToDownload) {
          if (sources.length >= maxImages) break;
          
          try {
            // HARD EVENT BINDING: Double-check URL contains eventId
            if (!verifyEventBinding(candidate.url, eventId)) {
              logger.error(`[buildTwoImageSources] ❌ REJECTED: URL does not contain eventId ${eventId}: ${candidate.url.substring(0, 100)}`);
              continue;
            }
            
            const imageBuffer = await downloadImage(candidate.url, 3, eventId);
            if (imageBuffer) {
              const bufferHash = getBufferHash(imageBuffer);
              logger.info(`[buildTwoImageSources] 📥 Downloaded image buffer hash: ${bufferHash} (${candidate.url.substring(0, 80)})`);
              
              // Validate content type
              const processedImage = await prepareUSGSImage(imageBuffer, imageWidth, imageHeight);
              if (processedImage) {
                const processedHash = getBufferHash(processedImage);
                sources.push({
                  type: 'usgs',
                  buffer: processedImage,
                  label: `${candidate.productType}/${candidate.path || 'image'}`,
                  url: candidate.url,
                  source: 'usgs',
                  bufferHash: processedHash,
                  rawBufferHash: bufferHash,
                  productType: candidate.productType,
                  path: candidate.path
                });
                sources.push({
                  type: 'usgs',
                  buffer: processedImage,
                  label: `${candidate.productType}/${candidate.path || 'image'}`,
                  url: candidate.url,
                  source: 'usgs',
                  bufferHash: processedHash,
                  rawBufferHash: bufferHash,
                  productType: candidate.productType,
                  path: candidate.path,
                  productionMethod: 'downloadImage + prepareUSGSImage'
                });
                logger.info(`[buildTwoImageSources] ✅ Added USGS image ${sources.length}/${maxImages}: ${candidate.productType}/${candidate.path} (hash: ${processedHash})`);
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
        } // End else block for forceFallbackOnly
      }
    } else {
      logger.warn(`[buildTwoImageSources] ⚠️ Failed to fetch GeoJSON detail - will use fallback maps`);
    }
  } else {
    logger.warn(`[buildTwoImageSources] ⚠️ No eventId or detailUrl provided - will use fallback maps`);
  }
  
  // STEP 4: Fill remaining slots with fallback maps (deterministic guarantee of 2 images)
  const fallbacksNeeded = maxImages - sources.length;
  if (fallbacksNeeded > 0) {
    const lat = coordinates?.lat ?? coordinates?.[1] ?? null;
    const lon = coordinates?.lon ?? coordinates?.[0] ?? null;
    
    if (lat != null && lon != null) {
      const reason = usgsCandidates.length === 0 ? 'no USGS products (forceFallbackOnly)' : 'download failed';
      logger.info(`[buildTwoImageSources] 🗺️ Generating ${fallbacksNeeded} fallback map(s) (reason: ${reason})...`);
      logger.info(`[buildTwoImageSources] 🗺️ Fallback coordinates: lat=${lat}, lon=${lon}, zoom=11`);
      
      // STEP 4A: Generate Mapbox Satellite fallback maps (MANDATORY)
      // Generate exactly 2 satellite images: regional (zoom 7) and local (zoom 11)
      logger.info(`[buildTwoImageSources] 🛰️ Generating ${fallbacksNeeded} Mapbox satellite fallback map(s)...`);
      
      const mapboxResults = [];
      const mapboxZoomLevels = [7, 11]; // Regional and local views
      
      for (let i = 0; i < fallbacksNeeded && i < mapboxZoomLevels.length; i++) {
        const mapZoom = mapboxZoomLevels[i];
        const mapType = i === 0 ? 'regional' : 'local';
        
        logger.info(`[buildTwoImageSources] 🛰️ Generating Mapbox satellite map ${i + 1}/${fallbacksNeeded} (${mapType}, zoom=${mapZoom})...`);
        
        let fallbackMap = null;
        let productionMethod = 'unknown';
        
        try {
          // CRITICAL: Validate coordinates before Mapbox call
          if (lat == null || lon == null) {
            throw new Error(`Missing coordinates: lat=${lat}, lon=${lon}`);
          }
          
          // CRITICAL: Log Mapbox request with coordinates for debugging
          logger.info(`[buildTwoImageSources] 🛰️ Requesting Mapbox satellite image:`, {
            eventId,
            lat,
            lon,
            zoom: mapZoom,
            expectedLocation: locationText,
            coordinatesValid: (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)
          });
          
          // STEP 1: Fetch Mapbox satellite image
          const satelliteImage = await generateMapboxSatelliteImage({
            lat,
            lon,
            zoom: mapZoom,
            width: imageWidth,
            height: imageHeight,
            logger
          });
          
          if (satelliteImage) {
            // STEP 2: Overlay epicenter graphics (NO TEXT)
            fallbackMap = await overlayEpicenterGraphics(satelliteImage, imageWidth, imageHeight, logger, magnitude, mapZoom);
            productionMethod = 'mapbox-satellite';
            
            const mapHash = getBufferHash(fallbackMap);
            logger.info(`[buildTwoImageSources] ✅ Mapbox satellite map ${i + 1} generated, bufferHash: ${mapHash}`);
          }
        } catch (mapboxError) {
          logger.warn(`[buildTwoImageSources] ⚠️ Mapbox satellite failed for map ${i + 1}: ${mapboxError.message}`);
          // Will fall through to location card fallback
        }
        
        // STEP 3: If Mapbox failed, generate location card as last resort
        if (!fallbackMap) {
          logger.warn(`[buildTwoImageSources] ⚠️ Mapbox failed, generating location card for map ${i + 1}...`);
          const locationCard = await generateLocationCard({
            locationText: locationText || 'Earthquake Location',
            width: imageWidth,
            height: imageHeight,
            coordinates: { lat, lon },
            logger
          });
          if (locationCard) {
            const cardHash = getBufferHash(locationCard);
            logger.info(`[buildTwoImageSources] ✅ Location card generated for map ${i + 1}, bufferHash: ${cardHash}`);
            fallbackMap = locationCard;
            productionMethod = 'generateLocationCard (mapbox-fallback)';
          }
        }
        
        // STEP 4: If still no buffer, create minimal emergency fallback
        if (!fallbackMap) {
          logger.error(`[buildTwoImageSources] ❌ All methods failed, creating minimal buffer for map ${i + 1}...`);
          const minimalSVG = Buffer.from(`
            <svg width="${imageWidth}" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">
              <rect width="${imageWidth}" height="${imageHeight}" fill="#1e1e2e"/>
              <text x="${imageWidth / 2}" y="${imageHeight / 2}" font-family="Arial" font-size="24" fill="#FFFFFF" text-anchor="middle">
                ${locationText || 'Earthquake Location'}
              </text>
              <text x="${imageWidth / 2}" y="${imageHeight / 2 + 30}" font-family="Arial" font-size="16" fill="#CCCCCC" text-anchor="middle">
                ${lat.toFixed(4)}°N, ${Math.abs(lon).toFixed(4)}°${lon < 0 ? 'W' : 'E'}
              </text>
            </svg>
          `);
          fallbackMap = await sharp(minimalSVG).png().toBuffer();
          const minimalHash = getBufferHash(fallbackMap);
          logger.info(`[buildTwoImageSources] ✅ Minimal buffer created for map ${i + 1}, bufferHash: ${minimalHash}`);
          productionMethod = 'minimalSVG (emergency fallback)';
        }
        
        mapboxResults.push({ buffer: fallbackMap, method: productionMethod, zoom: mapZoom });
      }
      
      // STEP 4B: Process and add all generated fallback maps
      for (let i = 0; i < mapboxResults.length; i++) {
        const result = mapboxResults[i];
        if (result.buffer) {
          const rawHash = getBufferHash(result.buffer);
          logger.info(`[buildTwoImageSources] 📊 Fallback ${i + 1} raw buffer hash: ${rawHash}, productionMethod: ${result.method}, zoom: ${result.zoom}`);
          
          const processedMap = await prepareUSGSImage(result.buffer, imageWidth, imageHeight);
          if (processedMap) {
            const processedHash = getBufferHash(processedMap);
            sources.push({
              type: 'fallback',
              buffer: processedMap,
              label: `location-map-${i + 1}`,
              url: null,
              source: 'fallback',
              bufferHash: processedHash,
              rawBufferHash: rawHash,
              productionMethod: result.method
            });
            logger.info(`[buildTwoImageSources] ✅ Added fallback map ${sources.length}/${maxImages} (processedHash: ${processedHash}, method: ${result.method}, zoom: ${result.zoom})`);
          } else {
            logger.error(`[buildTwoImageSources] ❌ Failed to process fallback map ${i + 1}`);
          }
        }
      }
      
      // STEP 4C: If we still need more maps (shouldn't happen, but guarantee 2)
      if (sources.length < maxImages) {
        logger.warn(`[buildTwoImageSources] ⚠️ Only ${sources.length} fallback maps generated, need ${maxImages - sources.length} more`);
        for (let i = sources.length; i < maxImages; i++) {
          const locationCard = await generateLocationCard({
            locationText: locationText || 'Earthquake Location',
            width: imageWidth,
            height: imageHeight,
            coordinates: { lat, lon },
            logger
          });
          if (locationCard) {
            const processedCard = await prepareUSGSImage(locationCard, imageWidth, imageHeight);
            if (processedCard) {
              const cardHash = getBufferHash(processedCard);
              sources.push({
                type: 'fallback',
                buffer: processedCard,
                label: `location-card-${i + 1}`,
                url: null,
                source: 'fallback',
                bufferHash: cardHash,
                rawBufferHash: getBufferHash(locationCard),
                productionMethod: 'generateLocationCard (guarantee-2)'
              });
              logger.info(`[buildTwoImageSources] ✅ Added location card ${sources.length}/${maxImages} (hash: ${cardHash})`);
            }
          }
        }
      }
      
      // FORENSIC LOGGING: Log Mapbox fallback generation summary
      logger.info(`[buildTwoImageSources] 🛰️ FORENSIC: Mapbox satellite fallback summary:`, {
        provider: 'mapbox',
        lat,
        lon,
        zoomLevels: mapboxZoomLevels.slice(0, fallbacksNeeded),
        imageDimensions: `${imageWidth}x${imageHeight}`,
        generatedMaps: mapboxResults.length,
        bufferHashes: mapboxResults.map((r, idx) => ({
          map: idx + 1,
          hash: getBufferHash(r.buffer),
          method: r.method,
          zoom: r.zoom
        }))
      });
    } else {
      logger.warn(`[buildTwoImageSources] ⚠️ Cannot generate fallback maps: coordinates missing`);
    }
  }
  
  // STEP 5: Guarantee exactly 2 images (deterministic)
  if (sources.length === 1) {
    logger.warn(`[buildTwoImageSources] ⚠️ Only 1 image available, duplicating to reach 2`);
    sources.push({
      type: sources[0].type,
      buffer: sources[0].buffer,
      label: `${sources[0].label}-duplicate`,
      url: sources[0].url,
      source: sources[0].source
    });
  }
  
  if (sources.length === 0) {
    logger.warn(`[buildTwoImageSources] ⚠️ No images available, creating 2 generic location cards`);
    // Generate simple location card images (no external network required)
    for (let i = 0; i < 2; i++) {
      const locationCard = await generateLocationCard({
        locationText: locationText || 'Location Unknown',
        width: imageWidth,
        height: imageHeight,
        logger
      });
      if (locationCard) {
        sources.push({
          type: 'fallback',
          buffer: locationCard,
          label: `location-card-${i + 1}`,
          url: null,
          source: 'fallback-card'
        });
      }
    }
  }
  
  // FORENSIC LOGGING: Log once per event with full details
  const finalImages = sources.slice(0, maxImages).map(s => ({
    source: s.source,
    type: s.type,
    label: s.label,
    sourceUrl: s.url || null,
    bufferHash: s.bufferHash || getBufferHash(s.buffer),
    rawBufferHash: s.rawBufferHash || null,
    productType: s.productType || null,
    path: s.path || null,
    productionMethod: s.productionMethod || (s.type === 'usgs' ? 'downloadImage + prepareUSGSImage' : 'unknown'),
    cacheKey: s.source === 'usgs' && s.url ? `usgsimg:${eventId}:${s.productType}:${crypto.createHash('sha1').update(s.url).digest('hex').substring(0, 8)}` : null
  }));
  
  logger.info(`[buildTwoImageSources] ✅ FORENSIC: Final selected images:`, {
    eventId,
    detailUrl,
    coordinates: { lat, lon },
    selectedImages: finalImages,
    usgsCount: sources.filter(s => s.source === 'usgs').length,
    fallbackCount: sources.filter(s => s.source === 'fallback').length,
    totalSources: sources.length,
    forceFallbackOnly: usgsCandidates.length === 0
  });
  
  return sources.slice(0, maxImages); // Guarantee exactly 2
}

/**
 * Generate a simple location card image (fallback when maps fail)
 */
async function generateLocationCard({ locationText, width, height, coordinates = null, logger }) {
  // CRITICAL: Always generate NEW buffer from scratch - never reuse
  const lat = coordinates?.lat ?? coordinates?.[1] ?? null;
  const lon = coordinates?.lon ?? coordinates?.[0] ?? null;
  
  if (logger) logger.info(`[generateLocationCard] 🎴 Generating location card from scratch (${width}x${height})...`);
  
  try {
    const coordText = (lat != null && lon != null) 
      ? `${lat.toFixed(4)}°N, ${Math.abs(lon).toFixed(4)}°${lon < 0 ? 'W' : 'E'}`
      : 'Location Map';
    
    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#1a1a2e"/>
      <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="${Math.min(width, height) / 15}" fill="#fff" text-anchor="middle" dominant-baseline="middle" font-weight="bold">${locationText || 'Earthquake Location'}</text>
      <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="${Math.min(width, height) / 20}" fill="#888" text-anchor="middle" dominant-baseline="middle">${coordText}</text>
    </svg>`;
    
    const svgBuffer = Buffer.from(svg);
    const pngBuffer = await sharp(svgBuffer).png().toBuffer();
    
    if (logger) {
      const cardHash = getBufferHash(pngBuffer);
      logger.info(`[generateLocationCard] ✅ Location card generated, bufferHash: ${cardHash}`);
    }
    
    return pngBuffer;
  } catch (error) {
    if (logger) logger.warn(`[generateLocationCard] Failed to generate location card: ${error.message}`);
    return null;
  }
}

/**
 * PHASE 5: Updated to fetch GeoJSON detail and extract products internally
 */
async function generateImage(magnitude, location, eventId, templateType = 'standard', coordinates = null, detailUrl = null) {
  // PHASE 5: Functions are imported inside buildTwoImageSources to avoid module loading issues
  
  // FORENSIC LOGGING: Log render request details
  // CRITICAL: Extract coordinates correctly
  // coordinates can be: [lon, lat] array OR {lat, lon} object
  const lat = coordinates?.[1] ?? coordinates?.lat ?? null;
  const lon = coordinates?.[0] ?? coordinates?.lon ?? null;
  
  // CRITICAL VALIDATION: Verify coordinates match expected location
  // For Los Angeles: lat should be ~34, lon should be ~-118
  // For Assam, India: lat should be ~26, lon should be ~92
  if (lat != null && lon != null) {
    // Sanity check: lat should be between -90 and 90, lon between -180 and 180
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new Error(`Invalid coordinates: lat=${lat}, lon=${lon} (must be lat: -90 to 90, lon: -180 to 180)`);
    }
    
    // Additional validation: Check if coordinates seem swapped
    // If lat is > 90 or < -90, or lon is > 180 or < -180, coordinates might be swapped
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      console.error(`[generate-earthquake-image] ⚠️ WARNING: Coordinates may be swapped! lat=${lat}, lon=${lon}`);
    }
  }
  
  console.log(`[generate-earthquake-image] 🔍 FORENSIC: Render request:`, {
    eventId,
    detailUrl,
    coordinates: { lat, lon },
    rawCoordinates: coordinates,
    coordinateFormat: Array.isArray(coordinates) ? 'array [lon, lat]' : (coordinates ? 'object {lat, lon}' : 'null'),
    magnitude,
    location,
    timestamp: new Date().toISOString()
  });
  
  // ARCHITECTURE CHANGE: Build and validate image sources BEFORE generation
  // This prevents geographic mismatches by locking selection to eventId's GeoJSON products
  // OLD CODE REMOVED: No longer fetch GeoJSON separately - buildTwoImageSources does it internally
  
  // Fetch earthquake timestamp from event detail
  let earthquakeTimestamp = null;
  if (detailUrl || eventId) {
    try {
      const detailUrlToFetch = detailUrl || `https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/${eventId}.geojson`;
      const detailResponse = await fetch(detailUrlToFetch);
      if (detailResponse.ok) {
        const detailJson = await detailResponse.json();
        // Extract timestamp from properties.time (milliseconds since epoch)
        if (detailJson.properties?.time) {
          earthquakeTimestamp = detailJson.properties.time;
          console.log(`[generate-earthquake-image] ✅ Fetched earthquake timestamp: ${new Date(earthquakeTimestamp).toISOString()}`);
        }
      }
    } catch (error) {
      console.warn(`[generate-earthquake-image] ⚠️ Could not fetch earthquake timestamp: ${error.message}`);
    }
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
  
  // Create SVG overlay with embedded fonts (include timestamp)
  // Extract coordinates for timestamp calculation (lat and lon already declared at line 1750-1751)
  const coordArray = (lat != null && lon != null) ? [lon, lat] : null;
  
  const svgString = createDynamicTextSVG(magnitudeText, location, outputWidth, outputHeight, scaleFactor, earthquakeTimestamp, coordArray);
  
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
  
  console.log(`[generate-earthquake-image] 📸 Building 2 validated image sources (event-locked)...`, {
    imageAreaY: IMAGE_AREA_Y,
    imageAreaHeight: IMAGE_AREA_HEIGHT,
    imageWidth,
    imageHeight: IMAGE_AREA_HEIGHT,
    eventId,
    hasDetailUrl: !!detailUrl
  });
  
  // ARCHITECTURE CHANGE: buildTwoImageSources now handles event-locked fetching internally
  // This ensures images are validated BEFORE compositing (no guess-and-check loop)
  const imageSources = await buildTwoImageSources({
    eventId, // Required for event-locking
    detailUrl, // Required for event-locking
    coordinates, // Pass as-is (can be array [lon, lat] or object {lat, lon})
    locationText: location,
      imageWidth,
      imageHeight: IMAGE_AREA_HEIGHT,
    magnitude, // Pass magnitude for accurate earthquake rings
    logger: { info: console.log, warn: console.warn, error: console.error }
  });
  
  // CRITICAL ASSERTION: Must have exactly 2 image sources
  if (!imageSources || imageSources.length !== 2) {
    throw new Error(`FATAL: compositor did not receive exactly 2 image sources. Got ${imageSources?.length || 0} sources. EventId: ${eventId}`);
  }
  
  // CRITICAL: Log buffer hashes BEFORE compositing to verify correct buffers
  console.log(`[generate-earthquake-image] 🔍 COMPOSITE INPUT BUFFERS (BEFORE COMPOSITING):`, imageSources.map((i, idx) => ({
    index: idx + 1,
    label: i.label,
    hash: i.bufferHash || getBufferHash(i.buffer),
    method: i.productionMethod || 'unknown',
    type: i.type,
    source: i.source,
    url: i.url ? i.url.substring(0, 80) : 'N/A (fallback)'
  })));
  
  // PHASE 4: Add exactly 2 images to composite
  // CRITICAL: ONLY use buffers from buildTwoImageSources() - NO OTHER SOURCES
  let usgsImageCount = 0;
  let locationMapCount = 0;
  
  // FORENSIC LOGGING: Log final selected images with buffer hashes
  const finalSelectedImages = [];
  
  for (let i = 0; i < imageSources.length; i++) {
    const source = imageSources[i];
    const x = IMAGE_PADDING + (i * (imageWidth + IMAGE_SPACING));
            const y = IMAGE_AREA_Y;
            
    const bufferHash = getBufferHash(source.buffer);
    finalSelectedImages.push({
      index: i + 1,
      source: source.source,
      type: source.type,
      label: source.label,
      url: source.url || 'N/A (fallback)',
      bufferHash,
      productType: source.productType || null,
      path: source.path || null,
      position: `(${x}, ${y})`,
      size: `${imageWidth}x${IMAGE_AREA_HEIGHT}`
    });
              
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
      bufferHash,
                position: `(${x}, ${y})`,
      size: `${imageWidth}x${IMAGE_AREA_HEIGHT}`
    });
  }
  
  // FORENSIC LOGGING: Final composition summary
  console.log(`[generate-earthquake-image] 🔍 FORENSIC: Final image composition:`, {
    eventId,
    detailUrl,
    coordinates: { lat, lon },
    totalImages: imageSources.length,
      usgsImages: usgsImageCount,
      locationMaps: locationMapCount,
    selectedImages: finalSelectedImages
  });
  
  // CRITICAL: Verify compositeInputs contains ONLY buffers from buildTwoImageSources()
  // compositeInputs should have: [textOverlay, image1, image2] = 3 total
  if (compositeInputs.length !== 3) {
    throw new Error(`FATAL: compositeInputs has ${compositeInputs.length} layers, expected 3 (textOverlay + 2 images). EventId: ${eventId}`);
  }
  
  // CRITICAL: Verify the 2 image buffers match what buildTwoImageSources() returned
  const imageBuffersInComposite = compositeInputs.slice(1); // Skip text overlay (index 0)
  for (let i = 0; i < imageBuffersInComposite.length; i++) {
    const compositeBuffer = imageBuffersInComposite[i].input;
    const sourceBuffer = imageSources[i].buffer;
    const compositeHash = getBufferHash(compositeBuffer);
    const sourceHash = getBufferHash(sourceBuffer);
    
    if (compositeHash !== sourceHash) {
      throw new Error(`FATAL: Composite buffer ${i + 1} hash mismatch! Composite: ${compositeHash}, Source: ${sourceHash}. EventId: ${eventId}`);
    }
  }
  
  // CRITICAL: Log what will be in the final composite
  console.log(`[generate-earthquake-image] 📊 COMPOSITE LAYERS (VERIFIED):`, {
    totalLayers: compositeInputs.length,
    textOverlay: true,
    imageCount: imageSources.length,
    hasUSGSImages: usgsImageCount > 0,
    usgsImageCount: usgsImageCount,
    locationMapCount: locationMapCount,
    templateDimensions: `${actualWidth}x${actualHeight}`,
    outputDimensions: `${outputWidth}x${outputHeight}`,
    scaleFactor: scaleFactor.toFixed(3),
    magnitudeText: magnitudeText,
    locationText: location.toUpperCase(),
    bufferHashes: imageSources.map(s => getBufferHash(s.buffer))
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
  // CRITICAL: Final verification before compositing
  console.log(`[generate-earthquake-image] 🎨 Compositing ${compositeInputs.length} layer(s) onto template...`);
  console.log(`[generate-earthquake-image] 🎨 Composite inputs detail (FINAL CHECK):`, {
    totalLayers: compositeInputs.length,
    layerDetails: compositeInputs.map((layer, idx) => ({
      index: idx,
      layerType: idx === 0 ? 'textOverlay' : `image${idx}`,
      hasInput: !!layer.input,
      inputType: layer.input ? (Buffer.isBuffer(layer.input) ? 'Buffer' : typeof layer.input) : 'null',
      inputSize: layer.input ? (Buffer.isBuffer(layer.input) ? `${Math.round(layer.input.length / 1024)}KB` : 'unknown') : 'null',
      bufferHash: layer.input && Buffer.isBuffer(layer.input) ? getBufferHash(layer.input) : 'N/A',
      left: layer.left,
      top: layer.top,
      blend: layer.blend,
      source: idx > 0 ? imageSources[idx - 1]?.label : 'textOverlay'
    }))
  });
  
  // CRITICAL: Verify no India map hashes (known problematic hash patterns)
  const allBufferHashes = compositeInputs
    .filter(l => l.input && Buffer.isBuffer(l.input))
    .map(l => getBufferHash(l.input));
  console.log(`[generate-earthquake-image] 🔍 All buffer hashes in composite:`, allBufferHashes);
  
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
      // Note: stddev might be undefined in some Sharp versions, so check safely
      const redStddev = redChannel.stddev ?? redChannel.stdev ?? 0;
      const greenStddev = greenChannel.stddev ?? greenChannel.stdev ?? 0;
      const blueStddev = blueChannel.stddev ?? blueChannel.stdev ?? 0;
      const hasVariance = (redStddev > 0 || greenStddev > 0 || blueStddev > 0);
      const hasHighValues = (redChannel.max > 50 || greenChannel.max > 50 || blueChannel.max > 50);
      // Text should have variance OR high values (text can be white on dark background or vice versa)
      compositeHasText = hasVariance || hasHighValues;
      
      console.log(`[generate-earthquake-image] 📊 Final composite pixel analysis:`, {
        hasVariance: hasVariance,
        hasHighValues: hasHighValues,
        redStddev: redStddev?.toFixed(2),
        greenStddev: greenStddev?.toFixed(2),
        blueStddev: blueStddev?.toFixed(2),
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
    containsUSGSImages: usgsImageCount > 0,
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
/**
 * Store generated image using Netlify Blobs
 * FORENSIC: Cache key includes eventId to prevent cross-event contamination
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
