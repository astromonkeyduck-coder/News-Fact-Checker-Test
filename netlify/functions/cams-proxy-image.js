/**
 * Camera Image Proxy
 * GET /.netlify/functions/cams-proxy-image?url=<encoded_url>
 * 
 * SECURITY: Protected by CAMS_TOKEN (X-CAMS-TOKEN header required)
 * 
 * Proxies camera snapshot images to avoid hotlinking issues.
 * Whitelist-only for security.
 */

const { requireCamsToken } = require('../lib/auth/requireCamsToken.js');

const ALLOWED_DOMAINS = [
  'api.windy.com',
  'windy.com',
  'www.fl511.com',
  'fl511.com',
  '511ny.org',
  'cwwp2.dot.ca.gov',
  'dot.ca.gov',
  'webcams.travel'
];

function isAllowedDomain(url) {
  try {
    const urlObj = new URL(url);
    return ALLOWED_DOMAINS.some(domain => 
      urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
    );
  } catch (error) {
    return false;
  }
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
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
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  // SECURITY: Validate CAMS_TOKEN
  const authError = requireCamsToken(event);
  if (authError) {
    return authError;
  }
  
  try {
    const params = event.queryStringParameters || {};
    const imageUrl = params.url;
    
    if (!imageUrl) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing url parameter' })
      };
    }
    
    // Decode URL
    const decodedUrl = decodeURIComponent(imageUrl);
    
    // Check if domain is allowed
    if (!isAllowedDomain(decodedUrl)) {
      return {
        statusCode: 403,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Domain not allowed' })
      };
    }
    
    // Fetch image
    const response = await fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NoteworthyNews/1.0)',
        'Referer': decodedUrl
      }
    });
    
    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to fetch image' })
      };
    }
    
    // Get image data
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // Enforce size limit (5MB)
    if (imageBuffer.byteLength > 5 * 1024 * 1024) {
      return {
        statusCode: 413,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Image too large' })
      };
    }
    
    // Return image with appropriate headers
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': contentType,
        'Content-Length': imageBuffer.byteLength.toString()
      },
      body: Buffer.from(imageBuffer).toString('base64'),
      isBase64Encoded: true
    };
  } catch (error) {
    console.error('[cams-proxy-image] Error:', error);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};
