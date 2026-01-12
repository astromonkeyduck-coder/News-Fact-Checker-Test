/**
 * Netlify Function: Transcribe from URL (Clemens Converter)
 * 
 * Downloads audio file from storage (R2 or Blobs), sends to OpenAI Whisper,
 * and returns transcript. Automatically cleans up storage after transcription.
 * 
 * Security: Requires CLEMS_TOKEN if configured.
 */

const OpenAI = require("openai");
const { getStore } = require("@netlify/blobs");

/**
 * Check if token authentication is required and valid
 */
function checkToken(event) {
  const requiredToken = process.env.CLEMS_TOKEN;
  if (!requiredToken) {
    return true;
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
 * Download file from Netlify Blobs
 */
async function downloadFromBlobs(objectKey) {
  if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
    throw new Error("Netlify Blobs not configured");
  }

  const store = getStore({
    name: "clemens-uploads",
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
  });

  const fileData = await store.get(objectKey, { type: "arrayBuffer" });
  if (!fileData) {
    throw new Error("File not found in storage");
  }

  return Buffer.from(fileData);
}

/**
 * Download file from Cloudflare R2 (if configured)
 */
async function downloadFromR2(objectKey) {
  // Check if R2 is configured
  if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || 
      !process.env.R2_BUCKET || !process.env.R2_ENDPOINT) {
    return null;
  }

  // TODO: Implement R2 download using @aws-sdk/client-s3
  // const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
  // ... download from R2
  
  return null;
}

/**
 * Delete file from storage after transcription
 */
async function cleanupStorage(objectKey, storageType = "blobs") {
  try {
    if (storageType === "blobs") {
      const store = getStore({
        name: "clemens-uploads",
        siteID: process.env.NETLIFY_SITE_ID,
        token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
      });
      await store.delete(objectKey);
    } else if (storageType === "r2") {
      // TODO: Implement R2 deletion
    }
  } catch (error) {
    console.error("[transcribe-from-url] Cleanup error (non-fatal):", error.message);
    // Don't fail transcription if cleanup fails
  }
}

/**
 * Transcribe audio using OpenAI Whisper
 */
async function transcribeAudio(audioBuffer, language = null, includeTimestamps = false) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error("OpenAI API key not configured");
  }

  const openai = new OpenAI({ apiKey: openaiApiKey });

  // Create a File object for OpenAI
  // OpenAI SDK v4 accepts File, Blob, or File-like objects
  // In Node.js 18+, File API is available
  let audioFile;
  
  if (typeof File !== "undefined") {
    // Node.js 18+ has native File API
    audioFile = new File([audioBuffer], "audio.mp3", { type: "audio/mpeg" });
  } else {
    // Fallback for older Node.js: Create File-like object
    // OpenAI SDK will accept this if it has the right shape
    const { Readable } = require("stream");
    const stream = Readable.from([audioBuffer]);
    
    audioFile = Object.assign(stream, {
      name: "audio.mp3",
      type: "audio/mpeg",
      size: audioBuffer.length,
      [Symbol.toStringTag]: "File",
    });
  }

  const startTime = Date.now();

  // Call Whisper API
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1",
    language: language || undefined, // undefined = auto-detect
    response_format: includeTimestamps ? "verbose_json" : "json",
    timestamp_granularities: includeTimestamps ? ["segment"] : undefined,
  });

  const elapsedMs = Date.now() - startTime;

  return {
    transcript: transcription,
    elapsedMs,
    modelUsed: "whisper-1",
  };
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
    const { objectKey, storageType = "blobs", language = null, includeTimestamps = false } = body;

    if (!objectKey) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing objectKey parameter" }),
      };
    }

    // Download file from storage
    let audioBuffer;
    if (storageType === "r2") {
      audioBuffer = await downloadFromR2(objectKey);
      if (!audioBuffer) {
        // Fallback to Blobs if R2 download fails
        audioBuffer = await downloadFromBlobs(objectKey);
      }
    } else {
      audioBuffer = await downloadFromBlobs(objectKey);
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "File not found in storage" }),
      };
    }

    // Transcribe audio
    const { transcript, elapsedMs, modelUsed } = await transcribeAudio(
      audioBuffer,
      language,
      includeTimestamps
    );

    // Extract transcript text and segments
    let transcriptText;
    let segments = null;

    if (includeTimestamps && transcript.segments) {
      transcriptText = transcript.text;
      segments = transcript.segments.map(seg => ({
        id: seg.id,
        start: seg.start,
        end: seg.end,
        text: seg.text,
      }));
    } else {
      transcriptText = typeof transcript === "string" ? transcript : transcript.text;
    }

    // Clean up storage
    await cleanupStorage(objectKey, storageType);

    // Get filename from objectKey (last part after /)
    const fileName = objectKey.split("/").pop() || "audio.mp3";

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        fileName,
        transcriptText,
        segments,
        modelUsed,
        elapsedMs,
        language: transcript.language || language || "auto",
      }),
    };
  } catch (error) {
    console.error("[transcribe-from-url] Error:", error.message);
    
    // Don't expose internal errors, but log them
    const errorMessage = error.message.includes("API key") 
      ? "OpenAI API configuration error"
      : error.message.includes("not found") || error.message.includes("404")
      ? "File not found"
      : "Transcription failed";

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: errorMessage,
        message: process.env.NODE_ENV === "development" ? error.message : undefined,
      }),
    };
  }
};
