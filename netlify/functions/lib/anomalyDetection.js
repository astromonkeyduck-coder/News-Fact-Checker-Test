/**
 * Anomaly Detection
 * Identifies unusual earthquake patterns
 */

/**
 * Detect earthquake swarms (unusual clusters)
 */
async function detectSwarm(lat, lon, magnitude, timeWindowHours = 24, radiusKm = 50) {
  try {
    // Query USGS for recent earthquakes in the region
    const startTime = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);
    
    const latDelta = radiusKm / 111;
    const lonDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
    
    const minLat = lat - latDelta;
    const maxLat = lat + latDelta;
    const minLon = lon - lonDelta;
    const maxLon = lon + lonDelta;
    
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startTime.toISOString()}&minmagnitude=${magnitude - 2}&minlatitude=${minLat}&maxlatitude=${maxLat}&minlongitude=${minLon}&maxlongitude=${maxLon}&limit=100`;
    
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    const earthquakes = data.features || [];
    
    // Count earthquakes in time window
    const count = earthquakes.length;
    
    // Normal rate: ~1-5 earthquakes per day in active regions
    // Swarm: >10 earthquakes in 24h, or >5 in 6h
    const isSwarm = count >= 10 || (timeWindowHours <= 6 && count >= 5);
    
    return {
      isSwarm,
      count,
      timeWindowHours,
      radiusKm,
      averageMagnitude: earthquakes.length > 0 
        ? earthquakes.reduce((sum, eq) => sum + (eq.properties.mag || 0), 0) / earthquakes.length 
        : magnitude,
    };
  } catch (error) {
    console.warn('[anomalyDetection] Error detecting swarm:', error.message);
    return null;
  }
}

/**
 * Check if earthquake is unusually large for the region
 */
async function checkUnusualMagnitude(lat, lon, magnitude) {
  try {
    // Query historical earthquakes in region (last 10 years)
    const startTime = new Date();
    startTime.setFullYear(startTime.getFullYear() - 10);
    
    const latDelta = 2; // ~200km radius
    const lonDelta = 2;
    
    const minLat = lat - latDelta;
    const maxLat = lat + latDelta;
    const minLon = lon - lonDelta;
    const maxLon = lon + lonDelta;
    
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startTime.toISOString().split('T')[0]}&minmagnitude=${magnitude - 1}&minlatitude=${minLat}&maxlatitude=${maxLat}&minlongitude=${minLon}&maxlongitude=${maxLon}&limit=100&orderby=magnitude`;
    
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    const earthquakes = data.features || [];
    
    // Find largest earthquake in region in last 10 years
    const largest = earthquakes.length > 0 ? earthquakes[0].properties.mag : 0;
    
    // Unusual if current earthquake is:
    // - Within 0.5 magnitude of largest in 10 years, OR
    // - Largest in region in 10 years
    const isUnusuallyLarge = magnitude >= largest - 0.5;
    const isLargestInRegion = magnitude >= largest;
    
    return {
      isUnusuallyLarge,
      isLargestInRegion,
      largestInRegion10y: largest,
      rankInRegion: earthquakes.findIndex(eq => eq.properties.mag <= magnitude) + 1,
    };
  } catch (error) {
    console.warn('[anomalyDetection] Error checking unusual magnitude:', error.message);
    return null;
  }
}

/**
 * Detect if this is part of an aftershock sequence
 */
