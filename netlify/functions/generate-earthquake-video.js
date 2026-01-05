/**
 * Generate Animated Video for Earthquakes
 * Creates engaging animated videos with visual effects for social media previews
 * 
 * POST /.netlify/functions/generate-earthquake-video
 * Body: { magnitude, location, eventId, lat, lon, usgsImages }
 */

const sharp = require('sharp');
const { getStore } = require('@netlify/blobs');

/**
 * Generate animated video frames with visual effects
 */
// PHASE 6: Updated to use eventId/detailUrl instead of usgsImages
async function generateVideoFrames(magnitude, location, eventId, coordinates = null, detailUrl = null) {
  const { generateImage } = require('./generate-earthquake-image');
  const crypto = require('crypto');
  
  // FORENSIC LOGGING: Log video generation request
  const lat = coordinates?.[1] ?? coordinates?.lat ?? null;
  const lon = coordinates?.[0] ?? coordinates?.lon ?? null;
  
  console.log(`[generate-earthquake-video] 🔍 FORENSIC: Video render request:`, {
    eventId,
    detailUrl,
    coordinates: { lat, lon },
    magnitude,
    location,
    timestamp: new Date().toISOString()
  });
  
  const frameCount = 60; // 60 frames for smooth animation (6 seconds at 10fps - slow and professional)
  const frames = [];
  
  console.log(`[generate-earthquake-video] 🎬 Generating ${frameCount} frames for video...`);
  
  // PHASE 6: Generate base image - function will fetch GeoJSON detail and extract products internally
  // This ensures event-locked image selection (no cross-event contamination)
  const baseImageBuffer = await generateImage(magnitude, location, eventId, 'standard', coordinates, detailUrl);
  
  // FORENSIC: Log base image buffer hash
  const baseImageHash = crypto.createHash('sha1').update(baseImageBuffer).digest('hex').substring(0, 8);
  console.log(`[generate-earthquake-video] 🔍 FORENSIC: Base image buffer hash: ${baseImageHash} (eventId: ${eventId})`);
  const baseImage = sharp(baseImageBuffer);
  const metadata = await baseImage.metadata();
  const width = metadata.width;
  const height = metadata.height;
  
  // Create animated frames with varying effects
  for (let i = 0; i < frameCount; i++) {
    const progress = i / frameCount;
    const time = progress * Math.PI * 4; // Slower cycle (4π instead of 2π for slower, more controlled animation)
    
    // Create animated effects overlay
    const effectsSVG = createAnimatedEffectsSVG(width, height, magnitude, time, progress);
    const effectsBuffer = await sharp(Buffer.from(effectsSVG))
      .resize(width, height)
      .png()
      .toBuffer();
    
    // Composite animated effects on base image (4K filter, flash, roundabout)
    // Use 'over' blend with the effects as a subtle overlay
    const frame = await baseImage
      .clone()
      .composite([{
        input: effectsBuffer,
        blend: 'over', // Over blend - effects sit on top
        left: 0,
        top: 0
      }])
      .png()
      .toBuffer();
    
    // FORENSIC: Log frame buffer hash for first and last frames
    if (i === 0 || i === frameCount - 1) {
      const frameHash = crypto.createHash('sha1').update(frame).digest('hex').substring(0, 8);
      console.log(`[generate-earthquake-video] 🔍 FORENSIC: Frame ${i + 1} buffer hash: ${frameHash} (eventId: ${eventId})`);
    }
    
    frames.push(frame);
    
    if ((i + 1) % 10 === 0) {
      console.log(`[generate-earthquake-video] ✅ Generated ${i + 1}/${frameCount} frames`);
    }
  }
  
  // FORENSIC LOGGING: Log final video generation summary
  console.log(`[generate-earthquake-video] 🔍 FORENSIC: Video generation complete:`, {
    eventId,
    detailUrl,
    coordinates: { lat, lon },
    frameCount: frames.length,
    dimensions: `${width}x${height}`,
    baseImageHash,
    firstFrameHash: frames.length > 0 ? crypto.createHash('sha1').update(frames[0]).digest('hex').substring(0, 8) : null,
    lastFrameHash: frames.length > 0 ? crypto.createHash('sha1').update(frames[frames.length - 1]).digest('hex').substring(0, 8) : null
  });
  
  return { frames, width, height };
}

/**
 * Create animated effects SVG with 4K filter, flash, and roundabout animation
 * These effects are ONLY for video/GIF previews for social media
 */
