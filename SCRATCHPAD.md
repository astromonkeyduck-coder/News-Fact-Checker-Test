# Clemens Converter Implementation Plan

## Architecture Choice: Cloudflare R2 Signed Uploads (Option 1)

**Rationale:**
- Netlify Functions have body size limits (~6MB for free tier, ~52MB for Pro)
- Large MP3 files can exceed these limits
- Direct-to-storage upload avoids function timeouts and size constraints
- R2 is cost-effective and integrates well with serverless

**Alternative if R2 unavailable:** Use Netlify Blobs (already in project dependencies) as temporary storage

## File Structure

### New Files to Create:
1. `/clemensconverter/index.html` - Main page (hidden, noindex)
2. `/assets/js/clemensconverter.js` - Client-side logic (upload, queue, progress, PDF generation)
3. `/assets/css/clemensconverter.css` - Styling (consistent with Noteworthy News branding)
4. `/netlify/functions/get-upload-url.js` - Generate signed upload URLs for R2
5. `/netlify/functions/transcribe-from-url.js` - Download from R2, call OpenAI Whisper, return transcript
6. `/netlify/functions/transcribe-direct.js` - Fallback for small files (<5MB) direct upload

### Files to Modify:
1. `/netlify.toml` - Add redirect for `/api/*` routes, add headers for `/clemensconverter` (X-Robots-Tag)
2. `/sitemap.xml` - **DO NOT ADD** clemensconverter (verify it's not there)

## Data Flow

```
1. User selects MP3 files
   ↓
2. For each file:
   a. Client calls GET /api/get-upload-url?fileName=X&fileSize=Y
   b. Function returns signed R2 upload URL + objectKey
   c. Client uploads MP3 directly to R2 (bypasses Netlify Function limits)
   d. Client calls POST /api/transcribe-from-url with { objectKey, language, includeTimestamps }
   e. Function:
      - Downloads file from R2
      - Calls OpenAI Whisper API
      - Deletes file from R2 (cleanup)
      - Returns transcript JSON
   f. Client displays transcript, enables downloads
```

## Security Implementation

1. **Token Gate (Optional but Recommended):**
   - Check for `X-CLEMS-TOKEN` header or `?token=XXX` query param
   - Compare against `process.env.CLEMS_TOKEN`
   - Return 401 if missing/wrong
   - Apply to all API endpoints

2. **API Key Protection:**
   - All OpenAI calls server-side only
   - Never log API key
   - Use `process.env.OPENAI_API_KEY` in functions

3. **Page Hiding:**
   - `<meta name="robots" content="noindex, nofollow, noarchive" />` in HTML
   - `X-Robots-Tag: noindex, nofollow` header in netlify.toml
   - No links anywhere in site
   - Not in sitemap.xml

## Storage Configuration

**Option A: Cloudflare R2**
- Env vars: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCOUNT_ID`
- Use `@aws-sdk/client-s3` (R2 is S3-compatible)

**Option B: Netlify Blobs (Fallback)**
- Already in dependencies: `@netlify/blobs`
- Simpler setup, but less control over signed URLs
- Use `getStore()` pattern from existing code

**Decision:** Start with R2, fallback to Blobs if R2 setup is blocked.

## Edge Cases & Limits

1. **File Size Limits:**
   - R2: No practical limit (but warn users about very large files)
   - OpenAI Whisper: 25MB max per file
   - UI: Show warning if file > 20MB

2. **Concurrency:**
   - Default: Sequential processing (one at a time)
   - Optional toggle: Max 2 concurrent (to avoid OpenAI rate limits)
   - Queue management: Show status per file

3. **Errors:**
   - Network failures: Retry up to 3 times with exponential backoff
   - OpenAI errors: Show clear message, allow retry
   - R2 upload failures: Show error, allow re-upload
   - Timeout handling: Show "transcription taking longer than expected"

4. **Cleanup:**
   - Delete R2 objects immediately after transcription
   - Set lifecycle policy: Delete objects older than 24 hours (safety net)

## UI/UX Features

1. **File Queue:**
   - Drag & drop zone
   - File list with: name, size, status, progress bar
   - Statuses: Queued → Uploading → Transcribing → Done / Error
   - Remove button for queued items

2. **Transcript Display:**
   - Collapsible preview per file
   - Copy button
   - Download TXT button
   - Download PDF button (formatted with pdf-lib)

3. **Settings Panel (Collapsible):**
   - Language: Auto / English / Spanish / etc (dropdown)
   - Include timestamps: Toggle
   - Concurrency: Sequential / Max 2 concurrent

4. **Progress Indicators:**
   - Upload progress (from R2 upload)
   - Transcription progress (estimated, since OpenAI doesn't provide real-time progress)

## PDF Generation

- Use `pdf-lib` (add to package.json if not present)
- Format:
  - Title: "Transcript: [filename]"
  - Timestamp: Generated at [date/time]
  - Content: Properly wrapped text with margins
  - Page numbers
  - If timestamps enabled: Show segment timestamps

## Testing Checklist

- [ ] Page accessible at /clemensconverter (direct URL only)
- [ ] No links to page in nav/sitemap/homepage
- [ ] noindex meta tag present
- [ ] X-Robots-Tag header set
- [ ] Upload 3 MP3s simultaneously
- [ ] Queue shows all files with progress
- [ ] Transcripts render correctly
- [ ] TXT download works
- [ ] PDF download works (formatted nicely)
- [ ] Copy button works
- [ ] API key never in client code
- [ ] Token gate works (if enabled)
- [ ] Error handling works (test with invalid file, network failure)
- [ ] Large file handling works (test with 10MB+ file)

## Environment Variables Needed

```
OPENAI_API_KEY=sk-...
CLEMS_TOKEN=your-secret-token-here (optional)
R2_ACCESS_KEY_ID=... (if using R2)
R2_SECRET_ACCESS_KEY=... (if using R2)
R2_BUCKET=clemens-uploads (if using R2)
R2_ENDPOINT=https://[account-id].r2.cloudflarestorage.com (if using R2)
R2_ACCOUNT_ID=... (if using R2)
```

## Implementation Order

1. ✅ Create plan (this file)
2. Create CURSOR.md with project guidelines
3. Implement backend functions (get-upload-url, transcribe-from-url)
4. Implement frontend (HTML, JS, CSS)
5. Update netlify.toml (routes, headers)
6. Test locally
7. Document deployment steps
