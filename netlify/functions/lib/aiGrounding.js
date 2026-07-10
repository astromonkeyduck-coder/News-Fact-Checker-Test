/**
 * Shared grounding data for Noteworthy News AI (text chat + realtime voice).
 *
 * Every fetch fails soft (returns [] / null) so the AI keeps working when a
 * data source is unavailable - e.g. blobs missing in local dev.
 */

const postStore = require("./postStore");

/**
 * Recent posts from the x-posts blob store, newest first.
 */
async function fetchRecentPosts(limit = 12) {
  try {
    const store = postStore.getPostStore();
    const ids = await postStore.readIndex(store);
    if (ids.length === 0) return [];

    const postIds = ids.slice(0, Math.min(limit, ids.length));
    const posts = await Promise.all(
      postIds.map(async (id) => {
        try {
          return await postStore.readPost(store, id);
        } catch (err) {
          console.error(`[AI Grounding] Error fetching post ${id}:`, err.message);
          return null;
        }
      })
    );

    return posts
      .filter((p) => p !== null)
      .sort((a, b) => {
        const timeA = a.timestamp || a.createdAt || 0;
        const timeB = b.timestamp || b.createdAt || 0;
        return timeB - timeA;
      })
      .slice(0, limit);
  } catch (error) {
    console.error("[AI Grounding] Error fetching recent posts:", error.message);
    return [];
  }
}

/**
 * A single post by id (used when the reader is on an article page).
 */
async function fetchPostById(id) {
  try {
    const store = postStore.getPostStore();
    return await Promise.race([
      postStore.readPost(store, id),
      new Promise((resolve) => setTimeout(() => resolve(null), 1500)),
    ]);
  } catch (e) {
    return null;
  }
}

/**
 * Active (non-archived, non-resolved) live stories from Supabase.
 */
async function fetchLiveStories(limit = 5) {
  let supabase;
  try {
    supabase = require("./supabaseClient");
  } catch (e) {
    return [];
  }
  try {
    const query = supabase
      .from("live_stories")
      .select("slug, title, summary, status, severity, category, last_update_at, created_at")
      .eq("archived", false)
      .neq("category", "X")
      .not("status", "in", "(resolved,false_report)")
      .order("pinned", { ascending: false })
      .order("last_update_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    const { data, error } = await Promise.race([
      query,
      new Promise((resolve) => setTimeout(() => resolve({ data: null, error: new Error("timeout") }), 2000)),
    ]);

    if (error || !Array.isArray(data)) return [];
    return data;
  } catch (e) {
    console.error("[AI Grounding] Live stories fetch failed:", e.message);
    return [];
  }
}

/**
 * One live story (with its latest updates) by slug.
 */
