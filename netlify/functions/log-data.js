const { getStore } = require("@netlify/blobs");

/**
 * Comprehensive data logging system for Noteworthy News
 * Logs: IP addresses, AI interactions, user inputs, analytics, and more
 * Supports: CSV export, real-time streaming, comprehensive visitor tracking
 */

// Get client IP address from request
function getClientIP(event) {
  // Try various headers (Netlify, Cloudflare, etc.)
  return (
    event.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    event.headers["x-real-ip"] ||
    event.headers["cf-connecting-ip"] ||
    event.headers["client-ip"] ||
    event.requestContext?.identity?.sourceIp ||
    "unknown"
  );
}

// Get user agent and other request metadata
function getRequestMetadata(event) {
  return {
    userAgent: event.headers["user-agent"] || "unknown",
    referer: event.headers["referer"] || event.headers["referrer"] || "unknown",
    acceptLanguage: event.headers["accept-language"] || "unknown",
    acceptEncoding: event.headers["accept-encoding"] || "unknown",
    timestamp: new Date().toISOString(),
  };
}

// Convert logs to CSV format
function logsToCSV(logs) {
  if (!logs || logs.length === 0) {
    return "No data available\n";
  }

  // Get all unique keys from all log entries
  const allKeys = new Set();
  logs.forEach(log => {
    Object.keys(log).forEach(key => allKeys.add(key));
    if (log.data && typeof log.data === 'object') {
      Object.keys(log.data).forEach(key => allKeys.add(`data.${key}`));
    }
  });

  const headers = Array.from(allKeys).sort();
  
  // Create CSV header
  const csvRows = [headers.map(h => `"${h}"`).join(',')];

  // Create CSV rows
  logs.forEach(log => {
    const row = headers.map(header => {
      let value;
      if (header.startsWith('data.')) {
        const dataKey = header.substring(5);
        value = log.data?.[dataKey];
      } else {
        value = log[header];
      }
      
      // Handle different value types
      if (value === null || value === undefined) {
        return '""';
      } else if (typeof value === 'object') {
        return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      } else {
        return `"${String(value).replace(/"/g, '""')}"`;
      }
    });
    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
}

/**
 * Log data to Netlify Blobs storage
 * @param {string} dataType - Type of data (e.g., 'ai-chat', 'game-score', 'page-view')
 * @param {object} data - The data to log
 * @param {object} event - Netlify function event (for IP and metadata)
 */
async function logData(dataType, data, event = null) {
  try {
    // Check if store is configured
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
      console.error("[Data Log] Missing environment variables:", {
        hasSiteId: !!process.env.NETLIFY_SITE_ID,
        hasToken: !!process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
        dataType: dataType
      });
      // In local dev, still log to console for debugging
      if (process.env.NETLIFY_DEV) {
        console.log("[Data Log] Local dev mode - logging to console:", {
          dataType,
          data,
          timestamp: new Date().toISOString()
        });
      }
      return { success: false, error: "Not configured" };
    }

    const store = getStore({
      name: "analytics-data",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
    });

    // Get IP and metadata if event is provided
    const ip = event ? getClientIP(event) : "unknown";
    const metadata = event ? getRequestMetadata(event) : { timestamp: new Date().toISOString() };
    
    // Extract email from data if present (for user identification)
    let userEmail = null;
    let userName = null;
    
    // Check various places where email might be stored
    if (data.email) userEmail = data.email.toLowerCase().trim();
    if (data.authorEmail) userEmail = data.authorEmail.toLowerCase().trim();
    if (data.userEmail) userEmail = data.userEmail.toLowerCase().trim();
    
    // Extract name from data if present
    if (data.fullName) userName = data.fullName.trim();
    if (data.author) userName = data.author.trim();
    if (data.userName && data.userName !== 'Anonymous') userName = data.userName.trim();
    if (data.firstName && !userName) userName = data.firstName.trim();
    
    // Get location from IP (non-blocking, don't wait if it takes too long)
    let location = null;
    if (ip && ip !== "unknown" && !ip.startsWith("127.") && !ip.startsWith("192.168.")) {
      try {
        const { getLocationFromIP } = require("./get-location");
        // Use Promise.race to timeout after 2 seconds
        location = await Promise.race([
          getLocationFromIP(ip),
          new Promise(resolve => setTimeout(() => resolve(null), 2000))
        ]);
      } catch (err) {
        console.error("[Data Log] Error getting location:", err);
      }
    }

    // Create log entry
    const logEntry = {
      dataType,
      ip,
      location: location,
      userEmail: userEmail,
      userName: userName,
      ...metadata,
      data,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    
    // Check for location alerts (Gainesville FL, Boca Raton, PA)
    if (location && location.city) {
      const cityLower = location.city.toLowerCase();
      const regionLower = (location.region || '').toLowerCase();
      const countryLower = (location.country || '').toLowerCase();
      
      const isGainesville = cityLower.includes('gainesville') && (regionLower.includes('florida') || regionLower.includes('fl'));
      const isBocaRaton = (cityLower.includes('boca') && cityLower.includes('raton')) && (regionLower.includes('florida') || regionLower.includes('fl'));
      const isPennsylvania = regionLower.includes('pennsylvania') || regionLower === 'pa' || countryLower.includes('pennsylvania');
      
      if (isGainesville || isBocaRaton || isPennsylvania) {
        // Store alert
        try {
          const alertKey = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const alertData = {
            id: alertKey,
            timestamp: new Date().toISOString(),
            location: location,
            ip: ip,
            userEmail: userEmail,
            userName: userName,
            dataType: dataType,
            alertType: isGainesville ? 'Gainesville FL' : isBocaRaton ? 'Boca Raton FL' : 'Pennsylvania',
          };
          
          // Store alert in alerts list
          const alertsKey = 'location-alerts';
          let alerts = [];
          try {
            const existing = await store.get(alertsKey, { type: "json" });
            alerts = existing || [];
          } catch (e) {
            alerts = [];
          }
          
          alerts.unshift(alertData); // Add to beginning
          // Keep last 1000 alerts
          if (alerts.length > 1000) {
            alerts = alerts.slice(0, 1000);
          }
          
          await store.set(alertsKey, JSON.stringify(alerts), {
            contentType: "application/json",
          });
          
          // Also store individual alert
          await store.set(alertKey, JSON.stringify(alertData), {
            contentType: "application/json",
          });
          
          console.log(`[Data Log] 🚨 ALERT: ${alertData.alertType} - ${location.city}, ${location.region || location.country}`);
        } catch (alertErr) {
          console.error("[Data Log] Error storing alert:", alertErr);
        }
      }
    }
    
    // If we have an email, also store in user-specific index for grouping
    if (userEmail) {
      try {
        const userKey = `user-${userEmail.replace(/[^a-z0-9]/g, '-')}`;
        const userLogsKey = `${userKey}-logs`;
        
        // Get existing user logs
        let userLogs = [];
        try {
          const existing = await store.get(userLogsKey, { type: "json" });
          userLogs = existing || [];
        } catch (e) {
          userLogs = [];
        }
        
        // Add this log entry
        userLogs.push(logEntry);
        
        // Keep last 10000 entries per user
        if (userLogs.length > 10000) {
          userLogs = userLogs.slice(-10000);
        }
        
        // Save user logs
        await store.set(userLogsKey, JSON.stringify(userLogs), {
          contentType: "application/json",
        });
        
        // Also update user profile with latest info
        const userProfileKey = `${userKey}-profile`;
        let userProfile = {
          email: userEmail,
          name: userName || 'Unknown',
          firstSeen: userLogs.length === 1 ? new Date().toISOString() : (userLogs[0]?.timestamp || new Date().toISOString()),
          lastSeen: new Date().toISOString(),
          totalActivities: userLogs.length,
          location: location,
        };
        
        // Try to get existing profile to preserve firstSeen
        try {
          const existing = await store.get(userProfileKey, { type: "json" });
          if (existing) {
            userProfile.firstSeen = existing.firstSeen || userProfile.firstSeen;
            userProfile.name = userName || existing.name || 'Unknown';
          }
        } catch (e) {
          // New user
        }
        
        await store.set(userProfileKey, JSON.stringify(userProfile), {
          contentType: "application/json",
        });
        
        console.log(`[Data Log] Also saved to user index: ${userEmail}`);
      } catch (userErr) {
        console.error("[Data Log] Error saving to user index:", userErr);
        // Don't fail the main log if user index fails
      }
    }

    // Store by date for easy querying
    const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const dateKey = `logs-${date}`;
    const typeKey = `${dataType}-${date}`;

    // Get existing logs for today
    let dailyLogs = [];
    try {
      const existing = await store.get(dateKey, { type: "json" });
      dailyLogs = existing || [];
    } catch (e) {
      // First log of the day
      dailyLogs = [];
    }

    // Get existing logs for this type today
    let typeLogs = [];
    try {
      const existing = await store.get(typeKey, { type: "json" });
      typeLogs = existing || [];
    } catch (e) {
      typeLogs = [];
    }

    // Add new log entry
    dailyLogs.push(logEntry);
    typeLogs.push(logEntry);

    // Keep only last 50000 entries per day (to prevent storage bloat)
    if (dailyLogs.length > 50000) {
      dailyLogs = dailyLogs.slice(-50000);
    }
    if (typeLogs.length > 50000) {
      typeLogs = typeLogs.slice(-50000);
    }

    // Save logs
    await store.set(dateKey, JSON.stringify(dailyLogs), {
      contentType: "application/json",
    });

    await store.set(typeKey, JSON.stringify(typeLogs), {
      contentType: "application/json",
    });

    // Also save individual entry for detailed queries (optional, can be disabled if too much storage)
    const entryKey = `entry-${logEntry.id}`;
    await store.set(entryKey, JSON.stringify(logEntry), {
      contentType: "application/json",
    });

    console.log(`[Data Log] Logged ${dataType} entry:`, logEntry.id);
    return { success: true, id: logEntry.id, entry: logEntry };
  } catch (error) {
    console.error(`[Data Log] Error logging ${dataType}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Main handler for logging endpoint
 * Can be called directly or used by other functions
 */
exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { dataType, data } = body;

      if (!dataType) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "dataType is required" }),
        };
      }

      const result = await logData(dataType, data, event);

      return {
        statusCode: result.success ? 200 : 500,
        headers,
        body: JSON.stringify(result),
      };
    }

    if (event.httpMethod === "GET") {
      // SECURITY: Require admin token for viewing logs (GET requests)
      const adminToken = process.env.ADMIN_ANALYTICS_TOKEN;
      const providedToken = event.queryStringParameters?.token || event.headers["x-admin-token"];
      
      if (adminToken && providedToken !== adminToken) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: "Unauthorized - Admin token required" }),
        };
      }
      
      // Check for alerts endpoint
      if (event.queryStringParameters?.alerts === 'true') {
        try {
          const alertsKey = 'location-alerts';
          const alerts = await store.get(alertsKey, { type: "json" }) || [];
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ alerts: alerts.slice(0, 100), count: alerts.length }),
          };
        } catch (e) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ alerts: [], count: 0 }),
          };
        }
      }
      
      // Check for CSV export
      const format = event.queryStringParameters?.format;
      const date = event.queryStringParameters?.date || new Date().toISOString().split("T")[0];
      const dataType = event.queryStringParameters?.type;
      const userEmail = event.queryStringParameters?.userEmail; // Filter by user email
      const limit = parseInt(event.queryStringParameters?.limit || "10000");

      if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: "Data logging not configured" }),
        };
      }

      const store = getStore({
        name: "analytics-data",
        siteID: process.env.NETLIFY_SITE_ID,
        token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
      });

      let logs = [];

      // If filtering by user email, get from user index
      if (userEmail) {
        const userKey = `user-${userEmail.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        const userLogsKey = `${userKey}-logs`;
        try {
          const userData = await store.get(userLogsKey, { type: "json" });
          logs = userData || [];
          
          // Filter by date if specified
          if (date) {
            logs = logs.filter(log => {
              const logDate = new Date(log.timestamp).toISOString().split("T")[0];
              return logDate === date;
            });
          }
          
          // Filter by type if specified
          if (dataType) {
            logs = logs.filter(log => log.dataType === dataType);
          }
        } catch (e) {
          logs = [];
        }
      } else if (dataType) {
        // Get logs for specific type
        const typeKey = `${dataType}-${date}`;
        try {
          const data = await store.get(typeKey, { type: "json" });
          logs = data || [];
        } catch (e) {
          logs = [];
        }
      } else {
        // Get all logs for date
        const dateKey = `logs-${date}`;
        try {
          const data = await store.get(dateKey, { type: "json" });
          logs = data || [];
        } catch (e) {
          logs = [];
        }
      }

      // Return limited results
      logs = logs.slice(-limit).reverse(); // Most recent first

      // If CSV format requested
      if (format === "csv") {
        const csv = logsToCSV(logs);
        return {
          statusCode: 200,
          headers: {
            ...headers,
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="noteworthy-data-${date}${dataType ? `-${dataType}` : ''}.csv"`,
          },
          body: csv,
        };
      }

      // Default JSON response
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ logs, count: logs.length }),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  } catch (error) {
    console.error("[Data Log] Handler error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

// Export logData for use in other functions
exports.logData = logData;
exports.getClientIP = getClientIP;
exports.logsToCSV = logsToCSV;
