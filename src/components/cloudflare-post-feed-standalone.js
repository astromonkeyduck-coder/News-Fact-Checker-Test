/**
 * Cloudflare Post Feed Component - Standalone (No Modules Required)
 * 
 * Copy this entire file's contents and paste into a <script> tag in your HTML.
 * No imports needed - everything is self-contained.
 */

(function() {
  'use strict';

  // Configuration - Set your Worker URL here or globally
  const WORKER_BASE_URL = (typeof window !== 'undefined' && window.WORKER_BASE_URL) 
    ? window.WORKER_BASE_URL 
    : 'https://x-feed.yourdomain.com'; // REPLACE WITH YOUR WORKER URL

  /**
   * Fetch feed from Cloudflare Worker
   */
  async function fetchFeed(limit = 50) {
    try {
      const response = await fetch(`${WORKER_BASE_URL}/feed?limit=${limit}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Feed fetch failed: ${response.status} ${response.statusText}`);
      }

      const posts = await response.json();
      return posts;
    } catch (error) {
      console.error('[CloudflareFeed] Fetch error:', error);
      throw error;
    }
  }

  /**
   * Format timestamp as "X min ago"
   */
  function formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hr ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;

    return new Date(timestamp).toLocaleDateString();
  }

  /**
   * Map Cloudflare feed post to existing card template format
   */
  function mapFeedPostToCard(post) {
    const wordCount = (post.text || '').split(/\s+/).filter(w => w.length > 0).length;
    const readTime = Math.max(1, Math.ceil(wordCount / 225));

    let story = post.text || '';
    if (story.length > 200) {
      const firstSentence = story.match(/^[^.!?]+[.!?]?/)?.[0] || story.substring(0, 200);
      story = firstSentence.length <= 200 ? firstSentence : story.substring(0, 197) + '...';
    }

    return {
      id: post.id,
      image: post.image || '',
      title: post.text?.substring(0, 80) || post.author || 'Untitled',
      story: story,
      datePosted: new Date(post.created_at).toISOString(),
      link: post.url,
      postType: (post.category || 'Update').toLowerCase(),
      readTime: readTime,
      author: post.author,
      category: post.category || 'Update',
      timeAgo: formatTimeAgo(post.created_at),
    };
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
      const imageHtml = card.image 
        ? `<div class="article-image">
            <img src="${card.image}" alt="${(card.title || '').replace(/"/g, '&quot;')}" loading="lazy" />
          </div>`
        : `<div class="article-image" style="background: linear-gradient(135deg, rgba(74, 144, 226, 0.2), rgba(46, 204, 113, 0.2)); display: flex; align-items: center; justify-content: center; min-height: 200px;">
            <div style="font-size: 48px; font-weight: 700; color: rgba(74, 144, 226, 0.8);">NW</div>
          </div>`;

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
              <a href="${card.link || '#'}" target="_blank" rel="noopener noreferrer">${(card.title || 'Untitled').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</a>
            </h3>
            <p class="article-excerpt">${formatStory(card.story || '')}</p>
            <div class="article-meta">
              <span class="article-date" title="${new Date(card.datePosted).toLocaleString()}">${card.timeAgo || new Date(card.datePosted).toLocaleString()}</span>
              <span class="article-read-time">${card.readTime || 1} min read</span>
            </div>
          </div>
        </article>
      `;
    }).join('');

    if (typeof initializeNewsCarousel === 'function') {
      initializeNewsCarousel();
    }
  }

  /**
   * Auto-refresh with exponential backoff
   */
  class FeedAutoRefresh {
    constructor(onUpdate, options = {}) {
      this.onUpdate = onUpdate;
      this.interval = options.interval || 60000;
      this.maxBackoff = options.maxBackoff || 300000;
      this.backoffMultiplier = options.backoffMultiplier || 2;
      this.currentBackoff = 0;
      this.timer = null;
      this.isRunning = false;
    }

    async refresh() {
      try {
        const posts = await fetchFeed();
        const cards = posts.map(mapFeedPostToCard);
        this.onUpdate(cards);
        this.currentBackoff = 0;
        return cards;
      } catch (error) {
        console.error('[CloudflareFeed] Refresh error:', error);
        this.currentBackoff = Math.min(
          this.currentBackoff || this.interval,
          this.maxBackoff
        ) * this.backoffMultiplier;
        return null;
      }
    }

    start() {
      if (this.isRunning) return;
      this.isRunning = true;
      this.refresh();
      const scheduleNext = () => {
        const delay = this.currentBackoff || this.interval;
        this.timer = setTimeout(async () => {
          await this.refresh();
          if (this.isRunning) scheduleNext();
        }, delay);
      };
      scheduleNext();
    }

    stop() {
      this.isRunning = false;
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
    }
  }

  /**
   * Main render function
   */
  async function renderCloudflareFeed(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`[CloudflareFeed] Container ${containerId} not found`);
      return;
    }

    const {
      limit = 50,
      autoRefresh = true,
      refreshInterval = 60000,
      showLoading = true,
    } = options;

    const originalContent = container.innerHTML;

    if (showLoading) {
      container.innerHTML = '<div class="post-feed-loading" style="padding: 2rem; text-align: center; color: rgba(255,255,255,0.8);">Loading feed...</div>';
    }

    const refreshHandler = new FeedAutoRefresh(
      (cards) => renderCards(cards, container, originalContent),
      { interval: refreshInterval, maxBackoff: 300000 }
    );

    try {
      const posts = await fetchFeed(limit);
      const cards = posts.map(mapFeedPostToCard);
      renderCards(cards, container, originalContent);

      if (autoRefresh) {
        refreshHandler.start();
      }

      container._refreshHandler = refreshHandler;
      console.log(`[CloudflareFeed] Loaded ${cards.length} posts`);
    } catch (error) {
      console.error('[CloudflareFeed] Error loading feed:', error);
      container.innerHTML = originalContent + `
        <div style="padding: 1.5rem; margin-top: 1rem; background: rgba(255, 107, 107, 0.15); border: 1px solid rgba(255, 107, 107, 0.4); border-radius: 8px; color: rgba(255,255,255,0.9);">
          <p style="margin: 0 0 0.5rem 0; font-weight: 600;">Unable to load feed</p>
          <p style="margin: 0; font-size: 0.9em; opacity: 0.8;">${error.message || 'Check console for details'}</p>
        </div>
      `;
    }
  }

  // Make globally available
  if (typeof window !== 'undefined') {
    window.renderCloudflareFeed = renderCloudflareFeed;
    window.CloudflareFeed = {
      fetchFeed,
      mapFeedPostToCard,
      addTweet: async (url) => {
        const response = await fetch(`${WORKER_BASE_URL}/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        return response.json();
      },
    };
  }
})();




