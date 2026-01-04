/**
 * Generate Animated GIF/Video for Earthquakes
 * Creates animated visualizations of earthquake shake intensity
 * 
 * POST /.netlify/functions/generate-earthquake-animation
 * Body: { magnitude, location, eventId, lat, lon }
 */

const sharp = require('sharp');
const { getStore } = require('@netlify/blobs');

/**
 * Generate animated GIF showing shake intensity propagation
 */
async function generateShakeAnimation(magnitude, location, eventId, lat, lon) {
  const frames = [];
  const frameCount = 20; // 20 frames for smooth animation
  const duration = 2000; // 2 seconds total
  
  // Create base image (same as earthquake image)
  const { generateImage } = require('./generate-earthquake-image');
  const baseImage = await generateImage(magnitude, location, [], eventId, 'standard');
  
  // Generate frames with increasing shake intensity
  for (let i = 0; i < frameCount; i++) {
    const progress = i / frameCount;
    const shakeIntensity = Math.sin(progress * Math.PI * 4) * (magnitude / 10); // Oscillating shake
    
    // Apply shake effect to base image
    const frame = await sharp(baseImage)
      .composite([{
        input: Buffer.from(`
          <svg width="3840" height="2160">
            <circle cx="${1920 + shakeIntensity * 50}" cy="${1080 + shakeIntensity * 30}" 
                    r="${50 + magnitude * 5}" 
                    fill="rgba(255,0,0,${0.3 * (1 - progress)})" 
                    opacity="${0.5 * Math.sin(progress * Math.PI)}"/>
          </svg>
        `),
        blend: 'over'
      }])
      .png()
      .toBuffer();
    
    frames.push(frame);
  }
  
  // For now, return first frame as placeholder
  // Full GIF generation would require gifencoder or similar library
  return frames[0];
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
    const { magnitude, location, eventId, lat, lon } = body;
    
    if (!magnitude || !location || !eventId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Missing required fields: magnitude, location, eventId",
        }),
      };
    }
    
    // Generate animation (simplified - returns static frame for now)
    // Full implementation would use gifencoder or ffmpeg
    const animationBuffer = await generateShakeAnimation(magnitude, location, eventId, lat, lon);
    
    // Store animation
    const siteID = process.env.NETLIFY_SITE_ID;
    const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN;
    const storeName = "post-media";
    const animationKey = `earthquake-${eventId}-animation-${Date.now()}.png`;
    
    if (siteID && token) {
      const store = getStore({
        name: storeName,
        siteID: siteID,
        token: token,
      });
      
      await store.set(animationKey, animationBuffer, {
        contentType: 'image/png',
      });
    }
    
    const baseUrl = process.env.URL || 'https://noteworthynews.co';
    const animationUrl = `${baseUrl}/.netlify/functions/get-uploaded-image?key=${encodeURIComponent(animationKey)}`;
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        url: animationUrl,
        eventId: eventId,
        note: 'Animation generation simplified - returns static frame. Full GIF/MP4 generation requires additional libraries.',
      }),
    };
    
  } catch (error) {
    console.error('[generate-earthquake-animation] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error?.message || "Internal server error",
      }),
    };
  }
};

