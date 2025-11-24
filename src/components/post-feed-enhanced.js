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

let enhancedIsLoading = false;
let enhancedCurrentSort = localStorage.getItem('feed-sort') || 'recent';
let enhancedCurrentSearch = localStorage.getItem('feed-search') || '';
let enhancedCurrentPosts = [];
let expandedPosts = new Set(); // Track which posts are expanded
let sharedPosts = new Set(); // Track recently shared posts

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
  if (!dateString) return 'Just now';
  const date = new Date(dateString);
  const now = new Date();
  if (isNaN(date.getTime())) return 'Just now';
  
  const diffMs = now.getTime() - date.getTime();
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
  const link = post.link || post.url || `https://x.com/newsnoteworthy/status/${post.id || ''}`;
  
  // Format story text (same as old feed)
  const formatStory = (text) => {
    if (!text) return '';
    
    // Split text into parts to handle URLs and plain text separately
    const parts = [];
    let lastIndex = 0;
    
    // Match both image URLs and regular URLs
    const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
    let match;
    
    while ((match = urlRegex.exec(text)) !== null) {
      // Add text before URL
      if (match.index > lastIndex) {
        const beforeText = text.substring(lastIndex, match.index);
        if (beforeText) {
          parts.push({ type: 'text', content: beforeText });
        }
      }
      
      const url = match[0];
      const isImage = /\.(jpg|jpeg|png|gif|webp|svg|JPG|JPEG|PNG|GIF|WEBP|SVG)(\?[^\s]*)?$/i.test(url);
      
      if (isImage) {
        // Create img tag for images
        parts.push({ 
          type: 'image', 
          content: `<img src="${url}" alt="Post image" loading="lazy" style="max-width: 100%; height: auto; border-radius: 12px; margin: 0.5rem 0; display: block;" onerror="this.style.display='none';" />` 
        });
      } else {
        // Create clickable link for other URLs
        const displayUrl = url.length > 50 ? url.substring(0, 47) + '...' : url;
        parts.push({ 
          type: 'link', 
          content: `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: rgb(29, 155, 240); text-decoration: none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${displayUrl}</a>` 
        });
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text after last URL
    if (lastIndex < text.length) {
      const afterText = text.substring(lastIndex);
      if (afterText) {
        parts.push({ type: 'text', content: afterText });
      }
    }
    
    // If no URLs found, just process the whole text
    if (parts.length === 0) {
      parts.push({ type: 'text', content: text });
    }
    
    // Process each part: escape HTML for text, keep HTML for images/links
    const processed = parts.map(part => {
      if (part.type === 'text') {
        // Escape HTML and convert newlines to <br>
        return part.content
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
    
    return processed;
  };
  
  // Render media (same as old feed)
  const renderMedia = (post) => {
    let mediaHtml = '';
    const images = post.images || (post.image ? [post.image] : []);
    const videos = post.videos || [];
    
    if (images.length > 0 || videos.length > 0) {
      mediaHtml = '<div class="modern-post-media" style="margin: 1.25rem 0; border-radius: 12px; overflow: hidden;">';
      
      // Render images
      if (images.length > 0) {
        if (images.length === 1) {
          mediaHtml += `<div class="post-image-single" style="border-radius: 12px; overflow: hidden; background: rgba(0,0,0,0.2);">
            <img src="${images[0]}" alt="Post image" loading="lazy" style="width: 100%; height: auto; display: block; max-height: 600px; object-fit: cover;" onerror="this.style.display='none';" />
          </div>`;
        } else {
          const gridCols = Math.min(images.length, 3);
          mediaHtml += `<div class="post-image-grid" style="display: grid; grid-template-columns: repeat(${gridCols}, 1fr); gap: 0.5rem; border-radius: 12px; overflow: hidden;">
            ${images.slice(0, 4).map(img => `
              <div style="aspect-ratio: 1; overflow: hidden; background: rgba(0,0,0,0.2);">
                <img src="${img}" alt="Post image" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none';" />
          </div>
            `).join('')}
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
      icon: '💬',
      count: replies,
      label: 'Reply',
      color: 'rgb(113, 118, 123)',
      hoverColor: 'rgb(29, 155, 240)',
      href: link
    });
    
    // Repost button
    buttons.push({
      icon: '🔄',
      count: reposts,
      label: 'Repost',
      color: 'rgb(113, 118, 123)',
      hoverColor: 'rgb(0, 186, 124)',
      href: link
    });
    
    // Like button
    buttons.push({
      icon: '❤️',
      count: likes,
      label: 'Like',
      color: 'rgb(113, 118, 123)',
      hoverColor: 'rgb(249, 24, 128)',
      href: link
    });
    
    // Views button
    buttons.push({
      icon: '👁️',
      count: views,
      label: 'Views',
      color: 'rgb(113, 118, 123)',
      hoverColor: 'rgb(29, 155, 240)',
      href: link
    });
    
    return buttons.map(btn => `
      <a href="${btn.href}" target="_blank" rel="noopener noreferrer" 
         class="x-engagement-btn" 
         style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; color: ${btn.color}; text-decoration: none; border-radius: 50%; transition: all 0.2s ease; min-width: 36px; justify-content: flex-start;" 
         onmouseover="this.style.color='${btn.hoverColor}'; this.style.backgroundColor='rgba(29, 155, 240, 0.1)'" 
         onmouseout="this.style.color='${btn.color}'; this.style.backgroundColor='transparent'"
         title="${btn.label}">
        <span style="font-size: 1.25rem; line-height: 1;">${btn.icon}</span>
        ${btn.count !== null && btn.count !== undefined ? `<span style="font-size: 0.813rem; line-height: 1; font-weight: 400;">${formatNumber(btn.count)}</span>` : ''}
      </a>
    `).join('');
  };
  
  // Use November 23rd card design style (from post-feed-v2.js)
  return `
    <article class="feed-post-card" role="listitem" data-post-type="${post.postType || 'text'}" data-post-id="${post.id || ''}" style="background: transparent; min-height: 520px; padding: 1.5rem; margin-bottom: 0; border-bottom: 1px solid rgba(255,255,255,0.1); transition: background 0.2s ease; display: grid; grid-template-rows: auto 1fr auto;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
      <div style="display: flex; gap: 0.75rem; margin-bottom: 0.75rem;">
        <!-- Avatar -->
        <a href="https://x.com/newsnoteworthy" target="_blank" rel="noopener noreferrer" style="flex-shrink: 0; text-decoration: none;">
          <img src="/IMG_5794.PNG" alt="Noteworthy News" style="width: 56px; height: 56px; border-radius: 50%; object-fit: cover; display: block;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #1DA1F2 0%, #1a91da 100%); display: none; align-items: center; justify-content: center; font-weight: 700; font-size: 1.25rem; color: white;">
            NW
          </div>
        </a>
      
        <!-- Post Content -->
        <div style="flex: 1; min-width: 0;">
          <!-- Header: Username, handle, timestamp -->
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; flex-wrap: wrap;">
            <a href="https://x.com/newsnoteworthy" target="_blank" rel="noopener noreferrer" style="font-weight: 700; font-size: 0.938rem; color: rgb(231, 233, 234); text-decoration: none; line-height: 1.25rem;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">Noteworthy News</a>
            <span style="color: rgb(113, 118, 123); font-size: 0.938rem; line-height: 1.25rem;">@newsnoteworthy</span>
            <span style="color: rgb(113, 118, 123); font-size: 0.938rem; line-height: 1.25rem;">·</span>
            <a href="${link}" target="_blank" rel="noopener noreferrer" style="color: rgb(113, 118, 123); font-size: 0.938rem; text-decoration: none; line-height: 1.25rem;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${timestamp}</a>
          </div>
          
          <!-- Post Text -->
          <div style="color: rgb(231, 233, 234); font-size: 0.938rem; line-height: 1.375rem; white-space: pre-wrap; word-wrap: break-word; margin-bottom: 0.75rem;">
            ${formatStory(postText)}
          </div>
      
          <!-- Media -->
          ${renderMedia(post)}
          
          <!-- Engagement Bar (Twitter-style) -->
          <div style="display: flex; align-items: center; justify-content: space-between; max-width: 425px; margin-top: 0.75rem; padding-top: 0.5rem;">
            ${renderEngagementBar(post, link)}
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
  
  // Convert URLs to links
  const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
  escaped = escaped.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="color: rgb(29, 155, 240); text-decoration: none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${url}</a>`;
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
 * Render enhanced engagement bar
 */
function renderEnhancedEngagementBar(post) {
  const stats = post.stats || {};
  
  const buttons = [
    {
      icon: '💬',
      count: stats.comments || stats.replies || 0,
      label: 'Comments',
      color: 'rgb(113, 118, 123)',
      hoverColor: 'rgb(29, 155, 240)',
      href: post.url || post.link || `https://x.com/newsnoteworthy/status/${post.id}`,
    },
    {
      icon: '🔄',
      count: stats.reposts || 0,
      label: 'Reposts',
      color: 'rgb(113, 118, 123)',
      hoverColor: 'rgb(0, 186, 124)',
      href: post.url || post.link || `https://x.com/newsnoteworthy/status/${post.id}`,
    },
    {
      icon: '❤️',
      count: stats.likes || 0,
      label: 'Likes',
      color: 'rgb(113, 118, 123)',
      hoverColor: 'rgb(249, 24, 128)',
      href: post.url || post.link || `https://x.com/newsnoteworthy/status/${post.id}`,
    },
    {
      icon: '👁️',
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
      <span style="font-size: 1.125rem; line-height: 1;">${btn.icon}</span>
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
      "
    >
      <div style="display: flex; gap: 0.75rem; margin-bottom: 1rem;">
        <div style="
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(255,255,255,0.1);
          animation: pulse 1.5s ease-in-out infinite;
        "></div>
        <div style="flex: 1;">
          <div style="
            height: 16px;
            width: 200px;
            background: rgba(255,255,255,0.1);
            border-radius: 4px;
            margin-bottom: 0.5rem;
            animation: pulse 1.5s ease-in-out infinite;
          "></div>
          <div style="
            height: 14px;
            width: 150px;
            background: rgba(255,255,255,0.08);
            border-radius: 4px;
            animation: pulse 1.5s ease-in-out infinite;
          "></div>
        </div>
      </div>
      <div style="
        height: 60px;
        width: 100%;
        background: rgba(255,255,255,0.08);
        border-radius: 8px;
        margin-bottom: 1rem;
        animation: pulse 1.5s ease-in-out infinite;
      "></div>
      <div style="
        height: 40px;
        width: 100%;
        background: rgba(255,255,255,0.05);
        border-radius: 8px;
        animation: pulse 1.5s ease-in-out infinite;
      "></div>
    </article>
  `).join('');
}

/**
 * Load posts from API
 */
async function loadEnhancedPosts(endpoint = '/.netlify/functions/posts-read', limit = 200) {
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
  
  // Show skeleton
  container.innerHTML = renderSkeletonCards(5);
  
  try {
    const response = await fetch(`${endpoint}?limit=${limit}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    // Handle both array response and object with posts property
    const posts = Array.isArray(data) ? data : (data.posts || data.data || []);
    enhancedCurrentPosts = posts || [];
    
    console.log('[Enhanced Feed] Loaded', enhancedCurrentPosts.length, 'posts');
    
    // Cache posts
    localStorage.setItem(ENHANCED_CACHE_KEY, JSON.stringify({
      posts: enhancedCurrentPosts,
      timestamp: Date.now(),
    }));
    
    renderEnhancedFeed();
  } catch (error) {
    console.error('[Enhanced Feed] Load error:', error);
    const errorId = 'enhanced-feed-error-' + Date.now();
    container.innerHTML = `
      <div style="
        padding: 3rem;
        text-align: center;
        color: rgba(255,255,255,0.7);
      ">
        <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
        <h3 style="color: white; margin-bottom: 0.5rem;">Failed to load posts</h3>
        <p style="margin-bottom: 1.5rem;">${error.message}</p>
        <button
          id="${errorId}"
          style="
            padding: 0.75rem 1.5rem;
            background: rgb(29, 155, 240);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
          "
        >Try Again</button>
      </div>
    `;
    
    // Attach event listener safely
    const retryButton = document.getElementById(errorId);
    if (retryButton && window.loadEnhancedPosts) {
      retryButton.addEventListener('click', () => {
        if (!enhancedIsLoading && window.loadEnhancedPosts) {
          window.loadEnhancedPosts();
        }
      });
    }
  } finally {
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
 * Render enhanced feed
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
    container.innerHTML = `
      <div style="padding: 3rem; text-align: center; color: rgba(255,255,255,0.7);">
        <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
        <h3 style="color: white;">No posts found</h3>
        <p>Try adjusting your search or filters</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = sorted.map(post => renderEnhancedPostCard(post)).join('');
  
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
    `;
    document.head.appendChild(style);
  }
}

/**
 * Initialize enhanced feed
 */
let enhancedFeedInitialized = false;
let lastContainerId = null;

function initEnhancedFeed(containerId = 'articlesTrack', endpoint = '/.netlify/functions/posts-read', limit = 200) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('[Enhanced Feed] Container not found:', containerId);
    return;
  }
  
  // Check if container is empty or has very little content (likely needs loading)
  const isEmpty = !container.innerHTML || 
                  container.innerHTML.trim().length < 100 || 
                  container.innerHTML.includes('Loading') || 
                  container.innerHTML.includes('skeleton') ||
                  container.innerHTML.includes('Failed to load');
  
  // Allow re-initialization if container changed or if not initialized yet
  if (enhancedFeedInitialized && lastContainerId === containerId) {
    // But still try to load posts if container is empty
    if (isEmpty) {
      console.log('[Enhanced Feed] Already initialized but container is empty, loading posts...');
      loadEnhancedPosts(endpoint, limit);
    } else {
      console.warn('[Enhanced Feed] Already initialized for this container, skipping...');
    }
    return;
  }
  
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
  
  // Load posts
  loadEnhancedPosts(endpoint, limit);
  
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
        renderEnhancedFeed();
      }, 300);
    });
  }
  
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      enhancedCurrentSort = e.target.value;
      localStorage.setItem('feed-sort', enhancedCurrentSort);
      renderEnhancedFeed();
    });
  }
}

// Export for use
if (typeof window !== 'undefined') {
  window.renderPostFeedEnhanced = initEnhancedFeed;
  // Also export skeleton function for immediate use
  window.renderPostFeedEnhanced.renderSkeletonCards = renderSkeletonCards;
}

