/**
 * Post Feed v2 - Refactored X-style feed
 * Replaces post-feed.js with modern, professional implementation
 */

// Import types and utilities (compiled from TypeScript)
// Note: In production, these would be compiled TS files
// For now, we'll include the logic inline

// Icon helper functions - Premium SVG icons replacing emojis
function getIconHTML(iconName, className = 'w-5 h-5') {
  const icons = {
    reply: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="${className}" style="color: currentColor; width: 1em; height: 1em; vertical-align: middle;">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <path d="M8 10h8M8 14h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    </svg>`,
    like: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="${className}" style="color: currentColor; width: 1em; height: 1em; vertical-align: middle;">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/>
    </svg>`,
    view: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="${className}" style="color: currentColor; width: 1em; height: 1em; vertical-align: middle;">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity="0.2"/>
    </svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="${className}" style="color: currentColor; width: 1em; height: 1em; vertical-align: middle;">
      <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/>
      <path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    location: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="${className}" style="color: currentColor; width: 1em; height: 1em; vertical-align: middle;">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/>
      <circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity="0.3"/>
    </svg>`,
    share: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="${className}" style="color: currentColor; width: 1em; height: 1em; vertical-align: middle;">
      <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>`,
    repost: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="${className}" style="color: currentColor; width: 1em; height: 1em; vertical-align: middle;">
      <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>`,
  };
  return icons[iconName] || '';
}

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
 * Truncate text to specified length
 */
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Copy post link to clipboard
 */
