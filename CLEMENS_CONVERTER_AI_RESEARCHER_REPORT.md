# Clemens Converter - AI Researcher Technical Report

## Executive Summary

This report documents the complete implementation of the Clemens Converter, a hidden MP3 transcription tool for Noteworthy News. The tool allows users to upload multiple MP3 files, transcribe them using OpenAI Whisper, and download transcripts as TXT or PDF files. The implementation encountered several issues during development, which have been addressed with fixes documented herein.

## Project Requirements

### Core Functionality
- Upload multiple MP3 files simultaneously
- Convert each to text via OpenAI Whisper (speech-to-text)
- Download transcripts as .txt and .pdf
- Show progress per file with queue handling
- Handle errors gracefully without crashing

### Security Requirements
- Hidden page: `/clemensconverter` - not in nav, sitemap, RSS, or any internal links
- `noindex, nofollow` meta tag and X-Robots-Tag header
- All OpenAI API calls server-side only (never expose API key)
- Optional token-based access control (`CLEMS_TOKEN`)

### Technical Constraints
- Netlify Functions have body size limits (~6MB free, ~52MB Pro)
- Large MP3 files (up to 25MB) must bypass function limits
- Solution: Direct-to-storage uploads (Netlify Blobs or Cloudflare R2)

## Architecture Overview

### Data Flow
```
1. Client selects MP3 files
   ↓
2. For each file:
   a. GET /api/get-upload-url → Returns upload URL + objectKey
   b. POST /api/upload-blob → Client uploads file directly to storage
   c. POST /api/transcribe-from-url → Function downloads from storage, calls OpenAI Whisper
   d. Function deletes file from storage (cleanup)
   e. Returns transcript JSON to client
   ↓
3. Client displays transcript with download options
```

### File Structure
```
clemensconverter/
  └── index.html                    # Main page (hidden, noindex)

assets/
  ├── css/
  │   └── clemensconverter.css      # Styling
  └── js/
      └── clemensconverter.js       # Client-side logic

netlify/functions/
  ├── get-upload-url.js             # Generates upload URLs
  ├── upload-blob.js                # Handles file uploads to Blobs
  ├── transcribe-from-url.js        # Downloads & transcribes via OpenAI
  └── transcribe-direct.js          # Fallback for small files (<5MB)
```

## Implementation Details

### Frontend (`clemensconverter/index.html`)

**Key Features:**
- Drag & drop file upload zone
- File queue with progress indicators
- Settings panel (collapsible): language, timestamps, concurrency
- Results display with copy/download options
- PDF generation using pdf-lib (CDN)

**HTML Elements (all required IDs):**
- `dropzone` - Drag & drop area
- `fileInput` - Hidden file input
- `selectFilesBtn` - Select files button
- `queueContainer`, `queueList` - File queue display
- `resultsContainer` - Transcript results
- `settingsToggle`, `settingsContent` - Settings panel
- `languageSelect`, `includeTimestamps`, `concurrentMode` - Settings controls

**Meta Tags:**
```html
<meta name="robots" content="noindex, nofollow, noarchive">
```

### Frontend JavaScript (`assets/js/clemensconverter.js`)

**State Management:**
```javascript
const state = {
    files: new Map(),              // fileId -> file data
    processingQueue: [],           // Queue of files to process
    activeProcessing: 0,          // Currently processing count
    concurrentMode: false,         // Sequential (default) or max 2 concurrent
};
```

**Key Functions:**
- `initializeElements()` - Gets all DOM elements by ID
- `setupEventListeners()` - Attaches event handlers (WITH NULL CHECKS)
- `processFile(fileId)` - Main processing pipeline per file
- `getUploadUrl()` - Requests upload URL from backend
- `uploadFile()` - Uploads file to storage
- `transcribeFromUrl()` - Requests transcription
- `downloadTxt()`, `downloadPdf()` - Download handlers

