const { requireAdminAuth } = require("./middleware/requireAuth");
const {
  getPostStore,
  readIndex,
  readPost,
  deletePost,
} = require("./lib/postStore");

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const auth = await requireAdminAuth(event);
  if (auth.statusCode) return auth;

  try {
    const { postId } = JSON.parse(event.body || "{}");

    if (!postId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "postId is required" }),
      };
    }

    const store = getPostStore();

    const indexBefore = await readIndex(store);
    const wasInIndex = indexBefore.includes(postId);

    await deletePost(store, postId);

    const indexAfter = await readIndex(store);

    console.log(`[remove-post] Deleted post ${postId}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Post ${postId} deleted`,
        removed: wasInIndex,
        deletedFromStorage: true,
        removedFromIndex: wasInIndex,
        previousCount: indexBefore.length,
        newCount: indexAfter.length,
      }),
    };
  } catch (error) {
    console.error("[remove-post] Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error?.message || "Failed to remove post",
      }),
    };
  }
};
