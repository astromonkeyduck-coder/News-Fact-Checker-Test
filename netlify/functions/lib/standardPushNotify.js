/**
 * Standard Push Notifier (iOS, Milestone 2C)
 *
 * Sends a live-story update as a standard APNs alert notification to the native
 * iOS app, in parallel with web push (lib/liveStoryNotify.js) and Live
 * Activities (lib/liveActivityNotify.js). It:
 *   1. targets devices that FOLLOW the story (via subscriber_key) and have a
 *      registered standard-push apns_token,
 *   2. honors each device's server-synced notification preferences and quiet
 *      hours,
 *   3. builds a rich alert payload (thread-id, category, deep link, optional
 *      image for the Notification Service Extension), and
 *   4. cleans up dead tokens and writes an audit row.
 *
 * Fails soft: when APNs is not configured this is a no-op so the web/Live
 * Activity paths are never blocked. This module never touches Live Activity
 * tokens or the 2A/2B push-to-start path.
 */

const apns = require("./apnsClient");

let supabase = null;
function getSupabase() {
  if (!supabase) supabase = require("./supabaseClient");
  return supabase;
}

const HEADLINE_MAX = 160;
const TERMINAL_STATUS = new Set(["resolved", "false_report"]);
const AUDIT_CHANNEL = "ios_standard_push";

const STATUS_LABEL = {
  breaking: "Breaking",
  developing: "Developing",
  verified: "Verified",
  disputed: "Disputed",
  resolved: "Resolved",
  false_report: "Correction",
};

function truncate(s, n) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
}

