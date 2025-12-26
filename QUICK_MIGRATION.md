# Quick Migration Guide

## Option 1: Fill in .env.netlify and Run Script (Easiest)

1. **Open `.env.netlify`** and fill in your credentials:
   - `NETLIFY_SITE_ID`: Get from Netlify Dashboard → Site Settings → General → Site ID
   - `NETLIFY_BLOB_READ_WRITE_TOKEN`: Get from Netlify Dashboard → Site Settings → Environment Variables

2. **Run the migration:**
   ```bash
   ./run-migration.sh
   ```

## Option 2: One-Line Command

```bash
NETLIFY_SITE_ID="your-site-id" \
NETLIFY_BLOB_READ_WRITE_TOKEN="your-token" \
WRITTING_STYLE="$(cat writing-style-samples.txt)" \
node netlify/functions/migrate-writing-style.js
```

## Option 3: Add to .env File

Add these lines to your `.env` file:
```
NETLIFY_SITE_ID=your-site-id-here
NETLIFY_BLOB_READ_WRITE_TOKEN=your-token-here
```

Then run:
```bash
export WRITTING_STYLE="$(cat writing-style-samples.txt)"
node netlify/functions/migrate-writing-style.js
```

## After Migration

**CRITICAL:** Go to Netlify Dashboard → Site Settings → Environment Variables → **DELETE `WRITTING_STYLE`**

Then redeploy!

