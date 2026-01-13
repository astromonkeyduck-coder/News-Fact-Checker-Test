# Debug: Why upload-blob Function Isn't Being Called

## Possible Reasons

### 1. **Function Not Deployed** ⚠️ MOST LIKELY
- Netlify might not have picked up the new function file
- Check: Netlify Dashboard → Functions → See if `upload-blob` appears in the list
- Solution: Trigger a new deployment or redeploy

### 2. **Redirect Not Working**
- The redirect from `/api/upload-blob` to `/.netlify/functions/upload-blob` might not be active
- Check: Try accessing `/.netlify/functions/upload-blob` directly (should give method error, not 500)
- Solution: Verify redirect is in netlify.toml and redeploy

### 3. **Function Crashing on Load** ⚠️ LIKELY
- If `@netlify/blobs` module fails to load, function crashes before handler runs
- The error "Internal Error. ID: 01KETAC1ZRGCZF5VZAEAG1YZR7" suggests Netlify infrastructure error
- Solution: Check if `@netlify/blobs` is in package.json (it is: version 8.2.0)

### 4. **Build Process Issue**
- Function might not be included in build output
- Check: Netlify build logs to see if function is being processed
- Solution: Verify `functions = "netlify/functions"` in netlify.toml (it is)

### 5. **Function Name Mismatch**
- File is `upload-blob.js` but Netlify might expect different naming
- Check: Other functions use same pattern (e.g., `get-upload-url.js`)
- Solution: Naming looks correct

## Diagnostic Steps

### Step 1: Check if Function Exists in Netlify
1. Go to Netlify Dashboard → Your Site → Functions
2. Look for `upload-blob` in the list
3. If it's NOT there → Function not deployed

### Step 2: Test Direct Function Access
```bash
curl -X POST https://noteworthynews.co/.netlify/functions/upload-blob
```
- If you get "Method not allowed" → Function exists but redirect might be issue
- If you get 404 → Function not deployed
- If you get 500 → Function exists but crashing

### Step 3: Check Build Logs
1. Netlify Dashboard → Deploys → Latest deploy → Build log
2. Look for "Functions bundled" or "upload-blob"
3. Check for any errors during function bundling

### Step 4: Check Function Logs (if function exists)
1. Netlify Dashboard → Functions → upload-blob → View Logs
2. Even if function crashes, there should be SOME log entry
3. If completely empty → Function not being invoked at all

## Most Likely Issue

Based on the error "Internal Error. ID: 01KETAC1ZRGCZF5VZAEAG1YZR7", this looks like:
- **Netlify infrastructure error** (not our code)
- Function might not be deployed/recognized
- Or function is crashing during module load (before handler runs)

## Quick Fixes to Try

1. **Redeploy**: Trigger a new deployment in Netlify Dashboard
2. **Check Function List**: Verify function appears in Functions tab
3. **Test Direct URL**: Try `/.netlify/functions/upload-blob` directly
4. **Check Build Logs**: See if function is being bundled
5. **Verify Dependencies**: Ensure `@netlify/blobs` is installed (it is in package.json)

## If Function Still Not Working

The logging I added should help once function is actually being called. But if there are NO logs at all, the function isn't being invoked, which points to:
- Deployment issue (most likely)
- Redirect not working
- Function not being recognized by Netlify
