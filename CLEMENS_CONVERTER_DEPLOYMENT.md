# Clemens Converter - Deployment Guide

## Overview

Clemens Converter is a hidden transcription tool for Noteworthy News that converts MP3 audio files to text using OpenAI Whisper. The tool is accessible only via direct URL and is not indexed by search engines.

## Environment Variables

Configure the following environment variables in Netlify Dashboard → Site Settings → Environment Variables:

### Required

- **`OPENAI_API_KEY`**: Your OpenAI API key (starts with `sk-`)
  - Get from: https://platform.openai.com/api-keys

### Optional (Recommended for Security)

- **`CLEMS_TOKEN`**: Shared secret token for access control
  - If set, all API requests must include this token in `X-Clems-Token` header or `?token=XXX` query param
  - Generate a strong random string (e.g., `openssl rand -hex 32`)

### Required for Netlify Blobs (Default Storage)

- **`NETLIFY_SITE_ID`**: Your Netlify site ID
  - Found in: Site Settings → General → Site information
- **`NETLIFY_BLOB_READ_WRITE_TOKEN`**: Blob storage token
  - Generate in: Site Settings → Functions → Blobs → Create store
  - Store name: `clemens-uploads`

### Optional (For Cloudflare R2 - Advanced)

If you want to use Cloudflare R2 instead of Netlify Blobs for better large file handling:

- **`R2_ACCESS_KEY_ID`**: R2 access key ID
- **`R2_SECRET_ACCESS_KEY`**: R2 secret access key
- **`R2_BUCKET`**: R2 bucket name (e.g., `clemens-uploads`)
- **`R2_ENDPOINT`**: R2 endpoint URL (e.g., `https://[account-id].r2.cloudflarestorage.com`)
- **`R2_ACCOUNT_ID`**: Your Cloudflare account ID

**Note:** R2 support requires adding `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` to `package.json` and implementing the R2 functions in the code. Currently, the code uses Netlify Blobs as the default.

## Deployment Steps

1. **Set Environment Variables**
   - Go to Netlify Dashboard → Site Settings → Environment Variables
   - Add all required variables listed above

2. **Deploy the Code**
   - Push to your main branch (or trigger deployment)
   - Netlify will automatically build and deploy

3. **Verify Functions Are Deployed**
   - Go to Netlify Dashboard → Functions
   - Verify these functions exist:
     - `get-upload-url`
     - `upload-blob`
     - `transcribe-from-url`
     - `transcribe-direct`

4. **Test the Page**
   - Visit: `https://noteworthynews.co/clemensconverter`
   - If `CLEMS_TOKEN` is set, append `?token=YOUR_TOKEN`

## Access Control

### Without Token (Default)
- Page is accessible to anyone with the URL
- API endpoints are open (but OpenAI API key is still protected server-side)

### With Token (Recommended)
1. Set `CLEMS_TOKEN` environment variable
2. Access page with: `https://noteworthynews.co/clemensconverter?token=YOUR_TOKEN`
3. The token is automatically included in API requests via JavaScript

## File Size Limits

- **Maximum file size**: 25MB (OpenAI Whisper limit)
- **Recommended**: Files under 20MB for best performance
- **Large files**: Use the storage upload method (automatic for files >5MB)

## Usage

1. **Upload Files**
   - Drag and drop MP3 files onto the dropzone, or click "Select Files"
   - Multiple files can be uploaded at once

2. **Monitor Progress**
   - Each file shows status: Queued → Uploading → Transcribing → Done
   - Progress bars indicate current step

3. **Download Transcripts**
   - When transcription completes, click:
     - **Copy**: Copy transcript to clipboard
     - **Download TXT**: Download as plain text file
     - **Download PDF**: Download as formatted PDF

4. **Settings**
   - Click "Advanced Settings" to configure:
     - Language (auto-detect or specific language)
     - Include timestamps (if supported)
     - Concurrent processing (process up to 2 files at once)

## Testing Checklist

After deployment, verify:

- [ ] Page accessible at `/clemensconverter` (direct URL only)
- [ ] No links to page in navigation, sitemap, or homepage
- [ ] `noindex` meta tag present in HTML source
- [ ] `X-Robots-Tag: noindex, nofollow` header set (check in browser DevTools → Network)
- [ ] Upload 3 MP3 files simultaneously
- [ ] Queue shows all files with progress indicators
- [ ] Transcripts render correctly for each file
- [ ] TXT download works
- [ ] PDF download works (formatted nicely)
- [ ] Copy button works
- [ ] API key never appears in client code (check browser DevTools → Sources)
- [ ] Token gate works (if `CLEMS_TOKEN` is set, requests without token should fail)
- [ ] Error handling works (test with invalid file, network failure)
- [ ] Large file handling works (test with 10MB+ file)

## Troubleshooting

### "Failed to get upload URL"
- Check `NETLIFY_SITE_ID` and `NETLIFY_BLOB_READ_WRITE_TOKEN` are set
- Verify Blobs store `clemens-uploads` exists in Netlify Dashboard

### "Transcription failed"
- Check `OPENAI_API_KEY` is set and valid
- Verify OpenAI account has credits/quota
- Check function logs in Netlify Dashboard → Functions → View Logs

### "Unauthorized: Invalid or missing token"
- If `CLEMS_TOKEN` is set, ensure you're accessing with `?token=YOUR_TOKEN`
- Check token matches exactly (case-sensitive)

### Files not uploading
- Check file size (max 25MB)
- Verify file is MP3 format
- Check browser console for errors
- Verify network connectivity

## Security Notes

- ✅ API keys are never exposed to client-side code
- ✅ All OpenAI requests happen server-side
- ✅ Token authentication protects endpoints (if enabled)
- ✅ Page is hidden from search engines
- ✅ No links to page in public site

## Cost Considerations

- **OpenAI Whisper**: ~$0.006 per minute of audio
- **Netlify Blobs**: Free tier includes 100GB storage, 100GB bandwidth
- **Netlify Functions**: Free tier includes 125k requests/month, 100 hours compute

For heavy usage, monitor costs in:
- OpenAI Dashboard: https://platform.openai.com/usage
- Netlify Dashboard: Site Settings → Usage

## Support

For issues or questions, contact: richard@noteworthynews.co