**Critical Fixes Applied:**
1. **Event Listener Null Checks** - All `addEventListener` calls wrapped in null checks:
   ```javascript
   if (elements.languageSelect) {
       elements.languageSelect.addEventListener('change', saveSettings);
   }
   ```
   This prevents "Cannot read properties of null" errors.

2. **Error Handling** - Improved JSON parse error handling:
   ```javascript
   try {
       error = await response.json();
   } catch (e) {
       const text = await response.text();
       throw new Error(`Upload failed: ${response.status} - ${text}`);
   }
   ```

3. **401 Error Messages** - Clear messages when token is missing/invalid:
   ```javascript
   if (response.status === 401) {
       const token = urlParams.get('token');
       if (!token) {
           throw new Error('Authentication required. Please access with ?token=YOUR_TOKEN');
       }
   }
   ```

### Backend Functions

#### 1. `get-upload-url.js` (GET)

**Purpose:** Generate upload URL and object key for file storage

**Flow:**
1. Check token (if `CLEMS_TOKEN` env var set)
2. Validate `fileName` and `fileSize` parameters
3. Check file size (max 25MB - OpenAI limit)
4. Generate unique object key: `uploads/{timestamp}_{random}_{filename}`
5. Create upload token and store in Blobs (expires 1 hour)
6. Return upload URL: `/api/upload-blob?token={uploadToken}`

**Returns:**
```json
{
  "uploadUrl": "/api/upload-blob?token=...",
  "objectKey": "uploads/1234567890_abc123_file.mp3",
  "method": "POST"
}
```

**Error Cases:**
- 401: Missing/invalid `CLEMS_TOKEN`
- 400: Missing `fileName` or `fileSize`
- 400: File too large (>25MB)

#### 2. `upload-blob.js` (POST)

**Purpose:** Receive file upload and store in Netlify Blobs

**Flow:**
1. Get upload token from query: `?token={uploadToken}`
2. Retrieve token data from Blobs store
3. Check token expiration
4. Parse multipart/form-data or raw body
5. Validate file size matches token data
6. Store file in Blobs with metadata
7. Delete upload token (cleanup)
8. Return object key

**Multipart Parsing:**
```javascript
if (contentType.includes('multipart/form-data')) {
    const boundary = contentType.match(/boundary=([^;\s]+)/)[1];
    const bodyBuffer = event.isBase64Encoded 
        ? Buffer.from(event.body, 'base64')
        : Buffer.from(event.body, 'binary');
    const bodyText = bodyBuffer.toString('binary');
    const parts = bodyText.split(`--${boundary}`);
    // Extract file content from part with name="file"
}
```

**Error Cases:**
- 500: Missing `NETLIFY_SITE_ID` or `NETLIFY_BLOB_READ_WRITE_TOKEN`
- 400: Missing upload token
- 401: Invalid/expired upload token
- 400: No file found in form data
- 400: File size mismatch

**Known Issues:**
- 500 errors observed - likely due to:
  - Missing environment variables
  - Blob store "clemens-uploads" not created
  - Multipart parsing edge cases

#### 3. `transcribe-from-url.js` (POST)

**Purpose:** Download file from storage, transcribe via OpenAI Whisper, return transcript

**Flow:**
1. Check token (if `CLEMS_TOKEN` set)
2. Parse request body: `{ objectKey, storageType, language, includeTimestamps }`
3. Download file from Blobs storage
4. Create File object for OpenAI (Node.js 18+ has File API)
5. Call OpenAI Whisper API:
   ```javascript
   await openai.audio.transcriptions.create({
       file: audioFile,
       model: "whisper-1",
       language: language || undefined,
       response_format: includeTimestamps ? "verbose_json" : "json",
       timestamp_granularities: includeTimestamps ? ["segment"] : undefined,
   });
   ```
6. Extract transcript text and segments
7. Delete file from storage (cleanup)
8. Return transcript JSON

