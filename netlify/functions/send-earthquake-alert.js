/**
 * Send email alert for all earthquakes
 * 
 * POST /.netlify/functions/send-earthquake-alert
 * Body: { earthquake: {...}, imageUrl: "..." }
 */

const { Resend } = require('resend');

/**
 * Format time for human-readable display
 */
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
}

/**
 * Generate static map image URL
 * Uses OpenStreetMap StaticMap service (free, no API key needed)
 * Falls back to alternative services if needed
 */
function generateMapImageUrl(lat, lon, zoom = 10, width = 600, height = 400) {
  if (!lat || !lon) return null;
  
  // Primary: Use OpenStreetMap StaticMap service
  // Format: https://staticmap.openstreetmap.de/staticmap.php?center=LAT,LON&zoom=ZOOM&size=WxH&markers=LAT,LON,red-pushpin
  try {
    const baseUrl = 'https://staticmap.openstreetmap.de/staticmap.php';
    const params = new URLSearchParams({
      center: `${lat},${lon}`,
      zoom: zoom.toString(),
      size: `${width}x${height}`,
      markers: `${lat},${lon},red-pushpin`,
    });
    
    return `${baseUrl}?${params.toString()}`;
  } catch (error) {
    console.warn('[send-earthquake-alert] ⚠️ Error generating map URL:', error.message);
    // Fallback: Use a simpler URL format
    return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=${zoom}&size=${width}x${height}&markers=${lat},${lon},red-pushpin`;
  }
}

/**
 * Fetch location details using reverse geocoding
 * Uses OpenStreetMap Nominatim API (free, no API key needed)
 */
async function fetchLocationDetails(lat, lon) {
  if (!lat || !lon) return null;
  
  try {
    // Use OpenStreetMap Nominatim for reverse geocoding
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'NoteworthyNews/1.0 (contact@noteworthynews.co)',
      },
    });
    
    if (!response.ok) {
      console.warn(`[send-earthquake-alert] ⚠️ Reverse geocoding failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return {
      displayName: data.display_name || null,
      address: data.address || {},
      country: data.address?.country || null,
      state: data.address?.state || data.address?.region || null,
      city: data.address?.city || data.address?.town || data.address?.village || null,
      county: data.address?.county || null,
      postcode: data.address?.postcode || null,
    };
  } catch (error) {
    console.warn(`[send-earthquake-alert] ⚠️ Error fetching location details:`, error.message);
    return null;
  }
}

/**
 * Estimate population within radius (rough approximation)
 * Uses a simple formula based on distance from major cities
 * This is a placeholder - real population data would require a proper API
 */
function estimateAffectedPopulation(magnitude, depth) {
  // Rough estimation based on magnitude and depth
  // This is a simplified model - real data would come from population APIs
  const baseRadius = magnitude * 10; // km radius
  const depthFactor = depth ? Math.max(1, depth / 10) : 1;
  const effectiveRadius = baseRadius / depthFactor;
  
  // Very rough population estimate (this is placeholder logic)
  // Real implementation would use population density data
  const estimatedAffected = Math.round(effectiveRadius * effectiveRadius * 50); // Very rough estimate
  
  if (estimatedAffected < 1000) {
    return `${estimatedAffected.toLocaleString()} people`;
  } else if (estimatedAffected < 1000000) {
    return `${(estimatedAffected / 1000).toFixed(1)}K people`;
  } else {
    return `${(estimatedAffected / 1000000).toFixed(2)}M people`;
  }
}

/**
 * Get earthquake impact level description
 */
function getImpactDescription(magnitude, depth) {
  if (magnitude >= 7.0) {
    return 'Major earthquake - Significant damage possible';
  } else if (magnitude >= 6.0) {
    return 'Strong earthquake - Moderate damage possible';
  } else if (magnitude >= 5.0) {
    return 'Moderate earthquake - Light damage possible';
  } else if (magnitude >= 4.0) {
    return 'Light earthquake - Generally felt, minor damage possible';
  } else {
    return 'Minor earthquake - Generally felt, no damage expected';
  }
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Find nearby important locations (cities, landmarks, etc.)
 * Uses OpenStreetMap Overpass API to find nearby places
 */
async function findNearbyLocations(lat, lon, radiusKm = 50) {
  if (!lat || !lon) return [];
  
  try {
    // Use Overpass API to find nearby cities, towns, and important places
    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["place"~"^(city|town|village|hamlet)$"](around:${radiusKm * 1000},${lat},${lon});
        node["amenity"~"^(university|college|school)$"](around:${radiusKm * 1000},${lat},${lon});
        node["tourism"~"^(attraction|museum|theme_park|zoo)$"](around:${radiusKm * 1000},${lat},${lon});
        node["leisure"~"^(stadium|park|amusement_arcade)$"](around:${radiusKm * 1000},${lat},${lon});
        way["place"~"^(city|town|village|hamlet)$"](around:${radiusKm * 1000},${lat},${lon});
        way["amenity"~"^(university|college|school)$"](around:${radiusKm * 1000},${lat},${lon});
      );
      out center;
    `;
    
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'NoteworthyNews/1.0 (contact@noteworthynews.co)',
      },
    });
    
    if (!response.ok) {
      console.warn(`[send-earthquake-alert] ⚠️ Overpass API failed: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    const locations = [];
    
    for (const element of data.elements || []) {
      const elementLat = element.lat || (element.center && element.center.lat);
      const elementLon = element.lon || (element.center && element.center.lon);
      
      if (!elementLat || !elementLon) continue;
      
      const distance = calculateDistance(lat, lon, elementLat, elementLon);
      const tags = element.tags || {};
      
      let name = tags.name || tags['name:en'] || 'Unknown';
      let type = tags.place || tags.amenity || tags.tourism || tags.leisure || 'location';
      let category = 'location';
      
      // Categorize the location
      if (tags.place) {
        category = 'city';
        type = tags.place;
      } else if (tags.amenity === 'university' || tags.amenity === 'college') {
        category = 'education';
        type = tags.amenity;
      } else if (tags.amenity === 'school') {
        category = 'education';
        type = 'school';
      } else if (tags.tourism) {
        category = 'attraction';
        type = tags.tourism;
      } else if (tags.leisure) {
        category = 'venue';
        type = tags.leisure;
      }
      
      locations.push({
        name,
        type,
        category,
        distance: Math.round(distance * 10) / 10, // Round to 1 decimal
        lat: elementLat,
        lon: elementLon,
      });
    }
    
    // Sort by distance and return top 10
    return locations
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10);
      
  } catch (error) {
    console.warn(`[send-earthquake-alert] ⚠️ Error finding nearby locations:`, error.message);
    return [];
  }
}

