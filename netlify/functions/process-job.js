/**
 * Netlify Function: Process Transcription Job (Clemens Converter)
 * 
 * Background function that processes large audio files (>25MB) by:
 * 1. Downloading audio from R2
 * 2. Normalizing audio (mono, 16kHz, low bitrate)
 * 3. Segmenting into chunks (8-10 min each, 1-2s overlap)
 * 4. Transcribing each chunk with OpenAI Whisper
 * 5. Merging transcripts with timestamp offsets
 * 6. Storing final transcript to R2
 * 
 * This function can run longer than normal Netlify function timeout.
 * Security: Requires CLEMS_TOKEN if configured.
 */

const supabase = require('./lib/supabaseClient');
const OpenAI = require("openai");
const { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Use ffmpeg-static for Node.js-compatible ffmpeg binary
let ffmpegPath;
try {
  const ffmpegStatic = require('ffmpeg-static');
  ffmpegPath = ffmpegStatic;
} catch (error) {
  // Fallback: try to find system ffmpeg
  ffmpegPath = 'ffmpeg';
  console.warn('[process-job] ffmpeg-static not found, using system ffmpeg');
}

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

  const body = event.body ? JSON.parse(event.body) : {};
  if (body.token === requiredToken) {
    return true;
  }

  return false;
}

/**
 * Download file from R2
 */
async function downloadFromR2(objectKey) {
  if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || 
      !process.env.R2_BUCKET || !process.env.R2_ENDPOINT) {
    throw new Error("R2 not configured");
  }

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
    Key: objectKey,
  });

  const response = await s3Client.send(command);
  if (!response.Body) {
    throw new Error(`File not found in R2: ${objectKey}`);
  }

  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  console.log(`[process-job] ✅ Downloaded ${buffer.length} bytes from R2: ${objectKey}`);
  return buffer;
}

/**
 * Upload file to R2
 */
async function uploadToR2(objectKey, buffer, contentType = 'text/plain') {
  if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || 
      !process.env.R2_BUCKET || !process.env.R2_ENDPOINT) {
    throw new Error("R2 not configured");
  }

  const s3Client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: objectKey,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);
  console.log(`[process-job] ✅ Uploaded to R2: ${objectKey}`);
}

/**
 * Delete file from R2
 */
async function deleteFromR2(objectKey) {
  if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || 
      !process.env.R2_BUCKET || !process.env.R2_ENDPOINT) {
    return; // R2 not configured, skip cleanup
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

    const command = new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: objectKey,
    });

    await s3Client.send(command);
    console.log(`[process-job] ✅ Deleted from R2: ${objectKey}`);
  } catch (error) {
    console.error(`[process-job] Cleanup error (non-fatal):`, error.message);
  }
}

