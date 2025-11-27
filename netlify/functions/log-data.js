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
  const timestamp = new Date();
  return {
    userAgent: event.headers["user-agent"] || "unknown",
    referer: event.headers["referer"] || event.headers["referrer"] || "unknown",
    acceptLanguage: event.headers["accept-language"] || "unknown",
    acceptEncoding: event.headers["accept-encoding"] || "unknown",
    timestamp: timestamp.toISOString(),
    date: timestamp.toISOString().split("T")[0], // YYYY-MM-DD
    time: timestamp.toISOString().split("T")[1].split(".")[0], // HH:MM:SS
    dayOfWeek: timestamp.toLocaleDateString('en-US', { weekday: 'long' }),
    hour: timestamp.getHours(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
    { key: 'date', name: 'Date' },
    { key: 'time', name: 'Time' },
    { key: 'dayOfWeek', name: 'Day of Week' },
    { key: 'hour', name: 'Hour' },
    { key: 'dataType', name: 'Activity Type' },
    { key: 'userEmail', name: 'User Email' },
    { key: 'userName', name: 'User Name' },
    { key: 'identitySource', name: 'Identity Source' },
    { key: 'ip', name: 'IP Address' },
    { key: 'location', name: 'Location' },
    { key: 'userAgent', name: 'User Agent' },
    { key: 'referer', name: 'Referer' },
    { key: 'dataSize', name: 'Data Size (bytes)' },
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
      { key: 'data.fileCount', name: 'Files Uploaded' },
      { key: 'data.imageCount', name: 'Images Uploaded' },
      { key: 'data.uploadedFiles', name: 'Uploaded File Details', transform: (val) => {
        if (!val || !Array.isArray(val)) return '';
        return val.map(f => {
          const details = `${f.name} (${f.type}, ${(f.size / 1024).toFixed(1)}KB)`;
          const stored = f.storedImageUrl ? ` [Stored: ${f.storedImageUrl}]` : '';
          return details + stored;
        }).join('; ');
      }},
      { key: 'data.storedImages', name: 'Stored Image URLs', transform: (val) => {
        if (!val || !Array.isArray(val)) return '';
        return val.map(img => `${img.originalName} -> ${img.storedImageUrl}`).join('; ');
      }},
      { key: 'data.hasGeneratedImage', name: 'AI Image Generated' },
      { key: 'data.generatedImage', name: 'AI Generated Image', transform: (val) => {
        if (!val || !val.imageUrl) return '';
        return `URL: ${val.imageUrl} | Prompt: ${val.prompt || 'N/A'} | Revised: ${val.revisedPrompt || 'N/A'}`;
      }},
      { key: 'data.generatedImage.imageUrl', name: 'Generated Image URL' },
      { key: 'data.generatedImage.prompt', name: 'Image Prompt' },
      { key: 'data.generatedImage.revisedPrompt', name: 'Revised Image Prompt' },
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
    'devtools-opened': [
      { key: 'data.pageUrl', name: 'Page URL' },
      { key: 'data.pageTitle', name: 'Page Title' },
      { key: 'data.detectionMethod', name: 'Detection Method' },
      { key: 'data.userAgent', name: 'User Agent' },
      { key: 'data.referrer', name: 'Referrer' },
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
      
      // Apply transform function if provided
      if (col.transform && typeof col.transform === 'function') {
        value = col.transform(value);
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
  const startTime = Date.now();
  try {
    // Validate inputs
    if (!dataType || typeof dataType !== 'string') {
      console.error("[Data Log] Invalid dataType:", dataType);
      return { success: false, error: "Invalid dataType" };
    }
    
    if (!data || typeof data !== 'object') {
      console.error("[Data Log] Invalid data object:", typeof data);
      return { success: false, error: "Invalid data object" };
    }
    
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
          data: JSON.stringify(data).substring(0, 500),
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
    
    // Track if email was provided directly or inferred
    let identitySource = userEmail ? 'provided' : null;
    
    // Get fingerprint from data (more accurate than IP+UA for identifying same device/browser)
    const fingerprint = data.fingerprint || data.sessionId || null;
    
    // If no email found in data, try to look it up from previous logs by FINGERPRINT
    // Fingerprint is much more accurate than IP+UA because it's unique to the device/browser combination
    // Only for certain data types and only if very recent (last 2 hours) to avoid stale matches
    const allowFingerprintLookup = ['ai-chat', 'tip-submission'].includes(dataType); // Only for chat and tips
    
    if (!userEmail && allowFingerprintLookup && fingerprint) {
      try {
        const store = getStore({
          name: "analytics-data",
          siteID: process.env.NETLIFY_SITE_ID,
          token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
        });
        
        // Look in the last 2 hours (fingerprint is more reliable, so we can go back further)
        const now = new Date();
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        
        // Check today and yesterday (in case of timezone issues)
        const todayKey = now.toISOString().split('T')[0];
        const yesterdayKey = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const dateKeys = [todayKey, yesterdayKey];
        
        let foundEmails = new Map(); // Track how many times each email appears with matching fingerprint
        
        for (const dateKey of dateKeys) {
          try {
          const logsKey = `logs-${dateKey}`;
            const existing = await store.get(logsKey, { type: "json" });
            if (existing && Array.isArray(existing)) {
              // Find logs with EXACT fingerprint match that have an email
              existing.forEach(log => {
                const logTime = new Date(log.timestamp);
                const logFingerprint = log.data?.fingerprint || log.fingerprint || null;
                
                // EXACT fingerprint match (much more accurate than IP+UA)
                if (
                  logFingerprint && 
                  logFingerprint === fingerprint && // EXACT match required
                  log.userEmail && 
                  log.userEmail !== 'Unknown' &&
                  log.userEmail !== 'anonymous' &&
                  log.userEmail.includes('@') &&
                  logTime >= twoHoursAgo &&
                  (log.identitySource === 'provided' || !log.identitySource) // Only trust emails that were provided, not inferred
                ) {
                  const email = log.userEmail.toLowerCase().trim();
                  foundEmails.set(email, (foundEmails.get(email) || 0) + 1);
                }
              });
            }
          } catch (e) {
            // Continue to next date
            console.error("[Data Log] Error reading logs for date:", dateKey, e);
          }
        }
        
        // Only use email if it appears at least 2 times with the SAME fingerprint (high confidence)
        // AND if there's only one email candidate (if multiple emails match, don't guess)
        if (foundEmails.size > 0) {
          const sortedEmails = Array.from(foundEmails.entries())
            .sort((a, b) => b[1] - a[1]); // Sort by count
          
          const mostCommonEmail = sortedEmails[0];
          
          // Stricter requirements for fingerprint matching:
          // 1. Must appear at least 2 times (fingerprint is more reliable, so fewer occurrences needed)
          // 2. Must be the ONLY email found (if multiple emails match same fingerprint, something is wrong)
          const isConfident = mostCommonEmail[1] >= 2 && 
            sortedEmails.length === 1; // Only one email should match the same fingerprint
          
          if (isConfident) {
            userEmail = mostCommonEmail[0];
            identitySource = 'inferred';
            console.log(`[Data Log] Inferred email from fingerprint match (${mostCommonEmail[1]} occurrences, exact fingerprint): ${userEmail}`);
          } else {
            console.log(`[Data Log] Email found but not confident enough (${mostCommonEmail[1]} occurrences, ${sortedEmails.length} candidates) - not using. Multiple emails with same fingerprint suggests data issue.`);
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

    // Skip logging JavaScript errors and Google ads - they're too noisy
    if (dataType === 'javascript-error' || dataType === 'console-error') {
      return { success: false, skipped: true, reason: 'JavaScript errors are not logged' };
    }
    
    // Check for Google ads in the data
    const message = (data.message || '').toLowerCase();
    const filename = (data.filename || '').toLowerCase();
    const error = (data.error || '').toLowerCase();
    const isGoogleAd = 
      (message.includes('google') && (message.includes('ad') || message.includes('ads') || message.includes('advertisement'))) ||
      (filename.includes('google') && (filename.includes('ad') || filename.includes('ads'))) ||
      (error.includes('google') && (error.includes('ad') || error.includes('ads'))) ||
      message.includes('googlesyndication') ||
      message.includes('doubleclick') ||
      message.includes('adservice') ||
      filename.includes('googlesyndication') ||
      filename.includes('doubleclick') ||
      filename.includes('adservice');
    
    if (isGoogleAd) {
      return { success: false, skipped: true, reason: 'Google ads logs are not logged' };
    }

    // Helper function to sanitize data
    function sanitizeData(obj) {
      if (!obj || typeof obj !== 'object') return obj;
      
      const sanitized = Array.isArray(obj) ? [] : {};
      
      for (const [key, value] of Object.entries(obj)) {
        // Skip null/undefined
        if (value === null || value === undefined) continue;
        
        // Handle different types
        if (typeof value === 'string') {
          // Limit string length
          if (value.length > 10000) {
            sanitized[key] = value.substring(0, 10000) + '... [truncated]';
          } else {
            sanitized[key] = value;
          }
        } else if (typeof value === 'object') {
          // Recursively sanitize nested objects
          if (Array.isArray(value)) {
            sanitized[key] = value.slice(0, 100).map(item => 
              typeof item === 'object' ? sanitizeData(item) : item
            );
          } else {
            sanitized[key] = sanitizeData(value);
          }
        } else {
          sanitized[key] = value;
        }
      }
      
      return sanitized;
    }

    // Sanitize and validate data before storing
    const sanitizedData = sanitizeData(data);
    
    // Calculate data size for monitoring
    const dataSize = JSON.stringify(sanitizedData).length;
    if (dataSize > 100000) { // 100KB limit
      console.warn(`[Data Log] Large data object detected: ${dataSize} bytes for ${dataType}`);
      // Truncate large fields
      if (sanitizedData.userMessage && sanitizedData.userMessage.length > 5000) {
        sanitizedData.userMessage = sanitizedData.userMessage.substring(0, 5000) + '... [truncated]';
      }
      if (sanitizedData.aiResponse && sanitizedData.aiResponse.length > 5000) {
        sanitizedData.aiResponse = sanitizedData.aiResponse.substring(0, 5000) + '... [truncated]';
      }
    }
    
    // Create log entry with enhanced metadata
    const logEntry = {
      dataType,
      ip,
      location: location,
      userEmail: userEmail,
      userName: userName,
      identitySource: identitySource, // 'provided', 'inferred', or null
      fingerprint: fingerprint, // Store fingerprint for future identity matching
      ...metadata,
      data: sanitizedData,
      dataSize: dataSize, // Track size for monitoring
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      version: '2.0', // Version for future migrations
    };
    
    // Check if IP should be excluded from alerts (e.g., your own IP, friends, etc.)
    const shouldExcludeIP = (() => {
      if (!ip || ip === 'unknown') return false;
      
      // Get excluded IPs from environment variable (comma-separated or JSON array)
      let excludedIPs = [];
      if (process.env.EXCLUDED_ALERT_IPS) {
        try {
          excludedIPs = JSON.parse(process.env.EXCLUDED_ALERT_IPS);
          if (!Array.isArray(excludedIPs)) {
            throw new Error('Not an array');
          }
        } catch {
          // If not JSON, treat as comma-separated string
          excludedIPs = process.env.EXCLUDED_ALERT_IPS.split(',').map(ip => ip.trim()).filter(ip => ip);
        }
      }
      
      // Check if current IP matches any excluded IP (supports partial matches for dynamic IPs)
      return excludedIPs.some(excludedIP => {
        const excluded = excludedIP.trim();
        // Exact match
        if (ip === excluded) return true;
        // Partial match (for dynamic IPs that change but stay in same range)
        // e.g., "192.168.1" would match "192.168.1.100", "192.168.1.101", etc.
        if (excluded.includes('.') && ip.startsWith(excluded)) return true;
        return false;
      });
    })();
    
    // Check for location alerts (College/University locations for admissions tracking)
    let shouldAlert = false;
    let alertType = null;
    
    // Skip alert check if IP is excluded
    if (shouldExcludeIP) {
      console.log(`[Data Log] IP ${ip} is excluded from location alerts`);
    } else if (location && location.city) {
      const cityLower = location.city.toLowerCase();
      const regionLower = (location.region || '').toLowerCase();
      const countryLower = (location.country || '').toLowerCase();
      
      // University of Florida (UF) - Gainesville, FL
      const isGainesville = cityLower.includes('gainesville') && (regionLower.includes('florida') || regionLower.includes('fl'));
      // Florida Atlantic University (FAU) - Boca Raton, FL
      const isBocaRaton = (cityLower.includes('boca') && cityLower.includes('raton')) && (regionLower.includes('florida') || regionLower.includes('fl'));
      // Rollins College - Winter Park, FL
      const isWinterPark = (cityLower.includes('winter') && cityLower.includes('park')) && (regionLower.includes('florida') || regionLower.includes('fl'));
      // Clemson University - Clemson, SC
      const isClemson = cityLower.includes('clemson') && (regionLower.includes('south carolina') || regionLower.includes('sc'));
      // Florida State University (FSU) - Tallahassee, FL
      const isTallahassee = cityLower.includes('tallahassee') && (regionLower.includes('florida') || regionLower.includes('fl'));
      // University of Miami - Coral Gables, FL
      const isCoralGables = (cityLower.includes('coral') && cityLower.includes('gables')) && (regionLower.includes('florida') || regionLower.includes('fl'));
      // University of Virginia (UVA) - Charlottesville, VA
      const isCharlottesville = cityLower.includes('charlottesville') && (regionLower.includes('virginia') || regionLower === 'va');
      // Wake Forest University - Winston-Salem, NC
      const isWinstonSalem = (cityLower.includes('winston') && cityLower.includes('salem')) && (regionLower.includes('north carolina') || regionLower.includes('nc'));
      // Auburn University - Auburn, AL
      const isAuburn = cityLower.includes('auburn') && (regionLower.includes('alabama') || regionLower.includes('al'));
      
      // Also check for Pennsylvania and Canada (general locations)
      const isPennsylvania = regionLower.includes('pennsylvania') || regionLower === 'pa';
      const isCanada = countryLower.includes('canada');
      
      if (isGainesville || isBocaRaton || isWinterPark || isClemson || isTallahassee || 
          isCoralGables || isCharlottesville || isWinstonSalem || isAuburn ||
          isPennsylvania || isCanada) {
        shouldAlert = true;
        if (isGainesville) alertType = 'Gainesville FL (UF)';
        else if (isBocaRaton) alertType = 'Boca Raton FL (FAU)';
        else if (isWinterPark) alertType = 'Winter Park FL (Rollins College)';
        else if (isClemson) alertType = 'Clemson SC (Clemson University)';
        else if (isTallahassee) alertType = 'Tallahassee FL (FSU)';
        else if (isCoralGables) alertType = 'Coral Gables FL (University of Miami)';
        else if (isCharlottesville) alertType = 'Charlottesville VA (UVA)';
        else if (isWinstonSalem) alertType = 'Winston-Salem NC (Wake Forest)';
        else if (isAuburn) alertType = 'Auburn AL (Auburn University)';
        else if (isPennsylvania) alertType = 'Pennsylvania';
        else if (isCanada) alertType = 'Canada';
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
            // Exclude Ashburn, Virginia from email notifications
            const cityLower = (location.city || '').toLowerCase();
            const regionLower = (location.region || '').toLowerCase();
            const isAshburnVA = cityLower.includes('ashburn') && 
                               (regionLower.includes('virginia') || regionLower === 'va' || regionLower === 'virginia');
            
            if (isAshburnVA) {
              console.log(`[Data Log] Skipping email notification for Ashburn, Virginia visitor`);
            } else {
              // Check if Resend API key is configured before initializing
              if (!process.env.RESEND_API_KEY) {
                console.warn('[Data Log] RESEND_API_KEY not configured. Skipping location alert email notification.');
              } else {
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
              }
            }
          } catch (emailErr) {
            console.error("[Data Log] Error setting up location alert emails:", emailErr);
          }
        }
      } catch (alertErr) {
        console.error("[Data Log] Error storing alert:", alertErr);
      }
    }
    
    // Check for visitors outside Florida and send email notification
    if (dataType === 'page-view' && location && !shouldExcludeIP) {
      const regionLower = (location.region || '').toLowerCase();
      const countryLower = (location.country || '').toLowerCase();
      const isFlorida = regionLower.includes('florida') || regionLower === 'fl' || regionLower === 'florida';
      
      // Check if visitor is NOT from Florida
      if (!isFlorida && location.city && location.city !== 'Unknown' && location.city !== 'Local') {
        // Exclude Ashburn, Virginia from email notifications
        const cityLower = (location.city || '').toLowerCase();
        const regionLower = (location.region || '').toLowerCase();
        const isAshburnVA = cityLower.includes('ashburn') && 
                           (regionLower.includes('virginia') || regionLower === 'va' || regionLower === 'virginia');
        
        if (isAshburnVA) {
          console.log(`[Data Log] Skipping email notification for Ashburn, Virginia visitor`);
        } else {
          try {
            // Check if Resend API key is configured
            if (!process.env.RESEND_API_KEY) {
              console.warn('[Data Log] RESEND_API_KEY not configured. Skipping non-Florida visitor email notification.');
            } else {
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
            
            // Filter out mr.pangolinman@example.com
            notificationEmails = notificationEmails.filter(email => 
              email.toLowerCase() !== 'mr.pangolinman@example.com' && 
              email.toLowerCase() !== 'pangolinman@example.com'
            );
            
            if (notificationEmails.length === 0) {
              console.log('[Data Log] No notification emails configured for non-Florida visitor alerts');
            } else {
              const fromEmail = process.env.RESEND_FROM_EMAIL || 'Noteworthy News <richard@noteworthynews.co>';
              
              // Build exact location string
              const locationParts = [];
              if (location.city) locationParts.push(location.city);
              if (location.region) locationParts.push(location.region);
              if (location.country) locationParts.push(location.country);
              const exactLocation = locationParts.join(', ');
              
              const pageUrl = data.url || data.path || 'Unknown page';
              const pageTitle = data.title || 'Unknown page';
              
              // Additional location details
              const locationDetails = [];
              if (location.timezone) locationDetails.push(`Timezone: ${location.timezone}`);
              if (location.isp) locationDetails.push(`ISP: ${location.isp}`);
              if (location.countryCode) locationDetails.push(`Country Code: ${location.countryCode}`);
              
              // Send to all notification emails
              Promise.all(notificationEmails.map(email =>
                resend.emails.send({
                  from: fromEmail,
                  to: email,
                  subject: `🌍 Visitor from Outside Florida: ${exactLocation}`,
                  html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 0; background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);">
              <div style="padding: 40px 30px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 16px;">🌍</div>
                <h1 style="color: #ffffff; margin: 0 0 8px 0; font-size: 28px; font-weight: 800; text-shadow: 0 2px 8px rgba(0,0,0,0.2);">Visitor from Outside Florida</h1>
                <p style="color: rgba(255,255,255,0.95); margin: 0; font-size: 15px; font-weight: 500;">Location Alert</p>
              </div>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 30px;">
              <!-- Exact Location -->
              <div style="background-color: #fff3e0; border: 3px solid #ff9800; border-radius: 16px; padding: 24px; margin-bottom: 24px; text-align: center; box-shadow: 0 4px 16px rgba(255, 152, 0, 0.2);">
                <p style="color: #e65100; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; margin: 0 0 16px 0;">📍 Exact Location</p>
                <p style="color: #1a202c; font-size: 24px; font-weight: 800; margin: 0; line-height: 1.4;">${exactLocation}</p>
                ${locationDetails.length > 0 ? `
                <div style="margin-top: 16px; padding-top: 16px; border-top: 2px solid #ffcc80;">
                  ${locationDetails.map(detail => `<p style="color: #6c757d; font-size: 12px; margin: 4px 0; font-weight: 500;">${detail}</p>`).join('')}
                </div>
                ` : ''}
              </div>
              
              <!-- Page Information -->
              <div style="background-color: #e3f2fd; border-left: 4px solid #2196f3; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
                <p style="color: #1565c0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0;">📄 Page Visited</p>
                <p style="color: #1a202c; font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">${pageTitle}</p>
                <p style="color: #666666; font-size: 13px; margin: 0; word-break: break-all;"><a href="${pageUrl}" style="color: #2196f3; text-decoration: none;">${pageUrl}</a></p>
              </div>
              
              ${userEmail ? `
              <!-- User Email -->
              <div style="background-color: #e8f5e9; border-left: 4px solid #4caf50; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
                <p style="color: #2e7d32; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0;">👤 User Email</p>
                <p style="color: #1a202c; font-size: 16px; font-weight: 600; margin: 0;">${userEmail}</p>
              </div>
              ` : ''}
              
              <!-- Additional Details -->
              <div style="background-color: #f8f9fa; border: 2px solid #dee2e6; border-radius: 12px; padding: 20px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="padding: 8px 0;">
                      <p style="color: #667eea; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px 0;">🌐 IP Address</p>
                      <p style="color: #1a202c; font-size: 14px; font-weight: 600; margin: 0;">${ip}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <p style="color: #667eea; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px 0;">📅 Time</p>
                      <p style="color: #1a202c; font-size: 14px; font-weight: 600; margin: 0;">${new Date().toLocaleString()}</p>
                    </td>
                  </tr>
                  ${metadata.referer && metadata.referer !== 'unknown' ? `
                  <tr>
                    <td style="padding: 8px 0;">
                      <p style="color: #667eea; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px 0;">🔙 Referrer</p>
                      <p style="color: #1a202c; font-size: 13px; margin: 0; word-break: break-all;">${metadata.referer.substring(0, 150)}</p>
                    </td>
                  </tr>
                  ` : ''}
                  ${metadata.userAgent && metadata.userAgent !== 'unknown' ? `
                  <tr>
                    <td style="padding: 8px 0;">
                      <p style="color: #667eea; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px 0;">💻 User Agent</p>
                      <p style="color: #1a202c; font-size: 12px; margin: 0; word-break: break-all;">${metadata.userAgent.substring(0, 200)}</p>
                    </td>
                  </tr>
                  ` : ''}
                </table>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 30px; background-color: #f8f9fa; border-top: 1px solid #dee2e6;">
              <p style="color: #6c757d; font-size: 12px; margin: 0; text-align: center; line-height: 1.6;">
                <span style="color: #667eea; font-weight: 600;">Noteworthy News</span> • Automated Notification
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
                  text: `Visitor from Outside Florida

EXACT LOCATION: ${exactLocation}
${locationDetails.length > 0 ? locationDetails.join('\n') + '\n' : ''}

Page Visited: ${pageTitle}
URL: ${pageUrl}
${userEmail ? `User Email: ${userEmail}\n` : ''}
IP Address: ${ip}
Time: ${new Date().toLocaleString()}
${metadata.referer && metadata.referer !== 'unknown' ? `Referrer: ${metadata.referer}\n` : ''}
${metadata.userAgent && metadata.userAgent !== 'unknown' ? `User Agent: ${metadata.userAgent}\n` : ''}

---
This is an automated notification from your website.`,
                }).catch(err => {
                  console.error(`[Data Log] Failed to send non-Florida visitor email to ${email}:`, err);
                })
              )).catch(err => {
                console.error("[Data Log] Error sending non-Florida visitor emails:", err);
              });
              
              console.log(`[Data Log] 🌍 Non-Florida visitor alert sent: ${exactLocation}`);
            }
          }
        } catch (emailErr) {
          console.error("[Data Log] Error setting up non-Florida visitor email notification:", emailErr);
        }
        }
      }
    }
    
    // Send email notification for DevTools detection (non-blocking)
    if (dataType === 'devtools-opened') {
      try {
        // Check if Resend API key is configured before initializing
        if (!process.env.RESEND_API_KEY) {
          console.warn('[Data Log] RESEND_API_KEY not configured. Skipping DevTools detection email notification.');
        } else {
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
          
          const pageUrl = data.pageUrl || data.url || data.path || 'Unknown page';
          const pageTitle = data.pageTitle || data.title || 'Unknown page';
          const detectionMethod = data.detectionMethod || 'unknown';
          
          console.log(`[Data Log] 🔍 DevTools detected! Sending email notification...`);
          
          // Send to all notification emails
          Promise.all(notificationEmails.map(email =>
            resend.emails.send({
              from: fromEmail,
              to: email,
              subject: `🔍 Someone Opened DevTools on Your Site`,
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
            <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%); border-radius: 10px 10px 0 0;">
              <h2 style="color: #667eea; margin: 0; font-size: 24px; font-weight: bold;">🔍 DevTools Detected!</h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              <div style="padding: 20px; background: rgba(102, 126, 234, 0.1); border-left: 4px solid #667eea; border-radius: 8px; margin-bottom: 20px;">
                <p style="color: #667eea; font-size: 16px; font-weight: bold; margin: 0 0 10px 0;">👨‍💻 A curious developer opened the browser DevTools!</p>
                <p style="color: #333333; font-size: 14px; line-height: 1.6; margin: 0;">Thanks for being curious!! 🎉 If they have any tips to improve the code, they can DM on X <a href="https://x.com/newsnoteworthy" style="color: #667eea; text-decoration: none; font-weight: 600;">@newsnoteworthy</a></p>
              </div>
              
              <div style="padding: 20px; background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border: 2px solid #4A90E2; border-radius: 8px; margin-bottom: 20px;">
                <p style="color: #333333; font-size: 16px; margin: 10px 0; line-height: 1.6;"><strong style="color: #4A90E2;">📄 Page:</strong><br><span style="color: #666666; font-size: 15px;">${pageTitle}</span></p>
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
                <p style="color: #333333; font-size: 14px; margin: 5px 0;"><strong style="color: #4A90E2;">🔍 Detection Method:</strong> <span style="color: #666666;">${detectionMethod}</span></p>
                ${data.referrer ? `<p style="color: #333333; font-size: 14px; margin: 5px 0;"><strong style="color: #4A90E2;">🔙 Referrer:</strong> <span style="color: #666666;">${data.referrer.substring(0, 100)}</span></p>` : ''}
                ${location && location.city ? `<p style="color: #333333; font-size: 14px; margin: 5px 0;"><strong style="color: #4A90E2;">📍 Location:</strong> <span style="color: #666666;">${location.city}${location.region ? ', ' + location.region : ''}${location.country ? ', ' + location.country : ''}</span></p>` : ''}
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
              text: `DevTools Detected!

Someone opened the browser DevTools on your site.

Page: ${pageTitle}
URL: ${pageUrl}
${userEmail ? `User Email: ${userEmail}\n` : ''}
IP Address: ${ip}
Time: ${new Date().toLocaleString()}
Detection Method: ${detectionMethod}
${data.referrer ? `Referrer: ${data.referrer}\n` : ''}
${location && location.city ? `Location: ${location.city}${location.region ? ', ' + location.region : ''}${location.country ? ', ' + location.country : ''}\n` : ''}

---
This is an automated notification from your website.`,
            }).catch(err => {
              console.error(`[Data Log] Failed to send DevTools detection email to ${email}:`, err);
            })
          )).catch(err => {
            console.error("[Data Log] Error sending DevTools detection emails:", err);
          });
        }
      } catch (emailErr) {
        console.error("[Data Log] Error setting up DevTools detection emails:", emailErr);
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
        
        // Also update comprehensive user profile with latest info
        const userProfileKey = `${userKey}-profile`;
        let userProfile = {
          email: userEmail,
          name: userName || 'Unknown',
          firstSeen: userLogs.length === 1 ? new Date().toISOString() : (userLogs[0]?.timestamp || new Date().toISOString()),
          lastSeen: new Date().toISOString(),
          totalActivities: userLogs.length,
          location: location,
          // Comprehensive tracking
          identitySource: identitySource,
          ipAddresses: [],
          userAgents: [],
          locations: [],
          pageVisits: [],
          entryPages: [],
          exitPages: [],
          referrers: [],
          activityTypes: {},
          sessions: [],
          devices: [],
          languages: [],
          timePatterns: {},
          // Detailed stats
          pageViewCount: 0,
          aiChatCount: 0,
          imageGenerationCount: 0,
          gameScoreCount: 0,
          commentCount: 0,
          newsletterSignupCount: 0,
          formSubmitCount: 0,
          totalTimeOnSite: 0,
          averageTimeOnPage: 0,
        };
        
        // Try to get existing profile to preserve data
        try {
          const existing = await store.get(userProfileKey, { type: "json" });
          if (existing) {
            userProfile.firstSeen = existing.firstSeen || userProfile.firstSeen;
            userProfile.name = userName || existing.name || 'Unknown';
            userProfile.ipAddresses = existing.ipAddresses || [];
            userProfile.userAgents = existing.userAgents || [];
            userProfile.locations = existing.locations || [];
            userProfile.pageVisits = existing.pageVisits || [];
            userProfile.entryPages = existing.entryPages || [];
            userProfile.exitPages = existing.exitPages || [];
            userProfile.referrers = existing.referrers || [];
            userProfile.activityTypes = existing.activityTypes || {};
            userProfile.sessions = existing.sessions || [];
            userProfile.devices = existing.devices || [];
            userProfile.languages = existing.languages || [];
            userProfile.timePatterns = existing.timePatterns || {};
            userProfile.pageViewCount = existing.pageViewCount || 0;
            userProfile.aiChatCount = existing.aiChatCount || 0;
            userProfile.imageGenerationCount = existing.imageGenerationCount || 0;
            userProfile.gameScoreCount = existing.gameScoreCount || 0;
            userProfile.commentCount = existing.commentCount || 0;
            userProfile.newsletterSignupCount = existing.newsletterSignupCount || 0;
            userProfile.formSubmitCount = existing.formSubmitCount || 0;
            userProfile.totalTimeOnSite = existing.totalTimeOnSite || 0;
            userProfile.averageTimeOnPage = existing.averageTimeOnPage || 0;
          }
        } catch (e) {
          // New user
        }
        
        // Update comprehensive profile data from current log entry
        const now = new Date();
        const hour = now.getHours();
        const dayOfWeek = now.getDay(); // 0 = Sunday
        
        // Track IP addresses (unique)
        if (ip && ip !== "unknown" && !userProfile.ipAddresses.includes(ip)) {
          userProfile.ipAddresses.push(ip);
        }
        
        // Track user agents (unique)
        const ua = metadata?.userAgent || "unknown";
        if (ua !== "unknown" && !userProfile.userAgents.some(u => u.agent === ua)) {
          userProfile.userAgents.push({
            agent: ua,
            firstSeen: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
          });
        } else if (ua !== "unknown") {
          const uaIndex = userProfile.userAgents.findIndex(u => u.agent === ua);
          if (uaIndex >= 0) {
            userProfile.userAgents[uaIndex].lastSeen = new Date().toISOString();
          }
        }
        
        // Track locations (unique)
        if (location && location.city && location.city !== 'Unknown') {
          const locKey = `${location.city}-${location.region || ''}-${location.country || ''}`;
          if (!userProfile.locations.some(l => 
            l.city === location.city && 
            l.region === (location.region || '') && 
            l.country === (location.country || '')
          )) {
            userProfile.locations.push({
              ...location,
              firstSeen: new Date().toISOString(),
              lastSeen: new Date().toISOString(),
            });
          } else {
            const locIndex = userProfile.locations.findIndex(l => 
              l.city === location.city && 
              l.region === (location.region || '') && 
              l.country === (location.country || '')
            );
            if (locIndex >= 0) {
              userProfile.locations[locIndex].lastSeen = new Date().toISOString();
            }
          }
        }
        
        // Track page navigation
        if (dataType === 'page-view' && data.path) {
          const pagePath = data.path || '/';
          userProfile.pageVisits.push({
            path: pagePath,
            timestamp: new Date().toISOString(),
            referrer: data.referrer || metadata?.referer || 'direct',
            timeOnPage: data.timeOnPage || 0,
          });
          
          // Track entry pages (first visit to a page)
          if (!userProfile.entryPages.some(e => e.path === pagePath)) {
            userProfile.entryPages.push({
              path: pagePath,
              timestamp: new Date().toISOString(),
              referrer: data.referrer || metadata?.referer || 'direct',
            });
          }
          
          // Track referrers
          const referrer = data.referrer || metadata?.referer || 'direct';
          if (referrer !== 'direct' && referrer !== 'unknown') {
            if (!userProfile.referrers.some(r => r.url === referrer)) {
              userProfile.referrers.push({
                url: referrer,
                firstSeen: new Date().toISOString(),
                lastSeen: new Date().toISOString(),
                count: 1,
              });
            } else {
              const refIndex = userProfile.referrers.findIndex(r => r.url === referrer);
              if (refIndex >= 0) {
                userProfile.referrers[refIndex].lastSeen = new Date().toISOString();
                userProfile.referrers[refIndex].count = (userProfile.referrers[refIndex].count || 0) + 1;
              }
            }
          }
          
          userProfile.pageViewCount = (userProfile.pageViewCount || 0) + 1;
          
          // Track time on page
          if (data.timeOnPage) {
            const totalTime = (userProfile.totalTimeOnSite || 0) + (data.timeOnPage || 0);
            userProfile.totalTimeOnSite = totalTime;
            userProfile.averageTimeOnPage = totalTime / userProfile.pageViewCount;
          }
        }
        
        // Track exit pages
        if (dataType === 'page-exit' && data.path) {
          userProfile.exitPages.push({
            path: data.path,
            timestamp: new Date().toISOString(),
            scrollDepth: data.maxScrollDepth || 0,
            timeOnPage: data.timeOnPage || 0,
          });
        }
        
        // Track activity types
        userProfile.activityTypes[dataType] = (userProfile.activityTypes[dataType] || 0) + 1;
        
        // Track specific activity counts
        if (dataType === 'ai-chat') userProfile.aiChatCount = (userProfile.aiChatCount || 0) + 1;
        if (dataType === 'image-generation') userProfile.imageGenerationCount = (userProfile.imageGenerationCount || 0) + 1;
        if (dataType === 'game-score') userProfile.gameScoreCount = (userProfile.gameScoreCount || 0) + 1;
        if (dataType === 'comment') userProfile.commentCount = (userProfile.commentCount || 0) + 1;
        if (dataType === 'newsletter-signup') userProfile.newsletterSignupCount = (userProfile.newsletterSignupCount || 0) + 1;
        if (dataType === 'form-submit' || dataType === 'tip-submission') userProfile.formSubmitCount = (userProfile.formSubmitCount || 0) + 1;
        
        // Track devices (from user agent)
        if (ua !== "unknown") {
          const deviceInfo = {
            userAgent: ua,
            browser: ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : 'Unknown',
            os: ua.includes('Windows') ? 'Windows' : ua.includes('Mac') ? 'macOS' : ua.includes('Linux') ? 'Linux' : ua.includes('Android') ? 'Android' : ua.includes('iOS') ? 'iOS' : 'Unknown',
            mobile: /Mobile|Android|iPhone|iPad/.test(ua),
          };
          
          if (!userProfile.devices.some(d => d.userAgent === ua)) {
            userProfile.devices.push({
              ...deviceInfo,
              firstSeen: new Date().toISOString(),
              lastSeen: new Date().toISOString(),
            });
          } else {
            const devIndex = userProfile.devices.findIndex(d => d.userAgent === ua);
            if (devIndex >= 0) {
              userProfile.devices[devIndex].lastSeen = new Date().toISOString();
            }
          }
        }
        
        // Track languages
        const lang = metadata?.acceptLanguage || "unknown";
        if (lang !== "unknown") {
          const primaryLang = lang.split(',')[0].split(';')[0].trim();
          if (!userProfile.languages.includes(primaryLang)) {
            userProfile.languages.push(primaryLang);
          }
        }
        
        // Track time patterns (hour of day, day of week)
        if (!userProfile.timePatterns.hours) userProfile.timePatterns.hours = {};
        if (!userProfile.timePatterns.days) userProfile.timePatterns.days = {};
        userProfile.timePatterns.hours[hour] = (userProfile.timePatterns.hours[hour] || 0) + 1;
        userProfile.timePatterns.days[dayOfWeek] = (userProfile.timePatterns.days[dayOfWeek] || 0) + 1;
        
        // Keep arrays from growing too large (keep last 1000 entries)
        if (userProfile.pageVisits.length > 1000) {
          userProfile.pageVisits = userProfile.pageVisits.slice(-1000);
        }
        if (userProfile.entryPages.length > 100) {
          userProfile.entryPages = userProfile.entryPages.slice(-100);
        }
        if (userProfile.exitPages.length > 100) {
          userProfile.exitPages = userProfile.exitPages.slice(-100);
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
    const date = metadata.date || new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const dateKey = `logs-${date}`;
    const typeKey = `${dataType}-${date}`;
    const hourKey = `${dataType}-${date}-${metadata.hour || new Date().getHours()}`; // Hourly index for faster queries

    // Get existing logs for today (with timeout to prevent hanging)
    let dailyLogs = [];
    try {
      const existing = await Promise.race([
        store.get(dateKey, { type: "json" }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
      ]);
      dailyLogs = existing || [];
    } catch (e) {
      if (e.message === 'Timeout') {
        console.warn(`[Data Log] Timeout reading daily logs for ${dateKey}`);
      }
      // First log of the day or error - start fresh
      dailyLogs = [];
    }

    // Get existing logs for this type today
    let typeLogs = [];
    try {
      const existing = await Promise.race([
        store.get(typeKey, { type: "json" }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
      ]);
      typeLogs = existing || [];
    } catch (e) {
      if (e.message === 'Timeout') {
        console.warn(`[Data Log] Timeout reading type logs for ${typeKey}`);
      }
      typeLogs = [];
    }

    // Get hourly logs for faster time-based queries
    let hourlyLogs = [];
    try {
      const existing = await Promise.race([
        store.get(hourKey, { type: "json" }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]);
      hourlyLogs = existing || [];
    } catch (e) {
      hourlyLogs = [];
    }

    // Add new log entry
    dailyLogs.push(logEntry);
    typeLogs.push(logEntry);
    hourlyLogs.push(logEntry);

    // Keep only last 50000 entries per day (to prevent storage bloat)
    const MAX_LOGS_PER_DAY = 50000;
    const MAX_LOGS_PER_HOUR = 5000;
    
    if (dailyLogs.length > MAX_LOGS_PER_DAY) {
      dailyLogs = dailyLogs.slice(-MAX_LOGS_PER_DAY);
      console.warn(`[Data Log] Truncated daily logs to ${MAX_LOGS_PER_DAY} entries`);
    }
    if (typeLogs.length > MAX_LOGS_PER_DAY) {
      typeLogs = typeLogs.slice(-MAX_LOGS_PER_DAY);
      console.warn(`[Data Log] Truncated type logs to ${MAX_LOGS_PER_DAY} entries`);
    }
    if (hourlyLogs.length > MAX_LOGS_PER_HOUR) {
      hourlyLogs = hourlyLogs.slice(-MAX_LOGS_PER_HOUR);
    }

    // Save logs with error handling and retries
    const saveWithRetry = async (key, data, retries = 2) => {
      for (let i = 0; i <= retries; i++) {
        try {
          await store.set(key, JSON.stringify(data), {
      contentType: "application/json",
    });
          return true;
        } catch (err) {
          if (i === retries) {
            console.error(`[Data Log] Failed to save ${key} after ${retries + 1} attempts:`, err);
            throw err;
          }
          console.warn(`[Data Log] Retry ${i + 1} saving ${key}`);
          await new Promise(resolve => setTimeout(resolve, 100 * (i + 1))); // Exponential backoff
        }
      }
    };

    // Save all logs in parallel for better performance
    const savePromises = [
      saveWithRetry(dateKey, dailyLogs),
      saveWithRetry(typeKey, typeLogs),
      saveWithRetry(hourKey, hourlyLogs),
    ];

    // Also save individual entry for detailed queries (with timeout)
    const entryKey = `entry-${logEntry.id}`;
    savePromises.push(
      Promise.race([
        store.set(entryKey, JSON.stringify(logEntry), {
      contentType: "application/json",
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]).catch(err => {
        if (err.message !== 'Timeout') {
          console.warn(`[Data Log] Failed to save individual entry ${entryKey}:`, err.message);
        }
      })
    );

    await Promise.allSettled(savePromises);

    const duration = Date.now() - startTime;
    console.log(`[Data Log] ✅ Logged ${dataType} entry: ${logEntry.id} (${duration}ms, ${dataSize} bytes)`);
    return { success: true, id: logEntry.id, entry: logEntry, duration, dataSize };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Data Log] ❌ Error logging ${dataType} (${duration}ms):`, error);
    console.error(`[Data Log] Error stack:`, error.stack);
    console.error(`[Data Log] Error details:`, {
      name: error.name,
      message: error.message,
      code: error.code,
      dataType: dataType,
      hasData: !!data,
      dataKeys: data ? Object.keys(data).slice(0, 10) : [],
    });
    return { success: false, error: error.message, duration };
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
      
      // Check environment variables and initialize store first
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
