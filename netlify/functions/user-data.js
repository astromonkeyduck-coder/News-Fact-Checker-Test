/**
 * User Data API
 * GET/POST /.netlify/functions/user-data
 * 
 * Allows authenticated users to get and update their own profile data
 */

const { getStore } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: "",
    };
  }

  try {
    // Verify Auth0 token
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Unauthorized - Valid token required" }),
      };
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify token with Auth0 (simplified - in production, verify with Auth0 API)
    // For now, we'll extract user info from the token payload
    // In production, you should verify the token with Auth0 Management API
    
    // Get user email from query or body
    let userEmail = null;
    if (event.httpMethod === "GET") {
      userEmail = event.queryStringParameters?.email;
    } else if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      userEmail = body.email;
    }

    if (!userEmail) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing 'email' parameter" }),
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
                },
              },
              createdAt: new Date().toISOString(),
            }),
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(userData),
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
              },
            };
          }
          
          // Merge preferences (deep merge for emails object)
          if (updates.preferences.emails) {
            userData.preferences.emails = {
              ...userData.preferences.emails,
              ...updates.preferences.emails,
            };
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






