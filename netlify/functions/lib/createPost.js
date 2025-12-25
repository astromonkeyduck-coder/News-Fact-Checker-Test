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
          existingPost.image = imageUrl;
          // Clear images array to prevent duplicates (only use 'image' field for primary)
          existingPost.images = [];
          await store.set(postKey, JSON.stringify(existingPost), {
            contentType: 'application/json',
          });
          console.log(`[createPost] Updated post ${postId} with image: ${imageUrl}`);
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
  
  // Create post object matching the site's post structure
  // CRITICAL: Only set 'image' field for primary image, 'images' array is for secondary images only
  // This prevents duplicates on article pages
  const post = {
    id: postId,
    title: event.title,
    story: summary,
    text: summary,
    image: imageUrl, // Primary image (for card deck and article hero)
    images: [], // Secondary images only (empty for single-image posts to prevent duplicates)
    link: event.source_url,
    url: event.source_url,
    datePosted: event.published_at,
    createdAt: event.published_at,
    created_at: event.published_at,
    category: category,
    source: source,
    location: event.location_display,
    eventId: event.canonical_id,
    severity: event.severity,
    event_type: event.event_type,
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

