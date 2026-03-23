/**
 * Netlify Function: Transcribe Direct (Clemens Converter)
 * 
 * Fallback function for small files (<5MB) that can be uploaded directly.
 * Bypasses storage and sends file directly to OpenAI Whisper.
 * 
 * Security: Requires CLEMS_TOKEN if configured.
 */

const OpenAI = require("openai");

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
 * Transcribe audio using OpenAI Whisper
 */
async function transcribeAudio(audioBuffer, language = null, includeTimestamps = false) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error("OpenAI API key not configured");
  }

  const openai = new OpenAI({ apiKey: openaiApiKey });

  // Create a File object for OpenAI
  let audioFile;
  
  if (typeof File !== "undefined") {
    audioFile = new File([audioBuffer], "audio.mp3", { type: "audio/mpeg" });
  } else {
    // Fallback for older Node.js: Create File-like object
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

  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1",
    language: language || undefined,
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

    // Parse multipart form data or base64 body
    let audioBuffer;
    let fileName = "audio.mp3";
    let language = null;
    let includeTimestamps = false;

    // Check Content-Type
    const contentType = event.headers["content-type"] || "";
    
    if (contentType.includes("multipart/form-data")) {
      // TODO: Parse multipart form data if needed
      // For now, expect base64 encoded body
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Multipart form data not yet supported. Use JSON with base64." }),
      };
    } else {
      // Expect JSON body with base64 encoded file
      const body = JSON.parse(event.body || "{}");
      const fileData = body.fileData; // base64 string
      fileName = body.fileName || "audio.mp3";
      language = body.language || null;
      includeTimestamps = body.includeTimestamps || false;

      if (!fileData) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Missing fileData (base64 encoded audio)" }),
        };
      }

      // Decode base64
      audioBuffer = Buffer.from(fileData, "base64");
    }

    // Validate file size (5MB limit for direct upload)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (audioBuffer.length > maxSize) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: `File too large for direct upload. Maximum size is ${maxSize / 1024 / 1024}MB. Use the storage upload method instead.` 
        }),
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
    console.error("[transcribe-direct] Error:", error.message);
    
    const errorMessage = error.message.includes("API key") 
      ? "OpenAI API configuration error"
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
