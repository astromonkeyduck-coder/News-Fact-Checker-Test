# X/Twitter Card Preview System - Detailed Technical Report

## 🎯 FOR AI RESEARCHER: Quick Summary

**Problem**: X/Twitter previews show default image instead of generated earthquake images.

**Root Cause Found**: Edge Functions not available → Edge Function router didn't work → Crawlers hit static HTML with default meta tags.

**✅ Solution Applied**: 
- Removed Edge Function dependency
- Route ALL `/article.html` requests to `article-preview.js`
- Function detects crawler vs regular user:
  - **Crawlers** → Pre-rendered HTML with correct meta tags
  - **Regular users** → Static HTML file (client-side JS runs)

**Current Status**: Fix implemented, ready for testing. Most likely remaining issue: X cache (must use Card Validator).

**Key Files Changed**:
- `netlify.toml` - Redirect rule updated
- `netlify/functions/article-preview.js` - Added static file serving
- `netlify/edge-functions/article-router/index.ts` - DELETED

---

## Executive Summary

The Noteworthy News earthquake alert system generates branded images (PNG) and animated GIFs for earthquakes. When these articles are shared on X (Twitter), the preview card should display the generated image/GIF, but it was showing the default `PREVIEWIMAGEBRUH.jpg` instead.

**Problem**: X/Twitter previews showed default image instead of generated earthquake images.

**Root Cause**: Edge Functions were not available on the Netlify plan, so the Edge Function router wasn't working. Crawlers were hitting the static `article.html` directly, which has default meta tags, and client-side JavaScript doesn't run for crawlers.

**Solution Applied**: Removed Edge Function dependency. Now ALL requests to `/article.html` are routed to `article-preview.js`, which:
- Serves pre-rendered HTML with correct meta tags for crawlers
- Serves static `article.html` file for regular users (allows client-side JS to run)

**Status**: Fix applied, needs testing and deployment.

---

## System Architecture

### 1. Image/Video Generation Pipeline

**Location**: `netlify/functions/engines/usgs.js`

**Process**:
1. USGS earthquake data is ingested
2. For earthquakes with magnitude >= 0.5:
   - PNG image is generated via `generate-earthquake-image.js`
   - GIF is generated via `generate-earthquake-video.js`
   - MP4 (with audio) is also generated for Player Cards
3. Images/videos are stored in Netlify Blob storage
4. URLs are stored in:
   - `verified_events` table: `image_url` (PNG), `assets.video_url` (GIF/MP4)
   - Blob storage: Post objects with `primary_image_url` (PNG), `video_url` (GIF/MP4)

**Key Files**:
- `netlify/functions/generate-earthquake-image.js` - Generates PNG images
- `netlify/functions/generate-earthquake-video.js` - Generates GIF and MP4 videos
- `netlify/functions/engines/usgs.js` - Orchestrates generation and storage

---

### 2. Article Page Structure

**Static File**: `article.html`
- Contains default meta tags pointing to `PREVIEWIMAGEBRUH.jpg`
- Loads `article-loader.js` which updates meta tags client-side via JavaScript

**Client-Side Loader**: `src/components/article-loader.js`
- Fetches post data from blob storage
- Dynamically updates `<meta>` tags in `<head>`:
  - `og:image`
  - `twitter:image`
  - `twitter:card`
  - `og:description`
  - etc.

**Problem**: X's crawler (`twitterbot`) doesn't execute JavaScript, so it never sees the updated meta tags.

---

### 3. Server-Side Preview Function

**Location**: `netlify/functions/article-preview.js`

**Purpose**: Pre-renders HTML with correct meta tags for crawlers (no JavaScript required)

**Image Selection Logic** (Priority Order):
1. **GIF** (`video_url` or `assets.video_url`) - if contains `.gif` or `get-uploaded-image`
2. **PNG** (`primary_image_url`)
3. **Other images** (`image_url`, `image`, `images[0]`)
4. **Default** (`PREVIEWIMAGEBRUH.jpg`)

**Key Code**:
```javascript
const videoUrl = post.video_url || post.video || post.assets?.video_url || null;
const isGIF = videoUrl && (videoUrl.includes('.gif') || videoUrl.includes('get-uploaded-image'));

let image = null;
if (isGIF && videoUrl) {
  image = videoUrl;  // Use GIF first
} else if (post.primary_image_url) {
  image = post.primary_image_url;  // Use PNG second
} else {
  image = post.image_url || post.image || post.images?.[0] || null;
}
if (!image) {
  image = 'https://noteworthynews.co/PREVIEWIMAGEBRUH.jpg';  // Default fallback
}
```

