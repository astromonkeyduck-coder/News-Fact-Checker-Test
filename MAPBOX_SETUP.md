# Mapbox Setup Guide

## Cost Information

**Mapbox has a generous free tier:**
- ✅ **50,000 static image requests per month** (FREE)
- 💰 After free tier: $0.50 per 1,000 requests

**For earthquake alerts:**
- Each earthquake generates 2 satellite images (regional + local)
- If you get 100 earthquakes/month = 200 images = **well within free tier**
- Even 1,000 earthquakes/month = 2,000 images = **still free**

**Bottom line:** You'll likely never pay anything unless you have extremely high traffic.

---

## Step 1: Get Mapbox Account & Token

1. **Sign up for free account:**
   - Go to: https://account.mapbox.com/auth/signup/
   - Use email or GitHub/Google sign-in
   - No credit card required for free tier

2. **Get your access token:**
   - After signing up, go to: https://account.mapbox.com/access-tokens/
   - You'll see a "Default public token" (starts with `pk.eyJ...`)
   - Click the copy icon to copy it
   - **Keep this token secret** (don't commit to git)

---

## Step 2: Add Token to Netlify

1. **Go to Netlify Dashboard:**
   - https://app.netlify.com
   - Select your site

2. **Navigate to Environment Variables:**
   - Site Settings → Environment Variables
   - Or: Site Settings → Build & deploy → Environment

3. **Add the variable:**
   - Click **"Add a variable"**
   - **Key:** `MAPBOX_TOKEN`
   - **Value:** Paste your Mapbox token (starts with `pk.eyJ...`)
   - **Scopes:** Select "All scopes" (or at least "Production" and "Deploy previews")
   - Click **"Save"**

4. **Redeploy your site:**
   - Go to Deploys tab
   - Click "Trigger deploy" → "Deploy site"
   - This ensures the new environment variable is available

---

## Step 3: Verify It Works

After deploying, check your function logs:

1. Go to Netlify Dashboard → Functions → `generate-earthquake-image`
2. Look for logs like:
   ```
   [generateMapboxSatelliteImage] 📡 Requesting Mapbox satellite image
   [generateMapboxSatelliteImage] ✅ Mapbox satellite image fetched
   ```

If you see errors like:
- `MAPBOX_TOKEN not set` → Token not added correctly
- `401 Unauthorized` → Invalid token
- `403 Forbidden` → Token doesn't have correct permissions

---

## Local Development

For local testing, create `.env.local` file in project root:

```bash
MAPBOX_TOKEN=pk.eyJ...your-token-here
```

The test scripts (`test-image-generation-strict.js`) will automatically load this.

---

## Token Security

- ✅ **Safe to use in Netlify Functions** (server-side only)
- ✅ **Token is never exposed to client-side code**
- ⚠️ **Don't commit token to git** (use `.env.local` and add to `.gitignore`)
- ⚠️ **Don't share token publicly**

---

## Usage Monitoring

Monitor your usage:
1. Go to: https://account.mapbox.com/account/usage/
2. Check "Static Images" usage
3. You'll see how many requests you've used this month

---

## Troubleshooting

**Problem:** "MAPBOX_TOKEN not set"
- **Fix:** Make sure you added it in Netlify Dashboard → Environment Variables
- **Fix:** Redeploy your site after adding the variable

**Problem:** "401 Unauthorized"
- **Fix:** Check that your token is correct (starts with `pk.eyJ...`)
- **Fix:** Make sure you copied the entire token

**Problem:** "403 Forbidden"
- **Fix:** Make sure you're using a "Public" token, not a "Secret" token
- **Fix:** Check token permissions in Mapbox dashboard

**Problem:** Images not loading
- **Fix:** Check Netlify function logs for specific error messages
- **Fix:** Verify token is set correctly (see above)

---

## Alternative: Skip Mapbox (Use Location Cards)

If you don't want to set up Mapbox right now, the system will automatically fall back to simple location card images (SVG → PNG) when Mapbox is unavailable. These won't look as professional but will still work.

To force location cards only, simply don't set `MAPBOX_TOKEN` - the code will automatically use the fallback.

