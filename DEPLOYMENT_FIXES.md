# Deployment Fixes for Build Errors

## Issues Fixed

### 1. Environment Variables Exceed 4KB Limit

**Problem:** AWS Lambda has a 4KB limit for environment variables. The `WRITTING_STYLE` variable was too large, causing all functions to fail deployment.

**Solution:** Moved `WRITTING_STYLE` from environment variables to Netlify Blobs storage.

**Changes:**
- Created `netlify/functions/lib/get-writing-style.js` - Helper function to fetch writing style from Blobs
- Updated `netlify/functions/generate-newsletter-html.js` - Now uses Blobs instead of env var
- Updated `netlify/functions/noteworthy-chat.js` - Now uses Blobs instead of env var
- Created `netlify/functions/migrate-writing-style.js` - Migration script to move existing data

**Migration Steps:**
1. Run the migration script to move your writing style to Blobs:
   ```bash
   NETLIFY_SITE_ID=your-site-id NETLIFY_BLOB_READ_WRITE_TOKEN=your-token node netlify/functions/migrate-writing-style.js
   ```
2. After migration, you can optionally remove `WRITTING_STYLE` from environment variables (or keep it as a fallback for local dev)

**Note:** The helper function falls back to the environment variable if Blobs is unavailable, so existing setups will continue to work.

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