function safeHttpsUrl(u) {
  if (typeof u !== "string" || !u) return null;
  try {
    const parsed = new URL(u.trim());
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch (_) {
    return null;
  }
}

/**
 * Whether `hour` (0-23) falls inside a quiet-hours window [start, end).
 * A window where start > end wraps past midnight (e.g. 22 → 7). start === end
 * means "no window".
 */
function inQuietWindow(hour, start, end) {
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

/**
 * Device-local hour (0-23) using the device's reported UTC offset (minutes),
 * falling back to server UTC when unknown.
 */
function deviceLocalHour(device, now) {
  const utcMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const offset = Number.isFinite(device.utc_offset_minutes) ? device.utc_offset_minutes : 0;
  const localMin = (((utcMin + offset) % 1440) + 1440) % 1440;
  return Math.floor(localMin / 60);
}

/**
 * Dispatch a story update as a standard push to eligible iOS devices.
 *
 * @param {Object} args
 * @param {Object} args.story
 * @param {Object} args.update           may carry { image } for a rich test push
 * @param {Console} [args.logger]
 * @param {boolean} [args.dryRun]
 * @param {boolean} [args.skipDedupe]    used by test path (synthetic update)
 * @returns {Promise<{configured:boolean, sent:number, failed:number, skipped:number, reason?:string, reasons?:Object}>}
 */
async function notifyStandardPush({ story, update, logger = console, dryRun = false, skipDedupe = false } = {}) {
  const out = { configured: false, sent: 0, failed: 0, skipped: 0, reasons: {} };
  const bump = (code) => { out.reasons[code] = (out.reasons[code] || 0) + 1; };

  if (!story || !update) return { ...out, reason: "missing story or update" };

  const level = update.alert_level || "normal";
  // silent = timeline only; badge = no alert banner → no standard push.
  if (level === "silent" || level === "badge") return { ...out, reason: level };

  if (!apns.isConfigured()) {
    logger.warn("[standardPushNotify] APNs not configured - skipping standard push");
    return { ...out, reason: "apns not configured" };
  }
  out.configured = true;

  const sb = getSupabase();

  // Best-effort dedupe: never re-blast the same persisted update.
  if (!skipDedupe && update.id) {
    try {
      const { data: existing } = await sb
        .from("live_story_send_log")
        .select("id")
        .eq("update_id", update.id)
        .eq("actor", AUDIT_CHANNEL)
        .limit(1);
      if (existing && existing.length) {
        logger.log(`[standardPushNotify] update ${update.id} already dispatched - skipping`);
        return { ...out, reason: "already dispatched" };
      }
    } catch (err) {
      logger.warn("[standardPushNotify] dedupe check failed (continuing):", err.message);
    }
  }

  const status = update.status_at_time || story.status || "developing";
  const isFinal = level === "final" || TERMINAL_STATUS.has(status);
  const isBreaking = level === "urgent" || status === "breaking";
  const isUrgentClass = isFinal || isBreaking;

  // Load eligible devices: followers with a registered standard-push token.
  let devices = [];
  try {
    devices = await findStandardPushTargets(sb, story.id);
  } catch (err) {
    logger.error("[standardPushNotify] target lookup failed:", err.message);
    return { ...out, failed: 0, reason: err.message };
  }

  if (!devices.length) {
    logger.log(`[standardPushNotify] story=${story.slug} no eligible devices`);
    await auditDispatch(sb, { story, update, level, out, logger });
    return { ...out, reason: "no eligible devices" };
  }

  const image = safeHttpsUrl(update.image || update.image_url || story.image_url);
  const now = new Date();

  const items = [];
  const itemMeta = [];

  for (const d of devices) {
    // Master switch.
    if (d.push_master_enabled === false) { out.skipped++; bump("master_off"); continue; }

    // Category gate.
    let categoryAllowed;
    if (isFinal) categoryAllowed = d.push_final_enabled !== false;
    else if (isBreaking) categoryAllowed = d.push_breaking_enabled !== false;
    else categoryAllowed = d.push_live_updates_enabled !== false;
    if (!categoryAllowed) { out.skipped++; bump("category_off"); continue; }

    // Quiet hours suppress non-urgent only.
    if (!isUrgentClass && d.quiet_hours_enabled) {
      const h = deviceLocalHour(d, now);
      if (inQuietWindow(h, d.quiet_hours_start ?? 22, d.quiet_hours_end ?? 7)) {
        out.skipped++; bump("quiet_hours"); continue;
      }
    }

    const env = d.apns_environment || apns.defaultEnvironment();
    const timeSensitive = isUrgentClass && d.push_time_sensitive_enabled !== false;
    const payload = buildAlertPayload({ story, update, status, isFinal, isBreaking, timeSensitive, image });

    items.push({
      deviceToken: d.apns_token,
      environment: env,
      priority: isUrgentClass ? 10 : 5,
      collapseId: story.slug,
      payload,
    });
    itemMeta.push({ deviceId: d.id });
  }

  if (!items.length) {
    logger.log(`[standardPushNotify] story=${story.slug} all ${devices.length} devices filtered by prefs`);
    await auditDispatch(sb, { story, update, level, out, logger });
    return { ...out, reason: "all filtered" };
  }

  if (dryRun) {
    return { ...out, reason: "dryRun", sent: items.length };
  }

  let results = [];
  try {
    results = await apns.sendAlertBatch(items);
  } catch (err) {
    logger.error("[standardPushNotify] APNs send failed:", err.message);
    out.failed = items.length;
    await auditDispatch(sb, { story, update, level, out, logger });
    return { ...out, reason: err.message };
  }

  const deadDeviceIds = [];
  results.forEach((r, i) => {
    if (r.ok) {
      out.sent++;
    } else {
      out.failed++;
      const dead =
        r.status === 410 ||
        r.reason === "BadDeviceToken" ||
        r.reason === "Unregistered" ||
        r.reason === "DeviceTokenNotForTopic" ||
        r.reason === "ExpiredToken";
      if (dead) deadDeviceIds.push(itemMeta[i].deviceId);
      logger.warn(`[standardPushNotify] send failed: ${r.status} ${r.reason || ""}`);
    }
  });

  if (deadDeviceIds.length) {
    try {
      await sb
        .from("live_story_devices")
        .update({ apns_token: null, apns_token_updated_at: new Date().toISOString() })
        .in("id", deadDeviceIds);
      logger.log(`[standardPushNotify] cleared ${deadDeviceIds.length} dead token(s)`);
    } catch (err) {
      logger.error("[standardPushNotify] dead-token cleanup failed:", err.message);
    }
  }

  await auditDispatch(sb, { story, update, level, out, logger });

  logger.log(
    `[standardPushNotify] story=${story.slug} level=${level} sent=${out.sent} failed=${out.failed} skipped=${out.skipped}`
  );
  return out;
}

function buildAlertPayload({ story, update, status, isFinal, isBreaking, timeSensitive, image }) {
  const prefix = STATUS_LABEL[status] || "Update";
  const aps = {
    alert: {
      title: isBreaking || isFinal ? `${prefix}: ${story.title}` : story.title,
      body: truncate(update.body, HEADLINE_MAX),
    },
    "thread-id": story.slug,
    category: isBreaking || isFinal ? "BREAKING" : "LIVE_STORY",
    "relevance-score": Math.min(1, ((story.severity || 3) * 20) / 100),
    "interruption-level": timeSensitive ? "time-sensitive" : "active",
  };
  // Urgent/final ring; normal updates stay quiet (banner only).
  if (isBreaking || isFinal) aps.sound = "default";
  if (image) aps["mutable-content"] = 1;

  const payload = {
    aps,
    slug: story.slug,
    storyId: story.id,
    url: `noteworthylive://story/${story.slug}`,
    alertLevel: update.alert_level || "normal",
    status,
  };
  if (image) payload.image = image;
  return payload;
}

/**
 * Devices that follow the story (via subscriber_key) and have a registered
 * standard-push token, deduped by token. Mirrors the join shape of
 * liveActivityNotify.findPushToStartTargets but targets apns_token.
 */
async function findStandardPushTargets(sb, storyId) {
  const { data: follows, error: fErr } = await sb
    .from("live_story_follows")
    .select("subscriber_key")
    .eq("story_id", storyId)
    .eq("muted", false);
  if (fErr) throw fErr;
  const keys = [...new Set((follows || []).map((f) => f.subscriber_key).filter(Boolean))];
  if (!keys.length) return [];

  const { data: devices, error: dErr } = await sb
    .from("live_story_devices")
    .select(
      "id, apns_token, apns_environment, push_master_enabled, push_breaking_enabled, push_live_updates_enabled, push_final_enabled, push_time_sensitive_enabled, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, utc_offset_minutes"
    )
    .in("subscriber_key", keys)
    .not("apns_token", "is", null);
  if (dErr) throw dErr;
  if (!devices || !devices.length) return [];

  // Dedup by token (a device_uuid is unique, but guard against shared tokens).
  const seen = new Set();
  return devices.filter((d) => {
    if (!d.apns_token || seen.has(d.apns_token)) return false;
    seen.add(d.apns_token);
    return true;
  });
}

/**
 * Record a standard-push dispatch in the shared live_story_send_log.
 * detail.channel = "ios_standard_push" distinguishes it from web push
 * (notifyFollowers) and Live Activity rows. Fail-soft.
 */
async function auditDispatch(sb, { story, update, level, out, logger }) {
  try {
    await sb.from("live_story_send_log").insert({
      story_id: story.id || null,
      update_id: update.id || null,
      alert_level: level,
      recipients: out.sent + out.failed + out.skipped,
      sent: out.sent,
      failed: out.failed,
      skipped: out.skipped,
      actor: AUDIT_CHANNEL,
      detail: {
        channel: AUDIT_CHANNEL,
        sent: out.sent,
        failed: out.failed,
        skipped: out.skipped,
        reasons: out.reasons,
        reason: out.reason || null,
      },
    });
  } catch (err) {
    logger.warn("[standardPushNotify] audit log skipped:", err.message);
  }
}

module.exports = {
  notifyStandardPush,
  // exported for tests
  inQuietWindow,
  deviceLocalHour,
  buildAlertPayload,
  safeHttpsUrl,
};