async function fetchLiveStoryBySlug(slug) {
  let supabase;
  try {
    supabase = require("./supabaseClient");
  } catch (e) {
    return null;
  }
  try {
    const work = (async () => {
      const { data: story } = await supabase
        .from("live_stories")
        .select("id, slug, title, summary, status, severity, category, last_update_at")
        .eq("slug", slug)
        .maybeSingle();
      if (!story) return null;
      const { data: updates } = await supabase
        .from("live_story_updates")
        .select("body, kind, source_label, created_at")
        .eq("story_id", story.id)
        .order("created_at", { ascending: false })
        .limit(6);
      return { story, updates: updates || [] };
    })();
    return await Promise.race([
      work,
      new Promise((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);
  } catch (e) {
    console.error("[AI Grounding] Live story fetch failed:", e.message);
    return null;
  }
}

/**
 * Load everything in parallel. pageContext is the sanitized object the widget
 * sends: { url, title, articleId, storySlug }.
 */
async function loadGrounding({ pageContext = null, postsLimit = 12, storiesLimit = 5 } = {}) {
  const [recentPosts, liveStories, currentArticle, currentLiveStory] = await Promise.all([
    fetchRecentPosts(postsLimit).catch(() => []),
    fetchLiveStories(storiesLimit),
    pageContext?.articleId ? fetchPostById(pageContext.articleId) : Promise.resolve(null),
    pageContext?.storySlug ? fetchLiveStoryBySlug(pageContext.storySlug) : Promise.resolve(null),
  ]);
  return { recentPosts, liveStories, currentArticle, currentLiveStory };
}

const squash = (v, max) => String(v || "").replace(/\s+/g, " ").trim().substring(0, max);

/**
 * Plain-spoken context blocks for the realtime voice assistant.
 * No markdown, no URLs - it's read aloud.
 */
function buildVoiceContext({ recentPosts, liveStories, currentArticle, currentLiveStory }, pageContext = null) {
  const parts = [];

  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const events = (recentPosts || [])
    .filter((post) => {
      const t = post.timestamp || post.createdAt || 0;
      return t && new Date(t).getTime() >= cutoff;
    })
    .slice(0, 6)
    .map((post) => {
      const title = squash(post.title || post.story || post.text || "Untitled", 140);
      const date = post.timestamp || post.createdAt;
      const dateStr = date
        ? new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "recent";
      const summary = squash(post.summary || post.text || "", 180);
      return `- ${title} (${post.category || "News"}, ${dateStr})${summary ? `: ${summary}` : ""}`;
    });

  if (events.length > 0) {
    parts.push(`VERIFIED NOTEWORTHY NEWS ARTICLES (real, published reporting - reference them by title, e.g. "our article on ..."):\n${events.join("\n")}`);
  }

  const stories = (liveStories || []).map((s) => {
    const summary = squash(s.summary, 160);
    return `- ${squash(s.title || "Live story", 140)} - status: ${s.status || "developing"}${s.severity ? `, severity: ${s.severity}` : ""}${summary ? `: ${summary}` : ""}`;
  });
  if (stories.length > 0) {
    parts.push(`LIVE STORIES WE ARE TRACKING RIGHT NOW:\n${stories.join("\n")}`);
  }

  if (currentLiveStory && currentLiveStory.story) {
    const s = currentLiveStory.story;
    const updates = (currentLiveStory.updates || [])
      .map((u) => `  - ${u.created_at ? new Date(u.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}${u.source_label ? ` (${u.source_label})` : ""}: ${squash(u.body, 200)}`)
      .join("\n");
    parts.push(`THE LISTENER IS CURRENTLY ON THIS LIVE STORY PAGE:\n${squash(s.title, 140)} - status: ${s.status || "developing"}\nSummary: ${squash(s.summary, 240)}\nLatest updates (newest first):\n${updates || "  (no updates yet)"}\nWhen they say "this story" or ask what's happening, they mean this live story.`);
  } else if (currentArticle) {
    const title = squash(currentArticle.title || currentArticle.story || currentArticle.text || "Article", 140);
    const bodyText = squash(currentArticle.story || currentArticle.text || currentArticle.summary || "", 1200);
    parts.push(`THE LISTENER IS CURRENTLY ON THIS ARTICLE PAGE:\n"${title}"\n${bodyText}\nWhen they say "this story" or "this article", they mean the article above.`);
  } else if (pageContext && (pageContext.title || pageContext.url)) {
    parts.push(`THE LISTENER IS CURRENTLY ON: ${squash(pageContext.title || pageContext.url, 200)}`);
  }

  return parts.length > 0 ? `\n\n${parts.join("\n\n")}` : "";
}

/**
 * Corrections for things the model's training data reliably gets wrong.
 * Each fact is date-bounded so stale lines drop out automatically instead of
 * becoming misinformation later.
 */
function buildKnowledgeCorrections() {
  const now = Date.now();
  const facts = [];

  // Second Trump term: elected Nov 2024, inaugurated Jan 20 2025 - Jan 20 2029.
  // Models trained before the 2024 election default to "former president".
  if (now >= Date.parse("2025-01-20T17:00:00Z") && now < Date.parse("2029-01-20T17:00:00Z")) {
    facts.push('Donald Trump IS the sitting President of the United States. He won the November 2024 election and was inaugurated January 20, 2025. Refer to him as "President Trump" - NEVER "former president".');
    facts.push("JD Vance is the sitting Vice President of the United States.");
  }

  if (facts.length === 0) return "";
  return `\n\nKNOWLEDGE CORRECTIONS (your training data predates these - treat them as fact):\n${facts.map((f) => `- ${f}`).join("\n")}`;
}

/**
 * Shared warning about the model's training cutoff. Keeps titles and
 * "current" facts anchored to the provided sources instead of stale memory.
 */
function buildCutoffRules() {
  return `
YOUR TRAINING DATA IS OUT OF DATE:
- Your training ended well before today's date. Elections, officeholders, titles, champions, prices, and records may have changed since.
- NEVER assert someone's current title or status from memory. Use titles EXACTLY as they appear in the verified articles and search results you are given - if a source says "President Trump", say "President Trump", do not "correct" it to "former president".
- When your memory conflicts with the provided sources, the sources win. Do not editorialize the difference.`;
}

/** True when Trump is the sitting U.S. president (second term). */
function isTrumpPresidency() {
  const now = Date.now();
  return now >= Date.parse("2025-01-20T17:00:00Z") && now < Date.parse("2029-01-20T17:00:00Z");
}

/**
 * Reminder appended to search_web tool results so the model does not
 * "correct" live headlines back to stale training-data titles.
 */
function buildSearchResultsFooter() {
  if (isTrumpPresidency()) {
    return `\n\nREMINDER: Donald Trump IS the sitting U.S. President (inaugurated January 20, 2025). If results mention Trump in a presidential context, say "President Trump" - NEVER "former president". Copy titles from the results above verbatim; do not substitute from memory.`;
  }
  return `\n\nREMINDER: Copy titles from the results above verbatim. Do not substitute officeholder titles from your training data.`;
}

/**
 * Last-resort fix when the model still emits stale titles despite prompts.
 * Only applies date-bounded corrections so they expire automatically.
 */
function sanitizeOfficeholderTitles(text) {
  if (!text || typeof text !== "string") return text;
  if (!isTrumpPresidency()) return text;

  return text
    .replace(/\bformer\s+President\s+Donald\s+Trump\b/gi, "President Donald Trump")
    .replace(/\bformer\s+president\s+Donald\s+Trump\b/gi, "President Donald Trump")
    .replace(/\bformer\s+President\s+Trump\b/gi, "President Trump")
    .replace(/\bformer\s+president\s+Trump\b/gi, "President Trump")
    .replace(/\bex-?President\s+Donald\s+Trump\b/gi, "President Donald Trump")
    .replace(/\bex-?President\s+Trump\b/gi, "President Trump");
}

module.exports = {
  fetchRecentPosts,
  fetchPostById,
  fetchLiveStories,
  fetchLiveStoryBySlug,
  loadGrounding,
  buildVoiceContext,
  buildKnowledgeCorrections,
  buildCutoffRules,
  buildSearchResultsFooter,
  sanitizeOfficeholderTitles,
  isTrumpPresidency,
};
