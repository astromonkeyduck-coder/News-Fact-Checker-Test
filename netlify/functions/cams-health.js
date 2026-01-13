/**
 * Camera Providers Health Check
 * GET /.netlify/functions/cams-health
 * 
 * SECURITY: Protected by CAMS_TOKEN (X-CAMS-TOKEN header required)
 * 
 * Returns status of all camera providers and cache stats.
 */

const { requireCamsToken } = require('../lib/auth/requireCamsToken.js');
const { getCacheStats } = require('../lib/cams/cache.js');

// Track last fetch times per provider (in-memory)
const lastFetchTimes = {};

function updateLastFetch(provider) {
  lastFetchTimes[provider] = Date.now();
}

function getLastFetch(provider) {
  return lastFetchTimes[provider] || null;
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };
  
  // Handle OPTIONS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }
  
  // Only allow GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  // SECURITY: Validate CAMS_TOKEN
  const authError = requireCamsToken(event);
  if (authError) {
    return authError;
  }
  
  try {
    const cacheStats = getCacheStats();
    
    const providers = [
      { name: 'windy', apiKey: !!process.env.WINDY_API_KEY },
      { name: 'fl511', apiKey: null },
      { name: 'ny511', apiKey: !!process.env.NY511_API_KEY },
      { name: 'caltrans', apiKey: null }
    ];
    
    const providerStatus = providers.map(provider => ({
      name: provider.name,
      configured: provider.apiKey !== null ? provider.apiKey : true,
      lastFetch: getLastFetch(provider.name),
      lastFetchAgo: getLastFetch(provider.name) 
        ? Math.round((Date.now() - getLastFetch(provider.name)) / 1000)
        : null
    }));
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        cache: cacheStats,
        providers: providerStatus,
        environment: {
          windyApiKey: !!process.env.WINDY_API_KEY,
          ny511ApiKey: !!process.env.NY511_API_KEY
        }
      })
    };
  } catch (error) {
    console.error('[cams-health] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};

// Export helper for other modules to update fetch times
module.exports.updateLastFetch = updateLastFetch;
