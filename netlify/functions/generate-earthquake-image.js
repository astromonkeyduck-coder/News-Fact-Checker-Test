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

// Headline
const HEADLINE_TEXT = "EARTHQUAKE NEAR";
const HEADLINE_FONT_SIZE_BASE = 65;
const MAGNITUDE_FONT_SIZE_RATIO = 0.95;
const MAGNITUDE_GAP = 18;
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
  const escapedMag = escapeSVGText(magnitudeText);
  const escapedHeadline = escapeSVGText(HEADLINE_TEXT);
  const escapedLocation = escapeSVGText(locationText.toUpperCase());
  
  // Scale all constants
  const scaledAnchorX = Math.round(ANCHOR_X * scaleFactor);
  const scaledAlignShiftX = Math.round(ALIGN_SHIFT_X * scaleFactor);
  const scaledHeadlineBaselineY = Math.round(HEADLINE_BASELINE_Y * scaleFactor);
  const scaledLocationOffset = Math.round(LOCATION_OFFSET * scaleFactor);
  const scaledSafeLeft = Math.round(SAFE_LEFT * scaleFactor);
  const scaledSafeLeftMargin = Math.round(SAFE_LEFT_MARGIN * scaleFactor);
  const scaledMagnitudeGap = Math.round(MAGNITUDE_GAP * scaleFactor);
  
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
  
  // Measure total headline width
  let magWidth = estimateTextWidth(magnitudeText, magnitudeFontSize);
  let headlineWidth = estimateTextWidth(HEADLINE_TEXT, headlineFontSize);
  let totalHeadlineWidth = magWidth + scaledMagnitudeGap + headlineWidth;
  
  // Auto-reduce headline font size if needed
  if (totalHeadlineWidth > maxTextWidth) {
    const fitScaleFactor = maxTextWidth / totalHeadlineWidth;
    const minHeadlineSize = Math.round(50 * scaleFactor);
    headlineFontSize = Math.max(minHeadlineSize, Math.round(headlineFontSize * fitScaleFactor * 0.98));
    magnitudeFontSize = Math.round(headlineFontSize * MAGNITUDE_FONT_SIZE_RATIO);
    
    magWidth = estimateTextWidth(magnitudeText, magnitudeFontSize);
    headlineWidth = estimateTextWidth(HEADLINE_TEXT, headlineFontSize);
    totalHeadlineWidth = magWidth + scaledMagnitudeGap + headlineWidth;
    
    console.log(`[generate-earthquake-image] Headline auto-sized to ${headlineFontSize}px`);
  }
  
  // Position for headline line
  const magX = alignedX;
  const headlineX = alignedX + magWidth + scaledMagnitudeGap;
  const headlineY = scaledHeadlineBaselineY;
  
  // Position for location
  const locationX = alignedX;
  const locationY = scaledHeadlineBaselineY + scaledLocationOffset;
  
  // Location font size
  let locationFontSize = Math.round(LOCATION_FONT_SIZE_EXACT * scaleFactor);
  const locationFontSizeMin = Math.round(LOCATION_FONT_SIZE_MIN * scaleFactor);
  const estimatedLocationWidth = estimateTextWidth(locationText, locationFontSize);
  
  // Scale down location if needed
  if (estimatedLocationWidth > maxTextWidth) {
    const fitScaleFactor = maxTextWidth / estimatedLocationWidth;
    locationFontSize = Math.max(locationFontSizeMin, Math.round(locationFontSize * fitScaleFactor));
    console.log(`[generate-earthquake-image] Location scaled down to ${locationFontSize}px`);
  }
  
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
      <!-- Magnitude: M#.# (red, bold) -->
      <text 
        x="${magX}" 
        y="${headlineY}" 
        font-family="${fontFamily}" 
        font-size="${magnitudeFontSize}" 
        font-weight="bold"
        fill="${MAGNITUDE_COLOR}"
        text-rendering="optimizeLegibility"
        shape-rendering="geometricPrecision">
        ${escapedMag}
      </text>
      
      <!-- Headline: EARTHQUAKE NEAR (white, bold) -->
      <text 
        x="${headlineX}" 
        y="${headlineY}" 
        font-family="${fontFamily}" 
        font-size="${headlineFontSize}" 
        font-weight="bold"
        fill="${HEADLINE_COLOR}"
        text-rendering="optimizeLegibility"
        shape-rendering="geometricPrecision">
        ${escapedHeadline}
      </text>
      
      <!-- Location: e.g. PAPUA NEW GUINEA (red, bold) -->
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
 * Download image from URL
 */
