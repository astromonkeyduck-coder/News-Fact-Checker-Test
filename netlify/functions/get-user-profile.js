/**
 * Get comprehensive user profile data
 * GET /.netlify/functions/get-user-profile?email=user@example.com
 */

const { getStore } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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
    if (event.httpMethod !== "GET") {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ 
          error: "Method Not Allowed",
          receivedMethod: event.httpMethod,
          expectedMethod: "GET"
        }),
      };
    }

    // SECURITY: Require admin token for viewing profiles
    const adminToken = process.env.ADMIN_ANALYTICS_TOKEN;
    const providedToken = event.queryStringParameters?.token || event.headers["x-admin-token"];
    
    if (adminToken && providedToken !== adminToken) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Unauthorized - Admin token required" }),
      };
    }

    const userEmail = event.queryStringParameters?.email;
    
    if (!userEmail) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: "Missing 'email' query parameter",
          usage: "GET /.netlify/functions/get-user-profile?email=user@example.com&token=YOUR_TOKEN"
        }),
      };
    }

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

    const userKey = `user-${userEmail.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const userProfileKey = `${userKey}-profile`;
    const userLogsKey = `${userKey}-logs`;

    try {
      // Get user profile
      const profile = await store.get(userProfileKey, { type: "json" });
      
      // Get user logs (recent activity)
      let logs = [];
      try {
        const userLogs = await store.get(userLogsKey, { type: "json" });
        logs = userLogs || [];
        // Return most recent 500 logs
        logs = logs.slice(-500).reverse();
      } catch (e) {
        logs = [];
      }

      if (!profile) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ 
            error: "User profile not found",
            email: userEmail
          }),
        };
      }

      // Calculate additional stats
      const daysActive = Math.ceil((new Date(profile.lastSeen) - new Date(profile.firstSeen)) / (1000 * 60 * 60 * 24));
      const averageActivitiesPerDay = daysActive > 0 ? (profile.totalActivities / daysActive).toFixed(2) : profile.totalActivities;

      // Get most visited pages
      const pageVisitCounts = {};
      (profile.pageVisits || []).forEach(visit => {
        pageVisitCounts[visit.path] = (pageVisitCounts[visit.path] || 0) + 1;
      });
      const mostVisitedPages = Object.entries(pageVisitCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([path, count]) => ({ path, count }));

      // Get most common entry pages
      const entryPageCounts = {};
      (profile.entryPages || []).forEach(entry => {
        entryPageCounts[entry.path] = (entryPageCounts[entry.path] || 0) + 1;
      });
      const mostCommonEntryPages = Object.entries(entryPageCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([path, count]) => ({ path, count }));

      // Get most common exit pages
      const exitPageCounts = {};
      (profile.exitPages || []).forEach(exit => {
        exitPageCounts[exit.path] = (exitPageCounts[exit.path] || 0) + 1;
      });
      const mostCommonExitPages = Object.entries(exitPageCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([path, count]) => ({ path, count }));

      // Get peak activity hours
      const peakHours = Object.entries(profile.timePatterns?.hours || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([hour, count]) => ({ hour: parseInt(hour), count }));

      // Get peak activity days
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const peakDays = Object.entries(profile.timePatterns?.days || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7)
        .map(([day, count]) => ({ day: parseInt(day), dayName: dayNames[parseInt(day)], count }));

      // Calculate trends and insights
      const trends = calculateTrends(logs, profile);
      
      // Analyze tab visibility patterns (when user switches away/back to our tab)
      const tabVisibility = analyzeTabVisibility(logs);
      
      // Analyze input focus patterns (what fields they interact with)
      const inputPatterns = analyzeInputPatterns(logs);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          profile: {
            ...profile,
            daysActive,
            averageActivitiesPerDay,
            mostVisitedPages,
            mostCommonEntryPages,
            mostCommonExitPages,
            peakHours,
            peakDays,
            trends,
            tabVisibility,
            inputPatterns,
          },
          recentLogs: logs,
          logsCount: logs.length,
        }),
      };
    } catch (err) {
      console.error("[get-user-profile] Error:", err);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: "Failed to retrieve user profile",
          message: err.message 
        }),
      };
    }
  } catch (e) {
    console.error("get-user-profile function error:", e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: "Internal server error",
        message: e.message || "An unexpected error occurred"
      }),
    };
  }
};

// Calculate trends and insights from user activity
function calculateTrends(logs, profile) {
  if (!logs || logs.length === 0) {
    return {
      activityTrend: 'stable',
      engagementLevel: 'unknown',
      recentActivity: 'none',
      growthRate: 0,
      insights: ['No activity data available'],
    };
  }

  // Group logs by date
  const logsByDate = {};
  logs.forEach(log => {
    const date = new Date(log.timestamp).toISOString().split('T')[0];
    if (!logsByDate[date]) logsByDate[date] = [];
    logsByDate[date].push(log);
  });

  const dates = Object.keys(logsByDate).sort();
  const last7Days = dates.slice(-7);
  const previous7Days = dates.slice(-14, -7);

  // Calculate activity trend
  const recentActivityCount = last7Days.reduce((sum, date) => sum + (logsByDate[date]?.length || 0), 0);
  const previousActivity = previous7Days.reduce((sum, date) => sum + (logsByDate[date]?.length || 0), 0);
  
  let activityTrend = 'stable';
  let growthRate = 0;
  if (previousActivity > 0) {
    growthRate = ((recentActivityCount - previousActivity) / previousActivity) * 100;
    if (growthRate > 20) activityTrend = 'increasing';
    else if (growthRate < -20) activityTrend = 'decreasing';
  } else if (recentActivityCount > 0) {
    activityTrend = 'new';
    growthRate = 100;
  }

  // Determine engagement level
  const totalActivities = profile.totalActivities || 0;
  const avgPerDay = profile.averageActivitiesPerDay || 0;
  let engagementLevel = 'low';
  if (avgPerDay > 10) engagementLevel = 'very-high';
  else if (avgPerDay > 5) engagementLevel = 'high';
  else if (avgPerDay > 2) engagementLevel = 'medium';
  else if (avgPerDay > 0) engagementLevel = 'low';

  // Recent activity status
  const lastActivity = logs[0] ? new Date(logs[0].timestamp) : null;
  const hoursSinceLastActivity = lastActivity ? (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60) : Infinity;
  let recentActivity = 'active';
  if (hoursSinceLastActivity < 1) recentActivity = 'very-recent';
  else if (hoursSinceLastActivity < 24) recentActivity = 'recent';
  else if (hoursSinceLastActivity < 168) recentActivity = 'recent-week';
  else recentActivity = 'inactive';

  // Generate insights
  const insights = [];
  
  if (activityTrend === 'increasing') {
    insights.push(`📈 Activity is increasing - ${Math.round(growthRate)}% more active in the last 7 days`);
  } else if (activityTrend === 'decreasing') {
    insights.push(`📉 Activity is decreasing - ${Math.round(Math.abs(growthRate))}% less active in the last 7 days`);
  }
  
  if (profile.pageViewCount > 0 && profile.aiChatCount > 0) {
    const chatRatio = (profile.aiChatCount / profile.pageViewCount) * 100;
    if (chatRatio > 30) {
      insights.push(`💬 Highly engaged with AI chat - ${Math.round(chatRatio)}% of page views include chat interactions`);
    }
  }
  
  if (profile.imageGenerationCount > 0) {
    insights.push(`🎨 Generated ${profile.imageGenerationCount} image${profile.imageGenerationCount !== 1 ? 's' : ''} using DALL-E`);
  }
  
  if (profile.mostVisitedPages && profile.mostVisitedPages.length > 0) {
    const topPage = profile.mostVisitedPages[0];
    insights.push(`📍 Most visited page: ${topPage.path} (${topPage.count} times)`);
  }
  
  if (hoursSinceLastActivity < 24) {
    insights.push(`⏰ Last active ${Math.round(hoursSinceLastActivity)} hour${Math.round(hoursSinceLastActivity) !== 1 ? 's' : ''} ago`);
  }

  return {
    activityTrend,
    engagementLevel,
    recentActivity,
    growthRate: Math.round(growthRate),
    insights,
    activityByDate: dates.map(date => ({
      date,
      count: logsByDate[date]?.length || 0,
    })),
  };
}

// Analyze tab visibility patterns (when user switches away/back to our tab)
function analyzeTabVisibility(logs) {
  const tabHiddenLogs = logs.filter(log => log.dataType === 'tab-hidden');
  const tabVisibleLogs = logs.filter(log => log.dataType === 'tab-visible');
  
  return {
    totalTabSwitches: tabHiddenLogs.length,
    averageTimeAway: tabHiddenLogs.length > 0 ? 'calculated' : null,
    tabSwitchFrequency: tabHiddenLogs.length > 0 ? 'frequent' : 'rare',
    lastTabSwitch: tabHiddenLogs.length > 0 ? tabHiddenLogs[0].timestamp : null,
    note: '⚠️ Browser security prevents tracking other tabs. We can only see when users switch away from/back to our site.',
  };
}

// Analyze input focus patterns (what fields they interact with)
function analyzeInputPatterns(logs) {
  const inputFocusLogs = logs.filter(log => log.dataType === 'input-focus');
  
  const inputTypes = {};
  inputFocusLogs.forEach(log => {
    const inputType = log.data?.inputType || 'unknown';
    inputTypes[inputType] = (inputTypes[inputType] || 0) + 1;
  });
  
  const mostFocusedInputs = Object.entries(inputTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));
  
  return {
    totalInputInteractions: inputFocusLogs.length,
    mostFocusedInputs,
    note: '⚠️ We can only track input focus on our site, not typing in other tabs or websites.',
  };
}