async function copyPostLink(postUrl) {
  try {
    await navigator.clipboard.writeText(postUrl);
    
    // Ensure toast animations are available
    if (!document.getElementById('feed-toast-animations')) {
      const style = document.createElement('style');
      style.id = 'feed-toast-animations';
      style.textContent = `
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
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
 * Show professional share menu with multiple options
 */
function showShareMenu(post, buttonElement) {
  // Close any existing share menu
  const existingMenu = document.getElementById('feed-share-menu');
  if (existingMenu) {
    existingMenu.remove();
    return;
  }

  const postUrl = post.url || post.link || `https://x.com/newsnoteworthy/status/${post.id}`;
  const postText = truncateText(post.text || post.story || '', 100);
  const shareMessage = `Check out this new post from Noteworthy News! ${postUrl}`;
  
  // Get button position for menu placement
  const rect = buttonElement ? buttonElement.getBoundingClientRect() : { bottom: window.innerHeight / 2, left: window.innerWidth / 2 };
  let menuTop = rect.bottom + 8;
  let menuLeft = rect.left;
  
  // Adjust if menu would go off-screen
  const menuWidth = 320;
  const menuHeight = 400; // approximate
  if (menuLeft + menuWidth > window.innerWidth) {
    menuLeft = window.innerWidth - menuWidth - 16;
  }
  if (menuTop + menuHeight > window.innerHeight) {
    menuTop = rect.top - menuHeight - 8;
  }
  if (menuLeft < 16) {
    menuLeft = 16;
  }
  if (menuTop < 16) {
    menuTop = 16;
  }
  
  // Create share menu
  const menu = document.createElement('div');
  menu.id = 'feed-share-menu';
  menu.style.cssText = `
    position: fixed;
    top: ${menuTop}px;
    left: ${menuLeft}px;
    background: rgba(15, 15, 35, 0.98);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    z-index: 10000;
    padding: 0.75rem;
    min-width: 280px;
    max-width: 320px;
    animation: slideDown 0.2s ease;
  `;
  
  // Ensure animations are available
  if (!document.getElementById('feed-share-menu-animations')) {
    const style = document.createElement('style');
    style.id = 'feed-share-menu-animations';
    style.textContent = `
      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Generate article page URL with music parameter
  const siteUrl = window.location.origin || 'https://noteworthynews.co';
  // Use post ID, or create a stable ID from post content if ID is missing
  let postId = post.id;
  if (!postId) {
    // Create a simple hash from the post text for stable IDs
    const postText = post.text || post.story || post.title || '';
    let hash = 0;
    const str = postText.substring(0, 100);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    postId = `post-${Math.abs(hash)}`;
  }
  const articlePageUrl = `${siteUrl}/article.html?id=${encodeURIComponent(postId)}&music=true`;
  const shareWithFriendMessage = `Check out this new post from Noteworthy News! ${articlePageUrl}`;
  
  const shareOptions = [
    {
      icon: '👥',
      label: 'Share with a friend!',
      highlight: true,
      action: async () => {
        // Try native share first (mobile), then fallback to copy
        if (navigator.share) {
          try {
            await navigator.share({
              title: `Check out this post from Noteworthy News!`,
              text: `Check out this new post from Noteworthy News!`,
              url: articlePageUrl
            });
          } catch (err) {
            if (err.name !== 'AbortError') {
              // Fallback to copy
              await copyPostLink(articlePageUrl);
            }
          }
        } else {
          // Copy the link with music parameter
          await copyPostLink(articlePageUrl);
        }
        menu.remove();
      }
    },
    {
      icon: '🐦',
      label: 'Twitter/X',
      action: () => {
        const url = `https://twitter.com/intent/tweet?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent(`Check out this post from Noteworthy News! ${postText}`)}`;
        window.open(url, '_blank', 'width=600,height=400');
        menu.remove();
      }
    },
    {
      icon: '📘',
      label: 'Facebook',
      action: () => {
        const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`;
        window.open(url, '_blank', 'width=600,height=400');
        menu.remove();
      }
    },
    {
      icon: '💼',
      label: 'LinkedIn',
      action: () => {
        const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`;
        window.open(url, '_blank', 'width=600,height=400');
        menu.remove();
      }
    },
    {
      icon: '📧',
      label: 'Email',
      action: () => {
        const subject = encodeURIComponent('Check out this post from Noteworthy News!');
        const body = encodeURIComponent(shareWithFriendMessage);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
        menu.remove();
      }
    },
    {
      icon: 'reply',
      iconHTML: getIconHTML('reply', 'w-4 h-4'),
      label: 'Messages',
      action: () => {
        // Try SMS first, fallback to generic messaging
        const smsUrl = `sms:?body=${encodeURIComponent(shareWithFriendMessage)}`;
        window.location.href = smsUrl;
        menu.remove();
      }
    },
    {
      icon: '📋',
      label: 'Copy Link',
      action: async () => {
        await copyPostLink(postUrl);
        menu.remove();
      }
    }
  ];
  
  // Add native share option if available (mobile)
  if (navigator.share) {
    shareOptions.unshift({
      icon: '📤',
      label: 'Share...',
      action: async () => {
        try {
          await navigator.share({
            title: `Noteworthy News: ${postText}`,
            text: shareMessage,
            url: postUrl
          });
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error('Share failed:', err);
          }
        }
        menu.remove();
      }
    });
  }
  
  // Create menu items
  shareOptions.forEach((option, index) => {
    const item = document.createElement('button');
    
    // Special styling for highlighted "Share with a friend!" option
    const isHighlighted = option.highlight === true;
    
    item.style.cssText = `
      width: 100%;
      padding: ${isHighlighted ? '1rem' : '0.875rem'} 1rem;
      background: ${isHighlighted ? 'linear-gradient(135deg, rgba(74, 144, 226, 0.2) 0%, rgba(74, 144, 226, 0.15) 100%)' : 'transparent'};
      border: ${isHighlighted ? '1px solid rgba(74, 144, 226, 0.3)' : 'none'};
      color: ${isHighlighted ? '#4A90E2' : 'rgba(255, 255, 255, 0.9)'};
      font-size: ${isHighlighted ? '1rem' : '0.938rem'};
      font-weight: ${isHighlighted ? '600' : '500'};
      cursor: pointer;
      text-align: left;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      transition: all 0.2s ease;
      border-radius: 8px;
      margin-bottom: ${isHighlighted ? '0.5rem' : '0.25rem'};
      ${isHighlighted ? 'box-shadow: 0 2px 8px rgba(74, 144, 226, 0.15);' : ''}
    `;
    
    item.innerHTML = `
      <span style="font-size: ${isHighlighted ? '1.5rem' : '1.25rem'}; line-height: 1;">${option.icon}</span>
      <span>${option.label}</span>
    `;
    
    item.addEventListener('mouseenter', function() {
      if (isHighlighted) {
        this.style.background = 'linear-gradient(135deg, rgba(74, 144, 226, 0.3) 0%, rgba(74, 144, 226, 0.25) 100%)';
        this.style.borderColor = 'rgba(74, 144, 226, 0.5)';
        this.style.transform = 'translateY(-1px)';
        this.style.boxShadow = '0 4px 12px rgba(74, 144, 226, 0.25)';
      } else {
        this.style.background = 'rgba(255, 255, 255, 0.1)';
        this.style.color = '#fff';
      }
    });
    
    item.addEventListener('mouseleave', function() {
      if (isHighlighted) {
        this.style.background = 'linear-gradient(135deg, rgba(74, 144, 226, 0.2) 0%, rgba(74, 144, 226, 0.15) 100%)';
        this.style.borderColor = 'rgba(74, 144, 226, 0.3)';
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = '0 2px 8px rgba(74, 144, 226, 0.15)';
      } else {
        this.style.background = 'transparent';
        this.style.color = 'rgba(255, 255, 255, 0.9)';
      }
    });
    
    item.addEventListener('click', function(e) {
      e.stopPropagation();
      option.action();
    });
    
    menu.appendChild(item);
    
    // Add divider after highlighted option
    if (isHighlighted && index < shareOptions.length - 1) {
      const divider = document.createElement('div');
      divider.style.cssText = `
        height: 1px;
        background: rgba(255, 255, 255, 0.1);
        margin: 0.5rem 0;
      `;
      menu.appendChild(divider);
    }
  });
  
  // Add divider before copy link (only if not already added)
  const lastItem = menu.lastElementChild;
  if (lastItem && lastItem.tagName !== 'DIV') {
    const divider = document.createElement('div');
    divider.style.cssText = `
      height: 1px;
      background: rgba(255, 255, 255, 0.1);
      margin: 0.5rem 0;
    `;
    menu.insertBefore(divider, lastItem);
  }
  
  document.body.appendChild(menu);
  
  // Close menu when clicking outside
  const closeMenu = (e) => {
    if (!menu.contains(e.target) && e.target !== buttonElement) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  
  // Use setTimeout to avoid immediate close
  setTimeout(() => {
    document.addEventListener('click', closeMenu);
  }, 100);
  
  // Close on ESC key
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      menu.remove();
      document.removeEventListener('keydown', escHandler);
      document.removeEventListener('click', closeMenu);
    }
  };
  document.addEventListener('keydown', escHandler);
}