**File Object Creation:**
```javascript
if (typeof File !== "undefined") {
    audioFile = new File([audioBuffer], "audio.mp3", { type: "audio/mpeg" });
} else {
    // Fallback for older Node.js
    const { Readable } = require("stream");
    const stream = Readable.from([audioBuffer]);
    audioFile = Object.assign(stream, {
        name: "audio.mp3",
        type: "audio/mpeg",
        size: audioBuffer.length,
        [Symbol.toStringTag]: "File",
    });
}
```

**Returns:**
```json
{
  "fileName": "audio.mp3",
  "transcriptText": "Full transcript text...",
  "segments": [...],  // If includeTimestamps=true
  "modelUsed": "whisper-1",
  "elapsedMs": 1234,
  "language": "en"
}
```

**Error Cases:**
- 401: Missing/invalid token
- 400: Missing `objectKey`
- 404: File not found in storage
- 500: OpenAI API error or file download error

#### 4. `transcribe-direct.js` (POST)

**Purpose:** Fallback for small files (<5MB) - direct upload without storage

**Flow:**
1. Check token
2. Parse JSON body with base64 encoded file: `{ fileData, fileName, language, includeTimestamps }`
3. Decode base64 to buffer
4. Validate size (<5MB)
5. Call OpenAI Whisper (same as transcribe-from-url)
6. Return transcript

**Note:** Currently not used by frontend - frontend always uses storage upload method.

### Configuration (`netlify.toml`)

**API Routes:**
```toml
[[redirects]]
  from = "/api/get-upload-url"
  to = "/.netlify/functions/get-upload-url"
  status = 200

[[redirects]]
  from = "/api/upload-blob"
  to = "/.netlify/functions/upload-blob"
  status = 200

[[redirects]]
  from = "/api/transcribe-from-url"
  to = "/.netlify/functions/transcribe-from-url"
  status = 200
```

**Headers (Hide from Search Engines):**
```toml
[[headers]]
  for = "/clemensconverter/*"
  [headers.values]
    X-Robots-Tag = "noindex, nofollow"
```

## Issues Encountered & Fixes

### Issue 1: JavaScript Error - Line 684
**Error:**
```
Uncaught TypeError: Cannot read properties of null (reading 'addEventListener')
    at clemensconverter.js:684:25
```

**Root Cause:**
Event listeners were being attached at module level (outside DOMContentLoaded), attempting to access DOM elements before they existed.

**Fix:**
Moved all event listeners into `setupEventListeners()` function, called after DOM is ready. Added null checks:
```javascript
// Save settings on change
if (elements.languageSelect) {
    elements.languageSelect.addEventListener('change', saveSettings);
}
if (elements.includeTimestamps) {
    elements.includeTimestamps.addEventListener('change', saveSettings);
}
if (elements.concurrentMode) {
    elements.concurrentMode.addEventListener('change', (e) => {
        // ...
    });
}
```

**Status:** ✅ Fixed

### Issue 2: 401 Unauthorized Errors
**Error:**
```
api/get-upload-url: Failed to load resource: the server responded with a status of 401
Error: Unauthorized: Invalid or missing token
```

**Root Cause:**
`CLEMS_TOKEN` environment variable was set in Netlify, but user was accessing page without token in URL.

**Fix:**
1. Added helpful error messages:
   ```javascript
   if (response.status === 401) {
       const token = urlParams.get('token');
       if (!token) {
           throw new Error('Authentication required. Please access this page with ?token=YOUR_TOKEN in the URL, or remove CLEMS_TOKEN from environment variables if you want open access.');
       }
   }
   ```
2. Token can be passed via:
   - URL query: `?token=YOUR_TOKEN`
   - Header: `X-Clems-Token: YOUR_TOKEN`
   - localStorage: `clems_token` (if implemented)

**Status:** ✅ Fixed (with clear error messages)

