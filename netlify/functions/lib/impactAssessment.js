/**
 * Impact Assessment AI
 * Automatically assesses potential impact of earthquakes using multiple data sources
 */

/**
 * Calculate affected radius based on magnitude and depth
 */
function calculateAffectedRadius(magnitude, depth) {
  // Rough estimation: larger magnitude and shallower depth = larger radius
  // Based on Modified Mercalli Intensity scale approximations
  const baseRadius = magnitude * 15; // km
  const depthFactor = depth ? Math.max(0.5, 1 - (depth / 100)) : 1; // Deeper = smaller radius
  return Math.round(baseRadius * depthFactor);
}

/**
 * Fetch population density data
 * Uses OpenStreetMap and estimates based on nearby cities
 */
async function fetchPopulationDensity(lat, lon, radiusKm) {
  try {
    // Use Overpass API to find nearby cities and estimate population
    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["place"~"^(city|town)$"]["population"](around:${radiusKm * 1000},${lat},${lon});
        way["place"~"^(city|town)$"]["population"](around:${radiusKm * 1000},${lat},${lon});
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
      // Fallback: estimate based on radius
      const estimatedDensity = 50; // people per km² (global average)
      const area = Math.PI * radiusKm * radiusKm;
      return {
        total: Math.round(area * estimatedDensity),
        cities: [],
        density: estimatedDensity,
      };
    }
    
    const data = await response.json();
    let totalPopulation = 0;
    const cities = [];
    
    for (const element of data.elements || []) {
      const tags = element.tags || {};
      const population = parseInt(tags.population, 10);
      if (population && !isNaN(population)) {
        totalPopulation += population;
        cities.push({
          name: tags.name || 'Unknown',
          population: population,
        });
      }
    }
    
    // If no city data, estimate based on radius
    if (totalPopulation === 0) {
      const estimatedDensity = 50; // people per km²
      const area = Math.PI * radiusKm * radiusKm;
      totalPopulation = Math.round(area * estimatedDensity);
    }
    
    const area = Math.PI * radiusKm * radiusKm;
    const density = totalPopulation / area;
    
    return {
      total: totalPopulation,
      cities: cities.sort((a, b) => b.population - a.population).slice(0, 10),
      density: Math.round(density),
    };
  } catch (error) {
    console.warn('[impactAssessment] Error fetching population:', error.message);
    // Fallback estimate
    const estimatedDensity = 50;
    const area = Math.PI * radiusKm * radiusKm;
    return {
      total: Math.round(area * estimatedDensity),
      cities: [],
      density: estimatedDensity,
    };
  }
}

/**
 * Fetch nearby critical infrastructure
 */
async function fetchNearbyInfrastructure(lat, lon, radiusKm) {
  try {
    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["amenity"~"^(hospital|clinic)$"](around:${radiusKm * 1000},${lat},${lon});
        node["amenity"="school"](around:${radiusKm * 1000},${lat},${lon});
        node["aeroway"~"^(aerodrome|airport)$"](around:${radiusKm * 1000},${lat},${lon});
        node["power"~"^(plant|station|generator)$"](around:${radiusKm * 1000},${lat},${lon});
        node["waterway"="dam"](around:${radiusKm * 1000},${lat},${lon});
        way["amenity"~"^(hospital|clinic)$"](around:${radiusKm * 1000},${lat},${lon});
        way["amenity"="school"](around:${radiusKm * 1000},${lat},${lon});
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
    
    if (!response.ok) return { hospitals: [], schools: [], airports: [], powerPlants: [], dams: [] };
    
    const data = await response.json();
    const infrastructure = {
      hospitals: [],
      schools: [],
      airports: [],
      powerPlants: [],
      dams: [],
    };
    
    for (const element of data.elements || []) {
      const tags = element.tags || {};
      const elementLat = element.lat || (element.center && element.center.lat);
      const elementLon = element.lon || (element.center && element.center.lon);
      
      if (!elementLat || !elementLon) continue;
      
      const item = {
        name: tags.name || 'Unknown',
        lat: elementLat,
        lon: elementLon,
      };
      
      if (tags.amenity === 'hospital' || tags.amenity === 'clinic') {
        infrastructure.hospitals.push(item);
      } else if (tags.amenity === 'school') {
        infrastructure.schools.push(item);
      } else if (tags.aeroway) {
        infrastructure.airports.push(item);
      } else if (tags.power) {
        infrastructure.powerPlants.push(item);
      } else if (tags.waterway === 'dam') {
        infrastructure.dams.push(item);
      }
    }
    
    return infrastructure;
  } catch (error) {
    console.warn('[impactAssessment] Error fetching infrastructure:', error.message);
    return { hospitals: [], schools: [], airports: [], powerPlants: [], dams: [] };
  }
}

