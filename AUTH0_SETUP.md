# Auth0 Setup Instructions

## Step 1: Create Auth0 Account
1. Go to https://auth0.com and create a free account
2. Choose "Create Application"
3. Select **Single Page Application**
4. Name it "Noteworthy News" (or any name)

## Step 2: Configure Auth0 Application
1. Go to **Applications** → **Your App** → **Settings**
2. Copy your **Domain** (e.g., `your-app.auth0.com`)
3. Copy your **Client ID**

## Step 3: Add Allowed URLs

### How to Add URLs in Auth0 Dashboard:

1. **Go to Auth0 Dashboard**: https://manage.auth0.com/dashboard
2. **Navigate to Applications**: Click "Applications" in the left sidebar
3. **Select Your App**: Click on "Noteworthy News" (or your app name)
4. **Go to Settings Tab**: You should be on the Settings page
5. **Scroll down to "Application URIs" section**

### Add These URLs:

**Allowed Callback URLs** (where users return after login):
```
https://noteworthynews.co/, http://localhost:8888/, http://localhost:3000/
```
- Copy and paste all URLs separated by commas (no spaces after commas)
- Or add each URL on a new line

**Allowed Logout URLs** (where users return after logout):
```
https://noteworthynews.co/, http://localhost:8888/, http://localhost:3000/
```
- Same format as Callback URLs

**Allowed Web Origins** (for CORS - no trailing slash):
```
https://noteworthynews.co, http://localhost:8888, http://localhost:3000
```
- Important: No trailing slash for Web Origins!
- Comma-separated or one per line

**Allowed Origins (CORS)** - Sometimes shown separately:
```
https://noteworthynews.co, http://localhost:8888, http://localhost:3000
```

**Application Login URL** (Optional - usually not needed for SPAs):
```
https://noteworthynews.co/
```
- This is optional for Single Page Applications
- Only needed if you want a specific URL that Auth0 should redirect to after login
- For most SPAs, you can leave this blank or set it to your main site URL
- The Callback URLs handle the redirect flow, so this is often not required

6. **Click "Save Changes"** button at the bottom

## Step 4: Update Configuration
Edit `/src/auth/auth0.js` and replace:
- `YOUR_AUTH0_DOMAIN.auth0.com` with your actual domain
- `YOUR_CLIENT_ID_HERE` with your actual Client ID

Example:
```javascript
const auth0Config = {
  domain: 'noteworthy-news.auth0.com',
  clientId: 'abc123xyz789...',
  // ...
};
```

## Step 5: Add Auth Buttons (if needed)
If you don't have sign in/sign up buttons yet, add them to your header:

```html
<button id="signinBtn" class="auth-btn signin-btn">Sign In</button>
<button id="signupBtn" class="auth-btn signup-btn">Sign Up</button>
```

## Step 6: Test
1. Deploy your changes
2. Click "Sign In" or "Sign Up"
3. You should be redirected to Auth0 login page
4. After login, you'll be redirected back to your site
5. Your name should appear in the button

## Optional: Environment Variables
For production, you can use environment variables instead of hardcoding:

1. Create `.env` file (for local dev):
```
AUTH0_DOMAIN=your-app.auth0.com
AUTH0_CLIENT_ID=your-client-id
```

2. Update `auth0.js` to read from environment:
```javascript
const auth0Config = {
  domain: process.env.AUTH0_DOMAIN || 'YOUR_AUTH0_DOMAIN.auth0.com',
  clientId: process.env.AUTH0_CLIENT_ID || 'YOUR_CLIENT_ID_HERE',
  // ...
};
```

3. In Netlify, add these as environment variables in Site Settings → Environment Variables

## Troubleshooting
- **Redirect error**: Make sure callback URLs are exactly correct in Auth0 Dashboard
- **CORS error**: Check that Web Origins are added correctly
- **Not working**: Check browser console for Auth0 errors
- **Can't find buttons**: Make sure you have elements with `id="signinBtn"` and `id="signupBtn"`

