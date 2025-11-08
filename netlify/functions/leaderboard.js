const { getStore } = require("@netlify/blobs");

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
    const store = getStore({
      name: "leaderboard",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
    });

    if (event.httpMethod === "GET") {
      // Get leaderboard
      const gameType = event.queryStringParameters?.gameType || "fact-checker";
      const limit = parseInt(event.queryStringParameters?.limit || "10");

      const leaderboardKey = `leaderboard-${gameType}`;
      const leaderboardData = await store.get(leaderboardKey, {
        type: "json",
      });

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

      if (!gameType || score === undefined || !userId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Missing required fields" }),
        };
      }

      const leaderboardKey = `leaderboard-${gameType}`;
      const leaderboardData = await store.get(leaderboardKey, {
        type: "json",
      });

      let scores = leaderboardData || [];

      // Check if user already has a score
      const existingIndex = scores.findIndex((s) => s.userId === userId);

      const newScore = {
        userId,
        userName: userName || "Anonymous",
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

      await store.set(leaderboardKey, JSON.stringify(scores), {
        contentType: "application/json",
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

