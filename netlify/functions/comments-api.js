/**
 * Comments API - Store and retrieve article comments
 * Uses Netlify Blobs for persistent storage across devices
 */

// User name validation function (same as leaderboard)
// Returns { valid: boolean, error?: string, cleaned?: string }
function validateUserName(text) {
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return { 
      valid: false, 
      error: "Name cannot be empty. Please enter a valid name." 
    };
  }

  // Normalize text (lowercase, remove special characters for checking)
  const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, "");

  // List of inappropriate words/phrases (common profanity and offensive terms)
  const inappropriateWords = [
    "fuck", "shit", "damn", "bitch", "asshole", "bastard", "cunt", "dick",
    "piss", "crap", "hell", "slut", "whore", "retard", "nigger", "nigga",
    "fag", "faggot", "kike", "spic", "chink", "gook", "towelhead", "terrorist",
    "nazi", "hitler", "kill", "murder", "death", "suicide", "rape", "sex",
    "porn", "xxx", "adult", "nsfw", "penis", "vagina", "boob", "tits",
    "cock", "pussy", "cum", "jizz", "orgasm", "masturbat", "ejaculat",
    "scam", "spam", "hack", "virus", "malware", "phishing", "fraud",
    "admin", "moderator", "owner", "founder", "official", "noteworthy",
    "breakingnews", "breaking", "news", "noteworthynews"
  ];

  // Check for inappropriate words
  for (const word of inappropriateWords) {
    if (normalized.includes(word)) {
      return { 
        valid: false, 
        error: "Name contains inappropriate content. Please choose a different name." 
      };
    }
  }

  // Check for excessive special characters or numbers (likely spam)
  const specialCharCount = (text.match(/[^a-zA-Z0-9\s]/g) || []).length;
  const numberCount = (text.match(/[0-9]/g) || []).length;
  if (specialCharCount > text.length * 0.3 || numberCount > text.length * 0.5) {
    return { 
      valid: false, 
      error: "Name contains too many special characters or numbers. Please use a more appropriate name." 
    };
  }

  // Trim and limit length
  let cleaned = text.trim();
  if (cleaned.length > 30) {
    return { 
      valid: false, 
      error: "Name is too long. Please use a name with 30 characters or less." 
    };
  }
  
  if (cleaned.length === 0) {
    return { 
      valid: false, 
      error: "Name cannot be empty. Please enter a valid name." 
    };
  }

  return { valid: true, cleaned: cleaned };
}

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

      // Save back to store using setJSON
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

