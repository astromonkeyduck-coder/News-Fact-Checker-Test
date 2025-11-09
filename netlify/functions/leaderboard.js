const { getStore } = require("@netlify/blobs");
const crypto = require("crypto");

// Profanity and inappropriate content filter
function filterInappropriateContent(text) {
  if (!text || typeof text !== "string") {
    return "Anonymous";
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
      return "Anonymous";
    }
  }

  // Check for excessive special characters or numbers (likely spam)
  const specialCharCount = (text.match(/[^a-zA-Z0-9\s]/g) || []).length;
  const numberCount = (text.match(/[0-9]/g) || []).length;
  if (specialCharCount > text.length * 0.3 || numberCount > text.length * 0.5) {
    return "Anonymous";
  }

  // Trim and limit length
  let cleaned = text.trim();
  if (cleaned.length > 30) {
    cleaned = cleaned.substring(0, 30);
  }
  if (cleaned.length === 0) {
    return "Anonymous";
  }

  return cleaned;
}

// Generate a unique user ID for anonymous users
function generateUserId() {
  return `anon_${crypto.randomBytes(16).toString("hex")}`;
}

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    // Check if required environment variables are set
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
      console.error("Missing required environment variables for leaderboard store");
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: "Leaderboard service not configured. Please contact support." 
        }),
      };
    }

    const store = getStore({
      name: "leaderboard",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
    });

    if (event.httpMethod === "GET") {
      // Get leaderboard
      const gameType = event.queryStringParameters?.gameType || "fact-checker";
      const limit = parseInt(event.queryStringParameters?.limit || "10");

      console.log(`[Leaderboard API] GET request - gameType: ${gameType}, limit: ${limit}`);

      const leaderboardKey = `leaderboard-${gameType}`;
      let leaderboardData;
      
      try {
        leaderboardData = await store.get(leaderboardKey, {
          type: "json",
        });
        console.log(`[Leaderboard API] Retrieved data for ${leaderboardKey}:`, leaderboardData ? `${Array.isArray(leaderboardData) ? leaderboardData.length : 'object'} items` : 'null');
      } catch (storeError) {
        console.error(`[Leaderboard API] Error getting data from store:`, storeError);
        // Return empty array if store read fails
        leaderboardData = null;
      }

      let scores = leaderboardData || [];

      // Sort by score (descending), then by date (ascending for tie-breaker)
      scores.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return new Date(a.date) - new Date(b.date);
      });

      // Return top N scores
      scores = scores.slice(0, limit);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ scores }),
      };
    }

    if (event.httpMethod === "POST") {
      // Submit a score
      const body = JSON.parse(event.body || "{}");
      const { gameType, score, userId, userName, difficulty, level, streak } =
        body;

      if (!gameType || score === undefined) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Missing required fields: gameType and score" }),
        };
      }

      // Generate userId if not provided
      const finalUserId = userId || generateUserId();
      
      // Filter inappropriate content from userName
      const filteredUserName = filterInappropriateContent(userName);

      console.log(`[Leaderboard API] POST request - gameType: ${gameType}, score: ${score}, userName: ${userName}`);

      const leaderboardKey = `leaderboard-${gameType}`;
      let leaderboardData;
      
      try {
        leaderboardData = await store.get(leaderboardKey, {
          type: "json",
        });
        console.log(`[Leaderboard API] Retrieved existing data:`, leaderboardData ? `${Array.isArray(leaderboardData) ? leaderboardData.length : 'object'} items` : 'null');
      } catch (storeError) {
        console.error(`[Leaderboard API] Error getting data from store:`, storeError);
        leaderboardData = null;
      }

      let scores = leaderboardData || [];

      // Check if user already has a score
      const existingIndex = scores.findIndex((s) => s.userId === finalUserId);

      const newScore = {
        userId: finalUserId,
        userName: filteredUserName,
        score: parseInt(score),
        difficulty: difficulty || "easy",
        level: level || 1,
        streak: streak || 0,
        date: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        // Update if new score is higher
        if (newScore.score > scores[existingIndex].score) {
          scores[existingIndex] = newScore;
        }
      } else {
        // Add new score
        scores.push(newScore);
      }

      // Sort and keep top 100
      scores.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return new Date(a.date) - new Date(b.date);
      });

      scores = scores.slice(0, 100);

      try {
        await store.set(leaderboardKey, JSON.stringify(scores), {
          contentType: "application/json",
        });
        console.log(`[Leaderboard API] Successfully saved ${scores.length} scores to ${leaderboardKey}`);
      } catch (storeError) {
        console.error(`[Leaderboard API] Error saving to store:`, storeError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: "Failed to save score to leaderboard" }),
        };
      }

      // Log game score submission (non-blocking - don't wait for it)
      const { logData } = require("./log-data");
      logData("game-score", {
        gameType: gameType,
        score: newScore.score,
        userName: filteredUserName,
        userId: finalUserId,
        difficulty: newScore.difficulty,
        level: newScore.level,
        streak: newScore.streak,
        time: body.time || null,
        speedBonus: body.speedBonus || null,
        avgTime: body.avgTime || null,
      }, event).catch(err => {
        console.error("[Leaderboard] Failed to log score data:", err);
        // Don't fail the request if logging fails
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, score: newScore }),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  } catch (error) {
    console.error("Leaderboard error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

