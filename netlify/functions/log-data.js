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

// Convert logs to CSV format with human-readable columns
function logsToCSV(logs) {
  if (!logs || logs.length === 0) {
    return "No data available\n";
  }

  // Define column order and friendly names
  const baseColumns = [
    { key: 'timestamp', name: 'Date & Time' },
    { key: 'dataType', name: 'Activity Type' },
    { key: 'userEmail', name: 'User Email' },
    { key: 'userName', name: 'User Name' },
    { key: 'ip', name: 'IP Address' },
    { key: 'location', name: 'Location' },
  ];

  // Type-specific columns with friendly names
  const typeSpecificColumns = {
    'image-generation': [
      { key: 'data.userPrompt', name: 'Image Prompt' },
      { key: 'data.revisedPrompt', name: 'Revised Prompt' },
      { key: 'data.imageUrl', name: 'Image URL' },
      { key: 'data.size', name: 'Image Size' },
      { key: 'data.quality', name: 'Image Quality' },
      { key: 'data.model', name: 'AI Model' },
    ],
    'ai-chat': [
      { key: 'data.userMessage', name: 'User Message' },
      { key: 'data.aiResponse', name: 'AI Response' },
      { key: 'data.model', name: 'AI Model' },
      { key: 'data.endpoint', name: 'Chat Endpoint' },
      { key: 'data.usage.prompt_tokens', name: 'Input Tokens' },
      { key: 'data.usage.completion_tokens', name: 'Output Tokens' },
      { key: 'data.usage.total_tokens', name: 'Total Tokens' },
    ],
    'game-score': [
      { key: 'data.gameType', name: 'Game Type' },
      { key: 'data.userName', name: 'Player Name' },
      { key: 'data.score', name: 'Score' },
      { key: 'data.level', name: 'Level Reached' },
      { key: 'data.difficulty', name: 'Difficulty' },
      { key: 'data.streak', name: 'Best Streak' },
      { key: 'data.time', name: 'Time (seconds)' },
    ],
    'page-view': [
      { key: 'data.url', name: 'Page URL' },
      { key: 'data.title', name: 'Page Title' },
      { key: 'data.referrer', name: 'Referrer' },
    ],
    'comment': [
      { key: 'data.comment', name: 'Comment Text' },
      { key: 'data.postId', name: 'Post ID' },
      { key: 'data.author', name: 'Author' },
    ],
    'newsletter-signup': [
      { key: 'data.email', name: 'Email' },
      { key: 'data.source', name: 'Signup Source' },
    ],
    'tip-submission': [
      { key: 'data.name', name: 'Submitter Name' },
      { key: 'data.email', name: 'Submitter Email' },
      { key: 'data.tip', name: 'Tip Content' },
      { key: 'data.isAnonymous', name: 'Is Anonymous' },
      { key: 'data.tipLength', name: 'Tip Length' },
      { key: 'data.notificationSent', name: 'Notification Sent' },
      { key: 'data.confirmationSent', name: 'Confirmation Sent' },
    ],
  };

  // Get all unique data types in the logs
  const dataTypes = [...new Set(logs.map(log => log.dataType))];
  
  // Build column list: base columns + type-specific columns
  const allColumns = [...baseColumns];
  
  // Add type-specific columns for each type found
  dataTypes.forEach(type => {
    if (typeSpecificColumns[type]) {
      typeSpecificColumns[type].forEach(col => {
        // Only add if not already in list
        if (!allColumns.find(c => c.key === col.key)) {
          allColumns.push(col);
        }
      });
    }
  });

  // Helper function to get nested value
  function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }

  // Helper function to format value for CSV
  function formatValue(value) {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      // For objects, create a readable string
      if (Array.isArray(value)) {
        return value.join('; ');
      }
      // For location objects, format nicely
      if (value.city || value.country) {
        const parts = [];
        if (value.city) parts.push(value.city);
        if (value.region) parts.push(value.region);
        if (value.country) parts.push(value.country);
        return parts.join(', ');
      }
      // For other objects, use JSON but make it readable
      return JSON.stringify(value).replace(/"/g, "'");
    }
    // Format dates nicely
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
      try {
        const date = new Date(value);
        return date.toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      } catch (e) {
        return value;
      }
    }
    // Escape quotes and newlines
    return String(value).replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, '');
  }

  // Create CSV header with friendly names
  const headerRow = allColumns.map(col => `"${col.name}"`).join(',');
  const csvRows = [headerRow];

  // Create CSV rows
  logs.forEach(log => {
    const row = allColumns.map(col => {
      let value;
      
      if (col.key.startsWith('data.')) {
        // Get from log.data
        const dataPath = col.key.substring(5);
        value = getNestedValue(log.data, dataPath);
      } else if (col.key === 'location') {
        // Special handling for location
        value = log.location;
      } else {
        // Get from log root
        value = log[col.key];
      }
      
      return `"${formatValue(value)}"`;
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
    
    // If no email found in data, try to look it up from previous logs by IP
    if (!userEmail && ip && ip !== "unknown" && !ip.startsWith("127.") && !ip.startsWith("192.168.")) {
      try {
        const store = getStore({
          name: "analytics-data",
          siteID: process.env.NETLIFY_SITE_ID,
          token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
        });
        
        // Look up recent logs from the same IP (last 7 days)
        const today = new Date();
        const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        // Check recent dates
        for (let i = 0; i < 7; i++) {
          const checkDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
          const dateKey = checkDate.toISOString().split('T')[0];
          const logsKey = `logs-${dateKey}`;
          
          try {
            const existing = await store.get(logsKey, { type: "json" });
            if (existing && Array.isArray(existing)) {
              // Find logs with same IP that have an email
              const matchingLog = existing.find(log => 
                log.ip === ip && 
                log.userEmail && 
                log.userEmail !== 'Unknown' &&
                log.userEmail !== 'anonymous' &&
                log.userEmail.includes('@')
              );
              
              if (matchingLog && matchingLog.userEmail) {
                userEmail = matchingLog.userEmail.toLowerCase().trim();
                // Also get name if available
                if (!userName && matchingLog.userName) {
                  userName = matchingLog.userName.trim();
                }
                console.log(`[Data Log] Found email from previous log: ${userEmail} (IP: ${ip})`);
                break; // Found email, stop searching
              }
            }
          } catch (e) {
            // Continue to next date
            continue;
          }
        }
      } catch (lookupErr) {
        // If lookup fails, continue without email
        console.error("[Data Log] Error looking up email from previous logs:", lookupErr);
      }
    }
    
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
    
    // Check for location alerts (Gainesville FL, Boca Raton, PA, Canada, Auburn)
    let shouldAlert = false;
    let alertType = null;
    
    if (location && location.city) {
      const cityLower = location.city.toLowerCase();
      const regionLower = (location.region || '').toLowerCase();
      const countryLower = (location.country || '').toLowerCase();
      
      const isGainesville = cityLower.includes('gainesville') && (regionLower.includes('florida') || regionLower.includes('fl'));
      const isBocaRaton = (cityLower.includes('boca') && cityLower.includes('raton')) && (regionLower.includes('florida') || regionLower.includes('fl'));
      const isPennsylvania = regionLower.includes('pennsylvania') || regionLower === 'pa' || countryLower.includes('pennsylvania');
      const isCanada = countryLower.includes('canada') || countryLower === 'ca';
      const isAuburn = cityLower.includes('auburn');
      
      if (isGainesville || isBocaRaton || isPennsylvania || isCanada || isAuburn) {
        shouldAlert = true;
        if (isGainesville) alertType = 'Gainesville FL';
        else if (isBocaRaton) alertType = 'Boca Raton FL';
        else if (isPennsylvania) alertType = 'Pennsylvania';
        else if (isCanada) alertType = 'Canada';
        else if (isAuburn) alertType = 'Auburn';
      }
    }
    
    if (shouldAlert) {
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
            alertType: alertType,
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
          
          // Send email notification for page views from these locations (non-blocking)
          if (dataType === 'page-view') {
            try {
              const { Resend } = require('resend');
              const resend = new Resend(process.env.RESEND_API_KEY);
              
              // Get notification emails from environment variable
              let notificationEmails = [];
              if (process.env.AI_NOTIFICATION_EMAILS) {
                try {
                  notificationEmails = JSON.parse(process.env.AI_NOTIFICATION_EMAILS);
                  if (!Array.isArray(notificationEmails)) {
                    throw new Error('Not an array');
                  }
                } catch {
                  notificationEmails = process.env.AI_NOTIFICATION_EMAILS.split(',').map(e => e.trim()).filter(e => e);
                }
              }
              
              if (notificationEmails.length === 0) {
                notificationEmails = [process.env.ADMIN_NOTIFICATION_EMAIL || 'richard@noteworthynews.co'];
              }
              
              const fromEmail = process.env.RESEND_FROM_EMAIL || 'Noteworthy News <richard@noteworthynews.co>';
              
              const locationStr = `${location.city || ''}${location.region ? ', ' + location.region : ''}${location.country ? ', ' + location.country : ''}`.trim();
              const pageUrl = data.url || data.path || 'Unknown page';
              const pageTitle = data.title || 'Unknown page';
              
              // Send to all notification emails
              Promise.all(notificationEmails.map(email =>
                resend.emails.send({
                  from: fromEmail,
                  to: email,
                  subject: `📍 Visitor from ${alertType}`,
                  html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, rgba(231, 76, 60, 0.1) 0%, rgba(192, 57, 43, 0.1) 100%); border-radius: 10px 10px 0 0;">
              <h2 style="color: #e74c3c; margin: 0; font-size: 24px; font-weight: bold;">📍 Visitor Alert: ${alertType}</h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              <div style="padding: 20px; background: rgba(231, 76, 60, 0.1); border-left: 4px solid #e74c3c; border-radius: 8px; margin-bottom: 20px;">
                <p style="color: #e74c3c; font-size: 16px; font-weight: bold; margin: 0 0 10px 0;">📍 Location:</p>
                <p style="color: #333333; font-size: 18px; line-height: 1.6; margin: 0; font-weight: 600;">${locationStr}</p>
              </div>
              
              <div style="padding: 20px; background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border: 2px solid #4A90E2; border-radius: 8px; margin-bottom: 20px;">
                <p style="color: #333333; font-size: 16px; margin: 10px 0; line-height: 1.6;"><strong style="color: #4A90E2;">📄 Page Visited:</strong><br><span style="color: #666666; font-size: 15px;">${pageTitle}</span></p>
                <p style="color: #333333; font-size: 14px; margin: 5px 0; word-break: break-all;"><a href="${pageUrl}" style="color: #4A90E2; text-decoration: none;">${pageUrl}</a></p>
              </div>
              
              ${userEmail ? `
              <div style="padding: 15px; background: rgba(46, 204, 113, 0.1); border-left: 4px solid #2ecc71; border-radius: 6px; margin-bottom: 20px;">
                <p style="color: #333333; font-size: 16px; margin: 0; line-height: 1.6;"><strong style="color: #2ecc71;">👤 User Email:</strong> <span style="color: #666666; font-weight: 600;">${userEmail}</span></p>
              </div>
              ` : ''}
              
              <div style="padding: 15px; background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border: 2px solid #4A90E2; border-radius: 8px;">
                <p style="color: #333333; font-size: 14px; margin: 5px 0;"><strong style="color: #4A90E2;">🌐 IP Address:</strong> <span style="color: #666666;">${ip}</span></p>
                <p style="color: #333333; font-size: 14px; margin: 5px 0;"><strong style="color: #4A90E2;">📅 Time:</strong> <span style="color: #666666;">${new Date().toLocaleString()}</span></p>
                ${data.referrer ? `<p style="color: #333333; font-size: 14px; margin: 5px 0;"><strong style="color: #4A90E2;">🔙 Referrer:</strong> <span style="color: #666666;">${data.referrer.substring(0, 100)}</span></p>` : ''}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 30px 30px 30px; background-color: #ffffff; border-radius: 0 0 10px 10px;">
              <p style="color: #999999; font-size: 13px; margin: 0; line-height: 1.5; text-align: center;">This is an automated notification from your website.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
                  text: `Visitor Alert: ${alertType}

Location: ${locationStr}
Page Visited: ${pageTitle}
URL: ${pageUrl}
${userEmail ? `User Email: ${userEmail}\n` : ''}
IP Address: ${ip}
Time: ${new Date().toLocaleString()}
${data.referrer ? `Referrer: ${data.referrer}\n` : ''}

---
This is an automated notification from your website.`,
                }).catch(err => {
                  console.error(`[Data Log] Failed to send location alert email to ${email}:`, err);
                })
              )).catch(err => {
                console.error("[Data Log] Error sending location alert emails:", err);
              });
            } catch (emailErr) {
              console.error("[Data Log] Error setting up location alert emails:", emailErr);
            }
          }
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
