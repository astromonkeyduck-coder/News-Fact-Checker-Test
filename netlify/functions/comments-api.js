/**
 * Comments API - Store and retrieve article comments
 * Uses Netlify Blobs for persistent storage across devices.
 * DELETE requires a verified Auth0 JWT - ownership is checked
 * against the JWT's sub/email, not a client-supplied authorId.
 */

const { validateUserName } = require("./user-validation");
const { verifyToken } = require("./middleware/requireAuth");

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
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

  // Get siteID and token from environment (Netlify automatically sets these)
  // For Functions, we need to explicitly pass them if auto-detection fails
  const siteID = process.env.NETLIFY_SITE_ID || context?.site?.id || event.headers['x-nf-site-id'];
  const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN || context?.token || event.headers['x-nf-token'];
  
  let store;
  try {
    // Try with explicit siteID and token if available
    if (siteID && token) {
      console.log('[Comments API] Using explicit siteID and token');
      store = getStore({
        name: "comments",
        siteID: siteID,
        token: token,
      });
    } else {
      // Fallback: try automatic detection (works in most Netlify environments)
      console.log('[Comments API] Using automatic detection');
      store = getStore("comments");
    }
  } catch (storeErr) {
    console.error('[Comments API] Failed to create store:', storeErr);
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error: "Storage configuration error",
        message: storeErr.message,
      }),
    };
  }

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
        console.log('[Comments API] GET error (likely no comments yet):', err.message);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ comments: [] }),
        };
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

      // Validate author name - require user to change it if invalid
      const userNameValidation = validateUserName(author);
      if (!userNameValidation.valid) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: userNameValidation.error || "Invalid name. Please choose a different name.",
            field: "author"
          }),
        };
      }

      // Content moderation: Check for profanity and inappropriate content
      console.log('[Comments API] Running content moderation...');
      try {
        const baseUrl = process.env.URL || 'https://noteworthynews.co';
        const moderationUrl = `${baseUrl}/.netlify/functions/moderate-comment`;
        
        const moderationResponse = await fetch(moderationUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text.trim(), author: author }),
        });

        if (moderationResponse.ok) {
          const moderationResult = await moderationResponse.json();
          
          if (!moderationResult.approved) {
            const reason = moderationResult.reasons || 'Content contains inappropriate language';
            console.log('[Comments API] Comment rejected by moderation:', reason);
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ 
                error: "Your comment contains inappropriate content. Please revise and try again.",
                field: "text",
                reason: reason
              }),
            };
          }
          console.log('[Comments API] Comment approved by moderation');
        } else {
          console.warn('[Comments API] Moderation check failed, allowing comment (moderation unavailable)');
          // If moderation fails, allow comment but log it
        }
      } catch (moderationError) {
        console.error('[Comments API] Error in content moderation:', moderationError);
        // If moderation errors, allow comment but log it
        // In production, you might want to be more strict
      }

      const commentsKey = `comments_${articleId}`;
      
      // Load existing comments
      let comments = [];
      try {
        const existing = await store.get(commentsKey, { type: "json" });
        comments = existing || [];
      } catch (err) {
        // No existing comments, start fresh
        console.log('[Comments API] No existing comments for', commentsKey);
        comments = [];
      }

      // Create new comment with validated/cleaned author name
      const newComment = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        text: text.trim(),
        author: userNameValidation.cleaned,
        authorEmail: authorEmail || "",
        authorId: authorId,
        timestamp: Date.now(),
        date: new Date().toLocaleDateString(),
        upvotes: 0,
        downvotes: 0,
        replies: [],
        parentId: null, // null for top-level comments, comment ID for replies
      };

      // Add to beginning of array
      comments.unshift(newComment);

      // Save back to store using setJSON (convenience method for JSON)
      await store.setJSON(commentsKey, comments);

      // Log comment submission (non-blocking)
      try {
        const { logData } = require("./log-data");
        const { getLocationFromIP } = require("./get-location");
        const ip = event.headers["x-forwarded-for"]?.split(",")[0]?.trim() || 
                   event.headers["x-real-ip"] || 
                   event.headers["cf-connecting-ip"] || 
                   "unknown";
        const location = await getLocationFromIP(ip);
        
        logData("comment", {
          articleId: articleId,
          commentText: text.trim(),
          author: author.trim(),
          authorEmail: authorEmail || "",
          authorId: authorId,
          location: location,
        }, event).catch(err => {
          console.error("[Comments API] Failed to log comment:", err);
        });
      } catch (logErr) {
        console.error("[Comments API] Error setting up comment logging:", logErr);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, comment: newComment }),
      };
    }

    // DELETE: Delete a comment (requires verified JWT)
    if (event.httpMethod === "DELETE") {
      if (!articleId || !commentId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: "articleId and commentId are required",
          }),
        };
      }

      // Verify caller identity via JWT
      const tokenResult = await verifyToken(event);
      if (!tokenResult) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: "Unauthorized - valid Bearer token required to delete comments" }),
        };
      }

      const verifiedSub = tokenResult.payload.sub;
      const verifiedEmail = tokenResult.payload.email ||
        tokenResult.payload["https://noteworthynews.co/email"];

      const commentsKey = `comments_${articleId}`;
      
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

      const commentIndex = comments.findIndex((c) => c.id === commentId);
      if (commentIndex === -1) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: "Comment not found" }),
        };
      }

      // Ownership check against server-verified identity
      const comment = comments[commentIndex];
      const ownsComment =
        (verifiedSub && comment.authorId === verifiedSub) ||
        (verifiedEmail && comment.authorEmail === verifiedEmail);

      if (!ownsComment) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: "You can only delete your own comments" }),
        };
      }

      comments.splice(commentIndex, 1);
      await store.setJSON(commentsKey, comments);

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

