/**
 * Device Register — iOS companion APNs token + Live Activity lifecycle
 *
 * All requests authenticate with { deviceUuid, deviceSecret } (issued at pairing).
 *
 * POST { ..., action: "heartbeat", apnsEnvironment?, appVersion?, locale?, apnsToken? }
 *   refresh last_seen_at and optional device metadata (incl. standard-push token).
 *
 * POST { ..., action: "apns-token", apnsToken }
 *   store/refresh the standard APNs alert device token (Milestone 2C).
 *
 * POST { ..., action: "preferences", preferences:{...} }
 *   store/refresh server-side notification preferences (Milestone 2C).
 *
 * POST { ..., action: "push-to-start", pushToStartToken }
 *   store/refresh the iOS 17.2+ push-to-start token (LiveStoryAttributes).
 *
 * POST { ..., action: "activity-start", storySlug, activityPushToken }
 *   a Live Activity began on-device → store its per-activity update token.
 *
 * POST { ..., action: "activity-end", storySlug }
 *   a Live Activity ended on-device → mark token ended.
 */

const supabase = require("./lib/supabaseClient");
const { corsHeaders, optionsResponse } = require("./lib/corsHeaders");
const { authenticateDevice } = require("./lib/deviceAuth");
const { createRateLimiter } = require("./rate-limit");

// Per-IP throttle. Legitimate traffic is a heartbeat + occasional token/pref
// sync; 60/min leaves ample headroom while bounding abuse of the device-auth'd
// endpoint.
const limiter = createRateLimiter({
  maxRequests: 60,
  windowMs: 60 * 1000,
  message: "Too many device requests. Please slow down.",
});

exports.handler = limiter(async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse;
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const body = JSON.parse(event.body || "{}");
    const device = await authenticateDevice(supabase, body.deviceUuid, body.deviceSecret);
    if (!device) return json(401, { error: "Device authentication failed" });

    // Always bump last_seen and accept metadata updates.
    const meta = { last_seen_at: new Date().toISOString() };
    if (body.apnsEnvironment === "sandbox" || body.apnsEnvironment === "production") meta.apns_environment = body.apnsEnvironment;
    if (typeof body.appVersion === "string") meta.app_version = body.appVersion;
    if (typeof body.locale === "string") meta.locale = body.locale;
    // Opportunistically capture the standard-push token on any request.
    const tokenPatch = apnsTokenPatch(body.apnsToken);
    Object.assign(meta, tokenPatch);

    switch (body.action) {
      case "heartbeat":
        await supabase.from("live_story_devices").update(meta).eq("id", device.id);
        return json(200, { success: true, pushReady: !!device.apns_token || !!tokenPatch.apns_token, ...linkInfo(device) });

      case "apns-token": {
        const patch = apnsTokenPatch(body.apnsToken);
        if (!patch.apns_token) return json(400, { error: "Missing or invalid apnsToken" });
        await supabase.from("live_story_devices").update({ ...meta, ...patch }).eq("id", device.id);
        return json(200, { success: true, pushReady: true });
      }

      case "preferences": {
        const prefs = sanitizePreferences(body.preferences || body);
        if (!Object.keys(prefs).length) return json(400, { error: "No valid preference fields" });
        prefs.prefs_updated_at = new Date().toISOString();
        await supabase.from("live_story_devices").update({ ...meta, ...prefs }).eq("id", device.id);
        return json(200, { success: true });
      }

      case "push-to-start":
        if (!body.pushToStartToken) return json(400, { error: "Missing pushToStartToken" });
        await supabase
          .from("live_story_devices")
          .update({ ...meta, push_to_start_token: body.pushToStartToken })
          .eq("id", device.id);
        return json(200, { success: true });

      case "activity-start":
        return await activityStart(device, body, meta);

      case "activity-end":
        return await activityEnd(device, body, meta);

      default:
        return json(400, { error: "Invalid or missing action" });
    }
  } catch (err) {
    console.error("[device-register] Error:", err.message);
    return json(500, { error: "Internal server error" });
  }
});

/**
 * Validate an APNs standard-push device token (64+ hex chars). Returns a patch
 * object ({apns_token, apns_token_updated_at}) or {} when absent/invalid.
 */
function apnsTokenPatch(raw) {
  if (typeof raw !== "string") return {};
  const token = raw.trim().toLowerCase();
  if (!/^[0-9a-f]{64,200}$/.test(token)) return {};
  return { apns_token: token, apns_token_updated_at: new Date().toISOString() };
}

/**
 * Whitelist + coerce the 2C notification preference fields. Accepts either a
 * nested `preferences` object or the flat body. Ignores unknown keys.
 */
function sanitizePreferences(src) {
  const out = {};
  const bool = (k, col) => {
    if (typeof src[k] === "boolean") out[col] = src[k];
  };
  bool("masterEnabled", "push_master_enabled");
  bool("breakingEnabled", "push_breaking_enabled");
  bool("liveUpdatesEnabled", "push_live_updates_enabled");
  bool("finalEnabled", "push_final_enabled");
  bool("timeSensitiveEnabled", "push_time_sensitive_enabled");
  bool("quietHoursEnabled", "quiet_hours_enabled");

  const hour = (k, col) => {
    const n = Number(src[k]);
    if (Number.isInteger(n) && n >= 0 && n <= 23) out[col] = n;
  };
  hour("quietHoursStart", "quiet_hours_start");
  hour("quietHoursEnd", "quiet_hours_end");

  const off = Number(src.utcOffsetMinutes);
  if (Number.isInteger(off) && off >= -840 && off <= 840) out.utc_offset_minutes = off;

  return out;
}

async function activityStart(device, body, meta) {
  if (!body.storySlug || !body.activityPushToken) {
    return json(400, { error: "Missing storySlug or activityPushToken" });
  }
  const story = await getStory(body.storySlug);
  if (!story) return json(404, { error: "Story not found" });

  await supabase.from("live_story_devices").update(meta).eq("id", device.id);

  const { error } = await supabase.from("live_activity_tokens").upsert(
    {
      device_id: device.id,
      story_id: story.id,
      activity_push_token: body.activityPushToken,
      status: "active",
    },
    { onConflict: "device_id,story_id" }
  );
  if (error) throw error;

  return json(200, { success: true });
}

async function activityEnd(device, body, meta) {
  if (!body.storySlug) return json(400, { error: "Missing storySlug" });
  const story = await getStory(body.storySlug);
  if (!story) return json(404, { error: "Story not found" });

  await supabase.from("live_story_devices").update(meta).eq("id", device.id);

  await supabase
    .from("live_activity_tokens")
    .update({ status: "ended" })
    .eq("device_id", device.id)
    .eq("story_id", story.id);

  return json(200, { success: true });
}

async function getStory(slug) {
  const { data, error } = await supabase
    .from("live_stories")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Build the linked-profile payload from a device row so the app can refresh /
 * repair its Profile display. Anonymous (browser-only) devices return no profile.
 */
function linkInfo(device) {
  const hasProfile = Boolean(device.auth0_sub);
  return {
    linkType: hasProfile ? "account" : "browser",
    linkedProfile: hasProfile
      ? {
          sub: device.auth0_sub,
          email: device.email || null,
          name: device.name || null,
          pictureUrl: device.picture_url || null,
        }
      : null,
  };
}

function json(statusCode, payload) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(payload) };
}
