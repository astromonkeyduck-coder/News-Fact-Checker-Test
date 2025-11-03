# Quick Fix: "Development Keys" Warning During Login

## The Problem
Auth0 shows a warning "One or more of your connections are currently using Auth0 development keys and should not be used in production" **only when you try to log in**.

This happens because your site is using the development tenant (`dev-u7a2ovr5jdmdwryp.us.auth0.com`) instead of production credentials.

## The Solution

You need to set production environment variables in Netlify so the build script injects production credentials instead of using the hardcoded development ones.

### Step-by-Step Fix (5 minutes):

1. **Get Your Production Credentials**:
   - Go to https://manage.auth0.com/dashboard
   - Click **Applications** → Your application (or create a new one for production)
   - Go to **Settings** tab
   - Copy the **Domain** (e.g., `your-tenant.us.auth0.com`)
   - Copy the **Client ID**

2. **Set Environment Variables in Netlify**:
   - Go to https://app.netlify.com
   - Select your site → **Site Settings** → **Environment Variables**
   - Click **Add a variable**
   
   **Variable 1:**
   - Key: `AUTH0_DOMAIN`
   - Value: Your production domain (e.g., `your-tenant.us.auth0.com`)
   - Scope: **Production** (or All scopes)
   - **Sensitive**: ✅ You can mark as "sensitive" (it just hides it in UI, but it's safe to expose)
   - Click **Save**
   
   **Variable 2:**
   - Key: `AUTH0_CLIENT_ID`
   - Value: Your production Client ID
   - Scope: **Production** (or All scopes)
   - **Sensitive**: ✅ You can mark as "sensitive" (it just hides it in UI, but it's safe to expose)
   - Click **Save**

   **Note**: These are NOT secret values - they're public and safe to include in client-side code. Marking them as "sensitive" in Netlify just hides them from the UI, but they'll still be injected into your HTML/JS during build (which is fine for SPAs).

3. **Configure Callback URLs in Auth0**:
   - Still in Auth0 Dashboard → Your app → **Settings**
   - Scroll to **Application URIs**
   - Set these values:
     - **Allowed Callback URLs**: 
       ```
       https://noteworthynews.co/, https://noteworthynews.co/index.html, http://localhost:8888/
       ```
     - **Allowed Logout URLs**:
       ```
       https://noteworthynews.co/, http://localhost:8888/
       ```
     - **Allowed Web Origins**:
       ```
       https://noteworthynews.co, http://localhost:8888
       ```
   - Click **Save Changes**

4. **Redeploy Your Site**:
   - In Netlify, go to **Deploys** tab
   - Click **Trigger deploy** → **Deploy site**
   - Wait for the build to complete

5. **Verify It Works**:
   - Visit your live site
   - Open browser console (F12)
   - Look for: `[Auth0] Production credentials loaded`
   - Try logging in - the warning should be gone!

## How It Works

The build script (`scripts/inject-auth0.js`) runs during Netlify builds and:
1. Reads `AUTH0_DOMAIN` and `AUTH0_CLIENT_ID` from environment variables
2. Injects them into `index.html` to replace the development credentials
3. Your site then uses production credentials instead of `dev-u7a2ovr5jdmdwryp`

## Troubleshooting

**If the warning still appears after deploying:**
- Check Netlify build logs to confirm environment variables are being read
- Check browser console for `[Auth0] Production credentials loaded` message
- Clear browser cache and try again
- Make sure environment variables are set to **Production** scope (not just Deploy previews)

**If login doesn't work after setting production credentials:**
- Double-check callback URLs match exactly (including trailing slashes)
- Verify the Client ID is correct
- Check browser console for Auth0 errors

## Important Notes

- The warning only shows **during login** because that's when Auth0 checks which tenant is being used
- Development tenant (`dev-*`) always triggers the warning
- Production tenant (your custom domain) won't show the warning
- Environment variables must be set to **Production** scope for the live site

## Current Code

Your `src/auth/auth0.js` currently has:
```javascript
domain: window.AUTH0_DOMAIN || 'dev-u7a2ovr5jdmdwryp.us.auth0.com',
```

Once environment variables are set, the build script will inject production values, so `window.AUTH0_DOMAIN` will be set and the fallback won't be used.