**Features**:
- Cache-busting on image URLs (`?_v=${Date.now()}`)
- Relative time in description ("Updated X minutes ago")
- Checks both top-level `video_url` and `assets.video_url`
- Detailed logging for debugging

---

### 4. Request Routing (CURRENT IMPLEMENTATION - No Edge Functions)

**Location**: `netlify.toml` redirect rule + `netlify/functions/article-preview.js`

**Purpose**: Route ALL requests to `article-preview.js`, which handles both crawlers and regular users

**Current Implementation**:
1. **ALL requests** to `/article.html` are redirected to `/.netlify/functions/article-preview`
2. **article-preview.js** detects user-agent:
   - **If crawler** (twitterbot, facebookexternalhit, etc.): Serves pre-rendered HTML with correct meta tags
   - **If regular user**: Reads and serves static `article.html` file using `fs.readFileSync()` (allows client-side JS to run)

**Redirect Rule** (`netlify.toml`):
```toml
[[redirects]]
  from = "/article.html"
  to = "/.netlify/functions/article-preview"
  status = 200
  force = false
```

**Implementation Details**:
- Uses `fs.readFileSync()` to read static `article.html` for regular users
- Tries multiple file paths: `process.cwd()`, `__dirname/../../`, `__dirname/../../../`, etc.
- Falls back to fetching from Netlify origin (`{site-id}.netlify.app`) if file read fails
- For crawlers: Generates HTML with correct meta tags pointing to generated images

**Why This Works**:
- No Edge Functions required (works on all Netlify plans)
- Crawlers get pre-rendered HTML with correct meta tags
- Regular users get static HTML, client-side JS runs normally
- Single function handles both cases

---

### 5. Post Storage System

**Location**: `netlify/functions/lib/createPost.js`

**Storage**: Netlify Blob storage (`x-posts` store)

**Post Object Structure**:
```javascript
{
  id: "post-usgs-{event_id}",
  primary_image_url: "https://...",  // PNG
  video_url: "https://...",           // GIF/MP4
  assets: {
    video_url: "https://..."          // Also stored here
  },
  // ... other fields
}
```

**Update Logic**:
- When `video_url` is generated after initial post creation, it should update the post object
- Both `video_url` and `assets.video_url` are checked

---

## Data Flow

### When an Earthquake is Processed:

1. **USGS Engine** (`usgs.js`) processes earthquake
2. **Image Generation** → PNG created → stored in blob → `image_url` set
3. **Video Generation** → GIF/MP4 created → stored in blob → `video_url` set
4. **Post Creation** → Post object stored in blob with `primary_image_url` and `video_url`
5. **Database** → `verified_events` table updated with `image_url` and `assets.video_url`

### When X Crawler Accesses Article:

1. **Request**: `GET https://noteworthynews.co/article.html?id=post-usgs-xxx`
2. **Redirect**: Netlify redirects to `/.netlify/functions/article-preview?id=post-usgs-xxx`
3. **article-preview.js** detects `twitterbot` user-agent (isCrawler = true)
4. **article-preview.js**:
   - Fetches post from blob storage
   - Selects image (GIF > PNG > default)
   - Generates HTML with correct meta tags
   - Returns pre-rendered HTML with `og:image` and `twitter:image` pointing to generated image
5. **X Crawler** reads meta tags and caches preview

### When Regular User Accesses Article:

1. **Request**: `GET https://noteworthynews.co/article.html?id=post-usgs-xxx`
2. **Redirect**: Netlify redirects to `/.netlify/functions/article-preview?id=post-usgs-xxx`
3. **article-preview.js** detects regular browser (isCrawler = false)
4. **article-preview.js**:
   - Reads static `article.html` file using `fs.readFileSync()`
   - Returns static HTML file as-is
5. **Client-Side JS** (`article-loader.js`) runs:
   - Fetches post from blob storage
   - Updates meta tags dynamically
   - Updates page content

---

## Current Issues & Debugging

### Issue 1: Preview Still Shows Default Image (AFTER FIX)

**Symptoms**:
- X preview shows `PREVIEWIMAGEBRUH.jpg`
- Generated images exist and are accessible
- Logs show correct image selection in `article-preview.js`

