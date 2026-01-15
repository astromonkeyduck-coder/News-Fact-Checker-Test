/**
 * Camera Search API
 * GET /.netlify/functions/cams-search
 * 
 * SECURITY: Protected by CAMS_TOKEN (X-CAMS-TOKEN header required)
 * 
 * Query params:
 * - q: keyword search
 * - country: ISO2 country code
 * - state: US state code (e.g., NY, FL, CA)
 * - city: city name
 * - bbox: minLon,minLat,maxLon,maxLat
 * - type: dot_traffic|city_street|scenic|any
 * - media: live|snapshot|any
 * - limit: max results (default 200)
 */

const { requireCamsToken } = require('../lib/auth/requireCamsToken.js');
const { fetchWindyCameras } = require('../lib/cams/providers/windy.js');
const { fetchFL511Cameras } = require('../lib/cams/providers/fl511.js');
const { fetchNY511Cameras } = require('../lib/cams/providers/ny511.js');
const { fetchCaltransCameras } = require('../lib/cams/providers/caltrans.js');
const { dedupeCameras } = require('../lib/cams/dedupe.js');
const { getCacheKey, getCache, setCache } = require('../lib/cams/cache.js');
const { geocodeLocation } = require('../lib/cams/geocode.js');

// Rate limiting (simple in-memory per IP)
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 30; // 30 requests per minute

