/**
 * Remove long posts from volcano and weather alerts
 * Posts with story/text > 300 chars from these sources are pruned.
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

    const removed = [];
    const kept = [];

    for (const postId of ids) {
      try {
        const post = await readPost(store, postId);

        if (!post) {
          kept.push(postId);
          continue;
        }

        const isVolcano =
          post.category === "Volcano Alert" ||
          (post.source === "USGS" && post.event_type === "volcano");
        const isWeather =
          post.category === "Weather Alert" ||
          post.source === "NWS" ||
          post.event_type === "weather";

        const storyLength = (post.story || post.text || "").length;
        const isTooLong = storyLength > 300;

        if ((isVolcano || isWeather) && isTooLong) {
          try {
            await store.delete(postKey(postId));
            removed.push({
              id: postId,
              category: post.category,
              source: post.source,
              length: storyLength,
              title: post.title,
            });
          } catch (deleteErr) {
            console.error(`Error deleting post ${postId}:`, deleteErr);
            kept.push(postId);
          }
        } else {
          kept.push(postId);
        }
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
        message: `Removed ${removed.length} long posts`,
        removed: removed.length,
        kept: kept.length,
        details: removed,
      }),
    };
  } catch (error) {
    console.error("Error removing posts:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || "Internal server error",
      }),
    };
  }
};