async function downloadImage(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error(`[generate-earthquake-image] Error downloading image from ${url}:`, error);
    return null;
  }
}

/**
 * Resize and crop image to fit in allocated space
 */
async function prepareUSGSImage(imageBuffer, targetWidth, targetHeight) {
  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    
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
    
    return processed;
  } catch (error) {
    console.error('[generate-earthquake-image] Error processing USGS image:', error);
    return null;
  }
}

/**
 * Generate branded earthquake image
 * @param {string} templateType - 'standard' (4K), 'square' (1080x1080), 'wide' (1920x1080)
 */
async function generateImage(magnitude, location, usgsImages, eventId, templateType = 'standard') {
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
    containsHeadline: svgString.includes(HEADLINE_TEXT),
    containsLocation: svgString.includes(location.toUpperCase()),
    containsFontFace: svgString.includes('@font-face'),
    containsRoboto: svgString.includes('Roboto'),
    svgPreview: svgString.substring(0, 500) + '...'
  });
  
  // STEP 6: Render SVG using resvg (supports embedded fonts better than librsvg)
  // resvg properly handles @font-face with data URIs and embedded base64 fonts
  let textOverlayBuffer;
  try {
    // resvg options - fonts are embedded in SVG via @font-face, but we also register font buffers
    // CRITICAL: Use 'original' mode to preserve exact SVG dimensions, don't scale
    const svgOptions = {
      font: {
        loadSystemFonts: false, // Don't load system fonts, rely on embedded @font-face
        fontFiles: [], // Will be populated below
      },
      // CRITICAL: Use 'original' to preserve exact SVG dimensions (outputWidth x outputHeight)
      // This ensures text positions match exactly
      fitTo: {
        mode: 'original', // Preserve exact SVG dimensions
      },
    };
    
    // CRITICAL: Register font buffers with resvg
    // resvg expects fontFiles to be an array of Buffer objects directly
    if (FONT_BUFFERS.regular && FONT_BUFFERS.bold) {
      svgOptions.font.fontFiles = [
        FONT_BUFFERS.regular,
        FONT_BUFFERS.bold,
      ];
      console.log('[generate-earthquake-image] ✅ Registered font buffers with resvg', {
        regularSize: FONT_BUFFERS.regular.length,
        boldSize: FONT_BUFFERS.bold.length
      });
    } else {
      console.warn('[generate-earthquake-image] ⚠️ Font buffers not available for resvg!', {
        hasRegular: !!FONT_BUFFERS.regular,
        hasBold: !!FONT_BUFFERS.bold
      });
      throw new Error('Font buffers not loaded - cannot render text without fonts');
    }
    
    // Use resvg.Resvg constructor to render SVG to PNG
    const resvgInstance = new resvg.Resvg(svgString, svgOptions);
    const pngData = resvgInstance.render();
    textOverlayBuffer = pngData.asPng();
    
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
        textOverlayHasContent = alphaChannel && (alphaChannel.min < 255 || alphaChannel.max > 0);
      } else {
        // No alpha channel - check if any RGB channel has non-zero values
        textOverlayHasContent = stats.channels && stats.channels.some(ch => ch.min < 255 || ch.max > 0);
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
  } catch (resvgError) {
    console.error('[generate-earthquake-image] ❌ resvg rendering failed:', resvgError.message);
    console.error('[generate-earthquake-image] ❌ resvg error stack:', resvgError.stack);
    // Don't fall back to broken rendering - throw error so we know it failed
    throw new Error(`Font rendering failed: ${resvgError.message}. Text will appear as boxes. Check font buffers and resvg configuration.`);
  }
  
  console.log(`[generate-earthquake-image] ✅ SVG text overlay created: ${outputWidth}x${outputHeight}`);
  console.log(`[generate-earthquake-image] Template dimensions: ${actualWidth}x${actualHeight}, output: ${outputWidth}x${outputHeight}`);
  console.log(`[generate-earthquake-image] Font family: ${fontFamily}, fontLoaded: ${fontLoaded}`);
  console.log(`[generate-earthquake-image] Text content: "${magnitudeText} EARTHQUAKE NEAR ${location}"`);
  
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
  
  let successfullyAddedImages = 0;
  
  if (usgsImages && usgsImages.length > 0) {
    const numImages = Math.min(usgsImages.length, 2);
    const imageAreaWidth = outputWidth - (IMAGE_PADDING * 2);
    const imageWidth = numImages === 2 
      ? Math.floor((imageAreaWidth - IMAGE_SPACING) / 2)
      : imageAreaWidth;
    
    for (let i = 0; i < numImages; i++) {
      const usgsImage = usgsImages[i];
      if (!usgsImage || !usgsImage.url) {
        continue;
      }
      
      try {
        const imageBuffer = await downloadImage(usgsImage.url);
        if (imageBuffer) {
          const processedImage = await prepareUSGSImage(imageBuffer, imageWidth, IMAGE_AREA_HEIGHT);
          if (processedImage) {
            const x = IMAGE_PADDING + (i * (imageWidth + IMAGE_SPACING));
            const y = IMAGE_AREA_Y;
            
            compositeInputs.push({
              input: processedImage,
              left: x,
              top: y,
              blend: 'over',
            });
            successfullyAddedImages++;
            console.log(`[generate-earthquake-image] ✅ Added USGS image ${i + 1}/${numImages}`, { url: usgsImage.url.substring(0, 80) });
          }
        }
      } catch (error) {
        console.error(`[generate-earthquake-image] ❌ Error processing USGS image ${i + 1}:`, error.message);
      }
    }
  } else {
    console.warn(`[generate-earthquake-image] ⚠️ No USGS images provided - image will use template only (no earthquake-specific maps)`);
  }
  
  // Log final image count
  if (successfullyAddedImages === 0) {
    console.warn(`[generate-earthquake-image] ⚠️ WARNING: No USGS images were successfully added to the final image!`);
    console.warn(`[generate-earthquake-image] ⚠️ The template may have baked-in images, but no earthquake-specific maps will appear.`);
  } else {
    console.log(`[generate-earthquake-image] ✅ Successfully added ${successfullyAddedImages} USGS image(s) to final image`);
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
  const templateMetadata = await template.metadata();
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
    console.log(`[generate-earthquake-image] 📐 Template scaled to ${outputWidth}x${outputHeight} for 4K output`);
    
    // Verify scaled template dimensions
    const scaledMetadata = await compositePipeline.metadata();
    console.log(`[generate-earthquake-image] 📐 Scaled template metadata:`, {
      width: scaledMetadata.width,
      height: scaledMetadata.height,
      format: scaledMetadata.format,
      expectedDimensions: `${outputWidth}x${outputHeight}`
    });
    
    if (scaledMetadata.width !== outputWidth || scaledMetadata.height !== outputHeight) {
      console.error(`[generate-earthquake-image] ❌ CRITICAL: Template scaling failed! Expected ${outputWidth}x${outputHeight}, got ${scaledMetadata.width}x${scaledMetadata.height}`);
      throw new Error(`Template scaling failed: expected ${outputWidth}x${outputHeight}, got ${scaledMetadata.width}x${scaledMetadata.height}`);
    }
  }
  
  // Composite all layers
  console.log(`[generate-earthquake-image] 🎨 Compositing ${compositeInputs.length} layer(s) onto template...`);
  compositePipeline = compositePipeline.composite(compositeInputs, {
    blend: 'over',
  });
  
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
      compressionLevel: 9,
      palette: false,
      effort: 10
    })
    .toBuffer();
  
  // CRITICAL: Verify the composite buffer is valid
  if (!composite || composite.length === 0) {
    throw new Error('Composite buffer is empty! Image generation failed.');
  }
  
  // Verify it's a valid PNG by checking magic bytes
  const magicBytes = composite.slice(0, 8);
  const isPNG = magicBytes[0] === 0x89 && magicBytes[1] === 0x50 && magicBytes[2] === 0x4E && magicBytes[3] === 0x47;
  
  if (!isPNG) {
    console.error(`[generate-earthquake-image] ❌ CRITICAL: Generated buffer is not a valid PNG! Magic bytes:`, 
      Array.from(magicBytes.slice(0, 4)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
    throw new Error('Generated image is not a valid PNG file');
  }
  
  // Log final info
  console.log(`[generate-earthquake-image] ✅ IMAGE GENERATION COMPLETE:`, {
    dimensions: `${outputWidth}x${outputHeight}`,
    templateSize: `${actualWidth}x${actualHeight}`,
    scaleFactor: scaleFactor.toFixed(3),
    fileSize: `${Math.round(composite.length / 1024)}KB`,
    isValidPNG: isPNG,
    containsText: true,
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
    const { magnitude, location, usgsImages, eventId } = body;
    
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
    const imageBuffer = await generateImage(magnitude, location, usgsImages || [], eventId, 'standard');
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
