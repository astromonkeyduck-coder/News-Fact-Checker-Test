# Fix Auth0 Development Keys Alert

## Problem
You're seeing this alert in Auth0:
> "One or more of your connections are currently using Auth0 development keys and should not be used in production."

This happens when you're using a **development/test application** instead of a **production application** in Auth0.

## Solution

### Option 1: Convert Your Existing Application to Production (Recommended)

1. **Go to Auth0 Dashboard**
   - Visit: https://manage.auth0.com/dashboard
   - Navigate to **Applications** → Select your application

2. **Check Application Type**
   - Look at the **Application Type** field
   - If it says "Development" or "Test", you need to change it

3. **Update Application Settings**
   - Click on **Settings** tab
   - Scroll down to find **Application Type** or **Application Classification**
   - Change it from "Development" to **"Production"** or **"Regular Web Application"**
   - Make sure **Application Type** is set to **"Single Page Application"** (for SPAs)

4. **Save Changes**
   - Click **Save Changes** at the bottom
   - The alert should disappear after a few minutes

### Option 2: Create a New Production Application

If you prefer to keep your development app separate:

1. **Create New Application**
   - Go to Auth0 Dashboard → **Applications** → **Create Application**
   - Name it: "Noteworthy News Production"
   - Select **Single Page Application** as the type
   - Click **Create**

2. **Copy New Credentials**
   - Go to **Settings** tab
   - Copy the **Domain** and **Client ID**

3. **Update Netlify Environment Variables**
   - Go to Netlify Dashboard → Your Site → **Site Settings** → **Environment Variables**
   - Update `AUTH0_DOMAIN` with the new domain
   - Update `AUTH0_CLIENT_ID` with the new Client ID
   - Click **Save**

4. **Configure Application Settings**
   - **Allowed Callback URLs**: Add your production URL
     ```
     https://your-site.netlify.app/
     https://your-site.netlify.app/*
     https://yourdomain.com/
     https://yourdomain.com/*
     ```
   - **Allowed Logout URLs**: Add the same URLs
   - **Allowed Web Origins**: Add your domain
     ```
     https://your-site.netlify.app
     https://yourdomain.com
     ```
   - **Allowed Origins (CORS)**: Same as above

5. **Redeploy Your Site**
   - The new credentials will be picked up on the next deployment
   - Or trigger a manual redeploy

### Option 3: Disable the Alert (Not Recommended)

If you want to keep using development keys (not recommended for production):

1. Go to Auth0 Dashboard → **Settings** → **General**
2. Look for alert preferences (this may not be available in all Auth0 plans)
3. Note: This doesn't fix the underlying issue - you should still use production keys

## Verify the Fix

1. **Check Auth0 Dashboard**
   - The alert should disappear within a few minutes after making changes
   - Refresh the dashboard if needed

2. **Test Authentication**
   - Try signing in to your site
   - Make sure login/logout still works correctly

3. **Check Application Status**
   - In Auth0 Dashboard → Applications → Your App
   - Verify it shows as "Production" or doesn't show "Development" warning

## Important Notes

- **Development keys** are meant for testing only
- **Production keys** should be used for live sites
- The Client ID and Domain are **public** (safe to expose in client-side code)
- Never expose your **Client Secret** (not needed for SPAs anyway)
- Make sure your **Allowed Callback URLs** include all your production domains

## Current Configuration

Your Auth0 credentials are stored in:
- **Netlify Environment Variables**: `AUTH0_DOMAIN` and `AUTH0_CLIENT_ID`
- **Function**: `netlify/functions/get-auth0-config.js` (reads from env vars)
- **Client Code**: `src/auth/auth0.js` (uses credentials from window.AUTH0_DOMAIN and window.AUTH0_CLIENT_ID)

## Need Help?

If the alert persists:
1. Check that you're using the correct Auth0 tenant (not a test tenant)
2. Verify your Auth0 plan supports production applications
3. Contact Auth0 support if you're on a free tier and need production access