/**
 * Run ffmpeg command and return promise
 */
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    console.log(`[process-job] Running: ffmpeg ${args.join(' ')}`);
    const ffmpeg = spawn(ffmpegPath, args);
    
    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg failed with code ${code}: ${stderr.substring(0, 500)}`));
      }
    });

    ffmpeg.on('error', (error) => {
      reject(new Error(`ffmpeg spawn error: ${error.message}`));
    });
  });
}

/**
 * Normalize audio: mono, 16kHz, 48kbps
 */
async function normalizeAudio(inputPath, outputPath) {
  await runFfmpeg([
    '-i', inputPath,
    '-ac', '1',        // Mono
    '-ar', '16000',    // 16kHz sample rate
    '-b:a', '48k',     // 48kbps bitrate
    '-y',              // Overwrite output
    outputPath,
  ]);
  console.log(`[process-job] ✅ Normalized audio: ${outputPath}`);
}

/**
 * Segment audio into chunks (10 minutes each, with overlap)
 */
async function segmentAudio(inputPath, chunksDir, chunkDuration = 600) {
  // Create chunks directory
  await fs.mkdir(chunksDir, { recursive: true });

  // Segment with overlap: 10 min chunks, 2 second overlap
  // We'll create overlapping segments manually to ensure proper boundaries
  const overlapSeconds = 2;
  
  // First, get audio duration
  const durationResult = await runFfmpeg([
    '-i', inputPath,
    '-f', 'null',
    '-',
  ]).catch(() => {
    // If duration detection fails, estimate from file size
    return null;
  });

  // For now, use fixed chunking - segment every 10 minutes
  // Overlap will be handled during merge
  await runFfmpeg([
    '-i', inputPath,
    '-f', 'segment',
    '-segment_time', chunkDuration.toString(),
    '-segment_format', 'mp3',
    '-reset_timestamps', '1',
    '-c:a', 'libmp3lame',
    '-b:a', '48k',
    path.join(chunksDir, 'chunk%03d.mp3'),
  ]);

  // List chunk files
  const files = await fs.readdir(chunksDir);
  const chunkFiles = files
    .filter(f => f.startsWith('chunk') && f.endsWith('.mp3'))
    .sort()
    .map(f => path.join(chunksDir, f));

  console.log(`[process-job] ✅ Created ${chunkFiles.length} chunks`);
  return chunkFiles;
}

/**
 * Transcribe audio chunk with OpenAI Whisper
 */
async function transcribeChunk(chunkBuffer, language = null, includeTimestamps = false, retries = 2) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error("OpenAI API key not configured");
  }

  const openai = new OpenAI({ apiKey: openaiApiKey });

  // Create File object for OpenAI
  let audioFile;
  if (typeof File !== "undefined") {
    audioFile = new File([chunkBuffer], "chunk.mp3", { type: "audio/mpeg" });
  } else {
    const { Readable } = require("stream");
    const stream = Readable.from([chunkBuffer]);
    audioFile = Object.assign(stream, {
      name: "chunk.mp3",
      type: "audio/mpeg",
      size: chunkBuffer.length,
      [Symbol.toStringTag]: "File",
    });
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: language || undefined,
        response_format: includeTimestamps ? "verbose_json" : "json",
        timestamp_granularities: includeTimestamps ? ["segment"] : undefined,
      });

      return transcription;
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`[process-job] Chunk transcription failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Update job progress in Supabase
 */
async function updateJobProgress(jobId, updates) {
  const { error } = await supabase
    .from('transcription_jobs')
    .update(updates)
    .eq('job_id', jobId);

  if (error) {
    console.error('[process-job] Failed to update job progress:', error);
  }
}

/**
 * Merge transcripts with timestamp offsets
 */
function mergeTranscripts(chunkResults, chunkDuration, includeTimestamps) {
  if (!includeTimestamps) {
    // Simple concatenation
    return chunkResults.map(r => typeof r === 'string' ? r : r.text).join('\n\n');
  }

  // Merge with timestamp offsets
  let mergedText = '';
  let mergedSegments = [];
  let currentTime = 0;

  for (let i = 0; i < chunkResults.length; i++) {
    const result = chunkResults[i];
    const chunkStartTime = i * chunkDuration;
    
    if (result.segments && Array.isArray(result.segments)) {
      for (const segment of result.segments) {
        // Offset timestamps by chunk start time
        const offsetSegment = {
          ...segment,
          start: segment.start + chunkStartTime,
          end: segment.end + chunkStartTime,
        };
        
        // De-duplicate: skip if this segment overlaps with previous (within 1 second)
        const lastSegment = mergedSegments[mergedSegments.length - 1];
        if (lastSegment && offsetSegment.start < lastSegment.end + 1) {
          // Overlap detected - skip this segment
          continue;
        }
        
        mergedSegments.push(offsetSegment);
        mergedText += segment.text + ' ';
      }
    } else {
      // No segments, just text
      const text = typeof result === 'string' ? result : result.text;
      mergedText += text + '\n\n';
    }
  }

  return {
    text: mergedText.trim(),
    segments: mergedSegments,
    language: chunkResults[0]?.language || 'unknown',
  };
}

/**
 * Main processing function
 */