/**
 * Fetch historical earthquakes in the region
 */
async function fetchHistoricalEarthquakes(lat, lon, radiusKm, minMagnitude = 0) {
  try {
    // Query USGS historical earthquake database
    // Use a time range (last 100 years) and location bounds
    const startTime = new Date();
    startTime.setFullYear(startTime.getFullYear() - 100);
    
    // Calculate bounding box
    const latDelta = radiusKm / 111; // roughly 111 km per degree latitude
    const lonDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
    
    const minLat = lat - latDelta;
    const maxLat = lat + latDelta;
    const minLon = lon - lonDelta;
    const maxLon = lon + lonDelta;
    
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startTime.toISOString().split('T')[0]}&minmagnitude=${minMagnitude}&minlatitude=${minLat}&maxlatitude=${maxLat}&minlongitude=${minLon}&maxlongitude=${maxLon}&limit=50`;
    
    const response = await fetch(url);
    if (!response.ok) return [];
    
    const data = await response.json();
    const earthquakes = [];
    
    for (const feature of data.features || []) {
      const props = feature.properties;
      const coords = feature.geometry.coordinates;
      
      earthquakes.push({
        magnitude: props.mag,
        time: props.time,
        location: props.place,
        depth: coords[2],
        lat: coords[1],
        lon: coords[0],
      });
    }
    
    // Sort by magnitude (descending)
    return earthquakes.sort((a, b) => b.magnitude - a.magnitude).slice(0, 10);
  } catch (error) {
    console.warn('[impactAssessment] Error fetching historical earthquakes:', error.message);
    return [];
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
  else if (magnitude >= 4.0) score += 5;
  
  // Depth component (0-20 points) - shallower = more dangerous
  if (depth && depth < 10) score += 20;
  else if (depth && depth < 30) score += 15;
  else if (depth && depth < 70) score += 10;
  else if (depth && depth < 300) score += 5;
  
  // Population component (0-20 points)
  if (population.total >= 10000000) score += 20; // 10M+
  else if (population.total >= 1000000) score += 15; // 1M+
  else if (population.total >= 100000) score += 10; // 100K+
  else if (population.total >= 10000) score += 5; // 10K+
  
  // Infrastructure component (0-10 points)
  const criticalCount = infrastructure.hospitals.length + infrastructure.airports.length + infrastructure.powerPlants.length;
  if (criticalCount >= 10) score += 10;
  else if (criticalCount >= 5) score += 7;
  else if (criticalCount >= 2) score += 4;
  else if (criticalCount >= 1) score += 2;
  
  // Historical component (0-10 points) - if similar large earthquakes happened before
  const largeHistorical = historical.filter(eq => eq.magnitude >= magnitude - 0.5).length;
  if (largeHistorical >= 5) score += 10;
  else if (largeHistorical >= 2) score += 7;
  else if (largeHistorical >= 1) score += 4;
  
  return Math.min(100, Math.round(score));
}

/**
 * Get severity level from risk score
 */
function getSeverityLevel(riskScore) {
  if (riskScore >= 80) return 'CRITICAL';
  if (riskScore >= 60) return 'HIGH';
  if (riskScore >= 40) return 'MODERATE';
  if (riskScore >= 20) return 'LOW';
  return 'MINIMAL';
}

/**
 * Fetch economic data for affected region
 * Estimates economic impact based on population and region characteristics
 */
async function fetchEconomicData(lat, lon, radiusKm) {
  try {
    // Use reverse geocoding to get country/region info
    const geocodeUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=5`;
    const response = await fetch(geocodeUrl, {
      headers: {
        'User-Agent': 'NoteworthyNews/1.0 (contact@noteworthynews.co)',
      },
    });
    
    if (!response.ok) {
      return {
        estimatedGDP: null,
        economicCenters: [],
        tradeRoutes: [],
      };
    }
    
    const data = await response.json();
    const country = data.address?.country;
    
    // Rough GDP estimates by country (simplified - in production, use World Bank API)
    // This is a placeholder - real implementation would use proper economic data APIs
    const countryGDPPerCapita = {
      'United States': 70000,
      'China': 12000,
      'Japan': 40000,
      'Germany': 48000,
      'India': 2300,
      'United Kingdom': 46000,
      'France': 44000,
      'Italy': 35000,
      'Brazil': 8500,
      'Canada': 52000,
      'Australia': 55000,
      'Mexico': 10000,
      'Indonesia': 4200,
      'Turkey': 9500,
      'South Korea': 35000,
    };
    
    const gdpPerCapita = country ? (countryGDPPerCapita[country] || 10000) : 10000;
    
    // Estimate affected population (simplified)
    const estimatedPopulation = Math.PI * radiusKm * radiusKm * 50; // Rough estimate
    const estimatedGDP = estimatedPopulation * gdpPerCapita;
    
    return {
      estimatedGDP: estimatedGDP,
      gdpPerCapita: gdpPerCapita,
      country: country,
      economicCenters: [], // Would be populated with actual economic center data
      tradeRoutes: [], // Would be populated with trade route data
    };
  } catch (error) {
    console.warn('[impactAssessment] Error fetching economic data:', error.message);
    return {
      estimatedGDP: null,
      economicCenters: [],
      tradeRoutes: [],
    };
  }
}

