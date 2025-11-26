/**
 * Post Feed v2 - Refactored X-style feed
 * Replaces post-feed.js with modern, professional implementation
 */

// Import types and utilities (compiled from TypeScript)
// Note: In production, these would be compiled TS files
// For now, we'll include the logic inline

const CACHE_KEY = 'noteworthy-posts-cache-v2';
const CACHE_EXPIRY = 2 * 60 * 1000; // 2 minutes

let isLoading = false;
let currentSort = localStorage.getItem('feed-sort') || 'recent';
let currentSearch = localStorage.getItem('feed-search') || '';
let currentPosts = [];
let commentDrawerOpen = false;
let commentDrawerPostId = null;
let userLocation = null; // { lat, lng } or null
let locationPermissionRequested = false;

/**
 * Format count with abbreviations
 */
function formatCount(n) {
  if (n === undefined || n === null || isNaN(n)) return '0';
  if (n < 1000) return n.toString();
  if (n < 1000000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  if (n < 1000000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  return (n / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
}

/**
 * Format relative time - Always shows date, uses seconds/minutes/hours for < 1 day
 * Shows actual date for posts older than 1 month
 */
function formatRelativeTime(dateString) {
  if (!dateString) return 'Just now';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  
  // If date is invalid
  if (isNaN(date.getTime())) return 'Just now';
  
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  // If less than 1 day ago, show seconds/minutes/hours
  if (diffDay < 1) {
    if (diffSec < 60) return `${diffSec}${diffSec === 1 ? ' second' : ' seconds'} ago`;
    if (diffMin < 60) return `${diffMin}${diffMin === 1 ? ' minute' : ' minutes'} ago`;
    return `${diffHour}${diffHour === 1 ? ' hour' : ' hours'} ago`;
  }
  
  // Calculate time differences
  const diffWeek = Math.floor(diffDay / 7);
  // Use actual month calculation to avoid "0 months"
  const yearDiff = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth() + (yearDiff * 12);
  const diffYear = Math.floor(diffDay / 365);
  
  // Less than 1 week
  if (diffDay === 1) return '1 day ago';
  if (diffDay < 7) return `${diffDay} days ago`;
  
  // Less than 4 weeks (but show weeks, not months if less than 30 days)
  if (diffWeek < 4) return `${diffWeek}${diffWeek === 1 ? ' week' : ' weeks'} ago`;
  
  // If less than 30 days, show days instead of months to avoid "0 months"
  if (diffDay < 30) return `${diffDay} days ago`;
  
  // For posts older than 1 month, show actual date
  // Format: "Jan 15" or "Jan 15, 2024" if different year
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  const currentYear = now.getFullYear();
  
  // If same year, show "Jan 15", otherwise "Jan 15, 2024"
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
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

/**
 * Map raw post to normalized Post structure
 */
function mapRawPostToPost(raw) {
  const author = {
    name: raw.author || 'Noteworthy News',
    handle: 'newsnoteworthy',
    avatarUrl: '/IMG_5794.PNG',
    verified: false,
  };

  const createdAt = raw.datePosted || raw.createdAt || raw.created_at || new Date().toISOString();

  const media = [];
  if (raw.images && raw.images.length > 0) {
    raw.images.forEach(url => {
      if (url) media.push({ type: 'image', url });
    });
  } else if (raw.image) {
    media.push({ type: 'image', url: raw.image });
  }
  if (raw.videos && raw.videos.length > 0) {
    raw.videos.forEach(url => {
      if (url) media.push({ type: 'video', url });
    });
  }

  const stats = {
    views: raw.views ?? 0,
    likes: raw.likes ?? 0,
    comments: raw.replies ?? raw.comments ?? 0,
    reposts: raw.reposts ?? 0,
    bookmarks: raw.bookmarks,
  };

  return {
    id: raw.id,
    author,
    createdAt,
    text: raw.story || raw.text || raw.title || '',
    media: media.length > 0 ? media : undefined,
    stats,
    tags: raw.tags,
    url: raw.link || raw.url || `https://x.com/newsnoteworthy/status/${raw.id}`,
    isPinned: raw.isPinned,
  };
}

/**
 * Extract location mentions from post text
 * Simple heuristic: looks for common location patterns
 */
function extractLocationFromPost(post) {
  const text = (post.text || '').toLowerCase();
  const locations = [];
  
  // Common location indicators
  const locationPatterns = [
    // City, State format
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\b/g,
    // "in [City]", "from [City]", "at [City]"
    /\b(in|from|at|near|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g,
    // Country names (common ones)
    /\b(USA|United States|UK|United Kingdom|Canada|Mexico|Brazil|India|China|Japan|Australia|Germany|France|Italy|Spain|Russia)\b/gi,
    // State names (US)
    /\b(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)\b/gi,
  ];
  
  // Try to extract locations
  locationPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const location = match[2] || match[1] || match[0];
      if (location && location.length > 2) {
        locations.push(location.trim());
      }
    }
  });
  
  // Also check tags for location keywords
  if (post.tags) {
    post.tags.forEach(tag => {
      const tagLower = tag.toLowerCase();
      // Check if tag looks like a location
      if (tagLower.includes('location') || tagLower.includes('city') || tagLower.includes('region') || tagLower.includes('state') || tagLower.includes('country')) {
        locations.push(tag);
      }
    });
  }
  
  return locations.length > 0 ? locations[0] : null;
}

/**
 * Get user's location from IP address (geolocation service)
 */
async function getUserLocation() {
  if (userLocation) return userLocation;
  if (locationPermissionRequested) return null;
  
  locationPermissionRequested = true;
  
  try {
    // Try cached location first
    const cached = localStorage.getItem('user-location');
    const cachedTime = localStorage.getItem('user-location-time');
    if (cached && cachedTime) {
      const age = Date.now() - parseInt(cachedTime, 10);
      if (age < 24 * 60 * 60 * 1000) { // 24 hours
        userLocation = JSON.parse(cached);
        console.log('[Feed] Using cached location:', userLocation);
        return userLocation;
      }
    }
    
    // Fetch location from IP using free IP geolocation service
    const response = await fetch('https://ipapi.co/json/', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.latitude && data.longitude) {
      userLocation = {
        lat: parseFloat(data.latitude),
        lng: parseFloat(data.longitude),
        city: data.city,
        region: data.region,
        country: data.country_name,
      };
      
      localStorage.setItem('user-location', JSON.stringify(userLocation));
      localStorage.setItem('user-location-time', Date.now().toString());
      console.log('[Feed] User location from IP:', userLocation);
      return userLocation;
    }
    
    console.warn('[Feed] IP geolocation did not return coordinates');
    return null;
  } catch (error) {
    console.error('[Feed] Failed to get location from IP:', error);
    
    // Try fallback service
    try {
      const fallbackResponse = await fetch('https://freeipapi.com/api/json/', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        if (fallbackData.latitude && fallbackData.longitude) {
          userLocation = {
            lat: parseFloat(fallbackData.latitude),
            lng: parseFloat(fallbackData.longitude),
            city: fallbackData.cityName,
            region: fallbackData.regionName,
            country: fallbackData.countryName,
          };
          
          localStorage.setItem('user-location', JSON.stringify(userLocation));
          localStorage.setItem('user-location-time', Date.now().toString());
          console.log('[Feed] User location from fallback IP service:', userLocation);
          return userLocation;
        }
      }
    } catch (fallbackError) {
      console.error('[Feed] Fallback IP service also failed:', fallbackError);
    }
    
    return null;
  }
}

/**
 * Calculate approximate distance score between user location and post
 * Enhanced with IP-based location matching
 */
function calculateLocationRelevance(post, userLoc) {
  if (!userLoc) return 0;
  
  const postLocation = extractLocationFromPost(post);
  if (!postLocation) return 0;
  
  const postText = (post.text || '').toLowerCase();
  const postLocationLower = postLocation.toLowerCase();
  let relevance = 0;
  
  // If post mentions a location, give it base relevance
  if (postLocation) {
    relevance = 50; // Base relevance for having a location
    
    // Boost relevance if location matches user's region
    if (userLoc.city && postText.includes(userLoc.city.toLowerCase())) {
      relevance += 100; // Strong match for same city
    }
    
    if (userLoc.region && postText.includes(userLoc.region.toLowerCase())) {
      relevance += 50; // Match for same state/region
    }
    
    if (userLoc.country && postText.includes(userLoc.country.toLowerCase())) {
      relevance += 25; // Match for same country
    }
    
    // Also check location name directly
    const userCityLower = (userLoc.city || '').toLowerCase();
    const userRegionLower = (userLoc.region || '').toLowerCase();
    const userCountryLower = (userLoc.country || '').toLowerCase();
    
    if (userCityLower && postLocationLower.includes(userCityLower)) {
      relevance += 100;
    } else if (userRegionLower && postLocationLower.includes(userRegionLower)) {
      relevance += 50;
    } else if (userCountryLower && postLocationLower.includes(userCountryLower)) {
      relevance += 25;
    }
  }
  
  return relevance;
}

/**
 * Sort posts
 */
function sortPosts(posts, mode) {
  const sorted = [...posts];
  
  switch (mode) {
    case 'recent':
      sorted.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.datePosted || 0).getTime();
        const dateB = new Date(b.createdAt || b.datePosted || 0).getTime();
        if (dateB !== dateA) return dateB - dateA;
        // Handle missing IDs
        const idA = a.id || '';
        const idB = b.id || '';
        return idB.localeCompare(idA);
      });
      break;
    case 'views':
      sorted.sort((a, b) => {
        const viewsA = (a.stats?.views || a.views || 0);
        const viewsB = (b.stats?.views || b.views || 0);
        const diff = viewsB - viewsA;
        if (diff !== 0) return diff;
        const dateA = new Date(a.createdAt || a.datePosted || 0).getTime();
        const dateB = new Date(b.createdAt || b.datePosted || 0).getTime();
        return dateB - dateA;
      });
      break;
    case 'likes':
      sorted.sort((a, b) => {
        const likesA = (a.stats?.likes || a.likes || 0);
        const likesB = (b.stats?.likes || b.likes || 0);
        const diff = likesB - likesA;
        if (diff !== 0) return diff;
        const dateA = new Date(a.createdAt || a.datePosted || 0).getTime();
        const dateB = new Date(b.createdAt || b.datePosted || 0).getTime();
        return dateB - dateA;
      });
      break;
    case 'comments':
      sorted.sort((a, b) => {
        const commentsA = (a.stats?.comments || a.replies || a.comments || 0);
        const commentsB = (b.stats?.comments || b.replies || b.comments || 0);
        const diff = commentsB - commentsA;
        if (diff !== 0) return diff;
        const dateA = new Date(a.createdAt || a.datePosted || 0).getTime();
        const dateB = new Date(b.createdAt || b.datePosted || 0).getTime();
        return dateB - dateA;
      });
      break;
    case 'reposts':
      sorted.sort((a, b) => {
        const repostsA = (a.stats?.reposts || a.reposts || 0);
        const repostsB = (b.stats?.reposts || b.reposts || 0);
        const diff = repostsB - repostsA;
        if (diff !== 0) return diff;
        const dateA = new Date(a.createdAt || a.datePosted || 0).getTime();
        const dateB = new Date(b.createdAt || b.datePosted || 0).getTime();
        return dateB - dateA;
      });
      break;
    case 'nearby':
      // Sort by location relevance (requires user location)
      if (userLocation) {
        sorted.sort((a, b) => {
          const relevanceA = calculateLocationRelevance(a, userLocation);
          const relevanceB = calculateLocationRelevance(b, userLocation);
          if (relevanceB !== relevanceA) return relevanceB - relevanceA;
          // Tie-breaker: most recent first
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      } else {
        // If no location, fall back to recent
        sorted.sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA;
        });
      }
      break;
  }
  
  return sorted;
}

