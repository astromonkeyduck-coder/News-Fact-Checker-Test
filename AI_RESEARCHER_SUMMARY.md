# Card Preview System - Summary for AI Researcher

## 🚨 CRITICAL: Edge Functions Not Available

**The original solution used Edge Functions, but they are NOT available on this Netlify plan.**

## ✅ Solution Applied (No Edge Functions)

### What Was Changed:

1. **Removed Edge Function**:
   - Deleted: `netlify/edge-functions/article-router/index.ts`
   - Updated: `netlify.toml` redirect rule

2. **New Redirect Rule**:
   ```toml
   [[redirects]]
     from = "/article.html"
     to = "/.netlify/functions/article-preview"
     status = 200
   ```

3. **Updated `article-preview.js`**:
   - **For crawlers** (twitterbot, etc.): Serves pre-rendered HTML with correct meta tags
   - **For regular users**: Reads static `article.html` using `fs.readFileSync()` and serves it

## How It Works Now

```
Request → /article.html?id=post-usgs-xxx
    ↓
Netlify Redirect → /.netlify/functions/article-preview?id=post-usgs-xxx
    ↓
article-preview.js checks user-agent:
    ├─ Crawler? → Generate HTML with correct meta tags (GIF/PNG image URLs)
    └─ Regular user? → Read and serve static article.html file
```

## Testing Commands

### Test Crawler (Should show generated image):
```bash
curl -A "Twitterbot/1.0" "https://noteworthynews.co/article.html?id=post-usgs-xxx" | grep "og:image"
```

### Test Regular User (Should show static HTML):
```bash
curl "https://noteworthynews.co/article.html?id=post-usgs-xxx" | head -20
```

## Most Likely Remaining Issues

1. **X Cache (60% probability)**
   - X aggressively caches previews
   - **MUST use Card Validator**: https://cards-dev.twitter.com/validator
   - Force refresh to see updated preview

2. **Post Missing Image URLs (25%)**
   - Check blob storage: Post should have `primary_image_url` and `video_url`
   - Verify images were generated and stored

3. **Image URLs Not Accessible (10%)**
   - Test image URLs directly in browser
   - Should return 200 OK

4. **File Read Failing (5%)**
   - Check Netlify function logs
   - Verify `article.html` is in publish directory

## Key Code Sections

### Image Selection (article-preview.js, lines 207-279):
```javascript
const videoUrl = post.video_url || post.video || post.assets?.video_url || null;
const isGIF = videoUrl && (videoUrl.includes('.gif') || videoUrl.includes('get-uploaded-image'));

let image = null;
if (isGIF && videoUrl) {
  image = videoUrl;  // GIF first
} else if (post.primary_image_url) {
  image = post.primary_image_url;  // PNG second
} else {
  image = post.image_url || post.image || post.images?.[0] || null;
}
if (!image) {
  image = 'https://noteworthynews.co/PREVIEWIMAGEBRUH.jpg';  // Default
}
```

### Static File Serving (article-preview.js, lines 25-80):
```javascript
if (!isCrawler) {
  // Regular users: read static article.html
  const fs = require('fs');
  const path = require('path');
  const articleHtmlPath = path.join(process.cwd(), 'article.html');
  // Try multiple paths...
  const articleHtml = fs.readFileSync(articleHtmlPath, 'utf8');
  return { statusCode: 200, body: articleHtml };
}
```

## Files to Check

1. **`netlify/functions/article-preview.js`** - Main function
2. **`netlify.toml`** - Redirect rule
3. **`article.html`** - Static file (should be in publish directory)
4. **Netlify Blob Storage** - Post objects with image URLs

## Next Steps

1. ✅ Fix applied (routing to article-preview.js)
2. ⏳ Deploy changes
3. ⏳ Test with curl commands
4. ⏳ Use X Card Validator to refresh cache
5. ⏳ Check Netlify logs for errors
6. ⏳ Verify post data in blob storage

## Expected Behavior After Fix

- **X/Twitter crawler** → Gets pre-rendered HTML with generated image in `og:image` meta tag
- **Regular users** → Get static HTML, client-side JS runs, meta tags update
- **Preview cards** → Should show generated earthquake images/GIFs (after cache refresh)
