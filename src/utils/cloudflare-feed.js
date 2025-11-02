/**
 * Cloudflare Feed Integration for Netlify Site
 * 
 * Fetches feed from Cloudflare Worker and maps to existing card template
 */

// Configuration - set your Worker URL here
const WORKER_BASE_URL = typeof window !== 'undefined' && window.WORKER_BASE_URL 
  ? window.WORKER_BASE_URL 
  : 'https://x-feed.yourdomain.com'; // Replace with your actual Worker URL

/**
 * Fetch feed from Cloudflare Worker
 */
export async function fetchFeed(limit = 50) {
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
 * Add a tweet URL to the feed
 */
export async function addTweet(url) {
  try {
    const response = await fetch(`${WORKER_BASE_URL}/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.message || error.error || `Failed to add tweet: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('[CloudflareFeed] Add tweet error:', error);
    throw error;
  }
}

/**
 * Map Cloudflare feed post to existing card template format
 */
export function mapFeedPostToCard(post) {
  // Calculate read time
  const wordCount = (post.text || '').split(/\s+/).filter(w => w.length > 0).length;
  const readTime = Math.max(1, Math.ceil(wordCount / 225)); // 225 words per minute

  // Format date
  const timeAgo = formatTimeAgo(post.created_at);

  // Truncate text for story/excerpt (first 200 chars or first sentence)
  let story = post.text || '';
  if (story.length > 200) {
    const firstSentence = story.match(/^[^.!?]+[.!?]?/)?.[0] || story.substring(0, 200);
    story = firstSentence.length <= 200 ? firstSentence : story.substring(0, 197) + '...';
  }

  return {
    id: post.id,
    image: post.image || '', // Empty string if no image
    title: post.text?.substring(0, 80) || post.author || 'Untitled',
    story: story,
    datePosted: new Date(post.created_at).toISOString(),
    link: post.url,
    postType: post.category?.toLowerCase() || 'update',
    readTime: readTime,
    // Additional fields from feed
    author: post.author,
    category: post.category || 'Update',
    timeAgo: timeAgo,
  };
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
 * Auto-refresh feed with exponential backoff
 */
export class FeedAutoRefresh {
  constructor(onUpdate, options = {}) {
    this.onUpdate = onUpdate;
    this.interval = options.interval || 60000; // 60 seconds
    this.maxBackoff = options.maxBackoff || 300000; // 5 minutes max
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
      
      // Reset backoff on success
      this.currentBackoff = 0;
      return cards;
    } catch (error) {
      console.error('[CloudflareFeed] Refresh error:', error);
      
      // Exponential backoff
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
    
    // Initial fetch
    this.refresh();
    
    // Set up interval
    const scheduleNext = () => {
      const delay = this.currentBackoff || this.interval;
      this.timer = setTimeout(async () => {
        await this.refresh();
        if (this.isRunning) {
          scheduleNext();
        }
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


