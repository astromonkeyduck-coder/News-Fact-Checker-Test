/**
 * Email Rate Limiting
 * Prevents sending too many emails to the same user
 */

const { getStore } = require("@netlify/blobs");

/**
 * Check if we can send email (rate limiting)
 * @param {string} userEmail - User email
 * @param {string} emailType - Type of email (leaderboard, streak, location)
 * @param {number} maxPerDay - Maximum emails per day (default: 1)
 * @returns {Object} { allowed: boolean, reason?: string }
 */
async function checkRateLimit(userEmail, emailType, maxPerDay = 1) {
  if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
    // If storage not available, allow (graceful degradation)
    return { allowed: true };
  }

  try {
    const store = getStore({
      name: "email-rate-limits",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
    });

    const today = new Date().toISOString().split('T')[0];
    const key = `limit-${userEmail.toLowerCase()}-${emailType}-${today}`;

    // Get current count
    const data = await store.get(key, { type: "json" });
    const count = data?.count || 0;

    if (count >= maxPerDay) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${maxPerDay} ${emailType} email(s) per day`,
        count,
        resetAt: new Date(today + 'T23:59:59Z').toISOString(),
      };
    }

    // Increment count
    const newCount = count + 1;
    const expiresAt = new Date(today + 'T23:59:59Z').getTime();
    const ttl = Math.ceil((expiresAt - Date.now()) / 1000); // TTL in seconds

    await store.set(key, JSON.stringify({
      count: newCount,
      lastSent: new Date().toISOString(),
    }), {
      expiry: ttl > 0 ? ttl : 86400, // At least 24 hours
    });

    return {
      allowed: true,
      count: newCount,
      remaining: maxPerDay - newCount,
    };
  } catch (error) {
    console.error('[Email Rate Limit] Error checking rate limit:', error);
    // On error, allow (graceful degradation)
    return { allowed: true };
  }
}

/**
 * Record that an email was sent (alternative to checkRateLimit if you want to record after sending)
 */
async function recordEmailSent(userEmail, emailType) {
  if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
    return;
  }

  try {
    const store = getStore({
      name: "email-rate-limits",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
    });

    const today = new Date().toISOString().split('T')[0];
    const key = `limit-${userEmail.toLowerCase()}-${emailType}-${today}`;

    const data = await store.get(key, { type: "json" });
    const count = (data?.count || 0) + 1;

    const expiresAt = new Date(today + 'T23:59:59Z').getTime();
    const ttl = Math.ceil((expiresAt - Date.now()) / 1000);

    await store.set(key, JSON.stringify({
      count,
      lastSent: new Date().toISOString(),
    }), {
      expiry: ttl > 0 ? ttl : 86400,
    });
  } catch (error) {
    console.error('[Email Rate Limit] Error recording email:', error);
  }
}

module.exports = {
  checkRateLimit,
  recordEmailSent,
};


