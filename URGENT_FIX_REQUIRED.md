# 🚨 URGENT: Fix Required Before Deployment

## The Problem

Your deployment is failing because environment variables exceed AWS Lambda's 4KB limit. Even though we've updated the code to use Blobs storage, **the `WRITTING_STYLE` environment variable is still set in Netlify**, causing it to be passed to all functions.

## The Fix (Do This Now)

### Step 1: Remove WRITTING_STYLE from Netlify Environment Variables

1. Go to **Netlify Dashboard**
2. Select your site
3. Go to **Site Settings → Environment Variables**
4. Find `WRITTING_STYLE` in the list
5. **Click the delete/trash icon** to remove it
6. **Save changes**

### Step 2: Migrate Writing Style to Blobs

After removing the env var, you need to migrate the data to Blobs storage:

```bash
# Option 1: If you have the values in your environment
NETLIFY_SITE_ID=your-site-id \
NETLIFY_BLOB_READ_WRITE_TOKEN=your-token \
WRITTING_STYLE="your-writing-style-content" \
node netlify/functions/migrate-writing-style.js

# Option 2: If you have a .env file
# Just make sure WRITTING_STYLE, NETLIFY_SITE_ID, and NETLIFY_BLOB_READ_WRITE_TOKEN are set
node netlify/functions/migrate-writing-style.js
```

**Where to find these values:**
- `NETLIFY_SITE_ID`: Netlify Dashboard → Site Settings → General → Site information → Site ID
- `NETLIFY_BLOB_READ_WRITE_TOKEN`: Netlify Dashboard → Site Settings → Environment Variables (should already be there)
- `WRITTING_STYLE`: Copy this from your current Netlify environment variable before deleting it

### Step 3: Redeploy

After completing steps 1 and 2, trigger a new deployment. It should now succeed.

## Why This Happens

AWS Lambda limits environment variables to 4KB total. When `WRITTING_STYLE` is set in Netlify, it gets passed to **every function**, causing all of them to exceed the limit. By moving it to Blobs storage, each function fetches it only when needed, avoiding the limit.

## Verification

After migration, you can verify it worked by:
1. Checking the migration script output (should say "✅ Writing style successfully migrated")
2. Testing a function that uses writing style (newsletter or chat)
3. Checking Netlify logs to see if functions are fetching from Blobs

## Need Help?

If you're stuck:
1. Make sure `NETLIFY_BLOB_READ_WRITE_TOKEN` is set in Netlify environment variables
2. Verify your `NETLIFY_SITE_ID` is correct
3. Check that the migration script runs without errors
4. Ensure `WRITTING_STYLE` is completely removed from Netlify (not just hidden)

