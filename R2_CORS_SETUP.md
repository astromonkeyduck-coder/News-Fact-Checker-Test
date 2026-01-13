# R2 CORS Configuration - Fix CORS Error

## Problem

You're seeing this error:
```
Access to fetch at 'https://clemens-uploads...r2.cloudflarestorage.com/...' 
from origin 'https://noteworthynews.co' has been blocked by CORS policy
```

This happens because R2 buckets need CORS (Cross-Origin Resource Sharing) rules to allow browser uploads.

## Solution: Configure CORS in Cloudflare R2

### Step 1: Go to Your R2 Bucket

1. **Cloudflare Dashboard** → **R2**
2. Click on your bucket: **`clemens-uploads`** (or whatever you named it)

### Step 2: Open CORS Settings

1. In the bucket page, look for **"Settings"** tab
2. Scroll down to **"CORS Policy"** section
3. Click **"Edit CORS Policy"** or **"Add CORS Policy"**

### Step 3: Add CORS Configuration

**Option A: Using Cloudflare Dashboard UI**

If there's a UI form, use these values:
- **Allowed Origins:** `https://noteworthynews.co`
- **Allowed Methods:** `PUT`, `GET`, `HEAD`, `OPTIONS`
- **Allowed Headers:** `*` (or specific: `Content-Type`, `x-amz-*`)
- **Exposed Headers:** `ETag`
- **Max Age:** `3600`

**Option B: Using JSON Configuration**

If you need to paste JSON, use this:

```json
[
  {
    "AllowedOrigins": [
      "https://noteworthynews.co"
    ],
    "AllowedMethods": [
      "PUT",
      "GET",
      "HEAD",
      "OPTIONS"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposedHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

### Step 4: Save Configuration

1. Click **"Save"** or **"Update CORS Policy"**
2. Wait a few seconds for changes to propagate

### Step 5: Test Again

1. Go back to `/clemensconverter`
2. Upload a file
3. CORS error should be gone!

## Alternative: Allow All Origins (Less Secure, But Works)

If you want to allow uploads from any origin (for testing or if you have multiple domains):

```json
[
  {
    "AllowedOrigins": [
      "*"
    ],
    "AllowedMethods": [
      "PUT",
      "GET",
      "HEAD",
      "OPTIONS"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposedHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

⚠️ **Note:** Allowing `*` is less secure. Use specific origins in production.

## Verification

After setting CORS, you should see:
- ✅ No CORS errors in browser console
- ✅ PUT request to R2 succeeds (200/204 status)
- ✅ File uploads successfully
- ✅ Transcription proceeds normally

## Troubleshooting

### Still Getting CORS Error?
- **Wait 30-60 seconds** - CORS changes can take a moment to propagate
- **Hard refresh browser** - Clear cache (Cmd+Shift+R / Ctrl+Shift+R)
- **Check origin matches exactly** - Must be `https://noteworthynews.co` (not `http://` or with `www`)
- **Verify CORS saved** - Go back to bucket settings and confirm CORS is there

### CORS UI Not Available?
Some Cloudflare accounts may need to use the API or CLI. If the UI doesn't show CORS settings:
1. Check Cloudflare documentation for R2 CORS API
2. Or contact Cloudflare support

### Multiple Domains?
If you need to allow multiple origins, add them to the array:
```json
"AllowedOrigins": [
  "https://noteworthynews.co",
  "https://www.noteworthynews.co",
  "http://localhost:8888"  // For local testing
]
```

---

**Once CORS is configured, your R2 uploads will work perfectly!** 🎉
