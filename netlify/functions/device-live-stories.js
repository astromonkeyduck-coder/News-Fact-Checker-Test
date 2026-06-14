/**
 * Device Live Stories — list + manage follows for a paired iOS device
 *
 * POST (device-authenticated with { deviceUuid, deviceSecret }):
 *   { action: "list" }            → followed stories + latest update (for the app
 *                                    to render and start Live Activities)
 *   { action: "follow", slug }    → follow a story (writes the device's subscriber_key)
 *   { action: "unfollow", slug }  → unfollow
 *
 * Uses POST (not GET query params) so the device secret is never placed in a URL,
 * per the repo's no-query-string-auth rule.
 */

const supabase = require("./lib/supabaseClient");
const { corsHeaders, optionsResponse } = require("./lib/corsHeaders");
const { authenticateDevice } = require("./lib/deviceAuth");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse;
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const body = JSON.parse(event.body || "{}");
    const device = await authenticateDevice(supabase, body.deviceUuid, body.deviceSecret);
    if (!device) return json(401, { error: "Device authentication failed" });

    if (!device.subscriber_key) {
      // Paired devices always have a subscriber_key; guard anyway.
      return json(409, { error: "Device is not linked to a subscriber" });
    }

    if (body.action === "list" || !body.action) return await listFollows(device);
    if (body.action === "follow") return await follow(device, body.slug);
    if (body.action === "unfollow") return await unfollow(device, body.slug);
    return json(400, { error: "Invalid action" });
  } catch (err) {
    console.error("[device-live-stories] Error:", err.message);
    return json(500, { error: "Internal server error" });
  }
};

async function listFollows(device) {
  const { data, error } = await supabase
    .from("live_story_follows")
    .select("live_stories(id, slug, title, summary, status, severity, confidence, category, archived, last_update_at)")
    .eq("subscriber_key", device.subscriber_key)
    .eq("muted", false);
  if (error) throw error;

  const stories = (data || [])
    .map((r) => r.live_stories)
    .filter((s) => s && !s.archived);

  // Attach the latest update headline per story so the app can seed a
  // Live Activity ContentState without an extra round-trip.
  const ids = stories.map((s) => s.id);
  let latestByStory = {};
  if (ids.length) {
    const { data: updates } = await supabase
      .from("live_story_updates")
      .select("story_id, body, status_at_time, created_at")
      .in("story_id", ids)
      .order("created_at", { ascending: false })
      .limit(ids.length * 4);
    (updates || []).forEach((u) => {
      if (!latestByStory[u.story_id]) latestByStory[u.story_id] = u;
    });
  }

  const result = stories.map((s) => ({
    slug: s.slug,
    title: s.title,
    summary: s.summary,
    status: s.status,
    severity: s.severity,
    confidence: s.confidence,
    category: s.category,
    lastUpdateAt: s.last_update_at,
    latestHeadline: latestByStory[s.id] ? latestByStory[s.id].body : (s.summary || ""),
  }));

  return json(200, { stories: result });
}

async function follow(device, slug) {
  if (!slug) return json(400, { error: "Missing slug" });
  const story = await getStory(slug);
  if (!story) return json(404, { error: "Story not found" });

  const { error } = await supabase.from("live_story_follows").upsert(
    { story_id: story.id, subscriber_key: device.subscriber_key, muted: false },
    { onConflict: "story_id,subscriber_key" }
  );
  if (error) throw error;
  return json(200, { success: true, following: true, slug });
}

async function unfollow(device, slug) {
  if (!slug) return json(400, { error: "Missing slug" });
  const story = await getStory(slug);
  if (!story) return json(404, { error: "Story not found" });

  const { error } = await supabase
    .from("live_story_follows")
    .delete()
    .eq("story_id", story.id)
    .eq("subscriber_key", device.subscriber_key);
  if (error) throw error;
  return json(200, { success: true, following: false, slug });
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

function json(statusCode, payload) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(payload) };
}
