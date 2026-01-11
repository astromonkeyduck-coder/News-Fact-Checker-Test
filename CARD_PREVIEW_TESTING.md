# Card Preview System - Testing Guide

## Quick Test Commands

### Test Twitter Bot Preview
```bash
curl -A "Twitterbot/1.0" "https://noteworthynews.co/article.html?id=post-usgs-xxx" | grep -i "og:image"
```

Should show generated image URL (not `PREVIEWIMAGEBRUH.jpg`).

### Test Regular User
```bash
curl "https://noteworthynews.co/article.html?id=post-usgs-xxx" | head -20
```

Should show interactive article page HTML.

### Test with Unfurl Test Script
```bash
node tools/unfurl-test.js "https://noteworthynews.co/article.html?id=post-usgs-xxx"
```

Tests multiple user agents and shows which images they see.

### Test Player Card
```bash
curl -A "Twitterbot/1.0" "https://noteworthynews.co/article.html?id=post-usgs-xxx&card=player" | grep -i "twitter:card"
```

Should show `twitter:card` = `player` if MP4 exists.

## X/Twitter Card Validator

**IMPORTANT**: X aggressively caches previews. Even if meta tags are correct, you must use the Card Validator to refresh the cache.

1. Go to: https://cards-dev.twitter.com/validator
2. Enter article URL: `https://noteworthynews.co/article.html?id=post-usgs-xxx`
3. Click "Preview" to force refresh
4. Check if preview shows generated image

## Verifying Function is Working

### Check Netlify Logs
1. Go to Netlify Dashboard → Functions → article-preview
2. Look for logs showing:
   - `[article-preview] Request:` with `isBot: true/false`
   - `[article-preview] 📸 Image selection:` with image source
   - Should NOT see `PREVIEWIMAGEBRUH.jpg` in image selection for posts with images

### Verify Redirect is Active
```bash
curl -I "https://noteworthynews.co/article.html?id=test"
```

Should show redirect to `/.netlify/functions/article-preview` (check Location header).

## Expected Behavior

### For Crawlers (Twitterbot, etc.)
- ✅ Get prerendered HTML with correct `og:image` and `twitter:image` meta tags
- ✅ Image URL points to generated PNG/GIF (not default)
- ✅ For Twitter: Prefers PNG over GIF (GIFs don't animate in previews)
- ✅ For other platforms: Can use GIF

### For Regular Users
- ✅ Get interactive article page (embedded shell template)
- ✅ Client-side JavaScript runs (`article-loader.js`)
- ✅ Meta tags update dynamically
- ✅ Full article content loads

### For Player Cards
- ✅ If `card=player` and MP4 exists: Returns `twitter:card=player`
- ✅ Player URL points to `/player.html?id=...`
- ✅ Thumbnail image is PNG (not GIF)
- ✅ If MP4 missing: Automatically downgrades to `summary_large_image`

## Troubleshooting

### Preview Still Shows Default Image

1. **Check X Cache**: Use Card Validator to force refresh
2. **Verify Image URLs**: Test image URLs directly in browser (should return 200 OK)
3. **Check Post Data**: Verify post in blob storage has `primary_image_url` or `video_url`
4. **Check Function Logs**: Look for image selection logs in Netlify

### Function Not Being Called

1. **Check Redirect Rule**: Verify `force=true` in `netlify.toml`
2. **Check Deployment**: Ensure latest code is deployed
3. **Test Redirect**: Use `curl -I` to verify redirect is active

### Regular Users Getting Prerendered HTML

1. **Check User-Agent Detection**: Function should detect regular browsers
2. **Check Mode Parameter**: Ensure `mode=page` if needed
3. **Check Function Logs**: Look for `isBot: false` in logs

## Query Parameters

- `id` (required): Article ID (e.g., `post-usgs-xxx`)
- `mode` (optional): `preview` (force prerender) | `page` (force interactive) | `auto` (default, detect from user-agent)
- `card` (optional): `summary` (default) | `player` (for MP4 videos)

## Examples

### Force Prerender for Testing
```
https://noteworthynews.co/article.html?id=post-usgs-xxx&mode=preview
```

### Force Interactive Page
```
https://noteworthynews.co/article.html?id=post-usgs-xxx&mode=page
```

### Request Player Card
```
https://noteworthynews.co/article.html?id=post-usgs-xxx&card=player
```
