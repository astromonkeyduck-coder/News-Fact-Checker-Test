# 🖥️ Local Development Setup

## Yes, You Need to Set Credentials for Local Development!

For local testing, you need to provide your Auth0 credentials. Here are your options:

## Option 1: Add to HTML (Easiest for Testing) ⭐

1. **Open `index.html`**
2. **Find this section** (around line 13344):
   ```html
   <!-- Auth0 SDK - Must load before auth0.js -->
   ```

3. **Add this RIGHT BEFORE it:**
   ```html
   <script>
     // Auth0 credentials for local development
     // Get these from: https://manage.auth0.com/dashboard → Your App → Settings
     window.AUTH0_DOMAIN = 'dev-xxxxx.us.auth0.com';
     window.AUTH0_CLIENT_ID = 'your-client-id-here';
   </script>
   ```

4. **Replace with your actual values:**
   - `dev-xxxxx.us.auth0.com` → Your Auth0 Domain
   - `your-client-id-here` → Your Auth0 Client ID

5. **Save and refresh!**

## Option 2: Use .env.local (Better for Long-term)

1. **Open `.env.local`** in your project root
2. **Add these lines:**
   ```
   AUTH0_DOMAIN=dev-xxxxx.us.auth0.com
   AUTH0_CLIENT_ID=your-client-id-here
   ```

3. **But wait!** The current code reads from `window.AUTH0_DOMAIN`, not from `.env.local`

4. **You'd need to modify the code** to read from environment variables, OR...

5. **Easier:** Just use Option 1 for now!

## Option 3: Use Netlify Dev (Automatic)

If you're using `npx netlify dev`, it will automatically load environment variables from Netlify, BUT you still need to set them in Netlify Dashboard first.

## ✅ Quick Setup (Recommended)

**Just use Option 1** - it's the fastest:

1. Copy your Domain and Client ID from Auth0 Dashboard
2. Add the script block to `index.html` (see Option 1 above)
3. Save
4. Run `npm run dev`
5. Test!

## 🔍 Where to Get Your Credentials

1. Go to https://manage.auth0.com/dashboard
2. Click **Applications** → Your App
3. Go to **Settings** tab
4. Copy:
   - **Domain** (e.g., `dev-xxxxx.us.auth0.com`)
   - **Client ID** (long string)

## ⚠️ Important Notes

- **For Production:** Credentials should come from Netlify environment variables (already set up)
- **For Local Dev:** You need to set them manually (Option 1 or 2)
- **Security:** Don't commit credentials to git if you use Option 1 (they're in HTML)
- **Best Practice:** Use `.env.local` (Option 2) and add it to `.gitignore`

## 🎯 What You Need to Do Right Now

1. Get your Auth0 Domain and Client ID
2. Add the script block to `index.html` (Option 1)
3. Save and test!

That's it! Once you add the credentials, local development will work.


