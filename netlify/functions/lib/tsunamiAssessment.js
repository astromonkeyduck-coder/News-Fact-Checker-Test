/**
 * Tsunami Risk Assessment
 * Automatically assesses tsunami risk for coastal earthquakes
 */

/**
 * Calculate distance to nearest coastline
 * Uses a simple approximation: checks if coordinates are in ocean based on distance from land
 */
async function calculateDistanceToCoastline(lat, lon) {
  try {
    // Use Overpass API to find nearest land
    const overpassQuery = `
      [out:json][timeout:25];
      (
        way["natural"="coastline"](around:50000,${lat},${lon});
      );
      out geom;
    `;
    
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'NoteworthyNews/1.0 (contact@noteworthynews.co)',
      },
    });
    
    if (!response.ok) {
      // Fallback: estimate based on coordinates
      // If lat/lon are in ocean regions, estimate distance
      return estimateOceanDistance(lat, lon);
    }
    
    const data = await response.json();
    let minDistance = Infinity;
    
    // Calculate distance to nearest coastline point
    for (const element of data.elements || []) {
      if (element.geometry) {
        for (const point of element.geometry) {
          const distance = calculateDistance(lat, lon, point.lat, point.lon);
          if (distance < minDistance) {
            minDistance = distance;
          }
        }
      }
    }
    
    return minDistance === Infinity ? estimateOceanDistance(lat, lon) : minDistance;
  } catch (error) {
    console.warn('[tsunamiAssessment] Error calculating coastline distance:', error.message);
    return estimateOceanDistance(lat, lon);
  }
}

/**
 * Estimate distance to coastline based on known ocean regions
 */
function estimateOceanDistance(lat, lon) {
  // Very rough approximation - in real implementation, use proper coastline data
  // For now, return a large distance if coordinates suggest ocean location
  // This is a placeholder - proper implementation would use coastline shapefiles
  return 100; // Default to 100km (will be refined)
}

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
 * Check if earthquake is in ocean/coastal region
 */
function isOceanicEarthquake(lat, lon, depth) {
  // Simple heuristic: if depth is very shallow (< 30km) and coordinates suggest ocean
  // This is a placeholder - proper implementation would use ocean/land masks
  // For now, we'll assess based on magnitude and depth thresholds
  return depth < 30; // Shallow earthquakes are more likely to be oceanic
}

/**
 * Calculate tsunami travel time to nearest coastline
 * Rough approximation based on distance and tsunami speed
 */
function calculateTsunamiTravelTime(distanceKm) {
  // Average tsunami speed: ~200 m/s in deep ocean, ~30 m/s in shallow water
  // Using average of ~100 m/s = 360 km/h
  const averageSpeedKmh = 360;
  const timeHours = distanceKm / averageSpeedKmh;
  return {
    hours: Math.floor(timeHours),
    minutes: Math.round((timeHours - Math.floor(timeHours)) * 60),
    totalMinutes: Math.round(timeHours * 60),
  };
}

/**
 * Assess tsunami risk level
 */
function calculateTsunamiRiskScore(magnitude, depth, distanceToCoast) {
  // Tsunami risk factors:
  // 1. Magnitude >= 7.0 (typically required for significant tsunamis)
  // 2. Depth < 30km (shallow earthquakes more likely to generate tsunamis)
  // 3. Oceanic location (distance to coast < 200km suggests oceanic)
  
  let riskLevel = 'LOW';
  let riskScore = 0;
  
  // Magnitude component
  if (magnitude >= 8.5) {
    riskScore += 50;
  } else if (magnitude >= 8.0) {
    riskScore += 40;
  } else if (magnitude >= 7.5) {
    riskScore += 30;
  } else if (magnitude >= 7.0) {
    riskScore += 20;
  } else if (magnitude >= 6.5) {
    riskScore += 10;
  }
  
  // Depth component (shallower = higher risk)
  if (depth && depth < 10) {
    riskScore += 30;
  } else if (depth && depth < 20) {
    riskScore += 25;
  } else if (depth && depth < 30) {
    riskScore += 20;
  } else if (depth && depth < 50) {
    riskScore += 10;
  }
  
  // Distance to coast component (closer = higher risk if oceanic)
  if (distanceToCoast < 50) {
    riskScore += 20; // Very close to coast
  } else if (distanceToCoast < 100) {
    riskScore += 15;
  } else if (distanceToCoast < 200) {
    riskScore += 10;
  }
  
  // Determine risk level
  if (riskScore >= 70) {
    riskLevel = 'HIGH';
  } else if (riskScore >= 40) {
    riskLevel = 'MEDIUM';
  } else {
    riskLevel = 'LOW';
  }
  
  return {
    riskLevel,
    riskScore: Math.min(100, riskScore),
    factors: {
      magnitude: magnitude >= 7.0,
      shallowDepth: depth && depth < 30,
      nearCoast: distanceToCoast < 200,
    },
  };
}

/**
 * Main tsunami risk assessment function
 */
async function assessTsunamiRisk(magnitude, depth, lat, lon) {
  if (!lat || !lon) {
    return {
      error: 'Coordinates required for tsunami assessment',
    };
  }
  
  // Check if earthquake meets basic tsunami criteria
  const isOceanic = isOceanicEarthquake(lat, lon, depth);
  const meetsMagnitudeThreshold = magnitude >= 6.5; // Lower threshold for assessment
  
  if (!meetsMagnitudeThreshold) {
    return {
      riskLevel: 'LOW',
      riskScore: 0,
      reason: 'Magnitude below tsunami generation threshold',
      assessment: 'Tsunami risk is minimal due to low magnitude.',
    };
  }
  
  // Calculate distance to coastline
  const distanceToCoast = await calculateDistanceToCoastline(lat, lon);
  
  // Assess risk
  const riskAssessment = calculateTsunamiRiskScore(magnitude, depth || 10, distanceToCoast);
  
  // Calculate travel time if high/medium risk
  let travelTime = null;
  if (riskAssessment.riskLevel !== 'LOW' && distanceToCoast < 500) {
    travelTime = calculateTsunamiTravelTime(distanceToCoast);
  }
  
  // Generate assessment message
  let assessment = '';
  if (riskAssessment.riskLevel === 'HIGH') {
    assessment = `⚠️ HIGH TSUNAMI RISK: This ${magnitude.toFixed(1)} magnitude earthquake at ${depth ? depth.toFixed(1) : 'shallow'} km depth may generate a tsunami. `;
    if (travelTime) {
      assessment += `Estimated travel time to nearest coast: ${travelTime.hours}h ${travelTime.minutes}m. `;
    }
    assessment += `Monitor official tsunami warnings.`;
  } else if (riskAssessment.riskLevel === 'MEDIUM') {
    assessment = `Tsunami risk is possible but not certain. Monitor official tsunami warnings.`;
  } else {
    assessment = `Tsunami risk is low. No tsunami warning expected.`;
  }
  
  return {
    ...riskAssessment,
    distanceToCoastline: Math.round(distanceToCoast * 10) / 10,
    travelTime,
    isOceanic,
    assessment,
    requiresWarning: riskAssessment.riskLevel === 'HIGH',
  };
}

module.exports = {
  assessTsunamiRisk,
  calculateDistanceToCoastline,
  calculateTsunamiTravelTime,
};

