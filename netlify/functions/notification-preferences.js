/**
 * Notification Preferences API
 * Manages user notification preferences for push notifications
 * 
 * Endpoints:
 *   GET  ?endpoint=<subscription_endpoint>  - Get preferences for a subscription
 *   POST                                     - Update preferences for a subscription
 */

const { getStore } = require("@netlify/blobs");

// Store name for push subscriptions
const STORE_NAME = "push-subscriptions";

// Default preferences
const DEFAULT_PREFERENCES = {
  'breaking-news': true,
  'earthquake': true,
  'weather': false,
  'website-update': true,
};

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    // Check blob storage configuration
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Storage not configured" }),
      };
    }

    const store = getStore({
      name: STORE_NAME,
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
    });

    // Generate subscription key from endpoint
    const getSubscriptionKey = (endpoint) => {
      if (!endpoint) return null;
      const hash = Buffer.from(endpoint).toString('base64')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 64);
      return `subscription-${hash}`;
    };

    // Handle GET request - retrieve preferences
    if (event.httpMethod === "GET") {
      const endpoint = event.queryStringParameters?.endpoint;
      
      if (!endpoint) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Missing endpoint parameter" }),
        };
      }

      const subscriptionKey = getSubscriptionKey(endpoint);
      if (!subscriptionKey) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Invalid endpoint" }),
        };
      }

      try {
        const data = await store.get(subscriptionKey, { type: "json" });
        
        if (!data) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ 
              error: "Subscription not found",
              preferences: DEFAULT_PREFERENCES 
            }),
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            preferences: data.preferences || DEFAULT_PREFERENCES,
            userEmail: data.userEmail,
          }),
        };
      } catch (error) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ 
            error: "Subscription not found",
            preferences: DEFAULT_PREFERENCES 
          }),
        };
      }
    }

    // Handle POST request - update preferences
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { subscription, preferences } = body;

      if (!subscription || !subscription.endpoint) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Missing subscription data" }),
        };
      }

      if (!preferences || typeof preferences !== 'object') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Missing or invalid preferences" }),
        };
      }

      const subscriptionKey = getSubscriptionKey(subscription.endpoint);
      if (!subscriptionKey) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Invalid subscription" }),
        };
      }

      try {
        // Get existing subscription data
        let data;
        try {
          data = await store.get(subscriptionKey, { type: "json" });
        } catch (e) {
          // Subscription doesn't exist - can't update preferences without subscription
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: "Subscription not found. Please subscribe first." }),
          };
        }

        if (!data) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: "Subscription not found. Please subscribe first." }),
          };
        }

        // Validate preferences - only allow known types
        const validPreferences = {};
        for (const [key, value] of Object.entries(preferences)) {
          if (key in DEFAULT_PREFERENCES && typeof value === 'boolean') {
            validPreferences[key] = value;
          }
        }

        // Merge with existing preferences
        const updatedPreferences = {
          ...DEFAULT_PREFERENCES,
          ...data.preferences,
          ...validPreferences,
        };

        // Update subscription data
        const updatedData = {
          ...data,
          preferences: updatedPreferences,
          updatedAt: new Date().toISOString(),
        };

        await store.set(subscriptionKey, JSON.stringify(updatedData), {
          contentType: "application/json",
        });

        console.log("[Notification Preferences] Updated preferences for:", subscriptionKey.slice(0, 20) + "...");

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            preferences: updatedPreferences,
          }),
        };
      } catch (error) {
        console.error("[Notification Preferences] Error updating:", error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: "Failed to update preferences" }),
        };
      }
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  } catch (error) {
    console.error("[Notification Preferences] Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
