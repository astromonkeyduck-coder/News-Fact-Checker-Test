/**
 * Generate branded earthquake image using template
 * Uses SVG with embedded Roboto fonts (base64) for text rendering
 * Uses Sharp for image processing and compositing
 * 
 * POST /.netlify/functions/generate-earthquake-image
 * Body: { magnitude, location, usgsImages: [{url, type, filename}], eventId }
 */

const sharp = require('sharp');
const { resvg } = require('@resvg/resvg-js');
const { getStore } = require("@netlify/blobs");
const fs = require('fs');
const path = require('path');

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
  const fontFamily = (FONT_BUFFERS.regular && FONT_BUFFERS.bold) ? 'Roboto' : 'Arial, sans-serif';
  
  return `
    <svg width="${templateWidth}" height="${templateHeight}" xmlns="http://www.w3.org/2000/svg" 
         shape-rendering="geometricPrecision" text-rendering="optimizeLegibility">
      <defs>
        <style>
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
 */
async function generateImage(magnitude, location, usgsImages, eventId) {
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
  
  if (actualWidth !== TEMPLATE_WIDTH || actualHeight !== TEMPLATE_HEIGHT) {
    console.warn(`[generate-earthquake-image] Template dimensions (${actualWidth}x${actualHeight}) don't match expected (${TEMPLATE_WIDTH}x${TEMPLATE_HEIGHT})`);
  }
  
  // Calculate scale factor for 4K output
  let outputWidth, outputHeight, scaleFactor;
  
  if (ENABLE_4K) {
    const widthScale = OUTPUT_4K_WIDTH / actualWidth;
    const heightScale = OUTPUT_4K_HEIGHT / actualHeight;
    scaleFactor = Math.min(widthScale, heightScale);
    
    outputWidth = Math.round(actualWidth * scaleFactor);
    outputHeight = Math.round(actualHeight * scaleFactor);
    
    console.log(`[generate-earthquake-image] Scaling to 4K: ${actualWidth}x${actualHeight} -> ${outputWidth}x${outputHeight} (scale: ${scaleFactor.toFixed(3)})`);
  } else {
    outputWidth = actualWidth;
    outputHeight = actualHeight;
    scaleFactor = 1.0;
  }
  
  // Format magnitude text
  const magnitudeText = `M${magnitude.toFixed(1)}`;
  
  // Create SVG overlay with embedded fonts
  const svgString = createDynamicTextSVG(magnitudeText, location, outputWidth, outputHeight, scaleFactor);
  
  // Validate font loading
  if (!FONT_BUFFERS.regular || !FONT_BUFFERS.bold) {
    console.error(`[generate-earthquake-image] ⚠️ WARNING: Fonts not loaded! Regular: ${!!FONT_BUFFERS.regular}, Bold: ${!!FONT_BUFFERS.bold}`);
    console.error(`[generate-earthquake-image] Text may render as tofu glyphs. Check fonts-base64.js`);
  } else {
    console.log(`[generate-earthquake-image] ✅ Fonts loaded: Regular=${FONT_BUFFERS.regular.length} bytes, Bold=${FONT_BUFFERS.bold.length} bytes`);
  }
  
  // Render SVG to PNG using resvg (supports embedded fonts properly)
  let textOverlayBuffer;
  try {
    const fonts = [];
    if (FONT_BUFFERS.regular) {
      fonts.push({ name: 'Roboto', data: FONT_BUFFERS.regular });
    }
    if (FONT_BUFFERS.bold) {
      fonts.push({ name: 'Roboto', data: FONT_BUFFERS.bold });
    }
    
    const svgOptions = {
      fonts: fonts.length > 0 ? fonts : undefined,
      fitTo: { mode: 'width', value: outputWidth },
      dpi: 96,
    };
    
    const renderResult = resvg(svgString, svgOptions);
    textOverlayBuffer = Buffer.from(renderResult);
    
    console.log(`[generate-earthquake-image] ✅ Rendered text overlay with resvg: ${outputWidth}x${outputHeight}, fonts: ${fonts.length}`);
    console.log(`[generate-earthquake-image] Template dimensions: ${actualWidth}x${actualHeight}, output: ${outputWidth}x${outputHeight}`);
    console.log(`[generate-earthquake-image] Font loaded: Regular=${!!FONT_BUFFERS.regular}, Bold=${!!FONT_BUFFERS.bold}`);
  } catch (resvgError) {
    console.error('[generate-earthquake-image] ⚠️ resvg rendering failed, falling back to Sharp SVG:', resvgError.message);
    console.error('[generate-earthquake-image] resvg error details:', resvgError);
    // Fallback to Sharp SVG rendering (may not support fonts)
    textOverlayBuffer = Buffer.from(svgString);
  }
  
  // Prepare composite inputs
  const compositeInputs = [
    { input: textOverlayBuffer, blend: 'over' },
  ];
  
  // Add USGS images if provided
  const IMAGE_AREA_Y = Math.round(410 * scaleFactor);
  const IMAGE_AREA_HEIGHT = Math.round(250 * scaleFactor);
  const IMAGE_PADDING = Math.round(20 * scaleFactor);
  const IMAGE_SPACING = Math.round(15 * scaleFactor);
  
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
          }
        }
      } catch (error) {
        console.error(`[generate-earthquake-image] Error processing USGS image ${i + 1}:`, error);
      }
    }
  }
  
  // Scale template to match output dimensions if 4K is enabled
  let compositePipeline = template;
  
  if (ENABLE_4K && scaleFactor > 1.0) {
    compositePipeline = template
      .resize(outputWidth, outputHeight, {
        kernel: 'lanczos3',
        withoutEnlargement: false,
      });
  }
  
  // Composite all layers
  compositePipeline = compositePipeline.composite(compositeInputs, {
    blend: 'over',
  });
  
  // Apply sharpening and output
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
  
  // Log final info
  console.log(`[generate-earthquake-image] ✅ Image generated: ${outputWidth}x${outputHeight}, template: ${actualWidth}x${actualHeight}, scale: ${scaleFactor.toFixed(3)}`);
  console.log(`[generate-earthquake-image] Font loaded: ${!!FONT_DATA.regular && !!FONT_DATA.bold}`);
  
  return composite;
}

// Export for direct testing
exports.generateImage = generateImage;

/**
 * Store generated image and return URL
 */
async function storeImage(imageBuffer, eventId) {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN;
  
  const store = getStore({
    name: "post-media",
    siteID: siteID,
    token: token,
  });
  
  const imageKey = `earthquake-${eventId}-${Date.now()}.png`;
  
  await store.set(imageKey, imageBuffer, {
    contentType: "image/png",
  });
  
  const imageUrl = `/.netlify/functions/get-uploaded-image?key=${encodeURIComponent(imageKey)}`;
  
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
    
    // Generate image
    const imageBuffer = await generateImage(magnitude, location, usgsImages || [], eventId);
    
    // Store image
    const imageUrl = await storeImage(imageBuffer, eventId);
    
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
    console.error('[generate-earthquake-image] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error?.message || "Internal server error",
      }),
    };
  }
};
