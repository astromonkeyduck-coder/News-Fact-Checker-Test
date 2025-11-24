# 🎯 You Created Auth0 App - What's Next?

## Step 1: Copy Your Auth0 Credentials (2 minutes)

1. **In Auth0 Dashboard**, you should see your application page
2. Look for these two values:
   - **Domain**: Something like `dev-xxxxx.us.auth0.com`
   - **Client ID**: A long string like `LTAU4cZtZFsG8DqK2SbPoAKiYt14bCER`
3. **Copy both** - you'll need them in the next steps!

## Step 2: Configure Auth0 URLs (3 minutes)

1. **Still in Auth0 Dashboard** → Your Application → **Settings** tab
2. Scroll down to **"Application URIs"** section
3. **Allowed Callback URLs** - Paste these (one per line):
   ```
   https://eloquent-biscochitos-4fbdc5.netlify.app
   https://eloquent-biscochitos-4fbdc5.netlify.app/
   https://eloquent-biscochitos-4fbdc5.netlify.app/index.html
   https://noteworthynews.co
   https://noteworthynews.co/
   https://noteworthynews.co/index.html
   http://localhost:8888
   http://localhost:8888/
   http://localhost:8888/index.html
   ```

4. **Allowed Logout URLs** - Paste the same URLs as above

5. **Allowed Web Origins** - Paste these (NO trailing slash):
   ```
   https://eloquent-biscochitos-4fbdc5.netlify.app
   https://noteworthynews.co
   http://localhost:8888
   ```

6. Click **"Save Changes"** at the bottom

## Step 3: Set Netlify Environment Variables (3 minutes)

1. Go to **Netlify Dashboard**: https://app.netlify.com
2. Click on your site
3. Go to **Site settings** → **Environment variables**
4. Click **"Add variable"**
5. Add these two variables:

   **Variable 1:**
   - Key: `AUTH0_DOMAIN`
   - Value: `dev-xxxxx.us.auth0.com` (paste your actual domain)
   - Click **"Save"**

   **Variable 2:**
   - Key: `AUTH0_CLIENT_ID`
   - Value: `your-client-id-here` (paste your actual client ID)
   - Click **"Save"**

## Step 4: Update Local Development File (2 minutes)

1. Open `.env.local` in your project
2. Add these lines (replace with your actual values):
   ```
   AUTH0_DOMAIN=dev-xxxxx.us.auth0.com
   AUTH0_CLIENT_ID=your-client-id-here
   ```
3. Save the file

## Step 5: Test Locally (2 minutes)

1. Start your dev server:
   ```bash
   npm run dev
   # or
   npx netlify dev
   ```

2. Open http://localhost:8888 in your browser

3. Click the **"Sign Up"** button in the header

4. You should be redirected to Auth0 login page!

5. Create an account and you'll be redirected back

## Step 6: Deploy to Production (2 minutes)

1. Commit your changes:
   ```bash
   git add .
   git commit -m "Configure Auth0 authentication"
   git push
   ```

2. Netlify will automatically deploy

3. Once deployed, visit your live site and test sign up!

## ✅ Checklist

- [ ] Copied Domain from Auth0
- [ ] Copied Client ID from Auth0
- [ ] Configured Callback URLs in Auth0
- [ ] Configured Logout URLs in Auth0
- [ ] Configured Web Origins in Auth0
- [ ] Saved changes in Auth0
- [ ] Set AUTH0_DOMAIN in Netlify
- [ ] Set AUTH0_CLIENT_ID in Netlify
- [ ] Updated .env.local file
- [ ] Tested locally
- [ ] Deployed to production

## 🎉 You're Almost Done!

Once you complete these steps, your account system will be fully working!

**Need help?** Check the browser console if something doesn't work.


