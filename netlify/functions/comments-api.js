/**
 * Comments API - Store and retrieve article comments
 * Uses Netlify Blobs for persistent storage across devices
 */

let getStore;
try {
  getStore = require("@netlify/blobs").getStore;
} catch (err) {
  console.warn("@netlify/blobs not available");
}

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle OPTIONS request
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  // Initialize store
  if (!getStore) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: "Storage not available" }),
    };
  }

  // getStore automatically uses the site ID and token when called from Netlify Functions
  const store = getStore("comments");

  try {
    const { articleId, commentId, text, author, authorEmail, authorId } = JSON.parse(
      event.body || "{}"
    );

    // GET: Fetch comments for an article
    if (event.httpMethod === "GET") {
      const articleIdParam = event.queryStringParameters?.articleId;
      
      if (!articleIdParam) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "articleId is required" }),
        };
      }

      try {
        const commentsKey = `comments_${articleIdParam}`;
        const commentsData = await store.get(commentsKey, { type: "json" });
        const comments = commentsData || [];
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ comments }),
        };
      } catch (err) {
        // If no comments exist, return empty array
        if (err.status === 404 || err.message?.includes("not found")) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ comments: [] }),
          };
        }
        throw err;
      }
    }

    // POST: Add a new comment
    if (event.httpMethod === "POST") {
      if (!articleId || !text || !author || !authorId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: "articleId, text, author, and authorId are required",
          }),
        };
      }

      // Validate text length
      if (text.trim().length < 3) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Comment must be at least 3 characters" }),
        };
      }

      const commentsKey = `comments_${articleId}`;
      
      // Load existing comments
      let comments = [];
      try {
        const existing = await store.get(commentsKey, { type: "json" });
        comments = existing || [];
      } catch (err) {
        // No existing comments, start fresh
        comments = [];
      }

      // Create new comment
      const newComment = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        text: text.trim(),
        author: author.trim(),
        authorEmail: authorEmail || "",
        authorId: authorId,
        timestamp: Date.now(),
        date: new Date().toLocaleDateString(),
      };

      // Add to beginning of array
      comments.unshift(newComment);

      // Save back to store
      await store.set(commentsKey, JSON.stringify(comments), {
        contentType: "application/json",
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, comment: newComment }),
      };
    }

    // DELETE: Delete a comment
    if (event.httpMethod === "DELETE") {
      if (!articleId || !commentId || !authorId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: "articleId, commentId, and authorId are required",
          }),
        };
      }

      const commentsKey = `comments_${articleId}`;
      
      // Load existing comments
      let comments = [];
      try {
        const existing = await store.get(commentsKey, { type: "json" });
        comments = existing || [];
      } catch (err) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: "Article comments not found" }),
        };
      }

      // Find and verify comment ownership
      const commentIndex = comments.findIndex((c) => c.id === commentId);
      if (commentIndex === -1) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: "Comment not found" }),
        };
      }

      const comment = comments[commentIndex];
      if (comment.authorId !== authorId && comment.authorEmail !== event.headers["x-user-email"]) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: "You can only delete your own comments" }),
        };
      }

      // Remove comment
      comments.splice(commentIndex, 1);

      // Save back to store
      await store.set(commentsKey, JSON.stringify(comments), {
        contentType: "application/json",
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true }),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  } catch (err) {
    console.error("Error in comments API:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Internal server error",
        message: err.message,
      }),
    };
  }
};