function createAnimatedEffectsSVG(width, height, magnitude, time, progress) {
  const centerX = width * 0.5;
  const centerY = height * 0.6 - 70; // Moved up 70 pixels (was 50, now 70 - user requested +20 more)
  const scaleFactor = width / 940;
  
  // Professional news-style effects
  
  // 1. Seismic wave effects - expanding ripples from epicenter (SLOW and controlled)
  const waveSpeed = 0.15; // Much slower expansion for professional look
  const waveCount = 3; // Fewer waves, more controlled
  const waves = [];
  for (let i = 0; i < waveCount; i++) {
    const waveProgress = (progress + i * 0.33) % 1.0; // Staggered waves
    const waveRadius = waveProgress * Math.min(width, height) * 0.4; // Waves expand more slowly
    const waveOpacity = (1 - waveProgress) * 0.4; // Subtle visibility
    const waveIntensity = magnitude / 10; // Moderate intensity
    const waveThickness = (3 + waveIntensity * 2) * scaleFactor;
    waves.push({ radius: waveRadius, opacity: waveOpacity, intensity: waveIntensity, thickness: waveThickness });
  }
  
  // 2. Subtle flash effect - very slow pulse (barely noticeable, professional)
  const flashPulse = Math.sin(time * 0.5); // Very slow, subtle pulse
  const flashIntensity = Math.min(0.2, magnitude / 20) * (0.3 + Math.abs(flashPulse) * 0.2);
  const flashRadius = Math.min(width, height) * (0.12 + Math.abs(flashPulse) * 0.05);
  
  // 3. Intensity-based color (red for high magnitude, yellow for medium, white for low)
  const magnitudeColor = magnitude >= 6.0 ? 'rgba(255, 30, 30, 0.9)' : 
                         magnitude >= 4.0 ? 'rgba(255, 180, 40, 0.8)' : 
                         'rgba(255, 255, 255, 0.7)';
  
  // 4. Accurate earthquake rings - P-wave, S-wave, Surface wave (based on magnitude)
  // Calculate approximate felt radius in km based on magnitude
  // Formula: felt radius ≈ 10^(magnitude - 3) km (rough approximation)
  const feltRadiusKm = Math.pow(10, magnitude - 3);
  
  // Convert km to pixels (estimate: for full image, use ~10km per 100px as baseline)
  // This is approximate since we don't have exact zoom level for the full image
  const kmPerPixel = 0.1; // ~10km per 100px for full image view
  const feltRadiusPx = Math.min(feltRadiusKm / kmPerPixel, Math.min(width, height) * 0.3);
  
  // Create three rings representing different wave phases (with smooth pulsing animation)
  const earthquakeRings = [];
  const ringTypes = [
    { name: 'P-wave', color: '#60A5FA', baseRadius: 0.3, opacity: 0.4 }, // Blue - fastest
    { name: 'S-wave', color: '#FBBF24', baseRadius: 0.6, opacity: 0.5 }, // Yellow - secondary
    { name: 'Surface', color: '#DC2626', baseRadius: 1.0, opacity: 0.6 }  // Red - most destructive
  ];
  
  for (let i = 0; i < ringTypes.length; i++) {
    const ringType = ringTypes[i];
    const baseRadius = feltRadiusPx * ringType.baseRadius;
    // Smooth pulsing animation (slow and controlled)
    const pulseAmount = Math.sin(time * 0.8) * (baseRadius * 0.1); // 10% pulse variation
    const ringRadius = Math.max(baseRadius + pulseAmount, 20 * scaleFactor); // Minimum 20px
    const ringOpacity = ringType.opacity * (0.7 + Math.sin(time * 0.8) * 0.2); // Subtle opacity variation
    earthquakeRings.push({
      radius: ringRadius,
      opacity: ringOpacity,
      color: ringType.color,
      name: ringType.name
    });
  }
  
  // 5. Intensity heat map effect - very subtle, slow pulse
  const heatMapOpacity = 0.15 + Math.sin(time * 0.6) * 0.1; // Very slow, subtle pulse
  
  // 9. Seismic activity indicator bars (like a seismograph) - SLOW movement
  const barCount = 8;
  const bars = [];
  for (let i = 0; i < barCount; i++) {
    const barX = width * 0.1 + (i * width * 0.1);
    const barHeight = (20 + Math.sin(time * 0.8 + i * 0.3) * 12 + magnitude * 4) * scaleFactor; // Much slower
    const barOpacity = 0.4 + Math.sin(time * 0.8 + i * 0.3) * 0.2; // Subtle variation
    bars.push({ x: barX, height: barHeight, opacity: barOpacity });
  }
  
  // 10. ANIMATED RED BORDER LINES - Moving around the entire image perimeter (SLOW)
  const borderThickness = 4 * scaleFactor;
  const borderSpeed = 0.1; // Much slower border movement for professional look
  const borderProgress = (time * borderSpeed) % 1.0;
  const borderLength = 60 * scaleFactor; // Length of each moving segment
  const borderGap = 20 * scaleFactor; // Gap between segments
  
  // Calculate border positions (clockwise around perimeter)
  const borderSegments = [];
  const totalPerimeter = (width + height) * 2;
  const segmentCount = Math.floor(totalPerimeter / (borderLength + borderGap));
  
  for (let i = 0; i < segmentCount; i++) {
    const segmentProgress = (borderProgress + i / segmentCount) % 1.0;
    const position = segmentProgress * totalPerimeter;
    
    let x1, y1, x2, y2;
    
    // Top edge
    if (position < width) {
      x1 = position;
      y1 = 0;
      x2 = Math.min(position + borderLength, width);
      y2 = 0;
    }
    // Right edge
    else if (position < width + height) {
      x1 = width;
      y1 = position - width;
      x2 = width;
      y2 = Math.min(position - width + borderLength, height);
    }
    // Bottom edge
    else if (position < width * 2 + height) {
      x1 = width - (position - width - height);
      y1 = height;
      x2 = Math.max(width - (position - width - height + borderLength), 0);
      y2 = height;
    }
    // Left edge
    else {
      x1 = 0;
      y1 = height - (position - width * 2 - height);
      x2 = 0;
      y2 = Math.max(height - (position - width * 2 - height + borderLength), 0);
    }
    
    borderSegments.push({ x1, y1, x2, y2 });
  }
  
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Seismic wave gradient -->
        <radialGradient id="waveGrad${Math.floor(time * 100)}" cx="50%" cy="50%">
          <stop offset="0%" stop-color="${magnitudeColor}" stop-opacity="0.7"/>
          <stop offset="50%" stop-color="${magnitudeColor}" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="${magnitudeColor}" stop-opacity="0"/>
        </radialGradient>
        
        <!-- Flash effect gradient -->
        <radialGradient id="flashGrad${Math.floor(time * 100)}" cx="50%" cy="50%">
          <stop offset="0%" stop-color="rgba(255, 255, 255, ${flashIntensity})" stop-opacity="1"/>
          <stop offset="40%" stop-color="rgba(255, 255, 255, ${flashIntensity * 0.5})" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="rgba(255, 255, 255, 0)" stop-opacity="0"/>
        </radialGradient>
        
        <!-- Heat map gradient -->
        <radialGradient id="heatGrad${Math.floor(time * 100)}" cx="50%" cy="50%">
          <stop offset="0%" stop-color="${magnitudeColor}" stop-opacity="${heatMapOpacity}"/>
          <stop offset="70%" stop-color="${magnitudeColor}" stop-opacity="${heatMapOpacity * 0.5}"/>
          <stop offset="100%" stop-color="${magnitudeColor}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      
      <!-- Heat map effect - intensity visualization -->
      <circle cx="${centerX}" cy="${centerY}" r="${Math.min(width, height) * 0.35}" 
              fill="url(#heatGrad${Math.floor(time * 100)})" 
              opacity="${heatMapOpacity}"/>
      
      <!-- Seismic waves - expanding ripples (more dramatic) -->
      ${waves.map((wave, i) => `
        <circle cx="${centerX}" cy="${centerY}" r="${wave.radius}" 
                fill="none" 
                stroke="${magnitudeColor}" 
                stroke-width="${wave.thickness}" 
                opacity="${wave.opacity}"
                stroke-dasharray="${15 * scaleFactor} ${8 * scaleFactor}"/>
      `).join('')}
      
      <!-- Accurate earthquake rings - P-wave (blue), S-wave (yellow), Surface wave (red) -->
      ${earthquakeRings.map((ring, i) => `
        <circle cx="${centerX}" cy="${centerY}" r="${ring.radius}" 
                fill="none" 
                stroke="${ring.color}" 
                stroke-width="${(2 + i * 0.5) * scaleFactor}" 
                opacity="${ring.opacity}"/>
      `).join('')}
      
      <!-- Dramatic flash effect -->
      <circle cx="${centerX}" cy="${centerY}" r="${flashRadius}" 
              fill="url(#flashGrad${Math.floor(time * 100)})" 
              opacity="${0.25 + Math.abs(flashPulse) * 0.35}"/>
      
      <!-- Seismic activity indicator bars (seismograph style) -->
      ${bars.map((bar, i) => `
        <rect x="${bar.x}" y="${height * 0.85}" width="${15 * scaleFactor}" 
              height="${-bar.height}" 
              fill="${magnitudeColor}" 
              opacity="${bar.opacity}"
              rx="${2 * scaleFactor}"/>
      `).join('')}
      
      <!-- Epicenter marker - smooth, slow pulsing center point (like a heartbeat) - KEEP THIS (user likes it) -->
      <!-- Use smooth easing function for natural animation - keep slow and controlled -->
      <circle cx="${centerX}" cy="${centerY}" r="${(10 + Math.sin(time * 0.8) * 3) * scaleFactor}" 
              fill="${magnitudeColor}" 
              opacity="${0.85 + Math.sin(time * 0.8) * 0.12}"/>
      <circle cx="${centerX}" cy="${centerY}" r="${(5 + Math.sin(time * 0.8) * 1.5) * scaleFactor}" 
              fill="rgba(255, 255, 255, 0.95)" 
              opacity="1"/>
      <circle cx="${centerX}" cy="${centerY}" r="${(2.5 + Math.sin(time * 0.8) * 0.8) * scaleFactor}" 
              fill="${magnitudeColor}" 
              opacity="1"/>
      
      <!-- ANIMATED RED BORDER LINES - Moving around entire perimeter -->
      ${borderSegments.map((segment, i) => `
        <line x1="${segment.x1}" y1="${segment.y1}" x2="${segment.x2}" y2="${segment.y2}" 
              stroke="rgba(255, 0, 0, 1)" 
              stroke-width="${borderThickness}" 
              stroke-linecap="round"
              opacity="${0.9 + Math.sin(time * 4 + i) * 0.1}"/>
      `).join('')}
    </svg>
  `;
}

/**
 * Convert frames to animated GIF
 * Uses gifenc (pure JS, no dependencies)
 */
async function framesToAnimatedGIF(frames, width, height) {
  console.log(`[generate-earthquake-video] 🎥 Processing ${frames.length} frames to animated GIF...`);
  
  // Try gifenc first (pure JS, no system dependencies)
  try {
    const { GIFEncoder, quantize, applyPalette } = require('gifenc');
    const sharp = require('sharp');
    
    console.log(`[generate-earthquake-video] 🎬 Using gifenc (pure JS encoder)...`);
    
    // Create GIF encoder
    const gif = GIFEncoder({
      width: width,
      height: height,
      repeat: 0 // Repeat forever
    });
    
    // CRITICAL: Use a shared palette for all frames to ensure smooth animation
    // Generate palette from a sample of frames (first, middle, last)
    const sampleFrames = [frames[0], frames[Math.floor(frames.length / 2)], frames[frames.length - 1]];
    const allSamplePixels = [];
    
    for (const sampleFrame of sampleFrames) {
      const image = sharp(sampleFrame);
      const { data } = await image
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const rgba = new Uint8ClampedArray(data);
      // Sample every 10th pixel to speed up palette generation
      for (let i = 0; i < rgba.length; i += 40) {
        allSamplePixels.push(rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]);
      }
    }
    
    const sampleRgba = new Uint8ClampedArray(allSamplePixels);
    const sharedPalette = quantize(sampleRgba, 256);
    
    console.log(`[generate-earthquake-video] ✅ Generated shared palette with ${sharedPalette.length} colors`);
    
    // Process each frame with shared palette
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      
      // Convert PNG buffer to RGBA array
      const image = sharp(frame);
      const { data, info } = await image
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      
      // Convert to Uint8ClampedArray (RGBA format)
      const rgba = new Uint8ClampedArray(data);
      
      // Apply shared palette to get indexed bitmap (ensures color consistency across frames)
      const index = applyPalette(rgba, sharedPalette);
      
      // Write frame with delay (67ms = 15fps for smoother animation while still controlled)
      gif.writeFrame(index, width, height, { 
        palette: sharedPalette,
        delay: 67 // 15fps for smoother animation while maintaining professional look
      });
      
      if ((i + 1) % 10 === 0) {
        console.log(`[generate-earthquake-video] ✅ Processed ${i + 1}/${frames.length} frames`);
      }
    }
    
    // Finish encoding
    gif.finish();
    
    // Get the output bytes
    const gifBytes = gif.bytes();
    const gifBuffer = Buffer.from(gifBytes);
    
    console.log(`[generate-earthquake-video] ✅ Created animated GIF with gifenc: ${Math.round(gifBuffer.length / 1024)}KB`);
    return gifBuffer;
    
  } catch (gifencError) {
    // Final fallback: Return first frame if gifenc fails
    console.error(`[generate-earthquake-video] ❌ GIF encoding failed: ${gifencError.message}`);
    console.error(`[generate-earthquake-video] 💡 gifenc should be installed: npm install gifenc`);
    console.error(`[generate-earthquake-video] 💡 Returning first frame as fallback (all ${frames.length} frames generated)`);
    return frames[0];
  }
}

/**
 * Store video in blob storage
 */
async function storeVideo(videoBuffer, eventId) {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN;
  const storeName = "post-media";
  const videoKey = `earthquake-${eventId}-video-${Date.now()}.gif`;
  
  if (!siteID || !token) {
    console.warn('[generate-earthquake-video] ⚠️ Missing NETLIFY_SITE_ID or NETLIFY_BLOB_READ_WRITE_TOKEN');
    const baseUrl = process.env.URL || 'https://noteworthynews.co';
    return `${baseUrl}/.netlify/functions/get-uploaded-image?key=${encodeURIComponent(videoKey)}`;
  }
  
  const store = getStore({
    name: storeName,
    siteID: siteID,
    token: token,
  });
  
  console.log(`[generate-earthquake-video] 📤 Storing animated GIF: ${videoKey} (${Math.round(videoBuffer.length / 1024)}KB)`);
  
  try {
    await store.set(videoKey, videoBuffer, {
      contentType: 'image/gif',
    });
    
    const baseUrl = process.env.URL || 'https://noteworthynews.co';
    const videoUrl = `${baseUrl}/.netlify/functions/get-uploaded-image?key=${encodeURIComponent(videoKey)}`;
    
    console.log(`[generate-earthquake-video] ✅ Animated GIF stored successfully: ${videoUrl}`);
    return videoUrl;
  } catch (error) {
    console.error(`[generate-earthquake-video] ❌ Failed to store video:`, error.message);
    throw error;
  }
}

// Export functions for local testing
exports.generateVideoFrames = generateVideoFrames;
exports.framesToAnimatedGIF = framesToAnimatedGIF;
exports.createAnimatedEffectsSVG = createAnimatedEffectsSVG;

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
    // PHASE 6: Accept eventId/detailUrl instead of usgsImages
    const { magnitude, location, eventId, lat, lon, detailUrl } = body;
    
    if (!magnitude || !location || !eventId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Missing required fields: magnitude, location, eventId",
        }),
      };
    }
    
    console.log(`[generate-earthquake-video] 🎬 Starting video generation for M${magnitude} earthquake near ${location} (eventId: ${eventId})`);
    
    // BUG FIX: Convert coordinates object { lat, lon } to array format [lon, lat] expected by generateImage
    const coordinatesArray = (lat != null && lon != null) ? [lon, lat] : null;
    
    // FORENSIC: Log coordinate conversion
    console.log(`[generate-earthquake-video] 🔍 FORENSIC: Coordinate conversion:`, {
      received: { lat, lon },
      converted: coordinatesArray,
      eventId
    });
    
    // PHASE 6: Generate video frames - function will fetch GeoJSON detail and extract products internally
    const { frames, width, height } = await generateVideoFrames(magnitude, location, eventId, coordinatesArray, detailUrl);
    
    // Convert frames to animated GIF
    console.log(`[generate-earthquake-video] 🎬 Converting ${frames.length} frames to animated GIF...`);
    const gifBuffer = await framesToAnimatedGIF(frames, width, height);
    
    // Store animated GIF
    const videoUrl = await storeVideo(gifBuffer, eventId);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        url: videoUrl,
        eventId: eventId,
        framesGenerated: frames.length,
        dimensions: `${width}x${height}`,
        format: 'gif',
        duration: `${(frames.length / 15).toFixed(1)}s`, // ~15fps
        note: 'Animated GIF created with visual effects. Can be converted to MP4 for better social media support.'
      }),
    };
    
  } catch (error) {
    console.error('[generate-earthquake-video] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error?.message || "Internal server error",
      }),
    };
  }
};

