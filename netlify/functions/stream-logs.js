const { getStore } = require("@netlify/blobs");

/**
 * Real-time log streaming endpoint using Server-Sent Events (SSE)
 * Streams logs as they come in for real-time monitoring
 */

exports.handler = async (event, context) => {
  // CORS headers for SSE
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Cache-Control",
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  // SSE requires a persistent connection, but Netlify Functions have time limits
  // So we'll return recent logs and provide a polling mechanism
  try {
    const date = event.queryStringParameters?.date || new Date().toISOString().split("T")[0];
    const dataType = event.queryStringParameters?.type;
    const since = event.queryStringParameters?.since; // Timestamp to get logs after
    const limit = parseInt(event.queryStringParameters?.limit || "100");

    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Data logging not configured" }),
      };
    }

    const store = getStore({
      name: "analytics-data",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
    });

    let logs = [];

    if (dataType) {
      const typeKey = `${dataType}-${date}`;
      try {
        const data = await store.get(typeKey, { type: "json" });
        logs = data || [];
      } catch (e) {
        logs = [];
      }
    } else {
      const dateKey = `logs-${date}`;
      try {
        const data = await store.get(dateKey, { type: "json" });
        logs = data || [];
      } catch (e) {
        logs = [];
      }
    }

    // Filter by timestamp if since parameter provided
    if (since) {
      const sinceTime = new Date(since).getTime();
      logs = logs.filter(log => {
        const logTime = new Date(log.timestamp).getTime();
        return logTime > sinceTime;
      });
    }

    // Get most recent logs
    logs = logs.slice(-limit).reverse();

    // Format as Server-Sent Events
    let sseBody = "";
    logs.forEach(log => {
      sseBody += `data: ${JSON.stringify(log)}\n\n`;
    });
    sseBody += `event: end\ndata: {"message": "Stream complete"}\n\n`;

    return {
      statusCode: 200,
      headers,
      body: sseBody,
    };
  } catch (error) {
    console.error("[Stream Logs] Error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message }),
    };
  }
};

