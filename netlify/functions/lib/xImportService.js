/**
 * X Import Service
 *
 * Orchestrates: X API fetch → deduplicate → Supabase upsert → Blob projection.
 * Used by both the cron function and the one-time backfill script.
 */

const { getUserTweets } = require('./xApiClient');
const supabase = require('./supabaseClient');
const {
  getPostStore,
  readPost,
  writePost,
  addToIndex,
} = require('./postStore');

// ── Slug / title helpers ─────────────────────────────────────────

function cleanTitle(text) {
  if (!text) return 'Untitled';
  const first = text.split(/\n/)[0].trim();
  const capped = first.length <= 120 ? first : first.slice(0, 117) + '…';
  return capped.replace(/\s+/g, ' ');
}

function toSlug(title, xPostId) {
  const base = title
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const suffix = xPostId ? xPostId.slice(-10) : '';
  return base ? `${base}-${suffix}` : suffix;
}

function readTimeMinutes(text) {
  if (!text) return 1;
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

// ── URL extraction ───────────────────────────────────────────────

function extractSourceUrls(entities) {
  if (!entities?.urls) return [];
  return entities.urls
    .filter((u) => u.expanded_url && !u.expanded_url.includes('twitter.com') && !u.expanded_url.includes('x.com'))
    .map((u) => ({
      url: u.expanded_url,
      display: u.display_url || u.expanded_url,
      title: u.title || null,
    }));
}

// ── Referenced tweets parsing ────────────────────────────────────

function parseReferencedTweets(tweet, authorId) {
  const refs = tweet.referenced_tweets || [];
  let quotedPostId = null;
  let repliedToPostId = null;
  let isThreadReply = false;

  for (const ref of refs) {
    if (ref.type === 'quoted') quotedPostId = ref.id;
    if (ref.type === 'replied_to') {
      repliedToPostId = ref.id;
      if (tweet.in_reply_to_user_id === authorId) {
        isThreadReply = true;
      }
    }
  }

  return { quotedPostId, repliedToPostId, isThreadReply };
}

// ── Media helpers ────────────────────────────────────────────────

function buildMediaMap(includes) {
  const map = new Map();
  if (!includes?.media) return map;
  for (const m of includes.media) {
    map.set(m.media_key, m);
  }
  return map;
}

function resolveMedia(tweet, mediaMap) {
  const keys = tweet.attachments?.media_keys || [];
  return keys
    .map((k) => mediaMap.get(k))
    .filter(Boolean);
}

// ── CardPost projection (for Netlify Blobs) ──────────────────────

function toCardPost(tweet, mediaItems, slug) {
  const photos = mediaItems.filter((m) => m.type === 'photo');
  const videos = mediaItems.filter((m) => m.type === 'video' || m.type === 'animated_gif');

  const imageUrls = photos.map((m) => m.url).filter(Boolean);
  const videoUrls = videos
    .map((m) => {
      const mp4s = (m.variants || [])
        .filter((v) => v.content_type === 'video/mp4')
        .sort((a, b) => (b.bit_rate || 0) - (a.bit_rate || 0));
      return mp4s[0]?.url || null;
    })
    .filter(Boolean);
  const previewImages = videos.map((m) => m.preview_image_url).filter(Boolean);

  let postType = 'text';
  if (videoUrls.length > 0) postType = 'video';
  else if (imageUrls.length > 0) postType = 'photo';

  const mainImage = imageUrls[0] || previewImages[0] || null;
  const text = tweet.text || '';
  const xUrl = `https://x.com/i/status/${tweet.id}`;
  const metrics = tweet.public_metrics || {};

  const sourceUrls = extractSourceUrls(tweet.entities);

  return {
    id: tweet.id,
    image: mainImage,
    primary_image_url: mainImage,
    images: imageUrls.length > 0 ? imageUrls : undefined,
    videos: videoUrls.length > 0 ? videoUrls : undefined,
    video_url: videoUrls[0] || undefined,
    title: cleanTitle(text),
    story: text,
    text: text,
    datePosted: tweet.created_at || new Date().toISOString(),
    link: xUrl,
    x_url: xUrl,
    slug,
    postType,
    readTime: readTimeMinutes(text),
    views: metrics.impression_count || 0,
    likes: metrics.like_count || 0,
    reposts: metrics.retweet_count || 0,
    replies: metrics.reply_count || 0,
    author: 'Noteworthy News',
    authorUrl: `https://x.com/${process.env.NOTEWORTHY_X_USERNAME || 'newsnoteworthy'}`,
    source_urls: sourceUrls.length > 0 ? sourceUrls : undefined,
    urgency: tweet.urgency || null,
  };
}

/**
 * Merge source_urls and other projection fields onto an existing blob card.
 */
function enrichCardPost(card, sourceUrls, urgency) {
  if (!card || typeof card !== 'object') return card;
  const next = { ...card };
  if (Array.isArray(sourceUrls) && sourceUrls.length > 0) {
    next.source_urls = sourceUrls;
  }
  if (urgency) {
    next.urgency = urgency;
  }
  return next;
}

// ── Supabase upserts ─────────────────────────────────────────────

async function upsertXPost(tweet, mediaItems, slug, refs) {
  const text = tweet.text || '';
  const metrics = tweet.public_metrics || {};
  const xUrl = `https://x.com/i/status/${tweet.id}`;

  const row = {
    x_post_id: tweet.id,
    x_conversation_id: tweet.conversation_id || null,
    x_author_id: tweet.author_id || null,
    text,
    clean_title: cleanTitle(text),
    summary: text.length > 280 ? text.slice(0, 277) + '…' : text,
    slug,
    x_url: xUrl,
    quoted_post_id: refs.quotedPostId,
    replied_to_post_id: refs.repliedToPostId,
    is_thread_reply: refs.isThreadReply,
    source_urls: extractSourceUrls(tweet.entities),
    public_metrics: metrics,
    created_at_x: tweet.created_at || null,
    raw_x_json: tweet,
    status: 'published',
  };

  const { data, error } = await supabase
    .from('x_posts')
    .upsert(row, { onConflict: 'x_post_id' })
    .select('id')
    .single();

  if (error) throw new Error(`Supabase x_posts upsert: ${error.message}`);

  const postDbId = data.id;

  if (mediaItems.length > 0) {
    const mediaRows = mediaItems.map((m, i) => ({
      post_id: postDbId,
      media_key: m.media_key || null,
      type: m.type === 'animated_gif' ? 'animated_gif' : m.type,
      original_url: m.url || null,
      preview_image_url: m.preview_image_url || null,
      width: m.width || null,
      height: m.height || null,
      alt_text: m.alt_text || null,
      duration_ms: m.duration_ms || null,
      variants: m.variants || null,
      sort_order: i,
    }));

    // Delete existing media for this post then re-insert
    await supabase.from('x_post_media').delete().eq('post_id', postDbId);
    const { error: mediaErr } = await supabase.from('x_post_media').insert(mediaRows);
    if (mediaErr) {
      console.error(`[xImport] Media insert failed for ${tweet.id}: ${mediaErr.message}`);
    }
  }

  return postDbId;
}

// ── Thread parent linking (best-effort) ──────────────────────────

async function linkThreadParent(tweet, refs) {
  if (!refs.isThreadReply || !refs.repliedToPostId) return;

  const { data } = await supabase
    .from('x_posts')
    .select('id')
    .eq('x_post_id', refs.repliedToPostId)
    .single();

  if (data) {
    await supabase
      .from('x_posts')
      .update({ thread_parent_id: data.id })
      .eq('x_post_id', tweet.id);
  }
}

// ── Main import orchestrator ─────────────────────────────────────

/**
 * @param {object} opts
 * @param {string}  opts.userId
 * @param {string} [opts.sinceId]
 * @param {number} [opts.maxResults]  1-100
 * @param {number} [opts.pages]       Max pages to fetch (default 1)
 * @returns {{ imported_count, skipped_count, failed_count, latest_x_post_id, errors }}
 */
async function importLatestPosts(opts) {
  const { userId, sinceId, maxResults = 10, pages = 1, force = false } = opts;
  const result = {
    imported_count: 0,
    skipped_count: 0,
    failed_count: 0,
    latest_x_post_id: null,
    errors: [],
  };

  let paginationToken = null;

  for (let page = 0; page < pages; page++) {
    let response;
    try {
      response = await getUserTweets(userId, {
        sinceId,
        maxResults,
        paginationToken,
      });
    } catch (err) {
      console.error(`[xImport] API fetch failed (page ${page}):`, err.message);
      result.errors.push(`API fetch page ${page}: ${err.message}`);
      break;
    }

    const { tweets, includes, meta } = response;

    if (!tweets || tweets.length === 0) {
      console.log(`[xImport] No tweets on page ${page}`);
      break;
    }

    const mediaMap = buildMediaMap(includes);

    for (const tweet of tweets) {
      try {
        if (!result.latest_x_post_id) {
          result.latest_x_post_id = tweet.id;
        }

        // Check if already imported (Supabase + Blobs)
        const { data: existing } = await supabase
          .from('x_posts')
          .select('x_post_id')
          .eq('x_post_id', tweet.id)
          .maybeSingle();

        if (existing && !opts.force) {
          // Post is in Supabase - verify the Blob projection also exists
          const store = getPostStore();
          const blob = await readPost(store, tweet.id);
          if (blob) {
            result.skipped_count++;
            continue;
          }
          console.log(`[xImport] Re-projecting ${tweet.id} to Blobs (Supabase OK, Blob missing)`);
        }

        const mediaItems = resolveMedia(tweet, mediaMap);
        const refs = parseReferencedTweets(tweet, userId);
        const title = cleanTitle(tweet.text);
        const slug = toSlug(title, tweet.id);

        // Supabase upsert (idempotent ON CONFLICT)
        await upsertXPost(tweet, mediaItems, slug, refs);

        // Thread parent linking (best-effort, don't block on failure)
        try {
          await linkThreadParent(tweet, refs);
        } catch (linkErr) {
          console.warn(`[xImport] Thread link failed for ${tweet.id}:`, linkErr.message);
        }

        // Project to Netlify Blobs
        const card = toCardPost(tweet, mediaItems, slug);
        const store = getPostStore();
        await writePost(store, tweet.id, card);
        await addToIndex(store, tweet.id);

        result.imported_count++;
        console.log(`[xImport] Imported ${tweet.id} → "${title.slice(0, 60)}"`);

        // Remote-start a Live Activity on paired iOS devices (fail-soft).
        try {
          const { notifyXPostLiveActivity } = require("./xPostLiveActivityNotify");
          await notifyXPostLiveActivity({
            post: {
              id: tweet.id,
              slug,
              title,
              text: tweet.text,
              story: card.story || card.text,
            },
            logger: console,
          });
        } catch (laErr) {
          console.warn(`[xImport] Live Activity dispatch skipped for ${tweet.id}:`, laErr.message);
        }
      } catch (err) {
        result.failed_count++;
        result.errors.push(`Tweet ${tweet.id}: ${err.message}`);
        console.error(`[xImport] Failed to import ${tweet.id}:`, err.message);
      }
    }

    paginationToken = meta.next_token || null;
    if (!paginationToken) break;
  }

  console.log(
    `[xImport] Done: imported=${result.imported_count} skipped=${result.skipped_count} failed=${result.failed_count}`
  );
  return result;
}

/**
 * Get the most recent x_post_id from Supabase (for since_id polling).
 */
async function getLatestImportedId() {
  const { data } = await supabase
    .from('x_posts')
    .select('x_post_id')
    .order('created_at_x', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.x_post_id || null;
}

module.exports = {
  importLatestPosts,
  getLatestImportedId,
  cleanTitle,
  toSlug,
  toCardPost,
  extractSourceUrls,
  enrichCardPost,
};
