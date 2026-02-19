/**
 * Email Preferences API (Link-based - no auth required)
 * 
 * For use with "Manage preferences" links in emails. Identifies user by email from URL.
 * 
 * GET  /.netlify/functions/email-preferences-link?email=<base64>
 * POST /.netlify/functions/email-preferences-link  { email: "<base64>", preferences: { leaderboard, streak, location } }
 */

const {
  getUserEmailPreferences,
  updateEmailPreferences,
} = require("./lib/emailPreferences");

function decodeEmail(encoded) {
  if (!encoded) return null;
  try {
    return Buffer.from(encoded, "base64").toString("utf-8");
  } catch {
    return null;
  }
}

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  let email = null;
  if (event.httpMethod === "GET") {
    const params = event.queryStringParameters || {};
    const encoded = params.email;
    email = decodeEmail(encoded);
  } else {
    try {
      const body = JSON.parse(event.body || "{}");
      const encoded = body.email;
      email = decodeEmail(encoded);
    } catch {
      email = null;
    }
  }

  if (!email || !email.includes("@")) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Valid email parameter required" }),
    };
  }

  try {
    if (event.httpMethod === "GET") {
      const preferences = await getUserEmailPreferences(email);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          email: email,
          preferences: {
            leaderboard: preferences.leaderboard,
            streak: preferences.streak,
            location: preferences.location,
            earthquakeAlerts: preferences.earthquakeAlerts ?? false,
            earthquakeMagnitudeMin: preferences.earthquakeMagnitudeMin ?? 6,
          },
        }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const updates = body.preferences || {};

    const allowed = ["leaderboard", "streak", "location", "earthquakeAlerts", "earthquakeMagnitudeMin"];
    const sanitized = {};
    for (const key of allowed) {
      if (key === "earthquakeMagnitudeMin") {
        const v = updates[key];
        if ([4, 5, 6, 7].includes(Number(v))) {
          sanitized[key] = Number(v);
        }
      } else if (key in updates && typeof updates[key] === "boolean") {
        sanitized[key] = updates[key];
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "No valid preferences to update" }),
      };
    }

    const ok = await updateEmailPreferences(email, sanitized);
    if (!ok) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Failed to update preferences" }),
      };
    }

    const updated = await getUserEmailPreferences(email);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        preferences: {
          leaderboard: updated.leaderboard,
          streak: updated.streak,
          location: updated.location,
          earthquakeAlerts: updated.earthquakeAlerts ?? false,
          earthquakeMagnitudeMin: updated.earthquakeMagnitudeMin ?? 6,
        },
      }),
    };
  } catch (err) {
    console.error("[email-preferences-link]", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
