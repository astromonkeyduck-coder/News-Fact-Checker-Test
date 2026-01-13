# Clemens Converter >25MB Implementation Plan

## Phase 1: Current System Summary

### Current Upload + Transcription Path

1. **Upload Flow:**
   - Client calls `/api/get-upload-url` with `fileName` and `fileSize`
   - Function validates file size: **HARD BLOCK at 25MB** (line 192-202 in `get-upload-url.js`)
   - If R2 configured: Returns presigned PUT URL for direct R2 upload
   - If R2 not configured: Returns token-based POST URL for Blobs upload
   - Client uploads directly to R2 (bypasses Netlify) or via Blobs API

2. **Transcription Flow:**
   - Client calls `/api/transcribe-from-url` with `objectKey`, `storageType`, `language`, `includeTimestamps`
   - Function downloads file from R2/Blobs
   - Function calls `openai.audio.transcriptions.create()` with full file
   - **LIMITATION: OpenAI Whisper API has 25MB hard limit per request**
   - Returns transcript text/segments
   - Cleans up storage

### Where 25MB Limit is Enforced

1. **Frontend:** `assets/js/clemensconverter.js` line 8: `maxFileSize: 25 * 1024 * 1024`
2. **Backend:** `netlify/functions/get-upload-url.js` line 192-202: Validates and rejects >25MB
3. **OpenAI API:** Hard limit - cannot send >25MB in single request

---

## Phase 2: Selected Architecture

### Architecture Choice: **Supabase-Persisted Background Job System**

**Why this architecture:**
- ✅ **Minimal moving parts:** Uses existing Supabase (already configured)
- ✅ **Netlify-first:** All compute stays in Netlify Functions
- ✅ **Persistent state:** User can refresh and resume (stored in Supabase)
- ✅ **Background processing:** Long-running ffmpeg + multi-call transcription
- ✅ **No new infrastructure:** Reuses R2, Supabase, Netlify Functions

### Data Flow (New System)

1. **Upload (unchanged):**
   - Client uploads file to R2 (direct PUT, no size limit)
   - File stored at: `clemens-uploads/{timestamp}_{random}_{filename}`

2. **Job Creation:**
   - Client calls `/api/create-job` with `r2Key`, `filename`, `language`, `includeTimestamps`
   - Function creates job record in Supabase `transcription_jobs` table
   - Function triggers `process-job` asynchronously (HTTP call, fire-and-forget)
   - Returns `jobId` to client

3. **Background Processing:**
   - `process-job` function runs (can exceed 10s timeout)
   - Downloads audio from R2 to `/tmp/input.mp3`
   - Runs ffmpeg: normalize (mono, 16kHz) → `/tmp/normalized.mp3`
   - Runs ffmpeg: segment into chunks (8-10 min each, 1-2s overlap) → `/tmp/chunks/chunk000.mp3`, etc.
   - For each chunk:
     - Upload chunk to OpenAI Whisper
     - Store segment results
     - Update job progress in Supabase (`chunksDone/chunksTotal`, `progress`)
   - Merge transcripts (offset timestamps, de-duplicate overlaps)
   - Store final transcript to R2: `transcripts/{jobId}.txt` and `transcripts/{jobId}.json`
   - Update job: `status = 'done'`, `progress = 100`, `transcriptKey`
   - Cleanup: Delete original audio from R2

4. **Status Polling:**
   - Client polls `/api/job-status?jobId=XXX` every 1-2 seconds
   - Function reads job from Supabase
   - Returns: `status`, `progress`, `chunksDone/chunksTotal`, `error`, `transcriptKey` (if done)
   - Client updates UI: "Processing...", "Transcribing chunk X / N", progress bar

5. **Resume on Refresh:**
   - Client stores `jobId` in `localStorage`
   - On page load, checks for stored `jobId`
   - If found, resumes polling automatically

---

## Phase 3: Precise Work Plan

### File List and Responsibilities

#### 1. Database Schema (Supabase Migration)
**File:** `supabase/migrations/003_create_transcription_jobs.sql`
**Responsibilities:**
- Create `transcription_jobs` table
- Fields: `job_id` (UUID, PK), `status`, `progress`, `chunks_total`, `chunks_done`, `r2_key`, `filename`, `transcript_key`, `transcript_json_key`, `language`, `include_timestamps`, `error_message`, `created_at`, `updated_at`

#### 2. Backend Function: `create-job.js`
**File:** `netlify/functions/create-job.js`
**Responsibilities:**
- Validate input (`r2Key`, `filename`, `language`, `includeTimestamps`)
- Create job record in Supabase: `status = 'queued'`, `progress = 0`
- Trigger `process-job` asynchronously (HTTP POST to `/.netlify/functions/process-job`, fire-and-forget)
- Return `{ jobId }`
- Token authentication (reuse `checkToken` pattern)

#### 3. Backend Function: `job-status.js`
**File:** `netlify/functions/job-status.js`
**Responsibilities:**
- Read job from Supabase by `jobId`
- If `status = 'done'`, generate presigned GET URL for transcript from R2
- Return job record + transcript URL (if done)
- Token authentication