/**
 * Main impact assessment function
 */
async function assessEarthquakeImpact(magnitude, depth, lat, lon) {
  if (!lat || !lon) {
    return {
      error: 'Coordinates required for impact assessment',
    };
  }
  
  const radius = calculateAffectedRadius(magnitude, depth || 10);
  
  // Parallel data fetching
  const [population, infrastructure, historical, economic] = await Promise.all([
    fetchPopulationDensity(lat, lon, radius),
    fetchNearbyInfrastructure(lat, lon, radius),
    fetchHistoricalEarthquakes(lat, lon, radius, magnitude - 1), // Find earthquakes within 1 magnitude
    fetchEconomicData(lat, lon, radius),
  ]);
  
  // Calculate risk score
  const riskScore = calculateRiskScore({
    magnitude,
    depth: depth || 10,
    population,
    infrastructure,
    historical,
  });
  
  return {
    affectedRadius: radius,
    affectedPopulation: population.total,
    populationDensity: population.density,
    nearbyCities: population.cities,
    criticalInfrastructure: {
      hospitals: infrastructure.hospitals.length,
      schools: infrastructure.schools.length,
      airports: infrastructure.airports.length,
      powerPlants: infrastructure.powerPlants.length,
      dams: infrastructure.dams.length,
      details: infrastructure,
    },
    historicalComparison: {
      count: historical.length,
      largest: historical[0] || null,
      similar: historical.filter(eq => Math.abs(eq.magnitude - magnitude) <= 0.5),
    },
    economicImpact: {
      estimatedGDP: economic.estimatedGDP,
      gdpPerCapita: economic.gdpPerCapita,
      country: economic.country,
      economicCenters: economic.economicCenters,
      tradeRoutes: economic.tradeRoutes,
    },
    riskScore: riskScore,
    severity: getSeverityLevel(riskScore),
  };
}

module.exports = {
  assessEarthquakeImpact,
  calculateAffectedRadius,
  calculateRiskScore,
  getSeverityLevel,
};