/**
 * Find nearby educational institutions
 */
async function findNearbyEducation(lat, lon, radiusKm = 50) {
  if (!lat || !lon) return [];
  
  try {
    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["amenity"~"^(university|college|school)$"](around:${radiusKm * 1000},${lat},${lon});
        way["amenity"~"^(university|college|school)$"](around:${radiusKm * 1000},${lat},${lon});
      );
      out center;
    `;
    
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'NoteworthyNews/1.0 (contact@noteworthynews.co)',
      },
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    const institutions = [];
    
    for (const element of data.elements || []) {
      const elementLat = element.lat || (element.center && element.center.lat);
      const elementLon = element.lon || (element.center && element.center.lon);
      
      if (!elementLat || !elementLon) continue;
      
      const distance = calculateDistance(lat, lon, elementLat, elementLon);
      const tags = element.tags || {};
      const name = tags.name || tags['name:en'] || 'Unknown';
      const type = tags.amenity || 'school';
      
      institutions.push({
        name,
        type,
        distance: Math.round(distance * 10) / 10,
        lat: elementLat,
        lon: elementLon,
      });
    }
    
    return institutions
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
      
  } catch (error) {
    console.warn(`[send-earthquake-alert] ⚠️ Error finding nearby education:`, error.message);
    return [];
  }
}

/**
 * Find nearby event venues and entertainment locations
 * These could potentially host events
 */
async function findNearbyVenues(lat, lon, radiusKm = 50) {
  if (!lat || !lon) return [];
  
  try {
    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["amenity"~"^(theatre|cinema|nightclub|bar|restaurant|community_centre)$"](around:${radiusKm * 1000},${lat},${lon});
        node["leisure"~"^(stadium|sports_centre|amusement_arcade)$"](around:${radiusKm * 1000},${lat},${lon});
        node["tourism"~"^(attraction|museum|theme_park|zoo)$"](around:${radiusKm * 1000},${lat},${lon});
        way["amenity"~"^(theatre|cinema|nightclub|bar|restaurant|community_centre)$"](around:${radiusKm * 1000},${lat},${lon});
        way["leisure"~"^(stadium|sports_centre|amusement_arcade)$"](around:${radiusKm * 1000},${lat},${lon});
      );
      out center;
    `;
    
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'NoteworthyNews/1.0 (contact@noteworthynews.co)',
      },
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    const venues = [];
    
    for (const element of data.elements || []) {
      const elementLat = element.lat || (element.center && element.center.lat);
      const elementLon = element.lon || (element.center && element.center.lon);
      
      if (!elementLat || !elementLon) continue;
      
      const distance = calculateDistance(lat, lon, elementLat, elementLon);
      const tags = element.tags || {};
      const name = tags.name || tags['name:en'] || 'Unknown';
      const type = tags.amenity || tags.leisure || tags.tourism || 'venue';
      
      venues.push({
        name,
        type,
        distance: Math.round(distance * 10) / 10,
        lat: elementLat,
        lon: elementLon,
      });
    }
    
    return venues
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 8);
      
  } catch (error) {
    console.warn(`[send-earthquake-alert] ⚠️ Error finding nearby venues:`, error.message);
    return [];
  }
}

/**
 * Download image for email attachment
 * Uses Netlify Blobs SDK directly to avoid propagation delays
 * Falls back to HTTP fetch if SDK fails
 */