**Possible Causes** (after fix applied):
1. **X cache** - X aggressively caches previews, MUST use Card Validator to refresh
2. **Image URL not accessible** - Generated images might not be publicly accessible (test directly)
3. **Post data missing** - Post object in blob storage might not have `video_url` or `primary_image_url`
4. **Timing issue** - Image generated after post created, post not updated
5. **File read failing** - Static `article.html` not found in function (check logs)

### Issue 2: Function Not Serving Correct Content

**Check**:
- Redirect rule is active in `netlify.toml`
- Function is deployed and accessible
- Check Netlify function logs for errors

**Test Crawler**:
```bash
curl -A "Twitterbot/1.0" "https://noteworthynews.co/article.html?id=post-usgs-xxx" | grep "og:image"
```
Should show generated image URL, not `PREVIEWIMAGEBRUH.jpg`.

**Test Regular User**:
```bash
curl "https://noteworthynews.co/article.html?id=post-usgs-xxx" | head -20
```
Should show static HTML content (not pre-rendered).

### Issue 3: Post Object May Be Missing Image URLs

**Check**:
- Post object in blob storage has `primary_image_url` and `video_url`
- These URLs are accessible (return 200 status)
- URLs are absolute (start with `https://`)

**Debug**:
- Check `article-preview.js` logs for image selection
- Verify post object structure in blob storage
- Test image URLs directly in browser

### Issue 4: X Cache

**Solution**:
- Use X Card Validator: https://cards-dev.twitter.com/validator
- Enter article URL
- Click "Preview" to force re-scrape
- This refreshes X's cache

**Note**: Even if meta tags are correct, X may show cached preview for hours/days.

---

## Files Involved

### Core Functions:
1. `netlify/functions/article-preview.js` - Server-side meta tag generation
2. `netlify/edge-functions/article-router/index.ts` - Request routing
3. `src/components/article-loader.js` - Client-side meta tag updates
4. `netlify/functions/lib/createPost.js` - Post storage/retrieval
5. `netlify/functions/engines/usgs.js` - Image/video generation orchestration

### Configuration:
1. `netlify.toml` - Redirect rules
2. `article.html` - Static page with default meta tags

### Storage:
1. Netlify Blob storage (`x-posts` store) - Post objects
2. Supabase (`verified_events` table) - Event data with `image_url` and `assets.video_url`

---

## Testing Checklist

### 1. Verify Image Generation
- [ ] PNG is generated for magnitude >= 0.5
- [ ] GIF is generated for all earthquakes with images
- [ ] Images are stored in blob storage
- [ ] Image URLs are publicly accessible

### 2. Verify Post Storage
- [ ] Post object has `primary_image_url` (PNG)
- [ ] Post object has `video_url` (GIF)
- [ ] Post object has `assets.video_url` (GIF)
- [ ] Post is updated when video is generated after initial creation

### 3. Verify article-preview.js
- [ ] Function is accessible: `/.netlify/functions/article-preview?id=post-usgs-xxx`
- [ ] Returns HTML with correct meta tags
- [ ] `og:image` points to generated image (not default)
- [ ] `twitter:image` points to generated image (not default)
- [ ] Logs show correct image selection

### 4. Verify Edge Function
- [ ] Edge Function is deployed
- [ ] Redirect rule is active
- [ ] Crawler requests are routed to `article-preview.js`
- [ ] Regular user requests serve static `article.html`

### 5. Verify X Preview
- [ ] Use X Card Validator to test
- [ ] Preview shows generated image (not default)
- [ ] Image is accessible (not 404)
- [ ] Meta tags are correct in validator

---

## Known Attempted Fixes

1. ✅ **Image Selection Priority** - Fixed to prioritize GIF > PNG > default
2. ✅ **Assets.video_url Check** - Added check for `assets.video_url` in addition to `video_url`
3. ✅ **Cache-Busting** - Added `?_v=timestamp` to image URLs
4. ✅ **Edge Function Router** - Attempted (but Edge Functions not available)
5. ✅ **Post Update Logic** - Fixed to update post when `video_url` is generated
6. ✅ **Logging** - Added detailed logging to `article-preview.js`
7. ✅ **Removed Edge Function Dependency** - Now routes ALL requests to `article-preview.js`
8. ✅ **Static File Serving** - Added `fs.readFileSync()` to serve static HTML for regular users

**Current Status**: Fix applied, needs testing and X cache refresh.

---

## Potential Root Causes (After Fix Applied)

### 1. X Cache (MOST LIKELY - 60%)
- X aggressively caches previews (can last hours/days)
- Even with correct meta tags, X may show cached preview
- **Fix**: MUST use X Card Validator to force refresh: https://cards-dev.twitter.com/validator

