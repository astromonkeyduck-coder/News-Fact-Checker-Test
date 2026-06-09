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
 * Download file from Cloudflare R2
 */
async function downloadFromR2(objectKey) {
  // Check if R2 is configured
  if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || 
      !process.env.R2_BUCKET || !process.env.R2_ENDPOINT) {
    return null;
  }

  try {
    const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

    // Create S3 client configured for R2
    const s3Client = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

    // Download file from R2
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: objectKey,
    });

    const response = await s3Client.send(command);
    
    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    console.log(`[transcribe-from-url] ✅ Downloaded ${buffer.length} bytes from R2: ${objectKey}`);
    return buffer;
  } catch (error) {
    console.error('[transcribe-from-url] R2 download error:', error.message);
    return null;
  }
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
      console.log(`[transcribe-from-url] ✅ Deleted from Blobs: ${objectKey}`);
    } else if (storageType === "r2") {
      // Delete from R2
      if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || 
          !process.env.R2_BUCKET || !process.env.R2_ENDPOINT) {
        return;
      }

      const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");

      const s3Client = new S3Client({
        region: "auto",
        endpoint: process.env.R2_ENDPOINT,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
      });

      const command = new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: objectKey,
      });

      await s3Client.send(command);
      console.log(`[transcribe-from-url] ✅ Deleted from R2: ${objectKey}`);
    }
  } catch (error) {
    console.error("[transcribe-from-url] Cleanup error (non-fatal):", error.message);
    // Don't fail transcription if cleanup fails
  }
}

/**
 * Map a file extension to a content type Whisper understands.
 * Whisper detects format from the filename extension, so we must preserve it
 * (e.g. an MP4 sent as "audio.mp3" is rejected as an invalid format).
 */
function mediaTypeForName(fileName) {
  const ext = (fileName || "").split(".").pop()?.toLowerCase() || "mp3";
  const map = {
    mp3: "audio/mpeg",
    mpga: "audio/mpeg",
    mpeg: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    mp4: "video/mp4",
    m4v: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    ogg: "audio/ogg",
    oga: "audio/ogg",
    flac: "audio/flac",
  };
  return { ext, contentType: map[ext] || "audio/mpeg" };
}

/**
 * Transcribe audio using OpenAI Whisper
 */
async function transcribeAudio(audioBuffer, language = null, includeTimestamps = false, fileName = "audio.mp3") {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error("OpenAI API key not configured");
  }

  const openai = new OpenAI({ apiKey: openaiApiKey });

  // Preserve the original extension so Whisper detects the format correctly.
  const { ext, contentType } = mediaTypeForName(fileName);
  const uploadName = `audio.${ext}`;

  // Create a File object for OpenAI
  // OpenAI SDK v4 accepts File, Blob, or File-like objects
  // In Node.js 18+, File API is available
  let audioFile;
  
  if (typeof File !== "undefined") {
    // Node.js 18+ has native File API
    audioFile = new File([audioBuffer], uploadName, { type: contentType });
  } else {
    // Fallback for older Node.js: Create File-like object
    // OpenAI SDK will accept this if it has the right shape
    const { Readable } = require("stream");
    const stream = Readable.from([audioBuffer]);
    
    audioFile = Object.assign(stream, {
      name: uploadName,
      type: contentType,
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

    // Derive the original filename so Whisper sees the correct extension.
    const fileName = objectKey.split("/").pop() || "audio.mp3";

    // Transcribe audio
    const { transcript, elapsedMs, modelUsed } = await transcribeAudio(
      audioBuffer,
      language,
      includeTimestamps,
      fileName
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
