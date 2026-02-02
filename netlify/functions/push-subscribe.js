/**
 * Push Subscription API
 * Handles push notification subscriptions and VAPID key distribution
 * 
 * Endpoints:
 *   GET  ?action=vapid-key  - Get VAPID public key
 *   POST action=subscribe   - Subscribe to push notifications
 *   POST action=unsubscribe - Unsubscribe from push notifications
 */

const { getStore } = require("@netlify/blobs");

// Store name for push subscriptions
const STORE_NAME = "push-subscriptions";

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
    // Handle GET request for VAPID key
    if (event.httpMethod === "GET") {
      const action = event.queryStringParameters?.action;
      
      if (action === "vapid-key") {
        const vapidKey = process.env.VAPID_PUBLIC_KEY;
        
        if (!vapidKey) {
          console.error("[Push Subscribe] VAPID_PUBLIC_KEY not configured");
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: "Push notifications not configured" }),
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ vapidKey }),
        };
      }

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid action" }),
      };
    }

    // Handle POST requests
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { action, subscription, userEmail, preferences } = body;

      if (!action) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Missing action" }),
        };
      }

      // Check blob storage configuration
      if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
        console.error("[Push Subscribe] Blob storage not configured");
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

      // Generate a unique key from the subscription endpoint
      const getSubscriptionKey = (sub) => {
        if (!sub || !sub.endpoint) return null;
        // Create a hash-like key from the endpoint URL
        const endpoint = sub.endpoint;
        const hash = Buffer.from(endpoint).toString('base64')
          .replace(/[^a-zA-Z0-9]/g, '')
          .slice(0, 64);
        return `subscription-${hash}`;
      };

      if (action === "subscribe") {
        if (!subscription || !subscription.endpoint) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "Missing subscription data" }),
          };
        }

        const subscriptionKey = getSubscriptionKey(subscription);
        if (!subscriptionKey) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "Invalid subscription" }),
          };
        }

        // Prepare subscription data
        const subscriptionData = {
          subscription,
          userEmail: userEmail || null,
          preferences: preferences || {
            'breaking-news': true,
            'earthquake': true,
            'weather': false,
            'website-update': true
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastWebsiteUpdate: null, // Track last website update notification
          active: true,
        };

        // Save subscription
        await store.set(subscriptionKey, JSON.stringify(subscriptionData), {
          contentType: "application/json",
        });

        // Also add to index for listing
        await addToSubscriptionIndex(store, subscriptionKey);

        console.log("[Push Subscribe] Subscription saved:", subscriptionKey.slice(0, 20) + "...");

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            success: true, 
            message: "Subscription saved",
            subscriptionId: subscriptionKey
          }),
        };
      }

      if (action === "unsubscribe") {
        if (!subscription || !subscription.endpoint) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "Missing subscription data" }),
          };
        }

        const subscriptionKey = getSubscriptionKey(subscription);
        if (!subscriptionKey) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "Invalid subscription" }),
          };
        }

        // Mark as inactive (soft delete) rather than deleting
        try {
          const existing = await store.get(subscriptionKey, { type: "json" });
          if (existing) {
            existing.active = false;
            existing.unsubscribedAt = new Date().toISOString();
            await store.set(subscriptionKey, JSON.stringify(existing), {
              contentType: "application/json",
            });
          }
        } catch (e) {
          // Subscription might not exist, that's OK
        }

        // Remove from index
        await removeFromSubscriptionIndex(store, subscriptionKey);

        console.log("[Push Subscribe] Subscription removed:", subscriptionKey.slice(0, 20) + "...");

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, message: "Unsubscribed" }),
        };
      }

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid action" }),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  } catch (error) {
    console.error("[Push Subscribe] Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};

/**
 * Add subscription key to index for easy listing
 */
async function addToSubscriptionIndex(store, subscriptionKey) {
  const INDEX_KEY = "subscriptions-index";
  
  try {
    let index = [];
    try {
      const existing = await store.get(INDEX_KEY, { type: "json" });
      if (Array.isArray(existing)) {
        index = existing;
      }
    } catch (e) {
      // Index doesn't exist yet
    }

    if (!index.includes(subscriptionKey)) {
      index.push(subscriptionKey);
      await store.set(INDEX_KEY, JSON.stringify(index), {
        contentType: "application/json",
      });
    }
  } catch (error) {
    console.error("[Push Subscribe] Error updating index:", error);
  }
}

/**
 * Remove subscription key from index
 */
async function removeFromSubscriptionIndex(store, subscriptionKey) {
  const INDEX_KEY = "subscriptions-index";
  
  try {
    let index = [];
    try {
      const existing = await store.get(INDEX_KEY, { type: "json" });
      if (Array.isArray(existing)) {
        index = existing;
      }
    } catch (e) {
      return; // Index doesn't exist
    }

    index = index.filter(key => key !== subscriptionKey);
    await store.set(INDEX_KEY, JSON.stringify(index), {
      contentType: "application/json",
    });
  } catch (error) {
    console.error("[Push Subscribe] Error updating index:", error);
  }
}

/**
 * Get all active subscriptions (exported for use by other functions)
 */
async function getActiveSubscriptions(notificationType = null) {
  if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
    return [];
  }

  const store = getStore({
    name: STORE_NAME,
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
  });

  const INDEX_KEY = "subscriptions-index";
  
  try {
    const index = await store.get(INDEX_KEY, { type: "json" });
    if (!Array.isArray(index)) return [];

    const subscriptions = [];
    
    for (const key of index) {
      try {
        const data = await store.get(key, { type: "json" });
        if (data && data.active) {
          // Filter by notification type preference if specified
          if (notificationType) {
            if (data.preferences && data.preferences[notificationType]) {
              subscriptions.push({ key, ...data });
            }
          } else {
            subscriptions.push({ key, ...data });
          }
        }
      } catch (e) {
        // Skip invalid subscriptions
      }
    }

    return subscriptions;
  } catch (error) {
    console.error("[Push Subscribe] Error getting subscriptions:", error);
    return [];
  }
}

/**
 * Update subscription metadata (e.g., lastWebsiteUpdate timestamp)
 */
async function updateSubscriptionMeta(subscriptionKey, updates) {
  if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
    return false;
  }

  const store = getStore({
    name: STORE_NAME,
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
  });

  try {
    const data = await store.get(subscriptionKey, { type: "json" });
    if (!data) return false;

    const updated = {
      ...data,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await store.set(subscriptionKey, JSON.stringify(updated), {
      contentType: "application/json",
    });

    return true;
  } catch (error) {
    console.error("[Push Subscribe] Error updating subscription:", error);
    return false;
  }
}

// Export helper functions for use by other Netlify functions
module.exports.getActiveSubscriptions = getActiveSubscriptions;
module.exports.updateSubscriptionMeta = updateSubscriptionMeta;
