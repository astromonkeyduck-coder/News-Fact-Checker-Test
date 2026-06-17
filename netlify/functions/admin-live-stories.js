/**
 * Admin Live Stories — editorial control API (admin-authenticated)
 *
 * GET  ?action=list                 → all stories (incl. archived) for the editor
 * GET  ?slug=<slug>                 → story + timeline + recent send log
 *
 * POST { action: "createStory", ... }
 * POST { action: "updateStory", id|slug, ...fields }
 * POST { action: "addUpdate", id|slug, body, kind, alert_level, source_url, source_label,
 *        newStatus?, confirm? }
 *
 * High-severity alert levels (urgent | final) require an explicit confirm:true to
 * prevent accidental false-breaking-news blasts. Every dispatch is audited in
 * live_story_send_log by lib/liveStoryNotify.
 */

const supabase = require("./lib/supabaseClient");
const { corsHeaders, optionsResponse } = require("./lib/corsHeaders");
const { requireAdminAuth } = require("./middleware/requireAuth");
const { notifyFollowers } = require("./lib/liveStoryNotify");
const { notifyLiveActivities } = require("./lib/liveActivityNotify");
const apns = require("./lib/apnsClient");

const STATUSES = ["breaking", "developing", "verified", "disputed", "resolved", "false_report"];
const KINDS = ["major", "minor", "correction", "final"];
const ALERT_LEVELS = ["silent", "badge", "normal", "urgent", "final"];
const CONFIDENCES = ["low", "medium", "high"];
const CONFIRM_REQUIRED = ["urgent", "final"];

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse;

  const authResult = await requireAdminAuth(event);
  if (authResult.statusCode) return { ...authResult, headers: corsHeaders };

  const actor =
    authResult.user.email ||
    authResult.user["https://noteworthynews.co/email"] ||
    authResult.user.sub ||
    "admin";

  try {
    if (event.httpMethod === "GET") {
      const params = event.queryStringParameters || {};
      if (params.action === "apnsStatus") return apnsStatus();
      if (params.slug) return await getStoryDetail(params.slug);
      return await listStories();
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      switch (body.action) {
        case "createStory":
          return await createStory(body, actor);
        case "updateStory":
          return await updateStory(body, actor);
        case "addUpdate":
          return await addUpdate(body, actor);
        case "testLiveActivity":
          return await testLiveActivity(body, actor);
        default:
          return json(400, { error: "Invalid or missing action" });
      }
    }

    return json(405, { error: "Method not allowed" });
  } catch (error) {
    console.error("[admin-live-stories] Error:", error.message);
    return json(500, { error: error.message || "Internal server error" });
  }
};

/* ── reads ──────────────────────────────────────────── */

