# Cloudflare R2 Setup Guide - Step by Step

## Overview

This guide walks you through setting up Cloudflare R2 storage for the Clemens Converter. Once configured, large MP3 files (>6MB) will upload directly to R2, bypassing Netlify Function size limits.

## Step 1: Create R2 Bucket

1. **Go to Cloudflare Dashboard**
   - Visit: https://dash.cloudflare.com
   - Log in to your account

2. **Navigate to R2**
   - In the left sidebar, click **"R2"** (under "Workers & Pages")
   - If you don't see it, make sure you're on a paid plan (R2 requires a paid Cloudflare plan)

3. **Create Bucket**
   - Click **"Create bucket"** button
   - **Bucket name:** `clemens-uploads` (or any name you prefer)
   - **Location:** Choose closest to your users (e.g., "US East" or "Auto")
   - Click **"Create bucket"**

4. **Note the Bucket Name**
   - You'll need this for the `R2_BUCKET` environment variable
   - Example: `clemens-uploads`

## Step 2: Get Your Account ID

1. **Find Account ID**
   - In Cloudflare Dashboard, look at the **right sidebar**
   - Your **Account ID** is displayed there (long alphanumeric string)
   - **Copy this** - you'll need it for the endpoint URL
   - Example: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

## Step 3: Create R2 API Token

1. **Go to R2 API Tokens**
   - In R2 section, click **"Manage R2 API Tokens"** (top right, or in settings)
   - Or go to: https://dash.cloudflare.com/profile/api-tokens

2. **Create API Token**
   - Click **"Create Token"**
   - Click **"Create Custom Token"**

3. **Configure Token Permissions**
   - **Token Name:** `Clemens Converter Uploads` (or any name)
   - **Permissions:**
     - **Account:** `Cloudflare R2:Edit`
     - **Zone Resources:** 
       - **Include:** `Specific bucket`
       - **Bucket:** Select `clemens-uploads` (or your bucket name)
   - Click **"Continue to summary"**
   - Click **"Create Token"**

4. **Copy Credentials** ⚠️ **IMPORTANT - DO THIS NOW**
   - You'll see:
     - **Access Key ID:** (long string starting with letters/numbers)
     - **Secret Access Key:** (long string - **ONLY SHOWN ONCE**)
   - **Copy both immediately** - you won't be able to see the secret again!
   - Store them securely (password manager, etc.)

## Step 4: Get R2 Endpoint URL

The endpoint URL format is:
```
https://[YOUR_ACCOUNT_ID].r2.cloudflarestorage.com
```

**Example:**
If your Account ID is `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`, your endpoint is:
```
https://a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6.r2.cloudflarestorage.com
```

**To verify:**
- Go to your R2 bucket in Cloudflare Dashboard
- Click on the bucket name
- Look for "S3 API" section - it should show the endpoint URL

## Step 5: Set Environment Variables in Netlify

1. **Go to Netlify Dashboard**
   - Visit: https://app.netlify.com
   - Select your site (noteworthynews.co)

2. **Navigate to Environment Variables**
   - Go to: **Site Settings** → **Environment Variables**
   - Or: **Site** → **Site configuration** → **Environment variables**

3. **Add R2 Variables** (Add each one separately)

   **Variable 1:**
   - **Key:** `R2_ACCESS_KEY_ID`
   - **Value:** (Paste your Access Key ID from Step 3)
   - Click **"Add variable"**

   **Variable 2:**
   - **Key:** `R2_SECRET_ACCESS_KEY`
   - **Value:** (Paste your Secret Access Key from Step 3)
   - Click **"Add variable"**

   **Variable 3:**
   - **Key:** `R2_BUCKET`
   - **Value:** `clemens-uploads` (or your bucket name from Step 1)
   - Click **"Add variable"**

   **Variable 4:**
   - **Key:** `R2_ENDPOINT`
   - **Value:** `https://[YOUR_ACCOUNT_ID].r2.cloudflarestorage.com`
     - Replace `[YOUR_ACCOUNT_ID]` with your actual Account ID from Step 2
   - Click **"Add variable"**

4. **Verify All Variables**
   - You should now have 4 R2 variables:
     - ✅ `R2_ACCESS_KEY_ID`
     - ✅ `R2_SECRET_ACCESS_KEY`
     - ✅ `R2_BUCKET`
     - ✅ `R2_ENDPOINT`

## Step 6: Redeploy Site

