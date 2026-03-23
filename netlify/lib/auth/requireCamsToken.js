/**
 * CAMS_TOKEN Authentication Helper
 * 
 * Validates X-CAMS-TOKEN header against process.env.CAMS_TOKEN
 * 
 * SECURITY NOTES:
 * - This is NOT user authentication - it's a shared secret to prevent API abuse
 * - This is NOT encryption - it's a simple request gate
 * - Token should NEVER be logged or exposed in error messages
 * - Token should NEVER appear in frontend source code or console logs
 * 
 * @param {Object} event - Netlify function event object
 * @returns {Object|null} - Returns error response object if unauthorized, null if authorized
 */
function requireCamsToken(event) {
  // Read token from environment variable
  const expectedToken = process.env.CAMS_TOKEN;
  
  if (!expectedToken) {
    console.error('[Security] CAMS_TOKEN is not configured — denying access (fail-closed).');
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Security configuration error' })
    };
  }
  
  // Get token from request header (case-insensitive)
  const providedToken = event.headers['x-cams-token'] || 
                        event.headers['X-CAMS-TOKEN'] ||
                        event.headers['X-Cams-Token'];
  
  // Validate token
  if (!providedToken || providedToken !== expectedToken) {
    // DO NOT log the provided token or expected token
    // DO NOT include debugging details in response
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-CAMS-TOKEN',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }
  
  // Token is valid
  return null;
}

module.exports = {
  requireCamsToken
};
