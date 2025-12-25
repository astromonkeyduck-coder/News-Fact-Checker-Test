/**
 * Generate branded earthquake image using template
 * Uses Sharp for image processing with SVG text overlay
 * 
 * POST /.netlify/functions/generate-earthquake-image
 * Body: { magnitude, location, usgsImages: [{url, type, filename}], eventId }
 */

const sharp = require('sharp');
const { getStore } = require("@netlify/blobs");
const fs = require('fs');
const path = require('path');

// Template dimensions (from file inspection: 940x788)
const TEMPLATE_WIDTH = 940;
const TEMPLATE_HEIGHT = 788;

// 4K Output dimensions (3840x2160 UHD)
const OUTPUT_4K_WIDTH = 3840;
const OUTPUT_4K_HEIGHT = 2160;
const ENABLE_4K = true; // Set to true to enable 4K output

// DYNAMIC TEXT PLACEMENT (2ndUSGSTemp.png has all static elements)
// All text shares the same anchorX (left edge aligned with template's "Breaking News:" label)
const ANCHOR_X = 50;  // X position - base left alignment
const ALIGN_SHIFT_X = 18; // Pixel-perfect alignment shift to match "Breaking News:" label left edge
const HEADLINE_BASELINE_Y_BASE = 200; // Base Y baseline for headline (below "Breaking News:" in template)
const HEADLINE_BLOCK_OFFSET_Y = 100; // Offset to move entire headline block DOWN significantly (+90 to +120px range)
const HEADLINE_BASELINE_Y = HEADLINE_BASELINE_Y_BASE + HEADLINE_BLOCK_OFFSET_Y; // Final headline baseline (300)
const LOCATION_OFFSET = 75; // Vertical offset below headline - clear separation (+30 to +45px gap, was 40)

// SAFE TEXT AREA (NON-NEGOTIABLE - text must stay in left content zone)
const SAFE_LEFT = ANCHOR_X + ALIGN_SHIFT_X; // Left edge of safe zone (after alignment shift)
const SAFE_RIGHT_RATIO = 0.58; // Right edge at 58% of canvas width (stops before rings)
// MAX_TEXT_WIDTH will be calculated per template: (templateWidth * SAFE_RIGHT_RATIO) - SAFE_LEFT

// Headline: "M6.5 EARTHQUAKE NEAR" (magnitude + headline on same baseline)
const HEADLINE_TEXT = "EARTHQUAKE NEAR";
const HEADLINE_FONT_SIZE_BASE = 65; // Base size - will be auto-adjusted to fit safe area (optimized for 58% safe zone)
const MAGNITUDE_FONT_SIZE_RATIO = 0.95; // 95% of headline (90-100% range)
const MAGNITUDE_GAP = 18; // Gap between magnitude and "EARTHQUAKE NEAR"
const HEADLINE_COLOR = '#FFFFFF'; // WHITE (matches template)
const MAGNITUDE_COLOR = '#FF0000'; // RED (same red as location/template accents)

// Location
const LOCATION_FONT_SIZE_EXACT = 50; // EXACT font size (increased from 41.5px for better readability)
const LOCATION_FONT_SIZE_MIN = 42; // Minimum size if scaling is needed (increased from 34px)
const LOCATION_COLOR = '#FF0000'; // RED (matches template red)
const SAFE_LEFT_MARGIN = 40; // Minimum left margin to prevent clipping

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
 * Uses approximate character width based on font size
 */
function estimateTextWidth(text, fontSize) {
  // Roboto average character width is approximately 0.6 * fontSize
  const avgCharWidth = fontSize * 0.6;
  return text.length * avgCharWidth;
}

/**
 * Create SVG overlay for dynamic text only
 * Template (2ndUSGSTemp.png) already contains:
 * - "Breaking News:" label
 * - Background, map, rings, logos, USGS images, footer, banner
 * 
 * We only draw:
 * - Magnitude (white): M#.#
 * - Headline (white): EARTHQUAKE NEAR
 * - Location (red): e.g. PAPUA NEW GUINEA
 */
