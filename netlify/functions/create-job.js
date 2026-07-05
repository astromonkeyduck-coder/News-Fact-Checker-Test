/**
 * Netlify Function: Create Transcription Job (Clemens Converter)
 * 
 * Creates a background job for large file transcription (>25MB).
 * Files are chunked and transcribed via multiple OpenAI Whisper calls.
 * 
 * Security: Requires CLEMS_TOKEN if configured.
 */

const supabase = require('./lib/supabaseClient');

/**
 * Check if token authentication is required and valid
 */
function checkToken(event) {
  const requiredToken = process.env.CLEMS_TOKEN;
  if (!requiredToken) {
    console.error('[Security] CLEMS_TOKEN is not configured - denying access (fail-closed).');
    return false;
  }

  const headerToken = event.headers["x-clems-token"] || event.headers["X-Clems-Token"];
  if (headerToken === requiredToken) {
    return true;
  }

  const queryToken = event.queryStringParameters?.token;
  if (queryToken === requiredToken) {
    return true;
  }

  return false;
}

/**
 * Trigger process-job function asynchronously (fire-and-forget)
 * Uses Node.js https module since fetch might not be available in all Node versions
 */
async function triggerProcessJob(jobId) {
  try {
    // Use Node.js built-in https module for reliable HTTP requests
    const https = require('https');
    const http = require('http');
    const { URL } = require('url');
    
    // Get the function URL (works in both local and production)
    // Try multiple environment variables that Netlify provides
    const baseUrl = process.env.URL || 
                   process.env.DEPLOY_PRIME_URL || 
                   process.env.NETLIFY_URL || 
                   (process.env.CONTEXT === 'production' ? 'https://noteworthynews.co' : 'http://localhost:8888');
    const functionUrl = `${baseUrl}/.netlify/functions/process-job`;
    
    console.log(`[create-job] Triggering process-job at: ${functionUrl}`);
    console.log(`[create-job] Environment: URL=${process.env.URL || 'NOT SET'}, DEPLOY_PRIME_URL=${process.env.DEPLOY_PRIME_URL || 'NOT SET'}, CONTEXT=${process.env.CONTEXT || 'NOT SET'}`);
    
    const url = new URL(functionUrl);
    const client = url.protocol === 'https:' ? https : http;
    
    const postData = JSON.stringify({ jobId });
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    };
    
    // Include token if configured
    if (process.env.CLEMS_TOKEN) {
      headers['X-Clems-Token'] = process.env.CLEMS_TOKEN;
    }
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: headers,
      timeout: 5000, // 5 second timeout for trigger
    };
    
    // Make async HTTP call (don't wait for response, but log result)
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[create-job] ✅ Successfully triggered process-job for: ${jobId} (status: ${res.statusCode})`);
        } else {
          console.error(`[create-job] ⚠️ process-job returned status ${res.statusCode} for ${jobId}`);
          console.error(`[create-job] Response: ${data.substring(0, 500)}`);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error(`[create-job] ❌ Failed to trigger process-job for ${jobId}:`, error.message);
      console.error(`[create-job] URL attempted: ${functionUrl}`);
      console.error(`[create-job] Error details:`, error);
      // Don't fail - job is created, can be processed manually if needed
    });
    
    req.on('timeout', () => {
      req.destroy();
      console.error(`[create-job] ⚠️ Timeout triggering process-job for ${jobId} after 5s`);
      console.error(`[create-job] URL attempted: ${functionUrl}`);
      // Timeout is OK - the function might still process, or can be triggered manually
    });
    
    req.write(postData);
    req.end();
    
    console.log(`[create-job] 📤 Triggering process-job for: ${jobId} at ${functionUrl}`);
  } catch (error) {
    console.error('[create-job] Error triggering process-job:', error.message);
    // Don't throw - job is created, can be processed manually if needed
  }
}

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Clems-Token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Check token if configured
    if (!checkToken(event)) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Unauthorized: Invalid or missing token" }),
      };
    }

    // Parse request body
    const body = JSON.parse(event.body || "{}");
    const { r2Key, filename, language = null, includeTimestamps = false } = body;

    // Validate input
    if (!r2Key || !filename) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing required fields: r2Key, filename" }),
      };
    }

    // Create job record in Supabase
    const { data: job, error: insertError } = await supabase
      .from('transcription_jobs')
      .insert({
        status: 'queued',
        progress: 0,
        chunks_total: null,
        chunks_done: 0,
        r2_key: r2Key,
        filename: filename,
        language: language || null,
        include_timestamps: includeTimestamps || false,
        error_message: null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[create-job] Supabase insert error:', insertError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: "Failed to create job",
          message: insertError.message,
        }),
      };
    }

    console.log('[create-job] ✅ Created job:', job.job_id);

    // Trigger background processor asynchronously (fire-and-forget)
    // Don't await - let it run in background, but log the attempt
    triggerProcessJob(job.job_id).catch(error => {
      console.error(`[create-job] ⚠️ Failed to trigger process-job for ${job.job_id}:`, error.message);
      // Job is still created, can be triggered manually via /api/trigger-job
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        jobId: job.job_id,
        status: job.status,
        progress: job.progress,
      }),
    };
  } catch (error) {
    console.error("[create-job] Error:", error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: "Failed to create job",
        message: error.message,
      }),
    };
  }
};
