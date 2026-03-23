/**
 * User Data API
 * GET/POST /.netlify/functions/user-data
 * 
 * Allows authenticated users to get and update their own profile data.
 * Identity is verified server-side via Auth0 JWT — the email is extracted
 * from the token claims, NOT from the request body/query.
 */

const { getStore } = require("@netlify/blobs");
const { requireAuth } = require("./middleware/requireAuth");

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: "",
    };
  }

  try {
    const auth = await requireAuth(event);
    if (auth.statusCode) return auth;

    // Extract email from verified JWT claims (server-authoritative identity)
    const userEmail =
      auth.user.email ||
      auth.user["https://noteworthynews.co/email"] ||
      null;

    if (!userEmail) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Token does not contain an email claim. Ensure your Auth0 rules include email in the token.",
        }),
      };
    }

    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Data storage not configured" }),
      };
    }

    const store = getStore({
      name: "user-data",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
    });

    const userKey = `user-${userEmail.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const userDataKey = `${userKey}-data`;

    if (event.httpMethod === "GET") {
      // Get user data
      try {
        const userData = await store.get(userDataKey, { type: "json" });
        
        if (!userData) {
          // Return default structure if no data exists
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              email: userEmail,
              stats: {
                gamesPlayed: 0,
                highScore: 0,
                comments: 0,
                tipsSubmitted: 0,
              },
              bookmarks: [],
              readingHistory: [],
              preferences: {
                emails: {
                  leaderboard: true,
                  streak: true,
                  location: false,
                  earthquakeAlerts: false,
                  earthquakeMagnitudeMin: 6,
                },
              },
              createdAt: new Date().toISOString(),
            }),
          };
        }

        let payload = userData;
        if (userData.preferences?.emails?.earthquakeMagnitudeMin != null) {
          const n = Number(userData.preferences.emails.earthquakeMagnitudeMin);
          const clamped = Number.isFinite(n) ? Math.min(7, Math.max(6, n)) : 6;
          payload = {
            ...userData,
            preferences: {
              ...userData.preferences,
              emails: {
                ...userData.preferences.emails,
                earthquakeMagnitudeMin: clamped,
              },
            },
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(payload),
        };
      } catch (error) {
        console.error("Error getting user data:", error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: "Failed to retrieve user data" }),
        };
      }
    } else if (event.httpMethod === "POST") {
      // Update user data
      try {
        const body = JSON.parse(event.body || "{}");
        const updates = body.data || {};
        
        // Get existing data
        let userData = await store.get(userDataKey, { type: "json" });
        
        if (!userData) {
          // Create new user data
          userData = {
            email: userEmail,
            stats: {
              gamesPlayed: 0,
              highScore: 0,
              comments: 0,
              tipsSubmitted: 0,
            },
            preferences: {
              emails: {
                leaderboard: true,  // Default: enabled if email provided
                streak: true,        // Default: enabled
                location: false,     // Default: disabled (must opt-in)
                earthquakeAlerts: false, // Default: disabled (must opt-in)
                earthquakeMagnitudeMin: 6,
              },
            },
            createdAt: new Date().toISOString(),
          };
        }

        // Update stats if provided
        if (updates.stats) {
          userData.stats = {
            ...userData.stats,
            ...updates.stats,
          };
        }

        // Update preferences if provided
        if (updates.preferences) {
          // Initialize preferences structure if it doesn't exist
          if (!userData.preferences) {
            userData.preferences = {
              emails: {
                leaderboard: true,
                streak: true,
                location: false,
                earthquakeAlerts: false,
                earthquakeMagnitudeMin: 6,
              },
            };
          }
          
          // Merge preferences (deep merge for emails object)
          if (updates.preferences.emails) {
            userData.preferences.emails = {
              ...userData.preferences.emails,
              ...updates.preferences.emails,
            };
            const mm = userData.preferences.emails.earthquakeMagnitudeMin;
            if (mm !== undefined && mm !== null) {
              const n = Number(mm);
              userData.preferences.emails.earthquakeMagnitudeMin = Number.isFinite(n)
                ? Math.min(7, Math.max(6, n))
                : 6;
            }
          }
          
          // Merge other preferences
          userData.preferences = {
            ...userData.preferences,
            ...updates.preferences,
            emails: userData.preferences.emails, // Preserve merged emails
          };
        }

        // Update bookmarks if provided
        if (updates.bookmarks) {
          userData.bookmarks = updates.bookmarks;
        }

        // Update reading history if provided
        if (updates.readingHistory) {
          userData.readingHistory = updates.readingHistory;
        }

        // Update location preferences if provided
        if (updates.preferences?.location) {
          if (!userData.preferences) {
            userData.preferences = {};
          }
          userData.preferences.location = {
            ...userData.preferences.location,
            ...updates.preferences.location,
            lastUpdated: new Date().toISOString(),
          };
        }

        // Update last modified
        userData.updatedAt = new Date().toISOString();

        // Save to store
        await store.set(userDataKey, JSON.stringify(userData), {
          metadata: {
            email: userEmail,
            updatedAt: userData.updatedAt,
          },
        });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: userData,
          }),
        };
      } catch (error) {
        console.error("Error updating user data:", error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: "Failed to update user data" }),
        };
      }
    } else {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }
  } catch (error) {
    console.error("Error in user-data function:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};