/**
 * Search posts
 */
function searchPosts(posts, query) {
  if (!query.trim()) return posts;
  
  const lowerQuery = query.toLowerCase();
  
  return posts.filter(post => {
    const textMatch = post.text.toLowerCase().includes(lowerQuery);
    const handleMatch = post.author.handle.toLowerCase().includes(lowerQuery);
    const tagMatch = post.tags?.some(tag => tag.toLowerCase().includes(lowerQuery));
    const hashtagMatch = post.text.toLowerCase().includes(`#${lowerQuery}`);
    
    return textMatch || handleMatch || tagMatch || hashtagMatch;
  });
}

/**
 * Render post card
 */
function renderPostCard(post) {
  // Always ensure we have a valid date
  const postDate = post.createdAt || post.datePosted || new Date().toISOString();
  const timestamp = formatRelativeTime(postDate);
  const timestampTooltip = formatAbsoluteTime(postDate);
  
  // Format text with links and images detected
  // Pass post.media to remove redundant Twitter URLs if media is already displayed
  // Ensure we have text - check multiple fields
  const postText = post.text || post.story || post.title || '';
  const text = formatPostText(postText, post.media);
  
  // Debug: log if text is missing
  if (!postText) {
    console.warn('[PostFeed] Post missing text:', post.id, post);
  }
  
  return `
    <article 
      class="feed-post-card" 
      data-post-id="${post.id}"
      style="
        min-height: 520px;
        padding: 1.5rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        transition: background 0.2s ease;
        display: grid;
        grid-template-rows: auto 1fr auto;
        box-sizing: border-box;
      "
      onmouseover="this.style.background='rgba(255,255,255,0.03)'"
      onmouseout="this.style.background='transparent'"
    >
      <!-- Header -->
      <div style="display: flex; gap: 0.75rem; margin-bottom: 0.75rem;">
        <a 
          href="https://x.com/newsnoteworthy" 
          target="_blank" 
          rel="noopener noreferrer"
          style="flex-shrink: 0; text-decoration: none;"
        >
          <img 
            src="${post.author.avatarUrl}" 
            alt="${escapeHtml(post.author.name)}"
            style="
              width: 56px;
              height: 56px;
              border-radius: 50%;
              object-fit: cover;
              display: block;
            "
            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
          />
          <div 
            style="
              width: 56px;
              height: 56px;
              border-radius: 50%;
              background: linear-gradient(135deg, #1DA1F2 0%, #1a91da 100%);
              display: none;
              align-items: center;
              justify-content: center;
              font-weight: 700;
              font-size: 1.25rem;
              color: white;
            "
          >NW</div>
        </a>
        
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; flex-wrap: wrap;">
            <a 
              href="https://x.com/${post.author.handle}" 
              target="_blank" 
              rel="noopener noreferrer"
              style="
                font-weight: 700;
                font-size: 1.125rem;
                color: rgb(231, 233, 234);
                text-decoration: none;
                line-height: 1.5rem;
              "
              onmouseover="this.style.textDecoration='underline'"
              onmouseout="this.style.textDecoration='none'"
            >${escapeHtml(post.author.name)}</a>
            
            <span style="color: rgb(113, 118, 123); font-size: 1rem; line-height: 1.5rem;">
              @${post.author.handle}
            </span>
            
            <span style="color: rgb(113, 118, 123); font-size: 0.938rem; line-height: 1.25rem;">·</span>
            
            <a 
              href="${post.url}" 
              target="_blank" 
              rel="noopener noreferrer"
              class="feed-timestamp-link"
              style="
                color: rgb(113, 118, 123);
                font-size: 1rem;
                text-decoration: none;
                line-height: 1.5rem;
                font-weight: 400;
              "
              title="${timestampTooltip}"
              onmouseover="this.style.textDecoration='underline'; this.style.color='rgb(29, 155, 240)'"
              onmouseout="this.style.textDecoration='none'; this.style.color='rgb(113, 118, 123)'"
            >${timestamp || formatRelativeTime(post.createdAt)}</a>
          </div>
        </div>
      </div>
      
      <!-- Body -->
      <div style="margin-bottom: 0.75rem;">
        <div 
          style="
            color: rgb(231, 233, 234);
            font-size: 1.125rem;
            line-height: 1.625rem;
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow-wrap: break-word;
            margin: 0 0 1rem 0;
            padding: 0;
            text-align: left;
            text-indent: 0;
            display: -webkit-box;
            -webkit-line-clamp: 8;
            -webkit-box-orient: vertical;
            overflow: hidden;
          "
        >${text}</div>
        
        ${post.media && post.media.length > 0 ? renderMedia(post.media) : ''}
      </div>
      
      <!-- Action Bar -->
      <div 
        style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: 425px;
          padding-top: 0.5rem;
        "
      >
        ${renderEngagementBar(post)}
      </div>
    </article>
  `;
}

