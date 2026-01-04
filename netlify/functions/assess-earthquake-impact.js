/**
 * Advanced Earthquake Impact Assessment
 * 
 * This function enriches earthquake data with:
 * - Population density analysis
 * - Infrastructure mapping
 * - Historical context
 * - Economic impact assessment
 * - Risk scoring
 * 
 * POST /.netlify/functions/assess-earthquake-impact
 * Body: { magnitude, depth, lat, lon, eventId }
 */

/**
 * Calculate affected radius based on magnitude and depth
 */
function calculateAffectedRadius(magnitude, depth) {
  // Rough estimation: larger magnitude and shallower depth = larger radius
  // This is simplified - real calculations are more complex
  const baseRadius = magnitude * 10; // km
  const depthFactor = depth ? Math.max(1, depth / 10) : 1;
  return Math.round(baseRadius / depthFactor);
}

/**
 * Fetch population density data
 * Uses OpenStreetMap Overpass API to find nearby cities and estimate population
 */
async function fetchPopulationData(lat, lon, radiusKm) {
  try {
    // Query for cities, towns, villages within radius
    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["place"~"^(city|town|village)$"](around:${radiusKm * 1000},${lat},${lon});
        way["place"~"^(city|town|village)$"](around:${radiusKm * 1000},${lat},${lon});
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
      console.warn('[assess-earthquake-impact] Overpass API failed:', response.status);
      return { total: 0, cities: [] };
    }
    
    const data = await response.json();
    const cities = [];
    let totalPopulation = 0;
    
    // Estimate population based on place type
    const populationEstimates = {
      city: 50000,
      town: 10000,
      village: 1000,
    };
    
    for (const element of data.elements || []) {
      const tags = element.tags || {};
      const placeType = tags.place;
      const name = tags.name || 'Unknown';
      
      if (placeType && populationEstimates[placeType]) {
        const estimatedPop = populationEstimates[placeType];
        cities.push({
          name,
          type: placeType,
          estimatedPopulation: estimatedPop,
        });
        totalPopulation += estimatedPop;
      }
    }
    
    // Rough estimate: assume 100 people per km² in affected area
    const areaKm2 = Math.PI * radiusKm * radiusKm;
    const densityEstimate = Math.round(areaKm2 * 100);
    
    return {
      total: Math.max(totalPopulation, densityEstimate),
      cities: cities.slice(0, 10), // Top 10 cities
      radiusKm,
      areaKm2: Math.round(areaKm2),
    };
  } catch (error) {
    console.error('[assess-earthquake-impact] Error fetching population:', error);
    return { total: 0, cities: [], radiusKm, areaKm2: 0 };
  }
}

/**
 * Fetch nearby critical infrastructure
 */
async function fetchInfrastructure(lat, lon, radiusKm) {
  try {
    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["amenity"~"^(hospital|university|school)$"](around:${radiusKm * 1000},${lat},${lon});
        node["aeroway"~"^(aerodrome|airport)$"](around:${radiusKm * 1000},${lat},${lon});
        node["power"~"^(plant|station|generator)$"](around:${radiusKm * 1000},${lat},${lon});
        way["amenity"~"^(hospital|university|school)$"](around:${radiusKm * 1000},${lat},${lon});
        way["aeroway"~"^(aerodrome|airport)$"](around:${radiusKm * 1000},${lat},${lon});
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
      return { hospitals: 0, schools: 0, airports: 0, powerPlants: 0, facilities: [] };
    }
    
    const data = await response.json();
    const facilities = {
      hospitals: 0,
      schools: 0,
      airports: 0,
      powerPlants: 0,
      facilities: [],
    };
    
    for (const element of data.elements || []) {
      const tags = element.tags || {};
      const name = tags.name || 'Unknown';
      
      if (tags.amenity === 'hospital') {
        facilities.hospitals++;
        facilities.facilities.push({ name, type: 'hospital' });
      } else if (tags.amenity === 'school' || tags.amenity === 'university') {
        facilities.schools++;
        facilities.facilities.push({ name, type: tags.amenity });
      } else if (tags.aeroway) {
        facilities.airports++;
        facilities.facilities.push({ name, type: 'airport' });
      } else if (tags.power) {
        facilities.powerPlants++;
        facilities.facilities.push({ name, type: 'power_plant' });
      }
    }
    
    return facilities;
  } catch (error) {
    console.error('[assess-earthquake-impact] Error fetching infrastructure:', error);
    return { hospitals: 0, schools: 0, airports: 0, powerPlants: 0, facilities: [] };
  }
}

/**
 * Fetch historical earthquakes in same region
 */
