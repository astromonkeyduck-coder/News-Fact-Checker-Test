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
  try {
    const existing = await store.get(postKey);
    if (existing) {
      return { exists: true, postId };
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
  
  // Create post object matching the site's post structure
  const post = {
    id: postId,
    title: event.title,
    story: event.summary || event.title,
    text: event.summary || event.title,
    image: event.image_url || null,
    images: event.image_url ? [event.image_url] : [],
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