/**
 * Format post text with links and images
 * Removes Twitter URL shorteners (pic.twitter.com, t.co) since media is displayed separately
 */
function formatPostText(text, postMedia = []) {
  if (!text || (typeof text === 'string' && text.trim() === '')) return '';
  
  // Remove Twitter URL shorteners if we have media (they're redundant)
  let cleanedText = String(text); // Ensure it's a string
  const hasMedia = postMedia && postMedia.length > 0;
  
  if (hasMedia) {
    // Remove pic.twitter.com links (media is shown separately)
    cleanedText = cleanedText.replace(/https?:\/\/(pic\.twitter\.com|pbs\.twimg\.com)[^\s<>"']+/gi, '').trim();
    // Remove t.co links that are likely media (if we have media, these are probably redundant)
    // But keep the text before the link
    cleanedText = cleanedText.replace(/https?:\/\/t\.co\/[a-zA-Z0-9]+/gi, '').trim();
  }
  
  // If after cleaning we have no text, return the original (might be important)
  if (!cleanedText || cleanedText.trim() === '') {
    cleanedText = String(text);
  }
  
  // Clean up extra whitespace after removing URLs
  // Strip ALL leading whitespace to prevent indentation
  cleanedText = cleanedText
    .replace(/^[\s\u00a0]+/, '')
    .replace(/\n[\s\u00a0]+/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Split by remaining URLs
  const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
  const parts = [];
  let lastIndex = 0;
  let match;
  
  while ((match = urlRegex.exec(cleanedText)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: cleanedText.substring(lastIndex, match.index) });
    }
    
    const url = match[0];
    
    // Skip pic.twitter.com and t.co links if we have media
    if (hasMedia && (url.includes('pic.twitter.com') || url.includes('t.co/'))) {
      lastIndex = match.index + match[0].length;
      continue;
    }
    
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg|JPG|JPEG|PNG|GIF|WEBP|SVG)(\?[^\s]*)?$/i.test(url);
    
    if (isImage) {
      parts.push({ 
        type: 'image', 
        content: `<img src="${url}" alt="Post image" loading="lazy" style="max-width: 100%; height: auto; border-radius: 12px; margin: 0.5rem 0; display: block;" onerror="this.style.display='none';" />` 
      });
    } else {
      // Make t.co links cleaner
      let displayUrl = url;
      if (url.includes('t.co/')) {
        displayUrl = '🔗 Link';
      } else {
        displayUrl = url.length > 50 ? url.substring(0, 47) + '...' : url;
      }
      
      parts.push({ 
        type: 'link', 
        content: `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: rgb(29, 155, 240); text-decoration: none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${escapeHtml(displayUrl)}</a>` 
      });
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < cleanedText.length) {
    parts.push({ type: 'text', content: cleanedText.substring(lastIndex) });
  }
  
  if (parts.length === 0) {
    parts.push({ type: 'text', content: cleanedText });
  }
  
  return parts.map(part => {
    if (part.type === 'text') {
      return escapeHtml(part.content).replace(/\n/g, '<br>');
    }
    return part.content;
  }).join('');
}

/**
 * Render media
 */
function renderMedia(media) {
  if (media.length === 0) return '';
  
  if (media.length === 1) {
    const item = media[0];
    if (item.type === 'image') {
      return `
        <div 
          style="
            width: 100%;
            max-height: 500px;
            border-radius: 16px;
            overflow: hidden;
            margin-bottom: 1rem;
            border: 1px solid rgba(255,255,255,0.08);
          "
        >
          <img 
            src="${item.url}" 
            alt="Post media"
            loading="lazy"
            style="width: 100%; height: auto; display: block; object-fit: cover;"
            onerror="this.style.display='none';"
          />
        </div>
      `;
    } else {
      return `
        <div 
          style="
            width: 100%;
            max-height: 500px;
            border-radius: 16px;
            overflow: hidden;
            margin-bottom: 1rem;
            border: 1px solid rgba(255,255,255,0.08);
          "
        >
          <video 
            src="${item.url}" 
            controls
            style="width: 100%; height: auto; display: block;"
            onerror="this.style.display='none';"
          ></video>
        </div>
      `;
    }
  }
  
  const gridCols = media.length === 2 ? '1fr 1fr' : 'repeat(2, 1fr)';
  return `
    <div 
      style="
        display: grid;
        grid-template-columns: ${gridCols};
        gap: 2px;
        width: 100%;
        max-height: 500px;
        overflow: hidden;
        border-radius: 16px;
        margin-bottom: 1rem;
        border: 1px solid rgba(255,255,255,0.08);
      "
    >
      ${media.slice(0, 4).map((item, idx) => {
        const isLastIn3 = media.length === 3 && idx === 2;
        return `
          <div 
            style="
              aspect-ratio: ${isLastIn3 ? '2/1' : '1'};
              overflow: hidden;
              background: rgba(0,0,0,0.3);
              ${isLastIn3 ? 'grid-column: 1 / -1;' : ''}
            "
          >
            ${item.type === 'image' ? `
              <img 
                src="${item.url}" 
                alt="Post image ${idx + 1}"
                loading="lazy"
                style="width: 100%; height: 100%; object-fit: cover;"
                onerror="this.style.display='none';"
              />
            ` : `
              <video 
                src="${item.url}" 
                controls
                style="width: 100%; height: 100%; object-fit: cover;"
                onerror="this.style.display='none';"
              ></video>
            `}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Render engagement bar
 */
function renderEngagementBar(post) {
  const stats = post.stats;
  
  const buttons = [
    {
      icon: '💬',
      count: stats.comments,
      label: 'Comments',
      color: 'rgb(113, 118, 123)',
      hoverColor: 'rgb(29, 155, 240)',
      onClick: `window.feedOpenCommentDrawer('${post.id}')`,
    },
    {
      icon: '🔄',
      count: stats.reposts,
      label: 'Reposts',
      color: 'rgb(113, 118, 123)',
      hoverColor: 'rgb(0, 186, 124)',
      href: post.url,
    },
    {
      icon: '❤️',
      count: stats.likes,
      label: 'Likes',
      color: 'rgb(113, 118, 123)',
      hoverColor: 'rgb(249, 24, 128)',
      href: post.url,
    },
    {
      icon: '👁️',
      count: stats.views,
      label: 'Views',
      color: 'rgb(113, 118, 123)',
      hoverColor: 'rgb(29, 155, 240)',
      href: post.url,
    },
  ];
  
  return buttons.map(btn => {
    if (btn.onClick) {
      return `
        <button
          onclick="event.preventDefault(); ${btn.onClick}; return false;"
          class="feed-engagement-btn"
          style="
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem;
            color: ${btn.color};
            border: none;
            background: transparent;
            border-radius: 50%;
            transition: all 0.2s ease;
            min-width: 36px;
            justify-content: flex-start;
            cursor: pointer;
            font-size: inherit;
          "
          title="${btn.label}: ${formatCount(btn.count)}"
          aria-label="${btn.label}"
          onmouseover="this.style.color='${btn.hoverColor}'; this.style.backgroundColor='rgba(29, 155, 240, 0.1)'"
          onmouseout="this.style.color='${btn.color}'; this.style.backgroundColor='transparent'"
        >
          <span style="font-size: 1.25rem; line-height: 1;">${btn.icon}</span>
          <span style="font-size: 0.813rem; line-height: 1; font-weight: 400;">${formatCount(btn.count)}</span>
        </button>
      `;
    } else {
      return `
        <a
          href="${btn.href}"
          target="_blank"
          rel="noopener noreferrer"
          class="feed-engagement-btn"
          style="
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem;
            color: ${btn.color};
            text-decoration: none;
            border-radius: 50%;
            transition: all 0.2s ease;
            min-width: 36px;
            justify-content: flex-start;
          "
          title="${btn.label}: ${formatCount(btn.count)}"
          aria-label="${btn.label}"
          onmouseover="this.style.color='${btn.hoverColor}'; this.style.backgroundColor='rgba(29, 155, 240, 0.1)'"
          onmouseout="this.style.color='${btn.color}'; this.style.backgroundColor='transparent'"
        >
          <span style="font-size: 1.25rem; line-height: 1;">${btn.icon}</span>
          <span style="font-size: 0.813rem; line-height: 1; font-weight: 400;">${formatCount(btn.count)}</span>
        </a>
      `;
    }
  }).join('');
}

/**
 * Render feed controls
 */
function renderFeedControls(totalPosts) {
  const searchId = 'feed-search-' + Date.now();
  const sortId = 'feed-sort-' + Date.now();
  
  const controlsDiv = document.createElement('div');
  controlsDiv.className = 'feed-controls';
  // Styles are handled by CSS class, but we set critical inline styles for reliability
  controlsDiv.style.cssText = `
    position: sticky !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    z-index: 100 !important;
    width: 100% !important;
    max-width: 100% !important;
  `;
  
  // Create a horizontal flex container to align search and sort on same line
  const inputRow = document.createElement('div');
  inputRow.style.cssText = 'display: flex; align-items: center; gap: 1rem; flex: 1; min-width: 0;';
  
  // Search input with icon
  const searchContainer = document.createElement('div');
  searchContainer.style.cssText = 'flex: 1; min-width: 0; position: relative; display: flex; align-items: center;';
  
  const searchIcon = document.createElement('div');
  searchIcon.style.cssText = `
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: rgba(255, 255, 255, 0.5);
    font-size: 1.125rem;
    pointer-events: none;
    z-index: 1;
  `;
  searchIcon.textContent = '🔍';
  
  const searchInput = document.createElement('input');
  searchInput.id = searchId;
  searchInput.type = 'text';
  searchInput.placeholder = 'Search posts, tags, @handles...';
  searchInput.value = currentSearch;
  searchInput.className = 'feed-search-input';
  searchInput.style.cssText = `
    width: 100%;
    height: 48px;
    padding: 0.875rem 1rem 0.875rem 3rem;
    background: rgba(255, 255, 255, 0.08);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: #fff;
    font-size: 1rem;
    font-weight: 400;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    outline: none;
    box-sizing: border-box;
  `;
  
  searchInput.addEventListener('focus', function() {
    this.style.background = 'rgba(255, 255, 255, 0.12)';
    this.style.borderColor = '#4A90E2';
    this.style.boxShadow = '0 0 0 4px rgba(74, 144, 226, 0.2), 0 4px 12px rgba(0, 0, 0, 0.3)';
    searchIcon.style.color = '#4A90E2';
  });
  
  searchInput.addEventListener('blur', function() {
    this.style.background = 'rgba(255, 255, 255, 0.08)';
    this.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    this.style.boxShadow = 'none';
    searchIcon.style.color = 'rgba(255, 255, 255, 0.5)';
  });
  
  searchContainer.appendChild(searchIcon);
  searchContainer.appendChild(searchInput);
  
  // Professional custom sort dropdown
  const sortContainer = document.createElement('div');
  sortContainer.style.cssText = 'position: relative; min-width: 220px; height: 48px;';
  
  const sortButton = document.createElement('button');
  sortButton.id = sortId + '-button';
  sortButton.type = 'button';
  sortButton.className = 'feed-sort-button';
  sortButton.style.cssText = `
    width: 100%;
    height: 48px;
    padding: 0.875rem 3rem 0.875rem 1rem;
    background: rgba(255, 255, 255, 0.08);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: #fff;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    outline: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    text-align: left;
    box-sizing: border-box;
  `;
  
  const sortButtonText = document.createElement('span');
  sortButtonText.className = 'feed-sort-button-text';
  const currentSortText = {
    'recent': 'Most Recent',
    'nearby': '📍 Near Me',
    'views': 'Most Views',
    'likes': 'Most Likes',
    'comments': 'Most Comments',
    'reposts': 'Most Reposts'
  }[currentSort] || 'Most Recent';
  sortButtonText.textContent = currentSortText;
  sortButtonText.style.cssText = 'flex: 1;';
  
  const sortButtonIcon = document.createElement('span');
  sortButtonIcon.className = 'feed-sort-button-icon';
  sortButtonIcon.textContent = '▼';
  sortButtonIcon.style.cssText = `
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.6);
    transition: transform 0.3s ease;
    margin-left: 0.5rem;
  `;
  
  sortButton.appendChild(sortButtonText);
  sortButton.appendChild(sortButtonIcon);
  
  // Custom dropdown menu
  const sortDropdown = document.createElement('div');
  sortDropdown.id = sortId + '-dropdown';
  sortDropdown.className = 'feed-sort-dropdown';
  sortDropdown.style.cssText = `
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    right: 0;
    background: rgba(15, 15, 35, 0.98);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    z-index: 1000;
    display: none;
    overflow: hidden;
    max-height: 400px;
    overflow-y: auto;
  `;
  
  const options = [
    { value: 'recent', text: 'Most Recent', icon: '🕐' },
    { value: 'nearby', text: 'Near Me', icon: '📍' },
    { value: 'views', text: 'Most Views', icon: '👁️' },
    { value: 'likes', text: 'Most Likes', icon: '❤️' },
    { value: 'comments', text: 'Most Comments', icon: '💬' },
    { value: 'reposts', text: 'Most Reposts', icon: '🔄' }
  ];
  
  options.forEach(opt => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'feed-sort-option';
    option.dataset.value = opt.value;
    option.style.cssText = `
      width: 100%;
      padding: 0.875rem 1rem;
      background: ${opt.value === currentSort ? 'rgba(74, 144, 226, 0.15)' : 'transparent'};
      border: none;
      color: ${opt.value === currentSort ? '#4A90E2' : 'rgba(255, 255, 255, 0.9)'};
      font-size: 1rem;
      font-weight: ${opt.value === currentSort ? '600' : '400'};
      cursor: pointer;
      text-align: left;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      transition: all 0.2s ease;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    `;
    
    const optionIcon = document.createElement('span');
    optionIcon.textContent = opt.icon;
    optionIcon.style.cssText = 'font-size: 1.125rem; flex-shrink: 0;';
    
    const optionText = document.createElement('span');
    optionText.textContent = opt.text;
    
    option.appendChild(optionIcon);
    option.appendChild(optionText);
    
    option.addEventListener('mouseenter', function() {
      if (opt.value !== currentSort) {
        this.style.background = 'rgba(255, 255, 255, 0.08)';
        this.style.color = '#fff';
      }
    });
    
    option.addEventListener('mouseleave', function() {
      if (opt.value !== currentSort) {
        this.style.background = 'transparent';
        this.style.color = 'rgba(255, 255, 255, 0.9)';
      }
    });
    
    option.addEventListener('click', async function() {
      const newSort = this.dataset.value;
      currentSort = newSort;
      localStorage.setItem('feed-sort', currentSort);
      
      // Update button text
      sortButtonText.textContent = opt.text;
      
      // Update option styles
      options.forEach((o, idx) => {
        const optEl = sortDropdown.children[idx];
        if (optEl) {
          optEl.style.background = o.value === newSort ? 'rgba(74, 144, 226, 0.15)' : 'transparent';
          optEl.style.color = o.value === newSort ? '#4A90E2' : 'rgba(255, 255, 255, 0.9)';
          optEl.style.fontWeight = o.value === newSort ? '600' : '400';
        }
      });
      
      // Close dropdown
      sortDropdown.style.display = 'none';
      sortButtonIcon.style.transform = 'rotate(0deg)';
      dropdownOpen = false;
      
      // If "Near Me" is selected, request location
      if (newSort === 'nearby' && !userLocation) {
        const loc = await getUserLocation();
        if (!loc) {
          // Location failed, switch back to recent
          alert('Unable to determine your location. Switching to "Most Recent".');
          currentSort = 'recent';
          localStorage.setItem('feed-sort', 'recent');
          sortButtonText.textContent = 'Most Recent';
          // Update to recent option
          const recentOption = sortDropdown.querySelector('[data-value="recent"]');
          if (recentOption) recentOption.click();
          return;
        }
      }
      
      updateURLParams();
      renderFeed();
      
      // Visual feedback
      sortButton.style.transform = 'scale(0.98)';
      setTimeout(() => {
        sortButton.style.transform = 'scale(1)';
      }, 150);
    });
    
    sortDropdown.appendChild(option);
  });
  
  // Toggle dropdown
  let dropdownOpen = false;
  sortButton.addEventListener('click', function(e) {
    e.stopPropagation();
    dropdownOpen = !dropdownOpen;
    sortDropdown.style.display = dropdownOpen ? 'block' : 'none';
    sortButtonIcon.style.transform = dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)';
    
    if (dropdownOpen) {
      sortButton.style.background = 'rgba(255, 255, 255, 0.12)';
      sortButton.style.borderColor = '#4A90E2';
      sortButton.style.boxShadow = '0 0 0 4px rgba(74, 144, 226, 0.2), 0 4px 12px rgba(0, 0, 0, 0.3)';
    } else {
      sortButton.style.background = 'rgba(255, 255, 255, 0.08)';
      sortButton.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      sortButton.style.boxShadow = 'none';
    }
  });
  
  // Close dropdown when clicking outside
  const outsideClickHandler = function(e) {
    if (!sortContainer.contains(e.target) && dropdownOpen) {
      dropdownOpen = false;
      sortDropdown.style.display = 'none';
      sortButtonIcon.style.transform = 'rotate(0deg)';
      sortButton.style.background = 'rgba(255, 255, 255, 0.08)';
      sortButton.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      sortButton.style.boxShadow = 'none';
    }
  };
  document.addEventListener('click', outsideClickHandler);
  
  sortContainer.appendChild(sortButton);
  sortContainer.appendChild(sortDropdown);
  
  // Post count badge
  const countDiv = document.createElement('div');
  countDiv.className = 'feed-post-count';
  countDiv.style.cssText = `
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background: linear-gradient(135deg, rgba(74, 144, 226, 0.2) 0%, rgba(74, 144, 226, 0.15) 100%);
    border: 1px solid rgba(74, 144, 226, 0.3);
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.95);
    font-size: 0.875rem;
    font-weight: 600;
    margin-left: auto;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(74, 144, 226, 0.15);
  `;
  
  const countNumber = document.createElement('span');
  countNumber.style.cssText = 'color: #4A90E2; font-size: 1rem;';
  countNumber.textContent = totalPosts.toLocaleString();
  
  const countLabel = document.createElement('span');
  countLabel.textContent = totalPosts === 1 ? 'post loaded' : 'posts loaded';
  countLabel.style.cssText = 'opacity: 0.8;';
  
  countDiv.appendChild(countNumber);
  countDiv.appendChild(countLabel);
  
  // Add both to input row
  inputRow.appendChild(searchContainer);
  inputRow.appendChild(sortContainer);
  
  // Append everything to controls
  controlsDiv.appendChild(inputRow);
  controlsDiv.appendChild(countDiv);
  
  // If "Near Me" is selected and we don't have location yet, request it
  if (currentSort === 'nearby' && !userLocation && !locationPermissionRequested) {
    getUserLocation().then(loc => {
      if (loc) {
        // Re-render feed with location-based sorting
        renderFeed();
      } else {
        // Location failed, switch back to recent
        currentSort = 'recent';
        localStorage.setItem('feed-sort', 'recent');
        sortButtonText.textContent = 'Most Recent';
        // Update dropdown option styles
        options.forEach((o, idx) => {
          const optEl = sortDropdown.children[idx];
          if (optEl) {
            optEl.style.background = o.value === 'recent' ? 'rgba(74, 144, 226, 0.15)' : 'transparent';
            optEl.style.color = o.value === 'recent' ? '#4A90E2' : 'rgba(255, 255, 255, 0.9)';
            optEl.style.fontWeight = o.value === 'recent' ? '600' : '400';
          }
        });
        renderFeed();
      }
    });
  }
  
  // Event listeners
  let searchTimeout;
  searchInput.addEventListener('input', function(e) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(function() {
      currentSearch = e.target.value;
      localStorage.setItem('feed-search', currentSearch);
      updateURLParams();
      renderFeed();
    }, 300);
  });
  
  // Keyboard shortcut: / to focus search
  document.addEventListener('keydown', function(e) {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && 
        document.activeElement && 
        document.activeElement.tagName !== 'INPUT' && 
        document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      searchInput.focus();
    }
  });
  
  return controlsDiv;
}

