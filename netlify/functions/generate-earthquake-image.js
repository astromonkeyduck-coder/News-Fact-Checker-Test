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

// Text positioning (adjusted for template layout)
// These will need fine-tuning based on actual template inspection
const MAGNITUDE_X = 50;
const MAGNITUDE_Y = 100;
const LOCATION_X = 50;
const LOCATION_Y = 150;
const MAX_LOCATION_WIDTH = 800; // Max width for location text

// Image placement area (lower section)
const IMAGE_AREA_Y = 300;
const IMAGE_AREA_HEIGHT = 400;
const IMAGE_PADDING = 20;
const IMAGE_SPACING = 10;

// Color (red from template - adjust if needed)
const RED_COLOR = '#FF0000';

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
 * Create SVG text overlay for magnitude
 */
function createMagnitudeSVG(text, x, y, fontSize = 41.5) {
  const escapedText = escapeSVGText(text);
  return `
    <svg width="${TEMPLATE_WIDTH}" height="${TEMPLATE_HEIGHT}">
      <text 
        x="${x}" 
        y="${y}" 
        font-family="Roboto, Arial, sans-serif" 
        font-size="${fontSize}" 
        font-weight="bold"
        fill="${RED_COLOR}">
        ${escapedText}
      </text>
    </svg>
  `;
}

/**
 * Create SVG text overlay for location with auto-sizing
 * Estimates text width and reduces font size if needed
 */
function createLocationSVG(text, x, y, maxWidth, initialSize = 41.5) {
  // Estimate character width (approximate for Roboto)
  const avgCharWidth = initialSize * 0.6;
  const estimatedWidth = text.length * avgCharWidth;
  
  let fontSize = initialSize;
  if (estimatedWidth > maxWidth) {
    // Reduce font size proportionally
    fontSize = Math.max(20, Math.floor((maxWidth / estimatedWidth) * initialSize));
  }
  
  const escapedText = escapeSVGText(text);
  return `
    <svg width="${TEMPLATE_WIDTH}" height="${TEMPLATE_HEIGHT}">
      <text 
        x="${x}" 
        y="${y}" 
        font-family="Roboto, Arial, sans-serif" 
        font-size="${fontSize}" 
        fill="${RED_COLOR}">
        ${escapedText}
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
    
    // Resize and crop
    const processed = await image
      .resize(width, height, { fit: 'cover' })
      .extract({ left, top, width: targetWidth, height: targetHeight })
      .png()
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
  // In Netlify Functions, __dirname is /var/task/netlify/functions/generate-earthquake-image
  // In local dev, it's the actual project path
  const possiblePaths = [
    path.join(__dirname, '../../1stUSGSTemp.png'),  // From function dir: netlify/functions -> root
    path.join(__dirname, '../../../1stUSGSTemp.png'), // If nested deeper
    path.join(process.cwd(), '1stUSGSTemp.png'),     // Current working directory
    path.resolve('./1stUSGSTemp.png'),               // Relative to cwd
    path.resolve(__dirname, '../../1stUSGSTemp.png'), // Absolute from function
    '/var/task/1stUSGSTemp.png',                     // Netlify Lambda path
  ];
  
  let templateBuffer = null;
  let templatePath = null;
  
  console.log(`[generate-earthquake-image] Looking for template. __dirname: ${__dirname}, cwd: ${process.cwd()}`);
  
  for (const templatePathCandidate of possiblePaths) {
    console.log(`[generate-earthquake-image] Checking: ${templatePathCandidate}`);
    if (fs.existsSync(templatePathCandidate)) {
      templatePath = templatePathCandidate;
      templateBuffer = fs.readFileSync(templatePathCandidate);
      console.log(`[generate-earthquake-image] ✅ Loaded template from: ${templatePath}`);
      break;
    }
  }
  
  if (!templateBuffer) {
    console.error(`[generate-earthquake-image] ❌ Template not found. Tried paths:`, possiblePaths);
    throw new Error(`Template not found. Tried: ${possiblePaths.join(', ')}`);
  }
  
  // Load template into Sharp
  const template = sharp(templateBuffer);
  const templateMetadata = await template.metadata();
  
  // Format magnitude text
  const magnitudeText = `M${magnitude.toFixed(1)}`;
  
  // Create SVG overlays for text
  const magnitudeSVG = Buffer.from(createMagnitudeSVG(magnitudeText, MAGNITUDE_X, MAGNITUDE_Y));
  const locationSVG = Buffer.from(createLocationSVG(location, LOCATION_X, LOCATION_Y, MAX_LOCATION_WIDTH));
  
  // Composite template with text overlays
  let composite = await template
    .composite([
      { input: magnitudeSVG, blend: 'over' },
      { input: locationSVG, blend: 'over' },
    ])
    .toBuffer();
  
  // Add USGS images if available
  if (usgsImages && usgsImages.length > 0) {
    const numImages = Math.min(usgsImages.length, 2);
    const imageAreaWidth = templateMetadata.width - (IMAGE_PADDING * 2);
    const imageWidth = numImages === 2 
      ? Math.floor((imageAreaWidth - IMAGE_SPACING) / 2)
      : imageAreaWidth;
    const imageHeight = IMAGE_AREA_HEIGHT;
    
    const imageInputs = [];
    
    for (let i = 0; i < numImages; i++) {
      const usgsImage = usgsImages[i];
      const imageBuffer = await downloadImage(usgsImage.url);
      
      if (imageBuffer) {
        const processedImage = await prepareUSGSImage(imageBuffer, imageWidth, imageHeight);
        
        if (processedImage) {
          // Calculate position
          const x = IMAGE_PADDING + (i * (imageWidth + IMAGE_SPACING));
          const y = IMAGE_AREA_Y;
          
          imageInputs.push({
            input: processedImage,
            left: x,
            top: y,
            blend: 'over',
          });
        }
      }
    }
    
    // Composite USGS images
    if (imageInputs.length > 0) {
      composite = await sharp(composite)
        .composite(imageInputs)
        .png()
        .toBuffer();
    }
  }
  
  return composite;
}

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

