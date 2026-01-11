# Fix Applied: Card Preview Without Edge Functions

## Problem
Edge Functions are not available on your Netlify plan, so the Edge Function router wasn't working. This meant crawlers were hitting the static `article.html` directly, which has default meta tags, and the client-side JavaScript doesn't run for crawlers.

## Solution Applied

### 1. Removed Edge Function Dependency
- **Deleted**: `netlify/edge-functions/article-router/index.ts`
- **Updated**: `netlify.toml` redirect rule

### 2. Updated Redirect Rule
**Before** (didn't work without Edge Functions):
```toml
[[redirects]]
  from = "/article.html"
  to = "/.netlify/edge-functions/article-router"
```

**After** (works without Edge Functions):
```toml
[[redirects]]
  from = "/article.html"
  to = "/.netlify/functions/article-preview"
```

### 3. Updated article-preview.js
Now handles BOTH crawlers and regular users:

- **For crawlers** (twitterbot, facebookexternalhit, etc.):
  - Serves pre-rendered HTML with correct meta tags
  - Uses generated image/GIF URLs
  - No JavaScript required

- **For regular users**:
  - Reads static `article.html` file using `fs.readFileSync()`
  - Serves the file as-is (allows client-side JS to run)
  - Falls back to fetching from Netlify origin if file read fails

## How It Works Now

1. **ALL requests** to `/article.html` → redirected to `/.netlify/functions/article-preview`
2. **article-preview.js** checks user-agent:
   - **Crawler detected** → Generate pre-rendered HTML with correct meta tags
   - **Regular user** → Serve static `article.html` file

## Testing

### Test Crawler (Should show generated image):
```bash
curl -A "Twitterbot/1.0" "https://noteworthynews.co/article.html?id=post-usgs-xxx" | grep "og:image"
```

### Test Regular User (Should show static HTML):
```bash
curl "https://noteworthynews.co/article.html?id=post-usgs-xxx" | head -20
```

### Use X Card Validator:
1. Go to: https://cards-dev.twitter.com/validator
2. Enter article URL
3. Click "Preview" to force refresh
4. Check if preview shows generated image

## Next Steps

1. **Deploy** the changes
2. **Test** with curl commands above
3. **Use X Card Validator** to refresh cache
4. **Check Netlify logs** for any errors

## Files Changed

- ✅ `netlify.toml` - Updated redirect rule
- ✅ `netlify/functions/article-preview.js` - Added static file serving for regular users
- ✅ `netlify/edge-functions/article-router/index.ts` - Deleted (not needed)

## Expected Behavior

- **X/Twitter crawler** → Gets pre-rendered HTML with generated image in meta tags
- **Regular users** → Get static HTML, client-side JS runs, meta tags update dynamically
- **Preview cards** → Should show generated earthquake images/GIFs