/**
 * Update URL query params
 */
function updateURLParams() {
  const params = new URLSearchParams();
  if (currentSort !== 'recent') params.set('sort', currentSort);
  if (currentSearch) params.set('q', currentSearch);
  
  const newUrl = params.toString() 
    ? `${window.location.pathname}?${params.toString()}`
    : window.location.pathname;
  
  window.history.replaceState({}, '', newUrl);
}

/**
 * Read URL params on load
 */
function readURLParams() {
  const params = new URLSearchParams(window.location.search);
  const sort = params.get('sort');
  const search = params.get('q');
  
  if (sort) {
    currentSort = sort;
    localStorage.setItem('feed-sort', currentSort);
  }
  if (search) {
    currentSearch = search;
    localStorage.setItem('feed-search', currentSearch);
  }
}

/**
 * Render feed
 */
async function renderFeed() {
  const container = document.getElementById('articlesTrack');
  if (!container) {
    console.error('[PostFeed v2] Container #articlesTrack not found');
    return;
  }
  
  if (currentPosts.length === 0) {
    container.innerHTML = '<div style="padding: 2rem; text-align: center; color: rgba(255,255,255,0.7);">Loading posts...</div>';
    return;
  }
  
  // Apply search
  let filtered = searchPosts(currentPosts, currentSearch);
  
  // Sort pinned posts first
  const pinned = filtered.filter(p => p.isPinned);
  const unpinned = filtered.filter(p => !p.isPinned);
  
  // Sort unpinned posts
  const sortedUnpinned = sortPosts(unpinned, currentSort);
  
  // Combine: pinned first, then sorted
  const sorted = [...pinned, ...sortedUnpinned];
  
  // Render
  const parent = container.parentElement;
  const originalContent = container.innerHTML;
  
  const controlsElement = renderFeedControls(currentPosts.length);
  const postsHtml = sorted.map(post => renderPostCard(post)).join('');
  
  // Update controls
  let existingControls = parent?.querySelector('.feed-controls');
  if (existingControls) {
    existingControls.replaceWith(controlsElement);
  } else if (parent) {
    parent.insertBefore(controlsElement, container);
  }
  
  // Update posts
  container.innerHTML = postsHtml;
  
  // Track analytics
  if (typeof window !== 'undefined' && window.track) {
    window.track('feed_rendered', { 
      sort: currentSort, 
      search: currentSearch,
      count: sorted.length 
    });
  }
}

