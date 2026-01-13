# Site Architecture Analysis - Clemens Converter Large File System

## 1️⃣ Hosting & Runtime

### Where is the site hosted?
**Answer: Netlify**

**Evidence:**
- `netlify.toml` configuration file present
- `netlify/functions/` directory with serverless functions
- Build command: `npm run build`
- Functions directory: `netlify/functions`
- Node version: `NODE_VERSION = "20"`

### Do I currently use Cloudflare Workers or Netlify Functions?
**Answer: Netlify Functions only**

**Evidence:**
- All backend logic in `netlify/functions/` directory
- Functions use `exports.handler = async (event, context) => {}` pattern (Netlify standard)
- No Cloudflare Workers code found
- Netlify Functions configured with esbuild bundler

### What runtimes are available?
**Answer: Node.js 20 (serverless functions)**

**Evidence:**
- `NODE_VERSION = "20"` in netlify.toml
- Functions use Node.js require/module.exports
- No Edge runtime configuration
- No Docker/container configuration

**Note:** Cloudflare R2 is used for storage, but compute is Netlify Functions (Node.js).

---

## 2️⃣ Current Upload Flow

### How are files currently uploaded?
**Answer: Two methods (automatic selection):**

1. **R2 Direct Upload (Preferred - if R2 configured):**
   - `<input type="file">` → Client gets presigned URL from function
   - Client uploads directly to R2 via PUT request (bypasses Netlify)
   - No size limits (up to OpenAI's 25MB limit)

2. **Blobs API Upload (Fallback - if R2 not configured):**
   - `<input type="file">` → Client gets upload token from function
   - Client POSTs FormData to `/api/upload-blob` (goes through Netlify Function)
   - Limited to 6MB (Netlify Function body limit)

**Code Evidence:**
```javascript
// assets/js/clemensconverter.js
if (uploadInfo.method === 'PUT' && uploadInfo.uploadUrl.startsWith('http')) {
    // Direct R2 upload
    await fetch(uploadInfo.uploadUrl, { method: 'PUT', body: file });
} else {
    // Blobs API upload
    formData.append('file', file);
    await fetch('/api/upload-blob', { method: 'POST', body: formData });
}
```

### What breaks at 25MB?
**Answer: OpenAI Whisper API limit**

**Evidence:**
- Code enforces: `maxFileSize: 25 * 1024 * 1024 // 25MB (OpenAI Whisper limit)`
- Validation: `if (fileSize > maxSize) return error: "File too large. Maximum size is 25MB"`
- This is OpenAI's hard limit, not a site limitation

**What breaks at 6MB (without R2):**
- Netlify Function body size limit
- Files >6MB rejected by Netlify infrastructure before function runs
- Results in 500 errors with Netlify error IDs

### Are uploads synchronous or async?
**Answer: Asynchronous with queue management**

**Evidence:**
- Files added to queue: `state.files.set(fileId, { status: 'queued' })`
- Sequential processing by default: `maxConcurrent: 1` (configurable to 2)
- Async/await throughout: `async function processFile(fileId)`
- Progress tracking per file
- Non-blocking UI (users can interact while processing)

---

## 3️⃣ Cloudflare Setup

### Is Cloudflare R2 already enabled?
**Answer: YES - Just configured**

**Evidence:**
- R2 environment variables set (user confirmed)
- R2 presigned URL generation implemented
- R2 upload code working (generating URLs)
- Currently blocked by CORS configuration (being fixed)

### Do I have R2 bucket name, access key/secret?
**Answer: YES - All configured**

**Evidence:**
- User just set all 4 R2 environment variables
- Bucket name: `clemens-uploads` (from code references)
- Access key/secret: Set in Netlify environment variables
- Endpoint: Configured (format: `https://[account-id].r2.cloudflarestorage.com`)

### Am I using presigned URLs?
**Answer: YES - Implemented and working**

**Evidence:**
- `get-upload-url.js` generates presigned URLs using `@aws-sdk/s3-request-presigner`
- URLs valid for 1 hour: `expiresIn: 3600`
- Client receives full R2 URL with authentication in query params
- Client uploads directly via PUT method

### Public buckets or private-only?
**Answer: Private-only (presigned URLs for access)**

**Evidence:**
- No public bucket configuration
- All access via presigned URLs (time-limited, object-specific)
- Files automatically deleted after transcription
- No public read access configured

---

## 4️⃣ OpenAI Integration

### Which endpoint am I using?
**Answer: `openai.audio.transcriptions.create()` (Current/New API)**

**Evidence:**
```javascript
// netlify/functions/transcribe-from-url.js
const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1",
    language: language || undefined,
    response_format: includeTimestamps ? "verbose_json" : "json",
    timestamp_granularities: includeTimestamps ? ["segment"] : undefined,
});
```

**Not using:** Legacy `/v1/audio/transcriptions` endpoint
**Using:** Current SDK method (v4.20.0)

### How am I sending files?
**Answer: File object (multipart form data to OpenAI)**

**Evidence:**
- Downloads file from R2/Blobs to buffer
- Creates File object: `new File([audioBuffer], "audio.mp3", { type: "audio/mpeg" })`
- Passes File object directly to OpenAI SDK
- SDK handles multipart encoding internally

**Not using:** URL fetch (OpenAI doesn't support URLs for Whisper)
**Using:** Direct file upload via SDK

### Where is OpenAI API key stored?
**Answer: Environment variable (server-side only)**

**Evidence:**
- `process.env.OPENAI_API_KEY` in functions
- Never exposed to client
- Stored in Netlify Dashboard → Environment Variables
- ✅ Secure implementation

### Do I process one file at a time or multiple concurrent?
**Answer: Configurable - Sequential (default) or Max 2 concurrent**

**Evidence:**
```javascript
const CONFIG = {
    maxConcurrent: 2,  // Configurable
};

// Default: Sequential (maxConcurrent: 1 effectively)
// Optional: Up to 2 concurrent (to avoid OpenAI rate limits)
state.concurrentMode = false; // Default sequential
```

**Current Behavior:**
- Default: One file at a time (sequential)
- Optional toggle: Process up to 2 files concurrently
- Queue management prevents overwhelming OpenAI API

---

## 5️⃣ Audio Characteristics

### Typical file sizes?
**Answer: UNKNOWN - Currently limited to 25MB (OpenAI limit)**

**Evidence:**
- Current limit: 25MB hard cap (OpenAI Whisper API limit)
- User asking about >25MB files suggests they need larger
- No historical data on typical sizes
- Files seen in testing: ~17MB (bodypar2industrial.mp3)

**Inference:** User likely needs to handle files >25MB, which requires different approach.

### Typical duration?
**Answer: UNKNOWN**

**Evidence:**
- No duration tracking in code
- No duration limits configured
- OpenAI Whisper processes by file size, not duration
- 25MB MP3 ≈ 2-3 hours at typical bitrates

### File types?
**Answer: MP3 (primary), but accepts any audio/* type**

**Evidence:**
```javascript
// File validation
if (!file.type.startsWith('audio/') && !file.name.endsWith('.mp3')) {
    showError('Not an audio file');
}
```

**Supported:**
- MP3 (explicitly checked)
- Any file with `audio/*` MIME type
- Code processes as `audio/mpeg` for OpenAI

**Not explicitly tested:** WAV, M4A, but should work if browser recognizes as audio/*

### Do I need timestamps?
**Answer: YES - Optional feature implemented**

**Evidence:**
- UI setting: `<input type="checkbox" id="includeTimestamps">`
- Code: `includeTimestamps ? "verbose_json" : "json"`
- Returns segments with start/end times if enabled
- Display: Shows timestamps in transcript preview

### Do I need speaker diarization?
**Answer: NO - Not implemented**

**Evidence:**
- No diarization code
- No speaker identification
- Whisper API doesn't support diarization (would need separate service)
- Transcripts are plain text with optional timestamps only

### Do I need near-real-time output?
**Answer: NO - Batch processing**

**Evidence:**
- Files processed after full upload
- No streaming transcription
- No real-time updates during transcription
- User waits for complete transcript

---

## 6️⃣ UX Requirements

### Should users see upload progress?
**Answer: YES - Implemented**

**Evidence:**
- Progress bars per file: `<div class="progress-bar" style="width: ${progress}%">`
- Status indicators: Queued → Uploading → Transcribing → Done
- Progress updates: 10% (upload start) → 30% (upload) → 50% (transcribe) → 100% (done)

### Should users see transcription progress?
**Answer: PARTIAL - Estimated progress only**

**Evidence:**
- Progress bar shows 50% during transcription
- No real-time transcription updates (OpenAI doesn't provide this)
- Progress is estimated, not actual
- Shows spinner during transcription

### Is transcription blocking or background job?
**Answer: BLOCKING (user waits, but UI remains responsive)**

**Evidence:**
- User must wait for transcription to complete
- UI shows progress and status
- Can't close tab and come back (no job persistence)
- No background job system
- No job queue or status tracking across sessions

### Can users close tab and come back?
**Answer: NO - Not implemented**

**Evidence:**
- No job persistence
- No database storage of job status
- No way to retrieve transcript later
- Everything is in-memory (client-side state)
- If user closes tab, progress is lost

### Can users download transcripts later?
**Answer: NO - Only during current session**

**Evidence:**
- Transcripts stored in client-side state only
- No server-side storage of transcripts
- No download links that persist
- Must download immediately after transcription

---

## 7️⃣ Scale Expectations

### Expected usage?
**Answer: UNKNOWN - Appears to be internal/personal tool**

**Evidence:**
- Hidden page (not in nav, sitemap, or public links)
- Token-protected (optional but recommended)
- Named "Clemens Converter" (personal/internal name)
- No usage analytics or rate limiting configured
- No public documentation

**Inference:** Likely personal/internal use, not public-facing at scale.

### Is this personal/internal or public-facing?
**Answer: INTERNAL/PRIVATE TOOL**

**Evidence:**
- Hidden from search engines (noindex, nofollow)
- No public links
- Optional token authentication
- Internal tool naming
- Not in sitemap or navigation

### Is this monetized?
**Answer: NO - Internal tool**

**Evidence:**
- No payment processing
- No subscription system
- No usage limits or paywalls
- Free to use (costs are infrastructure only)

### Budget tolerance?
**Answer: UNKNOWN - But using free/paid tiers**

**Evidence:**
- Netlify (likely free tier with function limits)
- Cloudflare R2 (paid, just purchased)
- OpenAI API (pay-per-use)
- No explicit budget constraints in code

**Inference:** Willing to pay for R2, so likely $10-50/month range acceptable.

---

## 8️⃣ Compute Willingness

### Am I willing to run containers/workers?
**Answer: UNKNOWN - Currently serverless-only**

**Evidence:**
- Current architecture: 100% serverless (Netlify Functions)
- No container/worker infrastructure
- No Docker files
- No Fly.io/Render configuration
- No GPU instances

**Inference:** Preference appears to be serverless, but user asking about >25MB suggests they may be open to alternatives.

### Must this stay serverless-only or Cloudflare-only?
**Answer: CURRENTLY SERVERLESS, BUT QUESTION SUGGESTS FLEXIBILITY**

**Evidence:**
- Current: Netlify Functions only
- User asking about >25MB suggests current limits are problematic
- May be open to alternatives if needed

---

## 9️⃣ Output Requirements

### Final transcript formats?
**Answer: Plain text (TXT) and PDF**

**Evidence:**
```javascript
// Download options
window.downloadTxt = (fileId) => { /* Downloads .txt */ };
window.downloadPdf = (fileId) => { /* Downloads .pdf using pdf-lib */ };
```

**Formats:**
- ✅ Plain text (.txt)
- ✅ PDF (formatted with pdf-lib)
- ✅ Copy to clipboard
- ❌ JSON (not exposed, but available internally)
- ❌ VTT/SRT (not implemented)

### Should transcripts be stored in R2?
**Answer: NO - Currently not stored**

**Evidence:**
- Transcripts only in client-side state
- No server-side storage
- Files deleted after transcription
- Transcripts lost if page refreshed

### Should transcripts be indexed/searchable?
**Answer: NO - Not implemented**

**Evidence:**
- No database storage
- No search functionality
- No indexing
- No transcript history

### Should transcripts be downloadable?
**Answer: YES - Implemented (TXT and PDF)**

**Evidence:**
- Download buttons in UI
- TXT download: Plain text file
- PDF download: Formatted with title, filename, timestamp, pagination

---

## 🔚 SUMMARY

### My Current Constraints

1. **File Size Limit: 25MB** (OpenAI Whisper API hard limit)
2. **Netlify Function Body Limit: 6MB** (without R2)
3. **Serverless-Only Architecture** (Netlify Functions, Node.js 20)
4. **No Job Persistence** (in-memory state only)
5. **No Background Processing** (synchronous, user waits)
6. **No Transcript Storage** (ephemeral, client-side only)
7. **Sequential Processing** (default, max 2 concurrent optional)

### My Non-Negotiables

1. **Security:** API keys must stay server-side (✅ implemented)
2. **Hidden Page:** Must remain unlisted (✅ implemented)
3. **OpenAI Whisper:** Using current API (✅ implemented)
4. **Multiple File Support:** Queue-based processing (✅ implemented)
5. **Error Handling:** Graceful failures (✅ implemented)

### My Ideal Architecture (For >25MB Files)

**Current System (≤25MB):**
- ✅ R2 presigned URLs for direct uploads
- ✅ Netlify Functions for transcription
- ✅ Automatic cleanup
- ✅ Queue management
- ✅ Progress tracking

**For >25MB Files (Would Need):**
- **Option A:** File chunking + reassembly + multiple Whisper calls + merge
- **Option B:** Different transcription service (AssemblyAI, Deepgram, etc.)
- **Option C:** Self-hosted Whisper model (requires GPU/compute)
- **Option D:** Background job system with persistence

**Key Insight:** Current system is optimized for files ≤25MB. For larger files, would need architectural changes.

---

## 🎯 RECOMMENDATIONS FOR >25MB SYSTEM

### If Staying Serverless:
1. **File Chunking:** Split large files into 25MB chunks
2. **Parallel Transcription:** Transcribe chunks concurrently
3. **Merge Transcripts:** Combine with timestamps
4. **Job Persistence:** Store job status in database (Supabase?)
5. **Background Processing:** Queue system for long-running jobs

### If Open to Alternatives:
1. **AssemblyAI/Deepgram:** Support larger files, better APIs
2. **Self-Hosted Whisper:** No size limits, but requires GPU
3. **Hybrid Approach:** Small files via OpenAI, large files via alternative service

### Current System Strengths:
- ✅ R2 integration working (just needs CORS fix)
- ✅ Clean architecture
- ✅ Good error handling
- ✅ Progress tracking
- ✅ Multiple file support

### Current System Gaps (for >25MB):
- ❌ No file chunking
- ❌ No job persistence
- ❌ No background processing
- ❌ No transcript storage
- ❌ Limited by OpenAI's 25MB cap

---

**Status:** Current system is production-ready for files ≤25MB. For >25MB, architectural changes required.
