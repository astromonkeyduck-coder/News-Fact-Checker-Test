/**
 * SEO Utility Functions
 * Provides helpers for generating Open Graph and Twitter Card meta tags
 */

// Site configuration
const SITE_URL = 'https://noteworthynews.co';
const DEFAULT_OG_IMAGE = `${SITE_URL}/PREVIEWIMAGEBRUH.jpg`;
const DEFAULT_DESCRIPTION = 'Noteworthy News: globally curious, teen-led reporting.';

/**
 * Generate a slug from a post title or ID
 * @param {string} text - Title or ID to slugify
 * @returns {string} URL-safe slug
 */
function generateSlug(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces/underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Ensure an image URL is absolute
 * @param {string} imageUrl - Image URL (may be relative or absolute)
 * @returns {string} Absolute image URL
 */
function ensureAbsoluteImageUrl(imageUrl) {
  if (!imageUrl) return DEFAULT_OG_IMAGE;
  
  // If already absolute, return as-is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // If relative, make it absolute
  if (imageUrl.startsWith('/')) {
    return `${SITE_URL}${imageUrl}`;
  }
  
  // If no leading slash, add it
  return `${SITE_URL}/${imageUrl}`;
}

/**
 * Truncate text to a maximum length, preserving word boundaries
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncateDescription(text, maxLength = 155) {
  if (!text) return DEFAULT_DESCRIPTION;
  if (text.length <= maxLength) return text;
  
  // Truncate at word boundary
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...';
  }
  return truncated + '...';
}

/**
 * Get post metadata for SEO
 * @param {Object} post - Post object
 * @param {string} postId - Post ID
 * @returns {Object} SEO metadata object
 */
export function getPostMeta(post, postId) {
  const title = post.title || post.story || post.text || 'Breaking News Story';
  const story = post.story || post.text || post.title || '';
  const description = truncateDescription(story);
  const image = ensureAbsoluteImageUrl(post.image || post.images?.[0] || null);
  const datePosted = post.datePosted || post.createdAt || post.created_at || new Date().toISOString();
  
  // Generate URL - using ID for now, but could use slug if available
  const url = `${SITE_URL}/article.html?id=${encodeURIComponent(postId)}`;
  
  return {
    title,
    description,
    image,
    url,
    datePosted,
    siteName: 'Noteworthy News',
  };
}

/**
 * Update meta tags in the document head
 * @param {Object} meta - Metadata object from getPostMeta
 */
export function updateMetaTags(meta) {
  const { title, description, image, url, datePosted, siteName } = meta;
  
  // Helper to get or create meta element
  const getOrCreateMeta = (property, attribute = 'property') => {
    let element = document.querySelector(`meta[${attribute}="${property}"]`);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attribute, property);
      document.head.appendChild(element);
    }
    return element;
  };
  
  // Helper to get or create link element
  const getOrCreateLink = (rel) => {
    let element = document.querySelector(`link[rel="${rel}"]`);
    if (!element) {
      element = document.createElement('link');
      element.setAttribute('rel', rel);
      document.head.appendChild(element);
    }
    return element;
  };
  
  // Update page title
  document.title = `${title} | ${siteName}`;
  
  // Basic meta tags
  getOrCreateMeta('description', 'name').setAttribute('content', description);
  
  // Canonical URL
  getOrCreateLink('canonical').setAttribute('href', url);
  
  // Open Graph tags
  getOrCreateMeta('og:type').setAttribute('content', 'article');
  getOrCreateMeta('og:url').setAttribute('content', url);
  getOrCreateMeta('og:title').setAttribute('content', title);
  getOrCreateMeta('og:description').setAttribute('content', description);
  getOrCreateMeta('og:image').setAttribute('content', image);
  getOrCreateMeta('og:image:width').setAttribute('content', '1200');
  getOrCreateMeta('og:image:height').setAttribute('content', '630');
  getOrCreateMeta('og:site_name').setAttribute('content', siteName);
  getOrCreateMeta('og:locale').setAttribute('content', 'en_US');
  
  // Article-specific Open Graph tags
  if (datePosted) {
    getOrCreateMeta('article:published_time').setAttribute('content', datePosted);
  }
  getOrCreateMeta('article:author').setAttribute('content', siteName);
  
  // Twitter Card tags
  getOrCreateMeta('twitter:card', 'name').setAttribute('content', 'summary_large_image');
  getOrCreateMeta('twitter:url', 'name').setAttribute('content', url);
  getOrCreateMeta('twitter:title', 'name').setAttribute('content', title);
  getOrCreateMeta('twitter:description', 'name').setAttribute('content', description);
  getOrCreateMeta('twitter:image', 'name').setAttribute('content', image);
  getOrCreateMeta('twitter:site', 'name').setAttribute('content', '@NoteworthyNews');
  getOrCreateMeta('twitter:creator', 'name').setAttribute('content', '@NoteworthyNews');
}

// Export default for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getPostMeta,
    updateMetaTags,
    generateSlug,
    ensureAbsoluteImageUrl,
    truncateDescription,
    SITE_URL,
    DEFAULT_OG_IMAGE,
    DEFAULT_DESCRIPTION,
  };
}

