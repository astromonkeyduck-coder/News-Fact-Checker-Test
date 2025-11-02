# Setup Production Auth0 Credentials

## Quick Setup (5 minutes)

To remove the warning "One or more of your connections are currently using Auth0 development keys", follow these steps:

### Step 1: Create Production Application in Auth0

1. Go to https://manage.auth0.com/dashboard
2. Navigate to **Applications** → **Create Application**
3. Name it: **"Noteworthy News Production"**
4. Select: **Single Page Application**
5. Click **Create**

### Step 2: Configure Application Settings

1. In your new application, go to **Settings**
2. Scroll to **Application URIs**
3. Add **Allowed Callback URLs**:
   ```
   https://noteworthynews.co/, https://noteworthynews.co/index.html, http://localhost:8888/
   ```
4. Add **Allowed Logout URLs**:
   ```
   https://noteworthynews.co/, http://localhost:8888/
   ```
5. Add **Allowed Web Origins** (no trailing slash):
   ```
   https://noteworthynews.co, http://localhost:8888
   ```
6. Click **Save Changes**

### Step 3: Copy Production Credentials

Still in **Settings**:
1. Copy the **Domain** (e.g., `your-tenant.auth0.com`)
2. Copy the **Client ID**

### Step 4: Add Environment Variables in Netlify

1. Go to https://app.netlify.com
2. Select your site → **Site Settings** → **Environment Variables**
3. Click **Add a variable**
4. Add these two variables:

   **Variable 1:**
   - Key: `AUTH0_DOMAIN`
   - Value: `your-production-domain.auth0.com` (paste from Step 3)
   - Scope: **All scopes** (or **Production** only)

   **Variable 2:**
   - Key: `AUTH0_CLIENT_ID`
   - Value: `your-production-client-id` (paste from Step 3)
   - Scope: **All scopes** (or **Production** only)

5. Click **Save**

### Step 5: Redeploy

1. Go to **Deploys** tab
2. Click **Trigger deploy** → **Deploy site**
3. The build will automatically inject the production credentials

### Step 6: Verify

After deployment:
1. Visit your live site
2. Open browser console (F12)
3. Look for: `[Auth0] Production credentials loaded`
4. The Auth0 warning should disappear

## What Changed?

The build process (`scripts/inject-auth0.js`) now:
- Reads `AUTH0_DOMAIN` and `AUTH0_CLIENT_ID` from Netlify environment variables
- Injects them into `index.html` at build time
- The Auth0 config uses these instead of development credentials

## For Local Development

You can create a `.env` file (not committed to git):
```
AUTH0_DOMAIN=your-production-domain.auth0.com
AUTH0_CLIENT_ID=your-production-client-id
```

Or keep using development credentials locally (they're in the code as fallback).

## Troubleshooting

**Warning still appears?**
- Check Netlify build logs - do you see the variables?
- Verify variables are set in Netlify Dashboard
- Make sure the build command runs: `npm run build`

**Build fails?**
- Check that `scripts/inject-auth0.js` is executable: `chmod +x scripts/inject-auth0.js`
- Verify Node.js is available in Netlify build environment

**Credentials not working?**
- Double-check callback URLs in Auth0 Dashboard match your domain exactly
- Verify Web Origins are set correctly (no trailing slash)
- Check browser console for Auth0 errors

## Security Note

For Single Page Applications (SPAs), it's **normal and expected** that Auth0 credentials are visible in the browser JavaScript. This is not a security issue because:
- The Client ID is public by design
- No sensitive secrets are exposed
- Authentication is handled server-side by Auth0

