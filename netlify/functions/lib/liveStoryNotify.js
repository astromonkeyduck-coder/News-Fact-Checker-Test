/**
 * Live Story Notifier
 *
 * Targeted web-push delivery for the Follow Live Story feature.
 *
 * Unlike send-push-notification.js (which broadcasts by preference type), this
 * sends only to the followers of a specific story. It reuses the same Netlify
 * Blobs subscription store and web-push/VAPID config, then records an audit row
 * in Supabase (live_story_send_log).
 *
 * Alert-level behavior (honest about web platform limits):
 *   silent  → no push at all (timeline-only update)
 *   badge   → quiet notification (silent:true); SW bumps the app badge
 *   normal  → standard visible notification
 *   urgent  → requireInteraction + renotify + strong vibrate; bypasses cooldown
 *   final   → same as urgent, marks the story closed; bypasses cooldown
 */

const webpush = require("web-push");
const { getStore } = require("@netlify/blobs");
const { STORE_NAME } = require("./subscriberKey");
const { isInCooldown, updateCooldown } = require("./alertRateLimit");

let supabase = null;
function getSupabase() {
  if (supabase) return supabase;
  // Lazy-require so functions that never notify don't fail on missing creds.
  supabase = require("./supabaseClient");
  return supabase;
}

const STORY_URL_BASE = "/story/";
const ICON = "/IMG_5794.PNG";

// Non-urgent updates for the same story are throttled to avoid spam.
const STORY_COOLDOWN_MS = 60 * 1000;

function configureWebPush() {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:richard@noteworthynews.co";
  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error("VAPID keys not configured");
  }
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

function getSubStore() {
  if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
    return null;
  }
  return getStore({
    name: STORE_NAME,
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
  });
}

const STATUS_LABEL = {
  breaking: "BREAKING",
  developing: "Developing",
  verified: "Verified",
  disputed: "Disputed",
  resolved: "Resolved",
  false_report: "False report",
};

/**
 * Build the push payload the service worker expects (type: 'live-story').
 */
function buildPayload(story, update) {
  const level = update.alert_level || "normal";
  const status = update.status_at_time || story.status || "developing";
  const isUrgent = level === "urgent" || level === "final";
  const statusLabel = STATUS_LABEL[status] || "Update";

  const titlePrefix = level === "final" ? "FINAL" : statusLabel;
  const title = `${titlePrefix}: ${story.title}`;

  // Strong vibrate for urgent, gentle for normal, none for badge.
  let vibrate;
  if (level === "badge") vibrate = undefined;
  else if (isUrgent) vibrate = [250, 100, 250, 100, 250];
  else vibrate = [120, 60, 120];

  return {
    type: "live-story",
    title,
    body: update.body,
    url: `${STORY_URL_BASE}${story.slug}`,
    tag: `live-story-${story.id}`, // collapse repeated updates for the same story
    storyId: story.id,
    slug: story.slug,
    status,
    alertLevel: level,
    silent: level === "badge",
    requireInteraction: isUrgent,
    renotify: isUrgent, // re-alert even though the tag matches a prior notification
    vibrate,
    icon: ICON,
    badge: ICON,
    incrementBadge: level !== "silent",
    sourceUrl: update.source_url || story.source_url || null,
  };
}

/**
 * Send a story update to all followers.
 *
 * @param {Object} args
 * @param {Object} args.story  - row from live_stories
 * @param {Object} args.update - row from live_story_updates
 * @param {string} [args.actor] - identity that triggered the send (for audit)
 * @param {Console} [args.logger]
 * @param {boolean} [args.dryRun]
 * @returns {Promise<{recipients:number,sent:number,failed:number,skipped:number,reason?:string}>}
 */
async function notifyFollowers({ story, update, actor = "system", logger = console, dryRun = false } = {}) {
  const level = (update && update.alert_level) || "normal";
  const result = { recipients: 0, sent: 0, failed: 0, skipped: 0 };

  if (!story || !update) {
    return { ...result, reason: "missing story or update" };
  }

  // silent → timeline only, no push.
  if (level === "silent") {
    await recordSendLog({ story, update, actor, result, detail: { reason: "silent" } });
    return { ...result, reason: "silent" };
  }

  const isUrgent = level === "urgent" || level === "final";

  // Throttle non-urgent bursts per story.
  if (!isUrgent) {
    const cooldownKey = `live-story:${story.id}`;
    if (await isInCooldown(cooldownKey, STORY_COOLDOWN_MS)) {
      logger.log(`[liveStoryNotify] Story ${story.id} in cooldown — skipping push`);
      await recordSendLog({ story, update, actor, result, detail: { reason: "cooldown" } });
      return { ...result, reason: "cooldown" };
    }
  }

  const store = getSubStore();
  if (!store) {
    logger.error("[liveStoryNotify] Blob store not configured");
    return { ...result, reason: "store not configured" };
  }

  let followers = [];
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("live_story_follows")
      .select("subscriber_key")
      .eq("story_id", story.id)
      .eq("muted", false);
    if (error) throw error;
    followers = (data || []).map((r) => r.subscriber_key).filter(Boolean);
  } catch (err) {
    logger.error("[liveStoryNotify] Failed to load followers:", err.message);
    return { ...result, reason: "follower lookup failed" };
  }

  result.recipients = followers.length;
  if (followers.length === 0) {
    await recordSendLog({ story, update, actor, result, detail: { reason: "no followers" } });
    return result;
  }

  configureWebPush();
  const payload = JSON.stringify(buildPayload(story, update));

  if (dryRun) {
    result.skipped = followers.length;
    await recordSendLog({ story, update, actor, result, detail: { dryRun: true } });
    return { ...result, reason: "dryRun" };
  }

  const batchSize = 20;
  for (let i = 0; i < followers.length; i += batchSize) {
    const batch = followers.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (key) => {
        let record;
        try {
          record = await store.get(key, { type: "json" });
        } catch {
          record = null;
        }

        if (!record || !record.active || !record.subscription) {
          result.skipped++;
          return;
        }

        // Respect the subscriber's master live-story toggle.
        if (record.preferences && record.preferences["live-story"] === false) {
          result.skipped++;
          return;
        }

        try {
          await webpush.sendNotification(record.subscription, payload, {
            urgency: isUrgent ? "high" : "normal",
          });
          result.sent++;
        } catch (err) {
          result.failed++;
          if (err.statusCode === 410 || err.statusCode === 404) {
            try {
              await store.set(
                key,
                JSON.stringify({ ...record, active: false, staleAt: new Date().toISOString() }),
                { contentType: "application/json" }
              );
            } catch {
              /* ignore */
            }
          } else {
            logger.error(`[liveStoryNotify] send failed (${key.slice(0, 16)}…):`, err.message);
          }
        }
      })
    );
  }

  if (!isUrgent) {
    await updateCooldown(`live-story:${story.id}`);
  }

  await recordSendLog({ story, update, actor, result });
  logger.log(
    `[liveStoryNotify] story=${story.slug} level=${level} recipients=${result.recipients} sent=${result.sent} failed=${result.failed} skipped=${result.skipped}`
  );
  return result;
}

async function recordSendLog({ story, update, actor, result, detail }) {
  try {
    const sb = getSupabase();
    await sb.from("live_story_send_log").insert({
      story_id: story.id,
      update_id: update.id || null,
      alert_level: update.alert_level || "normal",
      recipients: result.recipients,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped,
      actor: actor || "system",
      detail: detail || null,
    });
  } catch (err) {
    console.error("[liveStoryNotify] Failed to write send log:", err.message);
  }
}

module.exports = { notifyFollowers, buildPayload };
