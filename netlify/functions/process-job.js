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
const fs = require('fs');
const fsPromises = require('fs').promises;
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
  await fsPromises.mkdir(chunksDir, { recursive: true });

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

  // List chunk files and validate they exist
  const files = await fsPromises.readdir(chunksDir);
  const chunkFiles = files
    .filter(f => f.startsWith('chunk') && f.endsWith('.mp3'))
    .sort()
    .map(f => path.join(chunksDir, f));

  // Validate all chunks exist and have content (especially important for first chunk)
  for (let i = 0; i < chunkFiles.length; i++) {
    const chunkFile = chunkFiles[i];
    try {
      const chunkStats = await fsPromises.stat(chunkFile);
      if (chunkStats.size === 0) {
        throw new Error(`Chunk ${i + 1} (${path.basename(chunkFile)}) is empty (0 bytes)`);
      }
      if (chunkStats.size < 1000) {
        console.warn(`[process-job] ⚠️ Chunk ${i + 1} is very small (${chunkStats.size} bytes)`);
      }
      console.log(`[process-job] Chunk ${i + 1}: ${path.basename(chunkFile)} (${(chunkStats.size / 1024 / 1024).toFixed(2)} MB)`);
    } catch (statError) {
      throw new Error(`Chunk ${i + 1} validation failed: ${statError.message}`);
    }
  }

  console.log(`[process-job] ✅ Created ${chunkFiles.length} chunks (all validated)`);
  return chunkFiles;
}

/**
 * Transcribe audio chunk with OpenAI Whisper
 * Uses fs.createReadStream for reliable file handling in Node.js
 */
