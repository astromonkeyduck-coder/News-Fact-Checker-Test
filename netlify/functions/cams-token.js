/**
 * CAMS_TOKEN Endpoint
 * GET /.netlify/functions/cams-token
 * 
 * Returns CAMS_TOKEN to authenticated admin requests.
 * Requires admin JWT — the token should not be publicly accessible.
 */

const { requireAdminAuth } = require("./middleware/requireAuth");

const tokenRateLimit = new Map();
const TOKEN_RATE_LIMIT_WINDOW = 60 * 1000;
const TOKEN_RATE_LIMIT_MAX = 10;

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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const auth = await requireAdminAuth(event);
  if (auth.statusCode) return auth;

  // Rate limiting
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
