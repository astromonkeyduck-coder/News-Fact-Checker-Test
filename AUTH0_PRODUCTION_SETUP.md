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

## Check If You're Using Social Providers

Before fixing the alert, check if you're using social identity providers:

1. **Go to Auth0 Dashboard** → **Authentication** → **Social**
2. **Check which providers are enabled** (Google, Facebook, Twitter/X, LinkedIn, etc.)
3. **For each enabled provider:**
   - Click on the provider name
   - Go to **Settings** tab
   - Check if it says "Using Auth0 Developer Keys" or shows Auth0's Client ID
   - If yes, you need to configure your own keys

### How to Configure Production Keys for Social Providers

**For each social provider you use:**

1. **Register with the Provider**
   - **Google**: [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
   - **Facebook**: [Facebook Developers](https://developers.facebook.com/) → My Apps → Settings
   - **Twitter/X**: [Twitter Developer Portal](https://developer.twitter.com/) → Projects & Apps
   - **LinkedIn**: [LinkedIn Developers](https://www.linkedin.com/developers/) → My Apps

2. **Get Your Credentials**
   - Each provider will give you a **Client ID** (or Consumer Key, API Key, etc.)
   - And a **Client Secret** (or Consumer Secret, Secret Key, etc.)
   - Note: Terminology varies by provider

3. **Configure in Auth0**
   - Go to Auth0 Dashboard → **Authentication** → **Social** → [Your Provider]
   - Click **Settings**
   - Enter your **Client ID** and **Client Secret**
   - Update **Callback URLs** to include:
     ```
     https://YOUR_TENANT.auth0.com/login/callback
     ```
   - Click **Save**

4. **Test the Connection**
   - Try logging in with that social provider
   - Verify it works and shows your branding (if configured)

## Verify the Fix

1. **Check Auth0 Dashboard**
   - The alert should disappear within a few minutes after making changes
   - Refresh the dashboard if needed
   - Go to **Authentication** → **Social** and verify no providers show "Using Developer Keys"

2. **Test Authentication**
   - Try signing in to your site
   - Test each social provider you've configured
   - Make sure login/logout still works correctly
   - Verify federated logout works (user is logged out of both Auth0 and the social provider)

3. **Check Application Status**
   - In Auth0 Dashboard → Applications → Your App
   - Verify it shows as "Production" or doesn't show "Development" warning
   - Check that all social connections show your own Client IDs, not Auth0's

## Critical Limitations of Developer Keys

⚠️ **If you're using social identity providers (Google, Facebook, Twitter, etc.) with developer keys, you MUST switch to production keys.** Here's why:

### Why Developer Keys Are Problematic

1. **Branding Issues**
   - Users see **Auth0's logo and branding** instead of yours during login
   - You cannot customize the consent screen with your own logo
   - This creates a poor user experience and reduces trust

2. **Single Sign-On (SSO) Doesn't Work**
   - SSO will **not function properly** with developer keys
   - The callback URL points to Auth0's generic endpoint instead of your tenant
   - Users won't stay signed in across your applications

3. **Custom Domains Don't Work**
   - You **cannot use custom domains** with developer keys
   - This limits your branding and domain control

4. **Federated Logout Fails**
   - Users won't be logged out of the social provider (Google, Facebook, etc.)
   - They'll only be logged out of Auth0, creating security concerns

5. **Advanced Features Break**
   - **Redirect rules** won't work properly
   - **`prompt=none` and checkSession()** won't function
   - **Multi-Factor Authentication (MFA)** will fail
   - **SAML Identity Provider** features will have errors

6. **Production Readiness**
   - Developer keys are **not available in Private Cloud deployments**
   - They're meant for **testing only**, not production use

### What You Need to Do

If you're using **any social identity providers** (Google, Facebook, Twitter/X, LinkedIn, etc.):

1. **Register your application** with each social provider
2. **Get your own Client ID and Client Secret** from each provider
3. **Configure them in Auth0** → Authentication → Social → [Your Provider] → Settings
4. **Replace the developer keys** with your production keys

**Example for Google:**
- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Create OAuth 2.0 credentials
- Add the Client ID and Secret to Auth0
- See: [Auth0 Developer Lab: Google Production Keys](https://developer.auth0.com/resources/labs/authentication/google-social-connection-to-login#set-up-google-production-keys)

## Important Notes

- **Development keys** are meant for testing only
- **Production keys** should be used for live sites
- The Client ID and Domain are **public** (safe to expose in client-side code)
- Never expose your **Client Secret** (not needed for SPAs anyway)
- Make sure your **Allowed Callback URLs** include all your production domains
- **Social provider credentials** (Client ID/Secret) must be configured in Auth0 for each provider you use

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