async function downloadImageForEmail(imageUrl) {
  try {
    // Extract image key from URL
    // Format: https://noteworthynews.co/.netlify/functions/get-uploaded-image?key=earthquake-xxx-standard-timestamp.png
    let imageKey = null;
    try {
      const urlObj = new URL(imageUrl.startsWith('/') ? `https://noteworthynews.co${imageUrl}` : imageUrl);
      imageKey = urlObj.searchParams.get('key');
    } catch (urlError) {
      console.warn(`[send-earthquake-alert] ⚠️ Could not parse URL to extract key: ${urlError.message}`);
    }
    
    // Try SDK first (more reliable, no propagation delay)
    if (imageKey) {
      try {
        const { getStore } = require("@netlify/blobs");
        const siteID = process.env.NETLIFY_SITE_ID;
        const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN;
        
        if (siteID && token) {
          console.log(`[send-earthquake-alert] 📥 Attempting to fetch image via SDK: ${imageKey}`);
          
          const store = getStore({
            name: "post-media",
            siteID: siteID,
            token: token,
          });
          
          // Retry logic with exponential backoff (for propagation delays)
          let imageData = null;
          const maxRetries = 5;
          const retryDelays = [1000, 2000, 3000, 5000, 8000]; // 1s, 2s, 3s, 5s, 8s
          
          for (let retry = 0; retry < maxRetries; retry++) {
            try {
              imageData = await store.get(imageKey, { type: "arrayBuffer" });
              
              if (imageData && imageData.byteLength > 0) {
                // Verify it's a valid PNG
                const firstBytes = new Uint8Array(imageData.slice(0, 4));
                const isPNG = firstBytes[0] === 0x89 && firstBytes[1] === 0x50 && firstBytes[2] === 0x4E && firstBytes[3] === 0x47;
                
                if (isPNG) {
                  console.log(`[send-earthquake-alert] ✅ Image fetched via SDK (retry ${retry + 1}/${maxRetries}): ${Math.round(imageData.byteLength / 1024)}KB`);
                  const buffer = Buffer.from(imageData);
                  return {
                    buffer: buffer,
                    contentType: 'image/png'
                  };
                } else {
                  console.warn(`[send-earthquake-alert] ⚠️ SDK returned data but not valid PNG (retry ${retry + 1}/${maxRetries})`);
                }
              } else {
                console.warn(`[send-earthquake-alert] ⚠️ SDK returned empty data (retry ${retry + 1}/${maxRetries})`);
              }
            } catch (sdkError) {
              console.warn(`[send-earthquake-alert] ⚠️ SDK fetch failed (retry ${retry + 1}/${maxRetries}): ${sdkError.message}`);
            }
            
            // Wait before retry (except on last attempt)
            if (retry < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, retryDelays[retry]));
            }
          }
          
          console.warn(`[send-earthquake-alert] ⚠️ SDK fetch failed after ${maxRetries} retries, falling back to HTTP`);
        } else {
          console.warn(`[send-earthquake-alert] ⚠️ Missing NETLIFY_SITE_ID or NETLIFY_BLOB_READ_WRITE_TOKEN, falling back to HTTP`);
        }
      } catch (sdkRequireError) {
        console.warn(`[send-earthquake-alert] ⚠️ Could not load @netlify/blobs SDK: ${sdkRequireError.message}, falling back to HTTP`);
      }
    }
    
    // Fallback to HTTP fetch (original method)
    // If it's a relative URL, make it absolute
    let fullUrl = imageUrl;
    if (imageUrl.startsWith('/')) {
      const baseUrl = process.env.URL || 'https://noteworthynews.co';
      fullUrl = `${baseUrl}${imageUrl}`;
    }
    
    console.log(`[send-earthquake-alert] 📥 Fetching image via HTTP: ${fullUrl}`);
    const response = await fetch(fullUrl);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`[send-earthquake-alert] ❌ Image download failed: ${response.status} ${response.statusText}`, errorText.substring(0, 200));
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type') || 'image/png';
    console.log(`[send-earthquake-alert] 📥 Image response: ${response.status}, Content-Type: ${contentType}`);
    
    // Check if response is JSON (from get-uploaded-image when Blobs API returns JSON)
    let arrayBuffer = await response.arrayBuffer();
    
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      console.error('[send-earthquake-alert] ❌ Image arrayBuffer is empty!');
      return null;
    }
    
    // Check if response is JSON (starts with '{')
    const firstBytes = new Uint8Array(arrayBuffer.slice(0, 10));
    const isJSON = contentType.includes('application/json') || firstBytes[0] === 0x7b; // '{' character
    
    if (isJSON) {
      console.log(`[send-earthquake-alert] 📥 Response is JSON, attempting to extract redirect URL`);
      try {
        const text = new TextDecoder().decode(arrayBuffer);
        const jsonData = JSON.parse(text);
        
        if (jsonData.url) {
          console.log(`[send-earthquake-alert] 📥 Following redirect URL from JSON: ${jsonData.url}`);
          // Fetch the actual image from the redirect URL
          const imageResponse = await fetch(jsonData.url);
          
          if (!imageResponse.ok) {
            console.error(`[send-earthquake-alert] ❌ Redirect URL fetch failed: ${imageResponse.status} ${imageResponse.statusText}`);
            throw new Error(`Failed to fetch image from redirect URL: ${imageResponse.status}`);
          }
          
          arrayBuffer = await imageResponse.arrayBuffer();
          if (!arrayBuffer || arrayBuffer.byteLength === 0) {
            console.error('[send-earthquake-alert] ❌ Redirect URL returned empty response!');
            return null;
          }
          
          // Verify it's actually an image (not more JSON)
          const imageFirstBytes = new Uint8Array(arrayBuffer.slice(0, 4));
          const isPNG = imageFirstBytes[0] === 0x89 && imageFirstBytes[1] === 0x50 && imageFirstBytes[2] === 0x4E && imageFirstBytes[3] === 0x47;
          const isJPEG = imageFirstBytes[0] === 0xFF && imageFirstBytes[1] === 0xD8;
          
          if (!isPNG && !isJPEG) {
            console.error(`[send-earthquake-alert] ❌ Redirect URL did not return valid image (magic bytes: ${Array.from(imageFirstBytes).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')})`);
            return null;
          }
          
          console.log(`[send-earthquake-alert] ✅ Successfully fetched image from redirect URL: ${Math.round(arrayBuffer.byteLength / 1024)}KB (${isPNG ? 'PNG' : 'JPEG'})`);
        } else {
          console.error(`[send-earthquake-alert] ❌ JSON response but no URL field:`, JSON.stringify(jsonData).substring(0, 200));
          return null;
        }
      } catch (jsonError) {
        console.error(`[send-earthquake-alert] ❌ Failed to parse JSON response:`, jsonError.message);
        return null;
      }
    }
    
    const buffer = Buffer.from(arrayBuffer);
    
    console.log(`[send-earthquake-alert] ✅ Image downloaded: ${Math.round(buffer.length / 1024)}KB, type: ${contentType}`);
    console.log(`[send-earthquake-alert] 📊 Buffer details: length=${buffer.length}, first 8 bytes:`, Array.from(buffer.slice(0, 8)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
    
    if (buffer.length === 0) {
      console.error('[send-earthquake-alert] ❌ Image buffer is empty after conversion!');
      return null;
    }
    
    // Validate it's actually a valid image by checking magic bytes
    const magicBytes = buffer.slice(0, 8);
    const isPNG = magicBytes[0] === 0x89 && magicBytes[1] === 0x50 && magicBytes[2] === 0x4E && magicBytes[3] === 0x47;
    const isJPEG = magicBytes[0] === 0xFF && magicBytes[1] === 0xD8;
    
    if (!isPNG && !isJPEG) {
      // Log warning but don't reject - might be valid but with different encoding
      // Some images might have different headers or be encoded differently
      console.warn('[send-earthquake-alert] ⚠️ Magic bytes don\'t match PNG/JPEG, but proceeding anyway');
      console.warn('[send-earthquake-alert] ⚠️ Magic bytes:', Array.from(magicBytes).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
      console.warn('[send-earthquake-alert] ⚠️ Will attempt to attach anyway - email service may handle it');
    } else {
      console.log(`[send-earthquake-alert] ✅ Image format validated: ${isPNG ? 'PNG' : 'JPEG'}`);
    }
    
    // Always return the buffer - let the email service handle validation
    // Even if magic bytes don't match, the image might still be valid
    return {
      buffer: buffer,
      contentType: contentType,
    };
  } catch (error) {
    console.error('[send-earthquake-alert] ❌ Error downloading image:', error.message, error.stack);
    return null;
  }
}

/**
 * Main handler
 */
exports.handler = async (event, context) => {
  // CRITICAL: Log function invocation immediately
  console.log('[send-earthquake-alert] 🚀 FUNCTION INVOKED', {
    httpMethod: event.httpMethod,
    hasBody: !!event.body,
    bodyLength: event.body?.length || 0,
    timestamp: new Date().toISOString()
  });
  
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
  
  // Handle OPTIONS
  if (event.httpMethod === "OPTIONS") {
    console.log('[send-earthquake-alert] ⚙️ OPTIONS request - returning 204');
    return { statusCode: 204, headers, body: "" };
  }
  
  if (event.httpMethod !== "POST") {
    console.error('[send-earthquake-alert] ❌ Invalid method:', event.httpMethod);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }
  
  try {
    // Get notification emails from AI_NOTIFICATION_EMAILS (same as other functions)
    let notificationEmails = [];
    if (process.env.AI_NOTIFICATION_EMAILS) {
      try {
        // Try parsing as JSON array first
        notificationEmails = JSON.parse(process.env.AI_NOTIFICATION_EMAILS);
        if (!Array.isArray(notificationEmails)) {
          throw new Error('Not an array');
        }
      } catch {
        // If not JSON, treat as comma-separated string
        notificationEmails = process.env.AI_NOTIFICATION_EMAILS.split(',').map(e => e.trim()).filter(e => e);
      }
    }
    
    // Fallback to ALERT_TO_EMAIL if AI_NOTIFICATION_EMAILS not set (for backwards compatibility)
    if (notificationEmails.length === 0 && process.env.ALERT_TO_EMAIL) {
      notificationEmails = [process.env.ALERT_TO_EMAIL];
    }
    
    // Filter out test emails
    notificationEmails = notificationEmails.filter(email => 
      email.toLowerCase() !== 'mr.pangolinman@example.com' && 
      email.toLowerCase() !== 'pangolinman@example.com'
    );
    
    if (notificationEmails.length === 0) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "AI_NOTIFICATION_EMAILS or ALERT_TO_EMAIL not configured",
        }),
      };
    }
    
    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "RESEND_API_KEY not configured",
        }),
      };
    }
    
    const body = JSON.parse(event.body || "{}");
    const { earthquake, imageUrl } = body;
    
    console.log('[send-earthquake-alert] 📧 Function called', {
      hasEarthquake: !!earthquake,
      hasImageUrl: !!imageUrl,
      imageUrl: imageUrl?.substring(0, 100),
      imageUrlLength: imageUrl?.length || 0,
      imageUrlIsEmpty: !imageUrl || imageUrl.trim() === '',
      eventId: earthquake?.event_id,
      magnitude: earthquake?.magnitude,
      location_display: earthquake?.location_display,
      hasLat: !!earthquake?.lat,
      hasLon: !!earthquake?.lon,
      hasDepth: !!earthquake?.depth,
      hasAssets: !!earthquake?.assets,
      assetKeys: earthquake?.assets ? Object.keys(earthquake.assets) : [],
      fullImageUrl: imageUrl // Log full URL for debugging
    });
    
    // CRITICAL: Log if imageUrl is missing or invalid
    if (!imageUrl || imageUrl.trim() === '') {
      console.error('[send-earthquake-alert] ❌ CRITICAL: imageUrl is missing or empty!', {
        imageUrl,
        imageUrlType: typeof imageUrl,
        bodyKeys: Object.keys(body),
        hasImageUrlInBody: 'imageUrl' in body
      });
    }
    
    if (!earthquake || !earthquake.magnitude || !earthquake.location_display) {
      console.error('[send-earthquake-alert] ❌ Missing required earthquake data', {
        hasEarthquake: !!earthquake,
        hasMagnitude: !!earthquake?.magnitude,
        hasLocation: !!earthquake?.location_display
      });
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Missing required earthquake data",
        }),
      };
    }
    
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    // Format time
    const eventTime = formatTime(earthquake.time_ms || earthquake.time);
    
    // Build subject (works for all magnitudes)
    const magnitude = parseFloat(earthquake.magnitude?.toFixed(1) || '0.0');
    const magnitudeFormatted = magnitude.toFixed(1);
    const severity = magnitude >= 7.0 ? "Major" : magnitude >= 6.0 ? "Strong" : magnitude >= 5.0 ? "Moderate" : magnitude >= 4.0 ? "Light" : "Minor";
    const severityColor = magnitude >= 7.0 ? "#d32f2f" : magnitude >= 6.0 ? "#f57c00" : magnitude >= 5.0 ? "#fbc02d" : magnitude >= 4.0 ? "#388e3c" : "#1976d2";
    const severityBg = magnitude >= 7.0 ? "#ffebee" : magnitude >= 6.0 ? "#fff3e0" : magnitude >= 5.0 ? "#fffde7" : magnitude >= 4.0 ? "#e8f5e9" : "#e3f2fd";
    const locationDisplay = earthquake.location_display || 'Unknown Location';
    const subject = `🚨 BREAKING: ${severity} Earthquake (M${magnitudeFormatted}) Near ${locationDisplay}`;
    
    // Build message (common-person wording, no jargon)
    const message = `BREAKING: A magnitude ${magnitudeFormatted} earthquake was detected by the U.S. Geological Survey near ${locationDisplay} at ${eventTime}.\n\nSee attached image for detailed visualization.`;
    
    // Format coordinates if available
    const coordinates = earthquake.lon && earthquake.lat 
      ? `${Math.abs(earthquake.lat).toFixed(4)}°${earthquake.lat >= 0 ? 'N' : 'S'}, ${Math.abs(earthquake.lon).toFixed(4)}°${earthquake.lon >= 0 ? 'E' : 'W'}`
      : null;
    
    // Format depth if available
    const depth = earthquake.depth ? `${earthquake.depth.toFixed(1)} km` : null;
    const depthValue = earthquake.depth || null;
    
    // Fetch location details and generate map
    let locationDetails = null;
    let mapImageUrl = null;
    let nearbyLocations = [];
    let nearbyEducation = [];
    let nearbyVenues = [];
    
    if (earthquake.lat && earthquake.lon) {
      try {
        console.log('[send-earthquake-alert] 📍 Fetching location details...');
        locationDetails = await fetchLocationDetails(earthquake.lat, earthquake.lon);
        mapImageUrl = generateMapImageUrl(earthquake.lat, earthquake.lon, 10, 600, 400);
        console.log('[send-earthquake-alert] ✅ Location details fetched', {
          hasDetails: !!locationDetails,
          hasMap: !!mapImageUrl,
          country: locationDetails?.country,
          state: locationDetails?.state,
        });
        
        // Fetch nearby important locations in parallel
        console.log('[send-earthquake-alert] 🔍 Finding nearby locations...');
        const [locations, education, venues] = await Promise.allSettled([
          findNearbyLocations(earthquake.lat, earthquake.lon, 50),
          findNearbyEducation(earthquake.lat, earthquake.lon, 50),
          findNearbyVenues(earthquake.lat, earthquake.lon, 50),
        ]);
        
        nearbyLocations = locations.status === 'fulfilled' ? locations.value : [];
        nearbyEducation = education.status === 'fulfilled' ? education.value : [];
        nearbyVenues = venues.status === 'fulfilled' ? venues.value : [];
        
        console.log('[send-earthquake-alert] ✅ Nearby locations found', {
          locations: nearbyLocations.length,
          education: nearbyEducation.length,
          venues: nearbyVenues.length,
        });
      } catch (error) {
        console.warn('[send-earthquake-alert] ⚠️ Failed to fetch location details:', error.message);
        // Continue without location details - map will still be generated
        mapImageUrl = generateMapImageUrl(earthquake.lat, earthquake.lon, 10, 600, 400);
      }
    }
    
    // CONTENT REDUCER: Extract only the essential facts for email (3-5 max)
    // All other data (assessments, nearby locations, etc.) goes to the website
    const keyFacts = [];
    
    // Always include magnitude
    keyFacts.push({ label: 'Magnitude', value: `${magnitudeFormatted}` });
    
    // Include depth if available
    if (depthValue) {
      keyFacts.push({ label: 'Depth', value: depth });
    }
    
    // Include region/state if available (prefer state over full location)
    const region = locationDetails?.state || locationDetails?.county || locationDetails?.country || null;
    if (region) {
      keyFacts.push({ label: 'Region', value: region });
    }
    
    // Include coordinates if available (optional, only if we have space)
    // Format: 40.5388°N, 120.6800°W
    if (coordinates && keyFacts.length < 4) {
      keyFacts.push({ label: 'Coordinates', value: coordinates });
    }
    
    // Always include source
    keyFacts.push({ label: 'Source', value: 'USGS' });
    
    // Cap at 5 facts max
    const finalFacts = keyFacts.slice(0, 5);
    
    // Generate short summary (1-2 sentences max) - Newsroom tone, calm and authoritative
    let summary = '';
    if (magnitude >= 7.0) {
      summary = `A magnitude ${magnitudeFormatted} earthquake was recorded ${region ? `near ${region}` : 'in the region'} by the U.S. Geological Survey. Monitoring for updates.`;
    } else if (magnitude >= 5.0) {
      summary = `A magnitude ${magnitudeFormatted} earthquake was recorded ${region ? `near ${region}` : 'in the region'} by the U.S. Geological Survey.`;
    } else {
      summary = `A preliminary magnitude ${magnitudeFormatted} earthquake was recorded ${region ? `near ${region}` : 'in the region'} by the U.S. Geological Survey.`;
    }
    
    // Determine alert type for header pill
    const alertType = magnitude >= 7.0 ? 'BREAKING' : magnitude >= 5.0 ? 'ALERT' : 'WATCH';
    
    // Alert type theming system
    const alertTheme = {
      'EARTHQUAKE': {
        accentColor: '#2563EB', // Blue
        pillBorder: '#2563EB',
        pillText: '#2563EB',
        categoryLabel: 'Seismic Alert'
      },
      'VOLCANO': {
        accentColor: '#F97316', // Orange
        pillBorder: '#F97316',
        pillText: '#F97316',
        categoryLabel: 'Volcano Alert'
      },
      'WATCH': {
        accentColor: '#6B7280', // Neutral gray
        pillBorder: '#6B7280',
        pillText: '#6B7280',
        categoryLabel: 'Seismic Alert'
      },
      'WARNING': {
        accentColor: '#DC2626', // Red
        pillBorder: '#DC2626',
        pillText: '#DC2626',
        categoryLabel: 'Seismic Alert'
      },
      'BREAKING': {
        accentColor: '#DC2626', // Red
        pillBorder: '#DC2626',
        pillText: '#DC2626',
        categoryLabel: 'Seismic Alert'
      },
      'ALERT': {
        accentColor: '#2563EB', // Blue
        pillBorder: '#2563EB',
        pillText: '#2563EB',
        categoryLabel: 'Seismic Alert'
      }
    };
    
    // Get theme for current alert type (default to EARTHQUAKE)
    const theme = alertTheme[alertType] || alertTheme['EARTHQUAKE'];
    
    // Validate and ensure all template variables are defined
    const safeMagnitudeFormatted = magnitudeFormatted || 'N/A';
    const safeSeverity = severity || 'Unknown';
    const safeLocationDisplay = earthquake.location_display || 'Unknown Location';
    const safeLocationEnglishName = earthquake.location_english_name || earthquake.assets?.location_english_name || null;
    const safeCoordinates = coordinates || null;
    const safeDepth = depth || null;
    
    // Log content reducer output
    console.log('[send-earthquake-alert] 📝 Content reducer output:', {
      keyFactsCount: finalFacts.length,
      facts: finalFacts.map(f => `${f.label}: ${f.value}`),
      summaryLength: summary.length,
      alertType
    });
    
    // Build email content (same for all recipients)
    const baseEmailContent = {
      from: process.env.RESEND_FROM_EMAIL || 'Noteworthy News <richard@noteworthynews.co>',
      subject: subject,
      text: message,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Earthquake Alert</title>
  <style>
    @media only screen and (max-width: 480px) {
      .facts-table td {
        display: block !important;
        width: 100% !important;
        padding: 8px 0 !important;
        text-align: left !important;
      }
      .facts-table td[style*="text-align: right"] {
        text-align: right !important;
      }
      .button-table {
        width: 100% !important;
      }
      .button-table td {
        display: block !important;
        width: 100% !important;
      }
      .button-table a {
        display: block !important;
        width: 100% !important;
        text-align: center !important;
        box-sizing: border-box !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F3F6FB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #F3F6FB; padding: 20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border: 1px solid #E6EAF2; border-radius: 16px; overflow: hidden;">
          
          <!-- 4px Accent Bar (Top of Card) -->
          <tr>
            <td style="height: 4px; background-color: ${theme.accentColor}; padding: 0; line-height: 0; font-size: 0;">
              &nbsp;
            </td>
          </tr>
          
          <!-- Header Bar -->
          <tr>
            <td style="padding: 24px 24px 12px 24px; border-bottom: 1px solid #E6EAF2;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="vertical-align: middle;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 12px;">
                          <img src="https://noteworthynews.co/IMG_5992.PNG" alt="Noteworthy News" width="28" height="28" style="display: block; width: 28px; height: 28px;" />
                        </td>
                        <td style="vertical-align: middle;">
                          <div style="font-size: 20px; font-weight: 700; color: #111827; line-height: 1.2;">Noteworthy News</div>
                          <div style="font-size: 11px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">${theme.categoryLabel}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; border: 1px solid ${theme.pillBorder}; color: ${theme.pillText}; background-color: transparent; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px;">
                      ${alertType}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 0; background-color: #ffffff;">
              
              <!-- Headline Block -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="padding: 28px 24px 20px 24px;">
                    <h1 style="margin: 0 0 6px 0; font-size: 28px; font-weight: 800; color: #111827; line-height: 1.2; letter-spacing: -0.02em;">
                      M${safeMagnitudeFormatted} Earthquake
                    </h1>
                    <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 500; color: #374151; line-height: 1.4;">
                      Near ${region || safeLocationDisplay}
                      ${safeLocationEnglishName && safeLocationEnglishName !== safeLocationDisplay ? `
                        <span style="font-size: 14px; color: #6B7280; font-weight: 400;"> (${safeLocationEnglishName})</span>
                      ` : ''}
                    </p>
                    <p style="margin: 0 0 12px 0; font-size: 13px; color: #6B7280; line-height: 1.5;">
                      ${eventTime}
                    </p>
                    ${safeSeverity !== 'Unknown' && safeSeverity !== 'Minor' ? `
                    <span style="display: inline-block; background-color: #F3F4F6; color: #6B7280; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;">
                      ${safeSeverity}
                    </span>
                    ` : ''}
                  </td>
                </tr>
              </table>
              
              <!-- Key Facts (3-5 max) - Premium Fintech-style Table -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="padding: 0 24px 24px 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="facts-table" style="border-collapse: collapse;">
                      ${finalFacts.map((fact, index) => `
                      <tr>
                        <td class="facts-table" style="padding: ${index === 0 ? '0' : '14px'} 0 ${index === finalFacts.length - 1 ? '0' : '14px'} 0; border-bottom: ${index === finalFacts.length - 1 ? 'none' : '1px solid #EEF2F7'};">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td class="facts-table" style="width: auto; padding-right: 16px; vertical-align: top;">
                                <span style="font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">
                                  ${fact.label}
                                </span>
                              </td>
                              <td class="facts-table" style="vertical-align: top; text-align: right;">
                                <span style="font-size: 15px; font-weight: 600; color: #111827;">
                                  ${fact.value}
                                </span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      `).join('')}
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Short Summary (1-2 sentences) - Newsroom Tone -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="padding: 0 24px 28px 24px;">
                    <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #374151;">
                      ${summary}
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Divider before CTA -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="padding: 0 24px 24px 24px;">
                    <div style="height: 1px; background-color: #E6EAF2;"></div>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Section (Primary Action) -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="padding: 0 24px 32px 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="button-table">
                      <tr>
                        <td align="center" style="padding: 0;">
                          <!-- Primary Button: Open on Noteworthy News -->
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto; width: 100%; max-width: 300px;">
                            <tr>
                              <td align="center" style="background-color: #2563EB; border-radius: 8px;">
                                <a href="https://noteworthynews.co/article.html?id=${encodeURIComponent(`post-usgs-${earthquake.event_id || earthquake.canonical_id?.split(':')[1] || 'unknown'}`)}" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; line-height: 1.5;">
                                  Open on Noteworthy News
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding-top: 12px;">
                          <p style="margin: 0; font-size: 12px; color: #6B7280; line-height: 1.5;">
                            Interactive 3D visualization • Advanced AI assessments • Animations
                          </p>
                        </td>
                      </tr>
                      ${earthquake.usgs_event_url ? `
                      <tr>
                        <td align="center" style="padding-top: 16px;">
                          <a href="${earthquake.usgs_event_url}" style="font-size: 14px; color: #2563EB; text-decoration: underline; font-weight: 500;">
                            View on USGS
                          </a>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 32px 24px; border-top: 1px solid #E6EAF2; background-color: #F9FAFB;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding: 0;">
                    <p style="margin: 0 0 10px 0; font-size: 12px; color: #6B7280; line-height: 1.6;">
                      You're receiving this because you subscribed to Noteworthy News alerts.
                    </p>
                    <p style="margin: 0 0 10px 0; font-size: 12px; color: #6B7280; line-height: 1.6;">
                      <a href="{{{UNSUBSCRIBE_URL}}}" style="color: #2563EB; text-decoration: none; font-weight: 500;">Manage preferences</a> · <a href="{{{UNSUBSCRIBE_URL}}}" style="color: #2563EB; text-decoration: none; font-weight: 500;">Unsubscribe</a>
                    </p>
                    <p style="margin: 0 0 8px 0; font-size: 11px; color: #9CA3AF; line-height: 1.5;">
                      Data source: USGS
                    </p>
                    <p style="margin: 0; font-size: 11px; color: #9CA3AF; line-height: 1.5;">
                      Tip: Add us to your contacts to ensure delivery.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    };
    
    // Log HTML length to verify template was generated
    console.log(`[send-earthquake-alert] 📝 Generated HTML template: ${baseEmailContent.html.length} characters`);
    console.log(`[send-earthquake-alert] 📝 HTML contains magnitude: ${baseEmailContent.html.includes(safeMagnitudeFormatted)}`);
    console.log(`[send-earthquake-alert] 📝 HTML contains location: ${baseEmailContent.html.includes(safeLocationDisplay)}`);
    
    // Download and attach image if available (as inline CID attachment)
    let imageAttachment = null;
    let htmlWithImage = baseEmailContent.html;
    
    if (imageUrl) {
      console.log(`[send-earthquake-alert] 📸 Starting image download from: ${imageUrl}`);
      try {
      const imageData = await downloadImageForEmail(imageUrl);
        console.log(`[send-earthquake-alert] 📸 Image download completed:`, {
          hasImageData: !!imageData,
          hasBuffer: !!(imageData && imageData.buffer),
          bufferLength: imageData?.buffer?.length || 0,
          contentType: imageData?.contentType
        });
        
        if (imageData && imageData.buffer) {
          // Validate buffer
          if (!Buffer.isBuffer(imageData.buffer)) {
            console.error('[send-earthquake-alert] ❌ Image buffer is not a Buffer object!', typeof imageData.buffer);
            imageData.buffer = Buffer.from(imageData.buffer);
          }
          
          if (imageData.buffer.length === 0) {
            console.error('[send-earthquake-alert] ❌ Image buffer is empty!');
          } else {
            console.log(`[send-earthquake-alert] ✅ Image downloaded successfully (${Math.round(imageData.buffer.length / 1024)}KB, ${imageData.contentType})`);
            
            // Validate it's actually a valid image by checking magic bytes
            const magicBytes = imageData.buffer.slice(0, 4);
            const isPNG = magicBytes[0] === 0x89 && magicBytes[1] === 0x50 && magicBytes[2] === 0x4E && magicBytes[3] === 0x47;
            const isJPEG = magicBytes[0] === 0xFF && magicBytes[1] === 0xD8;
            
            if (!isPNG && !isJPEG) {
              console.warn('[send-earthquake-alert] ⚠️ Image magic bytes don\'t match PNG or JPEG - may be corrupted, but will try anyway');
              console.warn('[send-earthquake-alert] ⚠️ Magic bytes:', Array.from(magicBytes).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
            } else {
              console.log(`[send-earthquake-alert] ✅ Image format validated: ${isPNG ? 'PNG' : 'JPEG'}`);
            }
          }
          
          // Convert buffer to base64 - ensure it's a proper Buffer first
          let base64Content;
          try {
            // imageData.buffer should already be a Buffer from downloadImageForEmail
            if (Buffer.isBuffer(imageData.buffer)) {
              base64Content = imageData.buffer.toString('base64');
              console.log(`[send-earthquake-alert] ✅ Converted Buffer to base64: ${Math.round(base64Content.length / 1024)}KB`);
            } else if (imageData.buffer instanceof ArrayBuffer) {
              const tempBuffer = Buffer.from(imageData.buffer);
              base64Content = tempBuffer.toString('base64');
              console.log(`[send-earthquake-alert] ✅ Converted ArrayBuffer to base64: ${Math.round(base64Content.length / 1024)}KB`);
            } else {
              // Try to convert whatever it is to a Buffer
              const tempBuffer = Buffer.from(imageData.buffer);
              base64Content = tempBuffer.toString('base64');
              console.log(`[send-earthquake-alert] ⚠️ Converted unknown type to base64: ${Math.round(base64Content.length / 1024)}KB`);
            }
            
            // Validate base64 encoding - try to decode it back to verify it's valid
            try {
              const testDecode = Buffer.from(base64Content, 'base64');
              if (testDecode.length !== imageData.buffer.length) {
                console.warn(`[send-earthquake-alert] ⚠️ Base64 validation warning: decoded length (${testDecode.length}) doesn't match original (${imageData.buffer.length}), but will proceed`);
              } else {
                console.log(`[send-earthquake-alert] ✅ Base64 validated: ${Math.round(base64Content.length / 1024)}KB, decodes to ${Math.round(testDecode.length / 1024)}KB`);
              }
            } catch (base64Error) {
              console.warn('[send-earthquake-alert] ⚠️ Base64 validation error, but will proceed:', base64Error.message);
            }
          } catch (encodeError) {
            console.error('[send-earthquake-alert] ❌ Failed to encode image to base64:', encodeError.message);
            imageAttachment = null;
          }
          
          // Create attachment if we have valid base64 content
          if (base64Content && base64Content.length > 0) {
            // Create CID (Content-ID) for inline image embedding
            // IMPORTANT: CID in content_id must match what's used in HTML cid: reference
            // Use a simpler, more reliable CID format
            const cidIdentifier = `earthquake-${earthquake.event_id || Date.now()}`;
            
            console.log(`[send-earthquake-alert] 📎 Creating attachment with CID: ${cidIdentifier}`);
            console.log(`[send-earthquake-alert] 📎 Base64 length: ${base64Content.length}, Buffer length: ${imageData.buffer.length}`);
            
        imageAttachment = {
              filename: `earthquake-m${earthquake.magnitude.toFixed(1)}-${earthquake.event_id || 'unknown'}.png`,
              content: base64Content, // Already base64 string
              content_type: imageData.contentType || 'image/png',
              // Resend expects content_id without cid: prefix - just the identifier
              content_id: cidIdentifier,
              // Explicitly set as inline attachment for email embedding
              content_disposition: 'inline',
            };
            
            console.log(`[send-earthquake-alert] ✅ Attachment created:`, {
              filename: imageAttachment.filename,
              content_id: imageAttachment.content_id,
              content_type: imageAttachment.content_type,
              content_size: Math.round(imageAttachment.content.length / 1024) + 'KB'
            });
            
            // Add <img> tag in HTML that references the CID
            // Insert between summary and CTA section (optional image, clean styling)
            // Include "Shareable graphic" label above image
            const imageHtml = `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="padding: 0 24px 20px 24px;">
                    <p style="margin: 0 0 12px 0; font-size: 11px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500;">
                      Shareable graphic
                    </p>
                    <img src="cid:${cidIdentifier}" alt="Earthquake Visualization - Magnitude ${safeMagnitudeFormatted} near ${safeLocationDisplay}" style="display: block; width: 100%; max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #E6EAF2;" />
                  </td>
                </tr>
              </table>
            `;
            
            console.log(`[send-earthquake-alert] 🔗 CID reference: cid:${cidIdentifier}`);
            console.log(`[send-earthquake-alert] 🔗 Image HTML: ${imageHtml.substring(0, 100)}...`);
            
            // Insert image between summary and CTA section
            htmlWithImage = baseEmailContent.html.replace(
              /(<!-- CTA Section \(Primary Action\) -->)/,
              `${imageHtml.trim()}$1`
            );
            
            console.log(`[send-earthquake-alert] ✅ Image HTML inserted into email`);
            console.log(`[send-earthquake-alert] 📝 HTML contains CID reference: ${htmlWithImage.includes(`cid:${cidIdentifier}`)}`);
            
            console.log(`[send-earthquake-alert] ✅ Image prepared for inline email embedding`);
            console.log(`[send-earthquake-alert] 📎 CID: content_id="${cidIdentifier}", HTML uses "cid:${cidIdentifier}"`);
            console.log(`[send-earthquake-alert] 📎 Attachment: filename="${imageAttachment.filename}", size=${Math.round(imageData.buffer.length / 1024)}KB, type=${imageAttachment.content_type}, base64_length=${imageAttachment.content.length}`);
          } else {
            console.warn('[send-earthquake-alert] ⚠️ Image data is invalid, email will be sent without image');
            if (imageData === null) {
              console.warn('[send-earthquake-alert] ⚠️ downloadImageForEmail returned null');
            } else if (!imageData.buffer) {
              console.warn('[send-earthquake-alert] ⚠️ Image data missing buffer property');
            }
          }
        } else {
          console.warn('[send-earthquake-alert] ⚠️ No image data or buffer available');
        }
      } catch (imageError) {
        console.error('[send-earthquake-alert] ❌ Error processing image:', imageError.message, imageError.stack);
        // Continue without image
      }
    } else {
      console.log('[send-earthquake-alert] ℹ️ No imageUrl provided, email will be sent without image');
    }
    
    // Final safety check: if we have an attachment but no CID in HTML, add it
    if (imageAttachment && !htmlWithImage.includes(`cid:${imageAttachment.content_id}`)) {
      console.warn(`[send-earthquake-alert] ⚠️ CID not found in HTML, forcing insertion`);
      const imageHtml = `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="padding: 0 24px 20px 24px;">
                    <p style="margin: 0 0 12px 0; font-size: 11px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500;">
                      Shareable graphic
                    </p>
                    <img src="cid:${imageAttachment.content_id}" alt="Earthquake Visualization - Magnitude ${safeMagnitudeFormatted} near ${safeLocationDisplay}" style="display: block; width: 100%; max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #E6EAF2;" />
                  </td>
                </tr>
              </table>
            `;
      // Insert between summary and CTA section
      htmlWithImage = htmlWithImage.replace(
        /(<!-- CTA Section \(Primary Action\) -->)/,
        `${imageHtml.trim()}$1`
      );
      console.log(`[send-earthquake-alert] ✅ Image HTML force-inserted`);
    } else if (!imageAttachment) {
      // Remove CID references from HTML if we don't have an attachment
      // This prevents broken image icons
      htmlWithImage = htmlWithImage.replace(/<img[^>]+src=["']cid:[^"']+["'][^>]*>/gi, '');
      console.log(`[send-earthquake-alert] ⚠️ Removed image tag from HTML - no attachment available`);
    }
    
    // Send email to all notification emails
    const emailResults = await Promise.allSettled(
      notificationEmails.map(async (email) => {
        const emailContent = {
          ...baseEmailContent,
          html: htmlWithImage, // Use HTML with embedded image
          to: email,
        };
        
        if (imageAttachment) {
          // Validate attachment before adding
          if (!imageAttachment.content || imageAttachment.content.length === 0) {
            console.error(`[send-earthquake-alert] ❌ Attachment has no content! Skipping attachment for ${email}`);
            imageAttachment = null;
          } else if (!imageAttachment.content_id) {
            console.error(`[send-earthquake-alert] ❌ Attachment has no content_id! Skipping attachment for ${email}`);
            imageAttachment = null;
          } else {
            // Create BOTH inline and regular attachment
            // Inline: displays in email body via CID reference
            // Regular: available as downloadable attachment
            const inlineAttachment = {
              filename: imageAttachment.filename,
              content: imageAttachment.content, // base64 string
              content_type: imageAttachment.content_type,
              content_id: imageAttachment.content_id,
              content_disposition: 'inline', // Required for inline images
            };
            
            const regularAttachment = {
              filename: imageAttachment.filename,
              content: imageAttachment.content, // Same base64 string
              content_type: imageAttachment.content_type,
              // No content_id for regular attachment
              content_disposition: 'attachment', // Regular downloadable attachment
            };
            
            // Add both: inline first (for email body), then regular (for download)
            emailContent.attachments = [inlineAttachment, regularAttachment];
            console.log(`[send-earthquake-alert] 📎 Adding image as BOTH inline and regular attachment for ${email}`);
            console.log(`[send-earthquake-alert] 📎 Inline attachment (for email body):`, {
              filename: inlineAttachment.filename,
              content_id: inlineAttachment.content_id,
              content_type: inlineAttachment.content_type,
              content_disposition: inlineAttachment.content_disposition,
            });
            console.log(`[send-earthquake-alert] 📎 Regular attachment (for download):`, {
              filename: regularAttachment.filename,
              content_type: regularAttachment.content_type,
              content_disposition: regularAttachment.content_disposition,
              content_length: regularAttachment.content.length,
            });
            
            // Verify the CID format in HTML
            const cidPattern = new RegExp(`cid:${inlineAttachment.content_id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
            const cidMatches = htmlWithImage.match(cidPattern);
            if (!cidMatches || cidMatches.length === 0) {
              console.error(`[send-earthquake-alert] ❌ CRITICAL: CID "${inlineAttachment.content_id}" not found in HTML!`);
              console.error(`[send-earthquake-alert] ❌ HTML snippet around image:`, htmlWithImage.substring(htmlWithImage.indexOf('See attached'), htmlWithImage.indexOf('See attached') + 200));
            } else {
              console.log(`[send-earthquake-alert] ✅ CID verified in HTML (found ${cidMatches.length} time(s))`);
            }
          }
        }
        
        if (!imageAttachment) {
          console.log(`[send-earthquake-alert] ⚠️ No image attachment for ${email} - imageAttachment is null or invalid`);
          console.log(`[send-earthquake-alert] ⚠️ Email will be sent WITHOUT image attachment for ${email}`);
        } else {
          console.log(`[send-earthquake-alert] ✅ Email prepared WITH image attachment for ${email}:`, {
            attachmentCount: emailContent.attachments?.length || 0,
            hasInline: emailContent.attachments?.some(a => a.content_disposition === 'inline') || false,
            hasRegular: emailContent.attachments?.some(a => a.content_disposition === 'attachment') || false,
            contentId: imageAttachment.content_id
          });
        }
        
        // CRITICAL: Log email content before sending
        console.log(`[send-earthquake-alert] 📧 FINAL EMAIL CONTENT for ${email}:`, {
          hasAttachments: !!emailContent.attachments,
          attachmentCount: emailContent.attachments?.length || 0,
          attachments: emailContent.attachments?.map(a => ({
            filename: a.filename,
            content_id: a.content_id,
            content_disposition: a.content_disposition,
            content_type: a.content_type,
            content_length: a.content?.length || 0
          })) || [],
          htmlLength: emailContent.html?.length || 0,
          htmlContainsCid: emailContent.html?.includes('cid:') || false
        });
        
        const result = await resend.emails.send(emailContent);
        console.log(`[send-earthquake-alert] 📧 Email sent to ${email}:`, {
          emailId: result.data?.id || 'unknown',
          hasError: !!result.error,
          error: result.error || null,
          attachmentCount: emailContent.attachments?.length || 0
        });
        return result;
      })
    );
    
    // Check results
    const successful = emailResults.filter(r => r.status === 'fulfilled' && !r.value.error);
    const failed = emailResults.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error));
    
    if (failed.length > 0) {
      console.error('[send-earthquake-alert] Some emails failed:', failed);
    }
    
    if (successful.length === 0) {
      const error = failed[0]?.reason || failed[0]?.value?.error || 'All emails failed';
      throw new Error(`Failed to send emails: ${error.message || error}`);
    }
    
    const result = successful[0].value;
    
    const hasImage = imageAttachment !== null;
    console.log(`[send-earthquake-alert] ✅ Alert sent successfully for M${earthquake.magnitude} earthquake to ${successful.length} recipient(s)${hasImage ? ' with image' : ' (no image)'}`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Alert sent successfully to ${successful.length} recipient(s)`,
        emailId: result.data?.id,
        recipients: notificationEmails,
        successful: successful.length,
        failed: failed.length,
        hasImage: hasImage,
      }),
    };
    
  } catch (error) {
    console.error('[send-earthquake-alert] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error?.message || "Internal server error",
      }),
    };
  }
};