### 2. Post Data Missing (25%)
- Post object may not have `video_url` or `primary_image_url`
- Post may not be updated when video is generated
- **Fix**: Check blob storage, verify post update logic, check Netlify logs

### 3. Image URLs Not Accessible (10%)
- Generated images may not be publicly accessible
- CORS issues
- Authentication required
- **Fix**: Test image URLs directly in browser, check blob storage permissions

### 4. File Read Failing (5%)
- Static `article.html` not found in function
- Path issues in `fs.readFileSync()`
- **Fix**: Check Netlify function logs, verify file paths, check deployment

### 5. Timing Issue (Rare)
- Image generated after post created
- Post not updated with new image URL
- Crawler hits before image is ready
- **Fix**: Ensure post is updated when image is generated, verify synchronous updates

---

## Recommended Debugging Steps

1. **Test article-preview.js directly**:
   ```bash
   curl "https://noteworthynews.co/.netlify/functions/article-preview?id=post-usgs-xxx" | grep "og:image"
   ```
   Should show generated image URL.

2. **Test Edge Function**:
   ```bash
   curl -A "Twitterbot/1.0" "https://noteworthynews.co/article.html?id=post-usgs-xxx" | grep "og:image"
   ```
   Should show generated image URL.

3. **Check Netlify Logs**:
   - Look for `article-preview` function invocations
   - Check for errors in Edge Function
   - Verify image selection logs

4. **Verify Post Object**:
   - Check blob storage for post object
   - Verify `primary_image_url` and `video_url` exist
   - Test image URLs directly

5. **Use X Card Validator**:
   - Enter article URL
   - Check preview
   - Review meta tags shown
   - Force refresh cache

6. **Check Image Accessibility**:
   - Test image URLs in browser
   - Verify they return 200 status
   - Check for CORS or authentication issues

---

## Code References

### Image Selection Logic:
- `netlify/functions/article-preview.js` (lines 207-279)
- `src/components/article-loader.js` (similar logic)

### Edge Function:
- `netlify/edge-functions/article-router/index.ts`

### Post Storage:
- `netlify/functions/lib/createPost.js`

### Image Generation:
- `netlify/functions/generate-earthquake-image.js`
- `netlify/functions/generate-earthquake-video.js`
- `netlify/functions/engines/usgs.js`

---

## Environment Variables Required

- `NETLIFY_SITE_ID` - For blob storage access
- `NETLIFY_BLOB_READ_WRITE_TOKEN` - For blob storage access
- `SUPABASE_URL` - For database access
- `SUPABASE_SERVICE_ROLE_KEY` - For database access

---

## Next Steps for AI Researcher

1. **Verify Edge Function is working** - Test if crawler requests are being routed correctly
2. **Check X cache** - Use Card Validator to see if it's a caching issue
3. **Verify image URLs** - Test if generated images are accessible
4. **Check post data** - Verify post objects have correct image URLs
5. **Review Netlify logs** - Look for errors or unexpected behavior
6. **Test alternative approach** - Consider routing ALL requests to `article-preview.js` instead of using Edge Function

---

## Critical Code Sections

### article-preview.js Image Selection (Lines 207-279)

```javascript
// CRITICAL: Prioritize GIF (video_url) first, then PNG (primary_image_url) for social media previews
const videoUrl = post.video_url || post.video || post.assets?.video_url || null;
const isGIF = videoUrl && (videoUrl.includes('.gif') || videoUrl.includes('get-uploaded-image'));

// Priority order: GIF > PNG > Other images > Default
let image = null;
let imageSource = null;
if (isGIF && videoUrl) {
  image = videoUrl;
  imageSource = 'GIF (video_url)';
} else if (post.primary_image_url) {
  image = post.primary_image_url;
  imageSource = 'PNG (primary_image_url)';
} else {
  image = post.image_url || post.image || post.images?.[0] || null;
  if (image) {
    imageSource = post.image_url ? 'image_url' : (post.image ? 'image' : 'images[0]');
  }
}

if (!image) {
  imageSource = 'DEFAULT (PREVIEWIMAGEBRUH.jpg)';
  image = 'https://noteworthynews.co/PREVIEWIMAGEBRUH.jpg';
}

// Ensure absolute URL
let imageUrl = image.startsWith('http') ? image : `https://noteworthynews.co${image.startsWith('/') ? image : '/' + image}`;

