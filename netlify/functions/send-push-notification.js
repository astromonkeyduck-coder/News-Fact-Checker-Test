/**
 * Send Push Notification API
 * Sends push notifications to subscribed users with rate limiting
 * 
 * Features:
 *   - Sends to all active subscriptions matching notification type
 *   - Rate limits website-update notifications (max 1 per day per user)
 *   - Handles failed deliveries (removes stale subscriptions)
 *   - Supports batch sending
 */

const webpush = require('web-push');
const { getStore } = require("@netlify/blobs");

// Store name for push subscriptions
const STORE_NAME = "push-subscriptions";

// Rate limit: 24 hours in milliseconds
const WEBSITE_UPDATE_RATE_LIMIT_MS = 24 * 60 * 60 * 1000;

// Configure web-push with VAPID details
function configureWebPush() {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:richard@noteworthynews.co';

  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error('VAPID keys not configured');
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Verify API key for security (prevent abuse)
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const apiKey = process.env.PUSH_API_KEY;
    
    if (apiKey && authHeader !== `Bearer ${apiKey}`) {
      console.warn("[Send Push] Unauthorized request");
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const {
      type,           // Notification type: 'breaking-news', 'earthquake', 'weather', 'website-update'
      title,          // Notification title
      body: notificationBody,  // Notification body text
      url,            // URL to open when clicked
      image,          // Optional large image
      tag,            // Optional tag for grouping
      mapUrl,         // Optional map URL for earthquakes
      id,             // Optional event ID
      silent,         // Optional: silent notification
    } = body;

    if (!type || !title) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing required fields: type, title" }),
      };
    }

    // Configure web-push
    configureWebPush();

    // Get all active subscriptions that want this notification type
    const subscriptions = await getActiveSubscriptions(type);
    
    if (subscriptions.length === 0) {
      console.log("[Send Push] No subscriptions for type:", type);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          sent: 0, 
          message: "No active subscriptions for this notification type" 
        }),
      };
    }

    console.log(`[Send Push] Sending ${type} notification to ${subscriptions.length} subscribers`);

    // Prepare notification payload
    const payload = JSON.stringify({
      type,
      title,
      body: notificationBody,
      url: url || '/',
      image,
      tag: tag || `noteworthy-${type}-${Date.now()}`,
      mapUrl,
      id,
      silent,
    });

    // Send to all subscriptions with rate limiting
    const results = await sendToSubscriptions(subscriptions, payload, type);

    console.log(`[Send Push] Results: ${results.sent} sent, ${results.failed} failed, ${results.rateLimited} rate-limited`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        sent: results.sent,
        failed: results.failed,
        rateLimited: results.rateLimited,
        total: subscriptions.length,
      }),
    };
  } catch (error) {
    console.error("[Send Push] Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error", message: error.message }),
    };
  }
};

/**
 * Get active subscriptions from blob storage
 */
async function getActiveSubscriptions(notificationType) {
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
    
    // Fetch all subscriptions in parallel (with batching to avoid overwhelming)
    const batchSize = 50;
    for (let i = 0; i < index.length; i += batchSize) {
      const batch = index.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (key) => {
          try {
            const data = await store.get(key, { type: "json" });
            if (data && data.active) {
              // Check if user wants this notification type
              if (data.preferences && data.preferences[notificationType]) {
                return { key, ...data };
              }
            }
          } catch (e) {
            // Skip invalid subscriptions
          }
          return null;
        })
      );
      subscriptions.push(...batchResults.filter(Boolean));
    }

    return subscriptions;
  } catch (error) {
    console.error("[Send Push] Error getting subscriptions:", error);
    return [];
  }
}

/**
 * Send notification to all subscriptions with rate limiting
 */
async function sendToSubscriptions(subscriptions, payload, notificationType) {
  const results = {
    sent: 0,
    failed: 0,
    rateLimited: 0,
    staleRemoved: 0,
  };

  const store = getStore({
    name: STORE_NAME,
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
  });

  // Process in batches to avoid overwhelming
  const batchSize = 20;
  
  for (let i = 0; i < subscriptions.length; i += batchSize) {
    const batch = subscriptions.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (sub) => {
      try {
        // Rate limit check for website updates
        if (notificationType === 'website-update') {
          const lastUpdate = sub.lastWebsiteUpdate 
            ? new Date(sub.lastWebsiteUpdate).getTime() 
            : 0;
          const now = Date.now();
          
          if (lastUpdate && (now - lastUpdate) < WEBSITE_UPDATE_RATE_LIMIT_MS) {
            results.rateLimited++;
            console.log(`[Send Push] Rate limited: ${sub.key.slice(0, 20)}... (last update: ${new Date(lastUpdate).toISOString()})`);
            return;
          }
        }

        // Send the notification
        await webpush.sendNotification(sub.subscription, payload);
        results.sent++;

        // Update lastWebsiteUpdate timestamp for website-update notifications
        if (notificationType === 'website-update') {
          try {
            const updated = { ...sub, lastWebsiteUpdate: new Date().toISOString() };
            delete updated.key; // Don't include key in stored data
            await store.set(sub.key, JSON.stringify(updated), {
              contentType: "application/json",
            });
          } catch (e) {
            console.error("[Send Push] Error updating timestamp:", e);
          }
        }
      } catch (error) {
        results.failed++;
        
        // Handle stale subscriptions (410 Gone or 404 Not Found)
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`[Send Push] Removing stale subscription: ${sub.key.slice(0, 20)}...`);
          try {
            // Mark as inactive
            const updated = { ...sub, active: false, staleAt: new Date().toISOString() };
            delete updated.key;
            await store.set(sub.key, JSON.stringify(updated), {
              contentType: "application/json",
            });
            results.staleRemoved++;
          } catch (e) {
            console.error("[Send Push] Error marking stale:", e);
          }
        } else {
          console.error(`[Send Push] Error sending to ${sub.key.slice(0, 20)}...:`, error.message);
        }
      }
    }));
  }

  return results;
}

/**
 * Helper function to send a single notification (for use by other functions)
 * Used by earthquake engine, weather engine, etc.
 */
async function sendPushNotification(options) {
  const {
    type,
    title,
    body,
    url,
    image,
    tag,
    mapUrl,
    id,
  } = options;

  // This can be called directly by other Netlify functions
  try {
    configureWebPush();
    
    const subscriptions = await getActiveSubscriptions(type);
    
    if (subscriptions.length === 0) {
      return { success: true, sent: 0 };
    }

    const payload = JSON.stringify({
      type,
      title,
      body,
      url: url || '/',
      image,
      tag: tag || `noteworthy-${type}-${Date.now()}`,
      mapUrl,
      id,
    });

    const results = await sendToSubscriptions(subscriptions, payload, type);
    
    return {
      success: true,
      ...results,
    };
  } catch (error) {
    console.error("[Send Push] Error in sendPushNotification:", error);
    return { success: false, error: error.message };
  }
}

// Export for use by other Netlify functions
module.exports.sendPushNotification = sendPushNotification;
