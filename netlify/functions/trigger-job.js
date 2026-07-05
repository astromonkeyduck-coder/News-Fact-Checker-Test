/**
 * Netlify Function: Trigger Transcription Job (Clemens Converter)
 * 
 * Manually triggers a stuck job that's in "queued" status.
 * This is useful when the automatic trigger fails.
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
 * Trigger process-job function asynchronously
 */
async function triggerProcessJob(jobId) {
  try {
    const https = require('https');
    const http = require('http');
    const { URL } = require('url');
    
    const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'http://localhost:8888';
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

    const body = JSON.parse(event.body || "{}");
    const { jobId } = body;

    if (!jobId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing jobId parameter" }),
      };
    }

    // Check if job exists and is in queued status
    const { data: job, error: fetchError } = await supabase
      .from('transcription_jobs')
      .select('*')
      .eq('job_id', jobId)
      .single();

    if (fetchError || !job) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Job not found" }),
      };
    }

    // Allow triggering queued jobs OR stuck transcribing jobs
    if (job.status === 'queued') {
      // Normal case - trigger queued job
    } else if (job.status === 'transcribing' && job.chunks_done < job.chunks_total) {
      // Job is stuck in transcribing - allow retrigger
      const updatedAt = new Date(job.updated_at);
      const minutesSinceUpdate = (Date.now() - updatedAt.getTime()) / 1000 / 60;
      if (minutesSinceUpdate > 5) {
        console.log(`[trigger-job] Allowing retrigger of stuck job ${jobId} (${minutesSinceUpdate.toFixed(1)} min since update)`);
      } else {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: `Job is actively processing (updated ${minutesSinceUpdate.toFixed(1)} min ago). Wait longer before retriggering.`,
            currentStatus: job.status,
          }),
        };
      }
    } else if (job.status !== 'queued') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: `Job is not in queued status (current: ${job.status})`,
          currentStatus: job.status,
        }),
      };
    }

    // Trigger the job
    await triggerProcessJob(jobId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "Job trigger sent successfully",
        jobId: jobId,
      }),
    };
  } catch (error) {
    console.error("[trigger-job] Error:", error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: "Failed to trigger job",
        message: error.message,
      }),
    };
  }
};
