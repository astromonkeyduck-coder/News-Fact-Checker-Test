# ingest-all Engines Not Loading - Debug Guide

## Problem

The `ingest-all` function is failing with:
```
[ingest-all] Engines or logger not initialized. Check function dependencies.
[ingest-all] engines: false createLogger: true
```

This means:
- ✅ Logger is loading correctly
- ❌ Engines are NOT loading (engines = false)

## Root Cause

The zisi bundler (used for `ingest-all` because it needs native modules) may not be bundling the engine files correctly, OR the engines are failing to load due to missing dependencies.

## Solution Applied

1. **Changed from dynamic requires to static requires**:
   - Old: `require(\`./engines/${engineName}\`)` (template string - zisi can't analyze)
   - New: Static requires wrapped in functions (zisi can analyze)

2. **Added detailed logging**:
   - Logs each engine load attempt
   - Logs success/failure for each engine
   - Shows summary of loaded vs failed engines

3. **Better error messages**:
   - Shows which engines failed
   - Includes error details (message, code, stack)

## How to Debug

### 1. Check Netlify Function Logs

After deploying, check the logs for:
```
[ingest-all] Loading engines...
[ingest-all] Attempting to load engine: usgs
[ingest-all] ✓ Engine usgs loaded successfully
...
[ingest-all] Engine loading summary: X loaded, Y failed
```

### 2. Common Issues

#### Issue: "Cannot find module './engines/usgs'"
**Cause**: Engine files not included in zisi bundle
**Fix**: Check `netlify.toml` has:
```toml
[functions."ingest-all"]
  included_files = ["netlify/functions/engines/**", ...]
```

#### Issue: "Cannot find module '../lib/supabaseClient'"
**Cause**: Engine dependencies not bundled
**Fix**: Ensure `included_files` includes `netlify/functions/lib/**`

#### Issue: "Module not found" or "require is not defined"
**Cause**: zisi bundler issue
**Fix**: 
- Check `node_bundler = "zisi"` in `netlify.toml`
- Redeploy to ensure fresh bundle

### 3. Verify Engine Files Exist

```bash
ls -la netlify/functions/engines/
```

Should show:
- usgs.js
- nws.js
- faa.js
- uscg.js
- volcano.js
- embassy.js

### 4. Test Locally

```bash
netlify dev
```

Then trigger ingest-all:
```bash
curl -X POST http://localhost:8888/.netlify/functions/ingest-all
```

Check local logs for engine loading messages.

## Expected Behavior After Fix

1. **Initialization logs**:
   ```
   [ingest-all] Loading dependencies...
   [ingest-all] ✓ Supabase client loaded
   [ingest-all] ✓ Logger loaded
   [ingest-all] Loading engines...
   [ingest-all] Attempting to load engine: usgs
   [ingest-all] ✓ Engine usgs loaded successfully
   ...
   [ingest-all] ✓ 6 engines loaded: usgs,nws,faa,uscg,volcano,embassy
   ```

2. **Handler logs**:
   ```
   [ingest-all] Handler invoked
   [ingest-all] Remaining time: 59998 ms
   [ingest-all] Starting ingestion run (DRY_RUN=false)
   ```

3. **No errors** about engines not initialized

## If Still Failing

1. **Check zisi bundle**:
   - Download function bundle from Netlify Dashboard
   - Verify `engines/` directory exists in bundle
   - Verify `lib/` directory exists in bundle

2. **Check engine dependencies**:
   - Each engine requires `../lib/supabaseClient`
   - Each engine may require other lib modules
   - Ensure all dependencies are in `included_files`

3. **Check for circular dependencies**:
   - Engines shouldn't import each other
   - Engines shouldn't import `ingest-all`

4. **Check environment variables**:
   - `SUPABASE_URL` must be set
   - `SUPABASE_SERVICE_ROLE_KEY` must be set
   - Engines may need additional env vars

## Summary

✅ **Fixed**: Changed to static requires for zisi bundler
✅ **Added**: Detailed logging for each engine load
✅ **Improved**: Error messages show which engines failed

After deploying, check logs to see which engines load successfully and which fail.
