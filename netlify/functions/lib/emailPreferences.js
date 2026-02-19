/**
 * Email Preferences Helper
 * Centralized functions to check and manage user email preferences
 */

const { getStore } = require("@netlify/blobs");

/**
 * Get user email preferences
 */
async function getUserEmailPreferences(userEmail) {
  if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
    // Default to all enabled if storage not available
    return {
      leaderboard: true,
      streak: true,
      location: false,
      earthquakeAlerts: false,
      earthquakeMagnitudeMin: 6,
    };
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
    
    if (!userData || !userData.preferences || !userData.preferences.emails) {
      // Return defaults
      return {
        leaderboard: true,
        streak: true,
        location: false,
        earthquakeAlerts: false,
        earthquakeMagnitudeMin: 6,
      };
    }

    return {
      leaderboard: userData.preferences.emails.leaderboard !== false, // Default true
      streak: userData.preferences.emails.streak !== false, // Default true
      location: userData.preferences.emails.location === true, // Default false (must opt-in)
      earthquakeAlerts: userData.preferences.emails.earthquakeAlerts === true, // Default false (must opt-in)
      earthquakeMagnitudeMin: userData.preferences.emails.earthquakeMagnitudeMin ?? 6, // Default 6.0+
    };
  } catch (error) {
    console.error('[Email Preferences] Error getting preferences:', error);
    // Return defaults on error
    return {
      leaderboard: true,
      streak: true,
      location: false,
      earthquakeAlerts: false,
      earthquakeMagnitudeMin: 6,
    };
  }
}

/**
 * Check if user has email type enabled
 */
async function isEmailEnabled(userEmail, emailType) {
  const prefs = await getUserEmailPreferences(userEmail);
  return prefs[emailType] === true;
}

/**
 * Update user email preferences
 */
async function updateEmailPreferences(userEmail, emailPreferences) {
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

    // Initialize preferences if needed
    if (!userData.preferences) {
      userData.preferences = {};
    }
    if (!userData.preferences.emails) {
      userData.preferences.emails = {
        leaderboard: true,
        streak: true,
        location: false,
        earthquakeAlerts: false,
        earthquakeMagnitudeMin: 6,
      };
    }

    // Update email preferences (earthquakeMagnitudeMin: 4|5|6|7 for 4.0+, 5.0+, 6.0+, 7.0+)
    userData.preferences.emails = {
      ...userData.preferences.emails,
      ...emailPreferences,
    };

    userData.updatedAt = new Date().toISOString();

    await store.set(dataKey, JSON.stringify(userData));
    return true;
  } catch (error) {
    console.error('[Email Preferences] Error updating preferences:', error);
    return false;
  }
}

module.exports = {
  getUserEmailPreferences,
  isEmailEnabled,
  updateEmailPreferences,
};


