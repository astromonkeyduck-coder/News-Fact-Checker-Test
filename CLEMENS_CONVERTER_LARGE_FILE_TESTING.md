# Clemens Converter Large File System - Testing Guide

## Prerequisites

1. **Supabase Migration:**
   - Run migration: `supabase/migrations/003_create_transcription_jobs.sql`
   - Or manually execute in Supabase Dashboard → SQL Editor

2. **Environment Variables (Netlify Dashboard):**
   - `OPENAI_API_KEY` - Required
   - `SUPABASE_URL` - Required
   - `SUPABASE_SERVICE_ROLE_KEY` - Required
   - `R2_ACCESS_KEY_ID` - Required for >25MB files
   - `R2_SECRET_ACCESS_KEY` - Required for >25MB files
   - `R2_BUCKET` - Required for >25MB files
   - `R2_ENDPOINT` - Required for >25MB files
   - `CLEMS_TOKEN` - Optional (for access control)

3. **Dependencies:**
   - Run `npm install` to install `ffmpeg-static`

## Test Scenarios

### Test 1: Small File (10MB) - Baseline

**Purpose:** Verify backward compatibility with existing system

**Steps:**
1. Upload a 10MB MP3 file
2. Verify it uses direct transcription (not job-based)
3. Verify transcript appears quickly
4. Verify download buttons work

**Expected:**
- File processes via `/api/transcribe-from-url` (not job system)
- Transcript appears within 30-60 seconds
- No job created in Supabase

### Test 2: Large File (30-80MB) - New System

**Purpose:** Verify job-based workflow for large files

**Steps:**
1. Upload a 30-80MB MP3 file
2. Verify file uploads to R2 successfully
3. Verify job is created in Supabase (`transcription_jobs` table)
4. Verify UI shows "Processing..." status
5. Verify progress updates show "Transcribing chunk X / N"
6. Wait for completion (may take 5-15 minutes depending on file size)
7. Verify transcript appears when done
8. Verify download buttons work

**Expected:**
- File uploads directly to R2 (check network tab - should see R2 domain)
- Job record created with `status = 'queued'`
- Status changes: `queued` → `processing` → `transcribing` → `finalizing` → `done`
- Progress bar updates after each chunk
- Transcript stored in R2 at `transcripts/{jobId}.txt`
- Original audio deleted from R2 after completion

**Check Supabase:**
```sql
SELECT * FROM transcription_jobs ORDER BY created_at DESC LIMIT 1;
```

**Check R2:**
- Should see chunks at: `audio/chunks/{jobId}/chunkNNN.mp3` (optional, may be cleaned up)
- Should see transcript at: `transcripts/{jobId}.txt`
- Original audio should be deleted

### Test 3: Refresh Mid-Job (Resume Capability)

**Purpose:** Verify job persistence and resume on page refresh

**Steps:**
1. Upload a large file (30-80MB)
2. Wait for job to start processing (status = 'processing' or 'transcribing')
3. Note the `jobId` from browser console or Supabase
4. Refresh the page (F5 or Cmd+R)
5. Verify job resumes automatically
6. Verify progress continues from where it left off
7. Wait for completion

**Expected:**
- `jobId` stored in `localStorage` as `clemens-job-{jobId}`
- On page load, `resumeJobs()` function runs
- Job polling resumes automatically
- Progress continues without loss
- Transcript appears when done

**Check localStorage:**
```javascript
// In browser console
Object.keys(localStorage).filter(k => k.startsWith('clemens-job-'))
```

### Test 4: Forced Failure (Invalid jobId)

**Purpose:** Verify error handling

**Steps:**
1. Manually call `/api/job-status?jobId=invalid-uuid`
2. Verify returns 404 with "Job not found"

**Expected:**
- Returns 404 status
- Error message: "Job not found"

### Test 5: Error Handling (Invalid R2 Key)

**Purpose:** Verify job error handling

**Steps:**
1. Manually create a job in Supabase with invalid `r2_key`
2. Trigger `process-job` function manually
3. Verify job status changes to `error`
4. Verify `error_message` is populated

**Expected:**
- Job status = `error`
- Error message stored in `error_message` field
- UI shows error state with retry option

## Debugging

### Check Function Logs

**Netlify Dashboard:**
1. Go to Functions → Logs
2. Filter by function name:
   - `create-job`
   - `job-status`
   - `process-job`

**Look for:**
- `[create-job] ✅ Created job: {jobId}`
- `[process-job] Processing job: {jobId}`
- `[process-job] ✅ Created {N} chunks`
- `[process-job] Transcribing chunk X/Y`
- `[process-job] ✅ Job completed: {jobId}`

### Check Supabase

```sql
-- View all jobs
SELECT job_id, status, progress, chunks_total, chunks_done, filename, error_message, created_at, updated_at
FROM transcription_jobs
ORDER BY created_at DESC;

-- View stuck jobs (processing for >10 minutes)
SELECT job_id, status, progress, filename, created_at, updated_at
FROM transcription_jobs
WHERE status IN ('processing', 'transcribing', 'finalizing')
AND updated_at < NOW() - INTERVAL '10 minutes';
```

### Check R2 Storage

**Cloudflare Dashboard:**
1. Go to R2 → Your Bucket
2. Check for:
   - Original uploads: `clemens-uploads/{timestamp}_{random}_{filename}`
   - Chunks (optional): `audio/chunks/{jobId}/chunkNNN.mp3`
   - Transcripts: `transcripts/{jobId}.txt`

### Common Issues

1. **Job stuck in "queued" status:**
   - Check if `process-job` function was triggered
   - Check function logs for errors
   - Manually trigger: `POST /.netlify/functions/process-job` with `{ "jobId": "..." }`

2. **ffmpeg not found:**
   - Verify `ffmpeg-static` is installed: `npm list ffmpeg-static`
   - Check function logs for "ffmpeg-static not found"
   - May need to use system ffmpeg if `ffmpeg-static` fails

3. **Chunking fails:**
   - Check function logs for ffmpeg errors
   - Verify audio file is valid MP3
   - Check `/tmp` directory permissions (should be writable)

4. **OpenAI API errors:**
   - Check function logs for OpenAI errors
   - Verify `OPENAI_API_KEY` is set correctly
   - Check OpenAI API usage/quota

5. **Progress not updating:**
   - Check Supabase: Is `chunks_done` incrementing?
   - Check browser console for polling errors
   - Verify `job-status` function is working

## Performance Expectations

- **10MB file:** 30-60 seconds (direct transcription)
- **30MB file:** 5-10 minutes (3-4 chunks)
- **50MB file:** 8-15 minutes (5-6 chunks)
- **80MB file:** 12-20 minutes (8-10 chunks)

**Factors:**
- File duration (not just size)
- OpenAI API response time
- Network speed for R2 uploads/downloads
- Netlify function cold starts

## Next Steps After Testing

1. **If all tests pass:**
   - System is ready for production use
   - Monitor Supabase for stuck jobs
   - Set up alerts for jobs stuck >30 minutes

2. **If issues found:**
   - Check function logs
   - Verify environment variables
   - Test individual functions manually
   - Review error messages in Supabase

3. **Optimization opportunities:**
   - Adjust chunk duration (currently 10 minutes)
   - Add retry logic for failed chunks
   - Implement job cleanup (delete old jobs)
   - Add job timeout handling
