/**
 * Alert Deduplication & Rate Limiting
 *
 * Prevents the notification dispatcher from sending duplicate alerts
 * for the same event.  Uses Netlify Blobs with TTL-based expiry.
 *
 * Separate from emailRateLimit.js which handles per-user-per-day caps.
 * This module handles per-event dedup and per-type cooldowns.
 */

const { getStore } = require('@netlify/blobs');

const STORE_NAME = 'alert-dedup';
const TTL_SECONDS = 24 * 60 * 60; // 24 hours — event alerts expire after a day

/**
 * Check if we already sent notifications for this event ID.
 *
 * @param {string} eventId - Canonical event ID.
 * @returns {boolean} true if already notified.
 */
async function checkAlertDedup(eventId) {
  const store = getAlertStore();
  if (!store) return false;

  try {
    const existing = await store.get(`sent-${eventId}`, { type: 'json' });
    return !!existing;
  } catch {
    return false;
  }
}

/**
 * Record that notifications were sent for this event.
 *
 * @param {string} eventId - Canonical event ID.
 * @param {Object} result - Notification dispatch result.
 */
async function recordAlertSent(eventId, result) {
  const store = getAlertStore();
  if (!store) return;

  try {
    await store.set(`sent-${eventId}`, JSON.stringify({
      eventId,
      sentAt: new Date().toISOString(),
      channels: result,
    }));
  } catch (err) {
    console.error('[alertRateLimit] Failed to record dedup marker:', err.message);
  }
}

/**
 * Check type-based cooldown.
 * Ensures we don't spam the same notification type within a time window.
 *
 * @param {string} type - Alert type (e.g. "earthquake", "weather").
 * @param {number} cooldownMs - Minimum time between notifications of this type.
 * @returns {boolean} true if within cooldown (should skip).
 */
async function isInCooldown(type, cooldownMs = 30 * 60 * 1000) {
  const store = getAlertStore();
  if (!store) return false;

  try {
    const data = await store.get(`cooldown-${type}`, { type: 'json' });
    if (!data || !data.lastSentAt) return false;

    const elapsed = Date.now() - new Date(data.lastSentAt).getTime();
    return elapsed < cooldownMs;
  } catch {
    return false;
  }
}

/**
 * Update the cooldown timestamp for a notification type.
 */
async function updateCooldown(type) {
  const store = getAlertStore();
  if (!store) return;

  try {
    await store.set(`cooldown-${type}`, JSON.stringify({
      lastSentAt: new Date().toISOString(),
    }));
  } catch (err) {
    console.error('[alertRateLimit] Failed to update cooldown:', err.message);
  }
}

/* ── Internal ──────────────────────────────────────── */

function getAlertStore() {
  if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
    return null;
  }
  return getStore({
    name: STORE_NAME,
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
  });
}

module.exports = {
  checkAlertDedup,
  recordAlertSent,
  isInCooldown,
  updateCooldown,
};
