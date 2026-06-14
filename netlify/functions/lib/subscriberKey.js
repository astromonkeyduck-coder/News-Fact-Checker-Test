/**
 * Shared subscriber-key helper.
 *
 * A push subscription is identified across the system by a stable key derived
 * from its endpoint URL. This is the single source of truth for that mapping —
 * push-subscribe.js, notification-preferences.js, follow-live-story.js and the
 * live-story notifier all import it so a follower row in Supabase can always be
 * resolved back to its subscription blob in Netlify Blobs.
 *
 * Format: `subscription-<base64(endpoint), alnum-only, first 64 chars>`
 * (kept byte-for-byte compatible with the original inline implementation).
 */

const STORE_NAME = "push-subscriptions";

/**
 * Derive the stable subscriber key from a subscription endpoint URL.
 * @param {string} endpoint
 * @returns {string|null} key, or null if the endpoint is missing/invalid
 */
function getSubscriberKey(endpoint) {
  if (!endpoint || typeof endpoint !== "string") return null;
  const hash = Buffer.from(endpoint)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 64);
  if (!hash) return null;
  return `subscription-${hash}`;
}

/**
 * Convenience: derive the key from a PushSubscription-like object.
 * @param {{ endpoint?: string }} subscription
 * @returns {string|null}
 */
function getSubscriberKeyFromSubscription(subscription) {
  if (!subscription || !subscription.endpoint) return null;
  return getSubscriberKey(subscription.endpoint);
}

module.exports = {
  STORE_NAME,
  getSubscriberKey,
  getSubscriberKeyFromSubscription,
};
