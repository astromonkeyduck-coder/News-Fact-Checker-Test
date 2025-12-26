# Deployment Fixes for Build Errors

## ⚠️ CRITICAL: REQUIRED ACTION BEFORE DEPLOYMENT

**YOU MUST REMOVE `WRITTING_STYLE` FROM NETLIFY ENVIRONMENT VARIABLES**

Even though the code now uses Blobs storage, if `WRITTING_STYLE` is still set as an environment variable in Netlify, it will be passed to ALL functions and cause the 4KB limit error.

### 🔒 Security Note

**Your writing style remains SECRET and SECURE in Blobs storage:**
- ✅ Netlify Blobs is private - only your functions can access it
- ✅ Encrypted at rest and in transit
- ✅ Access controlled via `NETLIFY_BLOB_READ_WRITE_TOKEN`
- ✅ Not exposed to the public internet
- ❌ Environment variables have a 4KB limit (this is why we move it)

### Steps to Fix:

1. **Go to Netlify Dashboard → Your Site → Site Settings → Environment Variables**
2. **Find and DELETE the `WRITTING_STYLE` variable**
3. **Run the migration script** (see below) to move the data to Blobs
4. **Redeploy**

---

## Issues Fixed

### 1. Environment Variables Exceed 4KB Limit

**Problem:** AWS Lambda has a 4KB limit for environment variables. The `WRITTING_STYLE` variable was too large, causing all functions to fail deployment.

**Solution:** Moved `WRITTING_STYLE` from environment variables to Netlify Blobs storage.

**Changes:**
- Created `netlify/functions/lib/get-writing-style.js` - Helper function to fetch writing style from Blobs
- Updated `netlify/functions/generate-newsletter-html.js` - Now uses Blobs instead of env var
- Updated `netlify/functions/noteworthy-chat.js` - Now uses Blobs instead of env var
- Created `netlify/functions/migrate-writing-style.js` - Migration script to move existing data

**REQUIRED Migration Steps:**
1. **FIRST: Remove `WRITTING_STYLE` from Netlify Dashboard environment variables** (this is CRITICAL - deployment will fail if you skip this)
2. **THEN: Run the migration script** to move your writing style to Blobs:
   ```bash
   # Get these from Netlify Dashboard → Site Settings → Environment Variables
   NETLIFY_SITE_ID=your-site-id NETLIFY_BLOB_READ_WRITE_TOKEN=your-token WRITTING_STYLE="your-writing-style-content" node netlify/functions/migrate-writing-style.js
   ```
   Or if you have a `.env` file with these values:
   ```bash
   node netlify/functions/migrate-writing-style.js
   ```
3. **Verify migration worked** - Check that the script reports success
4. **Redeploy** - The deployment should now succeed

**Note:** The helper function falls back to the environment variable if Blobs is unavailable, but for deployment to work, the env var MUST be removed from Netlify's settings (you can keep it in local `.env` for development).

### 2. .node File Bundling Error

**Problem:** esbuild cannot bundle native `.node` files from `@resvg/resvg-js`, causing build failures for `generate-earthquake-image` and `test-generate` functions.

**Solution:** Marked resvg packages as external so they're not bundled. Native modules are loaded at runtime.

**Changes:**
- Updated `netlify.toml` to exclude resvg packages from bundling for affected functions
- Functions now use the native modules directly from `node_modules` at runtime

**Configuration:**
```toml
[functions."generate-earthquake-image"]
  external = ["@resvg/resvg-js", "@resvg/resvg-js-linux-x64-musl", "@resvg/resvg-js-linux-x64-gnu", "@resvg/resvg-js-darwin-x64", "@resvg/resvg-js-win32-x64"]
```

## Testing

After deployment, verify:
1. ✅ Functions deploy without environment variable size errors
2. ✅ `generate-earthquake-image` function bundles successfully
3. ✅ Writing style is accessible in newsletter and chat functions
4. ✅ Native modules load correctly at runtime

## Rollback

If issues occur:
1. The helper function automatically falls back to `WRITTING_STYLE` environment variable
2. You can temporarily remove the external configuration from `netlify.toml` (though this may cause bundling errors)

