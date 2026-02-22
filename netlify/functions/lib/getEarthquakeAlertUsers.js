/**
 * Get All Users with Earthquake Alerts Enabled
 * Returns list of users who have opted in to earthquake email alerts
 * with their magnitude threshold (4, 5, 6, or 7 = 4.0+, 5.0+, 6.0+, 7.0+)
 */

const { getStore } = require("@netlify/blobs");

/**
 * Get all users with earthquake alerts enabled
 * @returns {Array<{email: string, userName?: string, earthquakeMagnitudeMin: number}>}
 */
async function getEarthquakeAlertUsers() {
  if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
    console.warn('[Earthquake Alert Users] Storage not configured');
    return [];
  }

  try {
    const store = getStore({
      name: "user-data",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
    });

    const users = [];

    try {
      const list = await store.list();

      for await (const entry of list) {
        try {
          const userData = await store.get(entry.key, { type: "json" });

          if (!userData || !userData.preferences?.emails) continue;

          const emailPrefs = userData.preferences.emails;

          // Must have explicitly opted in (earthquakeAlerts === true)
          if (emailPrefs.earthquakeAlerts !== true) continue;

          // Need a valid email
          const email = userData.email;
          if (!email || typeof email !== "string" || !email.includes("@")) continue;

          // earthquakeMagnitudeMin: 4|5|6|7 (default 6)
          const minMag = [4, 5, 6, 7].includes(Number(emailPrefs.earthquakeMagnitudeMin))
            ? Number(emailPrefs.earthquakeMagnitudeMin)
            : 6;

          users.push({
            email: email.toLowerCase().trim(),
            userName: userData.name || null,
            earthquakeMagnitudeMin: minMag,
          });
        } catch (error) {
          console.warn(`[Earthquake Alert Users] Error processing ${blob.key}:`, error.message);
          continue;
        }
      }
    } catch (listError) {
      console.error("[Earthquake Alert Users] Error listing users:", listError);
      return [];
    }

    return users;
  } catch (error) {
    console.error("[Earthquake Alert Users] Error:", error);
    return [];
  }
}

/**
 * Get emails that should receive an earthquake alert for a given magnitude
 * @param {number} magnitude - Earthquake magnitude
 * @returns {Promise<string[]>} Array of email addresses
 */
async function getEarthquakeAlertRecipients(magnitude) {
  const users = await getEarthquakeAlertUsers();
  const mag = parseFloat(magnitude) || 0;

  return users
    .filter((u) => mag >= u.earthquakeMagnitudeMin)
    .map((u) => u.email);
}

module.exports = {
  getEarthquakeAlertUsers,
  getEarthquakeAlertRecipients,
};