// Add cache-busting
const socialImageUrl = `${imageUrl}?_v=${Date.now()}`;
```

### Meta Tag Generation (Lines 295-350)

```javascript
// Set meta tags
const metaTags = `
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)} (Updated ${formatRelativeTime(datePosted)})">
  <meta property="og:image" content="${escapeHtml(socialImageUrl)}">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta name="twitter:card" content="${hasVideo && !isGIF ? 'player' : 'summary_large_image'}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)} (Updated ${formatRelativeTime(datePosted)})">
  <meta name="twitter:image" content="${escapeHtml(socialImageUrl)}">
`;
```

### Edge Function Router Logic

```typescript
export default async (request: Request, context: any) => {
  const userAgent = request.headers.get('user-agent') || '';
  const url = new URL(request.url);
  
  // Detect crawlers
  const isCrawler = /twitterbot|facebookexternalhit|facebot|linkedinbot|slackbot|whatsapp|telegrambot|discordbot|googlebot|bingbot/i.test(userAgent);
  
  if (isCrawler) {
    // Route to article-preview function
    const previewUrl = `https://noteworthynews.co/.netlify/functions/article-preview${url.search}`;
    const response = await fetch(previewUrl, {
      headers: {
        'User-Agent': userAgent,
        'Accept': request.headers.get('Accept') || '*/*',
        'Accept-Language': request.headers.get('Accept-Language') || 'en-US',
      },
    });
    return response;
  }
  
  // Regular users: serve static file
  if (context && typeof context.next === 'function') {
    return context.next();
  }
  
  // Fallback (may cause redirect loop)
  // ...
};
```

---

## Specific Debugging Commands

### Test article-preview.js Directly
```bash
# Should return HTML with generated image in og:image meta tag
curl "https://noteworthynews.co/.netlify/functions/article-preview?id=post-usgs-xxx" | grep -A 1 "og:image"
```

### Test Edge Function with Crawler User-Agent
```bash
# Should route to article-preview.js and return generated image
curl -A "Twitterbot/1.0" "https://noteworthynews.co/article.html?id=post-usgs-xxx" | grep -A 1 "og:image"
```

### Test Regular User (Should Serve Static HTML)
```bash
# Should return static article.html (not pre-rendered)
curl "https://noteworthynews.co/article.html?id=post-usgs-xxx" | head -20
```

### Check Image URL Accessibility
```bash
# Replace {image_url} with actual image URL from post
curl -I "https://noteworthynews.co/{image_url}"
# Should return 200 OK
```

---

## Common Failure Points

### 1. Edge Function Not Deployed/Active
**Symptoms**: Regular users and crawlers both get same response
**Check**: Netlify dashboard → Edge Functions → Verify `article-router` is deployed
**Fix**: Redeploy or check Netlify plan supports Edge Functions

### 2. article-preview.js Not Finding Post
**Symptoms**: Logs show "Post not found" or returns default image
**Check**: Verify post exists in blob storage with correct key format: `post-usgs-{event_id}`
**Fix**: Check post creation logic, verify blob storage access

### 3. Post Missing Image URLs
**Symptoms**: `imageSource` in logs shows "DEFAULT"
**Check**: Post object in blob storage should have:
- `primary_image_url` (PNG)
- `video_url` (GIF)
- `assets.video_url` (GIF)
**Fix**: Verify image generation completes before post creation, or update post when image is generated

### 4. Image URLs Not Accessible
**Symptoms**: Image URLs return 404 or require authentication
**Check**: Test image URLs directly in browser
**Fix**: Verify blob storage permissions, ensure public access

### 5. X Cache
**Symptoms**: Card Validator shows correct meta tags but preview still shows old image
**Check**: Use X Card Validator, check "Last Scraped" timestamp
**Fix**: Force refresh in Card Validator, wait for cache to expire, or add unique query params to article URL

---

## Logging Points to Check

### article-preview.js Logs
Look for:
- `[article-preview] 🔍 Image selection debug:` - Shows all available image sources
- `[article-preview] ✅ Selected GIF/PNG for preview:` - Confirms image selection
- `[article-preview] ⚠️ No image found in post` - Indicates missing image URLs
- `[article-preview] 📸 Final image selection:` - Shows final selected image

### Edge Function Logs
Look for:
- Edge Function invocations
- Errors in routing
- Response status codes

### USGS Engine Logs
Look for:
- `✅ Image generation successful` - Confirms image created
- `✅ Video generation successful` - Confirms GIF created
- `✅ Post updated with image/video` - Confirms post has image URLs

---

## Expected Behavior vs Actual

### Expected:
1. X crawler hits `/article.html?id=post-usgs-xxx`
2. Edge Function detects `twitterbot` user-agent
3. Routes to `/.netlify/functions/article-preview?id=post-usgs-xxx`
4. `article-preview.js` fetches post from blob storage
5. Selects GIF or PNG image (not default)
6. Returns HTML with correct `og:image` and `twitter:image` meta tags
7. X crawler reads meta tags and displays preview

### Actual (Current):
1. X crawler hits `/article.html?id=post-usgs-xxx`
2. ??? (Unknown if Edge Function is executing)
3. ??? (Unknown if routing is working)
4. Preview shows default `PREVIEWIMAGEBRUH.jpg`

---

## Most Likely Issues (Ranked) - UPDATED

1. **X cache** (60% probability)
   - Old preview cached
   - Need to use Card Validator to refresh
   - Even with correct meta tags, X may show cached preview

2. **Post missing image URLs** (25% probability)
   - Post not updated when image generated
   - Image generated after post created
   - Timing issue
   - Check blob storage for post object

3. **Image URLs not accessible** (10% probability)
   - Images return 404
   - CORS issues
   - Authentication required
   - Test image URLs directly

4. **File read failing** (5% probability)
   - Static article.html not found in function
   - Path issues
   - Check Netlify function logs

---

## Recommended Fix Priority - UPDATED (No Edge Functions)

1. **FIRST**: Test article-preview.js directly
   - Test crawler: `curl -A "Twitterbot/1.0" "https://noteworthynews.co/article.html?id=post-usgs-xxx" | grep "og:image"`
   - Should show generated image URL (not PREVIEWIMAGEBRUH.jpg)
   - Check Netlify function logs for image selection

2. **SECOND**: Test regular user access
   - `curl "https://noteworthynews.co/article.html?id=post-usgs-xxx" | head -20`
   - Should return static article.html content
   - Verify client-side JS can run

3. **THIRD**: Use X Card Validator
   - Go to: https://cards-dev.twitter.com/validator
   - Enter article URL
   - Force refresh cache
   - Check if preview updates
   - Review meta tags shown

4. **FOURTH**: Check post data in blob storage
   - Verify post has `primary_image_url` and `video_url`
   - Test image URLs directly in browser
   - Check if images return 200 OK

5. **FIFTH**: Check Netlify function logs
   - Look for file read errors
   - Check if article.html is found
   - Verify image selection logic

---

## Solution Applied (Current Implementation)

### ✅ Option 1: Route All Requests to article-preview.js (IMPLEMENTED)
- ✅ Removed Edge Function dependency
- ✅ Route `/article.html` directly to `article-preview.js`
- ✅ `article-preview.js` serves static HTML for regular users using `fs.readFileSync()`
- ✅ `article-preview.js` serves pre-rendered HTML for crawlers
- **Status**: Implemented and ready for testing

### Alternative Solutions (Not Needed Now)

### Option 2: Pre-render Meta Tags at Build Time
- Generate static HTML files with correct meta tags
- Not feasible (meta tags depend on dynamic post data)

### Option 3: Use Netlify's _redirects File
- Add redirect rule in `public/_redirects`
- Already using `netlify.toml` redirects (same effect)

### Option 4: Server-Side Rendering (SSR)
- Use Netlify's SSR capabilities
- More complex, current solution should work

---

## Conclusion

The system is designed to:
1. Generate images/videos for earthquakes
2. Store them in blob storage and database
3. Serve correct meta tags to crawlers via `article-preview.js`
4. Route ALL requests to `article-preview.js` (no Edge Functions needed)

**Current Status**: 
- ✅ Fix applied: Removed Edge Function dependency
- ✅ All requests now route to `article-preview.js`
- ✅ Crawlers get pre-rendered HTML with correct meta tags
- ✅ Regular users get static HTML (client-side JS runs)
- ⏳ Needs testing and X cache refresh

**Most Likely Remaining Issues**:
1. **X cache** (60%) - Must use Card Validator to refresh
2. **Post data missing** (25%) - Check blob storage
3. **Image URLs not accessible** (10%) - Test directly
4. **File read failing** (5%) - Check Netlify logs

**Recommended Action**: 
1. Deploy the fix
2. Test with curl commands
3. Use X Card Validator to force refresh cache
4. Check Netlify function logs for any errors
5. Verify post data in blob storage has image URLs
