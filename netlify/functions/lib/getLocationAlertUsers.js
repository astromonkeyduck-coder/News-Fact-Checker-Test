/**
 * Get All Users with Location Alerts Enabled
 * Returns list of users who have location-based alerts enabled
 * 
 * Note: This is a simplified implementation. For production with many users,
 * you'd want to use a queryable database instead of iterating through all users.
 */

const { getStore } = require("@netlify/blobs");

/**
 * Get all users with location alerts enabled
 * @returns {Array} Array of user objects with location preferences
 */
async function getLocationAlertUsers() {
  if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
    console.warn('[Location Alert Users] Storage not configured');
    return [];
  }

  try {
    const store = getStore({
      name: "user-data",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
    });

    // List all user data keys
    // Note: This lists all keys, which may be slow with many users
    // In production, consider using a database with indexed queries
    const users = [];
    
    try {
      // List all keys in the store (prefix "user-" for user-data keys)
      const { blobs } = await store.list({ prefix: "user-" });

      for (const blob of blobs || []) {
        try {
          // Get user data
          const userData = await store.get(blob.key, { type: "json" });
          
          if (userData && userData.preferences && userData.preferences.location) {
            const locationPrefs = userData.preferences.location;
            
            // Check if location alerts are enabled
            if (locationPrefs.enabled && 
                locationPrefs.latitude && 
                locationPrefs.longitude) {
              
              // Check if email preferences allow location alerts
              const emailPrefs = userData.preferences?.emails;
              if (emailPrefs?.location !== false) {
                users.push({
                  email: userData.email,
                  userName: userData.name || null,
                  location: {
                    latitude: locationPrefs.latitude,
                    longitude: locationPrefs.longitude,
                    radiusMiles: locationPrefs.radiusMiles || 50,
                    alertTypes: locationPrefs.alertTypes || ['all'],
                    city: locationPrefs.city || null,
                  },
                });
              }
            }
          }
        } catch (error) {
          // Skip this user if there's an error
          console.error(`[Location Alert Users] Error processing user ${blob.key}:`, error);
          continue;
        }
      }
    } catch (listError) {
      console.error('[Location Alert Users] Error listing users:', listError);
      return [];
    }

    return users;
  } catch (error) {
    console.error('[Location Alert Users] Error getting location alert users:', error);
    return [];
  }
}

/**
 * Check if event should trigger alerts for any users
 * This is a helper that gets users and checks if event is near them
 * 
 * @param {Object} event - Event object with lat/lon
 * @param {string} eventType - Type of event (weather, earthquake, etc.)
 * @returns {Promise<Array>} Array of users who should receive alerts
 */
async function getUsersNearEvent(event, eventType) {
  const eventLat = event.lat || event.latitude;
  const eventLon = event.lon || event.longitude;

  if (!eventLat || !eventLon) {
    return [];
  }

  const allUsers = await getLocationAlertUsers();
  const { calculateDistance } = require('../send-location-alert');
  const nearbyUsers = [];

  for (const user of allUsers) {
    // Check if user wants this event type
    const alertTypes = user.location.alertTypes || ['all'];
    if (!alertTypes.includes('all') && !alertTypes.includes(eventType.toLowerCase())) {
      continue;
    }

    // Calculate distance
    const distance = calculateDistance(
      user.location.latitude,
      user.location.longitude,
      eventLat,
      eventLon
    );

    // Check if within radius
    if (distance <= user.location.radiusMiles) {
      nearbyUsers.push({
        ...user,
        distance,
      });
    }
  }

  return nearbyUsers;
}

module.exports = {
  getLocationAlertUsers,
  getUsersNearEvent,
};


