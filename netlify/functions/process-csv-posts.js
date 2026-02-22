/**
 * Process CSV file to add/update posts
 * Accepts CSV file upload and processes it similar to add-and-update-posts-from-csv.js
 */

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

// Parse date string like "Sat, Dec 13, 2025" to ISO
function parseDate(dateStr) {
  try {
    if (!dateStr || dateStr.trim() === '') {
      return null;
    }
    
    const dateMatch = dateStr.match(/(\w+),\s+(\w+)\s+(\d+),\s+(\d+)/);
    if (dateMatch) {
      const [, dayOfWeek, monthName, day, year] = dateMatch;
      
      const monthMap = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };
      
      const month = monthMap[monthName];
      if (month === undefined) {
        return null;
      }
      
      const date = new Date(Date.UTC(parseInt(year), month, parseInt(day), 12, 0, 0));
      
      if (isNaN(date.getTime())) {
        return null;
      }
      
      return date.toISOString();
    }
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString();
  } catch (err) {
    return null;
  }
}

// Parse number string with commas
function parseNumber(str) {
  if (!str || str.trim() === '' || str === '-' || str === 'undefined' || str === '0') return undefined;
  return parseInt(str.replace(/,/g, ''), 10);
}

// Parse CSV data
function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(l => l.trim());
  const posts = [];
  let isFirstLine = true;
  
  for (const line of lines) {
    if (isFirstLine) {
      isFirstLine = false;
      if (line.toLowerCase().includes('post id') || line.toLowerCase().includes('date')) {
        continue;
      }
    }
    
    const parts = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    parts.push(current.trim());
    
    if (parts.length < 4) {
      continue;
    }
    
    const postId = parts[0].trim();
    const date = parts[1].trim();
    
    if (postId.toLowerCase() === 'post id' || date.toLowerCase() === 'date' || !postId || !date) {
      continue;
    }
    
    const post = {
      id: postId,
      date: date,
      text: parts[2] ? parts[2].trim() : '',
      link: parts[3] ? parts[3].trim() : '',
      impressions: parseNumber(parts[4]),
      likes: parseNumber(parts[5]),
      engagements: parseNumber(parts[6]),
      bookmarks: parseNumber(parts[7]),
      shares: parseNumber(parts[8]),
      newFollows: parseNumber(parts[9]),
      replies: parseNumber(parts[10]),
      reposts: parseNumber(parts[11]),
    };
    
    if (post.id && post.date && post.link && !post.link.includes('undefined')) {
      posts.push(post);
    }
  }
  
  return posts;
}

const getUpdateEndpoint = () => {
  const base = process.env.NETLIFY_FUNCTION_URL || process.env.DEPLOY_PRIME_URL || process.env.URL || 'https://noteworthynews.co';
  return `${base.replace(/\/$/, '')}/.netlify/functions/update-post-data`;
};