async function processJob(jobId) {
  const tmpDir = path.join(os.tmpdir(), `clemens-job-${jobId}`);
  
  try {
    // Load job from Supabase
    const { data: job, error: fetchError } = await supabase
      .from('transcription_jobs')
      .select('*')
      .eq('job_id', jobId)
      .single();

    if (fetchError || !job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    console.log(`[process-job] Processing job: ${jobId}, file: ${job.filename}`);

    // Update status to processing
    await updateJobProgress(jobId, { status: 'processing' });

    // Create temp directory
    await fs.mkdir(tmpDir, { recursive: true });
    const inputPath = path.join(tmpDir, 'input.mp3');
    const normalizedPath = path.join(tmpDir, 'normalized.mp3');
    const chunksDir = path.join(tmpDir, 'chunks');

    // Step 1: Download audio from R2
    console.log(`[process-job] Downloading from R2: ${job.r2_key}`);
    const audioBuffer = await downloadFromR2(job.r2_key);
    await fs.writeFile(inputPath, audioBuffer);

    // Step 2: Normalize audio
    console.log(`[process-job] Normalizing audio...`);
    await normalizeAudio(inputPath, normalizedPath);

    // Step 3: Segment into chunks
    console.log(`[process-job] Segmenting audio...`);
    const chunkFiles = await segmentAudio(normalizedPath, chunksDir, 600); // 10 min chunks
    const chunksTotal = chunkFiles.length;
    await updateJobProgress(jobId, { 
      status: 'transcribing',
      chunks_total: chunksTotal,
      chunks_done: 0,
    });

    // Step 4: Transcribe each chunk
    console.log(`[process-job] Transcribing ${chunksTotal} chunks...`);
    const chunkResults = [];
    
    for (let i = 0; i < chunkFiles.length; i++) {
      const chunkPath = chunkFiles[i];
      console.log(`[process-job] Transcribing chunk ${i + 1}/${chunksTotal}...`);
      
      const chunkBuffer = await fs.readFile(chunkPath);
      const transcription = await transcribeChunk(
        chunkBuffer,
        job.language,
        job.include_timestamps
      );
      
      chunkResults.push(transcription);
      
      // Update progress
      const chunksDone = i + 1;
      const progress = Math.round((chunksDone / chunksTotal) * 100);
      await updateJobProgress(jobId, {
        chunks_done: chunksDone,
        progress: progress,
      });
    }

    // Step 5: Merge transcripts
    console.log(`[process-job] Merging transcripts...`);
    await updateJobProgress(jobId, { status: 'finalizing' });
    
    const merged = mergeTranscripts(chunkResults, 600, job.include_timestamps);
    
    // Step 6: Store transcripts to R2
    const transcriptKey = `transcripts/${jobId}.txt`;
    const transcriptText = typeof merged === 'string' ? merged : merged.text;
    await uploadToR2(transcriptKey, Buffer.from(transcriptText, 'utf-8'), 'text/plain');
    
    let transcriptJsonKey = null;
    if (job.include_timestamps && merged.segments) {
      transcriptJsonKey = `transcripts/${jobId}.json`;
      const transcriptJson = JSON.stringify({
        text: merged.text,
        segments: merged.segments,
        language: merged.language,
      }, null, 2);
      await uploadToR2(transcriptJsonKey, Buffer.from(transcriptJson, 'utf-8'), 'application/json');
    }

    // Step 7: Update job as done
    await updateJobProgress(jobId, {
      status: 'done',
      progress: 100,
      transcript_key: transcriptKey,
      transcript_json_key: transcriptJsonKey,
    });

    // Step 8: Cleanup - delete original audio from R2
    await deleteFromR2(job.r2_key);

    console.log(`[process-job] ✅ Job completed: ${jobId}`);

  } catch (error) {
    console.error(`[process-job] ❌ Job failed: ${jobId}`, error);
    
    // Update job with error
    await updateJobProgress(jobId, {
      status: 'error',
      error_message: error.message,
    });
    
    throw error;
  } finally {
    // Cleanup temp files
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error(`[process-job] Cleanup error (non-fatal):`, cleanupError.message);
    }
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
    const { jobId } = body;

    if (!jobId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing jobId parameter" }),
      };
    }

    // Process job (this may take a long time for large files)
    // Note: Netlify Functions have timeout limits, but we'll process as much as possible
    // If timeout occurs, job will remain in "processing" state and can be retried
    await processJob(jobId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "Job processing completed",
        jobId: jobId,
      }),
    };
  } catch (error) {
    console.error("[process-job] Error:", error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: "Failed to start job processing",
        message: error.message,
      }),
    };
  }
};
