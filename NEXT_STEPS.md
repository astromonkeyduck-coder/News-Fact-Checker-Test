# 🚀 Next Steps: Get Your Account System Running

Follow these steps in order to get your sign-in/sign-up system working:

## Step 1: Create Auth0 Account (5 minutes)

1. Go to https://auth0.com/signup
2. Sign up for a free account (7,000 free users/month)
3. Verify your email

## Step 2: Create Auth0 Application (3 minutes)

1. Go to https://manage.auth0.com/dashboard
2. Click **"Applications"** in the left sidebar
3. Click **"Create Application"**
4. Name it: **"Noteworthy News"**
5. Select **"Single Page Application"** (IMPORTANT!)
6. Click **"Create"**

## Step 3: Get Your Credentials (2 minutes)

After creating the application, you'll see:
- **Domain**: Something like `dev-xxxxx.us.auth0.com` (copy this)
- **Client ID**: A long string (copy this)

**Save these somewhere safe!** You'll need them in the next steps.

## Step 4: Configure Auth0 URLs (5 minutes)

Still in the Auth0 Dashboard, scroll down to **"Application URIs"**:

1. **Allowed Callback URLs** - Add these (one per line):
   ```
   https://your-site.netlify.app/
   https://your-site.netlify.app/index.html
   http://localhost:8888/
   http://localhost:8888/index.html
   ```
   *(Replace `your-site.netlify.app` with your actual Netlify domain)*

2. **Allowed Logout URLs** - Add the same URLs as above

3. **Allowed Web Origins** - Add these (one per line):
   ```
   https://your-site.netlify.app
   http://localhost:8888
   ```
   ⚠️ **CRITICAL**: Without this, users will be logged out when they refresh the page!

4. Click **"Save Changes"**

## Step 5: Set Environment Variables in Netlify (3 minutes)

1. Go to your Netlify Dashboard
2. Select your site
3. Go to **Site settings** → **Environment variables**
4. Click **"Add variable"**
5. Add these two variables:

   **Variable 1:**
   - Key: `AUTH0_DOMAIN`
   - Value: `dev-xxxxx.us.auth0.com` (your Auth0 domain)

   **Variable 2:**
   - Key: `AUTH0_CLIENT_ID`
   - Value: `your-client-id-here` (your Auth0 Client ID)

6. Click **"Save"**

## Step 6: For Local Development (Optional)

If you want to test locally, create a file called `.env.local` in your project root:

```bash
# Create the file
touch .env.local
```

Then add this content (replace with your actual values):
```
AUTH0_DOMAIN=dev-xxxxx.us.auth0.com
AUTH0_CLIENT_ID=your-client-id-here
```

**OR** you can set them directly in your HTML before the Auth0 script loads:

```html
<script>
  window.AUTH0_DOMAIN = 'dev-xxxxx.us.auth0.com';
  window.AUTH0_CLIENT_ID = 'your-client-id-here';
</script>
<script src="https://cdn.auth0.com/js/auth0-spa-js/2.2/auth0-spa-js.production.js"></script>
```

## Step 7: Deploy to Netlify (2 minutes)

1. Commit and push your changes:
   ```bash
   git add .
   git commit -m "Add Auth0 account system"
   git push
   ```

2. Netlify will automatically deploy

3. Wait for deployment to complete

## Step 8: Test It! (5 minutes)

1. **Visit your live site**
2. **Click "Sign Up"** button in the header
3. **Create an account** with Auth0
4. **You should be redirected back** and see your name in the button
5. **Click "Profile"** in the navigation (should appear when logged in)
6. **Click the button with your name** to logout

## ✅ Verification Checklist

- [ ] Auth0 account created
- [ ] Application created (Single Page Application type)
- [ ] Domain and Client ID copied
- [ ] Callback URLs configured in Auth0
- [ ] Logout URLs configured in Auth0
- [ ] Web Origins configured in Auth0 (CRITICAL!)
- [ ] Environment variables set in Netlify
- [ ] Site deployed
- [ ] Sign up works
- [ ] Sign in works
- [ ] Profile page accessible
- [ ] Logout works
- [ ] Stays logged in after page refresh

## 🐛 Troubleshooting

### "Auth0 configuration missing" error
- **Fix**: Make sure environment variables are set in Netlify Dashboard
- **For local**: Set `window.AUTH0_DOMAIN` and `window.AUTH0_CLIENT_ID` in HTML

### Redirect errors after login
- **Fix**: Check that Callback URLs in Auth0 match your site URL exactly
- **Fix**: Make sure application type is "Single Page Application"

### Logged out after page refresh
- **Fix**: Add your site URL to "Allowed Web Origins" in Auth0 Dashboard
- This is required for silent authentication

### Buttons not showing/working
- **Fix**: Check browser console for errors
- **Fix**: Make sure Auth0 SDK script is loading (check Network tab)

## 🎉 You're Done!

Once all steps are complete, your account system will be fully functional!

**Need help?** Check the browser console for specific error messages.


