/**
 * Live Activity Notifier
 *
 * Pushes a live-story update to native iOS ActivityKit Live Activities, in
 * parallel with the web-push path (lib/liveStoryNotify.js). It:
 *   1. updates (or ends) every running Live Activity for the story, and
 *   2. on iOS 17.2+ remote-starts Live Activities for linked devices that
 *      follow the story but don't have one running yet (push-to-start).
 *
 * Fails soft: when APNs is not configured, this is a no-op so the web path is
 * never blocked. ContentState/attributes here MUST match the Swift
 * LiveStoryAttributes in ios/NoteworthyLive.
 */

const apns = require("./apnsClient");

let supabase = null;
function getSupabase() {
  if (!supabase) supabase = require("./supabaseClient");
  return supabase;
}

const ATTRIBUTES_TYPE = "LiveStoryAttributes";
const HEADLINE_MAX = 140;
const STALE_AFTER_MS = 30 * 60 * 1000; // content goes stale after 30 min
const DISMISS_AFTER_MS = 4 * 60 * 60 * 1000; // ended activity auto-dismisses after 4h

const STATUS_LABEL = {
  breaking: "BREAKING",
  developing: "Developing",
  verified: "Verified",
  disputed: "Disputed",
  resolved: "Resolved",
  false_report: "False report",
};

function truncate(s, n) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
}

function contentState(story, update, status, isFinal) {
  const cs = {
    status,
    headline: truncate(update.body, HEADLINE_MAX),
    severity: story.severity || 3,
    confidence: story.confidence || "medium",
    updatedAt: Math.floor(Date.now() / 1000),
    isFinal: !!isFinal,
  };
  // Matches the optional Swift `ContentState.updateCount`. Populate when the
  // caller knows the timeline length so the Live Activity can show "N updates".
  const count = story.update_count ?? story.updateCount;
  if (Number.isFinite(count)) cs.updateCount = count;
  return cs;
}

function alertBlock(story, update, status) {
  const prefix = STATUS_LABEL[status] || "Update";
  return {
    title: `${prefix}: ${story.title}`,
    body: truncate(update.body, HEADLINE_MAX),
  };
}

/**
 * Dispatch a story update to all relevant Live Activities.
 *
 * @param {Object} args
 * @param {Object} args.story
 * @param {Object} args.update
 * @param {Console} [args.logger]
 * @param {boolean} [args.dryRun]
 * @returns {Promise<{configured:boolean, updated:number, started:number, ended:number, failed:number, reason?:string}>}
 */
