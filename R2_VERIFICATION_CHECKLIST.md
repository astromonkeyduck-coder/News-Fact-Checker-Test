# R2 Setup Verification Checklist

## ✅ Step 1: Environment Variables Set
You've added all 4 R2 environment variables in Netlify Dashboard:
- ✅ `R2_ACCESS_KEY_ID`
- ✅ `R2_SECRET_ACCESS_KEY`
- ✅ `R2_BUCKET`
- ✅ `R2_ENDPOINT`

## ⏭️ Step 2: Redeploy Site (REQUIRED)

**Important:** Environment variables only take effect after redeployment!

1. Go to Netlify Dashboard → Your Site
2. Click **"Deploys"** tab
3. Click **"Trigger deploy"** → **"Deploy site"**
4. Wait 1-2 minutes for deployment to complete

**OR** just push a commit to trigger automatic deployment.

## ✅ Step 3: Verify R2 is Working

### Check Function Logs (get-upload-url)

1. Go to Netlify Dashboard → **Functions** → **get-upload-url** → **View Logs**
2. Upload a file in Clemens Converter
3. Look for these logs:

**✅ GOOD (R2 Working):**
```
[get-upload-url] R2_ACCESS_KEY_ID: SET
[get-upload-url] R2_SECRET_ACCESS_KEY: SET
[get-upload-url] R2_BUCKET: clemens-uploads
[get-upload-url] R2_ENDPOINT: https://...
[get-upload-url] ✅ Generated R2 presigned URL for: clemens-uploads/...
[get-upload-url] ✅ Using R2 for upload (no size limits)
```

**❌ BAD (R2 Not Working):**
```
[get-upload-url] R2_ACCESS_KEY_ID: MISSING
[get-upload-url] R2 not configured, using Blobs fallback
[get-upload-url] ⚠️⚠️⚠️ CRITICAL: Large file using Blobs fallback
```

### Check Browser Console

1. Open Clemens Converter page
2. Open Browser DevTools (F12) → **Console** tab
3. Upload a file
4. Look for:

**✅ GOOD (R2 Working):**
```
[uploadFile] Uploading directly to R2: https://[account-id].r2.cloudflarestorage.com/...
[uploadFile] ✅ Successfully uploaded to R2
```

**❌ BAD (R2 Not Working):**
```
[uploadFile] Uploading via Netlify Function (Blobs): /api/upload-blob?token=...
```

### Check Network Tab

1. Open Browser DevTools → **Network** tab
2. Upload a file
3. Look for:

**✅ GOOD (R2 Working):**
- Request to `r2.cloudflarestorage.com` (PUT method)
- Status: 200 or 204
- Request goes directly to R2, not to your Netlify domain

**❌ BAD (R2 Not Working):**
- Request to `noteworthynews.co/api/upload-blob` (POST method)
- Status: 500 (for large files)

## ✅ Step 4: Test with Large File

1. Upload a file >10MB
2. Should work without 500 errors
3. Should see R2 upload in console/network tab
4. Transcription should complete successfully

## Troubleshooting

### If you see "MISSING" in logs:
- **Solution:** Redeploy site (environment variables need deployment to take effect)
- **Solution:** Double-check variable names are exact (case-sensitive)
- **Solution:** Verify variables are set for "All scopes" or "Production"

### If still using Blobs:
- **Solution:** Check `get-upload-url` logs to see which variable is missing
- **Solution:** Verify R2_BUCKET matches your actual bucket name exactly
- **Solution:** Verify R2_ENDPOINT format: `https://[account-id].r2.cloudflarestorage.com`

### If R2 upload fails with 403:
- **Solution:** Check API token permissions in Cloudflare
- **Solution:** Verify Access Key ID and Secret are correct
- **Solution:** Check token hasn't been revoked

### If R2 upload fails with 404:
- **Solution:** Verify bucket name matches exactly
- **Solution:** Check bucket exists in Cloudflare Dashboard

## Success!

Once R2 is working:
- ✅ Large files (>10MB) upload successfully
- ✅ No 500 errors
- ✅ Uploads go directly to R2 (bypasses Netlify)
- ✅ Files appear in R2 bucket temporarily
- ✅ Files auto-deleted after transcription
