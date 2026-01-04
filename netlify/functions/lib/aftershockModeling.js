/**
 * Predictive Aftershock Modeling
 * Predicts likelihood and magnitude of aftershocks
 */

/**
 * Calculate probability of aftershocks using Omori's law and Bath's law
 * Based on empirical earthquake statistics
 */
function calculateAftershockProbability(magnitude, timeSinceMainShockHours = 0) {
  // Bath's Law: Largest aftershock is typically ~1.2 magnitude units smaller
  // Omori's Law: Aftershock frequency decreases with time
  
  const expectedLargestAftershock = Math.max(0, magnitude - 1.2);
  
  // Probability of significant aftershock (M >= main - 1.5) within time windows
  const baseProbability = magnitude >= 7.0 ? 0.95 : magnitude >= 6.0 ? 0.85 : magnitude >= 5.0 ? 0.70 : 0.50;
  
  // Time decay factor (aftershocks become less likely over time, but still possible)
  const timeDecay = Math.max(0.3, 1 - (timeSinceMainShockHours / (24 * 7))); // Decay over 7 days
  
  const probability24h = baseProbability * Math.max(0.8, timeDecay);
  const probability48h = baseProbability * Math.max(0.6, timeDecay * 0.9);
  const probability7d = baseProbability * Math.max(0.4, timeDecay * 0.7);
  
  return {
    expectedLargestAftershock: Math.round(expectedLargestAftershock * 10) / 10,
    probability24h: Math.round(probability24h * 100),
    probability48h: Math.round(probability48h * 100),
    probability7d: Math.round(probability7d * 100),
    confidence: magnitude >= 7.0 ? 'HIGH' : magnitude >= 6.0 ? 'MEDIUM' : 'LOW',
  };
}

/**
 * Estimate number of aftershocks expected
 */
function estimateAftershockCount(magnitude) {
  // Empirical relationship: log10(N) ≈ a - b*M
  // For M5.0: ~10-100 aftershocks
  // For M6.0: ~100-1000 aftershocks
  // For M7.0: ~1000-10000 aftershocks
  
  const logCount = 3.5 - 0.5 * magnitude;
  const estimatedCount = Math.pow(10, logCount);
  
  return {
    estimated24h: Math.round(estimatedCount * 0.3), // ~30% in first 24h
    estimated48h: Math.round(estimatedCount * 0.5), // ~50% in first 48h
    estimated7d: Math.round(estimatedCount * 0.8), // ~80% in first week
    estimatedTotal: Math.round(estimatedCount),
  };
}

/**
 * Get aftershock forecast description
 */
function getAftershockForecast(magnitude, timeSinceMainShockHours = 0) {
  const probability = calculateAftershockProbability(magnitude, timeSinceMainShockHours);
  const counts = estimateAftershockCount(magnitude);
  
  let forecast = '';
  
  if (probability.probability24h >= 80) {
    forecast = `⚠️ HIGH PROBABILITY: There is a ${probability.probability24h}% chance of significant aftershocks (M≥${probability.expectedLargestAftershock.toFixed(1)}) within 24 hours. `;
    forecast += `Expect approximately ${counts.estimated24h} aftershocks in the next 24 hours. `;
    forecast += `The largest aftershock is expected to be around M${probability.expectedLargestAftershock.toFixed(1)}.`;
  } else if (probability.probability24h >= 50) {
    forecast = `MODERATE PROBABILITY: There is a ${probability.probability24h}% chance of significant aftershocks (M≥${probability.expectedLargestAftershock.toFixed(1)}) within 24 hours. `;
    forecast += `Expect approximately ${counts.estimated24h} aftershocks in the next 24 hours.`;
  } else {
    forecast = `LOW-MODERATE PROBABILITY: There is a ${probability.probability24h}% chance of significant aftershocks within 24 hours. `;
    forecast += `Smaller aftershocks are still possible.`;
  }
  
  return {
    ...probability,
    ...counts,
    forecast,
    recommendation: probability.probability24h >= 70 
      ? 'Be prepared for aftershocks. Secure loose items and have an emergency plan ready.'
      : probability.probability24h >= 40
      ? 'Monitor for aftershocks. Most will be smaller than the main shock.'
      : 'Aftershocks are possible but less likely. Stay informed.',
  };
}

/**
 * Main aftershock modeling function
 */
function predictAftershocks(magnitude, timeSinceMainShockHours = 0) {
  if (magnitude < 4.0) {
    return {
      forecast: 'Aftershock probability is low for earthquakes below M4.0.',
      probability24h: 20,
      probability48h: 25,
      probability7d: 30,
      expectedLargestAftershock: Math.max(0, magnitude - 1.2),
      confidence: 'LOW',
    };
  }
  
  return getAftershockForecast(magnitude, timeSinceMainShockHours);
}

module.exports = {
  predictAftershocks,
  calculateAftershockProbability,
  estimateAftershockCount,
  getAftershockForecast,
};