async function updatePost(postData) {
  const postId = postData.id;
  const dateISO = parseDate(postData.date);
  
  if (!postId || postId === '' || postId === 'Post id') {
    return { success: false, skipped: true, reason: 'No post ID' };
  }
  
  if (!dateISO) {
    return { success: false, skipped: true, reason: 'Invalid date' };
  }
  
  const updatePayload = {
    postId: postId,
    datePosted: dateISO,
    views: postData.impressions,
    likes: postData.likes,
    reposts: postData.reposts,
    replies: postData.replies,
    engagements: postData.engagements,
    bookmarks: postData.bookmarks,
    shares: postData.shares,
    story: postData.text,
    text: postData.text,
    link: postData.link,
    url: postData.link,
  };
  
  Object.keys(updatePayload).forEach(key => {
    if (updatePayload[key] === undefined) {
      delete updatePayload[key];
    }
  });
  
  try {
    const response = await fetch(getUpdateEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log(`[process-csv-posts] Successfully updated post ${postId} - now live on site`);
    return { success: true, postId };
  } catch (error) {
    console.error(`[process-csv-posts] Failed to update post ${postId}:`, error.message);
    return { success: false, postId, error: error.message };
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Parse CSV from request body
    let csvText = null;
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    
    // Handle multipart/form-data (FormData uploads)
    if (contentType.includes('multipart/form-data')) {
      // CRITICAL: Use non-greedy regex to capture only boundary value, not trailing parameters
      // Example: "multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW; charset=utf-8"
      // Should capture: "----WebKitFormBoundary7MA4YWxkTrZu0gW" not "----WebKitFormBoundary7MA4YWxkTrZu0gW; charset=utf-8"
      const boundaryMatch = contentType.match(/boundary=([^;\s]+)/);
      if (boundaryMatch) {
        const boundary = boundaryMatch[1].trim();
        let bodyText = event.body;
        
        // Decode if base64 encoded
        if (event.isBase64Encoded && bodyText) {
          try {
            bodyText = Buffer.from(bodyText, 'base64').toString('utf-8');
          } catch (e) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: "Failed to decode base64 body", details: e.message }),
            };
          }
        }
        
        // Split by boundary
        const parts = bodyText.split(`--${boundary}`);
        for (const part of parts) {
          // Look for the CSV field
          if (part.includes('Content-Disposition') && (part.includes('name="csv"') || part.includes("name='csv'"))) {
            // Extract content after headers (look for double CRLF or double LF)
            const contentMatch = part.match(/(?:\r\n\r\n|\n\n)([\s\S]+?)(?:\r\n--|\n--|$)/);
            if (contentMatch) {
              csvText = contentMatch[1].trim();
              // Remove trailing boundary markers if present
              csvText = csvText.replace(/--\s*$/, '').trim();
              break;
            }
          }
        }
      }
    } else if (event.isBase64Encoded && event.body) {
      // Try to decode base64 (non-multipart)
      try {
        const decoded = Buffer.from(event.body, 'base64').toString('utf-8');
        csvText = decoded;
      } catch (e) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Failed to decode CSV file", details: e.message }),
        };
      }
    } else if (event.body) {
      // Try parsing as JSON (if sent as JSON)
      try {
        const body = JSON.parse(event.body);
        csvText = body.csv || body.content || event.body;
      } catch (e) {
        // If not JSON, treat as plain text CSV
        csvText = event.body;
      }
    }

    if (!csvText || csvText.trim() === '') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: "No CSV data provided",
          details: `Content-Type: ${contentType}, Body length: ${event.body?.length || 0}, Base64: ${event.isBase64Encoded}`
        }),
      };
    }

    // Parse CSV
    const posts = parseCSV(csvText);
    
    if (posts.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "No valid posts found in CSV" }),
      };
    }

    // Process posts
    const results = {
      added: 0,
      updated: 0,
      failed: 0,
      skipped: 0,
      processed: 0,
    };

    // Process first 60 posts per run (to avoid timeout; ~9s at 150ms/post)
    const maxPosts = Math.min(posts.length, 60);
    console.log(`[process-csv-posts] Processing ${maxPosts} of ${posts.length} posts, endpoint: ${getUpdateEndpoint()}`);
    for (let i = 0; i < maxPosts; i++) {
      const post = posts[i];
      const updateResult = await updatePost(post);
      if (updateResult.success) {
        results.updated++;
      } else if (updateResult.skipped) {
        results.skipped++;
      } else {
        results.failed++;
        console.warn(`[process-csv-posts] Failed post ${post.id}:`, updateResult.error);
      }
      results.processed++;
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    console.log(`[process-csv-posts] Done: ${results.updated} updated, ${results.failed} failed, ${results.skipped} skipped`);

    // For remaining posts, return info that they need to be processed in batches
    if (posts.length > maxPosts) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ...results,
          message: `✅ Successfully processed first ${maxPosts} posts - they are now live on the site! ${posts.length - maxPosts} remaining. Upload the CSV again to process the next batch.`,
          remaining: posts.length - maxPosts,
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ...results,
        message: `✅ All ${results.processed} posts have been processed and are now live on the site!`,
      }),
    };
  } catch (error) {
    console.error('[process-csv-posts] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error?.message || "Internal server error",
      }),
    };
  }
};
