async function listStories() {
  const { data, error } = await supabase
    .from("live_stories")
    .select(
      "id, slug, title, summary, status, category, severity, confidence, pinned, archived, follower_count, last_update_at, created_at, created_by"
    )
    .order("pinned", { ascending: false })
    .order("last_update_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return json(200, { stories: data || [] });
}

async function getStoryDetail(slug) {
  const { data: story, error } = await supabase
    .from("live_stories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!story) return json(404, { error: "Story not found" });

  const [{ data: updates }, { data: sendLog }] = await Promise.all([
    supabase
      .from("live_story_updates")
      .select("*")
      .eq("story_id", story.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("live_story_send_log")
      .select("*")
      .eq("story_id", story.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return json(200, { story, updates: updates || [], sendLog: sendLog || [] });
}

/* ── writes ─────────────────────────────────────────── */

async function createStory(body, actor) {
  const title = (body.title || "").trim();
  if (!title) return json(400, { error: "title is required" });

  const status = STATUSES.includes(body.status) ? body.status : "developing";
  const confidence = CONFIDENCES.includes(body.confidence) ? body.confidence : "medium";
  const severity = clampSeverity(body.severity);
  const slug = await uniqueSlug(body.slug || title);

  const { data, error } = await supabase
    .from("live_stories")
    .insert({
      slug,
      title,
      summary: body.summary || null,
      status,
      category: body.category || null,
      severity,
      confidence,
      pinned: !!body.pinned,
      created_by: actor,
      last_update_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return json(200, { success: true, story: data });
}

async function updateStory(body, actor) {
  const story = await resolveStory(body);
  if (!story) return json(404, { error: "Story not found" });

  const patch = {};
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim();
  if (typeof body.summary === "string") patch.summary = body.summary;
  if (STATUSES.includes(body.status)) patch.status = body.status;
  if (CONFIDENCES.includes(body.confidence)) patch.confidence = body.confidence;
  if (body.severity !== undefined) patch.severity = clampSeverity(body.severity);
  if (typeof body.category === "string") patch.category = body.category;
  if (typeof body.pinned === "boolean") patch.pinned = body.pinned;
  if (typeof body.archived === "boolean") patch.archived = body.archived;

  if (Object.keys(patch).length === 0) {
    return json(400, { error: "No valid fields to update" });
  }

  const { data, error } = await supabase
    .from("live_stories")
    .update(patch)
    .eq("id", story.id)
    .select()
    .single();
  if (error) throw error;

  console.log(`[admin-live-stories] ${actor} updated story ${story.slug}:`, Object.keys(patch).join(","));
  return json(200, { success: true, story: data });
}

async function addUpdate(body, actor) {
  const story = await resolveStory(body);
  if (!story) return json(404, { error: "Story not found" });

  const text = (body.body || "").trim();
  if (!text) return json(400, { error: "Update body is required" });

  const kind = KINDS.includes(body.kind) ? body.kind : "minor";
  const alertLevel = ALERT_LEVELS.includes(body.alert_level) ? body.alert_level : "normal";

  // Guardrail: high-severity blasts require explicit confirmation.
  if (CONFIRM_REQUIRED.includes(alertLevel) && body.confirm !== true) {
    return json(409, {
      error: "confirmation_required",
      message: `Alert level "${alertLevel}" sends an urgent push to all followers. Re-submit with confirm:true.`,
      alert_level: alertLevel,
    });
  }

  // Optionally move the story's status alongside this update.
  const newStatus = STATUSES.includes(body.newStatus) ? body.newStatus : null;
  const statusAtTime = newStatus || story.status;

  const { data: update, error: updateErr } = await supabase
    .from("live_story_updates")
    .insert({
      story_id: story.id,
      body: text,
      kind,
      status_at_time: statusAtTime,
      alert_level: alertLevel,
      source_url: body.source_url || null,
      source_label: body.source_label || null,
      created_by: actor,
    })
    .select()
    .single();
  if (updateErr) throw updateErr;

  // Update story status/timestamp.
  const storyPatch = { last_update_at: new Date().toISOString() };
  if (newStatus) storyPatch.status = newStatus;
  const { data: freshStory, error: storyErr } = await supabase
    .from("live_stories")
    .update(storyPatch)
    .eq("id", story.id)
    .select()
    .single();
  if (storyErr) throw storyErr;

  // Dispatch to web push followers AND native iOS Live Activities in parallel.
  // Both fail soft so a delivery problem never blocks the editorial write.
  const dryRun = process.env.DRY_RUN === "true";
  const [webResult, liveActivityResult] = await Promise.all([
    notifyFollowers({ story: freshStory, update, actor, logger: console, dryRun }).catch((err) => {
      console.error("[admin-live-stories] notifyFollowers failed:", err.message);
      return { error: err.message };
    }),
    notifyLiveActivities({ story: freshStory, update, logger: console, dryRun }).catch((err) => {
      console.error("[admin-live-stories] notifyLiveActivities failed:", err.message);
      return { error: err.message };
    }),
  ]);

  const dispatch = { ...webResult, liveActivity: liveActivityResult };
  return json(200, { success: true, update, story: freshStory, dispatch });
}

/* ── Live Activity diagnostics + test (admin-only) ──── */

/**
 * Secret-safe APNs config readout. Never returns the .p8 key or a signed JWT —
 * only whether each var is present and the derived topic/environment. Lets an
 * admin confirm the Netlify APNS_* vars are set without exposing secrets.
 */
function apnsStatus() {
  const keyId = process.env.APNS_KEY_ID || "";
  return json(200, {
    configured: apns.isConfigured(),
    environment: apns.defaultEnvironment(),
    bundleId: process.env.APNS_BUNDLE_ID || null,
    topic: process.env.APNS_BUNDLE_ID ? `${process.env.APNS_BUNDLE_ID}.push-type.liveactivity` : null,
    keyIdLast4: keyId ? keyId.slice(-4) : null,
    teamIdSet: !!process.env.APNS_TEAM_ID,
    keyP8Set: !!process.env.APNS_KEY_P8,
  });
}

/**
 * Send a synthetic Live Activity update/end to a story's running activities (and
 * push-to-start followers) WITHOUT writing the timeline or sending web push.
 * For real-device verification of remote ActivityKit delivery from /admin.
 */
async function testLiveActivity(body, actor) {
  const story = await resolveStory(body);
  if (!story) return json(404, { error: "Story not found" });
  if (!apns.isConfigured()) {
    return json(200, { success: true, dispatch: { configured: false, reason: "apns not configured" } });
  }

  const isFinal = body.final === true;
  const status = STATUSES.includes(body.status) ? body.status : story.status;
  const update = {
    id: null, // synthetic — not persisted
    body: (body.headline || "Test update from the newsroom.").trim(),
    status_at_time: status,
    alert_level: isFinal ? "final" : "normal",
  };

  const result = await notifyLiveActivities({ story, update, logger: console, dryRun: false }).catch((err) => {
    console.error("[admin-live-stories] testLiveActivity failed:", err.message);
    return { error: err.message };
  });

  console.log(`[admin-live-stories] ${actor} sent test Live Activity to ${story.slug} (final=${isFinal})`);
  return json(200, { success: true, dispatch: result });
}

/* ── helpers ─────────────────────────────────────────── */

async function resolveStory(body) {
  if (body.id) {
    const { data, error } = await supabase
      .from("live_stories")
      .select("*")
      .eq("id", body.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
  if (body.slug) {
    const { data, error } = await supabase
      .from("live_stories")
      .select("*")
      .eq("slug", body.slug)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
  return null;
}

function clampSeverity(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(5, Math.round(n)));
}

function slugify(input) {
  return String(input)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "story";
}

async function uniqueSlug(input) {
  const base = slugify(input);
  let candidate = base;
  for (let i = 0; i < 6; i++) {
    const { data, error } = await supabase
      .from("live_stories")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (error) throw error;
    if (!data) return candidate;
    candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function json(statusCode, payload) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(payload) };
}