async function detectAftershockSequence(lat, lon, magnitude, time) {
  try {
    // Look for larger earthquakes in same region in past 7 days
    const startTime = new Date(time - 7 * 24 * 60 * 60 * 1000);
    
    const latDelta = 1; // ~100km radius
    const lonDelta = 1;
    
    const minLat = lat - latDelta;
    const maxLat = lat + latDelta;
    const minLon = lon - lonDelta;
    const maxLon = lon + lonDelta;
    
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startTime.toISOString()}&minmagnitude=${magnitude + 0.3}&minlatitude=${minLat}&maxlatitude=${maxLat}&minlongitude=${minLon}&maxlongitude=${maxLon}&limit=10&orderby=magnitude`;
    
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    const largerEarthquakes = data.features || [];
    
    if (largerEarthquakes.length > 0) {
      const mainShock = largerEarthquakes[0];
      const timeDiff = (time - mainShock.properties.time) / (1000 * 60 * 60); // hours
      
      return {
        isAftershock: true,
        mainShockMagnitude: mainShock.properties.mag,
        mainShockTime: mainShock.properties.time,
        hoursSinceMainShock: Math.round(timeDiff * 10) / 10,
        sequencePosition: largerEarthquakes.length + 1,
      };
    }
    
    return {
      isAftershock: false,
    };
  } catch (error) {
    console.warn('[anomalyDetection] Error detecting aftershock sequence:', error.message);
    return null;
  }
}

/**
 * Main anomaly detection function
 */
async function detectAnomalies(magnitude, depth, lat, lon, time) {
  if (!lat || !lon) {
    return {
      anomalies: [],
      summary: 'Cannot detect anomalies without coordinates',
    };
  }
  
  const anomalies = [];
  let anomalyScore = 0;
  
  // Check for swarm
  const swarm = await detectSwarm(lat, lon, magnitude, 24, 50);
  if (swarm && swarm.isSwarm) {
    anomalies.push({
      type: 'SWARM',
      severity: 'HIGH',
      description: `Earthquake swarm detected: ${swarm.count} earthquakes in ${swarm.timeWindowHours}h within ${swarm.radiusKm}km`,
    });
    anomalyScore += 30;
  }
  
  // Check for unusually large magnitude
  const unusualMagnitude = await checkUnusualMagnitude(lat, lon, magnitude);
  if (unusualMagnitude && unusualMagnitude.isUnusuallyLarge) {
    const description = unusualMagnitude.isLargestInRegion
      ? `Largest earthquake in this region in the past 10 years (M${magnitude.toFixed(1)})`
      : `Unusually large earthquake for this region (M${magnitude.toFixed(1)}, largest in 10y: M${unusualMagnitude.largestInRegion10y.toFixed(1)})`;
    
    anomalies.push({
      type: 'UNUSUAL_MAGNITUDE',
      severity: unusualMagnitude.isLargestInRegion ? 'HIGH' : 'MEDIUM',
      description,
    });
    anomalyScore += unusualMagnitude.isLargestInRegion ? 40 : 20;
  }
  
  // Check for aftershock sequence
  const aftershockSequence = await detectAftershockSequence(lat, lon, magnitude, time);
  if (aftershockSequence && aftershockSequence.isAftershock) {
    anomalies.push({
      type: 'AFTERSHOCK_SEQUENCE',
      severity: 'INFO',
      description: `Part of aftershock sequence following M${aftershockSequence.mainShockMagnitude.toFixed(1)} earthquake ${aftershockSequence.hoursSinceMainShock}h ago`,
    });
    anomalyScore += 10;
  }
  
  // Check for unusual depth
  if (depth) {
    if (depth < 10 && magnitude >= 6.0) {
      anomalies.push({
        type: 'UNUSUAL_DEPTH',
        severity: 'MEDIUM',
        description: `Very shallow earthquake (${depth.toFixed(1)}km) with significant magnitude - may cause more surface damage`,
      });
      anomalyScore += 15;
    } else if (depth > 300 && magnitude >= 7.0) {
      anomalies.push({
        type: 'DEEP_EARTHQUAKE',
        severity: 'INFO',
        description: `Very deep earthquake (${depth.toFixed(1)}km) - less likely to cause surface damage`,
      });
    }
  }
  
  // Determine overall anomaly level
  let anomalyLevel = 'NORMAL';
  if (anomalyScore >= 50) {
    anomalyLevel = 'HIGH';
  } else if (anomalyScore >= 30) {
    anomalyLevel = 'MEDIUM';
  } else if (anomalyScore >= 10) {
    anomalyLevel = 'LOW';
  }
  
  return {
    anomalies,
    anomalyScore,
    anomalyLevel,
    summary: anomalies.length > 0
      ? `${anomalies.length} anomaly/anomalies detected: ${anomalies.map(a => a.type).join(', ')}`
      : 'No significant anomalies detected',
  };
}

module.exports = {
  detectAnomalies,
  detectSwarm,
  checkUnusualMagnitude,
  detectAftershockSequence,
};

