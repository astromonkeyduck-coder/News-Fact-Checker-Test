/**
 * Post Feed Enhanced - Premium X-style feed with advanced features
 * 
 * Key Enhancements:
 * - Expandable post text with "Read more" functionality
 * - Share functionality (copy link, social sharing)
 * - Reading time estimates
 * - Trending/hot post indicators
 * - Enhanced media gallery with lightbox
 * - Skeleton loading states
 * - Better error handling
 * - Keyboard navigation
 * - Improved accessibility
 * - Better visual hierarchy
 */

const ENHANCED_CACHE_KEY = 'noteworthy-posts-cache-enhanced';
const ENHANCED_CACHE_EXPIRY = 2 * 60 * 1000; // 2 minutes
const ENHANCED_CACHE_VERSION = '2'; // Increment this to invalidate all caches

/** Fallback posts when API is unavailable or returns empty (e.g. local dev without netlify dev) */
const FALLBACK_POSTS = [
  {
    id: 'fallback-1',
    text: 'Breaking news cards load from the API. When the API is unavailable, you see these sample posts. Run "netlify dev" locally or deploy to Netlify to load live posts.',
    title: 'Breaking news cards load from the API',
    datePosted: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    author: { handle: 'newsnoteworthy', name: 'Noteworthy News' },
    link: 'https://x.com/newsnoteworthy'
  },
  {
    id: 'fallback-2',
    text: 'Stay informed with fact-checked stories and in-depth analysis. Add posts via your Netlify functions or admin to see them here.',
    title: 'Stay informed with fact-checked stories',
    datePosted: new Date(Date.now() - 3600000).toISOString(),
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    author: { handle: 'newsnoteworthy', name: 'Noteworthy News' },
    link: 'https://x.com/newsnoteworthy'
  }
];

// Use ENHANCED_ prefix to avoid duplicate declaration with post-feed-v2.js
const ENHANCED_EARTHQUAKE_MIN_MAG = 5.0;
const ENHANCED_EXCLUDED_KEYWORDS = ['volcano', 'volcanic', 'embassy'];

function isLowMagnitudeEarthquakeEnhanced(post) {
  if (!post) return false;
  const category = (post.category || '').toLowerCase();
  const eventType = (post.event_type || post.eventType || '').toLowerCase();
  const source = (post.source || '').toLowerCase();
  const isEarthquake = category === 'earthquake' || eventType === 'earthquake' || source === 'usgs';
  if (!isEarthquake) return false;
  const magnitudeRaw = post.magnitude ?? post.mag ?? post.magnitude_value ?? post.magnitudeValue;
  const magnitude = typeof magnitudeRaw === 'string' ? parseFloat(magnitudeRaw) : Number(magnitudeRaw);
  if (!Number.isFinite(magnitude)) return false;
  return magnitude < ENHANCED_EARTHQUAKE_MIN_MAG;
}

function isExcludedAlertEnhanced(post) {
  if (!post) return false;
  const category = (post.category || '').toLowerCase();
  const eventType = (post.event_type || post.eventType || '').toLowerCase();
  const source = (post.source || '').toLowerCase();
  const tags = Array.isArray(post.tags) ? post.tags.join(' ').toLowerCase() : '';
  const text = (post.text || post.title || post.story || '').toLowerCase();
  const combined = `${category} ${eventType} ${source} ${tags} ${text}`;
  return ENHANCED_EXCLUDED_KEYWORDS.some(keyword => combined.includes(keyword));
}

let enhancedIsLoading = false;
let enhancedCurrentSort = localStorage.getItem('feed-sort') || 'recent';
let enhancedCurrentSearch = localStorage.getItem('feed-search') || '';
let enhancedCurrentPosts = [];
let enhancedDisplayedCount = 5; // Number of posts currently displayed
let enhancedPostsPerChunk = 15; // Number of posts to load per scroll
let enhancedScrollObserver = null; // Intersection Observer for infinite scroll
let expandedPosts = new Set(); // Track which posts are expanded
let sharedPosts = new Set(); // Track recently shared posts
let enhancedEndpoint = '/.netlify/functions/posts-read'; // Current API endpoint
let enhancedCurrentLimit = 5; // Current number of posts fetched from API
let enhancedInitInProgress = false; // Guard against concurrent initialization
let enhancedInitDone = false; // Track if initialization completed

/**
 * Calculate reading time in minutes
 */
function calculateReadingTime(text) {
  if (!text) return 1;
  const wordsPerMinute = 200;
  const wordCount = text.trim().split(/\s+/).length;
  const minutes = Math.ceil(wordCount / wordsPerMinute);
  return Math.max(1, minutes);
}

// Trending/Hot badge functionality removed per user request

/**
 * Format count with abbreviations
 */
function formatCount(n) {
  if (n === undefined || n === null || isNaN(n)) return '0';
  if (n < 1000) return n.toString();
  if (n < 1000000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  if (n < 1000000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'B';
}

/**
 * Format relative time
 */
function formatRelativeTime(dateString) {
  if (!dateString) {
    console.warn('[formatRelativeTime] No dateString provided');
    return 'Just now';
  }
  
  const date = new Date(dateString);
  const now = new Date();
  
  if (isNaN(date.getTime())) {
    console.warn('[formatRelativeTime] Invalid date string:', dateString);
    return 'Just now';
  }
  
  const diffMs = now.getTime() - date.getTime();
  
  // Check for negative difference (date in future) - this indicates a problem
  if (diffMs < 0) {
    console.warn('[formatRelativeTime] Date is in the future!', {
      dateString,
      parsedDate: date.toISOString(),
      now: now.toISOString(),
      diffMs
    });
    // Still show relative time, but log the issue
  }
  
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) return `${diffSec}s`;
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay < 7) return `${diffDay}d`;
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  const currentYear = now.getFullYear();
  
  if (year === currentYear) {
    return `${month} ${day}`;
  } else {
    return `${month} ${day}, ${year}`;
  }
}

/**
 * Format absolute time for tooltip
 */
