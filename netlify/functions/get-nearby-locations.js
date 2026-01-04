/**
 * Get nearby locations for earthquake articles
 * 
 * GET /.netlify/functions/get-nearby-locations?lat=...&lon=...&radius=50
 */

/**
 * Calculate distance between two coordinates (Haversine formula)
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
 * Find nearby important locations
 */
async function findNearbyLocations(lat, lon, radiusKm = 50) {
  try {
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
    
    if (!response.ok) return [];
    
    const data = await response.json();
    const locations = [];
    
    for (const element of data.elements || []) {
      const elementLat = element.lat || (element.center && element.center.lat);
      const elementLon = element.lon || (element.center && element.center.lon);
      
      if (!elementLat || !elementLon) continue;
      
      const distance = calculateDistance(lat, lon, elementLat, elementLon);
      const tags = element.tags || {};
      const name = tags.name || tags['name:en'] || 'Unknown';
      const type = tags.place || tags.amenity || tags.tourism || tags.leisure || 'location';
      
      locations.push({
        name,
        type,
        distance: Math.round(distance * 10) / 10,
        lat: elementLat,
        lon: elementLon,
      });
    }
    
    return locations
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10);
      
  } catch (error) {
    console.warn(`[get-nearby-locations] Error finding nearby locations:`, error.message);
    return [];
  }
}

/**
 * Find nearby educational institutions
 */
async function findNearbyEducation(lat, lon, radiusKm = 50) {
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
    console.warn(`[get-nearby-locations] Error finding nearby education:`, error.message);
    return [];
  }
}

/**
 * Find nearby event venues
 */
async function findNearbyVenues(lat, lon, radiusKm = 50) {
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
    console.warn(`[get-nearby-locations] Error finding nearby venues:`, error.message);
    return [];
  }
}

/**
 * Main handler
 */
exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
  
  // Handle OPTIONS
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }
  
  try {
    const { lat, lon, radius = 50 } = event.queryStringParameters || {};
    
    if (!lat || !lon) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing required parameters: lat, lon" }),
      };
    }
    
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    const radiusKm = parseInt(radius, 10) || 50;
    
    if (isNaN(latitude) || isNaN(longitude)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid coordinates" }),
      };
    }
    
    // Fetch all nearby data in parallel
    const [locations, education, venues] = await Promise.allSettled([
      findNearbyLocations(latitude, longitude, radiusKm),
      findNearbyEducation(latitude, longitude, radiusKm),
      findNearbyVenues(latitude, longitude, radiusKm),
    ]);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        locations: locations.status === 'fulfilled' ? locations.value : [],
        education: education.status === 'fulfilled' ? education.value : [],
        venues: venues.status === 'fulfilled' ? venues.value : [],
      }),
    };
    
  } catch (error) {
    console.error('[get-nearby-locations] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error?.message || "Internal server error",
      }),
    };
  }
};