### Issue 3: 500 Internal Server Error on upload-blob
**Error:**
```
upload-blob: Failed to load resource: the server responded with a status of 500
SyntaxError: Unexpected token 'I', "Internal E"... is not valid JSON
```

**Root Cause:**
Server returning HTML error page instead of JSON, causing JSON parse to fail. Likely causes:
- Missing environment variables (`NETLIFY_SITE_ID`, `NETLIFY_BLOB_READ_WRITE_TOKEN`)
- Blob store "clemens-uploads" not created
- Multipart form data parsing issues
- Unhandled exceptions in function

**Fixes Applied:**
1. Enhanced error handling:
   ```javascript
   try {
       error = await response.json();
   } catch (e) {
       const text = await response.text();
       throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${text}`);
   }
   ```

2. Improved logging in upload-blob:
   ```javascript
   console.log("[upload-blob] Content-Type:", contentType);
   console.log("[upload-blob] isBase64Encoded:", event.isBase64Encoded);
   console.log("[upload-blob] Body length:", event.body ? event.body.length : 0);
   ```

3. Better multipart parsing with buffer handling:
   ```javascript
   let bodyBuffer;
   if (event.isBase64Encoded && event.body) {
       bodyBuffer = Buffer.from(event.body, 'base64');
   } else if (event.body) {
       if (typeof event.body === 'string') {
           bodyBuffer = Buffer.from(event.body, 'binary');
       } else {
           bodyBuffer = Buffer.from(event.body);
       }
   }
   ```

4. Enhanced error messages in function:
   ```javascript
   catch (error) {
       console.error("[upload-blob] Error:", error);
       console.error("[upload-blob] Stack:", error.stack);
       return {
           statusCode: 500,
           headers,
           body: JSON.stringify({ 
               error: "Failed to upload file",
               message: errorMessage,
               details: process.env.NODE_ENV === "development" ? error.stack : undefined,
           }),
       };
   }
   ```

**Status:** ⚠️ Partially Fixed (error handling improved, root cause needs investigation)

## Current State

### Working Components
✅ Frontend UI - All elements render correctly
✅ File selection and drag & drop
✅ Queue display with progress indicators
✅ Settings panel (language, timestamps, concurrency)
✅ Error display in UI
✅ Token authentication (if CLEMS_TOKEN set)

### Potentially Problematic Areas
⚠️ **upload-blob function** - 500 errors observed
   - Need to verify environment variables are set
   - Need to verify Blob store exists
   - Check function logs for detailed error messages

⚠️ **Multipart form data parsing** - Complex parsing logic
   - May have edge cases with different browsers/clients
   - Buffer handling might need refinement

⚠️ **File API compatibility** - Using Node.js File API
   - Netlify uses Node.js 20 (has File API)
   - Fallback code exists but untested

### Environment Variables Required
- `OPENAI_API_KEY` - Required for transcription
- `NETLIFY_SITE_ID` - Required for Blob storage
- `NETLIFY_BLOB_READ_WRITE_TOKEN` - Required for Blob storage
- `CLEMS_TOKEN` - Optional (for access control)

## Debugging Recommendations

### 1. Check Function Logs
In Netlify Dashboard → Functions → View Logs:
- Look for `[upload-blob]` log entries
- Check for "Blob storage not configured" errors
- Look for multipart parsing errors
- Check stack traces

### 2. Verify Environment Variables
```bash
# In Netlify Dashboard → Environment Variables, verify:
- OPENAI_API_KEY is set
- NETLIFY_SITE_ID is set
- NETLIFY_BLOB_READ_WRITE_TOKEN is set
- CLEMS_TOKEN (if using token auth)
```

### 3. Verify Blob Store
In Netlify Dashboard → Functions → Blobs:
- Store name: `clemens-uploads`
- Should have read/write access
- Token should match `NETLIFY_BLOB_READ_WRITE_TOKEN`

### 4. Test Functions Individually

**Test get-upload-url:**
```bash
curl "https://noteworthynews.co/api/get-upload-url?fileName=test.mp3&fileSize=1000000"
# Add ?token=XXX if CLEMS_TOKEN is set
```

**Test upload-blob:**
```bash
curl -X POST "https://noteworthynews.co/api/upload-blob?token=UPLOAD_TOKEN" \
  -F "file=@test.mp3"
