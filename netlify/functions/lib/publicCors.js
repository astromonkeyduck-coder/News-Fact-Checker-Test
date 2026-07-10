' strict';

const { getAllowedOrigins } = require('./publicMutationGuard');

function getHeader(event, name) {
  const headers = event && event.headers ? event.headers : {};
  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || '';
}

function getPublicCorsHeaders(event) {
  const origin = getHeader(event, 'origin').trim();
  const allowedOrigins = getAllowedOrigins();
  const allowOrigin = origin && allowedOrigins.has(origin)
    ? origin
    : process.env.URL || 'https://noteworthynews.co';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
  };
}

module.exports = { getPublicCorsHeaders };
