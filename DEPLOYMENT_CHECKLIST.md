# Card Preview System - Deployment Checklist

## ✅ What's Already Done

- ✅ Code implemented and verified
- ✅ `force=true` redirects added to `netlify.toml`
- ✅ Function router created
- ✅ All features implemented

## 📋 What You Need to Do

### 1. Deploy to Netlify (REQUIRED)

**The code changes need to be deployed for them to take effect.**

```bash
# If using Git:
git add .
git commit -m "Fix X/Twitter card previews with force=true redirects"
git push

# Netlify will automatically deploy
```

Or deploy manually via Netlify Dashboard → Deploys → Trigger deploy

### 2. Verify Environment Variables (REQUIRED)

The function needs these environment variables in Netlify:

**Check Netlify Dashboard → Site Settings → Environment Variables:**

- ✅ `NETLIFY_SITE_ID` - Your Netlify site ID
- ✅ `NETLIFY_BLOB_READ_WRITE_TOKEN` - Blob storage access token

**If missing**, the function will return 500 errors. These should already be set if your site is working, but verify they exist.

### 3. Test After Deployment (REQUIRED)

**Wait 2-3 minutes after deployment, then test:**

```bash
# Test Twitter bot (should show generated image URL)
curl -A "Twitterbot/1.0" "https://noteworthynews.co/article.html?id=post-usgs-xxx" | grep "og:image"

# Should show something like:
# <meta property="og:image" content="https://noteworthynews.co/.../image.png?_v=...">
# NOT: https://noteworthynews.co/PREVIEWIMAGEBRUH.jpg
```

### 4. Refresh X/Twitter Cache (REQUIRED)

**X aggressively caches previews. Even with correct meta tags, you MUST refresh the cache:**

1. Go to: https://cards-dev.twitter.com/validator
2. Enter your article URL: `https://noteworthynews.co/article.html?id=post-usgs-xxx`
3. Click "Preview card" or "Validate"
4. This forces X to re-scrape and update the preview

**Important**: You may need to do this for each article URL that was previously shared.

### 5. Verify Function is Being Called (OPTIONAL BUT RECOMMENDED)

**Check Netlify Dashboard → Functions → article-preview → Logs:**

Look for:
- `[article-preview] Request:` logs showing requests
- `[article-preview] 📸 Image selection:` logs showing image selection
- Should see `isBot: true` for crawler requests

If you don't see any logs, the function might not be getting called (check redirects).

## 🚨 Common Issues & Quick Fixes

### Issue: Preview Still Shows Default Image

**Possible Causes:**
1. **X Cache** (most likely) → Use Card Validator to refresh
2. **Function not deployed** → Check deployment status
3. **Redirect not active** → Verify `force=true` in `netlify.toml`
4. **Post missing image URLs** → Check blob storage

**Quick Check:**
```bash
# Test if function is being called
curl -I "https://noteworthynews.co/article.html?id=test"
# Should show redirect to /.netlify/functions/article-preview
```

### Issue: Function Returns 500 Error

**Check:**
- Environment variables are set (NETLIFY_SITE_ID, NETLIFY_BLOB_READ_WRITE_TOKEN)
- Blob storage is accessible
- Check Netlify function logs for specific error

### Issue: Regular Users Getting Prerendered HTML

**Check:**
- Bot detection is working (check logs for `isBot: false`)
- User-Agent is being passed correctly
- Function logic is correct (should return ARTICLE_PAGE_SHELL for regular users)

## ✅ Success Criteria

After deployment, you should see:

1. ✅ **Crawlers** get prerendered HTML with generated images
2. ✅ **Regular users** get interactive article page
3. ✅ **X Card Validator** shows generated image (after refresh)
4. ✅ **Netlify logs** show function being called
5. ✅ **No 500 errors** in function logs

## 📝 Quick Test Script

After deployment, run this to verify everything:

```bash
# 1. Test Twitter bot
echo "Testing Twitter bot..."
curl -A "Twitterbot/1.0" "https://noteworthynews.co/article.html?id=post-usgs-xxx" | grep "og:image"

# 2. Test regular user
echo "Testing regular user..."
curl "https://noteworthynews.co/article.html?id=post-usgs-xxx" | head -5

# 3. Run full test suite (if you have a real article ID)
node tools/unfurl-test.js "https://noteworthynews.co/article.html?id=post-usgs-xxx"
```

## 🎯 Next Steps

1. **Deploy** the changes (git push or manual deploy)
2. **Wait 2-3 minutes** for deployment to complete
3. **Test** with curl commands above
4. **Use X Card Validator** to refresh cache
5. **Check Netlify logs** to verify function is working
6. **Share a test article** on X/Twitter to verify preview

## ⚠️ Important Notes

- **X Cache**: X caches previews aggressively. Even with correct meta tags, you MUST use Card Validator to refresh.
- **First Time**: The first time X crawls after deployment, it may take a few minutes.
- **Old Links**: Previously shared links may still show old previews until cache expires or you refresh them.
- **New Links**: New links shared after deployment should work immediately (after X crawls them).

## 📞 Need Help?

If previews still don't work after deployment:

1. Check Netlify function logs for errors
2. Verify environment variables are set
3. Test with curl commands to see what's being returned
4. Use X Card Validator to see what X is seeing
5. Check if posts in blob storage have `primary_image_url` or `video_url`

---

**Status**: Code is ready. Just needs deployment and cache refresh! 🚀
