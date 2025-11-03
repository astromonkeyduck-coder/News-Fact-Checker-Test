# Verify Auth0 Environment Variables Setup

## Current Status ✅

You've set the variables:
- ✅ `AUTH0_CLIENT_ID` - Scoped to Builds, Functions, Runtime · 2 values in 2 deploy contexts
- ✅ `AUTH0_DOMAIN` - Scoped to Builds, Functions, Runtime · 2 values in 2 deploy contexts

## Important: Check Production Scope

The "2 values in 2 deploy contexts" suggests you have them set for multiple contexts. Make sure **Production** is included:

1. **Go to Netlify**: Site Settings → Environment Variables
2. **Click on `AUTH0_DOMAIN`** to edit it
3. **Check the scope/deploy contexts** - make sure "Production" is selected
4. **Repeat for `AUTH0_CLIENT_ID`**

The deploy contexts might be:
- Production ✅ (needed)
- Deploy previews (optional)
- Branch deploys (optional)

**Important**: Production MUST be included for your live site to use the credentials.

## Verify Values Are Correct

In each variable, check that the **Production** value is:
- `AUTH0_DOMAIN`: Your production Auth0 domain (NOT `dev-u7a2ovr5jdmdwryp.us.auth0.com`)
- `AUTH0_CLIENT_ID`: Your production Client ID (NOT the development one)

## Next Steps

1. **Verify Production scope** (see above)
2. **Trigger a new deploy**:
   - Go to Netlify → **Deploys** tab
   - Click **Trigger deploy** → **Deploy site**
   - This ensures the build script runs with your environment variables

3. **Check build logs**:
   - After deploy starts, click on it to view logs
   - Look for: `✅ Auth0 production credentials injected successfully`
   - Should see: `Domain: your-tenant.us.auth0.com...` (NOT dev-*)

4. **Verify on live site**:
   - Visit your production site
   - Open browser console (F12)
   - Look for: `[Auth0] Production credentials loaded`
   - If you see `⚠️ Using development credentials`, the env vars aren't being used

## Common Issues

**If warning still appears:**
- Variables might not be scoped to Production
- Build might have happened before variables were set
- Need to redeploy after setting variables

**If login doesn't work:**
- Check callback URLs in Auth0 Dashboard match your site URL
- Verify Client ID is correct
- Check browser console for Auth0 errors

## Quick Test

After redeploying, check the built HTML source:
1. Visit your live site
2. View page source (Ctrl+U or Cmd+Option+U)
3. Search for: `AUTH0_DOMAIN`
4. Should see: `window.AUTH0_DOMAIN = 'your-production-domain.us.auth0.com'`
5. Should NOT see: `dev-u7a2ovr5jdmdwryp`

If you see the dev domain in the source, the environment variables aren't being injected properly.

