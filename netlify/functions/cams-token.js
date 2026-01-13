/**
 * CAMS_TOKEN Endpoint
 * GET /.netlify/functions/cams-token
 * 
 * Returns CAMS_TOKEN to authenticated frontend requests.
 * 
 * SECURITY NOTES:
 * - This endpoint should ideally require additional authentication
 * - For now, it's a simple shared secret distribution point
 * - Token is NEVER logged
 * - Rate limited to prevent abuse
 * - Can be disabled in production via CAMS_TOKEN_ONLY_IN_DEV=true
 * 
 * In a more secure setup, you might:
 * - Require user authentication (Auth0, etc.)
 * - Use short-lived tokens
 * - Implement IP whitelist
 */

// Rate limiting for token endpoint (stricter than search)
const tokenRateLimit = new Map();
const TOKEN_RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const TOKEN_RATE_LIMIT_MAX = 10; // 10 requests per minute per IP

function getClientIP(event) {
  return event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         event.headers['x-real-ip'] ||
         event.requestContext?.identity?.sourceIp ||
         'unknown';
}

function checkTokenRateLimit(ip) {
  const now = Date.now();
  const record = tokenRateLimit.get(ip);
  
  if (!record) {
    tokenRateLimit.set(ip, { count: 1, resetAt: now + TOKEN_RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (now > record.resetAt) {
    tokenRateLimit.set(ip, { count: 1, resetAt: now + TOKEN_RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (record.count >= TOKEN_RATE_LIMIT_MAX) {
    return false;
  }
  
  record.count++;
  return true;
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
  
  // Check if endpoint is disabled in production
  const onlyInDev = process.env.CAMS_TOKEN_ONLY_IN_DEV === 'true';
  if (onlyInDev && process.env.NETLIFY_DEV !== 'true') {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: 'Forbidden' })
    };
  }
  
  // Rate limiting (stricter than search endpoint)
  const clientIP = getClientIP(event);
  if (!checkTokenRateLimit(clientIP)) {
    // Log excessive requests (without token)
    console.warn(`[cams-token] Rate limit exceeded for IP: ${clientIP}`);
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({ error: 'Rate limit exceeded' })
    };
  }
  
  try {
    const token = process.env.CAMS_TOKEN;
    
    if (!token) {
      // If token not configured, return error
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({ error: 'Service unavailable' })
      };
    }
    
    // Return token (never log it)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ token })
    };
  } catch (error) {
    console.error('[cams-token] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
