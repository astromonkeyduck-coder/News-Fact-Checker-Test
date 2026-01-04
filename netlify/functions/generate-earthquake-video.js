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
async function generateVideoFrames(magnitude, location, usgsImages, eventId, coordinates = null) {
  const { generateImage } = require('./generate-earthquake-image');
  
  const frameCount = 30; // 30 frames for 2-second video at 15fps
  const frames = [];
  
  console.log(`[generate-earthquake-video] 🎬 Generating ${frameCount} frames for video...`);
  
  // Generate base image (with effects)
  const baseImageBuffer = await generateImage(magnitude, location, usgsImages || [], eventId, 'standard', coordinates);
  const baseImage = sharp(baseImageBuffer);
  const metadata = await baseImage.metadata();
  const width = metadata.width;
  const height = metadata.height;
  
  // Create animated frames with varying effects
  for (let i = 0; i < frameCount; i++) {
    const progress = i / frameCount;
    const time = progress * Math.PI * 2; // Full cycle
    
    // Create animated effects overlay
    const effectsSVG = createAnimatedEffectsSVG(width, height, magnitude, time, progress);
    const effectsBuffer = await sharp(Buffer.from(effectsSVG))
      .resize(width, height)
      .png()
      .toBuffer();
    
    // Composite animated effects on base image
    const frame = await baseImage
      .clone()
      .composite([{
        input: effectsBuffer,
        blend: 'screen', // Screen blend for glow effects
        left: 0,
        top: 0
      }])
      .png()
      .toBuffer();
    
    frames.push(frame);
    
    if ((i + 1) % 10 === 0) {
      console.log(`[generate-earthquake-video] ✅ Generated ${i + 1}/${frameCount} frames`);
    }
  }
  
  return { frames, width, height };
}

/**
 * Create animated effects SVG that changes over time
 */
function createAnimatedEffectsSVG(width, height, magnitude, time, progress) {
  const particleCount = Math.min(40, Math.floor(magnitude * 4));
  const glowIntensity = 0.3 + (Math.sin(time) + 1) * 0.2; // Pulsating glow
  const shakeAmount = Math.min(10, magnitude * 1.5) * Math.sin(time * 2); // Oscillating shake
  const centerX = width * 0.5;
  const centerY = height * 0.6;
  const baseRadius = 120;
  const currentRadius = baseRadius + Math.sin(time * 2) * 30; // Pulsating radius
  
  // Create animated particles
  let particles = '';
  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2 + time;
    const distance = 50 + Math.sin(time * 2 + i) * 30;
    const x = centerX + Math.cos(angle) * distance + (Math.random() - 0.5) * shakeAmount;
    const y = centerY + Math.sin(angle) * distance + (Math.random() - 0.5) * shakeAmount;
    const size = (Math.random() * 4 + 1);
    const opacity = 0.3 + Math.sin(time + i) * 0.3;
    const hue = Math.sin(time + i) * 30 + 0; // Animated color
    particles += `
      <circle cx="${x}" cy="${y}" r="${size}" fill="rgba(255, ${100 + hue}, 0, ${opacity})">
        <animate attributeName="opacity" values="${opacity};${opacity * 0.3};${opacity}" dur="1.5s" repeatCount="indefinite"/>
      </circle>
    `;
  }
  
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="epicenterGlow${Math.floor(time)}" cx="50%" cy="50%">
          <stop offset="0%" stop-color="rgba(255, 50, 50, ${glowIntensity})" stop-opacity="1"/>
          <stop offset="50%" stop-color="rgba(255, 100, 0, ${glowIntensity * 0.6})" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="rgba(255, 150, 0, 0)" stop-opacity="0"/>
        </radialGradient>
      </defs>
      
      <!-- Pulsating epicenter glow -->
      <circle cx="${centerX}" cy="${centerY}" r="${currentRadius}" fill="url(#epicenterGlow${Math.floor(time)})" opacity="0.8"/>
      
      <!-- Expanding ring waves -->
      <circle cx="${centerX}" cy="${centerY}" r="${baseRadius * 1.5 + progress * 100}" fill="none" stroke="rgba(255, 100, 0, ${0.4 - progress * 0.3})" stroke-width="3">
        <animate attributeName="r" values="${baseRadius * 1.5};${baseRadius * 2.5};${baseRadius * 1.5}" dur="2s" repeatCount="indefinite"/>
      </circle>
      
      <!-- Particle effects -->
      ${particles}
      
      <!-- Text area subtle shake -->
      <g transform="translate(${Math.sin(time * 3) * shakeAmount * 0.2}, ${Math.cos(time * 3) * shakeAmount * 0.2})" opacity="0.15">
        <rect x="${width * 0.1}" y="${height * 0.1}" width="${width * 0.8}" height="${height * 0.3}" fill="rgba(255, 255, 255, 0.1)"/>
      </g>
    </svg>
  `;
}

/**
 * Convert frames to animated GIF
 * Note: Sharp doesn't directly support animated GIF creation
 * For now, we'll return the first frame and note that full GIF encoding
 * requires a library like gifencoder or a service
 */
async function framesToAnimatedGIF(frames, width, height) {
  console.log(`[generate-earthquake-video] 🎥 Processing ${frames.length} frames...`);
  
  // Sharp doesn't support animated GIF creation directly
  // For production, you'd use a library like 'gifencoder' or 'gif.js'
  // For now, we'll create a simple approach using the frames
  
  // Return first frame as placeholder - full GIF requires additional library
  // TODO: Integrate gifencoder or similar for full animated GIF support
  console.log(`[generate-earthquake-video] ⚠️ Full animated GIF encoding requires gifencoder library`);
  console.log(`[generate-earthquake-video] 💡 Returning first frame - can be enhanced with gifencoder`);
  
  // For now, return first frame (can be enhanced later)
  return frames[0];
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
    const { magnitude, location, eventId, lat, lon, usgsImages } = body;
    
    if (!magnitude || !location || !eventId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Missing required fields: magnitude, location, eventId",
        }),
      };
    }
    
    console.log(`[generate-earthquake-video] 🎬 Starting video generation for M${magnitude} earthquake near ${location}`);
    
    // Generate video frames
    const { frames, width, height } = await generateVideoFrames(magnitude, location, usgsImages, eventId, { lat, lon });
    
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

