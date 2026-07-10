/**
 * Live Stories - public read API
 *
 * GET /.netlify/functions/live-stories
 *   → { stories: [...] }   active (non-archived) stories, pinned first
 *
 * GET /.netlify/functions/live-stories?slug=<slug>
 *   → { story: {...}, updates: [...] }   single story with its timeline
 *
 * Read-only. All access uses the Supabase service-role client (RLS blocks anon),
 * so only whitelisted columns are returned to the public.
 */

const supabase = require("./lib/supabaseClient");
const { corsHeaders, optionsResponse } = require("./lib/corsHeaders");

const STORY_PUBLIC_COLUMNS =
  "id, slug, title, summary, status, category, severity, confidence, pinned, follower_count, last_update_at, created_at, updated_at";

const UPDATE_PUBLIC_COLUMNS =
  "id, body, kind, status_at_time, alert_level, source_url, source_label, created_at";

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse;

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const slug = event.queryStringParameters?.slug;

    if (slug) {
      return await getStoryBySlug(slug);
    }

    return await listStories(event.queryStringParameters || {});
  } catch (error) {
    console.error("[live-stories] Error:", error.message);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};

async function listStories(params) {
  const limit = Math.min(Number(params.limit) || 50, 100);
  const includeResolved = params.includeResolved === "true";

  let query = supabase
    .from("live_stories")
    .select(STORY_PUBLIC_COLUMNS)
    .eq("archived", false)
    .neq("category", "X") // auto-ingested X posts are not editorial live stories
    .order("pinned", { ascending: false })
    .order("last_update_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!includeResolved) {
    // Keep resolved/false_report stories out of the default live list.
    query = query.not("status", "in", "(resolved,false_report)");
  }

  const { data, error } = await query;
  if (error) throw error;

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ stories: data || [] }),
  };
}

async function getStoryBySlug(slug) {
  const { data: story, error: storyErr } = await supabase
    .from("live_stories")
    .select(STORY_PUBLIC_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (storyErr) throw storyErr;

  if (!story || story.category === "X") {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Story not found" }),
    };
  }

  const { data: updates, error: updatesErr } = await supabase
    .from("live_story_updates")
    .select(UPDATE_PUBLIC_COLUMNS)
    .eq("story_id", story.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (updatesErr) throw updatesErr;

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ story, updates: updates || [] }),
  };
}
