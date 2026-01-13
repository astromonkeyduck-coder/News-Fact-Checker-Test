# R2 CORS Fix - URGENT

## Current Error
```
Access to fetch at 'https://clemens-uploads...r2.cloudflarestorage.com/...' 
from origin 'https://noteworthynews.co' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Quick Fix Steps

### 1. Go to Cloudflare Dashboard
- Visit: https://dash.cloudflare.com
- Navigate to: **R2** → **clemens-uploads** bucket

### 2. Open CORS Settings
- Click on your bucket: **clemens-uploads**
- Go to **Settings** tab
- Scroll to **"CORS Policy"** section
- Click **"Edit"** or **"Add CORS Policy"**

### 3. Paste This Exact JSON Configuration

```json
[
  {
    "AllowedOrigins": [
      "https://noteworthynews.co"
    ],
    "AllowedMethods": [
      "PUT",
      "GET",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

**Notes:**
- `OPTIONS` is NOT needed - Cloudflare R2 handles preflight automatically
- The field is `ExposeHeaders` (not `ExposedHeaders`)
- Simplified to only essential methods and headers

### 4. Save and Wait
- Click **"Save"** or **"Update"**
- **Wait 30-60 seconds** for changes to propagate

### 5. Test
- Go back to `/clemensconverter`
- Try uploading a file again
- CORS error should be gone!

## If CORS Settings Not Visible in UI

Some Cloudflare accounts may need to use the API. Here's how:

### Option A: Use Cloudflare API

```bash
# Set your Cloudflare API token and account ID
export CF_API_TOKEN="your-api-token"
export CF_ACCOUNT_ID="your-account-id"
export BUCKET_NAME="clemens-uploads"

# Set CORS policy via API
curl -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets/${BUCKET_NAME}/cors" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "cors_rules": [
      {
        "allowed_origins": ["https://noteworthynews.co"],
        "allowed_methods": ["PUT", "GET", "HEAD"],
    "allowed_headers": ["*"],
    "expose_headers": ["ETag"],
    "max_age_seconds": 3600
      }
    ]
  }'
```

### Option B: Use Wrangler CLI

```bash
# Install wrangler if not already installed
npm install -g wrangler

# Authenticate
wrangler login

# Set CORS policy
wrangler r2 bucket cors put clemens-uploads --file cors-config.json
```

Where `cors-config.json` contains:
```json
[
  {
    "AllowedOrigins": ["https://noteworthynews.co"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "x-amz-request-id"],
    "MaxAgeSeconds": 3600
  }
]
```

## For Local Development (Optional)

If you also want to test locally, add `http://localhost:8888` to allowed origins:

```json
[
  {
    "AllowedOrigins": [
      "https://noteworthynews.co",
      "http://localhost:8888"
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
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

## Verification

After setting CORS, check:

1. **Browser Console:** No CORS errors
2. **Network Tab:** PUT request returns 200/204 (not CORS error)
3. **Upload:** File uploads successfully
4. **Processing:** Transcription proceeds normally

## Still Not Working?

1. **Hard refresh browser:** Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. **Clear browser cache:** Settings → Clear browsing data
3. **Check origin exactly matches:** Must be `https://noteworthynews.co` (not `http://` or `www.`)
4. **Wait longer:** CORS changes can take up to 2 minutes to propagate
5. **Verify in Cloudflare:** Go back to bucket settings and confirm CORS policy is saved

## Important Notes

- **OPTIONS is handled automatically** - Cloudflare R2 handles preflight requests, so OPTIONS doesn't need to be in AllowedMethods
- **AllowedHeaders: "*"** - Needed because presigned URLs include many `x-amz-*` headers
- **MaxAgeSeconds: 3600** - Caches preflight responses for 1 hour (reduces requests)

---

**Once CORS is configured correctly, uploads will work!** ✅