function formatAbsoluteTime(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Truncate text to character limit
 */
function truncateText(text, maxLength = 280) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Copy post link to clipboard
 */
async function copyPostLink(postUrl) {
  try {
    await navigator.clipboard.writeText(postUrl);
    
    // Show toast notification
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideIn 0.3s ease;
    `;
    toast.textContent = '✓ Link copied to clipboard!';
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  } catch (err) {
    console.error('Failed to copy link:', err);
  }
}

/**
 * Share post via Web Share API or fallback
 */
async function sharePost(post) {
  const shareData = {
    title: `Noteworthy News: ${truncateText(post.text || post.story || '', 100)}`,
    text: post.text || post.story || '',
    url: post.url || post.link || `https://x.com/newsnoteworthy/status/${post.id}`,
  };
  
  try {
    if (navigator.share) {
      await navigator.share(shareData);
      sharedPosts.add(post.id);
    } else {
      // Fallback: copy to clipboard
      await copyPostLink(shareData.url);
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Share failed:', err);
      await copyPostLink(shareData.url);
    }
  }
}

/**
 * Toggle post expansion
 */
function togglePostExpand(postId) {
  if (expandedPosts.has(postId)) {
    expandedPosts.delete(postId);
  } else {
    expandedPosts.add(postId);
  }
  renderEnhancedFeed();
}

/**
 * Open media lightbox
 */
function openMediaLightbox(media, index = 0) {
  const lightbox = document.createElement('div');
  lightbox.id = 'media-lightbox';
  lightbox.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.95);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  `;
  
  const img = document.createElement('img');
  img.src = media[index].url;
  img.style.cssText = `
    max-width: 90%;
    max-height: 90%;
    object-fit: contain;
    border-radius: 8px;
  `;
  
  lightbox.appendChild(img);
  lightbox.onclick = () => lightbox.remove();
  
  document.body.appendChild(lightbox);
  
  // Close on Escape
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      lightbox.remove();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

/**
 * Render enhanced post card
 */
function renderEnhancedPostCard(post) {
  const postDate = post.createdAt || post.datePosted || new Date().toISOString();
  const timestamp = formatRelativeTime(postDate);
  const timestampTooltip = formatAbsoluteTime(postDate);
  const postText = post.text || post.story || post.title || '';
  
  // Use the actual post ID - this MUST match what's stored in the database
  // Priority: post.id > post.postId > extract from post.link/url > fallback hash
  let stableId = post.id || post.postId;
  
  // If no ID, try to extract from link/url (Twitter/X status URLs contain the post ID)
  if (!stableId && (post.link || post.url)) {
    const url = post.link || post.url;
    const match = url.match(/status\/(\d+)/);
    if (match && match[1]) {
      stableId = match[1];
    }
  }
  
  // Last resort: create hash (but this won't match database, so article won't load)
  if (!stableId && postText) {
    console.warn(`[PostFeedEnhanced] Post has no ID, creating hash (article page won't work)`);
    let hash = 0;
    const str = postText.substring(0, 100);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    stableId = `post-${Math.abs(hash)}`;
  } else if (!stableId) {
    stableId = `post-${Date.now()}`;
  }
  
  const articleLink = `/article.html?id=${encodeURIComponent(stableId)}`;
  
  // Twitter link for external reference
  const twitterLink = post.link || post.url || (post.id ? `https://x.com/newsnoteworthy/status/${post.id}` : 'https://x.com/newsnoteworthy');
  
  // Format story text (same as old feed)
  const formatStory = (text) => {
    if (!text) return '';
    
    // Normalize whitespace - strip ALL leading whitespace to prevent indentation
    let normalizedText = String(text)
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\u00a0/g, ' ')  // Non-breaking space to regular space
      .replace(/^[\s\u00a0\u2000-\u200B\u2028\u2029]+/, '')  // Strip all leading whitespace including various unicode spaces
      .replace(/\n[\s\u00a0\u2000-\u200B]+/g, '\n')  // Strip leading whitespace from each line
      .trim();  // Final trim to be absolutely sure
    
    if (!normalizedText) return '';
    
    // Split text into parts to handle URLs and plain text separately
    const parts = [];
    let lastIndex = 0;
    
    // Match both image URLs and regular URLs
    const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
    let match;
    
    while ((match = urlRegex.exec(normalizedText)) !== null) {
      // Add text before URL
      if (match.index > lastIndex) {
        const beforeText = normalizedText.substring(lastIndex, match.index);
        if (beforeText) {
          parts.push({ type: 'text', content: beforeText });
        }
      }
      
      const url = match[0];
      
      // Sanitize URL to prevent XSS (only allow http/https, escape special chars)
      let sanitizedUrl = null;
      try {
        const urlObj = new URL(url);
        // Only allow http and https protocols (prevent javascript:, data:, etc.)
        if (['http:', 'https:'].includes(urlObj.protocol)) {
          // Escape special characters for HTML attribute insertion
          sanitizedUrl = url
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        }
      } catch (e) {
        // Invalid URL, skip it
        sanitizedUrl = null;
      }
      
      // Skip invalid or unsafe URLs
      if (!sanitizedUrl) {
        lastIndex = match.index + match[0].length;
        continue;
      }
      
      const isImage = /\.(jpg|jpeg|png|gif|webp|svg|JPG|JPEG|PNG|GIF|WEBP|SVG)(\?[^\s]*)?$/i.test(url);
      
      if (isImage) {
        // Create img tag for images
        parts.push({ 
          type: 'image', 
          content: `<img src="${sanitizedUrl}" alt="Post image" loading="lazy" style="max-width: 100%; height: auto; border-radius: 12px; margin: 0.5rem 0; display: block;" onerror="this.style.display='none';" />` 
        });
      } else {
        // Create clickable link for other URLs
        const displayUrl = escapeHtml(url.length > 50 ? url.substring(0, 47) + '...' : url);
        parts.push({ 
          type: 'link', 
          content: `<a href="${sanitizedUrl}" target="_blank" rel="noopener noreferrer" style="color: rgb(29, 155, 240); text-decoration: none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${displayUrl}</a>` 
        });
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text after last URL
    if (lastIndex < normalizedText.length) {
      const afterText = normalizedText.substring(lastIndex);
      if (afterText) {
        parts.push({ type: 'text', content: afterText });
      }
    }
    
    // If no URLs found, just process the whole text
    if (parts.length === 0) {
      parts.push({ type: 'text', content: normalizedText });
    }
    
    // Process each part: escape HTML for text, keep HTML for images/links
    const processed = parts.map(part => {
      if (part.type === 'text') {
        // Strip any remaining leading/trailing whitespace from text parts
        let content = part.content.trim();
        // Escape HTML and convert newlines to <br>
        return content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;')
          .replace(/\n/g, '<br>');
      } else {
        // Images and links are already HTML, just convert newlines before/after
        return part.content;
      }
    }).join('');
    
    // Final cleanup - remove any leading whitespace from the entire result
    return processed.replace(/^[\s\u00a0\u2000-\u200B]+/, '').trim();
  };
  
  // Render media (same as old feed)
  const renderMedia = (post) => {
    let mediaHtml = '';
    // Collect all images: primary first, then secondary
    // Check canonical primary_image_url, then legacy image/image_url, then images array
    // Also check assets.usgs_images for earthquake posts
    let primaryImage = post.primary_image_url || post.image_url || post.image || null;
    
    // Fallback: Check assets.usgs_images for earthquake posts if no primary image
    if (!primaryImage && (post.category === 'Earthquake' || post.source === 'USGS')) {
      const usgsImages = post.assets?.usgs_images || [];
      if (usgsImages.length > 0) {
        // Use first USGS image as fallback
        const firstUsgsImage = typeof usgsImages[0] === 'string' ? usgsImages[0] : (usgsImages[0]?.url || null);
        if (firstUsgsImage) {
          primaryImage = firstUsgsImage;
          console.log('[PostFeedEnhanced] Using USGS image as fallback:', firstUsgsImage);
        }
      }
    }
    
    const secondaryImages = post.images || post.secondary_images || [];
    
    // DEBUG: Log image fields for troubleshooting
    if (!primaryImage && (post.category === 'Earthquake' || post.source === 'USGS')) {
      console.warn('[PostFeedEnhanced] Earthquake post missing image:', {
        id: post.id,
        primary_image_url: post.primary_image_url,
        image_url: post.image_url,
        image: post.image,
        images: post.images,
        assets_usgs_images: post.assets?.usgs_images,
        category: post.category,
        source: post.source
      });
    }
    
    // Combine primary + secondary, filtering out duplicates
    const allImages = [];
    if (primaryImage) {
      allImages.push(primaryImage);
    }
    // Add secondary images that aren't duplicates of primary
    secondaryImages.forEach(img => {
      if (img && img !== primaryImage && !allImages.includes(img)) {
        allImages.push(img);
      }
    });
    const images = allImages;
    const videos = post.videos || [];
    
    if (images.length > 0 || videos.length > 0) {
      mediaHtml = '<div class="modern-post-media" style="margin: 1.25rem 0; border-radius: 12px; overflow: hidden;">';
      
      // Render images
      if (images.length > 0) {
        if (images.length === 1) {
          // Escape image URL for HTML attribute
          const imageUrl = String(images[0]).replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
          mediaHtml += `<div class="post-image-single" style="border-radius: 12px; overflow: hidden; background: rgba(0,0,0,0.2);">
            <img src="${imageUrl}" alt="Post image" loading="lazy" style="width: 100%; height: auto; display: block; max-height: 600px; object-fit: cover;" 
                 onerror="console.error('[PostFeedEnhanced] Image failed to load:', this.src); this.style.display='none';" 
                 onload="console.log('[PostFeedEnhanced] Image loaded successfully:', this.src);" />
          </div>`;
        } else {
          const gridCols = Math.min(images.length, 3);
          mediaHtml += `<div class="post-image-grid" style="display: grid; grid-template-columns: repeat(${gridCols}, 1fr); gap: 0.5rem; border-radius: 12px; overflow: hidden;">
            ${images.slice(0, 4).map(img => {
              // Escape image URL for HTML attribute (same as single image)
              const imageUrl = String(img).replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
              return `
              <div style="aspect-ratio: 1; overflow: hidden; background: rgba(0,0,0,0.2);">
                <img src="${imageUrl}" alt="Post image" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none';" />
          </div>
            `;
            }).join('')}
          </div>`;
        }
      }
      
      // Render videos
      if (videos.length > 0) {
        videos.forEach(video => {
          if (video.includes('youtube.com') || video.includes('youtu.be')) {
            // YouTube embed
            const videoId = video.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
            if (videoId) {
              mediaHtml += `<div class="post-video" style="margin-top: 0.5rem; position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; background: rgba(0,0,0,0.2);">
                <iframe src="https://www.youtube.com/embed/${videoId}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;" allowfullscreen></iframe>
              </div>`;
            }
          } else {
            // Regular video tag
            mediaHtml += `<div class="post-video" style="margin-top: 0.5rem; border-radius: 12px; overflow: hidden;">
              <video src="${video}" controls style="width: 100%; border-radius: 12px;" onerror="this.style.display='none';"></video>
            </div>`;
          }
        });
      }
      
      mediaHtml += '</div>';
    }
    
    return mediaHtml;
  };
  
  // Helper function to get SVG icon HTML
  const getIconHTML = (iconName) => {
    const icons = {
      reply: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: currentColor; width: 1.25rem; height: 1.25rem; vertical-align: middle; display: inline-block;">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <path d="M8 10h8M8 14h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>
      </svg>`,
      repost: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: currentColor; width: 1.25rem; height: 1.25rem; vertical-align: middle; display: inline-block;">
        <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      </svg>`,
      like: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: currentColor; width: 1.25rem; height: 1.25rem; vertical-align: middle; display: inline-block;">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/>
      </svg>`,
      view: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: currentColor; width: 1.25rem; height: 1.25rem; vertical-align: middle; display: inline-block;">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity="0.2"/>
      </svg>`,
    };
    return icons[iconName] || '';
  };

  // Render engagement bar (same as old feed)
  const renderEngagementBar = (post, link) => {
    const replies = post.replies !== undefined && post.replies !== null ? post.replies : null;
    const reposts = post.reposts !== undefined && post.reposts !== null ? post.reposts : null;
    const likes = post.likes !== undefined && post.likes !== null ? post.likes : null;
    const views = post.views !== undefined && post.views !== null ? post.views : null;
    
    const formatNumber = (n) => {
      if (n === null || n === undefined || isNaN(n)) return '';
      if (n < 1000) return n.toString();
      if (n < 1000000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
      return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    };
    
    const buttons = [];
    
    // Reply button
    buttons.push({
      icon: getIconHTML('reply'),
      count: replies,
      label: 'Reply',
      color: 'rgb(113, 118, 123)',
      hoverColor: 'rgb(29, 155, 240)',
      href: link
    });
    
    // Repost button
    buttons.push({
      icon: getIconHTML('repost'),
      count: reposts,
      label: 'Repost',
      color: 'rgb(113, 118, 123)',
      hoverColor: 'rgb(0, 186, 124)',
      href: link
    });
    
    // Like button
    buttons.push({
      icon: getIconHTML('like'),
      count: likes,
      label: 'Like',
      color: 'rgb(113, 118, 123)',
      hoverColor: 'rgb(249, 24, 128)',
      href: link
    });
    
    // Views button
    buttons.push({
      icon: getIconHTML('view'),
      count: views,
      label: 'Views',
      color: 'rgb(113, 118, 123)',
      hoverColor: 'rgb(29, 155, 240)',
      href: link
    });
    
    return buttons.map(btn => `
      <a href="${btn.href}" ${btn.href.startsWith('http') ? 'target="_blank" rel="noopener noreferrer"' : ''} 
         class="x-engagement-btn" 
         style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; color: ${btn.color}; text-decoration: none; border-radius: 50%; transition: all 0.2s ease; min-width: 36px; justify-content: flex-start;" 
         onmouseover="this.style.color='${btn.hoverColor}'; this.style.backgroundColor='rgba(29, 155, 240, 0.1)'" 
         onmouseout="this.style.color='${btn.color}'; this.style.backgroundColor='transparent'"
         title="${btn.label}">
        <span style="display: inline-flex; align-items: center; line-height: 1;">${btn.icon}</span>
        ${btn.count !== null && btn.count !== undefined ? `<span style="font-size: 0.813rem; line-height: 1; font-weight: 400;">${formatNumber(btn.count)}</span>` : ''}
      </a>
    `).join('');
  };
  
  // Use November 23rd card design style (from post-feed-v2.js)
  return `
    <article class="feed-post-card" role="listitem" data-post-type="${post.postType || 'text'}" data-post-id="${post.id || ''}" style="background: transparent; min-height: 520px; padding: 1.5rem; margin: 0; border-bottom: 1px solid rgba(255,255,255,0.1); transition: background 0.2s ease; display: block; width: 100%; max-width: 100%; box-sizing: border-box; cursor: pointer;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'" onclick="window.location.href='${articleLink}'">
      <div style="display: flex; gap: 0.75rem; margin-bottom: 0.75rem; align-items: flex-start;">
        <!-- Avatar -->
        <a href="https://x.com/newsnoteworthy" target="_blank" rel="noopener noreferrer" style="flex-shrink: 0; text-decoration: none; display: block;" onclick="event.stopPropagation();">
          <img src="/IMG_5794.PNG" alt="Noteworthy News" style="width: 56px; height: 56px; border-radius: 50%; object-fit: cover; display: block;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #1DA1F2 0%, #1a91da 100%); display: none; align-items: center; justify-content: center; font-weight: 700; font-size: 1.25rem; color: white;">
            NW
          </div>
        </a>
      
        <!-- Post Content -->
        <div style="flex: 1; min-width: 0;">
          <!-- Header: Username, handle, timestamp -->
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; flex-wrap: wrap;">
            <a href="https://x.com/newsnoteworthy" target="_blank" rel="noopener noreferrer" style="font-weight: 700; font-size: 0.938rem; color: rgb(231, 233, 234); text-decoration: none; line-height: 1.25rem;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'" onclick="event.stopPropagation();">Noteworthy News</a>
            <span style="color: rgb(113, 118, 123); font-size: 0.938rem; line-height: 1.25rem;">@newsnoteworthy</span>
            <span style="color: rgb(113, 118, 123); font-size: 0.938rem; line-height: 1.25rem;">·</span>
            <a href="${articleLink}" style="color: rgb(113, 118, 123); font-size: 0.938rem; text-decoration: none; line-height: 1.25rem;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'" onclick="event.stopPropagation();">${timestamp}</a>
          </div>
          
          <!-- Post Text -->
          <div style="color: rgb(231, 233, 234); font-size: 0.938rem; line-height: 1.375rem; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; margin: 0 0 0.75rem 0; padding: 0; text-align: left; text-indent: 0;">${formatStory(postText)}</div>
      
          <!-- Media -->
          ${renderMedia(post)}
          
          <!-- Engagement Bar (Twitter-style) -->
          <div style="display: flex; align-items: center; justify-content: space-between; max-width: 425px; margin-top: 0.75rem; padding-top: 0.5rem;" onclick="event.stopPropagation();">
            ${renderEngagementBar(post, articleLink)}
          </div>
        </div>
      </div>
    </article>
  `;
}

/**
 * Format post text with clickable links
 */
function formatPostTextWithLinks(text) {
  if (!text) return '';
  
  // Escape HTML first
  let escaped = escapeHtml(text);
  
  // Convert URLs to links (with sanitization)
  const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
  escaped = escaped.replace(urlRegex, (url) => {
    // Sanitize URL to prevent XSS
    let sanitizedUrl = null;
    try {
      const urlObj = new URL(url);
      if (['http:', 'https:'].includes(urlObj.protocol)) {
        sanitizedUrl = url
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }
    } catch (e) {
      // Invalid URL, skip it
    }
    
    if (!sanitizedUrl) {
      return escapeHtml(url); // Return escaped URL as plain text if invalid
    }
    
    return `<a href="${sanitizedUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="color: rgb(29, 155, 240); text-decoration: none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${escapeHtml(url)}</a>`;
  });
  
  // Convert hashtags to links
  const hashtagRegex = /#(\w+)/gi;
  escaped = escaped.replace(hashtagRegex, (match, tag) => {
    return `<a href="https://x.com/hashtag/${tag}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="color: rgb(29, 155, 240); text-decoration: none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${match}</a>`;
  });
  
  // Convert mentions to links
  const mentionRegex = /@(\w+)/gi;
  escaped = escaped.replace(mentionRegex, (match, handle) => {
    return `<a href="https://x.com/${handle}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="color: rgb(29, 155, 240); text-decoration: none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${match}</a>`;
  });
  
  return escaped;
}

/**
 * Render enhanced media gallery
 */
function renderEnhancedMedia(media) {
  if (!media || media.length === 0) return '';
  
  if (media.length === 1) {
    const item = media[0];
    return `
      <div 
        class="enhanced-media-single"
        onclick="event.stopPropagation(); window.openMediaLightbox([${JSON.stringify(item)}], 0)"
        style="
          width: 100%;
          max-height: 500px;
          border-radius: 16px;
          overflow: hidden;
          margin-bottom: 1rem;
          border: 1px solid rgba(255,255,255,0.1);
          cursor: pointer;
          transition: transform 0.2s ease;
        "
        onmouseover="this.style.transform='scale(1.02)'"
        onmouseout="this.style.transform='scale(1)'"
      >
        <img 
          src="${item.url}" 
          alt="Post media"
          loading="lazy"
          style="
            width: 100%;
            height: auto;
            display: block;
            object-fit: cover;
          "
          onerror="this.style.display='none';"
        />
      </div>
    `;
  }
  
  // Multiple images - grid
  const gridCols = media.length === 2 ? '1fr 1fr' : 'repeat(2, 1fr)';
  return `
    <div 
      class="enhanced-media-grid"
      style="
        display: grid;
        grid-template-columns: ${gridCols};
        gap: 2px;
        width: 100%;
        max-height: 500px;
        overflow: hidden;
        border-radius: 16px;
        margin-bottom: 1rem;
        border: 1px solid rgba(255,255,255,0.1);
      "
    >
      ${media.slice(0, 4).map((item, idx) => {
        const isLastIn3 = media.length === 3 && idx === 2;
        return `
          <div 
            onclick="event.stopPropagation(); window.openMediaLightbox([${media.map(m => JSON.stringify(m)).join(',')}], ${idx})"
            style="
              aspect-ratio: ${isLastIn3 ? '2/1' : '1'};
              overflow: hidden;
              background: rgba(0,0,0,0.3);
              cursor: pointer;
              transition: transform 0.2s ease;
              ${isLastIn3 ? 'grid-column: 1 / -1;' : ''}
            "
            onmouseover="this.style.transform='scale(1.05)'"
            onmouseout="this.style.transform='scale(1)'"
          >
            <img 
              src="${item.url}" 
              alt="Post image ${idx + 1}"
              loading="lazy"
              style="width: 100%; height: 100%; object-fit: cover;"
              onerror="this.style.display='none';"
            />
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Helper function to get SVG icon HTML (for enhanced engagement bar)
 */
function getEngagementIconHTML(iconName) {
  const icons = {
    reply: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: currentColor; width: 1.25rem; height: 1.25rem; vertical-align: middle; display: inline-block;">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <path d="M8 10h8M8 14h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    </svg>`,
    repost: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: currentColor; width: 1.25rem; height: 1.25rem; vertical-align: middle; display: inline-block;">
      <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>`,
    like: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: currentColor; width: 1.25rem; height: 1.25rem; vertical-align: middle; display: inline-block;">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/>
    </svg>`,
    view: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: currentColor; width: 1.25rem; height: 1.25rem; vertical-align: middle; display: inline-block;">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity="0.2"/>
    </svg>`,
  };
  return icons[iconName] || '';
}

/**
 * Render enhanced engagement bar
 */
function renderEnhancedEngagementBar(post) {
  const stats = post.stats || {};
  
  const buttons = [
    {
      icon: getEngagementIconHTML('reply'),
      count: stats.comments || stats.replies || 0,
      label: 'Comments',
      color: 'rgb(113, 118, 123)',
      hoverColor: 'rgb(29, 155, 240)',
      href: post.url || post.link || `https://x.com/newsnoteworthy/status/${post.id}`,
    },
    {
      icon: getEngagementIconHTML('repost'),
      count: stats.reposts || 0,
      label: 'Reposts',
      color: 'rgb(113, 118, 123)',
      hoverColor: 'rgb(0, 186, 124)',
      href: post.url || post.link || `https://x.com/newsnoteworthy/status/${post.id}`,
    },
    {
      icon: getEngagementIconHTML('like'),
      count: stats.likes || 0,
      label: 'Likes',
      color: 'rgb(113, 118, 123)',
      hoverColor: 'rgb(249, 24, 128)',
      href: post.url || post.link || `https://x.com/newsnoteworthy/status/${post.id}`,
    },
    {
      icon: getEngagementIconHTML('view'),
      count: stats.views || stats.impressions || 0,
      label: 'Views',
      color: 'rgb(113, 118, 123)',
      hoverColor: 'rgb(29, 155, 240)',
      href: post.url || post.link || `https://x.com/newsnoteworthy/status/${post.id}`,
    },
  ];
  
  return buttons.map(btn => `
    <a
      href="${btn.href}"
      target="_blank"
      rel="noopener noreferrer"
      onclick="event.stopPropagation()"
      class="enhanced-engagement-btn"
      style="
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        color: ${btn.color};
        text-decoration: none;
        border-radius: 20px;
        transition: all 0.2s ease;
        min-width: 60px;
        justify-content: center;
      "
      title="${btn.label}: ${formatCount(btn.count)}"
      aria-label="${btn.label}"
      onmouseover="this.style.color='${btn.hoverColor}'; this.style.backgroundColor='rgba(29, 155, 240, 0.1)'"
      onmouseout="this.style.color='${btn.color}'; this.style.backgroundColor='transparent'"
    >
      <span style="display: inline-flex; align-items: center; line-height: 1;">${btn.icon}</span>
      <span style="font-size: 0.875rem; line-height: 1; font-weight: 500;">${formatCount(btn.count)}</span>
    </a>
  `).join('');
}

/**
 * Render skeleton loading state
 */
function renderSkeletonCards(count = 5) {
  // Ensure pulse animation is available
  if (!document.getElementById('skeleton-pulse-animation')) {
    const style = document.createElement('style');
    style.id = 'skeleton-pulse-animation';
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `;
    document.head.appendChild(style);
  }
  
  return Array.from({ length: count }, (_, i) => `
    <article 
      class="feed-post-card skeleton"
      style="
        padding: 1.5rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        min-height: 520px;
      "
    >
      <div style="display: flex; gap: 0.75rem; margin-bottom: 1.5rem;">
        <div style="
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: rgba(255,255,255,0.1);
          animation: pulse 1.5s ease-in-out infinite;
        "></div>
        <div style="flex: 1;">
          <div style="
            height: 18px;
            width: 200px;
            background: rgba(255,255,255,0.1);
            border-radius: 4px;
            margin-bottom: 0.75rem;
            animation: pulse 1.5s ease-in-out infinite;
          "></div>
          <div style="
            height: 16px;
            width: 150px;
            background: rgba(255,255,255,0.08);
            border-radius: 4px;
            animation: pulse 1.5s ease-in-out infinite;
          "></div>
        </div>
      </div>
      <div style="margin-bottom: 1.5rem;">
        <div style="
          height: 18px;
          width: 100%;
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
          margin-bottom: 0.75rem;
          animation: pulse 1.5s ease-in-out infinite;
        "></div>
        <div style="
          height: 18px;
          width: 95%;
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
          margin-bottom: 0.75rem;
          animation: pulse 1.5s ease-in-out infinite;
        "></div>
        <div style="
          height: 18px;
          width: 90%;
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
          margin-bottom: 0.75rem;
          animation: pulse 1.5s ease-in-out infinite;
        "></div>
        <div style="
          height: 18px;
          width: 85%;
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
          margin-bottom: 0.75rem;
          animation: pulse 1.5s ease-in-out infinite;
        "></div>
        <div style="
          height: 18px;
          width: 70%;
          background: rgba(255,255,255,0.08);
          border-radius: 4px;
          margin-bottom: 1.5rem;
          animation: pulse 1.5s ease-in-out infinite;
        "></div>
      </div>
      <div style="
        height: 400px;
        width: 100%;
        background: rgba(255,255,255,0.08);
        border-radius: 12px;
        margin-bottom: 1.5rem;
        animation: pulse 1.5s ease-in-out infinite;
      "></div>
      <div style="
        display: flex;
        gap: 2rem;
        padding-top: 0.75rem;
      ">
        <div style="
          height: 20px;
          width: 60px;
          background: rgba(255,255,255,0.05);
          border-radius: 4px;
          animation: pulse 1.5s ease-in-out infinite;
        "></div>
        <div style="
          height: 20px;
          width: 60px;
          background: rgba(255,255,255,0.05);
          border-radius: 4px;
          animation: pulse 1.5s ease-in-out infinite;
        "></div>
        <div style="
          height: 20px;
          width: 60px;
          background: rgba(255,255,255,0.05);
          border-radius: 4px;
          animation: pulse 1.5s ease-in-out infinite;
        "></div>
        <div style="
          height: 20px;
          width: 60px;
          background: rgba(255,255,255,0.05);
          border-radius: 4px;
          animation: pulse 1.5s ease-in-out infinite;
        "></div>
      </div>
    </article>
  `).join('');
}

/**
 * Load posts from API with chunked loading
 */
async function loadEnhancedPosts(endpoint = '/.netlify/functions/posts-read', limit = 20, resetDisplayCount = true) {
  // Prevent concurrent loads and infinite recursion
  if (enhancedIsLoading) {
    console.warn('[Enhanced Feed] Already loading, skipping duplicate call');
    return;
  }
  
  enhancedIsLoading = true;
  const container = document.getElementById('articlesTrack');
  if (!container) {
    console.error('[Enhanced Feed] Container not found');
    enhancedIsLoading = false;
    return;
  }
  
  // Reset display count if this is a fresh load
  if (resetDisplayCount) {
    enhancedDisplayedCount = 5; // Always start with 5 posts
    
    // Try to load from cache first for instant display
    try {
      const cached = localStorage.getItem(ENHANCED_CACHE_KEY);
      if (cached) {
        const { posts, timestamp, version } = JSON.parse(cached);
        // Check cache version and expiry
        const isVersionValid = version === ENHANCED_CACHE_VERSION;
        const isNotExpired = Date.now() - timestamp < 300000; // 5 minutes
        // Use cache if version matches and less than 5 minutes old
        if (posts && posts.length > 0 && isVersionValid && isNotExpired) {
          enhancedCurrentPosts = posts.filter(
            post => !isLowMagnitudeEarthquakeEnhanced(post) && !isExcludedAlertEnhanced(post)
          );
          // Render first 5 posts instantly from cache
          renderEnhancedFeed();
          setupInfiniteScroll();
          // Continue to fetch fresh data in background
        } else if (!isVersionValid) {
          // Cache version mismatch - clear it
          console.log('[Enhanced Feed] Cache version mismatch, clearing cache');
          localStorage.removeItem(ENHANCED_CACHE_KEY);
        }
      }
    } catch (e) {
      console.warn('[Enhanced Feed] Cache read failed:', e);
    }
    
    // Show simple loading state (no skeleton shimmer) while fetching
    if (enhancedCurrentPosts.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 3rem 2rem; text-align: center; color: rgba(255,255,255,0.85);">
          <p style="font-size: 1.125rem; margin: 0; font-weight: 500;">Loading posts…</p>
        </div>
      `;
    }
  } else {
    // Add loading indicator at the bottom for additional posts
    const loadingIndicator = document.getElementById('enhanced-feed-loading');
    if (!loadingIndicator) {
      const loader = document.createElement('div');
      loader.id = 'enhanced-feed-loading';
      loader.style.cssText = `
        padding: 2rem;
        text-align: center;
        color: rgba(255,255,255,0.7);
      `;
      loader.innerHTML = '<div style="font-size: 1.5rem; margin-bottom: 0.5rem;">⏳</div><p>Loading more posts...</p>';
      container.appendChild(loader);
    }
  }
  
  try {
    let data = null;
    
    // Helper to check if data actually has posts
    const hasValidPosts = (d) => {
      if (!d) return false;
      // Handle array format
      if (Array.isArray(d) && d.length > 0) return true;
      // Handle object format with posts/data property
      if (d.posts && Array.isArray(d.posts) && d.posts.length > 0) return true;
      if (d.data && Array.isArray(d.data) && d.data.length > 0) return true;
      return false;
    };
    
    // PRIORITY 1: Check if prefetched data is available AND has actual posts
    if (window.__BREAKING_NEWS_DATA_RESOLVED__ && hasValidPosts(window.__BREAKING_NEWS_DATA_RESOLVED__)) {
      data = window.__BREAKING_NEWS_DATA_RESOLVED__;
      console.log('[Enhanced Feed] Using prefetched data for instant load');
    }
    // PRIORITY 2: Try to await the prefetched promise if it exists
    else if (window.__BREAKING_NEWS_DATA__) {
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 1000)
        );
        const prefetchedData = await Promise.race([window.__BREAKING_NEWS_DATA__, timeoutPromise]);
        if (hasValidPosts(prefetchedData)) {
          data = prefetchedData;
          window.__BREAKING_NEWS_DATA_RESOLVED__ = data;
          console.log('[Enhanced Feed] Used prefetched promise for instant load');
        } else {
          console.log('[Enhanced Feed] Prefetched data is empty, falling back to direct fetch');
          data = null;
        }
      } catch (e) {
        // Timeout or error - fall through to direct fetch
        console.log('[Enhanced Feed] Prefetch timeout/error, falling back to direct fetch');
        data = null;
      }
    }
    
    // PRIORITY 3: Fetch directly if no valid prefetched data
    if (!data) {
      console.log('[Enhanced Feed] Fetching posts directly from API...');
      const response = await fetch(`${endpoint}?limit=${limit}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
      console.log('[Enhanced Feed] Direct fetch result:', Array.isArray(data) ? data.length + ' posts' : (data?.posts?.length || data?.data?.length || 0) + ' posts');
    }
    
    // Handle both array response and object with posts property
    let posts = Array.isArray(data) ? data : (data.posts || data.data || []);
    enhancedCurrentPosts = (posts || []).filter(
      post => !isLowMagnitudeEarthquakeEnhanced(post) && !isExcludedAlertEnhanced(post)
    );
    // If API returned empty, use fallback so cards always show something
    if (enhancedCurrentPosts.length === 0) {
      enhancedCurrentPosts = [...FALLBACK_POSTS];
      console.log('[Enhanced Feed] API returned no posts, using fallback sample posts');
    }
    
    console.log('[Enhanced Feed] Loaded', enhancedCurrentPosts.length, 'posts');

    // Cache posts with version
    localStorage.setItem(ENHANCED_CACHE_KEY, JSON.stringify({
      posts: enhancedCurrentPosts,
      timestamp: Date.now(),
      version: ENHANCED_CACHE_VERSION,
    }));
    
    // Update current limit
    enhancedCurrentLimit = limit;
    
    // Render with chunked display (will update if cache was used)
    renderEnhancedFeed();
    
    // Set up infinite scroll after initial render
    if (resetDisplayCount) {
      setupInfiniteScroll();
    }
  } catch (error) {
    console.error('[Enhanced Feed] Load error:', error);
    // Use fallback posts so cards always load (e.g. when API 404 in local dev)
    enhancedCurrentPosts = [...FALLBACK_POSTS];
    renderEnhancedFeed();
    // Prepend a small notice so user knows they're seeing sample posts
    const notice = document.createElement('div');
    notice.className = 'feed-fallback-notice';
    notice.style.cssText = 'grid-column: 1 / -1; padding: 0.75rem 1rem; margin-bottom: 0.5rem; background: rgba(79, 172, 254, 0.15); border: 1px solid rgba(79, 172, 254, 0.3); border-radius: 8px; color: rgba(255,255,255,0.9); font-size: 0.875rem;';
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    notice.innerHTML = 'Showing sample posts. ' + (isLocal ? 'Run <code>netlify dev</code> to load live posts.' : 'Live posts will appear when the API is available.');
    container.insertBefore(notice, container.firstChild);
  } finally {
    // Remove loading indicator
    const loadingIndicator = document.getElementById('enhanced-feed-loading');
    if (loadingIndicator) {
      loadingIndicator.remove();
    }
    enhancedIsLoading = false;
  }
}

/**
 * Search posts
 */
function searchEnhancedPosts(posts, query) {
  if (!query.trim()) return posts;
  const lowerQuery = query.toLowerCase();
  return posts.filter(post => {
    const text = (post.text || post.story || post.title || '').toLowerCase();
    const handle = (post.author?.handle || 'newsnoteworthy').toLowerCase();
    const tags = (post.tags || []).join(' ').toLowerCase();
    return text.includes(lowerQuery) || handle.includes(lowerQuery) || tags.includes(lowerQuery);
  });
}

/**
 * Sort posts
 */
function sortEnhancedPosts(posts, sortMode) {
  const sorted = [...posts];
  switch (sortMode) {
    case 'views':
      sorted.sort((a, b) => (b.stats?.views || 0) - (a.stats?.views || 0));
      break;
    case 'likes':
      sorted.sort((a, b) => (b.stats?.likes || 0) - (a.stats?.likes || 0));
      break;
    case 'comments':
      sorted.sort((a, b) => (b.stats?.comments || b.stats?.replies || 0) - (a.stats?.comments || a.stats?.replies || 0));
      break;
    case 'reposts':
      sorted.sort((a, b) => (b.stats?.reposts || 0) - (a.stats?.reposts || 0));
      break;
    default: // recent
      sorted.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.datePosted || 0);
        const dateB = new Date(b.createdAt || b.datePosted || 0);
        return dateB - dateA;
      });
  }
  return sorted;
}

/**
 * Render enhanced feed with chunked display
 */
function renderEnhancedFeed() {
  const container = document.getElementById('articlesTrack');
  if (!container) return;
  
  // Filter and sort
  let filtered = searchEnhancedPosts(enhancedCurrentPosts, enhancedCurrentSearch);
  const pinned = filtered.filter(p => p.isPinned);
  const unpinned = filtered.filter(p => !p.isPinned);
  const sorted = [...pinned, ...sortEnhancedPosts(unpinned, enhancedCurrentSort)];

  if (sorted.length === 0) {
    // Show clear empty state (no skeleton/shimmer)
    container.innerHTML = `
      <div class="feed-empty-state" style="grid-column: 1 / -1; padding: 3rem 2rem; text-align: center; background: rgba(13, 31, 58, 0.4); border-radius: 16px; border: 1px solid rgba(74, 158, 255, 0.15); color: rgba(255,255,255,0.9);">
        <p style="font-size: 1.125rem; margin: 0 0 0.5rem 0; font-weight: 600;">No posts yet</p>
        <p style="font-size: 0.9375rem; margin: 0; color: rgba(255,255,255,0.7);">Check back soon for breaking news and updates.</p>
      </div>
    `;
    return;
  }
  
  // Only render posts up to the displayed count
  const postsToRender = sorted.slice(0, enhancedDisplayedCount);
  container.innerHTML = postsToRender.map(post => renderEnhancedPostCard(post)).join('');
  
  // Add sentinel element for infinite scroll if there are more posts to load
  // Note: For horizontal scrolling, we use scroll event listener instead of sentinel
  // But we keep sentinel for vertical scrolling compatibility
  if (enhancedDisplayedCount < sorted.length) {
    let sentinel = document.getElementById('enhanced-feed-sentinel');
    if (!sentinel) {
      sentinel = document.createElement('div');
      sentinel.id = 'enhanced-feed-sentinel';
      // Sentinel for vertical scrolling (at bottom)
      sentinel.style.cssText = 'height: 100px; width: 100%; margin-top: 20px; grid-column: 1 / -1;';
      container.appendChild(sentinel);
    }
  } else {
    // Remove sentinel if all posts are displayed
    const sentinel = document.getElementById('enhanced-feed-sentinel');
    if (sentinel) {
      sentinel.remove();
    }
  }
  
  // Add CSS animations if not already added
  if (!document.getElementById('enhanced-feed-styles')) {
    const style = document.createElement('style');
    style.id = 'enhanced-feed-styles';
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
      .feed-post-card.enhanced {
        animation: fadeIn 0.3s ease;
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      #enhanced-feed-loading {
        animation: pulse 1.5s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Load more posts when user scrolls near bottom
 */
async function loadMorePosts() {
  // Filter and sort to get total available posts
  let filtered = searchEnhancedPosts(enhancedCurrentPosts, enhancedCurrentSearch);
  const pinned = filtered.filter(p => p.isPinned);
  const unpinned = filtered.filter(p => !p.isPinned);
  const sorted = [...pinned, ...sortEnhancedPosts(unpinned, enhancedCurrentSort)];
  
  // Check if we need to fetch more posts from API
  // If we're within 5 posts of the end (more aggressive), fetch more
  const remainingPosts = sorted.length - enhancedDisplayedCount;
  if (remainingPosts <= 5 && !enhancedIsLoading) {
    // Fetch more posts from API
    const newLimit = enhancedCurrentLimit + 20; // Fetch 20 more posts
    console.log(`[Enhanced Feed] Fetching more posts: ${newLimit} total (currently showing ${enhancedDisplayedCount} of ${sorted.length})`);
    await loadEnhancedPosts(enhancedEndpoint, newLimit, false); // false = don't reset display count
    // After fetching, re-filter and sort
    filtered = searchEnhancedPosts(enhancedCurrentPosts, enhancedCurrentSearch);
    const newPinned = filtered.filter(p => p.isPinned);
    const newUnpinned = filtered.filter(p => !p.isPinned);
    const newSorted = [...newPinned, ...sortEnhancedPosts(newUnpinned, enhancedCurrentSort)];
    
    // Check if there are more posts to load
    if (enhancedDisplayedCount >= newSorted.length) {
      // No more posts to load, remove observer and scroll listener
      if (enhancedScrollObserver) {
        enhancedScrollObserver.disconnect();
        enhancedScrollObserver = null;
      }
      const container = document.getElementById('articlesTrack');
      if (container && container._enhancedScrollHandler) {
        container.removeEventListener('scroll', container._enhancedScrollHandler);
        container._enhancedScrollHandler = null;
      }
      return;
    }
    
    // Increase displayed count by chunk size
    enhancedDisplayedCount = Math.min(enhancedDisplayedCount + enhancedPostsPerChunk, newSorted.length);
    
    // Re-render with more posts
    renderEnhancedFeed();
    
    // Re-setup observer for next batch
    setupInfiniteScroll();
    return;
  }
  
  // Check if there are more posts to load from current cache
  if (enhancedDisplayedCount >= sorted.length) {
    // No more posts to load, remove observer and scroll listener
    if (enhancedScrollObserver) {
      enhancedScrollObserver.disconnect();
      enhancedScrollObserver = null;
    }
    const container = document.getElementById('articlesTrack');
    if (container && container._enhancedScrollHandler) {
      container.removeEventListener('scroll', container._enhancedScrollHandler);
      container._enhancedScrollHandler = null;
    }
    return;
  }
  
  // Increase displayed count
  enhancedDisplayedCount = Math.min(enhancedDisplayedCount + enhancedPostsPerChunk, sorted.length);
  
  // Re-render with more posts
  renderEnhancedFeed();
  
  // Re-setup observer for next batch
  setupInfiniteScroll();
}

/**
 * Generate a "tk tk" scroll sound effect using Web Audio API
 */
let scrollSoundAudioContext = null;
let lastScrollSoundTime = 0;
const SCROLL_SOUND_THROTTLE = 150; // Minimum milliseconds between sounds

function playScrollSound() {
  // Throttle to prevent too many sounds
  const now = Date.now();
  if (now - lastScrollSoundTime < SCROLL_SOUND_THROTTLE) {
    return;
  }
  lastScrollSoundTime = now;

  try {
    // Initialize audio context if needed
    if (!scrollSoundAudioContext) {
      scrollSoundAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Resume audio context if suspended (browser autoplay policy)
    if (scrollSoundAudioContext.state === 'suspended') {
      scrollSoundAudioContext.resume().catch(() => {
        // Silently fail if resume is not allowed
        return;
      });
    }

    // Create a short "tk tk" click sound
    const oscillator = scrollSoundAudioContext.createOscillator();
    const gainNode = scrollSoundAudioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(scrollSoundAudioContext.destination);

    // Configure the sound: short, high-pitched click
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, scrollSoundAudioContext.currentTime); // Higher pitch for "tk"
    oscillator.frequency.exponentialRampToValueAtTime(400, scrollSoundAudioContext.currentTime + 0.01);

    // Quick fade in/out for clean click sound
    gainNode.gain.setValueAtTime(0, scrollSoundAudioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.15, scrollSoundAudioContext.currentTime + 0.001); // Low volume
    gainNode.gain.exponentialRampToValueAtTime(0.01, scrollSoundAudioContext.currentTime + 0.02);
    gainNode.gain.linearRampToValueAtTime(0, scrollSoundAudioContext.currentTime + 0.03);

    oscillator.start(scrollSoundAudioContext.currentTime);
    oscillator.stop(scrollSoundAudioContext.currentTime + 0.03); // Very short duration
  } catch (e) {
    // Silently fail if audio context can't be created (e.g., user hasn't interacted)
    console.debug('[Scroll Sound] Could not play sound:', e.message);
  }
}

/**
 * Set up scroll sound effect listener
 */
function setupScrollSound(container) {
  if (!container) return;

  // Remove existing scroll sound listener if any
  if (container._scrollSoundHandler) {
    container.removeEventListener('scroll', container._scrollSoundHandler, { passive: true });
    container._scrollSoundHandler = null;
  }

  // Add scroll sound effect
  let scrollSoundThrottle;
  container._scrollSoundHandler = () => {
    clearTimeout(scrollSoundThrottle);
    scrollSoundThrottle = setTimeout(() => {
      playScrollSound();
    }, 50); // Small delay to batch rapid scroll events
  };

  container.addEventListener('scroll', container._scrollSoundHandler, { passive: true });
}

/**
 * Set up infinite scroll using Intersection Observer and scroll event listener
 * Supports both vertical and horizontal scrolling
 */
function setupInfiniteScroll() {
  const container = document.getElementById('articlesTrack');
  if (!container) return;
  
  // Disconnect existing observer
  if (enhancedScrollObserver) {
    enhancedScrollObserver.disconnect();
    enhancedScrollObserver = null;
  }
  
  // Remove existing scroll listener if any
  if (container._enhancedScrollHandler) {
    container.removeEventListener('scroll', container._enhancedScrollHandler);
    container._enhancedScrollHandler = null;
  }
  
  // Check if we have more posts to load
  let filtered = searchEnhancedPosts(enhancedCurrentPosts, enhancedCurrentSearch);
  const pinned = filtered.filter(p => p.isPinned);
  const unpinned = filtered.filter(p => !p.isPinned);
  const sorted = [...pinned, ...sortEnhancedPosts(unpinned, enhancedCurrentSort)];
  
  if (enhancedDisplayedCount >= sorted.length) {
    // All posts are already displayed
    return;
  }
  
  // Check if container scrolls horizontally
  const containerStyle = window.getComputedStyle(container);
  const scrollsHorizontally = containerStyle.overflowX === 'auto' || containerStyle.overflowX === 'scroll';
  
  if (scrollsHorizontally) {
    // For horizontal scrolling, use scroll event listener
    let scrollTimeout;
    container._enhancedScrollHandler = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        // Check if user has scrolled near the right edge
        const scrollLeft = container.scrollLeft;
        const scrollWidth = container.scrollWidth;
        const clientWidth = container.clientWidth;
        const distanceFromRight = scrollWidth - (scrollLeft + clientWidth);
        
        // Load more when within 500px of the right edge (more aggressive for horizontal)
        if (distanceFromRight <= 500 && !enhancedIsLoading) {
          console.log('[Enhanced Feed] Horizontal scroll detected, loading more posts', {
            scrollLeft,
            scrollWidth,
            clientWidth,
            distanceFromRight
          });
          loadMorePosts();
        }
      }, 100); // Debounce scroll events
    };
    
    container.addEventListener('scroll', container._enhancedScrollHandler, { passive: true });
    
    // Also check immediately in case user is already scrolled to the right
    container._enhancedScrollHandler();
  } else {
    // For vertical scrolling, use Intersection Observer
    // Find the sentinel element (should already exist from renderEnhancedFeed)
    const sentinel = document.getElementById('enhanced-feed-sentinel');
    if (!sentinel) {
      // If sentinel doesn't exist, create it
      const newSentinel = document.createElement('div');
      newSentinel.id = 'enhanced-feed-sentinel';
      newSentinel.style.cssText = 'height: 100px; width: 100%; margin-top: 20px;';
      container.appendChild(newSentinel);
      
      // Set up Intersection Observer
      enhancedScrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !enhancedIsLoading) {
            loadMorePosts();
          }
        });
      }, {
        rootMargin: '300px', // Start loading when 300px away from bottom
        threshold: 0.01
      });
      enhancedScrollObserver.observe(newSentinel);
      return;
    }
    
    // Set up Intersection Observer on existing sentinel
    enhancedScrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !enhancedIsLoading) {
          loadMorePosts();
        }
      });
    }, {
      rootMargin: '200px', // Start loading when 200px away from bottom
      threshold: 0.1
    });
    
    enhancedScrollObserver.observe(sentinel);
  }

  // Set up scroll sound effect
  setupScrollSound(container);
}

/**
 * Initialize enhanced feed
 */
let enhancedFeedInitialized = false;
let lastContainerId = null;

function initEnhancedFeed(containerId = 'articlesTrack', endpoint = '/.netlify/functions/posts-read', limit = 20) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('[Enhanced Feed] Container not found:', containerId);
    return;
  }
  
  // Prevent duplicate initialization - robust guard
  if (enhancedInitInProgress) {
    console.warn('[Enhanced Feed] Initialization already in progress, skipping duplicate call');
    return;
  }
  
  // Check if container is empty or has very little content (likely needs loading)
  const isEmpty = !container.innerHTML || 
                  container.innerHTML.trim().length < 100 || 
                  container.innerHTML.includes('Loading') || 
                  container.innerHTML.includes('skeleton') ||
                  container.innerHTML.includes('Failed to load');
  
  // Allow re-initialization if container changed or if not initialized yet
  if (enhancedInitDone && lastContainerId === containerId) {
    // But still try to load posts if container is empty
    if (isEmpty && !enhancedIsLoading) {
      console.log('[Enhanced Feed] Re-initializing for empty container');
      // Allow re-init if container is truly empty and not loading
    } else {
      console.warn('[Enhanced Feed] Already initialized for this container, skipping duplicate init');
      return;
    }
  }
  
  enhancedInitInProgress = true;
  enhancedFeedInitialized = true;
  lastContainerId = containerId;
  
  // Expose functions to window (only once)
  if (!window.togglePostExpand) {
  window.togglePostExpand = togglePostExpand;
  }
  if (!window.sharePostEnhanced) {
  window.sharePostEnhanced = sharePost;
  }
  if (!window.openMediaLightbox) {
  window.openMediaLightbox = openMediaLightbox;
  }
  // Always update loadEnhancedPosts to use current endpoint/limit
  // Store endpoint and limit in closure to prevent recursion
  enhancedEndpoint = endpoint;
  enhancedCurrentLimit = limit;
  const savedEndpoint = endpoint;
  const savedLimit = limit;
  
  // Get a direct reference to the actual function before any potential reassignment
  // This ensures we always call the real function, not a wrapper
  const actualLoadFunction = (function getLoadFunction() {
    return loadEnhancedPosts;
  })();
  
  // Create a wrapper that calls the actual function directly
  window.loadEnhancedPosts = async function() {
    if (enhancedIsLoading) {
      console.warn('[Enhanced Feed] Already loading, skipping...');
      return Promise.resolve();
    }
    // Call the actual function directly using the captured reference
    // This prevents infinite recursion by ensuring we never call window.loadEnhancedPosts
    return actualLoadFunction.call(null, savedEndpoint, savedLimit);
  };
  if (!window.renderEnhancedFeed) {
  window.renderEnhancedFeed = renderEnhancedFeed;
  }
  
  // Mark initialization as complete
  enhancedInitDone = true;
  enhancedInitInProgress = false;
  
  // Load posts (only once)
  if (!enhancedIsLoading) {
    loadEnhancedPosts(endpoint, limit);
  }
  
  // Set up search and sort handlers (if controls exist)
  const searchInput = document.querySelector('.feed-search-input');
  const sortSelect = document.querySelector('.feed-sort-select');
  
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        enhancedCurrentSearch = e.target.value;
        localStorage.setItem('feed-search', enhancedCurrentSearch);
        // Reset display count when search changes
        enhancedDisplayedCount = 5;
        // Disconnect observer before re-rendering
        if (enhancedScrollObserver) {
          enhancedScrollObserver.disconnect();
          enhancedScrollObserver = null;
        }
        renderEnhancedFeed();
        setupInfiniteScroll();
      }, 300);
    });
  }
  
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      enhancedCurrentSort = e.target.value;
      localStorage.setItem('feed-sort', enhancedCurrentSort);
      // Reset display count when sort changes
      enhancedDisplayedCount = 5;
      // Disconnect observer before re-rendering
      if (enhancedScrollObserver) {
        enhancedScrollObserver.disconnect();
        enhancedScrollObserver = null;
      }
      renderEnhancedFeed();
      setupInfiniteScroll();
    });
  }
}

// Export for use
if (typeof window !== 'undefined') {
  window.renderPostFeedEnhanced = initEnhancedFeed;
  // Also export skeleton function for immediate use
  window.renderPostFeedEnhanced.renderSkeletonCards = renderSkeletonCards;
  // Export cache clearing function
  window.clearEnhancedFeedCache = function() {
    localStorage.removeItem(ENHANCED_CACHE_KEY);
    console.log('[Enhanced Feed] Cache cleared. Refresh the page to see updated posts.');
    return true;
  };

  // Self-initialize when script loads: if the feed container exists and shows loading/empty state, load posts.
  // This ensures cards load even if this script runs after DOMContentLoaded (e.g. slow script load).
  function trySelfInit() {
    const container = document.getElementById('articlesTrack');
    if (!container) return;
    const html = (container.innerHTML || '').trim();
    const needsLoad = html.length < 100 ||
      html.includes('Loading') ||
      html.includes('postsLoadingIndicator') ||
      (html.includes('skeleton') && !html.includes('feed-post-card'));
    if (needsLoad && !enhancedInitInProgress && !enhancedInitDone) {
      console.log('[Enhanced Feed] Self-init: container ready, loading posts');
      initEnhancedFeed('articlesTrack', '/.netlify/functions/posts-read', 20);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trySelfInit);
  } else {
    trySelfInit();
  }
}

