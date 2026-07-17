if (process.env.NETLIFY_DEV) {
  try {
    require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  } catch (e) {}
}

const {
  getPostStore,
  readIndex,
  readPost,
} = require("./lib/postStore");
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
    const maxLimit = Math.min(limit, 200);

    const store = getPostStore();

    // Direct lookup by ID
    const requestedId = event.queryStringParameters?.id;
    if (requestedId && requestedId.trim()) {
      const blobId = requestedId.trim().replace(/^post-/, "");
      const post = await readPost(store, blobId);
      if (post && !isVolcanoEnginePost(post)) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify([toPublicPost(post)]),
        };
      }
      if (post && isVolcanoEnginePost(post)) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify([]),
        };
      }
      // Legacy fallback: eq- prefix may still exist for older earthquake posts
      if (blobId.startsWith("usgs-")) {
        const eqPost = await readPost(store, `eq-${blobId.substring(5)}`);
        if (eqPost && !isVolcanoEnginePost(eqPost)) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify([toPublicPost(eqPost)]),
          };
        }
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify([]),
      };
    }

    const ids = await readIndex(store);
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
      idsToFetch.map((id) => readPost(store, id))
    );

    const validPosts = posts.filter((post) => post !== null && !isVolcanoEnginePost(post));

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
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: error?.message || "Internal server error",
      }),
    };
  }
};

