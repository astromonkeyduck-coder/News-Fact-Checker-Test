/**
 * Netlify Function: Trigger All Queued Jobs (Clemens Converter)
 * 
 * Manually triggers all jobs that are stuck in "queued" status.
 * Useful for recovery when automatic triggers fail.
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
    console.error('[Security] CLEMS_TOKEN is not configured — denying access (fail-closed).');
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
 * Trigger process-job function asynchronously
 */
async function triggerProcessJob(jobId) {
  try {
    const https = require('https');
    const http = require('http');
    const { URL } = require('url');
    
    const baseUrl = process.env.URL || 
                   process.env.DEPLOY_PRIME_URL || 
                   process.env.NETLIFY_URL || 
                   (process.env.CONTEXT === 'production' ? 'https://noteworthynews.co' : 'http://localhost:8888');
    const functionUrl = `${baseUrl}/.netlify/functions/process-job`;
    
    const url = new URL(functionUrl);
    const client = url.protocol === 'https:' ? https : http;
    
    const postData = JSON.stringify({ jobId });
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    };
    
    if (process.env.CLEMS_TOKEN) {
      headers['X-Clems-Token'] = process.env.CLEMS_TOKEN;
    }
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: headers,
      timeout: 5000,
    };
    
    return new Promise((resolve, reject) => {
      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, statusCode: res.statusCode });
          } else {
            reject(new Error(`Status ${res.statusCode}: ${data.substring(0, 200)}`));
          }
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout'));
      });
      
      req.write(postData);
      req.end();
    });
  } catch (error) {
    throw new Error(`Failed to trigger process-job: ${error.message}`);
  }
}

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Clems-Token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    if (!checkToken(event)) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Unauthorized: Invalid or missing token" }),
      };
    }

    // Get all queued jobs
    const { data: queuedJobs, error: fetchError } = await supabase
      .from('transcription_jobs')
      .select('job_id, filename, created_at')
      .eq('status', 'queued')
      .order('created_at', { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch queued jobs: ${fetchError.message}`);
    }

    if (!queuedJobs || queuedJobs.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: "No queued jobs found",
          triggered: 0,
        }),
      };
    }

    console.log(`[trigger-all-queued-jobs] Found ${queuedJobs.length} queued jobs`);

    // Trigger each job
    const results = [];
    for (const job of queuedJobs) {
      try {
        await triggerProcessJob(job.job_id);
        results.push({ jobId: job.job_id, filename: job.filename, status: 'triggered' });
        console.log(`[trigger-all-queued-jobs] ✅ Triggered job: ${job.job_id}`);
      } catch (error) {
        results.push({ jobId: job.job_id, filename: job.filename, status: 'error', error: error.message });
        console.error(`[trigger-all-queued-jobs] ❌ Failed to trigger job ${job.job_id}:`, error.message);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: `Triggered ${results.filter(r => r.status === 'triggered').length} of ${queuedJobs.length} queued jobs`,
        total: queuedJobs.length,
        triggered: results.filter(r => r.status === 'triggered').length,
        failed: results.filter(r => r.status === 'error').length,
        results: results,
      }),
    };
  } catch (error) {
    console.error("[trigger-all-queued-jobs] Error:", error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: "Failed to trigger queued jobs",
        message: error.message,
      }),
    };
  }
};