async function transcribeChunk(chunkPath, language = null, includeTimestamps = false, retries = 2) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error("OpenAI API key not configured");
  }

  const openai = new OpenAI({ apiKey: openaiApiKey });

  // Get file stats for logging and validation
  const stats = await fsPromises.stat(chunkPath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`[process-job] Transcribing chunk: ${chunkPath} (${sizeMB} MB)`);
  
  // Validate file size (OpenAI has a 25MB limit per request)
  if (stats.size > 25 * 1024 * 1024) {
    throw new Error(`Chunk file is too large: ${sizeMB} MB (max 25MB)`);
  }
  
  // Warn if file is suspiciously small (might be corrupted or empty)
  if (stats.size < 1000) {
    console.warn(`[process-job] ⚠️ Chunk file is very small (${stats.size} bytes), may be corrupted or empty`);
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    // Create a fresh stream for each attempt (streams can only be read once)
    let audioFile;
    try {
      audioFile = fs.createReadStream(chunkPath);
    } catch (streamError) {
      console.error(`[process-job] Failed to create read stream:`, streamError.message);
      if (attempt === retries) {
        throw new Error(`Cannot read chunk file: ${streamError.message}`);
      }
      // Wait before retrying stream creation
      await new Promise(resolve => setTimeout(resolve, 1000));
      continue;
    }
    
    try {
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: language || undefined,
        response_format: includeTimestamps ? "verbose_json" : "json",
        timestamp_granularities: includeTimestamps ? ["segment"] : undefined,
      });

      // Validate transcription response
      if (!transcription) {
        throw new Error('OpenAI returned empty transcription');
      }
      
      console.log(`[process-job] ✅ Chunk transcribed successfully (attempt ${attempt + 1})`);
      if (transcription.text) {
        const preview = transcription.text.substring(0, 100);
        console.log(`[process-job] Transcription preview: ${preview}${transcription.text.length > 100 ? '...' : ''}`);
      }
      
      return transcription;
    } catch (error) {
      // Close the stream if it's still open
      if (audioFile && !audioFile.destroyed) {
        audioFile.destroy();
      }
      
      console.error(`[process-job] ❌ Chunk transcription attempt ${attempt + 1}/${retries + 1} failed:`, error.message);
      if (error.response) {
        console.error(`[process-job] OpenAI API error details:`, JSON.stringify(error.response.data || error.response.status, null, 2));
      }
      if (error.code) {
        console.error(`[process-job] Error code: ${error.code}`);
      }
      
      if (attempt === retries) {
        throw new Error(`Failed to transcribe chunk after ${retries + 1} attempts: ${error.message}`);
      }
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`[process-job] Retrying in ${delay}ms...`);
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
  const startTime = Date.now();
  const MAX_EXECUTION_TIME = 14 * 60 * 1000; // 14 minutes (leave 1 min buffer)
  
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

    console.log(`[process-job] Processing job: ${jobId}, file: ${job.filename}, current status: ${job.status}`);

    // If job is already done or in error state, don't process again
    if (job.status === 'done' || job.status === 'error') {
      console.log(`[process-job] Job ${jobId} already ${job.status}, skipping`);
      return;
    }
    
    // Check if job is stuck (transcribing but hasn't updated in a while)
    // If chunks_done > 0 but not equal to chunks_total, and it's been more than 5 minutes, resume
    if (job.status === 'transcribing' && job.chunks_total && job.chunks_done < job.chunks_total) {
      const updatedAt = new Date(job.updated_at);
      const minutesSinceUpdate = (Date.now() - updatedAt.getTime()) / 1000 / 60;
      if (minutesSinceUpdate > 5) {
        console.log(`[process-job] ⚠️ Job ${jobId} appears stuck (${minutesSinceUpdate.toFixed(1)} min since last update). Resuming from chunk ${job.chunks_done + 1}/${job.chunks_total}`);
        // Continue processing from where it left off
      }
    }

    // Update status to processing (only if it's queued or stuck in transcribing)
    if (job.status === 'queued') {
      await updateJobProgress(jobId, { status: 'processing' });
    } else if (job.status === 'transcribing' && job.chunks_done < job.chunks_total) {
      // Job is stuck in transcribing - resume it
      console.log(`[process-job] Resuming stuck job ${jobId} from chunk ${job.chunks_done + 1}/${job.chunks_total}`);
      await updateJobProgress(jobId, { status: 'processing' });
    } else if (job.status !== 'processing' && job.status !== 'transcribing' && job.status !== 'finalizing') {
      // If status is unexpected, log warning but continue
      console.warn(`[process-job] Job ${jobId} has unexpected status: ${job.status}, continuing anyway`);
      await updateJobProgress(jobId, { status: 'processing' });
    }

    // Create temp directory
    await fsPromises.mkdir(tmpDir, { recursive: true });
    const inputPath = path.join(tmpDir, 'input.mp3');
    const normalizedPath = path.join(tmpDir, 'normalized.mp3');
    const chunksDir = path.join(tmpDir, 'chunks');

    // Step 1: Download audio from R2
    console.log(`[process-job] Downloading from R2: ${job.r2_key}`);
    const audioBuffer = await downloadFromR2(job.r2_key);
    await fsPromises.writeFile(inputPath, audioBuffer);

    // Step 2: Normalize audio
    console.log(`[process-job] Normalizing audio...`);
    await normalizeAudio(inputPath, normalizedPath);
    
    // Verify normalized file exists and has content
    const normalizedStats = await fsPromises.stat(normalizedPath);
    if (normalizedStats.size === 0) {
      throw new Error('Normalized audio file is empty');
    }
    console.log(`[process-job] ✅ Normalized audio: ${(normalizedStats.size / 1024 / 1024).toFixed(2)} MB`);

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
    const startTime = Date.now();
    const MAX_EXECUTION_TIME = 14 * 60 * 1000; // 14 minutes (leave 1 min buffer)
    
    // Check if we're resuming from a previous attempt
    let startChunkIndex = 0;
    if (job.chunks_done && job.chunks_done > 0 && job.chunks_done < chunksTotal) {
      startChunkIndex = job.chunks_done; // Resume from next chunk
      console.log(`[process-job] 🔄 Resuming from chunk ${startChunkIndex + 1}/${chunksTotal}`);
    }
    
    for (let i = startChunkIndex; i < chunkFiles.length; i++) {
      // Check execution time to prevent timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > MAX_EXECUTION_TIME) {
        console.warn(`[process-job] ⚠️ Approaching timeout (${(elapsed / 1000 / 60).toFixed(1)} min elapsed). Saving progress and stopping.`);
        await updateJobProgress(jobId, {
          status: 'transcribing',
          chunks_done: i,
          progress: Math.round((i / chunksTotal) * 100),
        });
        throw new Error(`Function timeout approaching. Processed ${i}/${chunksTotal} chunks. Job can be resumed.`);
      }
      
      const chunkPath = chunkFiles[i];
      const chunkIndex = i + 1;
      console.log(`[process-job] 📝 Transcribing chunk ${chunkIndex}/${chunksTotal}: ${chunkPath}`);
      
      // Update status before starting transcription (helps with stuck job detection)
      await updateJobProgress(jobId, {
        status: 'transcribing',
        chunks_done: i, // Current chunk being processed (0-indexed)
      });
      
      // Validate chunk file before transcription
      try {
        const chunkStats = await fsPromises.stat(chunkPath);
        if (chunkStats.size === 0) {
          throw new Error(`Chunk ${chunkIndex} file is empty (0 bytes)`);
        }
        if (chunkStats.size < 1000) {
          console.warn(`[process-job] ⚠️ Chunk ${chunkIndex} is very small (${chunkStats.size} bytes), may fail transcription`);
        }
        console.log(`[process-job] Chunk ${chunkIndex} size: ${(chunkStats.size / 1024 / 1024).toFixed(2)} MB`);
      } catch (statError) {
        throw new Error(`Chunk ${chunkIndex} file validation failed: ${statError.message}`);
      }
      
      try {
        const transcription = await transcribeChunk(
          chunkPath,
          job.language,
          job.include_timestamps
        );
        
        // Validate transcription result
        if (!transcription) {
          throw new Error('Transcription returned empty result');
        }
        if (transcription.text && transcription.text.trim().length === 0) {
          console.warn(`[process-job] ⚠️ Chunk ${chunkIndex} transcribed but text is empty`);
        }
        
        chunkResults.push(transcription);
        console.log(`[process-job] ✅ Chunk ${chunkIndex}/${chunksTotal} completed`);
        
        // Update progress immediately after each chunk
        const chunksDone = chunkIndex;
        const progress = Math.round((chunksDone / chunksTotal) * 100);
        await updateJobProgress(jobId, {
          chunks_done: chunksDone,
          progress: progress,
        });
        console.log(`[process-job] 📊 Progress updated: ${chunksDone}/${chunksTotal} (${progress}%)`);
      } catch (error) {
        console.error(`[process-job] ❌ Failed to transcribe chunk ${chunkIndex}/${chunksTotal}:`, error);
        console.error(`[process-job] Error details:`, {
          message: error.message,
          stack: error.stack,
          chunkPath: chunkPath,
          chunkIndex: chunkIndex,
        });
        
        // For the first chunk, provide more detailed error info
        if (chunkIndex === 1) {
          console.error(`[process-job] 🚨 FIRST CHUNK FAILED - This is critical!`);
          console.error(`[process-job] First chunk path: ${chunkPath}`);
          try {
            const firstChunkStats = await fsPromises.stat(chunkPath);
            console.error(`[process-job] First chunk stats:`, {
              size: firstChunkStats.size,
              sizeMB: (firstChunkStats.size / 1024 / 1024).toFixed(2),
              created: firstChunkStats.birthtime,
              modified: firstChunkStats.mtime,
            });
          } catch (statErr) {
            console.error(`[process-job] Could not stat first chunk:`, statErr.message);
          }
        }
        
        // Update job with error status
        await updateJobProgress(jobId, {
          status: 'error',
          error_message: `Chunk ${chunkIndex} transcription failed: ${error.message}`,
        });
        
        // Fail the whole job if any chunk fails
        throw new Error(`Chunk ${chunkIndex} transcription failed: ${error.message}`);
      }
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
    console.error(`[process-job] Error stack:`, error.stack);
    
    // Update job with error (try-catch to ensure we don't fail on update)
    try {
      await updateJobProgress(jobId, {
        status: 'error',
        error_message: error.message || 'Unknown error occurred',
      });
      console.log(`[process-job] ✅ Updated job status to 'error' in Supabase`);
    } catch (updateError) {
      console.error(`[process-job] ⚠️ Failed to update job status in Supabase:`, updateError.message);
    }
    
    throw error;
  } finally {
    // Cleanup temp files
    try {
      await fsPromises.rm(tmpDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error(`[process-job] Cleanup error (non-fatal):`, cleanupError.message);
    }
  }
}

