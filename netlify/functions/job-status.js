/**
 * Netlify Function: Get Transcription Job Status (Clemens Converter)
 * 
 * Returns the current status of a transcription job, including progress,
 * chunk completion, and transcript download URL (if done).
 * 
 * Security: Requires CLEMS_TOKEN if configured.
 */

const supabase = require('./lib/supabaseClient');
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

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
 * Generate presigned GET URL for transcript from R2
 */
async function getTranscriptUrl(transcriptKey) {
  if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || 
      !process.env.R2_BUCKET || !process.env.R2_ENDPOINT) {
    return null;
  }

  try {
    const s3Client = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: transcriptKey,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
    return url;
  } catch (error) {
    console.error('[job-status] Error generating transcript URL:', error.message);
    return null;
  }
}

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Clems-Token",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  // Only allow GET
  if (event.httpMethod !== "GET") {
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

    // Get jobId from query params
    const jobId = event.queryStringParameters?.jobId;
    if (!jobId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing jobId parameter" }),
      };
    }

    // Fetch job from Supabase
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

    // Build response
    const response = {
      jobId: job.job_id,
      status: job.status,
      progress: job.progress,
      chunksTotal: job.chunks_total,
      chunksDone: job.chunks_done,
      filename: job.filename,
      language: job.language,
      includeTimestamps: job.include_timestamps,
      errorMessage: job.error_message,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
    };

    // If job is done, generate presigned URLs for transcripts
    if (job.status === 'done' && job.transcript_key) {
      const transcriptUrl = await getTranscriptUrl(job.transcript_key);
      if (transcriptUrl) {
        response.transcriptUrl = transcriptUrl;
      }

      if (job.transcript_json_key) {
        const transcriptJsonUrl = await getTranscriptUrl(job.transcript_json_key);
        if (transcriptJsonUrl) {
          response.transcriptJsonUrl = transcriptJsonUrl;
        }
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("[job-status] Error:", error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: "Failed to get job status",
        message: error.message,
      }),
    };
  }
};