async function notifyLiveActivities({ story, update, logger = console, dryRun = false } = {}) {
  const out = { configured: false, updated: 0, started: 0, ended: 0, failed: 0 };
  if (!story || !update) return { ...out, reason: "missing story or update" };

  const level = update.alert_level || "normal";
  if (level === "silent") return { ...out, reason: "silent" }; // timeline only

  if (!apns.isConfigured()) return { ...out, reason: "apns not configured" };
  out.configured = true;

  const status = update.status_at_time || story.status || "developing";
  const isFinal = level === "final";
  const withAlert = level === "urgent" || level === "final";
  const priority = withAlert ? 10 : 5;
  const now = Date.now();
  const cs = contentState(story, update, status, isFinal);

  const sb = getSupabase();

  // 1) Existing running activities → update or end.
  let activities = [];
  try {
    const { data, error } = await sb
      .from("live_activity_tokens")
      .select("id, activity_push_token, live_story_devices(apns_environment)")
      .eq("story_id", story.id)
      .eq("status", "active");
    if (error) throw error;
    activities = data || [];
  } catch (err) {
    logger.error("[liveActivityNotify] load activities failed:", err.message);
  }

  const items = [];
  const itemMeta = [];

  activities.forEach((a) => {
    const env = (a.live_story_devices && a.live_story_devices.apns_environment) || apns.defaultEnvironment();
    const aps = {
      timestamp: Math.floor(now / 1000),
      event: isFinal ? "end" : "update",
      "content-state": cs,
      "relevance-score": Math.min(100, (story.severity || 3) * 20),
    };
    if (!isFinal) aps["stale-date"] = Math.floor((now + STALE_AFTER_MS) / 1000);
    if (isFinal) aps["dismissal-date"] = Math.floor((now + DISMISS_AFTER_MS) / 1000);
    if (withAlert) aps.alert = alertBlock(story, update, status);

    items.push({ deviceToken: a.activity_push_token, environment: env, priority, payload: { aps } });
    itemMeta.push({ kind: isFinal ? "end" : "update", activityId: a.id });
  });

  // 2) Push-to-start (iOS 17.2+) for followers without a running activity.
  //    Skip on final updates — no point starting an activity just to end it.
  if (!isFinal) {
    try {
      const startTargets = await findPushToStartTargets(sb, story.id);
      startTargets.forEach((d) => {
        const env = d.apns_environment || apns.defaultEnvironment();
        const aps = {
          timestamp: Math.floor(now / 1000),
          event: "start",
          "attributes-type": ATTRIBUTES_TYPE,
          attributes: {
            storySlug: story.slug,
            storyId: story.id,
            title: story.title,
            category: story.category || "",
          },
          "content-state": cs,
          "relevance-score": Math.min(100, (story.severity || 3) * 20),
          "stale-date": Math.floor((now + STALE_AFTER_MS) / 1000),
        };
        if (withAlert) aps.alert = alertBlock(story, update, status);
        items.push({ deviceToken: d.push_to_start_token, environment: env, priority, payload: { aps } });
        itemMeta.push({ kind: "start", deviceId: d.id });
      });
    } catch (err) {
      logger.error("[liveActivityNotify] push-to-start lookup failed:", err.message);
    }
  }

  if (!items.length) return out;
  if (dryRun) return { ...out, reason: "dryRun", updated: items.length };

  let results = [];
  try {
    results = await apns.sendLiveActivityBatch(items);
  } catch (err) {
    logger.error("[liveActivityNotify] APNs send failed:", err.message);
    return { ...out, failed: items.length, reason: err.message };
  }

  const endedActivityIds = [];
  const staleActivityIds = [];
  const clearPtsDeviceIds = [];

  results.forEach((r, i) => {
    const meta = itemMeta[i];
    if (r.ok) {
      if (meta.kind === "update") out.updated++;
      else if (meta.kind === "end") { out.ended++; endedActivityIds.push(meta.activityId); }
      else if (meta.kind === "start") out.started++;
    } else {
      out.failed++;
      const dead = r.status === 410 || r.reason === "BadDeviceToken" || r.reason === "Unregistered" || r.reason === "ExpiredToken";
      if (dead && meta.activityId) staleActivityIds.push(meta.activityId);
      if (dead && meta.deviceId) clearPtsDeviceIds.push(meta.deviceId);
      logger.warn(`[liveActivityNotify] ${meta.kind} failed: ${r.status} ${r.reason || ""}`);
    }
  });

  await applyTokenStateChanges(sb, { endedActivityIds, staleActivityIds, clearPtsDeviceIds, logger });

  logger.log(
    `[liveActivityNotify] story=${story.slug} level=${level} updated=${out.updated} started=${out.started} ended=${out.ended} failed=${out.failed}`
  );
  return out;
}

/**
 * Devices that follow the story (via subscriber_key), have a push-to-start
 * token, and have no active Live Activity for the story.
 */
async function findPushToStartTargets(sb, storyId) {
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
    .select("id, push_to_start_token, apns_environment")
    .in("subscriber_key", keys)
    .not("push_to_start_token", "is", null);
  if (dErr) throw dErr;
  if (!devices || !devices.length) return [];

  const { data: active, error: aErr } = await sb
    .from("live_activity_tokens")
    .select("device_id")
    .eq("story_id", storyId)
    .eq("status", "active");
  if (aErr) throw aErr;
  const activeSet = new Set((active || []).map((a) => a.device_id));

  return devices.filter((d) => !activeSet.has(d.id));
}

async function applyTokenStateChanges(sb, { endedActivityIds, staleActivityIds, clearPtsDeviceIds, logger }) {
  try {
    if (endedActivityIds.length) {
      await sb.from("live_activity_tokens").update({ status: "ended" }).in("id", endedActivityIds);
    }
    if (staleActivityIds.length) {
      await sb.from("live_activity_tokens").update({ status: "stale" }).in("id", staleActivityIds);
    }
    if (clearPtsDeviceIds.length) {
      await sb.from("live_story_devices").update({ push_to_start_token: null }).in("id", clearPtsDeviceIds);
    }
  } catch (err) {
    logger.error("[liveActivityNotify] token state update failed:", err.message);
  }
}

module.exports = { notifyLiveActivities, contentState };