// Configure as background function for longer execution time (up to 15 minutes)
exports.config = {
  background: true,
};

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
    console.log('[process-job] 🚀 Function invoked');
    
    // Check token if configured
    if (!checkToken(event)) {
      console.error('[process-job] ❌ Unauthorized - token check failed');
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
      console.error('[process-job] ❌ Missing jobId');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing jobId parameter" }),
      };
    }

    console.log(`[process-job] ✅ Starting processing for job: ${jobId}`);

    // Process job (this may take a long time for large files)
    // Note: Netlify Functions have timeout limits, but we'll process as much as possible
    // If timeout occurs, job will remain in "processing" state and can be retried
    try {
      await processJob(jobId);
      
      console.log(`[process-job] ✅ Job ${jobId} completed successfully`);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: "Job processing completed",
          jobId: jobId,
        }),
      };
    } catch (processError) {
      // processJob already updates the job status, but log here too
      console.error(`[process-job] ❌ Job ${jobId} processing failed:`, processError.message);
      console.error(`[process-job] Error stack:`, processError.stack);
      
      // Return 200 to acknowledge the function was invoked (job status is updated in DB)
      // This prevents Netlify from retrying the function call
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          message: "Job processing failed",
          jobId: jobId,
          error: processError.message,
        }),
      };
    }
  } catch (error) {
    console.error("[process-job] Handler error:", error.message);
    console.error("[process-job] Error stack:", error.stack);
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
