/**
 * Shared CORS headers for Netlify Functions.
 *
 * Usage:
 *   const { corsHeaders, optionsResponse } = require('./lib/corsHeaders');
 *   // At top of handler:
 *   if (event.httpMethod === 'OPTIONS') return optionsResponse;
 *   // In responses:
 *   return { statusCode: 200, headers: corsHeaders, body: '...' };
 *
 * If a handler needs a restricted method set (e.g. GET-only), it should
 * still use these headers - the method allowlist is permissive by design
 * because actual method enforcement happens inside each handler.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Admin-Token, X-Clems-Token",
  "Content-Type": "application/json",
};

const optionsResponse = {
  statusCode: 204,
  headers: corsHeaders,
  body: "",
};

module.exports = { corsHeaders, optionsResponse };