/**
 * Share post by ID (called from button onclick)
 */
window.feedSharePostById = function(postId, event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  
  // Find the post in currentPosts
  const post = currentPosts.find(p => p.id === postId);
  if (post) {
    // Get the button element from the event
    const buttonElement = event?.target?.closest?.('.feed-engagement-btn') || event?.target || event?.currentTarget;
    showShareMenu(post, buttonElement);
  } else {
    console.error('Post not found:', postId);
  }
  return false;
};

// Make sharePost available globally (for backward compatibility)
window.feedSharePost = async function(post) {
  const shareData = {
    title: `Noteworthy News: ${truncateText(post.text || post.story || '', 100)}`,
    text: `Check out this new post from Noteworthy News! ${post.url || post.link || `https://x.com/newsnoteworthy/status/${post.id}`}`,
    url: post.url || post.link || `https://x.com/newsnoteworthy/status/${post.id}`,
  };
  
  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      // Fallback: show share menu
      showShareMenu(post, null);
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Share failed:', err);
      showShareMenu(post, null);
    }
  }
};

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
  // CRITICAL: Prioritize primary_image_url (generated earthquake images) for social media previews
  // Check primary_image_url first, then fall back to other image fields
  // Also check assets.usgs_images for earthquake posts
  let primaryImage = raw.primary_image_url || raw.image_url || raw.image || null;
  
  // Fallback: Check assets.usgs_images for earthquake posts if no primary image
  if (!primaryImage && (raw.category === 'Earthquake' || raw.source === 'USGS')) {
    const usgsImages = raw.assets?.usgs_images || [];
    if (usgsImages.length > 0) {
      // Use first USGS image as fallback
      const firstUsgsImage = typeof usgsImages[0] === 'string' ? usgsImages[0] : (usgsImages[0]?.url || null);
      if (firstUsgsImage) {
        primaryImage = firstUsgsImage;
        console.log('[PostFeedV2] Using USGS image as fallback:', firstUsgsImage);
      }
    }
  }
  
  // DEBUG: Log image fields for troubleshooting
  if (!primaryImage && (raw.category === 'Earthquake' || raw.source === 'USGS')) {
    console.warn('[PostFeedV2] Earthquake post missing image:', {
      id: raw.id,
      primary_image_url: raw.primary_image_url,
      image_url: raw.image_url,
      image: raw.image,
      images: raw.images,
      assets_usgs_images: raw.assets?.usgs_images,
      category: raw.category,
      source: raw.source
    });
  }
  
  if (primaryImage) {
    media.push({ type: 'image', url: primaryImage });
  } else if (raw.images && raw.images.length > 0) {
    raw.images.forEach(url => {
      if (url) media.push({ type: 'image', url });
    });
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
    case 'nearMe': // Support legacy 'nearMe' value for backward compatibility
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
  
  // Calculate reading time (if utility is available)
  let readingTime = '1 min read';
  if (typeof window.calculateReadingTime === 'function') {
    const readingTimeResult = window.calculateReadingTime(postText);
    readingTime = readingTimeResult.text || readingTime;
  } else if (post.readTime) {
    readingTime = `${post.readTime} min read`;
  } else {
    // Fallback calculation: ~200 words per minute
    const wordCount = postText.split(/\s+/).filter(w => w.length > 0).length;
    const minutes = Math.max(1, Math.ceil(wordCount / 200));
    readingTime = minutes === 1 ? '1 min read' : `${minutes} min read`;
  }
  
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
            
            <span style="color: rgb(113, 118, 123); font-size: 0.938rem; line-height: 1.25rem;">·</span>
            
            <span 
              style="
                color: rgb(113, 118, 123);
                font-size: 0.938rem;
                line-height: 1.25rem;
              "
              title="Estimated reading time"
            >${readingTime}</span>
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
            src="${item.url.replace(/"/g, '&quot;').replace(/'/g, '&#x27;')}" 
            alt="Post media"
            loading="lazy"
            style="width: 100%; height: auto; display: block; object-fit: cover;"
            onerror="console.error('[PostFeedV2] Image failed to load:', this.src); this.style.display='none';"
            onload="console.log('[PostFeedV2] Image loaded successfully:', this.src);"
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
      icon: 'reply',
      iconHTML: getIconHTML('reply', 'w-5 h-5'),
      count: stats.comments,
      label: 'Comments',
      color: 'rgb(113, 118, 123)',
      hoverColor: 'rgb(29, 155, 240)',
      onClick: `window.feedOpenCommentDrawer('${post.id}')`,
    },
    {
      icon: 'repost',
      iconHTML: getIconHTML('repost', 'w-5 h-5'),
      count: stats.reposts,
      label: 'Reposts',
      color: 'rgb(113, 118, 123)',
      hoverColor: 'rgb(0, 186, 124)',
      href: post.url,
    },
    {
      icon: 'like',
      iconHTML: getIconHTML('like', 'w-5 h-5'),
      count: stats.likes,
      label: 'Likes',
      color: 'rgb(113, 118, 123)',
      hoverColor: 'rgb(249, 24, 128)',
      href: post.url,
    },
    {
      icon: 'share',
      iconHTML: getIconHTML('share', 'w-5 h-5'),
      count: null,
      label: 'Share',
      color: 'rgb(113, 118, 123)',
      hoverColor: 'rgb(29, 155, 240)',
      onClick: `window.feedSharePostById('${post.id}', event)`,
      showCount: false,
    },
    {
      icon: 'view',
      iconHTML: getIconHTML('view', 'w-5 h-5'),
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
          title="${btn.label}${btn.count !== null && btn.count !== undefined ? ': ' + formatCount(btn.count) : ''}"
          aria-label="${btn.label}"
          onmouseover="this.style.color='${btn.hoverColor}'; this.style.backgroundColor='rgba(29, 155, 240, 0.1)'"
          onmouseout="this.style.color='${btn.color}'; this.style.backgroundColor='transparent'"
        >
          <span class="icon-inline" style="display: inline-flex; align-items: center; gap: 0.25rem;">${btn.iconHTML || getIconHTML(btn.icon, 'w-5 h-5')}</span>
          ${btn.showCount !== false && btn.count !== null && btn.count !== undefined ? `<span style="font-size: 0.813rem; line-height: 1; font-weight: 400;">${formatCount(btn.count)}</span>` : ''}
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
          title="${btn.label}${btn.count !== null && btn.count !== undefined ? ': ' + formatCount(btn.count) : ''}"
          aria-label="${btn.label}"
          onmouseover="this.style.color='${btn.hoverColor}'; this.style.backgroundColor='rgba(29, 155, 240, 0.1)'"
          onmouseout="this.style.color='${btn.color}'; this.style.backgroundColor='transparent'"
        >
          <span class="icon-inline" style="display: inline-flex; align-items: center; gap: 0.25rem;">${btn.iconHTML || getIconHTML(btn.icon, 'w-5 h-5')}</span>
          ${btn.showCount !== false && btn.count !== null && btn.count !== undefined ? `<span style="font-size: 0.813rem; line-height: 1; font-weight: 400;">${formatCount(btn.count)}</span>` : ''}
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
  searchIcon.innerHTML = getIconHTML('search', 'w-5 h-5');
  searchIcon.style.cssText += 'display: flex; align-items: center; justify-content: center;';
  
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
    'nearby': 'Near Me',
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
    { value: 'recent', text: 'Most Recent', icon: 'clock', iconHTML: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" style="color: currentColor; width: 1em; height: 1em;"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' },
    { value: 'nearby', text: 'Near Me', icon: 'location', iconHTML: getIconHTML('location', 'w-4 h-4') },
    { value: 'views', text: 'Most Views', icon: 'view', iconHTML: getIconHTML('view', 'w-4 h-4') },
    { value: 'likes', text: 'Most Likes', icon: 'like', iconHTML: getIconHTML('like', 'w-4 h-4') },
    { value: 'comments', text: 'Most Comments', icon: 'reply', iconHTML: getIconHTML('reply', 'w-4 h-4') },
    { value: 'reposts', text: 'Most Reposts', icon: 'repost', iconHTML: getIconHTML('repost', 'w-4 h-4') }
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
    optionIcon.className = 'icon-inline';
    optionIcon.innerHTML = opt.iconHTML || getIconHTML(opt.icon, 'w-4 h-4');
    optionIcon.style.cssText = 'display: inline-flex; align-items: center; flex-shrink: 0;';
    
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
    
    // Event listeners will be attached by attachFeedControlListeners() after controls are inserted
    // This prevents duplicate listeners and ensures they persist after controls are replaced
    
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
  
  // Normalize sort value for comparison
  const normalizedSort = currentSort === 'nearMe' ? 'nearby' : currentSort;
  
  // If "Near Me" is selected and we don't have location yet, request it
  if (normalizedSort === 'nearby' && !userLocation && !locationPermissionRequested) {
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
  
  return controlsDiv;
}

/**
 * Attach event listeners to feed controls
 * This function is called after controls are replaced to re-attach listeners
 */
function attachFeedControlListeners(controlsElement) {
  if (!controlsElement) return;
  
  // Find search input
  const searchInput = controlsElement.querySelector('.feed-search-input');
  if (searchInput) {
    // Remove any existing listeners by cloning (clean slate)
    const newInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newInput, searchInput);
    
    // Attach search input listener
  let searchTimeout;
    newInput.addEventListener('input', function(e) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(function() {
      currentSearch = e.target.value;
      localStorage.setItem('feed-search', currentSearch);
      updateURLParams();
      renderFeed();
    }, 300);
  });
  
  // Keyboard shortcut: / to focus search
  const keydownHandler = function(e) {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && 
        document.activeElement && 
        document.activeElement.tagName !== 'INPUT' && 
        document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
        newInput.focus();
      }
    };
    
    // Remove old listener if it exists
    document.removeEventListener('keydown', window._feedSearchKeydownHandler);
    window._feedSearchKeydownHandler = keydownHandler;
    document.addEventListener('keydown', keydownHandler);
  }
  
  // Find sort button and dropdown
  const sortButton = controlsElement.querySelector('.feed-sort-button');
  const sortDropdown = controlsElement.querySelector('.feed-sort-dropdown');
  const sortButtonIcon = controlsElement.querySelector('.feed-sort-button-icon');
  
  if (sortButton && sortDropdown && sortButtonIcon) {
    // Remove old outside click handler
    if (window._feedOutsideClickHandler) {
      document.removeEventListener('click', window._feedOutsideClickHandler);
    }
    
    let dropdownOpen = false;
    
    // Toggle dropdown
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
    const sortContainer = sortButton.closest('.feed-controls')?.querySelector('[style*="position: relative"]') || sortButton.parentElement;
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
    window._feedOutsideClickHandler = outsideClickHandler;
    document.addEventListener('click', outsideClickHandler);
    
    // Re-attach sort option click handlers
    const sortOptions = sortDropdown.querySelectorAll('.feed-sort-option');
  const options = [
    { value: 'recent', text: 'Most Recent', icon: 'clock', iconHTML: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" style="color: currentColor; width: 1em; height: 1em;"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' },
    { value: 'nearby', text: 'Near Me', icon: 'location', iconHTML: getIconHTML('location', 'w-4 h-4') },
    { value: 'views', text: 'Most Views', icon: 'view', iconHTML: getIconHTML('view', 'w-4 h-4') },
    { value: 'likes', text: 'Most Likes', icon: 'like', iconHTML: getIconHTML('like', 'w-4 h-4') },
    { value: 'comments', text: 'Most Comments', icon: 'reply', iconHTML: getIconHTML('reply', 'w-4 h-4') },
    { value: 'reposts', text: 'Most Reposts', icon: 'repost', iconHTML: getIconHTML('repost', 'w-4 h-4') }
  ];
    
    sortOptions.forEach((option, index) => {
      const opt = options[index];
      if (!opt) return;
      
      // Clone to remove old listeners
      const newOption = option.cloneNode(true);
      option.parentNode.replaceChild(newOption, option);
      
      newOption.addEventListener('click', async function() {
        const newSort = this.dataset.value;
        currentSort = newSort;
        localStorage.setItem('feed-sort', currentSort);
        
        // Update button text
        const sortButtonText = sortButton.querySelector('.feed-sort-button-text');
        if (sortButtonText) {
          const currentSortText = {
            'recent': 'Most Recent',
            'nearby': 'Near Me',
            'views': 'Most Views',
            'likes': 'Most Likes',
            'comments': 'Most Comments',
            'reposts': 'Most Reposts'
          }[newSort] || 'Most Recent';
          sortButtonText.textContent = currentSortText;
        }
        
        // Update option styles
        sortOptions.forEach((o, idx) => {
          const optEl = sortDropdown.children[idx];
          if (optEl) {
            const optValue = options[idx]?.value;
            optEl.style.background = optValue === newSort ? 'rgba(74, 144, 226, 0.15)' : 'transparent';
            optEl.style.color = optValue === newSort ? '#4A90E2' : 'rgba(255, 255, 255, 0.9)';
            optEl.style.fontWeight = optValue === newSort ? '600' : '400';
          }
        });
        
        // Close dropdown
        dropdownOpen = false;
        sortDropdown.style.display = 'none';
        sortButtonIcon.style.transform = 'rotate(0deg)';
        
        // Normalize 'nearMe' to 'nearby' for consistency
        let normalizedSort = newSort;
        if (normalizedSort === 'nearMe') {
          normalizedSort = 'nearby';
        }
        
        // If "Near Me" is selected, request location
        if (normalizedSort === 'nearby' && !userLocation) {
          const loc = await getUserLocation();
          if (!loc) {
            // Location failed, switch back to recent
            alert('Unable to determine your location. Switching to "Most Recent".');
            currentSort = 'recent';
            localStorage.setItem('feed-sort', 'recent');
            if (sortButtonText) sortButtonText.textContent = 'Most Recent';
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
    });
  }
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
    // Show professional loading indicator
    const loadingHTML = `
      <div style="padding: 4rem 2rem; text-align: center; background: linear-gradient(135deg, rgba(15, 23, 42, 0.6) 0%, rgba(30, 41, 59, 0.6) 100%); border-radius: 20px; border: 1px solid rgba(74, 144, 226, 0.1); backdrop-filter: blur(10px);">
        <div style="position: relative; display: inline-block; margin-bottom: 2rem;">
          <!-- Outer rotating ring -->
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80px; height: 80px; border: 3px solid rgba(74, 144, 226, 0.2); border-top-color: #4A90E2; border-radius: 50%; animation: spinPosts 1.2s linear infinite;"></div>
          <!-- Inner pulsing circle -->
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 50px; height: 50px; background: radial-gradient(circle, rgba(74, 144, 226, 0.3) 0%, transparent 70%); border-radius: 50%; animation: pulsePosts 2s ease-in-out infinite;"></div>
          <!-- Center dot -->
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 12px; height: 12px; background: #4A90E2; border-radius: 50%; box-shadow: 0 0 20px rgba(74, 144, 226, 0.8);"></div>
        </div>
        <h3 style="color: #fff; font-size: 1.75rem; font-weight: 700; margin: 0 0 0.75rem 0; letter-spacing: -0.02em; background: linear-gradient(135deg, #fff 0%, rgba(74, 144, 226, 0.9) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">${currentSearch && currentSearch.trim() ? 'Searching Posts' : 'Loading Posts'}</h3>
        <p style="color: rgba(255, 255, 255, 0.85); font-size: 1.0625rem; margin: 0 0 0.5rem 0; font-weight: 500;">${currentSearch && currentSearch.trim() ? 'Finding posts matching your search' : 'Fetching the latest news from around the world'}</p>
        <p style="color: rgba(255, 255, 255, 0.6); font-size: 0.9375rem; margin: 0; letter-spacing: 0.02em;">Please wait, content is loading...</p>
        <style>
          @keyframes spinPosts {
            to { transform: translate(-50%, -50%) rotate(360deg); }
          }
          @keyframes pulsePosts {
            0%, 100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1); }
            50% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
          }
        </style>
      </div>
    `;
    container.innerHTML = loadingHTML;
    console.log('[Feed] No posts loaded yet, showing loading message');
    return;
  }
  
  console.log('[Feed] Rendering feed with', currentPosts.length, 'posts, search:', currentSearch, 'sort:', currentSort);
  
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
  
  // Check if existing HTML controls exist (globeSearchInputPosts, feed-sort-btn)
  const existingSearchInput = document.getElementById('globeSearchInputPosts');
  const existingSortButtons = document.querySelectorAll('.feed-sort-btn');
  const hasExistingControls = existingSearchInput && existingSortButtons.length > 0;
  
  // Only create new controls if existing ones don't exist
  if (!hasExistingControls) {
    const controlsElement = renderFeedControls(currentPosts.length);
    const postsHtml = sorted.map(post => renderPostCard(post)).join('');
    
    // Update controls
    let existingControls = parent?.querySelector('.feed-controls');
    if (existingControls) {
      existingControls.replaceWith(controlsElement);
    } else if (parent) {
      parent.insertBefore(controlsElement, container);
    }
    
    // Re-attach event listeners after controls are replaced
    attachFeedControlListeners(controlsElement);
    
    // Update posts
    container.innerHTML = postsHtml;
  } else {
    // Use existing controls - just update button states and render posts
    const postsHtml = sorted.map(post => renderPostCard(post)).join('');
    
    // Update sort button states - Professional styling
    existingSortButtons.forEach(btn => {
      const active = btn.dataset.sort === currentSort;
      if (active) {
        btn.style.background = 'linear-gradient(135deg, rgba(74, 144, 226, 0.25) 0%, rgba(91, 181, 255, 0.2) 100%)';
        btn.style.borderColor = 'rgba(74, 144, 226, 0.5)';
        btn.style.color = '#4A90E2';
        btn.style.fontWeight = '600';
        btn.style.boxShadow = '0 2px 8px rgba(74, 144, 226, 0.2), 0 0 0 1px rgba(74, 144, 226, 0.1) inset';
      } else {
        btn.style.background = 'rgba(255, 255, 255, 0.05)';
        btn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        btn.style.color = 'rgba(255, 255, 255, 0.8)';
        btn.style.fontWeight = '500';
        btn.style.boxShadow = 'none';
      }
    });
    
    // Update posts
  container.innerHTML = postsHtml;
  }
  
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
    
    // Initialize existing controls if they exist
    initializeExistingControls();
    
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

/**
 * Initialize existing controls in HTML (if they exist)
 * This is called immediately on page load to make controls work before feed loads
 */
function initializeExistingControls() {
  console.log('[Feed] Initializing existing controls...');
  const searchInput = document.getElementById('globeSearchInputPosts');
  const searchClearBtn = document.getElementById('globeSearchClearPosts');
  const sortButtons = document.querySelectorAll('.feed-sort-btn');
  
  // Initialize search input
  if (searchInput) {
    console.log('[Feed] Found search input, initializing...');
    // Set initial value from localStorage
    searchInput.value = currentSearch;
    
    // Show/hide clear button
    if (searchClearBtn) {
      searchClearBtn.style.display = currentSearch ? 'block' : 'none';
    }
    
    // Remove existing listeners by cloning
    const newInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newInput, searchInput);
    
    // Search event listener with debounce
    let searchTimeout;
    newInput.addEventListener('input', function(e) {
      console.log('[Feed] Search input changed:', e.target.value);
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(function() {
        currentSearch = e.target.value;
        localStorage.setItem('feed-search', currentSearch);
        updateURLParams();
        
        // Show/hide clear button
        const clearBtn = document.getElementById('globeSearchClearPosts');
        if (clearBtn) {
          clearBtn.style.display = currentSearch ? 'block' : 'none';
        }
        
        console.log('[Feed] Executing search with query:', currentSearch);
        renderFeed();
      }, 300);
    });
    
    // Also handle Enter key for immediate search
    newInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(searchTimeout);
        currentSearch = e.target.value;
        localStorage.setItem('feed-search', currentSearch);
        updateURLParams();
        
        const clearBtn = document.getElementById('globeSearchClearPosts');
        if (clearBtn) {
          clearBtn.style.display = currentSearch ? 'block' : 'none';
        }
        
        console.log('[Feed] Enter pressed, executing search:', currentSearch);
        renderFeed();
      }
    });
    
    // Clear button handler
    if (searchClearBtn) {
      const newClearBtn = searchClearBtn.cloneNode(true);
      searchClearBtn.parentNode.replaceChild(newClearBtn, searchClearBtn);
      
      newClearBtn.addEventListener('click', function() {
        console.log('[Feed] Clear button clicked');
        newInput.value = '';
        currentSearch = '';
        localStorage.setItem('feed-search', '');
        updateURLParams();
        newClearBtn.style.display = 'none';
        newInput.focus();
        renderFeed();
      });
    }
    
    console.log('[Feed] Search input initialized successfully');
  } else {
    console.warn('[Feed] Search input not found!');
  }
  
  // Initialize sort buttons
  if (sortButtons.length > 0) {
    console.log('[Feed] Found', sortButtons.length, 'sort buttons, initializing...');
    sortButtons.forEach(btn => {
      // Clone to remove old listeners
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      const sortValue = newBtn.dataset.sort;
      const isActive = currentSort === sortValue;
      
      // Update button styles - Professional active state
      if (isActive) {
        newBtn.style.background = 'linear-gradient(135deg, rgba(74, 144, 226, 0.25) 0%, rgba(91, 181, 255, 0.2) 100%)';
        newBtn.style.borderColor = 'rgba(74, 144, 226, 0.5)';
        newBtn.style.color = '#4A90E2';
        newBtn.style.fontWeight = '600';
        newBtn.style.boxShadow = '0 2px 8px rgba(74, 144, 226, 0.2), 0 0 0 1px rgba(74, 144, 226, 0.1) inset';
      } else {
        newBtn.style.background = 'rgba(255, 255, 255, 0.05)';
        newBtn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        newBtn.style.color = 'rgba(255, 255, 255, 0.8)';
        newBtn.style.fontWeight = '500';
        newBtn.style.boxShadow = 'none';
      }
      
      // Click handler
      newBtn.addEventListener('click', async function() {
        const newSort = this.dataset.sort;
        console.log('[Feed] Sort button clicked:', newSort);
        
        // If "Near Me" is selected, request location
        if (newSort === 'nearMe' && !userLocation) {
          const loc = await getUserLocation();
          if (!loc) {
            // Location failed, show notification
            const notification = document.createElement('div');
            notification.textContent = 'Location unavailable. Showing recent posts.';
            notification.style.cssText = `
              position: fixed;
              bottom: 2rem;
              left: 50%;
              transform: translateX(-50%);
              padding: 0.75rem 1.5rem;
              background: rgba(15, 15, 35, 0.95);
              border: 1px solid rgba(255, 255, 255, 0.2);
              border-radius: 8px;
              color: rgba(255, 255, 255, 0.9);
              font-size: 0.875rem;
              z-index: 10000;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            `;
            document.body.appendChild(notification);
            setTimeout(() => {
              notification.style.opacity = '0';
              notification.style.transition = 'opacity 0.3s ease';
              setTimeout(() => notification.remove(), 300);
            }, 3000);
            return;
          }
        }
        
        // Update sort
        currentSort = newSort;
        localStorage.setItem('feed-sort', currentSort);
        
        // Update all button states - Professional styling
        const allSortButtons = document.querySelectorAll('.feed-sort-btn');
        allSortButtons.forEach(b => {
          const active = b.dataset.sort === newSort;
          if (active) {
            b.style.background = 'linear-gradient(135deg, rgba(74, 144, 226, 0.25) 0%, rgba(91, 181, 255, 0.2) 100%)';
            b.style.borderColor = 'rgba(74, 144, 226, 0.5)';
            b.style.color = '#4A90E2';
            b.style.fontWeight = '600';
            b.style.boxShadow = '0 2px 8px rgba(74, 144, 226, 0.2), 0 0 0 1px rgba(74, 144, 226, 0.1) inset';
          } else {
            b.style.background = 'rgba(255, 255, 255, 0.05)';
            b.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            b.style.color = 'rgba(255, 255, 255, 0.8)';
            b.style.fontWeight = '500';
            b.style.boxShadow = 'none';
          }
        });
        
        updateURLParams();
        console.log('[Feed] Executing sort:', currentSort);
        renderFeed();
        
        // Visual feedback
        this.style.transform = 'scale(0.95)';
        setTimeout(() => {
          this.style.transform = 'scale(1)';
        }, 150);
      });
    });
    console.log('[Feed] Sort buttons initialized successfully');
  } else {
    console.warn('[Feed] No sort buttons found!');
  }
  
  console.log('[Feed] Control initialization complete');
}

// Initialize existing controls immediately when DOM is ready (optimized)
if (typeof document !== 'undefined') {
  function tryInitialize() {
    const searchInput = document.getElementById('globeSearchInputPosts');
    if (searchInput) {
      initializeExistingControls();
      return true;
    }
    return false;
  }
  
  // Try immediately if DOM is ready
  if (document.readyState !== 'loading') {
    if (!tryInitialize()) {
      // If not found, try once more after a very short delay
      setTimeout(tryInitialize, 50);
    }
  } else {
    // Wait for DOMContentLoaded, but try immediately when it fires
    document.addEventListener('DOMContentLoaded', function() {
      if (!tryInitialize()) {
        setTimeout(tryInitialize, 50);
      }
    }, { once: true });
  }
}
