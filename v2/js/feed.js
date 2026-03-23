/**
 * Noteworthy News V2 — Feed Module
 *
 * Fetches posts from the canonical posts-read API and renders them
 * as cards in the stories section. Handles loading, empty, and error states.
 */

const FEED_API = '/.netlify/functions/posts-read';
const DEFAULT_LIMIT = 12;

/**
 * Format a date string into a human-readable relative or absolute form.
 */
function formatDate(raw) {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '';
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
}

/**
 * Derive a display title from a post object.
 * Posts may have an explicit title, or we derive from text content.
 */
function getPostTitle(post) {
  if (post.title && post.title.trim()) return post.title.trim();
  const text = post.text || post.content || post.Content || '';
  if (!text) return 'Untitled';
  const firstLine = text.split('\n')[0].trim();
  if (firstLine.length <= 120) return firstLine;
  return firstLine.slice(0, 117) + '…';
}

/**
 * Get the best available image URL for a post.
 */
function getPostImage(post) {
  return post.imageUrl || post.image_url || post.image || post.primary_image_url || post.mediaUrl || post.media_url || null;
}

/**
 * Get post date from whichever field is present.
 */
function getPostDate(post) {
  return post.datePosted || post.createdAt || post.created_at || post.Date || null;
}

/**
 * Derive a category badge label.
 */
function getCategory(post) {
  if (post.category) return post.category;
  const src = (post.source || '').toLowerCase();
  if (src.includes('usgs') || src.includes('earthquake')) return 'Earthquake';
  if (src.includes('nws') || src.includes('weather')) return 'Weather';
  if (src.includes('faa')) return 'Aviation';
  return null;
}

/**
 * Build the URL to view a single post.
 */
function articleUrl(post) {
  const id = post.id || post.postId || '';
  return `/article.html?id=${encodeURIComponent(id)}`;
}

/**
 * Sanitize text for safe HTML insertion (no DOM overhead).
 */
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render a single post card as HTML string.
 */
function renderCard(post) {
  const title = getPostTitle(post);
  const image = getPostImage(post);
  const date = formatDate(getPostDate(post));
  const source = post.source || '';
  const category = getCategory(post);
  const url = articleUrl(post);
  const excerpt = (post.text || post.content || post.Content || '').replace(/<[^>]*>/g, '').trim();
  const shortExcerpt = excerpt.length > 160 ? excerpt.slice(0, 157) + '…' : excerpt;

  return `
    <a href="${esc(url)}" class="post-card" aria-label="${esc(title)}">
      ${image ? `<div class="post-card-image"><img src="${esc(image)}" alt="" loading="lazy" decoding="async"></div>` : ''}
      <div class="post-card-body">
        ${category ? `<span class="badge badge-accent">${esc(category)}</span>` : ''}
        <h3 class="post-card-title">${esc(title)}</h3>
        ${shortExcerpt ? `<p class="post-card-excerpt">${esc(shortExcerpt)}</p>` : ''}
        <div class="post-card-meta">
          ${source ? `<span class="post-card-source">${esc(source)}</span>` : ''}
          ${date ? `<time class="post-card-date">${esc(date)}</time>` : ''}
        </div>
      </div>
    </a>`;
}

/**
 * Render an empty state message.
 */
function renderEmpty() {
  return `
    <div class="feed-state">
      <p class="feed-state-title">No stories yet</p>
      <p class="feed-state-text">Check back soon. We're working on the next update.</p>
    </div>`;
}

/**
 * Render an error state message.
 */
function renderError() {
  return `
    <div class="feed-state">
      <p class="feed-state-title">Couldn't load stories</p>
      <p class="feed-state-text">Something went wrong. Please try again in a moment.</p>
      <button class="btn btn-secondary btn-sm feed-retry-btn" type="button">Retry</button>
    </div>`;
}

/**
 * Main initializer: fetch posts, render into the feed container.
 */
export async function initFeed() {
  const container = document.getElementById('feed-container');
  if (!container) return;

  try {
    const res = await fetch(`${FEED_API}?limit=${DEFAULT_LIMIT}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const posts = await res.json();

    if (!Array.isArray(posts) || posts.length === 0) {
      container.innerHTML = renderEmpty();
      container.classList.add('feed-loaded');
      return;
    }

    container.innerHTML = posts.map(renderCard).join('');
    container.classList.remove('feed-placeholder');
    container.classList.add('feed-grid', 'feed-loaded');
  } catch (err) {
    console.error('[Feed] Failed to load:', err);
    container.innerHTML = renderError();
    container.classList.add('feed-loaded');

    const retryBtn = container.querySelector('.feed-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        container.classList.remove('feed-loaded');
        container.classList.add('feed-placeholder');
        container.innerHTML = Array.from({ length: 6 }, () => '<div class="feed-skeleton" aria-hidden="true"></div>').join('');
        initFeed();
      }, { once: true });
    }
  }
}
