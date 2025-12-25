# Image Fields Audit - STEP 0

## Image Fields Used

### Fields Found:
1. `image` - Primary image (string URL)
2. `image_url` - Primary image URL (in event objects)
3. `primary_image_url` - Alternative primary field (not currently used)
4. `images[]` - Array of image URLs
5. `secondary_images[]` - Array of secondary image URLs
6. `assets.images[]` - Images in assets object
7. `assets.usgs_images[]` - USGS images in assets
8. `usgs_images[]` - Direct USGS images array

## Where Each Field is WRITTEN:

### `netlify/functions/lib/createPost.js`:
- Sets: `post.image` (primary)
- Sets: `post.images[]` (secondary, deduplicated)
- Sets: `post.secondary_images[]` (same as images)
- Sets: `post.assets` (from event.assets)

### `netlify/functions/engines/usgs.js`:
- Sets: `event.image_url` (branded image URL)
- Sets: `event.assets.usgs_images[]` (USGS map images)

### `netlify/functions/earthquake-poller.js` (OLD):
- Sets: `post.image` and `post.images: [imageUrl]` (DUPLICATE!)

## Where Each Field is READ:

### Card Deck Components:
- `src/components/cloudflare-post-feed.js`: Reads `card.image`
- `src/components/cloudflare-post-feed-standalone.js`: Reads `card.image`
- `src/components/PostFeed.tsx`: Reads `post.image`
- `src/components/news-card.js`: Reads `post.image || post.images?.[0]`

### Article Page:
- `src/components/article-loader.js`: 
  - Primary: `post.primary_image_url || post.image_url || post.image`
  - Secondary: `post.secondary_images || post.images || post.assets?.images || post.usgs_images || post.assets?.usgs_images`

## Current Issues:
1. Multiple sources of truth (image, image_url, primary_image_url)
2. `earthquake-poller.js` creates duplicates (image AND images: [imageUrl])
3. Card deck may not be reading the right field
4. Article page checks too many fields, may show duplicates

