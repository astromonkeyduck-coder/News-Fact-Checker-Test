# Article Preview Status

## Current Implementation

### ✅ What's Implemented:
1. **Edge Function** (`netlify/edge-functions/article-router/index.ts`)
   - Detects crawlers (Twitter, Facebook, etc.)
   - Routes crawlers to `article-preview.js`
   - Routes regular users to static `article.html`

2. **Redirect Rule** (`netlify.toml`)
   - Routes `/article.html` → Edge Function

3. **article-preview.js Function**
   - ✅ Prioritizes GIF > PNG > default images
   - ✅ Checks both `video_url` and `assets.video_url`
   - ✅ Generates correct meta tags
   - ✅ Includes cache-busting on image URLs
   - ✅ Adds relative time to descriptions

### ⚠️ Potential Issues:

1. **Edge Function Static File Serving**
   - Currently uses `context.next()` (if available)
   - Fallback uses client-side redirect (not ideal)
   - **Status**: May need Netlify Edge Functions Pro plan or different approach

2. **Netlify Edge Functions Availability**
   - Edge Functions may require Netlify Pro plan
   - Free tier might not support Edge Functions
   - **Check**: Verify Edge Functions are enabled in your Netlify plan

3. **Redirect Loop Prevention**
   - Edge Function tries to serve static file for regular users
   - If `context.next()` not available, uses fallback redirect
   - **Status**: Should work but may need optimization

## Testing

### To Verify It Works:

1. **Test Edge Function directly**:
   ```bash
   curl -A "Twitterbot/1.0" "https://noteworthynews.co/article.html?id=post-usgs-xxx" | grep "og:image"
   ```
   Should show generated image URL, not `PREVIEWIMAGEBRUH.jpg`

2. **Test Regular User**:
   ```bash
   curl "https://noteworthynews.co/article.html?id=post-usgs-xxx"
   ```
   Should return `article.html` content (not redirect loop)

3. **Use X Card Validator**:
   - Go to: https://cards-dev.twitter.com/validator
   - Enter article URL
   - Check if preview shows generated image

## If Edge Functions Don't Work:

**Alternative Solution**: Remove Edge Function, route ALL requests to `article-preview.js`:
- Modify `article-preview.js` to serve static `article.html` for non-crawlers
- Simpler but requires reading/serving static file in function

## Current Status: **~90% Complete**

- ✅ Code is implemented
- ⚠️ Needs testing to verify Edge Functions work
- ⚠️ May need Netlify Pro plan for Edge Functions
- ⚠️ Fallback redirect for regular users may need improvement