/**
 * Open comment drawer
 */
window.feedOpenCommentDrawer = async function(postId) {
  commentDrawerOpen = true;
  commentDrawerPostId = postId;
  
  // Comments are open to everyone - no auth check needed
  const drawerHtml = `
    <div 
      class="feed-comment-drawer-overlay"
      style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1000;
        display: flex;
        align-items: flex-end;
        justify-content: flex-end;
      "
      onclick="if (event.target === this) { window.feedCloseCommentDrawer(); }"
    >
      <div 
        class="feed-comment-drawer"
        style="
          width: 100%;
          max-width: 420px;
          height: 100%;
          background: rgba(15, 15, 35, 0.98);
          backdrop-filter: blur(20px);
          border-left: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          flex-direction: column;
          box-shadow: -4px 0 20px rgba(0,0,0,0.5);
          animation: slideInRight 0.3s ease;
        "
        onclick="event.stopPropagation();"
      >
        <div 
          style="
            padding: 1rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            align-items: center;
            justify-content: space-between;
          "
        >
          <h2 style="margin: 0; font-size: 1.25rem; color: #fff; font-weight: 700;">Comments</h2>
          <button
            onclick="window.feedCloseCommentDrawer();"
            style="
              background: transparent;
              border: none;
              color: rgba(255, 255, 255, 0.7);
              font-size: 1.5rem;
              cursor: pointer;
              padding: 0.5rem;
              line-height: 1;
            "
            aria-label="Close comments"
          >×</button>
        </div>
        
        <div 
          id="feed-comments-list-${postId}"
          style="
            flex: 1;
            overflow-y: auto;
            padding: 1rem;
          "
        >
          <div style="color: rgba(255, 255, 255, 0.7); text-align: center; padding: 2rem;">
            Loading comments...
          </div>
        </div>
        
        <div 
          style="
            padding: 1rem;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
          "
        >
          <form 
            id="feed-comment-form-${postId}"
            onsubmit="event.preventDefault(); window.feedSubmitComment('${postId}', this); return false;"
          >
            <textarea
              name="comment"
              placeholder="Add a comment..."
              required
              minlength="3"
              rows="3"
                style="
                  width: 100%;
                  padding: 0.75rem;
                  background: rgba(255, 255, 255, 0.1);
                  border: 1px solid rgba(255, 255, 255, 0.2);
                  border-radius: 8px;
                  color: #fff;
                  font-size: 0.938rem;
                  resize: vertical;
                  margin-bottom: 0.75rem;
                  font-family: inherit;
                "
              ></textarea>
              <button
                type="submit"
                style="
                  width: 100%;
                  padding: 0.75rem;
                  background: #4A90E2;
                  border: none;
                  border-radius: 8px;
                  color: #fff;
                  font-weight: 600;
                  cursor: pointer;
                  transition: background 0.2s;
                "
                onmouseover="this.style.background='#3a7bc8'"
                onmouseout="this.style.background='#4A90E2'"
              >Post Comment</button>
            </form>
          </div>
      </div>
    </div>
    
    <style>
      @keyframes slideInRight {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }
      
      @media (max-width: 768px) {
        .feed-comment-drawer {
          max-width: 100% !important;
          border-left: none !important;
        }
      }
    </style>
  `;
  
  document.body.insertAdjacentHTML('beforeend', drawerHtml);
  
  // Load comments
  await loadComments(postId);
  
  // Close on ESC
  const handleEscape = function(e) {
    if (e.key === 'Escape') {
      window.feedCloseCommentDrawer();
    }
  };
  document.addEventListener('keydown', handleEscape);
  window.feedCommentDrawerCleanup = function() {
    document.removeEventListener('keydown', handleEscape);
  };
  
  // Track
  if (typeof window !== 'undefined' && window.track) {
    window.track('open_comments', { postId: postId });
  }
};

