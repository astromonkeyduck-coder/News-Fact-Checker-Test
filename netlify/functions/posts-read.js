if (process.env.NETLIFY_DEV) {
  try {
    require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  } catch (e) {}
}

const {
  getPostStore,
  readIndex,
  readPost,
  readPostById,
} = require("./lib/postStore");
const { publicationPost, isListedPost, reviewReason } = require("./lib/publicationQuality");
const { isVolcanoEnginePost } = require("./lib/postNormalize");

// Public field allowlist for posts returned to anonymous web/app clients.
// This is the UNION of every field actually rendered by the public surfaces
// (feed.js, news-card.js, article-loader.js, article-page-v3.js, the mobile
// feed normalizer and article-preview) plus the canonical fields written by
// createPost.js and the X import projection. Any field NOT listed here - e.g.
// internal ingestion/processing metadata, upstream raw API payloads, status
// flags, or author IDs that may live on a blob - is stripped before returning,
// so posts-read never leaks raw internal blob fields.
const PUBLIC_POST_FIELDS = new Set([
  // identity / links
  "id", "postId", "slug",
  "link", "url", "x_url", "authorUrl", "source_url", "sourceUrl", "source_urls",
  // title / body
  "title", "story", "text", "content", "Content",
  "summary", "excerpt", "description", "dek", "lead_paragraph",
  "key_takeaways",
  // media
  "image", "image_url", "primary_image_url", "images", "secondary_images",
  "usgs_images", "mediaUrl", "media_url", "image_caption", "image_credit",
  "video", "video_url", "videos",
  // meta
  "category", "source", "sourceName", "author", "postType", "readTime",
  "tags", "urgency", "breaking",
  "content_type", "editorial_state", "editorial_status", "review_required", "review_notice",
  "source_references", "corrections", "coverage_lifecycle", "claim_status",
  // dates
  "datePosted", "createdAt", "created_at", "Date", "updated_at", "timestamp",
  "created_at_x",
  // geo / earthquake / event
  "location", "location_display", "location_english_name",
  "lat", "lon", "depth", "magnitude", "mag", "severity",
  "event_type", "eventId", "event_id",
  "assets", "raw", "public_metrics",
  // food safety (compact card summary + detail-endpoint pointer only;
  // full product rows / versions / evidence stay behind food-safety-event)
  "food_safety_summary", "food_safety_event_id",
  // social metrics
  "views", "likes", "reposts", "replies",
]);

function toPublicPost(post) {
  if (!post || typeof post !== "object") return post;
  post = publicationPost(post);
  const out = {};
  for (const key of Object.keys(post)) {
    if (PUBLIC_POST_FIELDS.has(key)) out[key] = post[key];
  }
  return out;
}

/**
 * Read latest posts from blob storage
 */
exports.handler = async (event) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    "Netlify-CDN-Cache-Control": "public, max-age=60, stale-while-revalidate=300",
  };

  // Handle OPTIONS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: "",
    };
  }

  try {
    const limit = parseInt(event.queryStringParameters?.limit || "30", 10);
    const maxLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 200)) : 30;

    const store = getPostStore();

    // Direct lookup by ID
    const requestedId = event.queryStringParameters?.id;
    if (requestedId && requestedId.trim()) {
      const post = await readPostById(store, requestedId);
      if (!post || isVolcanoEnginePost(post) || ['draft', 'suppressed'].includes(post.editorial_status || post.editorial_state || post.publish_state)) {
        return {
          statusCode: 404,
          headers: { ...headers, 'Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': 'no-store' },
          body: JSON.stringify({ error: 'Story not found', code: 'STORY_NOT_FOUND' }),
        };
      }
      // Legacy invalid imports retain a notice at their existing inbound URL.
      // Unpublished review drafts must not leak their submitted body.
      if (((post.editorial_status || post.editorial_state || post.publish_state) === 'review' || post.review_required) && !reviewReason(post)) {
        return { statusCode: 404, headers: { ...headers, 'Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': 'no-store' }, body: JSON.stringify({ error: 'Story not found', code: 'STORY_NOT_FOUND' }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify([toPublicPost(post)]) };
    }

    const ids = await readIndex(store, { strict: true });
    if (ids.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify([]),
      };
    }

    const idsToFetch = ids.slice(0, 200);

    console.log(`[posts-read] Fetching ${idsToFetch.length} posts (returning top ${maxLimit})`);

    const posts = await Promise.all(
      idsToFetch.map((id) => readPost(store, id, { strict: true }))
    );

    const validPosts = posts.filter((post) => post !== null && !isVolcanoEnginePost(post) && isListedPost(post));

    validPosts.sort((a, b) => {
      const dateA = new Date(a.datePosted || a.createdAt || a.created_at || a.Date || 0);
      const dateB = new Date(b.datePosted || b.createdAt || b.created_at || b.Date || 0);
      return dateB.getTime() - dateA.getTime();
    });

    const topPosts = validPosts.slice(0, maxLimit).map(toPublicPost);

    console.log(`[posts-read] Returning ${topPosts.length} of ${validPosts.length} valid posts`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(topPosts),
    };
  } catch (error) {
    console.error('[posts-read] Error:', error);
    return {
      statusCode: error.code === 'INVALID_POST_ID' ? 400 : 503,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
        "Netlify-CDN-Cache-Control": "no-store",
        "Retry-After": "30",
      },
      body: JSON.stringify({
        error: error.code === 'INVALID_POST_ID' ? 'Invalid story ID' : 'Stories are temporarily unavailable. Please try again.',
        code: error.code === 'INVALID_POST_ID' ? 'INVALID_POST_ID' : 'STORIES_TEMPORARILY_UNAVAILABLE',
      }),
    };
  }
};


exports.toPublicPost = toPublicPost;
