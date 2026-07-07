/**
 * X Post → Live Activity (remote push-to-start)
 *
 * When a new Noteworthy X post lands (webhook / import / manual fetch), remote-
 * start a Live Activity on every paired iOS device that has a push-to-start
 * token (iOS 17.2+). Each post gets its own short-lived activity; any still-
 * running activity from a prior X post is ended first so users don't stack
 * dozens of Lock Screen cards.
 *
 * Requires the same APNS_* env vars as liveActivityNotify. Fail-soft: never
 * blocks ingestion. Tap opens the native article via attributes.contentPostId
 * (noteworthylive://post/<id>).
 */

const apns = require("./apnsClient");
const { contentState } = require("./liveActivityNotify");
const { AUTO_X_POST_CATEGORY } = require("./liveStoryCategories");

let supabase = null;
function getSupabase() {
  if (!supabase) supabase = require("./supabaseClient");
  return supabase;
}

const ATTRIBUTES_TYPE = "LiveStoryAttributes";
const STALE_AFTER_MS = 30 * 60 * 1000;
const DISMISS_AFTER_MS = 2 * 60 * 60 * 1000; // X posts are ephemeral - dismiss after 2h
const HEADLINE_MAX = 140;

function truncate(s, n) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
}

function headlineFromPost(post) {
  return truncate(
    post.text || post.story || post.bodyText || post.title || post.clean_title || "",
    HEADLINE_MAX
  );
}

function titleFromPost(post) {
  const t = post.title || post.clean_title;
  if (t) return truncate(t, 120);
  return truncate(post.text || post.story || "Noteworthy", 120) || "Noteworthy";
}

function slugFromPost(post) {
  // Always use an internal slug so auto rows never collide with manually
  // created live stories that may share the post's public URL slug.
  if (post.id) return `x-${post.id}`;
  return `x-${Date.now()}`;
}

/**
 * Upsert a lightweight live_stories row so activity-start token registration
 * works and we can track/end X-post activities in live_activity_tokens.
 * Rows are archived and tagged category X so they never surface in Developing Now.
 */