# Note: UPLOAD_TOKEN comes from get-upload-url response
```

**Test transcribe-from-url:**
```bash
curl -X POST "https://noteworthynews.co/api/transcribe-from-url" \
  -H "Content-Type: application/json" \
  -H "X-Clems-Token: YOUR_TOKEN" \
  -d '{"objectKey":"uploads/...","storageType":"blobs"}'
```

### 5. Check Browser Console
- Look for JavaScript errors
- Check network tab for failed requests
- Verify request/response payloads
- Check if FormData is being sent correctly

### 6. Common Issues & Solutions

**Issue: "Blob storage not configured"**
- Solution: Set `NETLIFY_SITE_ID` and `NETLIFY_BLOB_READ_WRITE_TOKEN`

**Issue: "Invalid or expired upload token"**
- Solution: Token expires after 1 hour. Request new upload URL.

**Issue: "No file found in form data"**
- Solution: Check multipart parsing. Verify Content-Type header includes boundary.

**Issue: "File size mismatch"**
- Solution: File size must match token data size (within 10% tolerance).

**Issue: OpenAI transcription fails**
- Solution: Check `OPENAI_API_KEY` is valid and has credits.

## Testing Checklist

- [ ] Page loads without JavaScript errors
- [ ] File selection works (click and drag & drop)
- [ ] Multiple files can be selected
- [ ] Queue displays all files with correct status
- [ ] Progress bars update during processing
- [ ] Upload succeeds (check function logs)
- [ ] Transcription completes successfully
- [ ] Transcript displays correctly
- [ ] Copy button works
- [ ] Download TXT works
- [ ] Download PDF works (formatted correctly)
- [ ] Error handling works (test with invalid file)
- [ ] Token authentication works (if CLEMS_TOKEN set)
- [ ] Large files (>10MB) work correctly
- [ ] Concurrent processing works (if enabled)

## Known Limitations

1. **File Size:** Maximum 25MB per file (OpenAI Whisper limit)
2. **Storage:** Uses Netlify Blobs (free tier: 100GB storage, 100GB bandwidth)
3. **Concurrency:** Default sequential, optional max 2 concurrent
4. **Token Expiration:** Upload tokens expire after 1 hour
5. **R2 Support:** Code structure exists but not implemented (uses Blobs)

## Next Steps for Debugging

1. **Check Function Logs First** - Most detailed error information will be there
2. **Verify Environment Variables** - Ensure all required vars are set
3. **Test Functions Individually** - Use curl commands above
4. **Check Blob Store** - Verify it exists and has correct permissions
5. **Test with Small File First** - Rule out size-related issues
6. **Check OpenAI API** - Verify API key works and has credits

## Code Locations

- Frontend HTML: `clemensconverter/index.html`
- Frontend JS: `assets/js/clemensconverter.js`
- Frontend CSS: `assets/css/clemensconverter.css`
- Backend Functions: `netlify/functions/*.js`
- Configuration: `netlify.toml`
- Documentation: `CLEMENS_CONVERTER_DEPLOYMENT.md`

## Contact & Support

For questions or issues, refer to:
- Deployment Guide: `CLEMENS_CONVERTER_DEPLOYMENT.md`
- Pre-Deploy Checklist: `CLEMENS_CONVERTER_PRE_DEPLOY_CHECKLIST.md`
- Implementation Plan: `SCRATCHPAD.md`

---

**Report Generated:** January 12, 2026
**Status:** Implementation Complete, Debugging In Progress
**Primary Issue:** 500 errors on upload-blob function (likely environment/config related)