async function fetchHistoricalEarthquakes(lat, lon, radiusKm, currentMagnitude, currentEventId) {
  try {
    // Query USGS for historical earthquakes in same region
    // Use a larger time window (past 10 years) and similar magnitude range
    const minMagnitude = Math.max(0, currentMagnitude - 1);
    const maxMagnitude = currentMagnitude + 1;
    
    // USGS API: search for earthquakes in region
    const startTime = new Date();
    startTime.setFullYear(startTime.getFullYear() - 10);
    const endTime = new Date();
    
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startTime.toISOString().split('T')[0]}&endtime=${endTime.toISOString().split('T')[0]}&minmagnitude=${minMagnitude}&maxmagnitude=${maxMagnitude}&latitude=${lat}&longitude=${lon}&maxradiuskm=${radiusKm * 2}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      return { count: 0, largest: null, similar: [] };
    }
    
    const data = await response.json();
    const earthquakes = (data.features || [])
      .filter(f => f.id !== currentEventId) // Exclude current earthquake
      .map(f => ({
        magnitude: f.properties.mag,
        time: f.properties.time,
        location: f.properties.place,
        depth: f.geometry.coordinates[2],
      }))
      .sort((a, b) => b.magnitude - a.magnitude);
    
    return {
      count: earthquakes.length,
      largest: earthquakes[0] || null,
      similar: earthquakes.slice(0, 5), // Top 5 similar
    };
  } catch (error) {
    console.error('[assess-earthquake-impact] Error fetching historical:', error);
    return { count: 0, largest: null, similar: [] };
  }
}

/**
 * Calculate risk score (0-100)
 */
function calculateRiskScore({ magnitude, depth, population, infrastructure, historical }) {
  let score = 0;
  
  // Magnitude component (0-40 points)
  if (magnitude >= 8.0) score += 40;
  else if (magnitude >= 7.0) score += 30;
  else if (magnitude >= 6.0) score += 20;
  else if (magnitude >= 5.0) score += 10;
  else score += 5;
  
  // Depth component (0-20 points) - shallower = more dangerous
  if (depth < 10) score += 20;
  else if (depth < 30) score += 15;
  else if (depth < 70) score += 10;
  else score += 5;
  
  // Population component (0-20 points)
  if (population.total > 1000000) score += 20;
  else if (population.total > 100000) score += 15;
  else if (population.total > 10000) score += 10;
  else if (population.total > 1000) score += 5;
  
  // Infrastructure component (0-20 points)
  const criticalFacilities = infrastructure.hospitals + infrastructure.airports + infrastructure.powerPlants;
  if (criticalFacilities > 10) score += 20;
  else if (criticalFacilities > 5) score += 15;
  else if (criticalFacilities > 2) score += 10;
  else if (criticalFacilities > 0) score += 5;
  
  return Math.min(100, Math.round(score));
}

/**
 * Get severity level from risk score
 */
function getSeverityLevel(riskScore) {
  if (riskScore >= 80) return 'Extreme';
  if (riskScore >= 60) return 'High';
  if (riskScore >= 40) return 'Moderate';
  if (riskScore >= 20) return 'Low';
  return 'Minimal';
}

/**
 * Main assessment function
 */
async function assessEarthquakeImpact(magnitude, depth, lat, lon, eventId) {
  const radiusKm = calculateAffectedRadius(magnitude, depth);
  
  console.log(`[assess-earthquake-impact] Assessing M${magnitude} earthquake at ${lat},${lon} (radius: ${radiusKm}km)`);
  
  // Fetch all data in parallel
  const [population, infrastructure, historical] = await Promise.all([
    fetchPopulationData(lat, lon, radiusKm),
    fetchInfrastructure(lat, lon, radiusKm),
    fetchHistoricalEarthquakes(lat, lon, radiusKm, magnitude, eventId),
  ]);
  
  // Calculate risk score
  const riskScore = calculateRiskScore({
    magnitude,
    depth: depth || 10, // Default depth if not provided
    population,
    infrastructure,
    historical,
  });
  
  const severity = getSeverityLevel(riskScore);
  
  return {
    magnitude,
    depth: depth || 10,
    location: { lat, lon },
    affectedRadius: radiusKm,
    
    population: {
      total: population.total,
      cities: population.cities,
      areaKm2: population.areaKm2,
    },
    
    infrastructure: {
      hospitals: infrastructure.hospitals,
      schools: infrastructure.schools,
      airports: infrastructure.airports,
      powerPlants: infrastructure.powerPlants,
      facilities: infrastructure.facilities.slice(0, 10), // Top 10
    },
    
    historical: {
      similarCount: historical.count,
      largestSimilar: historical.largest,
      recentSimilar: historical.similar,
    },
    
    risk: {
      score: riskScore,
      severity,
      level: severity.toLowerCase(),
    },
    
    timestamp: new Date().toISOString(),
  };
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
    const { magnitude, depth, lat, lon, eventId } = body;
    
    if (!magnitude || !lat || !lon || !eventId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Missing required fields: magnitude, lat, lon, eventId",
        }),
      };
    }
    
    const assessment = await assessEarthquakeImpact(magnitude, depth, lat, lon, eventId);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        assessment,
      }),
    };
    
  } catch (error) {
    console.error('[assess-earthquake-impact] ERROR:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error?.message || "Internal server error",
      }),
    };
  }
};

// Export for use in other functions
exports.assessEarthquakeImpact = assessEarthquakeImpact;

