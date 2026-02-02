/**
 * Send Website Update Notification
 * Sends push notifications about website updates with rate limiting (max 1 per day per user)
 * 
 * Can be triggered:
 *   - Manually via POST request
 *   - Via Netlify deploy hook
 *   
 * The rate limiting is handled in send-push-notification.js for 'website-update' type
 */

const { sendPushNotification } = require('./send-push-notification');

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
    // Verify authorization
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const apiKey = process.env.PUSH_API_KEY || process.env.ADMIN_API_KEY;
    
    // Allow if API key matches or if triggered by Netlify deploy
    const isNetlifyDeploy = event.headers['x-netlify-deploy'] === 'true';
    const isAuthorized = (apiKey && authHeader === `Bearer ${apiKey}`) || isNetlifyDeploy;
    
    if (!isAuthorized && apiKey) {
      console.warn("[Website Update] Unauthorized request");
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    // Parse request body for custom message (optional)
    let customTitle = null;
    let customBody = null;
    let customUrl = null;

    try {
      const body = JSON.parse(event.body || "{}");
      customTitle = body.title;
      customBody = body.body;
      customUrl = body.url;
    } catch (e) {
      // Use defaults if body parsing fails
    }

    // Send push notification with website-update type
    // The rate limiting (max 1/day per user) is handled by send-push-notification.js
    const result = await sendPushNotification({
      type: 'website-update',
      title: customTitle || '✨ New on Noteworthy News',
      body: customBody || 'We\'ve made some updates! Check out what\'s new.',
      url: customUrl || '/',
      tag: `website-update-${new Date().toISOString().split('T')[0]}`, // One tag per day
    });

    console.log("[Website Update] Notification result:", result);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: "Website update notifications sent",
        sent: result.sent || 0,
        rateLimited: result.rateLimited || 0,
        failed: result.failed || 0,
        total: result.total || 0,
      }),
    };
  } catch (error) {
    console.error("[Website Update] Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error", message: error.message }),
    };
  }
};

/**
 * Helper to manually trigger website update notification
 * Can be imported and called from other scripts
 */
async function triggerWebsiteUpdateNotification(title, body, url) {
  return sendPushNotification({
    type: 'website-update',
    title: title || '✨ New on Noteworthy News',
    body: body || 'We\'ve made some updates! Check out what\'s new.',
    url: url || '/',
    tag: `website-update-${new Date().toISOString().split('T')[0]}`,
  });
}

module.exports.triggerWebsiteUpdateNotification = triggerWebsiteUpdateNotification;
