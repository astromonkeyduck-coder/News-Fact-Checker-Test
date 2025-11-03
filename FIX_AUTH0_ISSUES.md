# Fix Auth0 Development Keys & Login Message Issues

You have two issues to fix:

## Issue 1: Development Keys Warning ⚠️

**Problem**: "One or more of your connections are currently using Auth0 development keys and should not be used in production."

**Solution**: You need to set production environment variables in Netlify.

### Steps:

1. **Get Production Credentials**:
   - Go to https://manage.auth0.com/dashboard
   - Navigate to **Applications** → Your app (or create a new production app)
   - Go to **Settings** tab
   - Copy the **Domain** (e.g., `your-tenant.us.auth0.com`)
   - Copy the **Client ID**

2. **Add to Netlify**:
   - Go to https://app.netlify.com
   - Select your site → **Site Settings** → **Environment Variables**
   - Click **Add a variable**
   - Add these two:
     - **Key**: `AUTH0_DOMAIN`
       **Value**: `your-production-domain.us.auth0.com` (paste your domain)
       **Scope**: All scopes (or Production only)
     - **Key**: `AUTH0_CLIENT_ID`
       **Value**: `your-production-client-id` (paste your Client ID)
       **Scope**: All scopes (or Production only)
   - Click **Save**

3. **Configure Auth0 Application**:
   - Still in Auth0 Dashboard → Your app → **Settings**
   - Under **Application URIs**, set:
     - **Allowed Callback URLs**: `https://noteworthynews.co/, https://noteworthynews.co/index.html, http://localhost:8888/`
     - **Allowed Logout URLs**: `https://noteworthynews.co/, http://localhost:8888/`
     - **Allowed Web Origins**: `https://noteworthynews.co, http://localhost:8888` (no trailing slash)
   - Click **Save Changes**

4. **Redeploy**:
   - Go to Netlify → **Deploys** tab
   - Click **Trigger deploy** → **Deploy site**
   - The build script will inject your production credentials

## Issue 2: Login Message Still Shows "dev-u7a2ovr5jdmdwryp" 🔴

**Problem**: "Log in to dev-u7a2ovr5jdmdwryp to continue to Noteworthy News" message persists.

**Solution**: The message comes from Auth0's Universal Login template, NOT from your application name. You must edit the template directly.

### Steps:

1. **Go to Universal Login Template**:
   - In Auth0 Dashboard, click **Branding** (left sidebar)
   - Click **Universal Login**
   - You'll see tabs: **Login** and **Sign Up**

2. **Edit the Login Template**:
   - Click the **Login** tab
   - In the template editor, press **Ctrl+F** (or Cmd+F) to search
   - Search for: `{clientName}` or `dev-u7a2ovr5jdmdwryp`
   - You'll find code like:
     ```html
     <p>{{trans "Log in to {clientName} to continue to {appName}."}}</p>
     ```
   - **Replace it with one of these**:
     
     **Option A (Recommended)**: Simple welcome message
     ```html
     <p>{{trans "Welcome to Noteworthy News"}}</p>
     ```
     
     **Option B**: Custom sign-in message
     ```html
     <p>{{trans "Sign in to Noteworthy News"}}</p>
     ```
     
     **Option C**: Remove client name, keep app name
     ```html
     <p>{{trans "Log in to continue to {appName}."}}</p>
     ```

3. **Also Fix Sign Up Template**:
   - Click the **Sign Up** tab
   - Search for `{clientName}` again
   - Replace it the same way
   - Example:
     ```html
     <p>{{trans "Create your Noteworthy News account"}}</p>
     ```

4. **Save Changes**:
   - Click **Save** button (bottom right)
   - Auth0 will apply changes immediately
   - Changes may take 1-2 minutes to propagate

5. **Verify**:
   - Visit your site and click "Sign In"
   - The login page should now show your custom message

## Quick Checklist ✅

- [ ] Created/configured production Auth0 application
- [ ] Set `AUTH0_DOMAIN` in Netlify environment variables
- [ ] Set `AUTH0_CLIENT_ID` in Netlify environment variables
- [ ] Configured callback/logout URLs in Auth0
- [ ] Redeployed site on Netlify
- [ ] Edited Universal Login template (Login tab)
- [ ] Edited Universal Login template (Sign Up tab)
- [ ] Saved both templates
- [ ] Tested login to verify changes

## Still Not Working?

If after following these steps you still see the warning or old message:

1. **Clear browser cache** and try again
2. **Check Netlify build logs** to verify environment variables are injected
3. **Check browser console** (F12) for Auth0 errors
4. **Wait 2-3 minutes** for Auth0 template changes to propagate
5. **Try incognito/private browsing** to rule out cache issues

## Notes

- The application name in Auth0 Settings does NOT change the login message
- Only editing the Universal Login template changes the message
- Development keys warning will disappear once production env vars are set
- Both fixes are independent - you can do them in any order

