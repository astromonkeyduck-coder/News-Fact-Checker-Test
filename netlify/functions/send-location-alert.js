/**
 * Location-Based Alerts
 * Sends personalized alerts for events near user's location
 * Works with all event types: weather, earthquakes, FAA, USCG, volcano, embassy
 */

// Load environment variables
if (process.env.NETLIFY_DEV || !process.env.RESEND_API_KEY) {
  try {
    require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  } catch (e) {
    // dotenv not needed in production
  }
}

const { Resend } = require('resend');
const { getStore } = require("@netlify/blobs");
const { getLocationFromIP } = require('./get-location');

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in miles
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if event is near user's location
 */
function isEventNearLocation(eventLat, eventLon, userLat, userLon, radiusMiles = 50) {
  if (!eventLat || !eventLon || !userLat || !userLon) {
    return false;
  }

  const distance = calculateDistance(userLat, userLon, eventLat, eventLon);
  return distance <= radiusMiles;
}

/**
 * Get user's location preferences
 */
async function getUserLocationPreferences(userEmail) {
  if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
    return null;
  }

  try {
    const store = getStore({
      name: "user-data",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
    });

    const userKey = `user-${userEmail.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const dataKey = `${userKey}-data`;

    const userData = await store.get(dataKey, { type: "json" });
    
    if (!userData || !userData.preferences) {
      return null;
    }

    return userData.preferences.location || null;
  } catch (error) {
    console.error('[Location Alert] Error getting user preferences:', error);
    return null;
  }
}

/**
 * Save user's location preferences
 */
async function saveUserLocationPreferences(userEmail, locationData) {
  if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
    return false;
  }

  try {
    const store = getStore({
      name: "user-data",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
    });

    const userKey = `user-${userEmail.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const dataKey = `${userKey}-data`;

    // Get existing user data
    let userData = await store.get(dataKey, { type: "json" });
    if (!userData) {
      userData = {
        email: userEmail,
        preferences: {},
        createdAt: new Date().toISOString(),
      };
    }

    // Update location preferences
    if (!userData.preferences) {
      userData.preferences = {};
    }

    userData.preferences.location = {
      ...userData.preferences.location,
      ...locationData,
      lastUpdated: new Date().toISOString(),
    };

    userData.updatedAt = new Date().toISOString();

    await store.set(dataKey, JSON.stringify(userData));
    return true;
  } catch (error) {
    console.error('[Location Alert] Error saving preferences:', error);
    return false;
  }
}

/**
 * Send location-based alert email
 */