async function ensureLiveStoryForPost(sb, post) {
  const slug = slugFromPost(post);
  const title = titleFromPost(post);
  const now = new Date().toISOString();

  const { data, error } = await sb
    .from("live_stories")
    .upsert(
      {
        slug,
        title,
        status: "breaking",
        category: AUTO_X_POST_CATEGORY,
        archived: true,
        severity: 4,
        confidence: "medium",
        last_update_at: now,
        updated_at: now,
      },
      { onConflict: "slug" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/**
 * End every still-active Live Activity tied to a prior X post (category X).
 */
async function endPriorXPostActivities(sb, logger) {
  const { data: xStories, error: sErr } = await sb
    .from("live_stories")
    .select("id")
    .eq("category", AUTO_X_POST_CATEGORY);
  if (sErr) throw sErr;
  const storyIds = (xStories || []).map((s) => s.id);
  if (!storyIds.length) return { ended: 0 };

  const { data: activities, error: aErr } = await sb
    .from("live_activity_tokens")
    .select("id, activity_push_token, live_story_devices(apns_environment)")
    .in("story_id", storyIds)
    .eq("status", "active");
  if (aErr) throw aErr;
  if (!activities || !activities.length) return { ended: 0 };

  const now = Date.now();
  const cs = {
    status: "resolved",
    headline: "Updated - see the latest post in Noteworthy.",
    severity: 3,
    confidence: "medium",
    updatedAt: Math.floor(now / 1000),
    isFinal: true,
  };

  const items = activities.map((a) => ({
    deviceToken: a.activity_push_token,
    environment: (a.live_story_devices && a.live_story_devices.apns_environment) || apns.defaultEnvironment(),
    priority: 5,
    payload: {
      aps: {
        timestamp: Math.floor(now / 1000),
        event: "end",
        "content-state": cs,
        "dismissal-date": Math.floor((now + 60 * 1000) / 1000),
      },
    },
  }));

  let ended = 0;
  try {
    const results = await apns.sendLiveActivityBatch(items);
    const endedIds = [];
    results.forEach((r, i) => {
      if (r.ok) {
        ended++;
        endedIds.push(activities[i].id);
      }
    });
    if (endedIds.length) {
      await sb.from("live_activity_tokens").update({ status: "ended" }).in("id", endedIds);
    }
  } catch (err) {
    logger.warn("[xPostLiveActivity] end prior activities failed:", err.message);
  }
  return { ended };
}

/**
 * All paired devices with a push-to-start token, minus those already running
 * an activity for this exact story.
 */
async function findGlobalPushToStartTargets(sb, storyId) {
  const { data: devices, error: dErr } = await sb
    .from("live_story_devices")
    .select("id, push_to_start_token, apns_environment")
    .not("subscriber_key", "is", null)
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

/**
 * Remote-start (or refresh) a Live Activity for a newly ingested X post.
 *
 * @param {Object} args
 * @param {Object} args.post  { id, slug?, title?, text?, story?, bodyText? }
 * @param {Console} [args.logger]
 * @param {boolean} [args.dryRun]
 */
async function notifyXPostLiveActivity({ post, logger = console, dryRun = false } = {}) {
  const out = { configured: false, started: 0, ended: 0, failed: 0 };
  if (!post || !post.id) return { ...out, reason: "missing post id" };

  if (process.env.X_LIVE_ACTIVITY_ENABLED === "false") {
    return { ...out, reason: "disabled" };
  }

  if (!apns.isConfigured()) {
    logger.warn("[xPostLiveActivity] APNs not configured - skipping");
    return { ...out, reason: "apns not configured" };
  }
  out.configured = true;

  const sb = getSupabase();
  let story;
  try {
    story = await ensureLiveStoryForPost(sb, post);
  } catch (err) {
    logger.error("[xPostLiveActivity] ensure story failed:", err.message);
    return { ...out, reason: err.message };
  }

  try {
    const prior = await endPriorXPostActivities(sb, logger);
    out.ended = prior.ended;
  } catch (err) {
    logger.warn("[xPostLiveActivity] end prior skipped:", err.message);
  }

  const headline = headlineFromPost(post);
  const syntheticUpdate = {
    body: headline,
    alert_level: "urgent",
    status_at_time: "breaking",
  };
  const cs = contentState(story, syntheticUpdate, "breaking", false);
  const now = Date.now();

  let targets = [];
  try {
    targets = await findGlobalPushToStartTargets(sb, story.id);
  } catch (err) {
    logger.error("[xPostLiveActivity] target lookup failed:", err.message);
    return { ...out, reason: err.message };
  }

  if (!targets.length) {
    logger.log(`[xPostLiveActivity] post=${post.id} no push-to-start targets`);
    return { ...out, reason: "no eligible devices" };
  }

  if (dryRun) return { ...out, reason: "dryRun", started: targets.length };

  const items = targets.map((d) => ({
    deviceToken: d.push_to_start_token,
    environment: d.apns_environment || apns.defaultEnvironment(),
    priority: 10,
    payload: {
      aps: {
        timestamp: Math.floor(now / 1000),
        event: "start",
        "attributes-type": ATTRIBUTES_TYPE,
        attributes: {
          storySlug: story.slug,
          storyId: String(post.id),
          title: story.title,
          category: AUTO_X_POST_CATEGORY,
          contentPostId: String(post.id),
        },
        "content-state": cs,
        "relevance-score": 85,
        "stale-date": Math.floor((now + STALE_AFTER_MS) / 1000),
        alert: { title: "Noteworthy", body: headline },
      },
    },
  }));

  let results = [];
  try {
    results = await apns.sendLiveActivityBatch(items);
  } catch (err) {
    logger.error("[xPostLiveActivity] APNs send failed:", err.message);
    return { ...out, failed: targets.length, reason: err.message };
  }

  results.forEach((r) => {
    if (r.ok) out.started++;
    else {
      out.failed++;
      logger.warn(`[xPostLiveActivity] start failed: ${r.status} ${r.reason || ""}`);
    }
  });

  logger.log(
    `[xPostLiveActivity] post=${post.id} slug=${story.slug} started=${out.started} ended=${out.ended} failed=${out.failed}`
  );
  return out;
}

module.exports = { notifyXPostLiveActivity, ensureLiveStoryForPost };
