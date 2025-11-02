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
 * Format relative time
 */
function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) return `${diffSec}s`;
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay < 7) return `${diffDay}d`;
  if (diffWeek < 4) return `${diffWeek}w`;
  if (diffMonth < 12) return `${diffMonth}mo`;
  return `${diffYear}y`;
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
 * Sort posts
 */
function sortPosts(posts, mode) {
  const sorted = [...posts];
  
  switch (mode) {
    case 'recent':
      sorted.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        if (dateB !== dateA) return dateB - dateA;
        return b.id.localeCompare(a.id);
      });
      break;
    case 'views':
      sorted.sort((a, b) => {
        const diff = b.stats.views - a.stats.views;
        if (diff !== 0) return diff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      break;
    case 'likes':
      sorted.sort((a, b) => {
        const diff = b.stats.likes - a.stats.likes;
        if (diff !== 0) return diff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      break;
    case 'comments':
      sorted.sort((a, b) => {
        const diff = b.stats.comments - a.stats.comments;
        if (diff !== 0) return diff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      break;
    case 'reposts':
      sorted.sort((a, b) => {
        const diff = b.stats.reposts - a.stats.reposts;
        if (diff !== 0) return diff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
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
  const timestamp = formatRelativeTime(post.createdAt);
  const timestampTooltip = formatAbsoluteTime(post.createdAt);
  
  // Format text with links and images detected
  const text = formatPostText(post.text);
  
  return `
    <article 
      class="feed-post-card" 
      data-post-id="${post.id}"
      style="
        min-height: 360px;
        padding: 1rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        transition: background 0.2s ease;
        display: grid;
        grid-template-rows: auto 1fr auto;
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
              width: 40px;
              height: 40px;
              border-radius: 50%;
              object-fit: cover;
              display: block;
            "
            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
          />
          <div 
            style="
              width: 40px;
              height: 40px;
              border-radius: 50%;
              background: linear-gradient(135deg, #1DA1F2 0%, #1a91da 100%);
              display: none;
              align-items: center;
              justify-content: center;
              font-weight: 700;
              font-size: 1rem;
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
                font-size: 0.938rem;
                color: rgb(231, 233, 234);
                text-decoration: none;
                line-height: 1.25rem;
              "
              onmouseover="this.style.textDecoration='underline'"
              onmouseout="this.style.textDecoration='none'"
            >${escapeHtml(post.author.name)}</a>
            
            <span style="color: rgb(113, 118, 123); font-size: 0.938rem; line-height: 1.25rem;">
              @${post.author.handle}
            </span>
            
            <span style="color: rgb(113, 118, 123); font-size: 0.938rem; line-height: 1.25rem;">·</span>
            
            <a 
              href="${post.url}" 
              target="_blank" 
              rel="noopener noreferrer"
              style="
                color: rgb(113, 118, 123);
                font-size: 0.938rem;
                text-decoration: none;
                line-height: 1.25rem;
              "
              title="${timestampTooltip}"
              onmouseover="this.style.textDecoration='underline'"
              onmouseout="this.style.textDecoration='none'"
            >${timestamp}</a>
          </div>
        </div>
      </div>
      
      <!-- Body -->
      <div style="margin-bottom: 0.75rem;">
        <div 
          style="
            color: rgb(231, 233, 234);
            font-size: 0.938rem;
            line-height: 1.375rem;
            white-space: pre-wrap;
            word-wrap: break-word;
            margin-bottom: 0.75rem;
            display: -webkit-box;
            -webkit-line-clamp: 6;
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
 */
function formatPostText(text) {
  if (!text) return '';
  
  // Split by URLs
  const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
  const parts = [];
  let lastIndex = 0;
  let match;
  
  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
    }
    
    const url = match[0];
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg|JPG|JPEG|PNG|GIF|WEBP|SVG)(\?[^\s]*)?$/i.test(url);
    
    if (isImage) {
      parts.push({ 
        type: 'image', 
        content: `<img src="${url}" alt="Post image" loading="lazy" style="max-width: 100%; height: auto; border-radius: 12px; margin: 0.5rem 0; display: block;" onerror="this.style.display='none';" />` 
      });
    } else {
      const displayUrl = url.length > 50 ? url.substring(0, 47) + '...' : url;
      parts.push({ 
        type: 'link', 
        content: `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: rgb(29, 155, 240); text-decoration: none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${escapeHtml(displayUrl)}</a>` 
      });
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.substring(lastIndex) });
  }
  
  if (parts.length === 0) {
    parts.push({ type: 'text', content: text });
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
            max-height: 400px;
            border-radius: 16px;
            overflow: hidden;
            margin-bottom: 0.75rem;
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
            max-height: 400px;
            border-radius: 16px;
            overflow: hidden;
            margin-bottom: 0.75rem;
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
        max-height: 400px;
        overflow: hidden;
        border-radius: 16px;
        margin-bottom: 0.75rem;
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
  
  return `
    <div 
      class="feed-controls"
      style="
        position: sticky;
        top: 0;
        z-index: 10;
        background: rgba(15, 15, 35, 0.95);
        backdrop-filter: blur(10px);
        padding: 1rem;
        margin-bottom: 2rem;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        align-items: center;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      "
    >
      <div style="flex: 1; min-width: 250px;">
        <input
          id="${searchId}"
          type="text"
          placeholder="🔍 Search posts, tags, @handles..."
          value="${escapeHtml(currentSearch)}"
          class="feed-search-input"
          style="
            width: 100%;
            padding: 0.75rem 1rem;
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 8px;
            color: #fff;
            font-size: 1rem;
            transition: all 0.3s ease;
          "
        />
      </div>
      
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <label 
          for="${sortId}"
          style="color: rgba(255,255,255,0.9); font-size: 0.9rem; white-space: nowrap;"
        >Sort by:</label>
        <select
          id="${sortId}"
          class="feed-sort-select"
          style="
            padding: 0.75rem 1rem;
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 8px;
            color: #fff;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
          "
        >
          <option value="recent" ${currentSort === 'recent' ? 'selected' : ''}>Most Recent</option>
          <option value="views" ${currentSort === 'views' ? 'selected' : ''}>Most Views</option>
          <option value="likes" ${currentSort === 'likes' ? 'selected' : ''}>Most Likes</option>
          <option value="comments" ${currentSort === 'comments' ? 'selected' : ''}>Most Comments</option>
          <option value="reposts" ${currentSort === 'reposts' ? 'selected' : ''}>Most Reposts</option>
        </select>
      </div>
      
      <div 
        class="feed-post-count"
        style="
          color: rgba(255,255,255,0.7);
          font-size: 0.9rem;
          margin-left: auto;
          white-space: nowrap;
        "
      >
        ${totalPosts} ${totalPosts === 1 ? 'post' : 'posts'}
      </div>
    </div>
    
    <script>
      (function() {
        const searchInput = document.getElementById('${searchId}');
        const sortSelect = document.getElementById('${sortId}');
        
        let searchTimeout;
        
        if (searchInput) {
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
            if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
              e.preventDefault();
              searchInput.focus();
            }
          });
        }
        
        if (sortSelect) {
          sortSelect.addEventListener('change', function(e) {
            currentSort = e.target.value;
            localStorage.setItem('feed-sort', currentSort);
            updateURLParams();
            renderFeed();
          });
        }
      })();
    </script>
  `;
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
  
  const controlsHtml = renderFeedControls(currentPosts.length);
  const postsHtml = sorted.map(post => renderPostCard(post)).join('');
  
  // Update controls
  let controlsElement = parent?.querySelector('.feed-controls');
  if (!controlsElement && parent) {
    controlsElement = document.createElement('div');
    parent.insertBefore(controlsElement, container);
  }
  if (controlsElement) {
    controlsElement.outerHTML = controlsHtml;
  }
  
  // Update posts
  container.innerHTML = postsHtml;
  
  // Track analytics
  if (typeof window !== 'undefined' && (window as any).track) {
    (window as any).track('feed_rendered', { 
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
  
  // Check auth
  let isAuthenticated = false;
  if (window.auth0 && typeof window.auth0.isAuthenticated === 'function') {
    try {
      isAuthenticated = await window.auth0.isAuthenticated();
    } catch (err) {
      console.log('[PostFeed v2] Auth check failed:', err);
    }
  }
  
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
        
        ${isAuthenticated ? `
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
        ` : `
          <div 
            style="
              padding: 1rem;
              border-top: 1px solid rgba(255, 255, 255, 0.1);
              text-align: center;
            "
          >
            <button
              onclick="if (window.auth0Login) window.auth0Login();"
              style="
                width: 100%;
                padding: 0.75rem;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 8px;
                color: #fff;
                font-weight: 600;
                cursor: pointer;
              "
            >Sign In to Comment</button>
          </div>
        `}
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
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      window.feedCloseCommentDrawer();
    }
  };
  document.addEventListener('keydown', handleEscape);
  (window as any).feedCommentDrawerCleanup = () => {
    document.removeEventListener('keydown', handleEscape);
  };
  
  // Track
  if (typeof window !== 'undefined' && (window as any).track) {
    (window as any).track('open_comments', { postId });
  }
};

/**
 * Close comment drawer
 */
window.feedCloseCommentDrawer = function() {
  const overlay = document.querySelector('.feed-comment-drawer-overlay');
  if (overlay) overlay.remove();
  
  if ((window as any).feedCommentDrawerCleanup) {
    (window as any).feedCommentDrawerCleanup();
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
  
  // Get user info
  let user = null;
  if (window.auth0 && typeof window.auth0.getUser === 'function') {
    try {
      user = await window.auth0.getUser();
    } catch (err) {
      console.error('[PostFeed v2] Failed to get user:', err);
    }
  }
  
  if (!user) {
    alert('Please sign in to comment');
    if (window.auth0Login) window.auth0Login();
    return;
  }
  
  const commentData = {
    articleId: `post-${postId}`,
    text: text,
    author: user.name || user.email?.split('@')[0] || 'Anonymous',
    authorEmail: user.email,
    authorId: user.sub || user.email,
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
    
    if (!response.ok) throw new Error('Failed to post comment');
    
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
    if (typeof window !== 'undefined' && (window as any).track) {
      (window as any).track('submit_comment', { postId });
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
  
  // Check cache
  if (!forceRefresh) {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_EXPIRY) {
          currentPosts = data.map(mapRawPostToPost);
          await renderFeed();
          return;
        }
      }
    } catch (err) {
      console.warn('[PostFeed v2] Cache read failed:', err);
    }
  }
  
  // Fetch posts
  if (isLoading) return;
  isLoading = true;
  
  try {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const fetchEndpoint = isLocalhost 
      ? `http://localhost:8888${endpoint}?limit=${limit}`
      : `${endpoint}?limit=${limit}`;
    
    const response = await fetch(fetchEndpoint);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const rawPosts = await response.json();
    currentPosts = rawPosts.map(mapRawPostToPost);
    
    // Cache
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data: rawPosts,
      timestamp: Date.now(),
    }));
    
    await renderFeed();
    
    // Track
    if (typeof window !== 'undefined' && (window as any).track) {
      (window as any).track('feed_loaded', { count: currentPosts.length });
    }
  } catch (error) {
    console.error('[PostFeed v2] Error loading posts:', error);
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: rgba(255, 0, 0, 0.7);">
          Failed to load posts. Please refresh the page.
        </div>
      `;
    }
  } finally {
    isLoading = false;
  }
}

// Export
window.renderPostFeedV2 = renderPostFeedV2;

