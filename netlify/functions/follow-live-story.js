/**
 * Follow Live Story - public follow/unfollow API
 *
 * POST  { action: "follow"|"unfollow", slug, subscription, userEmail? }
 *   follow   → upserts a live_story_follows row keyed by the push subscriber_key
 *   unfollow → removes that row
 *
 * GET  ?endpoint=<push subscription endpoint>
 *   → { follows: [{ slug, title, status, severity, muted, created_at }] }
 *
 * Anonymous followers are allowed (mirrors the existing push model). A follow is
 * only useful if the subscriber has an active push subscription, so we make sure
 * one exists in the Blobs store (creating a minimal record if needed).
 */

const { getStore } = require("@netlify/blobs");
const supabase = require("./lib/supabaseClient");
const { corsHeaders, optionsResponse } = require("./lib/corsHeaders");
const { STORE_NAME, getSubscriberKey, getSubscriberKeyFromSubscription } = require("./lib/subscriberKey");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse;

  try {
    if (event.httpMethod === "GET") {
      return await listFollows(event.queryStringParameters || {});
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { action } = body;

      if (action === "follow") return await follow(body);
      if (action === "unfollow") return await unfollow(body);

      return json(400, { error: "Invalid or missing action" });
    }

    return json(405, { error: "Method not allowed" });
  } catch (error) {
    console.error("[follow-live-story] Error:", error.message);
    return json(500, { error: "Internal server error" });
  }
};

async function follow(body) {
  const { slug, subscription, userEmail } = body;
  if (!slug) return json(400, { error: "Missing slug" });

  const subscriberKey = getSubscriberKeyFromSubscription(subscription);
  if (!subscriberKey) return json(400, { error: "Missing or invalid subscription" });

  const story = await getStory(slug);
  if (!story) return json(404, { error: "Story not found" });

  // Ensure a push subscription record exists so we can deliver updates.
  await ensureSubscription(subscriberKey, subscription, userEmail);

  const { error } = await supabase
    .from("live_story_follows")
    .upsert(
      {
        story_id: story.id,
        subscriber_key: subscriberKey,
        user_email: userEmail || null,
        muted: false,
      },
      { onConflict: "story_id,subscriber_key" }
    );

  if (error) throw error;

  const followerCount = await refreshFollowerCount(story.id);

  return json(200, {
    success: true,
    following: true,
    slug,
    followerCount,
  });
}

async function unfollow(body) {
  const { slug, subscription } = body;
  if (!slug) return json(400, { error: "Missing slug" });

  const subscriberKey = getSubscriberKeyFromSubscription(subscription);
  if (!subscriberKey) return json(400, { error: "Missing or invalid subscription" });

  const story = await getStory(slug);
  if (!story) return json(404, { error: "Story not found" });

  const { error } = await supabase
    .from("live_story_follows")
    .delete()
    .eq("story_id", story.id)
    .eq("subscriber_key", subscriberKey);

  if (error) throw error;

  const followerCount = await refreshFollowerCount(story.id);

  return json(200, {
    success: true,
    following: false,
    slug,
    followerCount,
  });
}

async function listFollows(params) {
  const endpoint = params.endpoint;
  if (!endpoint) return json(400, { error: "Missing endpoint parameter" });

  const subscriberKey = getSubscriberKey(endpoint);
  if (!subscriberKey) return json(400, { error: "Invalid endpoint" });

  const { data, error } = await supabase
    .from("live_story_follows")
    .select("muted, created_at, live_stories(slug, title, status, severity, archived)")
    .eq("subscriber_key", subscriberKey)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const follows = (data || [])
    .filter((row) => row.live_stories && !row.live_stories.archived)
    .map((row) => ({
      slug: row.live_stories.slug,
      title: row.live_stories.title,
      status: row.live_stories.status,
      severity: row.live_stories.severity,
      muted: row.muted,
      created_at: row.created_at,
    }));

  return json(200, { follows });
}

/* ── helpers ─────────────────────────────────────────── */

async function getStory(slug) {
  const { data, error } = await supabase
    .from("live_stories")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function refreshFollowerCount(storyId) {
  try {
    const { count, error } = await supabase
      .from("live_story_follows")
      .select("id", { count: "exact", head: true })
      .eq("story_id", storyId)
      .eq("muted", false);
    if (error) throw error;
    const followerCount = count || 0;
    await supabase.from("live_stories").update({ follower_count: followerCount }).eq("id", storyId);
    return followerCount;
  } catch (err) {
    console.error("[follow-live-story] follower count refresh failed:", err.message);
    return null;
  }
}

/**
 * Make sure the Blobs push-subscription record exists and is active so the
 * notifier can deliver updates. Does not overwrite existing preferences.
 */
async function ensureSubscription(subscriberKey, subscription, userEmail) {
  if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) return;
  if (!subscription || !subscription.endpoint) return;

  const store = getStore({
    name: STORE_NAME,
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
  });

  try {
    const existing = await store.get(subscriberKey, { type: "json" });
    if (existing) {
      // Re-activate if it had gone stale; keep existing preferences.
      if (!existing.active) {
        await store.set(
          subscriberKey,
          JSON.stringify({ ...existing, active: true, updatedAt: new Date().toISOString() }),
          { contentType: "application/json" }
        );
      }
      return;
    }
  } catch {
    /* not found - fall through to create */
  }

  const record = {
    subscription,
    userEmail: userEmail || null,
    preferences: {
      "breaking-news": true,
      earthquake: true,
      weather: false,
      "website-update": true,
      "live-story": true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastWebsiteUpdate: null,
    active: true,
  };

  await store.set(subscriberKey, JSON.stringify(record), { contentType: "application/json" });

  // Keep the listing index in sync with push-subscribe.js.
  try {
    const INDEX_KEY = "subscriptions-index";
    let index = [];
    try {
      const existingIndex = await store.get(INDEX_KEY, { type: "json" });
      if (Array.isArray(existingIndex)) index = existingIndex;
    } catch {
      /* no index yet */
    }
    if (!index.includes(subscriberKey)) {
      index.push(subscriberKey);
      await store.set(INDEX_KEY, JSON.stringify(index), { contentType: "application/json" });
    }
  } catch (err) {
    console.error("[follow-live-story] index update failed:", err.message);
  }
}

function json(statusCode, payload) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(payload) };
}