function createDynamicTextSVG(magnitudeText, locationText, templateWidth, templateHeight, scaleFactor = 1.0) {
  const escapedMag = escapeSVGText(magnitudeText);
  const escapedHeadline = escapeSVGText(HEADLINE_TEXT);
  const escapedLocation = escapeSVGText(locationText.toUpperCase());
  
  // Scale all constants by scaleFactor for 4K
  const scaledAnchorX = Math.round(ANCHOR_X * scaleFactor);
  const scaledAlignShiftX = Math.round(ALIGN_SHIFT_X * scaleFactor);
  const scaledHeadlineBaselineY = Math.round(HEADLINE_BASELINE_Y * scaleFactor);
  const scaledLocationOffset = Math.round(LOCATION_OFFSET * scaleFactor);
  const scaledSafeLeft = Math.round(SAFE_LEFT * scaleFactor);
  const scaledSafeLeftMargin = Math.round(SAFE_LEFT_MARGIN * scaleFactor);
  const scaledMagnitudeGap = Math.round(MAGNITUDE_GAP * scaleFactor);
  
  // Calculate safe text area (after alignment shift) - scaled
  const safeRight = Math.floor(templateWidth * SAFE_RIGHT_RATIO);
  const maxTextWidth = safeRight - scaledSafeLeft;
  
  // Base anchor position - scaled
  let anchorX = scaledAnchorX;
  if (anchorX < scaledSafeLeftMargin) {
    anchorX = scaledSafeLeftMargin;
  }
  
  // Apply pixel-perfect alignment shift to match "Breaking News:" label - scaled
  const alignedX = anchorX + scaledAlignShiftX;
  
  // Calculate font sizes with safe area constraints - scaled
  let headlineFontSize = Math.round(HEADLINE_FONT_SIZE_BASE * scaleFactor);
  let magnitudeFontSize = Math.round(headlineFontSize * MAGNITUDE_FONT_SIZE_RATIO);
  
  // Measure total headline width (magnitude + gap + headline)
  let magWidth = estimateTextWidth(magnitudeText, magnitudeFontSize);
  let headlineWidth = estimateTextWidth(HEADLINE_TEXT, headlineFontSize);
  let totalHeadlineWidth = magWidth + scaledMagnitudeGap + headlineWidth;
  
  // Auto-reduce headline font size if it exceeds safe area
  if (totalHeadlineWidth > maxTextWidth) {
    // Calculate scale factor to fit within safe area
    const fitScaleFactor = maxTextWidth / totalHeadlineWidth;
    const minHeadlineSize = Math.round(50 * scaleFactor);
    headlineFontSize = Math.max(minHeadlineSize, Math.round(headlineFontSize * fitScaleFactor * 0.98)); // 98% for safety margin
    magnitudeFontSize = Math.round(headlineFontSize * MAGNITUDE_FONT_SIZE_RATIO);
    
    // Re-measure with adjusted sizes
    magWidth = estimateTextWidth(magnitudeText, magnitudeFontSize);
    headlineWidth = estimateTextWidth(HEADLINE_TEXT, headlineFontSize);
    totalHeadlineWidth = magWidth + scaledMagnitudeGap + headlineWidth;
    
    console.log(`[generate-earthquake-image] Headline auto-sized to ${headlineFontSize}px to fit safe area (max: ${maxTextWidth}px, actual: ${totalHeadlineWidth}px)`);
  }
  
  // Position for headline line: magnitude at alignedX, headline after it (same baseline) - scaled
  const magX = alignedX;
  const headlineX = alignedX + magWidth + scaledMagnitudeGap;
  const headlineY = scaledHeadlineBaselineY;
  
  // Position for location: directly under headline, left-aligned - scaled
  const locationX = alignedX;
  const locationY = scaledHeadlineBaselineY + scaledLocationOffset;
  
  // Location font size: scaled
  let locationFontSize = Math.round(LOCATION_FONT_SIZE_EXACT * scaleFactor);
  const locationFontSizeMin = Math.round(LOCATION_FONT_SIZE_MIN * scaleFactor);
  const estimatedLocationWidth = estimateTextWidth(locationText, locationFontSize);
  
  // Only scale down location if it would exceed safe area
  if (estimatedLocationWidth > maxTextWidth) {
    const fitScaleFactor = maxTextWidth / estimatedLocationWidth;
    locationFontSize = Math.max(locationFontSizeMin, Math.round(locationFontSize * fitScaleFactor));
    console.log(`[generate-earthquake-image] Location scaled down to ${locationFontSize}px to prevent clipping (would be ${estimatedLocationWidth}px, max: ${maxTextWidth}px)`);
  } else {
    console.log(`[generate-earthquake-image] Location using exact size: ${locationFontSize}px`);
  }
  
  // Use high-resolution SVG with text rendering hints for crisp text
  return `
    <svg width="${templateWidth}" height="${templateHeight}" xmlns="http://www.w3.org/2000/svg" 
         shape-rendering="geometricPrecision" text-rendering="optimizeLegibility">
      <defs>
        <!-- Enable text rendering optimizations -->
        <style>
          text {
            text-rendering: optimizeLegibility;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
        </style>
      </defs>
      <!-- Magnitude: M#.# (red, inline before headline) -->
      <text 
        x="${magX}" 
        y="${headlineY}" 
        font-family="Roboto, Arial, sans-serif" 
        font-size="${magnitudeFontSize}" 
        font-weight="bold"
        fill="${MAGNITUDE_COLOR}"
        text-rendering="optimizeLegibility"
        shape-rendering="geometricPrecision">
        ${escapedMag}
      </text>
      
      <!-- Headline: EARTHQUAKE NEAR (white, same baseline as magnitude) -->
      <text 
        x="${headlineX}" 
        y="${headlineY}" 
        font-family="Roboto, Arial, sans-serif" 
        font-size="${headlineFontSize}" 
        font-weight="bold"
        fill="${HEADLINE_COLOR}"
        text-rendering="optimizeLegibility"
        shape-rendering="geometricPrecision">
        ${escapedHeadline}
      </text>
      
      <!-- Location: e.g. PAPUA NEW GUINEA (red, below headline) -->
      <text 
        x="${locationX}" 
        y="${locationY}" 
        font-family="Roboto, Arial, sans-serif" 
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
    
    // Calculate aspect ratio
    const imageAspect = metadata.width / metadata.height;
    const targetAspect = targetWidth / targetHeight;
    
    let width, height, left, top;
    
    if (imageAspect > targetAspect) {
      // Image is wider - fit to height, crop width
      height = targetHeight;
      width = Math.round(height * imageAspect);
      left = Math.round((width - targetWidth) / 2);
      top = 0;
    } else {
      // Image is taller - fit to width, crop height
      width = targetWidth;
      height = Math.round(width / imageAspect);
      left = 0;
      top = Math.round((height - targetHeight) / 2);
    }
    
    // Resize and crop with high-quality settings
    // Use lanczos3 kernel (best quality, slower but worth it for broadcast quality)
    const processed = await image
      .resize(width, height, { 
        fit: 'cover',
        kernel: 'lanczos3',  // Best quality resampling algorithm
        withoutEnlargement: false,  // Allow upscaling if needed
      })
      .extract({ left, top, width: targetWidth, height: targetHeight })
      .png({
        quality: 100,        // Maximum quality
        compressionLevel: 6, // Balanced compression for USGS images
        palette: false       // Full color (no palette reduction)
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
  // Load template - try multiple possible paths
  // CRITICAL: Use 2ndUSGSTemp.png (new template with all static elements)
  // In Netlify Functions, __dirname is /var/task/netlify/functions/generate-earthquake-image
  // In local dev, it's the actual project path
  const possiblePaths = [
    path.join(__dirname, '2ndUSGSTemp.png'),                    // Same directory as function (best for bundled files)
    path.join(path.dirname(__dirname), '2ndUSGSTemp.png'),     // netlify/functions/2ndUSGSTemp.png
    path.join(__dirname, '../../2ndUSGSTemp.png'),             // From function dir: netlify/functions -> root
    path.join(process.cwd(), 'netlify/functions/2ndUSGSTemp.png'), // Explicit local path
    path.join(process.cwd(), '2ndUSGSTemp.png'),               // Current working directory (local dev)
    path.resolve('./2ndUSGSTemp.png'),                        // Relative to cwd
    '/var/task/netlify/functions/2ndUSGSTemp.png',            // Netlify Lambda path (functions dir)
    '/var/task/2ndUSGSTemp.png',                              // Netlify Lambda path (root)
  ];
  
  let templateBuffer = null;
  let templatePath = null;
  
  console.log(`[generate-earthquake-image] Looking for template. __dirname: ${__dirname}, cwd: ${process.cwd()}`);
  console.log(`[generate-earthquake-image] Function file location: ${__filename}`);
  
  for (const templatePathCandidate of possiblePaths) {
    console.log(`[generate-earthquake-image] Checking: ${templatePathCandidate}`);
    try {
      if (fs.existsSync(templatePathCandidate)) {
        templatePath = templatePathCandidate;
        templateBuffer = fs.readFileSync(templatePathCandidate);
        console.log(`[generate-earthquake-image] ✅ Loaded template from: ${templatePath} (${templateBuffer.length} bytes)`);
        break;
      }
    } catch (err) {
      console.log(`[generate-earthquake-image] Error checking ${templatePathCandidate}: ${err.message}`);
    }
  }
  
  // If not found via file system, try fetching via HTTP (for local dev or if served as static asset)
  if (!templateBuffer) {
    // Determine base URL - check if we're in local dev
    let baseUrl = 'https://noteworthynews.co';
    if (process.env.NETLIFY_DEV || process.env.URL?.includes('localhost') || !process.env.URL) {
      baseUrl = 'http://localhost:8888';
    } else if (process.env.URL) {
      baseUrl = process.env.URL;
    }
    
    const httpPaths = [
      `${baseUrl}/2ndUSGSTemp.png`,
      `${baseUrl}/netlify/functions/2ndUSGSTemp.png`,
    ];
    
    console.log(`[generate-earthquake-image] File system paths failed, trying HTTP from: ${baseUrl}`);
    
    for (const httpPath of httpPaths) {
      try {
        console.log(`[generate-earthquake-image] Trying HTTP: ${httpPath}`);
        const response = await fetch(httpPath);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          templateBuffer = Buffer.from(arrayBuffer);
          templatePath = httpPath;
          console.log(`[generate-earthquake-image] ✅ Loaded template via HTTP: ${httpPath} (${templateBuffer.length} bytes)`);
          break;
        } else {
          console.log(`[generate-earthquake-image] HTTP ${response.status} for ${httpPath}`);
        }
      } catch (err) {
        console.log(`[generate-earthquake-image] HTTP fetch failed for ${httpPath}: ${err.message}`);
      }
    }
  }
  
  if (!templateBuffer) {
    console.error(`[generate-earthquake-image] ❌ Template not found. Tried paths:`, possiblePaths);
    // List what files ARE in __dirname to help debug
    try {
      const dirContents = fs.readdirSync(__dirname);
      console.error(`[generate-earthquake-image] Files in __dirname (${__dirname}):`, dirContents);
    } catch (e) {
      console.error(`[generate-earthquake-image] Could not list __dirname:`, e.message);
    }
    throw new Error(`Template not found. Tried: ${possiblePaths.join(', ')}`);
  }
  
  // Load template into Sharp - THIS IS THE BASE LAYER
  // CRITICAL: 2ndUSGSTemp.png contains ALL static elements:
  // - Background, map, rings, logos, USGS images, footer, "Breaking News:" label, banner
  // We ONLY overlay the 3 dynamic text elements
  const template = sharp(templateBuffer);
  const templateMetadata = await template.metadata();
  
  // Verify template dimensions
  const actualWidth = templateMetadata.width;
  const actualHeight = templateMetadata.height;
  
  if (actualWidth !== TEMPLATE_WIDTH || actualHeight !== TEMPLATE_HEIGHT) {
    console.warn(`[generate-earthquake-image] Template dimensions (${actualWidth}x${actualHeight}) don't match expected (${TEMPLATE_WIDTH}x${TEMPLATE_HEIGHT}), using template dimensions`);
  }
  
  // Calculate scale factor for 4K output
  let outputWidth, outputHeight, scaleFactor;
  
  if (ENABLE_4K) {
    // Scale to 4K: maintain template's aspect ratio, scale to fit within 4K
    // Use the smaller scale factor to ensure nothing gets cropped
    const widthScale = OUTPUT_4K_WIDTH / actualWidth;
    const heightScale = OUTPUT_4K_HEIGHT / actualHeight;
    // Use the smaller scale to fit within 4K without cropping
    scaleFactor = Math.min(widthScale, heightScale);
    
    // Calculate scaled dimensions (maintains aspect ratio)
    outputWidth = Math.round(actualWidth * scaleFactor);
    outputHeight = Math.round(actualHeight * scaleFactor);
    
    console.log(`[generate-earthquake-image] Scaling to 4K: ${actualWidth}x${actualHeight} -> ${outputWidth}x${outputHeight} (scale: ${scaleFactor.toFixed(3)})`);
    console.log(`[generate-earthquake-image] Aspect ratio maintained, output fits within 4K bounds`);
  } else {
    // Use template's actual dimensions for output (original behavior)
    outputWidth = actualWidth;
    outputHeight = actualHeight;
    scaleFactor = 1.0;
  }
  
  // Format magnitude text
  const magnitudeText = `M${magnitude.toFixed(1)}`;
  
  // Create SVG overlay for ONLY the 3 dynamic text elements:
  // 1. Magnitude (white): M#.#
  // 2. Headline (white): EARTHQUAKE NEAR
  // 3. Location (red): e.g. PAPUA NEW GUINEA
  // Scale all positioning and font sizes by scaleFactor for 4K
  const dynamicTextSVG = Buffer.from(createDynamicTextSVG(magnitudeText, location, outputWidth, outputHeight, scaleFactor));
  
  // Prepare composite inputs: start with text overlay
  const compositeInputs = [
    { input: dynamicTextSVG, blend: 'over' },
  ];
  
  // Add USGS images if provided (these are the actual earthquake-specific images from USGS)
  // USGS image placement area (scaled for 4K)
  const IMAGE_AREA_Y = Math.round(410 * scaleFactor); // Y position for USGS images (scaled)
  const IMAGE_AREA_HEIGHT = Math.round(250 * scaleFactor); // Height for each USGS image (scaled)
  const IMAGE_PADDING = Math.round(20 * scaleFactor); // Padding from edges (scaled)
  const IMAGE_SPACING = Math.round(15 * scaleFactor); // Space between two images (scaled)
  
  if (usgsImages && usgsImages.length > 0) {
    const numImages = Math.min(usgsImages.length, 2);
    const imageAreaWidth = outputWidth - (IMAGE_PADDING * 2);
    const imageWidth = numImages === 2 
      ? Math.floor((imageAreaWidth - IMAGE_SPACING) / 2)
      : imageAreaWidth;
    
    console.log(`[generate-earthquake-image] Processing ${numImages} USGS image(s) for placement`);
    
    for (let i = 0; i < numImages; i++) {
      const usgsImage = usgsImages[i];
      if (!usgsImage || !usgsImage.url) {
        console.warn(`[generate-earthquake-image] Skipping invalid USGS image at index ${i}`);
        continue;
      }
      
      try {
        console.log(`[generate-earthquake-image] Downloading USGS image ${i + 1}/${numImages}: ${usgsImage.url}`);
        const imageBuffer = await downloadImage(usgsImage.url);
        
        if (imageBuffer) {
          const processedImage = await prepareUSGSImage(imageBuffer, imageWidth, IMAGE_AREA_HEIGHT);
          
          if (processedImage) {
            // Calculate position (two images side by side, or one centered)
            const x = IMAGE_PADDING + (i * (imageWidth + IMAGE_SPACING));
            const y = IMAGE_AREA_Y;
            
            compositeInputs.push({
              input: processedImage,
              left: x,
              top: y,
              blend: 'over',
            });
            
            console.log(`[generate-earthquake-image] ✅ Added USGS image ${i + 1} at (${x}, ${y})`);
          } else {
            console.warn(`[generate-earthquake-image] Failed to process USGS image ${i + 1}`);
          }
        } else {
          console.warn(`[generate-earthquake-image] Failed to download USGS image ${i + 1}`);
        }
      } catch (error) {
        console.error(`[generate-earthquake-image] Error processing USGS image ${i + 1}:`, error);
        // Continue with other images even if one fails
      }
    }
  } else {
    console.log(`[generate-earthquake-image] No USGS images provided - using template's static images only`);
  }
  
  // Composite template (base layer with ALL static elements) with dynamic text and USGS images
  // Layer order:
  // 1. Template (2ndUSGSTemp.png) - contains EVERYTHING static (background, map, rings, logos, footer, banner)
  // 2. Dynamic text overlay - only magnitude, headline, location
  // 3. USGS images (if provided) - actual earthquake-specific images from USGS
  
  // Scale template to match output dimensions if 4K is enabled
  let compositePipeline = template;
  
  if (ENABLE_4K && scaleFactor > 1.0) {
    // Scale template proportionally to maintain aspect ratio
    compositePipeline = template
      .resize(outputWidth, outputHeight, {
        kernel: 'lanczos3',  // Best quality resampling for upscaling
        withoutEnlargement: false,
      });
    
    console.log(`[generate-earthquake-image] Template scaled to ${outputWidth}x${outputHeight} (maintains aspect ratio)`);
  }
  
  // Composite all layers
  compositePipeline = compositePipeline.composite(compositeInputs, {
    blend: 'over',  // Explicit blend mode for clarity
  });
  
  // No additional resize needed - output is already at correct dimensions
  // Apply sharpening and output
  const composite = await compositePipeline
    .sharpen({       // Apply subtle sharpening to enhance text and image clarity
      sigma: 0.5,    // Subtle sharpening (0.5-1.0 is good for text)
      flat: 1.0,     // Flat areas sharpening
      jagged: 2.0    // Edge sharpening
    })
    .png({ 
      quality: 100,        // Maximum quality
      compressionLevel: 9, // Maximum compression (0-9, 9 = smallest file size)
      palette: false,      // Full color (no palette reduction)
      effort: 10           // Maximum compression effort
    })
    .toBuffer();
  
  // CRITICAL RULES:
  // - Template (2ndUSGSTemp.png) is ALWAYS the base layer
  // - We do NOT generate backgrounds, maps, rings, logos, footer, or "Breaking News:" text
  // - We ONLY draw the 3 dynamic text elements + actual USGS images from earthquake event
  // - Output dimensions match template exactly (no scaling/cropping)
  // - If template fails to load, we throw a hard error (already handled above)
  
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
  
  // Handle OPTIONS
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

