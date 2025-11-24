# 🧪 Test Your Auth0 Setup

## Quick Test Checklist

### ✅ Test 1: Local Development (5 minutes)

1. **Start your dev server:**
   ```bash
   npm run dev
   # or
   npx netlify dev
   ```

2. **Open your browser:**
   - Go to http://localhost:8888

3. **Check the console:**
   - Open browser DevTools (F12)
   - Look for Auth0 messages
   - Should see: `[Auth0] Initialized successfully`
   - ❌ If you see "Auth0 configuration missing" → Check your `.env.local` file

4. **Test Sign Up:**
   - Click "Sign Up" button in header
   - Should redirect to Auth0 login page
   - Create a new account
   - Should redirect back to your site
   - Button should show your name (e.g., "✓ John")

5. **Test Profile:**
   - Click "Profile" in navigation (should appear when logged in)
   - Should see your profile page with your info

6. **Test Logout:**
   - Click the button with your name
   - Should log you out
   - Button should change back to "Sign In"

### ✅ Test 2: Production (After Deploy)

1. **Deploy your changes:**
   ```bash
   git add .
   git commit -m "Add Auth0 authentication"
   git push
   ```

2. **Wait for Netlify to deploy** (check Netlify dashboard)

3. **Visit your live site:**
   - Go to https://noteworthynews.co
   - Or https://eloquent-biscochitos-4fbdc5.netlify.app

4. **Test the same flow:**
   - Sign Up → Create account → Should work!
   - Sign In → Login → Should work!
   - Profile → View profile → Should work!
   - Logout → Should work!

## 🐛 Common Issues & Fixes

### Issue: "Auth0 configuration missing"
**Fix:** 
- Check `.env.local` has `AUTH0_DOMAIN` and `AUTH0_CLIENT_ID`
- For production: Check Netlify environment variables are set

### Issue: Redirect errors after login
**Fix:**
- Check Auth0 Dashboard → Your App → Settings
- Verify Callback URLs include your exact site URL
- Make sure application type is "Single Page Application"

### Issue: Logged out after page refresh
**Fix:**
- Check "Allowed Web Origins" in Auth0 Dashboard
- Must include your site URL (no trailing slash)

### Issue: Buttons not showing/working
**Fix:**
- Check browser console for errors
- Make sure Auth0 SDK script is loading
- Check Network tab for failed requests

## ✅ Success Indicators

You'll know it's working when:
- ✅ Sign Up button redirects to Auth0
- ✅ After login, you're redirected back
- ✅ Your name appears in the button
- ✅ Profile link appears in navigation
- ✅ Profile page shows your info
- ✅ Logout works
- ✅ You stay logged in after refresh

## 🎉 You're Done!

If all tests pass, your account system is fully functional!

**Next steps:**
- Customize the profile page
- Add user stats tracking
- Connect game scores to user accounts
- Add user preferences


