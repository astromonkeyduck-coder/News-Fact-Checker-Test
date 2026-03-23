/**
 * Remove old alert posts (earthquake, weather, volcano, etc.)
 * Removes alert posts older than a specified number of days (default: 7).
 */

const { requireAdminAuth } = require("./middleware/requireAuth");
const {
  getPostStore,
  readIndex,
  readPost,
  writeIndex,
  postKey,
} = require("./lib/postStore");

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const auth = await requireAdminAuth(event);
  if (auth.statusCode) return auth;

  try {
    const store = getPostStore();
    const ids = await readIndex(store);

    if (ids.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: "No index found", removed: 0 }),
      };
    }

    const daysOld = parseInt(event.queryStringParameters?.days || "7", 10);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffTimestamp = cutoffDate.getTime();

    const removed = [];
    const kept = [];

    for (const postId of ids) {
      try {
        const post = await readPost(store, postId);

        if (!post) {
          kept.push(postId);
          continue;
        }

        const isAlertPost =
          post.category === "Earthquake" ||
          post.category === "Weather Alert" ||
          post.category === "Volcano Alert" ||
          post.category === "Embassy Alert" ||
          post.source === "USGS" ||
          post.source === "NWS" ||
          post.event_type === "earthquake" ||
          post.event_type === "weather" ||
          post.event_type === "volcano" ||
          post.event_type === "embassy";

        if (isAlertPost) {
          const postDate =
            post.datePosted || post.createdAt || post.created_at;
          if (postDate) {
            const postTimestamp = new Date(postDate).getTime();
            if (postTimestamp < cutoffTimestamp) {
              try {
                await store.delete(postKey(postId));
                removed.push({
                  id: postId,
                  category: post.category,
                  source: post.source,
                  datePosted: post.datePosted,
                  title: post.title,
                });
                continue;
              } catch (deleteErr) {
                console.error(`Error deleting post ${postId}:`, deleteErr);
              }
            }
          }
        }

        kept.push(postId);
      } catch (err) {
        console.error(`Error processing post ${postId}:`, err);
        kept.push(postId);
      }
    }

    await writeIndex(store, kept);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: `Removed ${removed.length} old alert posts (older than ${daysOld} days)`,
        removed: removed.length,
        kept: kept.length,
        cutoffDate: cutoffDate.toISOString(),
        details: removed,
      }),
    };
  } catch (error) {
    console.error("Error removing old alert posts:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || "Internal server error",
      }),
    };
  }
};
