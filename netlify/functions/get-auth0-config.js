/**
 * Get Auth0 Configuration
 * Returns Auth0 credentials for client-side use
 * GET /.netlify/functions/get-auth0-config
 */

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: "",
    };
  }

  try {
    const domain = process.env.AUTH0_DOMAIN;
    const clientId = process.env.AUTH0_CLIENT_ID;

    if (!domain || !clientId) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: "Auth0 configuration not found",
          message: "Set AUTH0_DOMAIN and AUTH0_CLIENT_ID in Netlify environment variables"
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        domain: domain,
        clientId: clientId,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};