function getClientIP(event) {
  return event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         event.headers['x-real-ip'] ||
         event.requestContext?.identity?.sourceIp ||
         'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimit.get(ip);
  
  if (!record) {
    rateLimit.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (now > record.resetAt) {
    rateLimit.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  record.count++;
  return true;
}

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-CAMS-TOKEN',
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
    // Rate limiting
    const clientIP = getClientIP(event);
    if (!checkRateLimit(clientIP)) {
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' })
      };
    }
    
    // Parse query params
    const params = event.queryStringParameters || {};
    let {
      q,
      country,
      state,
      city,
      bbox,
      type,
      media,
      limit = '200'
    } = params;
    
    // Geocode city/street if provided but no bbox
    if ((city || q) && !bbox) {
      const geocodeQuery = city || q;
      const geocodeResult = await geocodeLocation(geocodeQuery);
      if (geocodeResult) {
        bbox = geocodeResult.bbox;
        // Update country/state from geocode result if not provided
        if (!country && geocodeResult.country_code) {
          country = geocodeResult.country_code;
        }
        if (!state && geocodeResult.state) {
          state = geocodeResult.state;
        }
        if (!city && geocodeResult.city) {
          city = geocodeResult.city;
        }
      }
    }
    
    // Build provider params
    const providerParams = {
      bbox: bbox || null,
      country: country || null,
      state: state || null,
      city: city || null,
      q: q || null,
      type: type || null,
      media: media || null,
      limit: parseInt(limit, 10) || 200
    };
    
    // Check cache
    const cacheKey = getCacheKey('search', providerParams);
    const cached = getCache(cacheKey);
    if (cached) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ...cached,
          cached: true
        })
      };
    }
    
    // Determine which providers to query with priority logic
    const providers = [];
    const isDOTRequest = type === 'dot_traffic' || country === 'US';
    
    // Priority 1: US DOT providers (if US or dot_traffic request)
    if (isDOTRequest) {
      // FL511 - always available (no API key needed)
      if (state === 'FL' || country === 'US') {
        providers.push({ name: 'fl511', fn: fetchFL511Cameras, priority: 1 });
      }
      
      // Caltrans - always available (open dataset)
      if (state === 'CA' || country === 'US') {
        providers.push({ name: 'caltrans', fn: fetchCaltransCameras, priority: 1 });
      }
      
      // NY511 - only if API key exists
      if (process.env.NY511_API_KEY) {
        if (state === 'NY' || country === 'US') {
          providers.push({ name: 'ny511', fn: fetchNY511Cameras, priority: 1 });
        }
      }
    }
    
    // Priority 2: Windy (global backbone, fallback for US, primary for non-US)
    if (!isDOTRequest || country !== 'US') {
      // For non-US or non-dot_traffic, Windy is primary
      providers.push({ name: 'windy', fn: fetchWindyCameras, priority: isDOTRequest ? 2 : 1 });
    } else {
      // For US dot_traffic, Windy is fallback
      providers.push({ name: 'windy', fn: fetchWindyCameras, priority: 2 });
    }
    
    // Fetch from all providers in parallel (with timeout)
    const providerPromises = providers.map(async ({ name, fn }) => {
      try {
        console.log(`[cams-search] Fetching from provider: ${name}`, providerParams);
        const timeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 15000) // Increased timeout to 15s
        );
        const fetchPromise = fn(providerParams);
        const cameras = await Promise.race([fetchPromise, timeout]);
        console.log(`[cams-search] Provider ${name} returned ${cameras.length} cameras`);
        return { name, cameras, error: null };
      } catch (error) {
        console.error(`[cams-search] Provider ${name} error:`, error.message, error.stack);
        return { name, cameras: [], error: error.message };
      }
    });
    
    const providerResults = await Promise.all(providerPromises);
    
    // Log provider results for debugging
    console.log('[cams-search] Provider results:', providerResults.map(r => ({
      name: r.name,
      count: r.cameras.length,
      error: r.error
    })));
    
    // Merge and dedupe results
    let allCameras = [];
    const stats = {};
    
    for (const result of providerResults) {
      stats[result.name] = result.cameras.length;
      if (result.error) {
        console.warn(`[cams-search] Provider ${result.name} had error: ${result.error}`);
      }
      allCameras.push(...result.cameras);
    }
    
    console.log('[cams-search] Total cameras before dedupe:', allCameras.length);
    
    // Deduplicate
    const deduped = dedupeCameras(allCameras);
    
    console.log('[cams-search] Total cameras after dedupe:', deduped.length);
    
    // Apply filters
    let filtered = deduped;
    
    // Filter by type
    if (type && type !== 'any') {
      filtered = filtered.filter(cam => cam.type === type);
    }
    
    // Filter by media mode
    if (media && media !== 'any') {
      if (media === 'live') {
        filtered = filtered.filter(cam => cam.media.mode === 'stream');
      } else if (media === 'snapshot') {
        filtered = filtered.filter(cam => cam.media.mode === 'snapshot' || cam.media.mode === 'unknown');
      }
    }
    
    // Filter by keyword (q)
    if (q) {
      const qLower = q.toLowerCase();
      filtered = filtered.filter(cam => 
        cam.title.toLowerCase().includes(qLower) ||
        (cam.description && cam.description.toLowerCase().includes(qLower)) ||
        (cam.city && cam.city.toLowerCase().includes(qLower)) ||
        (cam.road && cam.road.toLowerCase().includes(qLower)) ||
        cam.tags.some(tag => tag.includes(qLower))
      );
    }
    
    // Prioritize live streams over snapshots
    const prioritized = filtered.slice().sort((a, b) => {
      const aLive = a.media?.mode === 'stream' ? 1 : 0;
      const bLive = b.media?.mode === 'stream' ? 1 : 0;
      if (aLive !== bLive) return bLive - aLive; // live first
      return 0;
    });
    
    // Limit results
    const finalLimit = parseInt(limit, 10) || 200;
    const limited = prioritized.slice(0, finalLimit);
    
    console.log('[cams-search] Final filtered count:', limited.length);
    console.log('[cams-search] Stats:', stats);
    
    // Cache result
    const result = {
      results: limited,
      stats,
      total: limited.length,
      cached: false
    };
    
    setCache(cacheKey, result, 'search');
    
    console.log('[cams-search] Returning result with', limited.length, 'cameras');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('[cams-search] Error:', error);
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
