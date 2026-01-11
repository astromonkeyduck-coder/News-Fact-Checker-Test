/**
 * Shared function to create website posts from verified events
 * Used by all engines to create posts on the website
 */

const { getStore } = require("@netlify/blobs");

/**
 * Create a website post from a verified event
 * @param {Object} event - Verified event object from database
 * @param {string} category - Post category (e.g., "Earthquake", "Weather", "Airspace")
 * @param {string} source - Source name (e.g., "USGS", "NWS", "FAA")
 * @returns {Object} Result with exists flag and postId
 */
async function createPostFromEvent(event, category, source) {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN;
  
  if (!siteID || !token) {
    console.warn('[createPost] Missing NETLIFY_SITE_ID or NETLIFY_BLOB_READ_WRITE_TOKEN');
    return { exists: false, postId: null, error: 'Missing credentials' };
  }
  
  const store = getStore({
    name: "x-posts",
    siteID: siteID,
    token: token,
  });
  
  // Build post ID from canonical_id
  const postId = `${event.engine}-${event.canonical_id.split(':')[1]}`;
  const postKey = `post-${postId}.json`;
  
  // Check if post already exists
  let existingPost = null;
  try {
    existingPost = await store.get(postKey, { type: 'json' });
    if (existingPost) {
      // Always update post if we have an image_url (especially for earthquakes that get images generated later)
      // This ensures posts get images even if they were created before the image was generated
      if (event.image_url) {
        // Normalize image URL
        let imageUrl = event.image_url;
        if (imageUrl.startsWith('/')) {
          const baseUrl = process.env.URL || 'https://noteworthynews.co';
          imageUrl = `${baseUrl}${imageUrl}`;
        }
        
        // Check if update is needed (compare normalized URLs)
        const existingImage = existingPost.image || '';
        const needsUpdate = existingImage !== imageUrl;
        
        if (needsUpdate) {
          // Rebuild secondary images list (same logic as new posts)
          const normalizeUrlForComparison = (url) => {
            if (!url) return '';
            try {
              const urlObj = new URL(url.startsWith('http') ? url : (url.startsWith('/') ? `https://noteworthynews.co${url}` : url));
              return urlObj.origin + urlObj.pathname;
            } catch {
              return url;
            }
          };
          
          const primaryNormalized = imageUrl ? normalizeUrlForComparison(imageUrl) : null;
          
          const secondaryCandidates = [
            ...(event.secondary_images || []),
            ...(event.assets?.usgs_images || []).map(img => img.url || img),
            ...(event.assets?.images || []),
          ].filter(Boolean);
          
          const secondaryImages = secondaryCandidates
            .map(url => {
              const urlString = typeof url === 'string' ? url : (url.url || null);
              if (!urlString) return null;
              if (urlString.startsWith('/')) {
                const baseUrl = process.env.URL || 'https://noteworthynews.co';
                return `${baseUrl}${urlString}`;
              }
              return urlString;
            })
            .filter(Boolean)
            .filter(url => normalizeUrlForComparison(url) !== primaryNormalized)
            .filter((url, i, arr) => {
              const normalized = normalizeUrlForComparison(url);
              return arr.findIndex(u => normalizeUrlForComparison(u) === normalized) === i;
            });
          
          // STEP 3: Set canonical primary_image_url
          existingPost.primary_image_url = imageUrl;
          existingPost.image = imageUrl; // Legacy compatibility
          existingPost.image_url = imageUrl; // Legacy compatibility
          existingPost.images = secondaryImages;
          existingPost.secondary_images = secondaryImages;
          if (event.assets) {
            existingPost.assets = event.assets;
          }
          
          await store.set(postKey, JSON.stringify(existingPost), {
            contentType: 'application/json',
          });
          console.log(`[createPost] Updated post ${postId} with image: ${imageUrl}, secondary: ${secondaryImages.length}`);
          return { exists: true, postId, updated: true };
        }
      }
      return { exists: true, postId, updated: false };
    }
  } catch (err) {
    // Post doesn't exist, continue
  }
  
  // Format time for display
  const eventTime = new Date(event.published_at);
  const localTime = eventTime.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  
  // Truncate summary to reasonable length for display (max 250 chars)
  const maxSummaryLength = 250;
  let summary = event.summary || event.title;
  if (summary.length > maxSummaryLength) {
    summary = summary.substring(0, maxSummaryLength).trim();
    // Don't cut off mid-word if possible
    const lastSpace = summary.lastIndexOf(' ');
    if (lastSpace > maxSummaryLength - 50) {
      summary = summary.substring(0, lastSpace);
    }
    summary += '...';
  }

  // Normalize image URL - ensure it's a valid, accessible URL
  let imageUrl = event.image_url || null;
  if (imageUrl) {
    // Ensure relative URLs are converted to absolute
    if (imageUrl.startsWith('/')) {
      const baseUrl = process.env.URL || 'https://noteworthynews.co';
      imageUrl = `${baseUrl}${imageUrl}`;
    }
    // Log for debugging
    console.log(`[createPost] Setting image URL for post ${postId}: ${imageUrl}`);
  }
  
  // Build secondary images list (exclude primary branded image)
  // Collect from multiple sources: assets.usgs_images, secondary_images, etc.
  const normalizeUrlForComparison = (url) => {
    if (!url) return '';
    try {
      const urlObj = new URL(url.startsWith('http') ? url : (url.startsWith('/') ? `https://noteworthynews.co${url}` : url));
      return urlObj.origin + urlObj.pathname;
    } catch {
      return url;
    }
  };
  
  const primaryNormalized = imageUrl ? normalizeUrlForComparison(imageUrl) : null;
  
  const secondaryCandidates = [
    ...(event.secondary_images || []),
    ...(event.assets?.usgs_images || []).map(img => img.url || img), // Extract URLs from USGS image objects
    ...(event.assets?.images || []),
  ].filter(Boolean);
  
  // Filter out primary image and deduplicate
  const secondaryImages = secondaryCandidates
    .map(url => {
      // Handle both string URLs and objects with .url property
      const urlString = typeof url === 'string' ? url : (url.url || null);
      if (!urlString) return null;
      // Normalize to absolute URL
      if (urlString.startsWith('/')) {
        const baseUrl = process.env.URL || 'https://noteworthynews.co';
        return `${baseUrl}${urlString}`;
      }
      return urlString;
    })
    .filter(Boolean)
    .filter(url => {
      // Remove primary image
      const normalized = normalizeUrlForComparison(url);
      return normalized !== primaryNormalized;
    })
    .filter((url, i, arr) => {
      // Deduplicate
      const normalized = normalizeUrlForComparison(url);
      return arr.findIndex(u => normalizeUrlForComparison(u) === normalized) === i;
    });
  
  console.log(`[createPost] Post ${postId} - Primary: ${imageUrl ? 'yes' : 'no'}, Secondary: ${secondaryImages.length} images`);
  
  // STEP 3: Canonical image field definition
  // PRIMARY IMAGE RULE: primary_image_url is the ONE AND ONLY field for card deck and article hero
  // SECONDARY IMAGE RULE: secondary_images[] never contains primary, always deduplicated
  
  // Create post object matching the site's post structure
  const post = {
    id: postId,
    title: event.title,
    story: summary,
    text: summary,
    // CANONICAL PRIMARY IMAGE FIELD (use this everywhere)
    primary_image_url: imageUrl, // THE single source of truth for primary image
    image: imageUrl, // Legacy compatibility (card deck reads this)
    image_url: imageUrl, // Legacy compatibility
    // Video URL for social media Player Cards (if available)
    // Check both top-level video_url and assets.video_url (stored in JSONB column)
    video_url: event.video_url || event.assets?.video_url || null,
    video: event.video_url || event.assets?.video_url || null, // Legacy compatibility
    // SECONDARY IMAGES (never includes primary)
    images: secondaryImages, // Secondary images only (excludes primary, deduplicated)
    secondary_images: secondaryImages, // Also store as secondary_images for compatibility
    link: event.source_url,
    url: event.source_url,
    datePosted: event.published_at,
    createdAt: event.published_at,
    created_at: event.published_at,
    category: category,
    source: source,
    location: event.location_display,
    location_display: event.location_display, // Also store as location_display for earthquake enhancements
    location_english_name: event.location_english_name || null, // English translation for non-English locations
    eventId: event.canonical_id,
    severity: event.severity,
    event_type: event.event_type,
    // Store coordinates for earthquake enhancements (required for map/3D visualization)
    lat: event.lat || null,
    lon: event.lon || null,
    // Store magnitude at top level for easy access
    magnitude: event.assets?.magnitude || event.magnitude || null,
    // Store assets for reference (includes all Tier features: impact_assessment, tsunami_assessment, etc.)
    assets: event.assets || {},
  };
  
  // Store post
  await store.set(postKey, JSON.stringify(post), {
    contentType: "application/json",
  });
  
  // Add to index
  let indexData = { ids: [], urls: [] };
  try {
    const existingIndex = await store.get("index.json");
    if (existingIndex) {
      indexData = JSON.parse(existingIndex);
    }
  } catch (err) {
    // Index doesn't exist, start fresh
  }
  
  // Prepend new post ID (newest first)
  if (!indexData.ids.includes(postId)) {
    indexData.ids.unshift(postId);
    // Keep index to reasonable size (200 posts)
    indexData.ids = indexData.ids.slice(0, 200);
    await store.set("index.json", JSON.stringify(indexData), {
      contentType: "application/json",
    });
  }
  
  return { exists: false, postId };
}

module.exports = {
  createPostFromEvent,
};

