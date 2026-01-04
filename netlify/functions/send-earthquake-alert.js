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
 * Handles both direct binary responses and JSON responses with redirect URLs (from get-uploaded-image)
 */
async function downloadImageForEmail(imageUrl) {
  try {
    // If it's a relative URL, make it absolute
    let fullUrl = imageUrl;
    if (imageUrl.startsWith('/')) {
      const baseUrl = process.env.URL || 'https://noteworthynews.co';
      fullUrl = `${baseUrl}${imageUrl}`;
    }
    
    console.log(`[send-earthquake-alert] 📥 Fetching image from: ${fullUrl}`);
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
      eventId: earthquake?.event_id,
      magnitude: earthquake?.magnitude,
      fullImageUrl: imageUrl // Log full URL for debugging
    });
    
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
    const magnitude = parseFloat(earthquake.magnitude.toFixed(1));
    const magnitudeFormatted = magnitude.toFixed(1);
    const severity = magnitude >= 7.0 ? "Major" : magnitude >= 6.0 ? "Strong" : magnitude >= 5.0 ? "Moderate" : magnitude >= 4.0 ? "Light" : "Minor";
    const severityColor = magnitude >= 7.0 ? "#d32f2f" : magnitude >= 6.0 ? "#f57c00" : magnitude >= 5.0 ? "#fbc02d" : magnitude >= 4.0 ? "#388e3c" : "#1976d2";
    const severityBg = magnitude >= 7.0 ? "#ffebee" : magnitude >= 6.0 ? "#fff3e0" : magnitude >= 5.0 ? "#fffde7" : magnitude >= 4.0 ? "#e8f5e9" : "#e3f2fd";
    const subject = `🚨 BREAKING: ${severity} Earthquake (M${magnitudeFormatted}) Near ${earthquake.location_display}`;
    
    // Build message (common-person wording, no jargon)
    const message = `BREAKING: A magnitude ${magnitudeFormatted} earthquake was detected by the U.S. Geological Survey near ${earthquake.location_display} at ${eventTime}.\n\nSee attached image for detailed visualization.`;
    
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
    
    // Extract assessment data from earthquake assets
    const impactAssessment = earthquake.assets?.impact_assessment || null;
    const tsunamiAssessment = earthquake.assets?.tsunami_assessment || null;
    const aftershockForecast = earthquake.assets?.aftershock_forecast || null;
    const anomalyDetection = earthquake.assets?.anomaly_detection || null;
    
    // Calculate impact information (fallback if no assessment)
    const impactDescription = impactAssessment?.severity 
      ? `${impactAssessment.severity} RISK - ${getImpactDescription(magnitude, depthValue)}`
      : getImpactDescription(magnitude, depthValue);
    const estimatedAffected = impactAssessment?.affectedPopulation 
      ? `${(impactAssessment.affectedPopulation / 1000).toFixed(1)}K people`
      : (depthValue ? estimateAffectedPopulation(magnitude, depthValue) : null);
    
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
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden;">
          
          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 40px; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                      NOTEWORTHY NEWS
                    </h1>
                    <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 12px; font-weight: 500; letter-spacing: 1px; text-transform: uppercase;">
                      Breaking Alert
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Breaking Badge -->
          <tr>
            <td style="padding: 20px 40px 0 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td>
                    <div style="display: inline-block; background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); color: #ffffff; padding: 8px 16px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; box-shadow: 0 2px 8px rgba(255,107,107,0.3);">
                      🚨 BREAKING NEWS
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 30px 40px;">
              
              <!-- Magnitude Card -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, ${severityBg} 0%, ${severityBg}dd 100%); border-left: 4px solid ${severityColor}; border-radius: 8px; margin-bottom: 25px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);">
                <tr>
                  <td style="padding: 25px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td width="60%" style="vertical-align: middle;">
                          <div style="font-size: 14px; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                            Magnitude
                          </div>
                          <div style="font-size: 48px; font-weight: 800; color: ${severityColor}; line-height: 1; margin-bottom: 4px;">
                            M${magnitudeFormatted}
                          </div>
                          <div style="font-size: 13px; font-weight: 600; color: ${severityColor}; text-transform: uppercase; letter-spacing: 0.5px;">
                            ${severity} Earthquake
                          </div>
                        </td>
                        <td width="40%" align="right" style="vertical-align: middle;">
                          <div style="display: inline-block; background: ${severityColor}; color: #ffffff; width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: 800; box-shadow: 0 4px 16px ${severityColor}40;">
                            ${magnitudeFormatted}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Location & Details -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 25px;">
                <tr>
                  <td>
                    <div style="font-size: 20px; font-weight: 700; color: #1a1a1a; margin-bottom: 15px; line-height: 1.3;">
                      📍 ${earthquake.location_display}
                    </div>
                    <div style="font-size: 15px; color: #666; line-height: 1.6; margin-bottom: 20px;">
                      A magnitude <strong style="color: ${severityColor};">${magnitudeFormatted}</strong> earthquake was detected by the <strong>U.S. Geological Survey</strong> near <strong>${earthquake.location_display}</strong>.
                    </div>
                    ${locationDetails ? `
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 15px; border-left: 3px solid ${severityColor};">
                      <div style="font-size: 12px; font-weight: 600; color: #868e96; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
                        📋 Location Details
                      </div>
                      <div style="font-size: 14px; color: #212529; line-height: 1.8;">
                        ${locationDetails.city ? `<strong>City:</strong> ${locationDetails.city}<br>` : ''}
                        ${locationDetails.county ? `<strong>County:</strong> ${locationDetails.county}<br>` : ''}
                        ${locationDetails.state ? `<strong>State/Region:</strong> ${locationDetails.state}<br>` : ''}
                        ${locationDetails.country ? `<strong>Country:</strong> ${locationDetails.country}<br>` : ''}
                        ${locationDetails.postcode ? `<strong>Postal Code:</strong> ${locationDetails.postcode}` : ''}
                      </div>
                    </div>
                    ` : ''}
                    ${impactDescription ? `
                    <div style="background: linear-gradient(135deg, ${severityBg} 0%, ${severityBg}dd 100%); border-radius: 8px; padding: 15px; margin-bottom: 15px; border-left: 3px solid ${severityColor};">
                      <div style="font-size: 12px; font-weight: 600; color: ${severityColor}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                        ⚠️ Impact Assessment
                      </div>
                      <div style="font-size: 14px; color: #212529; line-height: 1.6; font-weight: 500;">
                        ${impactDescription}
                      </div>
                      ${estimatedAffected ? `
                      <div style="font-size: 13px; color: #666; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.1);">
                        Estimated affected area: <strong>${estimatedAffected}</strong>
                      </div>
                      ` : ''}
                    </div>
                    ` : ''}
                    ${tsunamiAssessment && tsunamiAssessment.riskLevel !== 'LOW' ? `
                    <div style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); border-radius: 8px; padding: 15px; margin-bottom: 15px; border-left: 3px solid #f57c00;">
                      <div style="font-size: 12px; font-weight: 600; color: #e65100; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                        🌊 ${tsunamiAssessment.riskLevel === 'HIGH' ? '⚠️ HIGH' : 'MEDIUM'} TSUNAMI RISK
                      </div>
                      <div style="font-size: 14px; color: #212529; line-height: 1.6; font-weight: 500;">
                        ${tsunamiAssessment.assessment || 'Tsunami risk detected. Monitor official tsunami warnings.'}
                      </div>
                      ${tsunamiAssessment.travelTime ? `
                      <div style="font-size: 13px; color: #666; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.1);">
                        Estimated travel time to coast: <strong>${tsunamiAssessment.travelTime.hours}h ${tsunamiAssessment.travelTime.minutes}m</strong>
                      </div>
                      ` : ''}
                    </div>
                    ` : ''}
                    ${aftershockForecast && aftershockForecast.probability24h >= 50 ? `
                    <div style="background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%); border-radius: 8px; padding: 15px; margin-bottom: 15px; border-left: 3px solid #9c27b0;">
                      <div style="font-size: 12px; font-weight: 600; color: #7b1fa2; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                        📊 Aftershock Forecast
                      </div>
                      <div style="font-size: 14px; color: #212529; line-height: 1.6; font-weight: 500;">
                        ${aftershockForecast.probability24h}% chance of significant aftershocks (M≥${aftershockForecast.expectedLargestAftershock.toFixed(1)}) within 24 hours.
                      </div>
                      <div style="font-size: 13px; color: #666; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.1);">
                        Expected largest aftershock: <strong>M${aftershockForecast.expectedLargestAftershock.toFixed(1)}</strong><br>
                        ${aftershockForecast.recommendation || ''}
                      </div>
                    </div>
                    ` : ''}
                    ${anomalyDetection && anomalyDetection.anomalyLevel !== 'NORMAL' ? `
                    <div style="background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%); border-radius: 8px; padding: 15px; margin-bottom: 15px; border-left: 3px solid #d32f2f;">
                      <div style="font-size: 12px; font-weight: 600; color: #c62828; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                        ⚠️ ${anomalyDetection.anomalyLevel} ANOMALY DETECTED
                      </div>
                      <div style="font-size: 14px; color: #212529; line-height: 1.6; font-weight: 500;">
                        ${anomalyDetection.summary}
                      </div>
                      ${anomalyDetection.anomalies && anomalyDetection.anomalies.length > 0 ? `
                      <div style="font-size: 13px; color: #666; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.1);">
                        ${anomalyDetection.anomalies.map(a => `• ${a.description}`).join('<br>')}
                      </div>
                      ` : ''}
                    </div>
                    ` : ''}
                    ${impactAssessment && impactAssessment.riskScore ? `
                    <div style="background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border-radius: 8px; padding: 15px; margin-bottom: 15px; border-left: 3px solid #388e3c;">
                      <div style="font-size: 12px; font-weight: 600; color: #2e7d32; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                        📊 Risk Assessment
                      </div>
                      <div style="font-size: 14px; color: #212529; line-height: 1.6;">
                        <strong>Risk Score:</strong> ${impactAssessment.riskScore}/100 (${impactAssessment.severity})<br>
                        ${impactAssessment.affectedPopulation ? `<strong>Affected Population:</strong> ${(impactAssessment.affectedPopulation / 1000).toFixed(1)}K people<br>` : ''}
                        ${impactAssessment.criticalInfrastructure ? `
                        <strong>Critical Infrastructure:</strong> ${impactAssessment.criticalInfrastructure.hospitals} hospitals, ${impactAssessment.criticalInfrastructure.airports} airports, ${impactAssessment.criticalInfrastructure.powerPlants} power plants
                        ` : ''}
                      </div>
                    </div>
                    ` : ''}
                  </td>
                </tr>
              </table>
              
              ${mapImageUrl ? `
              <!-- Static Map -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 25px;">
                <tr>
                  <td>
                    <div style="background: #ffffff; border-radius: 12px; padding: 0; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border: 1px solid #e9ecef;">
                      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 12px 20px;">
                        <div style="font-size: 13px; font-weight: 600; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">
                          🗺️ Location Map
                        </div>
                      </div>
                      <img src="${mapImageUrl}" alt="Map showing earthquake location at ${earthquake.location_display}" style="display: block; width: 100%; max-width: 100%; height: auto;" />
                      <div style="padding: 12px 20px; background: #f8f9fa; border-top: 1px solid #e9ecef;">
                        <div style="font-size: 11px; color: #868e96; text-align: center;">
                          Map data © <a href="https://www.openstreetmap.org/" style="color: #667eea; text-decoration: none;">OpenStreetMap</a> contributors
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
              ` : ''}
              
              ${locationDetails ? `
              <!-- Area Facts -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 25px;">
                <tr>
                  <td>
                    <div style="background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border-radius: 12px; padding: 20px; border: 1px solid #e9ecef; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                      <div style="font-size: 14px; font-weight: 700; color: #1a1a1a; margin-bottom: 15px; display: flex; align-items: center;">
                        <span style="font-size: 20px; margin-right: 8px;">📊</span>
                        Area Information
                      </div>
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                          ${locationDetails.country ? `
                          <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef;">
                            <div style="font-size: 12px; color: #868e96; margin-bottom: 4px;">Country</div>
                            <div style="font-size: 14px; font-weight: 600; color: #212529;">${locationDetails.country}</div>
                          </td>
                          ` : ''}
                          ${locationDetails.state ? `
                          <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef;">
                            <div style="font-size: 12px; color: #868e96; margin-bottom: 4px;">State/Region</div>
                            <div style="font-size: 14px; font-weight: 600; color: #212529;">${locationDetails.state}</div>
                          </td>
                          ` : ''}
                        </tr>
                        ${locationDetails.city || locationDetails.county ? `
                        <tr>
                          ${locationDetails.city ? `
                          <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef;">
                            <div style="font-size: 12px; color: #868e96; margin-bottom: 4px;">City/Town</div>
                            <div style="font-size: 14px; font-weight: 600; color: #212529;">${locationDetails.city}</div>
                          </td>
                          ` : ''}
                          ${locationDetails.county ? `
                          <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef;">
                            <div style="font-size: 12px; color: #868e96; margin-bottom: 4px;">County</div>
                            <div style="font-size: 14px; font-weight: 600; color: #212529;">${locationDetails.county}</div>
                          </td>
                          ` : ''}
                        </tr>
                        ` : ''}
                        ${earthquake.lat && earthquake.lon ? `
                        <tr>
                          <td colspan="2" style="padding: 8px 0;">
                            <div style="font-size: 12px; color: #868e96; margin-bottom: 4px;">Distance from Epicenter</div>
                            <div style="font-size: 14px; font-weight: 600; color: #212529;">
                              ${locationDetails.city ? `Nearest city: ${locationDetails.city}` : 'Rural/Remote area'}
                            </div>
                          </td>
                        </tr>
                        ` : ''}
                      </table>
                    </div>
                  </td>
                </tr>
              </table>
              ` : ''}
              
              ${nearbyLocations.length > 0 ? `
              <!-- Nearby Important Locations -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 25px;">
                <tr>
                  <td>
                    <div style="background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%); border-radius: 12px; padding: 20px; border: 1px solid #e9ecef; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                      <div style="font-size: 14px; font-weight: 700; color: #1a1a1a; margin-bottom: 15px; display: flex; align-items: center;">
                        <span style="font-size: 20px; margin-right: 8px;">🏙️</span>
                        Nearby Important Locations
                      </div>
                      <div style="font-size: 13px; color: #666; margin-bottom: 15px;">
                        Cities, towns, and landmarks within 50km of the epicenter:
                      </div>
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        ${nearbyLocations.slice(0, 6).map(loc => `
                        <tr>
                          <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                              <div>
                                <div style="font-size: 14px; font-weight: 600; color: #212529; margin-bottom: 4px;">
                                  ${loc.name}
                                </div>
                                <div style="font-size: 12px; color: #868e96; text-transform: capitalize;">
                                  ${loc.type}
                                </div>
                              </div>
                              <div style="font-size: 13px; font-weight: 600; color: ${severityColor};">
                                ${loc.distance} km
                              </div>
                            </div>
                          </td>
                        </tr>
                        `).join('')}
                      </table>
                    </div>
                  </td>
                </tr>
              </table>
              ` : ''}
              
              ${nearbyEducation.length > 0 ? `
              <!-- Nearby Educational Institutions -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 25px;">
                <tr>
                  <td>
                    <div style="background: linear-gradient(135deg, #e3f2fd 0%, #ffffff 100%); border-radius: 12px; padding: 20px; border: 1px solid #e9ecef; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                      <div style="font-size: 14px; font-weight: 700; color: #1a1a1a; margin-bottom: 15px; display: flex; align-items: center;">
                        <span style="font-size: 20px; margin-right: 8px;">🎓</span>
                        Nearby Educational Institutions
                      </div>
                      <div style="font-size: 13px; color: #666; margin-bottom: 15px;">
                        Colleges, universities, and schools in the area:
                      </div>
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        ${nearbyEducation.map(edu => `
                        <tr>
                          <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                              <div>
                                <div style="font-size: 14px; font-weight: 600; color: #212529; margin-bottom: 4px;">
                                  ${edu.name}
                                </div>
                                <div style="font-size: 12px; color: #868e96; text-transform: capitalize;">
                                  ${edu.type === 'university' ? 'University' : edu.type === 'college' ? 'College' : 'School'}
                                </div>
                              </div>
                              <div style="font-size: 13px; font-weight: 600; color: #1976d2;">
                                ${edu.distance} km
                              </div>
                            </div>
                          </td>
                        </tr>
                        `).join('')}
                      </table>
                    </div>
                  </td>
                </tr>
              </table>
              ` : ''}
              
              ${nearbyVenues.length > 0 ? `
              <!-- Nearby Event Venues -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 25px;">
                <tr>
                  <td>
                    <div style="background: linear-gradient(135deg, #fff3e0 0%, #ffffff 100%); border-radius: 12px; padding: 20px; border: 1px solid #e9ecef; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                      <div style="font-size: 14px; font-weight: 700; color: #1a1a1a; margin-bottom: 15px; display: flex; align-items: center;">
                        <span style="font-size: 20px; margin-right: 8px;">🎭</span>
                        Nearby Event Venues & Entertainment
                      </div>
                      <div style="font-size: 13px; color: #666; margin-bottom: 15px;">
                        Theaters, stadiums, and venues that may host events:
                      </div>
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        ${nearbyVenues.slice(0, 6).map(venue => `
                        <tr>
                          <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                              <div>
                                <div style="font-size: 14px; font-weight: 600; color: #212529; margin-bottom: 4px;">
                                  ${venue.name}
                                </div>
                                <div style="font-size: 12px; color: #868e96; text-transform: capitalize;">
                                  ${venue.type.replace(/_/g, ' ')}
                                </div>
                              </div>
                              <div style="font-size: 13px; font-weight: 600; color: #f57c00;">
                                ${venue.distance} km
                              </div>
                            </div>
                          </td>
                        </tr>
                        `).join('')}
                      </table>
                      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e9ecef;">
                        <div style="font-size: 12px; color: #868e96; font-style: italic;">
                          💡 Note: These venues may host concerts, festivals, sports events, or other gatherings. Check local event listings for scheduled activities.
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
              ` : ''}
              
              <!-- Details Grid -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 25px;">
                <tr>
                  <td width="50%" style="padding-right: 10px; vertical-align: top;">
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; border: 1px solid #e9ecef;">
                      <div style="font-size: 11px; font-weight: 600; color: #868e96; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                        ⏰ Event Time
                      </div>
                      <div style="font-size: 14px; font-weight: 600; color: #212529;">
                        ${eventTime}
                      </div>
                    </div>
                  </td>
                  ${coordinates ? `
                  <td width="50%" style="padding-left: 10px; vertical-align: top;">
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; border: 1px solid #e9ecef;">
                      <div style="font-size: 11px; font-weight: 600; color: #868e96; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                        📐 Coordinates
                      </div>
                      <div style="font-size: 14px; font-weight: 600; color: #212529; font-family: 'Courier New', monospace;">
                        ${coordinates}
                      </div>
                    </div>
                  </td>
                  ` : depth ? `
                  <td width="50%" style="padding-left: 10px; vertical-align: top;">
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; border: 1px solid #e9ecef;">
                      <div style="font-size: 11px; font-weight: 600; color: #868e96; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                        ⬇️ Depth
                      </div>
                      <div style="font-size: 14px; font-weight: 600; color: #212529;">
                        ${depth}
                      </div>
                    </div>
                  </td>
                  ` : '<td width="50%"></td>'}
                </tr>
                ${depth && coordinates ? `
                <tr>
                  <td colspan="2" style="padding-top: 10px;">
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; border: 1px solid #e9ecef;">
                      <div style="font-size: 11px; font-weight: 600; color: #868e96; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                        ⬇️ Depth
                      </div>
                      <div style="font-size: 14px; font-weight: 600; color: #212529;">
                        ${depth}
                      </div>
                    </div>
                  </td>
                </tr>
                ` : ''}
              </table>
              
              <!-- Image Placeholder (will be replaced with actual image) -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 25px;">
                <tr>
                  <td>
                    <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; padding: 20px; text-align: center; border: 2px dashed #dee2e6;">
                      <div style="font-size: 14px; color: #868e96; font-weight: 500;">
                        📸 Detailed visualization below
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
              
              <!-- USGS Link -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding: 20px 0; border-top: 1px solid #e9ecef;">
                    <a href="${earthquake.usgs_event_url || 'https://earthquake.usgs.gov'}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-size: 14px; font-weight: 600; box-shadow: 0 4px 12px rgba(102,126,234,0.3); transition: all 0.3s ease;">
                      View on USGS Website →
                    </a>
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #f8f9fa; padding: 25px 40px; text-align: center; border-top: 1px solid #e9ecef;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td>
                    <p style="margin: 0; font-size: 12px; color: #868e96; line-height: 1.6;">
                      <strong style="color: #495057;">Noteworthy News</strong><br>
                      Real-time breaking news alerts<br>
                      <a href="https://noteworthynews.co" style="color: #667eea; text-decoration: none;">noteworthynews.co</a>
                    </p>
                    <p style="margin: 15px 0 0 0; font-size: 11px; color: #adb5bd;">
                      Data provided by the U.S. Geological Survey
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
            // MUST match the content_id exactly (without cid: prefix)
            // Replace the placeholder div with the actual image
            const imageHtml = `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 25px;">
                <tr>
                  <td>
                    <div style="background: #ffffff; border-radius: 12px; padding: 0; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border: 1px solid #e9ecef;">
                      <img src="cid:${cidIdentifier}" alt="Earthquake Visualization - Magnitude ${magnitudeFormatted} near ${earthquake.location_display}" style="display: block; width: 100%; max-width: 100%; height: auto; border-radius: 12px;" />
                    </div>
                  </td>
                </tr>
              </table>
            `;
            
            console.log(`[send-earthquake-alert] 🔗 CID reference: cid:${cidIdentifier}`);
            console.log(`[send-earthquake-alert] 🔗 Image HTML: ${imageHtml.substring(0, 100)}...`);
            
            // Replace the placeholder div with the actual image
            const placeholderRegex = /<div style="background: linear-gradient\(135deg, #f8f9fa 0%, #e9ecef 100%\); border-radius: 12px; padding: 20px; text-align: center; border: 2px dashed #dee2e6;">[\s\S]*?<\/div>/;
            if (placeholderRegex.test(baseEmailContent.html)) {
              htmlWithImage = baseEmailContent.html.replace(
                placeholderRegex,
                imageHtml.trim()
              );
            } else {
              // Fallback: insert before the USGS link section
              htmlWithImage = baseEmailContent.html.replace(
                /(<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">\s*<tr>\s*<td align="center" style="padding: 20px 0; border-top: 1px solid #e9ecef;">)/,
                `${imageHtml.trim()}$1`
              );
            }
            
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
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 25px;">
                <tr>
                  <td>
                    <div style="background: #ffffff; border-radius: 12px; padding: 0; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border: 1px solid #e9ecef;">
                      <img src="cid:${imageAttachment.content_id}" alt="Earthquake Visualization - Magnitude ${magnitudeFormatted} near ${earthquake.location_display}" style="display: block; width: 100%; max-width: 100%; height: auto; border-radius: 12px;" />
                    </div>
                  </td>
                </tr>
              </table>
      `;
      // Insert before the USGS link section
      htmlWithImage = htmlWithImage.replace(
        /(<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">\s*<tr>\s*<td align="center" style="padding: 20px 0; border-top: 1px solid #e9ecef;">)/,
        `${imageHtml.trim()}$1`
      );
      console.log(`[send-earthquake-alert] ✅ Image HTML force-inserted`);
    } else if (!imageAttachment) {
      // Remove CID references from HTML if we don't have an attachment
      // This prevents broken image icons
      htmlWithImage = htmlWithImage.replace(/<img[^>]+src=["']cid:[^"']+["'][^>]*>/gi, '');
      // Also remove the placeholder if no image
      htmlWithImage = htmlWithImage.replace(/<div style="background: linear-gradient\(135deg, #f8f9fa 0%, #e9ecef 100%\); border-radius: 12px; padding: 20px; text-align: center; border: 2px dashed #dee2e6;">[\s\S]*?<\/div>/gi, '');
      console.log(`[send-earthquake-alert] ⚠️ Removed image tag and placeholder from HTML - no attachment available`);
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
            // Ensure attachment has all required fields for Resend inline images
            const attachment = {
              filename: imageAttachment.filename,
              content: imageAttachment.content, // base64 string
              content_type: imageAttachment.content_type,
              content_id: imageAttachment.content_id,
              content_disposition: 'inline', // Required for inline images
            };
            
            emailContent.attachments = [attachment];
            console.log(`[send-earthquake-alert] 📎 Adding image attachment to email for ${email}`);
            console.log(`[send-earthquake-alert] 📎 Attachment details:`, {
              filename: attachment.filename,
              content_id: attachment.content_id,
              content_type: attachment.content_type,
              content_disposition: attachment.content_disposition,
              content_length: attachment.content.length,
              content_preview: attachment.content.substring(0, 50) + '...',
              has_cid_in_html: htmlWithImage.includes(`cid:${attachment.content_id}`),
              cid_in_html_count: (htmlWithImage.match(new RegExp(`cid:${attachment.content_id}`, 'g')) || []).length,
              html_contains_cid: htmlWithImage.includes(`cid:${attachment.content_id}`)
            });
            
            // Verify the CID format in HTML
            const cidPattern = new RegExp(`cid:${attachment.content_id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
            const cidMatches = htmlWithImage.match(cidPattern);
            if (!cidMatches || cidMatches.length === 0) {
              console.error(`[send-earthquake-alert] ❌ CRITICAL: CID "${attachment.content_id}" not found in HTML!`);
              console.error(`[send-earthquake-alert] ❌ HTML snippet around image:`, htmlWithImage.substring(htmlWithImage.indexOf('See attached'), htmlWithImage.indexOf('See attached') + 200));
            } else {
              console.log(`[send-earthquake-alert] ✅ CID verified in HTML (found ${cidMatches.length} time(s))`);
            }
          }
        }
        
        if (!imageAttachment) {
          console.log(`[send-earthquake-alert] ⚠️ No image attachment for ${email} - imageAttachment is null or invalid`);
        }
        
        const result = await resend.emails.send(emailContent);
        console.log(`[send-earthquake-alert] 📧 Email sent to ${email}:`, result.data?.id || 'unknown');
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