/**
 * Close comment drawer
 */
window.feedCloseCommentDrawer = function() {
  const overlay = document.querySelector('.feed-comment-drawer-overlay');
  if (overlay) overlay.remove();
  
  if (window.feedCommentDrawerCleanup) {
    window.feedCommentDrawerCleanup();
  }
  
  commentDrawerOpen = false;
  commentDrawerPostId = null;
};

/**
 * Load comments
 */
async function loadComments(postId) {
  const container = document.getElementById(`feed-comments-list-${postId}`);
  if (!container) return;
  
  try {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const endpoint = isLocalhost
      ? `http://localhost:8888/.netlify/functions/comments-api?articleId=post-${postId}`
      : `/.netlify/functions/comments-api?articleId=post-${postId}`;
    
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error('Failed to load comments');
    
    const data = await response.json();
    const comments = data.comments || [];
    
    if (comments.length === 0) {
      container.innerHTML = `
        <div style="color: rgba(255, 255, 255, 0.7); text-align: center; padding: 2rem;">
          No comments yet. Be the first to comment!
        </div>
      `;
      return;
    }
    
    container.innerHTML = comments.map(comment => {
      const date = new Date(comment.date || comment.createdAt || Date.now()).toLocaleDateString();
      return `
        <div 
          style="
            padding: 1rem;
            margin-bottom: 1rem;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.1);
          "
        >
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
            <strong style="color: #fff; font-size: 0.938rem;">${escapeHtml(comment.author || 'Anonymous')}</strong>
            <span style="color: rgba(255, 255, 255, 0.6); font-size: 0.813rem;">${date}</span>
          </div>
          <div style="color: rgba(255, 255, 255, 0.9); font-size: 0.938rem; line-height: 1.5;">
            ${escapeHtml(comment.text || '')}
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('[PostFeed v2] Error loading comments:', error);
    container.innerHTML = `
      <div style="color: rgba(255, 0, 0, 0.7); text-align: center; padding: 2rem;">
        Failed to load comments. Please try again.
      </div>
    `;
  }
}

/**
 * Submit comment
 */
window.feedSubmitComment = async function(postId, form) {
  const textarea = form.querySelector('textarea[name="comment"]');
  const text = textarea?.value?.trim();
  
  if (!text || text.length < 3) {
    alert('Please enter at least 3 characters');
    return;
  }
  
  // Get user info if available, otherwise use anonymous
  let user = null;
  if (window.auth0 && typeof window.auth0.getUser === 'function') {
    try {
      user = await window.auth0.getUser();
    } catch (err) {
      console.error('[PostFeed v2] Failed to get user:', err);
    }
  }
  
  const commentData = {
    articleId: `post-${postId}`,
    text: text,
    author: user ? (user.name || user.email?.split('@')[0] || 'Anonymous') : 'Anonymous',
    authorEmail: user ? user.email : '',
    authorId: user ? (user.sub || user.email) : 'anonymous',
  };
  
  try {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const endpoint = isLocalhost
      ? 'http://localhost:8888/.netlify/functions/comments-api'
      : '/.netlify/functions/comments-api';
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(commentData),
    });
    
    if (!response.ok) {
      let errorData = null;
      try {
        errorData = await response.json();
      } catch (parseError) {
        const errorText = await response.text();
        errorData = { error: errorText };
      }
      const errorMessage = errorData.error || 'Failed to post comment. Please try again.';
      
      // If it's an author name validation error, show it to the user
      if (errorData.field === 'author') {
        alert(errorMessage);
        // Focus back on the textarea so user can see the error
        if (textarea) {
          textarea.focus();
        }
        throw new Error(errorMessage);
      }
      
      throw new Error(errorMessage);
    }
    
    // Clear form
    if (textarea) textarea.value = '';
    
    // Reload comments
    await loadComments(postId);
    
    // Update comment count on card (optimistic)
    const card = document.querySelector(`[data-post-id="${postId}"]`);
    if (card) {
      const commentBtn = card.querySelector('.feed-engagement-btn');
      if (commentBtn) {
        const countSpan = commentBtn.querySelector('span:last-child');
        if (countSpan) {
          const currentCount = parseInt(countSpan.textContent) || 0;
          countSpan.textContent = formatCount(currentCount + 1);
        }
      }
    }
    
    // Track
    if (typeof window !== 'undefined' && window.track) {
      window.track('submit_comment', { postId: postId });
    }
  } catch (error) {
    console.error('[PostFeed v2] Error posting comment:', error);
    alert('Failed to post comment. Please try again.');
  }
};

/**
 * Main render function (replaces renderPostFeed)
 */
async function renderPostFeedV2(
  containerId = 'articlesTrack',
  endpoint = '/.netlify/functions/posts-read',
  limit = 200,
  forceRefresh = false
) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('[PostFeed v2] Container not found:', containerId);
    return;
  }
  
  // Read URL params
  readURLParams();
  
  // Load cached user location if available
  try {
    const cachedLocation = localStorage.getItem('user-location');
    if (cachedLocation) {
      userLocation = JSON.parse(cachedLocation);
      console.log('[Feed] Loaded cached user location:', userLocation);
    }
  } catch (e) {
    // Ignore cache errors
  }
  
  // Check cache and render immediately (don't wait for API)
  if (!forceRefresh) {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Use cached data even if slightly stale (up to 24 hours) for instant display
        if (Date.now() - timestamp < 86400000) {
          currentPosts = data.map(mapRawPostToPost);
          await renderFeed();
          // If cache is older than 5 minutes, refresh in background
          if (Date.now() - timestamp > 300000) {
            // Continue to fetch fresh data below
          } else {
            return; // Cache is fresh, no need to fetch
          }
        }
      }
    } catch (err) {
      console.warn('[PostFeed v2] Cache read failed:', err);
    }
  }
  
  // Fetch posts (in background if we already rendered cached data)
  if (isLoading) return;
  isLoading = true;
  
  try {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const fetchEndpoint = isLocalhost 
      ? `http://localhost:8888${endpoint}?limit=${limit}`
      : `${endpoint}?limit=${limit}`;
    
    console.log('[PostFeed v2] Fetching posts from:', fetchEndpoint);
    const response = await fetch(fetchEndpoint);
    
    console.log('[PostFeed v2] Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('[PostFeed v2] HTTP error:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
    }
    
    const rawPosts = await response.json();
    console.log('[PostFeed v2] Received', rawPosts?.length || 0, 'posts');
    
    if (!Array.isArray(rawPosts)) {
      console.error('[PostFeed v2] Invalid response format - expected array, got:', typeof rawPosts);
      throw new Error('Invalid response format: expected array');
    }
    
    currentPosts = rawPosts.map(mapRawPostToPost);
    console.log('[PostFeed v2] Mapped to', currentPosts.length, 'posts');
    
    // Cache
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data: rawPosts,
      timestamp: Date.now(),
    }));
    
    await renderFeed();
    console.log('[PostFeed v2] Feed rendered successfully');
    
    // Track
    if (typeof window !== 'undefined' && window.track) {
      window.track('feed_loaded', { count: currentPosts.length });
    }
  } catch (error) {
    console.error('[PostFeed v2] Error loading posts:', error);
    console.error('[PostFeed v2] Error stack:', error.stack);
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: rgba(255, 0, 0, 0.7);">
          <p style="margin-bottom: 1rem; font-weight: 600;">Failed to load posts</p>
          <p style="font-size: 0.9rem; opacity: 0.8; margin-bottom: 1rem;">${error.message || 'Unknown error'}</p>
          <button onclick="window.location.reload()" style="padding: 0.5rem 1rem; background: #4A90E2; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Refresh Page
          </button>
        </div>
      `;
    }
  } finally {
    isLoading = false;
  }
}

// Export
window.renderPostFeedV2 = renderPostFeedV2;

