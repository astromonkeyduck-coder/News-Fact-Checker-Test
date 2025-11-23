# 🔍 How to Find Your Netlify URL

## Method 1: Netlify Dashboard (Easiest)

1. **Go to Netlify Dashboard**
   - Visit https://app.netlify.com
   - Sign in if needed

2. **Find Your Site**
   - You'll see a list of your sites
   - Click on your site name (probably "breaking-news-game" or similar)

3. **Your URL is Right There!**
   - At the top of the page, you'll see your site URL
   - It looks like: `https://your-site-name.netlify.app`
   - Or if you have a custom domain: `https://noteworthynews.co` (based on your code)

## Method 2: Check Your Site Settings

1. In Netlify Dashboard → Your Site
2. Go to **Site settings** → **General**
3. Look for **"Site details"**
4. Your URL is listed there

## Method 3: Check Your Custom Domain

Based on your code, you might be using:
- **`https://noteworthynews.co`** (if you have a custom domain set up)

You can check this in:
- Netlify Dashboard → Your Site → **Domain settings**

## Method 4: Check Your Git Repository

If your site is connected to GitHub/GitLab:
1. Go to your repository
2. Check the README or any deployment badges
3. They often show the live URL

## What URL to Use in Auth0?

Use **BOTH** if you have them:

1. **Your Netlify URL**: `https://your-site-name.netlify.app`
2. **Your Custom Domain** (if you have one): `https://noteworthynews.co`

### For Auth0 Configuration:

**Allowed Callback URLs:**
```
https://your-site-name.netlify.app/
https://your-site-name.netlify.app/index.html
https://noteworthynews.co/
https://noteworthynews.co/index.html
http://localhost:8888/
http://localhost:8888/index.html
```

**Allowed Logout URLs:**
```
https://your-site-name.netlify.app/
https://your-site-name.netlify.app/index.html
https://noteworthynews.co/
https://noteworthynews.co/index.html
http://localhost:8888/
http://localhost:8888/index.html
```

**Allowed Web Origins:**
```
https://your-site-name.netlify.app
https://noteworthynews.co
http://localhost:8888
```

## Quick Check: Visit Your Site

The easiest way to find your URL:
1. Go to https://app.netlify.com
2. Click your site
3. Click **"Open production deploy"** or **"Visit site"**
4. Copy the URL from your browser's address bar

That's your Netlify URL! 🎉

