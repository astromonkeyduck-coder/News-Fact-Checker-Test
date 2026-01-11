# Quick Start - What You Need to Do

## ✅ Everything is Ready - Just Deploy!

All code is written and verified. You just need to:

### 1. Deploy to Netlify (2 minutes)

**If you use Git:**
```bash
git add .
git commit -m "Fix X/Twitter card previews"
git push
```

**If you don't use Git:**
- Go to Netlify Dashboard → Deploy manually
- Or use: `netlify deploy --prod`

### 2. Verify Environment Variables (1 minute)

Check Netlify Dashboard → Site Settings → Environment Variables:

- ✅ `NETLIFY_SITE_ID` - Should already exist
- ✅ `NETLIFY_BLOB_READ_WRITE_TOKEN` - Should already exist

**If they're missing:** They're usually auto-generated, but you can find them in:
- Site ID: Dashboard → Site Settings → General
- Blob Token: Usually auto-set by Netlify

### 3. Test It Works (2 minutes)

After deployment, run:
```bash
curl -A "Twitterbot/1.0" "https://noteworthynews.co/article.html?id=post-usgs-xxx" | grep "og:image"
```

**Should show:** Generated image URL (not `PREVIEWIMAGEBRUH.jpg`)

### 4. Refresh X Cache (1 minute)

**IMPORTANT**: X caches previews. You MUST refresh:

1. Go to: https://cards-dev.twitter.com/validator
2. Enter: `https://noteworthynews.co/article.html?id=post-usgs-xxx`
3. Click "Preview card"
4. Check if preview shows generated image

## That's It! 🎉

Total time: ~5 minutes

## If Something Doesn't Work

1. **Check Function Logs**: Netlify Dashboard → Functions → article-preview → Logs
2. **Check Redirects**: Netlify Dashboard → Deploys → Latest → Redirects (should show `force: true`)
3. **Use X Card Validator**: Force refresh the cache

## What Changed

- ✅ `netlify.toml` - Added `force=true` (critical fix)
- ✅ `article-preview.js` - Complete rewrite
- ✅ `player.html` - New file for video cards
- ✅ `tools/unfurl-test.js` - Testing tool

Everything else stays the same. Your existing posts, images, and data are unaffected.
