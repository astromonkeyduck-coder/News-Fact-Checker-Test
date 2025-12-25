/**
 * Cloudflare Post Feed Component
 * 
 * Integrates with Cloudflare Worker feed and renders posts using existing card template
 */

import { fetchFeed, mapFeedPostToCard, FeedAutoRefresh } from '../utils/cloudflare-feed.js';

// Worker URL - set this globally or in your HTML
// window.WORKER_BASE_URL = 'https://x-feed.yourdomain.com';

/**
 * Render feed from Cloudflare Worker
 */
export async function renderCloudflareFeed(containerId, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`[CloudflareFeed] Container ${containerId} not found`);
    return;
  }

  const {
    limit = 50,
    autoRefresh = true,
    refreshInterval = 60000, // 60 seconds
    showLoading = true,
  } = options;

  // Store original content
  const originalContent = container.innerHTML;

  // Show loading state
  if (showLoading) {
    container.innerHTML = '<div class="post-feed-loading" style="padding: 2rem; text-align: center; color: rgba(255,255,255,0.8);">Loading feed...</div>';
  }

  // Auto-refresh handler
  const refreshHandler = new FeedAutoRefresh(
    (cards) => {
      renderCards(cards, container, originalContent);
    },
    {
      interval: refreshInterval,
      maxBackoff: 300000, // 5 minutes max
    }
  );

  try {
    // Initial fetch
    const posts = await fetchFeed(limit);
    const cards = posts.map(mapFeedPostToCard);
    
    renderCards(cards, container, originalContent);

    // Start auto-refresh if enabled
    if (autoRefresh) {
      refreshHandler.start();
    }

    // Store refresh handler for cleanup
    container._refreshHandler = refreshHandler;

    console.log(`[CloudflareFeed] Loaded ${cards.length} posts`);
  } catch (error) {
    console.error('[CloudflareFeed] Error loading feed:', error);
    
    // Show error but keep original content visible
    container.innerHTML = originalContent + `
      <div style="padding: 1.5rem; margin-top: 1rem; background: rgba(255, 107, 107, 0.15); border: 1px solid rgba(255, 107, 107, 0.4); border-radius: 8px; color: rgba(255,255,255,0.9);">
        <p style="margin: 0 0 0.5rem 0; font-weight: 600;">Unable to load feed</p>
        <p style="margin: 0; font-size: 0.9em; opacity: 0.8;">${error.message || 'Check console for details'}</p>
      </div>
    `;
  }
}

/**
 * Render cards to container
 */
function renderCards(cards, container, originalContent) {
  if (!cards || cards.length === 0) {
    if (originalContent) {
      container.innerHTML = originalContent;
    } else {
      container.innerHTML = '<article class="article-card"><div class="article-content"><h3>No posts yet</h3><p>Posts will appear here once added.</p></div></article>';
    }
    return;
  }

  const formatDate = (isoString) => {
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return isoString;
    }
  };

  const formatStory = (text) => {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br>');
  };

  container.innerHTML = cards.map(card => {
    // Fallback image with brand colors if no image
    const imageHtml = card.image 
      ? `<div class="article-image">
          <img src="${card.image}" alt="${(card.title || '').replace(/"/g, '&quot;')}" loading="lazy" 
               onerror="console.error('[PostFeed] Image failed to load:', this.src); this.style.display='none'; this.parentElement.style.background='linear-gradient(135deg, rgba(74, 144, 226, 0.2), rgba(46, 204, 113, 0.2))'; this.parentElement.innerHTML='<div style=\\'display: flex; align-items: center; justify-content: center; min-height: 200px;\\'><div style=\\'font-size: 48px; font-weight: 700; color: rgba(74, 144, 226, 0.8);\\'>NW</div></div>';" />
        </div>`
      : `<div class="article-image" style="background: linear-gradient(135deg, rgba(74, 144, 226, 0.2), rgba(46, 204, 113, 0.2)); display: flex; align-items: center; justify-content: center; min-height: 200px;">
          <div style="font-size: 48px; font-weight: 700; color: rgba(74, 144, 226, 0.8);">NW</div>
        </div>`;

    // Category badge
    const categoryClass = card.category?.toLowerCase() || 'update';
    const categoryBadge = card.category && card.category !== 'Update'
      ? `<div class="article-category ${categoryClass}" style="position: absolute; top: 12px; left: 12px; z-index: 10;">${card.category.toUpperCase()}</div>`
      : '';

    return `
      <article class="article-card" role="listitem" data-post-type="${card.postType || 'text'}" data-category="${categoryClass}">
        <div style="position: relative;">
          ${categoryBadge}
          ${imageHtml}
        </div>
        <div class="article-content">
          <h3 class="article-headline">
            <a href="/article.html?id=${card.id || ''}">${(card.title || 'Untitled').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</a>
          </h3>
          <p class="article-excerpt">${formatStory(card.story || '')}</p>
          <div class="article-meta">
            <span class="article-date" title="${formatDate(card.datePosted)}">${card.timeAgo || formatDate(card.datePosted)}</span>
            <span class="article-read-time">${card.readTime || 1} min read</span>
          </div>
        </div>
      </article>
    `;
  }).join('');

  // Reinitialize carousel if it exists
  if (typeof initializeNewsCarousel === 'function') {
    initializeNewsCarousel();
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.renderCloudflareFeed = renderCloudflareFeed;
  window.CloudflareFeed = { fetchFeed, mapFeedPostToCard, FeedAutoRefresh };
}






