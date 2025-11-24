const { getStore } = require("@netlify/blobs");
const crypto = require("crypto");
const { validateUserName } = require("./user-validation");

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
      const { gameType, score, userId, userName, difficulty, level, streak, time, timeString, accuracy, isPerfectGame, correct, wrong, speedBonus, avgTime, gameMode } =
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
      
      // Validate userName - require user to change it if invalid
      const userNameValidation = validateUserName(userName);
      if (!userNameValidation.valid) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: userNameValidation.error || "Invalid name. Please choose a different name.",
            field: "userName"
          }),
        };
      }
      
      const filteredUserName = userNameValidation.cleaned;

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
        // Geography game specific fields
        ...(time !== undefined && { time: parseInt(time) }),
        ...(timeString && { timeString: timeString }),
        ...(accuracy !== undefined && { accuracy: parseInt(accuracy) }),
        ...(isPerfectGame !== undefined && { isPerfectGame: Boolean(isPerfectGame) }),
        ...(correct !== undefined && { correct: parseInt(correct) }),
        ...(wrong !== undefined && { wrong: parseInt(wrong) }),
        ...(speedBonus !== undefined && { speedBonus: parseInt(speedBonus) }),
        ...(avgTime !== undefined && { avgTime: parseFloat(avgTime) }),
        ...(gameMode && { gameMode: gameMode }),
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