1. **Trigger Redeploy**
   - Go to: **Deploys** tab
   - Click **"Trigger deploy"** → **"Deploy site"**
   - Or: Push a commit to trigger automatic deploy

2. **Wait for Deployment**
   - Wait 1-2 minutes for deployment to complete
   - Check that deployment succeeded (green checkmark)

## Step 7: Verify R2 is Working

1. **Check Function Logs**
   - Go to: **Functions** → **get-upload-url** → **View Logs**
   - Upload a file in the Clemens Converter
   - Look for these logs:
     ```
     [get-upload-url] R2_ACCESS_KEY_ID: SET
     [get-upload-url] R2_SECRET_ACCESS_KEY: SET
     [get-upload-url] R2_BUCKET: clemens-uploads
     [get-upload-url] R2_ENDPOINT: https://...
     [get-upload-url] ✅ Generated R2 presigned URL for: ...
     [get-upload-url] ✅ Using R2 for upload (no size limits)
     ```

2. **Check Browser Console**
   - Open browser DevTools → Console
   - Upload a file
   - You should see:
     ```
     [uploadFile] Uploading directly to R2: https://...
     [uploadFile] ✅ Successfully uploaded to R2
     ```

3. **Check Network Tab**
   - Open browser DevTools → Network
   - Upload a file
   - You should see a PUT request to `r2.cloudflarestorage.com` (not to your Netlify domain)

## Step 8: Test with Large File

1. **Upload Large File (>10MB)**
   - Go to `/clemensconverter`
   - Upload a large MP3 file
   - Should work without 500 errors!

2. **Verify in R2 Dashboard**
   - Go back to Cloudflare → R2 → Your bucket
   - You should see files appear temporarily (they're deleted after transcription)

## Troubleshooting

### "R2_ACCESS_KEY_ID: MISSING" in logs
- **Solution:** Check environment variable name is exactly `R2_ACCESS_KEY_ID` (case-sensitive)
- **Solution:** Redeploy site after adding variables

### "R2_BUCKET: MISSING" in logs
- **Solution:** Verify bucket name matches exactly (case-sensitive)
- **Solution:** Check bucket exists in Cloudflare Dashboard

### "R2_ENDPOINT: MISSING" in logs
- **Solution:** Verify endpoint URL format: `https://[account-id].r2.cloudflarestorage.com`
- **Solution:** Make sure Account ID is correct

### Still seeing "Uploading via Netlify Function (Blobs)"
- **Solution:** R2 variables not set or incorrect
- **Solution:** Check function logs to see which variable is missing
- **Solution:** Redeploy after setting variables

### R2 Upload Fails with 403
- **Solution:** Check API token has correct permissions
- **Solution:** Verify Access Key ID and Secret are correct
- **Solution:** Check token hasn't been revoked

### R2 Upload Fails with 404
- **Solution:** Verify bucket name matches `R2_BUCKET` variable
- **Solution:** Check bucket exists in Cloudflare Dashboard

## Quick Reference

**Environment Variables Needed:**
```
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET=clemens-uploads
R2_ENDPOINT=https://[account-id].r2.cloudflarestorage.com
```

**Where to Find:**
- **Access Key ID & Secret:** Cloudflare Dashboard → R2 → Manage R2 API Tokens
- **Account ID:** Cloudflare Dashboard → Right sidebar
- **Bucket Name:** Cloudflare Dashboard → R2 → Your bucket
- **Endpoint:** `https://[account-id].r2.cloudflarestorage.com`

## Success Indicators

✅ **R2 is working if you see:**
- `[get-upload-url] ✅ Generated R2 presigned URL`
- `[uploadFile] Uploading directly to R2`
- `[uploadFile] ✅ Successfully uploaded to R2`
- Large files (>10MB) upload successfully
- No 500 errors for large files

❌ **R2 is NOT working if you see:**
- `[get-upload-url] R2 not configured, using Blobs fallback`
- `[uploadFile] Uploading via Netlify Function (Blobs)`
- 500 errors for files >6MB
- Any R2 variable showing as "MISSING" in logs

## Next Steps

Once R2 is configured:
1. Test with a small file first (<5MB) to verify setup
2. Test with a large file (>10MB) to verify it bypasses function limits
3. Check R2 bucket in Cloudflare Dashboard - files should appear temporarily
4. Files are automatically deleted after transcription completes

---

**Need Help?** Check the function logs in Netlify Dashboard - they'll show exactly which R2 variables are missing or incorrect.