#### 4. Backend Function: `process-job.js` (Background/Long-Running)
**File:** `netlify/functions/process-job.js`
**Responsibilities:**
- Load job from Supabase, set `status = 'processing'`
- Download audio from R2 to `/tmp/input.mp3`
- Run ffmpeg normalization: `ffmpeg -i input.mp3 -ac 1 -ar 16000 -b:a 48k normalized.mp3`
- Run ffmpeg segmentation: `ffmpeg -i normalized.mp3 -f segment -segment_time 600 -segment_format mp3 -reset_timestamps 1 chunks/chunk%03d.mp3` (10 min chunks)
- Calculate `chunksTotal` from segment count
- For each chunk:
  - Read chunk file
  - Call `openai.audio.transcriptions.create()` with chunk
  - Store segment result
  - Update Supabase: `chunksDone++`, `progress = (chunksDone / chunksTotal) * 100`
- Merge transcripts:
  - If timestamps: Offset by chunk start time, de-duplicate overlaps
  - If no timestamps: Concatenate with newlines
- Store merged transcript to R2: `transcripts/{jobId}.txt` and `transcripts/{jobId}.json`
- Update job: `status = 'done'`, `progress = 100`, `transcriptKey`, `transcriptJsonKey`
- Cleanup: Delete original audio from R2, delete `/tmp` files
- Error handling: Retry chunks up to 2 times, mark job `error` on failure

#### 5. Update: `get-upload-url.js`
**File:** `netlify/functions/get-upload-url.js`
**Changes:**
- Remove 25MB hard block for R2 path (line 192-202)
- Keep 25MB block for Blobs path (fallback)
- Allow >25MB if `storageType === 'r2'`

#### 6. Update: Frontend `clemensconverter.js`
**File:** `assets/js/clemensconverter.js`
**Changes:**
- Remove hard `maxFileSize: 25MB` check for R2 uploads
- After R2 upload completes, call `/api/create-job` instead of `/api/transcribe-from-url`
- Add job polling: `pollJobStatus(jobId)` every 1-2 seconds
- Update UI: Show "Processing...", "Transcribing chunk X / N", progress bar
- Store `jobId` in `localStorage` on job creation
- On page load, check `localStorage` for `jobId`, resume polling if found
- When `status = 'done'`, fetch transcript from R2 presigned URL or job-status response
- Enable download buttons (TXT/PDF) using transcript

#### 7. Configuration: `netlify.toml`
**File:** `netlify.toml`
**Changes:**
- Add redirects for `/api/create-job` and `/api/job-status`
- Configure `process-job` as background function (if needed, or just allow long timeout)

#### 8. Dependencies: `package.json`
**File:** `package.json`
**Changes:**
- Add `ffmpeg-static` or `@ffmpeg-installer/ffmpeg` for Node.js ffmpeg binary
- Add `child_process` usage (built-in, no install needed)

---

## Implementation Details

### ffmpeg Commands

**Normalization:**
```bash
ffmpeg -i /tmp/input.mp3 -ac 1 -ar 16000 -b:a 48k -y /tmp/normalized.mp3
```
- `-ac 1`: Mono (reduce size)
- `-ar 16000`: 16kHz sample rate (reduce size)
- `-b:a 48k`: 48kbps bitrate (reduce size)
- `-y`: Overwrite output

**Segmentation:**
```bash
ffmpeg -i /tmp/normalized.mp3 -f segment -segment_time 600 -segment_format mp3 -reset_timestamps 1 -c copy /tmp/chunks/chunk%03d.mp3
```
- `-segment_time 600`: 10 minutes per chunk (600 seconds)
- `-reset_timestamps 1`: Reset timestamps in each chunk
- `-c copy`: Copy codec (faster, but may not respect exact time boundaries)
- Alternative (more precise): `-c:a libmp3lame -b:a 48k` (re-encode for exact boundaries)

**Overlap (to prevent mid-word cuts):**
- Use `-ss` and `-t` flags to create overlapping segments manually
- Or use `-segment_time` with overlap calculation in code

### Chunking Strategy

- **Target:** 18-20MB per chunk (comfortable under 25MB limit)
- **Method:** Time-based (8-10 minutes per chunk)
- **Overlap:** 1-2 seconds between adjacent chunks
- **Merge:** De-duplicate overlapping text when merging

### Error Handling

- **Chunk failures:** Retry up to 2 times with exponential backoff
- **Job failures:** Mark `status = 'error'`, store `error_message`
- **Cleanup:** Always delete `/tmp` files, delete original audio from R2 on success

### Progress Calculation

```javascript
progress = Math.round((chunksDone / chunksTotal) * 100);
```

Update after each chunk completes.

---

## Testing Checklist

1. **10MB file (baseline):**
   - Should work with existing system (no job system needed)
   - Verify backward compatibility

2. **30-80MB file (new system):**
   - Upload to R2 succeeds
   - Job created in Supabase
   - Processing starts
   - Chunks created correctly
   - Each chunk transcribed
   - Progress updates visible
   - Transcript merged correctly
   - Download works

3. **Refresh mid-job:**
   - Create job, note `jobId`
   - Refresh page
   - Should resume polling automatically
   - Should show current progress

4. **Forced failure:**
   - Invalid `jobId` → Returns 404
   - Invalid R2 key → Job marked error
   - OpenAI API failure → Chunk retried, then job error

---

## Next Steps

1. Create Supabase migration
2. Implement `create-job.js`
3. Implement `job-status.js`
4. Implement `process-job.js` (most complex)
5. Update `get-upload-url.js`
6. Update frontend `clemensconverter.js`
7. Update `netlify.toml`
8. Add `ffmpeg-static` dependency
9. Test end-to-end