async function sendLocationAlert(userEmail, userName, event, eventType, distance) {
  if (!process.env.RESEND_API_KEY) {
    console.log('[Location Alert] RESEND_API_KEY not configured, skipping email');
    return { success: false, error: 'Email not configured' };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Noteworthy News <richard@noteworthynews.co>';

  // Format distance
  const distanceText = distance < 1 
    ? `${Math.round(distance * 5280)} feet away`
    : distance < 10
    ? `${distance.toFixed(1)} miles away`
    : `${Math.round(distance)} miles away`;

  // Determine severity emoji and color
  let severityEmoji = '⚠️';
  let severityColor = '#ff9800';
  if (event.severity >= 5) {
    severityEmoji = '🚨';
    severityColor = '#d32f2f';
  } else if (event.severity >= 4) {
    severityEmoji = '⚠️';
    severityColor = '#f57c00';
  }

  const subject = `${severityEmoji} ${eventType} near you (${distanceText})`;

  // Format time
  const eventTime = new Date(event.published_at).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
      <div style="background: linear-gradient(135deg, #07152a 0%, #0d1f3a 100%); padding: 30px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 700;">Noteworthy News</h1>
      </div>
      
      <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="font-size: 48px; margin-bottom: 10px;">${severityEmoji}</div>
          <h2 style="color: ${severityColor}; margin: 0; font-size: 22px; font-weight: 700;">${eventType} Near You</h2>
        </div>
        
        <h3 style="color: #07152a; margin-top: 0; font-size: 18px;">Hey ${userName || 'there'},</h3>
        
        <div style="background: #fff3cd; border-left: 4px solid ${severityColor}; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; font-size: 16px; color: #856404;">
            <strong>${event.title || event.summary}</strong><br>
            <span style="font-size: 14px;">${distanceText} from your location</span>
          </p>
        </div>
        
        <p style="font-size: 16px; color: #555;">
          ${event.summary || event.description || 'A new event has been reported near your location.'}
        </p>
        
        <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
          <p style="margin: 5px 0; font-size: 14px; color: #666;">
            <strong>Location:</strong> ${event.location_display || 'Near your area'}<br>
            <strong>Time:</strong> ${eventTime}<br>
            <strong>Distance:</strong> ${distanceText}
          </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://noteworthynews.co/article.html?id=${event.canonical_id || event.id}" 
             style="display: inline-block; background: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
            View Full Details
          </a>
        </div>
        
        <p style="font-size: 14px; color: #888; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          Want to change your location or alert radius? <a href="https://noteworthynews.co/profile.html" style="color: #4A90E2;">Update your preferences</a><br>
          <a href="https://noteworthynews.co/unsubscribe.html?email=${encodeURIComponent(userEmail)}" style="color: #4A90E2;">Unsubscribe from location alerts</a>
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #888; font-size: 12px;">
        <p>Noteworthy News - Fact-Checked Journalism & Media Literacy</p>
        <p><a href="https://noteworthynews.co" style="color: #4A90E2;">noteworthynews.co</a></p>
      </div>
    </body>
    </html>
  `;

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: userEmail,
      subject: subject,
      html: html,
    });

    if (result.error) {
      console.error('[Location Alert] Resend error:', result.error);
      return { success: false, error: result.error };
    }

    console.log(`[Location Alert] Email sent to ${userEmail} for ${eventType} (${distanceText})`);
    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error('[Location Alert] Error sending email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if event should trigger location alert for user
 * Called from event ingestion engines
 */
async function checkAndSendLocationAlert(userEmail, userName, event, eventType) {
  try {
    // Check user email preferences
    const { isEmailEnabled } = require('./lib/emailPreferences');
    const emailEnabled = await isEmailEnabled(userEmail, 'location');
    if (!emailEnabled) {
      return { success: false, reason: 'User disabled location alerts' };
    }

    // Get user's location preferences
    const locationPrefs = await getUserLocationPreferences(userEmail);
    
    if (!locationPrefs || !locationPrefs.enabled) {
      return { success: false, reason: 'Location alerts not enabled' };
    }

    // Check rate limit (max 1 per day per event type)
    const { checkRateLimit } = require('./lib/emailRateLimit');
    const rateLimitKey = `location-${eventType.toLowerCase()}`;
    const rateLimit = await checkRateLimit(userEmail, rateLimitKey, 1);
    if (!rateLimit.allowed) {
      console.log(`[Location Alert] Rate limit exceeded for ${userEmail}: ${rateLimit.reason}`);
      return { success: false, reason: rateLimit.reason };
    }

    // Get user's location
    const userLat = locationPrefs.latitude;
    const userLon = locationPrefs.longitude;
    const radiusMiles = locationPrefs.radiusMiles || 50; // Default 50 miles

    if (!userLat || !userLon) {
      return { success: false, reason: 'User location not set' };
    }

    // Get event location
    const eventLat = event.latitude || event.lat;
    const eventLon = event.longitude || event.lon;

    if (!eventLat || !eventLon) {
      return { success: false, reason: 'Event location not available' };
    }

    // Check if event is within radius
    const distance = calculateDistance(userLat, userLon, eventLat, eventLon);
    
    if (distance > radiusMiles) {
      return { success: false, reason: 'Event outside alert radius' };
    }

    // Check if user wants alerts for this event type
    const alertTypes = locationPrefs.alertTypes || ['all'];
    if (!alertTypes.includes('all') && !alertTypes.includes(eventType.toLowerCase())) {
      return { success: false, reason: 'User not subscribed to this event type' };
    }

    // Send alert
    return await sendLocationAlert(userEmail, userName, event, eventType, distance);
  } catch (error) {
    console.error('[Location Alert] Error checking location alert:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Main handler - can be called as a Netlify function or imported
 */
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod === 'GET') {
    // Get user's location preferences
    const userEmail = event.queryStringParameters?.email;
    if (!userEmail) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'email parameter required' }),
      };
    }

    const prefs = await getUserLocationPreferences(userEmail);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ preferences: prefs }),
    };
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const { userEmail, userName, event: eventData, eventType } = body;

      if (!userEmail || !eventData) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'userEmail and event required' }),
        };
      }

      const result = await checkAndSendLocationAlert(userEmail, userName, eventData, eventType || 'Event');

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: result.success, ...result }),
      };
    } catch (error) {
      console.error('[Location Alert] Error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: error.message }),
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
};

module.exports = {
  checkAndSendLocationAlert,
  sendLocationAlert,
  getUserLocationPreferences,
  saveUserLocationPreferences,
  calculateDistance,
  isEventNearLocation,
};

