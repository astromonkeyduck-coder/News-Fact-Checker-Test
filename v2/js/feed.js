/**
 * Noteworthy News V2 — Feed Module
 *
 * Fetches posts from posts-read, partitions into Breaking News vs
 * engine-sourced Alerts, and renders each into its own section.
 */

const FEED_API = '/.netlify/functions/posts-read';
const FETCH_LIMIT = 80;
const BREAKING_DISPLAY = 8;
const BREAKING_LOAD_MORE = 8;
const ALERTS_DISPLAY = 6;

const ENGINE_CATEGORIES = new Set([
  'Earthquake', 'Weather Alert', 'Volcano Alert',
  'Maritime Alert', 'Airspace Alert', 'Travel Advisory',
]);

function isAlertPost(post) {
  if (ENGINE_CATEGORIES.has(post.category)) return true;
  const src = (post.source || '').toLowerCase();
  return src.includes('usgs') || src.includes('nws') || src.includes('faa') || src.includes('uscg');
}

// ── Helpers ──────────────────────────────────────

function formatDate(raw) {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
    year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

function getPostTitle(post) {
  if (post.title && post.title.trim()) return post.title.trim();
  const text = post.text || post.content || post.Content || '';
  if (!text) return 'Untitled';
  const first = text.split('\n')[0].trim();
  return first.length <= 140 ? first : first.slice(0, 137) + '…';
}

function getPostImage(post) {
  return post.imageUrl || post.image_url || post.image || post.primary_image_url || post.mediaUrl || post.media_url || null;
}

function getPostDate(post) {
  return post.datePosted || post.createdAt || post.created_at || post.Date || null;
}

function getCategory(post) {
  if (post.category) return post.category;
  const src = (post.source || '').toLowerCase();
  if (src.includes('usgs') || src.includes('earthquake')) return 'Earthquake';
  if (src.includes('nws') || src.includes('weather')) return 'Weather';
  if (src.includes('faa')) return 'Aviation';
  return null;
}

function articleUrl(post) {
  const id = post.id || post.postId || '';
  return `/article.html?id=${encodeURIComponent(id)}`;
}

function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function shortNum(n) {
  if (n == null || isNaN(n)) return null;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function isBreakingText(post) {
  const t = (post.text || post.title || post.story || '').toUpperCase();
  return t.startsWith('BREAKING');
}

function badgeClass(post) {
  const cat = (post.category || '').toLowerCase();
  if (cat.includes('earthquake') || cat.includes('volcano')) return 'badge-warning';
  if (cat.includes('weather') || cat.includes('maritime')) return 'badge-accent';
  if (cat.includes('airspace') || cat.includes('travel')) return 'badge-accent';
  return 'badge-live';
}

// ── Card renderers ───────────────────────────────

let _allBreaking = [];

function renderCard(post, large) {
  const title = getPostTitle(post);
  const image = getPostImage(post);
  const date = formatDate(getPostDate(post));
  const source = post.source || '';
  const category = getCategory(post);
  const url = articleUrl(post);
  const excerpt = (post.text || post.content || post.Content || '').replace(/<[^>]*>/g, '').trim();
  const short = excerpt.length > 160 ? excerpt.slice(0, 157) + '…' : excerpt;
  const views = shortNum(post.views || post.impressions);
  const likes = shortNum(post.likes);

  const largeClass = large ? ' post-card--large' : '';
  return `
    <a href="${esc(url)}" class="post-card${largeClass}" aria-label="${esc(title)}">
      ${image ? `<div class="post-card-image"><img src="${esc(image)}" alt="" loading="lazy" decoding="async"></div>` : ''}
      <div class="post-card-body">
        ${category ? `<span class="badge ${badgeClass(post)}">${esc(category)}</span>` : isBreakingText(post) ? '<span class="badge badge-live">Breaking</span>' : ''}
        <h3 class="post-card-title">${esc(title)}</h3>
        ${short ? `<p class="post-card-excerpt">${esc(short)}</p>` : ''}
        <div class="post-card-meta">
          ${source ? `<span class="post-card-source">${esc(source)}</span>` : ''}
          ${date ? `<time class="post-card-date">${esc(date)}</time>` : ''}
        </div>
        ${(views || likes) ? `<div class="post-stats">${views ? `<span class="post-stat"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>${views}</span>` : ''}${likes ? `<span class="post-stat"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>${likes}</span>` : ''}</div>` : ''}
      </div>
    </a>`;
}

function renderFeatured(post) {
  const title = getPostTitle(post);
  const image = getPostImage(post);
  const date = formatDate(getPostDate(post));
  const url = articleUrl(post);
  const excerpt = (post.text || post.content || '').replace(/<[^>]*>/g, '').trim();
  const short = excerpt.length > 240 ? excerpt.slice(0, 237) + '…' : excerpt;
  const views = shortNum(post.views || post.impressions);
  const likes = shortNum(post.likes);
  const isBreaking = isBreakingText(post);

  return `
    <a href="${esc(url)}" class="featured-story" aria-label="${esc(title)}">
      ${image ? `<div class="featured-story-image"><img src="${esc(image)}" alt="" loading="lazy" decoding="async"></div>` : ''}
      <div class="featured-story-content">
        <div class="featured-story-badges">
          ${isBreaking ? '<span class="badge badge-live">Breaking</span>' : '<span class="badge badge-accent">Latest</span>'}
          ${date ? `<time class="featured-story-date">${esc(date)}</time>` : ''}
        </div>
        <h2 class="featured-story-title">${esc(title)}</h2>
        ${short ? `<p class="featured-story-excerpt">${esc(short)}</p>` : ''}
        ${(views || likes) ? `<div class="post-stats">${views ? `<span class="post-stat"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>${views}</span>` : ''}${likes ? `<span class="post-stat"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>${likes}</span>` : ''}</div>` : ''}
        <span class="featured-story-cta">Read Full Story &rarr;</span>
      </div>
    </a>`;
}

function renderAlertCard(post) {
  const title = getPostTitle(post);
  const date = formatDate(getPostDate(post));
  const category = getCategory(post) || 'Alert';
  const url = articleUrl(post);
  const image = getPostImage(post);
  const location = post.location || post.location_display || '';
  const magnitude = post.magnitude;

  return `
    <a href="${esc(url)}" class="post-card post-card--alert" aria-label="${esc(title)}">
      ${image ? `<div class="post-card-image"><img src="${esc(image)}" alt="" loading="lazy" decoding="async"></div>` : ''}
      <div class="post-card-body">
        <span class="badge ${badgeClass(post)}">${magnitude ? `M${esc(String(magnitude))} ` : ''}${esc(category)}</span>
        <h3 class="post-card-title">${esc(title)}</h3>
        <div class="post-card-meta">
          ${location ? `<span class="post-card-source">${esc(location)}</span>` : ''}
          ${date ? `<time class="post-card-date">${esc(date)}</time>` : ''}
        </div>
      </div>
    </a>`;
}

function renderEmpty(msg) {
  return `
    <div class="feed-state">
      <p class="feed-state-title">${msg || 'No stories yet'}</p>
      <p class="feed-state-text">Check back soon.</p>
    </div>`;
}

function renderError() {
  return `
    <div class="feed-state">
      <p class="feed-state-title">Couldn't load stories</p>
      <p class="feed-state-text">Something went wrong. Please try again in a moment.</p>
      <button class="btn btn-secondary btn-sm feed-retry-btn" type="button">Retry</button>
    </div>`;
}

function skeletons(n) {
  return Array.from({ length: n }, () => '<div class="feed-skeleton" aria-hidden="true"></div>').join('');
}

// ── Public API ───────────────────────────────────

let _cachedPosts = null;

async function fetchPosts() {
  if (_cachedPosts) return _cachedPosts;
  const res = await fetch(`${FEED_API}?limit=${FETCH_LIMIT}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const posts = await res.json();
  if (!Array.isArray(posts)) throw new Error('Invalid response');
  _cachedPosts = posts;
  return posts;
}

function populateTicker(posts) {
  const tickerBar = document.getElementById('hero-ticker');
  const track = document.getElementById('ticker-track');
  if (!tickerBar || !track || posts.length === 0) return;

  const items = posts.slice(0, 12);
  const html = items.map(p => {
    const cat = getCategory(p) || 'News';
    const title = getPostTitle(p);
    const shortTitle = title.length > 80 ? title.slice(0, 77) + '…' : title;
    return `<a href="${esc(articleUrl(p))}" class="ticker-item"><span class="ticker-category">${esc(cat)}</span> ${esc(shortTitle)}</a><span class="ticker-separator" aria-hidden="true">/</span>`;
  }).join('');

  track.innerHTML = html + html;
  tickerBar.hidden = false;
}

export async function initFeed() {
  const heroEl = document.getElementById('featured-story-container');
  const breakingEl = document.getElementById('breaking-container');
  const alertsEl = document.getElementById('alerts-container');
  const alertCountEl = document.getElementById('alert-count');

  try {
    const posts = await fetchPosts();
    const breaking = posts.filter(p => !isAlertPost(p));
    const alerts = posts.filter(p => isAlertPost(p));

    populateTicker([...breaking.slice(0, 8), ...alerts.slice(0, 4)]);

    if (heroEl && breaking.length > 0) {
      heroEl.innerHTML = renderFeatured(breaking[0]);
      heroEl.classList.add('feed-loaded');
    }

    if (breakingEl) {
      const grid = breaking.slice(1, BREAKING_DISPLAY + 1);
      if (grid.length > 0) {
        breakingEl.innerHTML = grid.map((post, i) =>
          i === 0 ? renderCard(post, true) : renderCard(post)
        ).join('');
        breakingEl.classList.remove('feed-placeholder');
        breakingEl.classList.add('feed-grid', 'feed-loaded');
      } else {
        breakingEl.innerHTML = renderEmpty('No breaking news right now');
        breakingEl.classList.add('feed-loaded');
      }
    }

    if (alertsEl) {
      if (alerts.length > 0) {
        alertsEl.innerHTML = alerts.slice(0, ALERTS_DISPLAY).map(renderAlertCard).join('');
        alertsEl.classList.remove('feed-placeholder');
        alertsEl.classList.add('feed-grid', 'feed-loaded');
      } else {
        alertsEl.innerHTML = renderEmpty('No active alerts');
        alertsEl.classList.add('feed-loaded');
      }
    }

    if (alertCountEl && alerts.length > 0) {
      alertCountEl.textContent = `${alerts.length} active alert${alerts.length !== 1 ? 's' : ''}`;
    }

    _allBreaking = breaking;
    initFilters(breaking);
    initLoadMore(breaking);
  } catch (err) {
    console.error('[Feed] Failed to load:', err);
    const errorHtml = renderError();
    if (breakingEl) {
      breakingEl.innerHTML = errorHtml;
      breakingEl.classList.add('feed-loaded');
    }

    const retryBtn = breakingEl?.querySelector('.feed-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        _cachedPosts = null;
        if (breakingEl) {
          breakingEl.classList.remove('feed-loaded');
          breakingEl.classList.add('feed-placeholder');
          breakingEl.innerHTML = skeletons(4);
        }
        initFeed();
      }, { once: true });
    }
  }
}

// ── Filter Chips ────────────────────────────────

function getFilterCategories(posts) {
  const counts = {};
  posts.forEach(p => {
    const cat = getCategory(p) || (isBreakingText(p) ? 'Breaking' : 'News');
    counts[cat] = (counts[cat] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat]) => cat);
}

let _activeFilter = 'All';
let _displayCount = BREAKING_DISPLAY;

function renderBreakingGrid(posts) {
  const breakingEl = document.getElementById('breaking-container');
  if (!breakingEl) return;

  const filtered = _activeFilter === 'All'
    ? posts.slice(1)
    : posts.slice(1).filter(p => {
        const cat = getCategory(p) || (isBreakingText(p) ? 'Breaking' : 'News');
        return cat === _activeFilter;
      });

  const visible = filtered.slice(0, _displayCount);
  if (visible.length > 0) {
    breakingEl.innerHTML = visible.map((post, i) =>
      i === 0 ? renderCard(post, true) : renderCard(post)
    ).join('');
    breakingEl.classList.remove('feed-placeholder');
    breakingEl.classList.add('feed-grid', 'feed-loaded');
  } else {
    breakingEl.innerHTML = renderEmpty('No stories in this category');
    breakingEl.classList.add('feed-loaded');
  }

  const loadMoreBtn = document.getElementById('load-more-btn');
  if (loadMoreBtn) {
    loadMoreBtn.hidden = filtered.length <= _displayCount;
  }
}

function initFilters(breaking) {
  const container = document.getElementById('breaking-filters');
  if (!container || breaking.length <= 2) return;

  const cats = getFilterCategories(breaking);
  const chips = ['All', ...cats];

  container.innerHTML = chips.map(cat =>
    `<button class="filter-chip${cat === 'All' ? ' is-active' : ''}" type="button" data-filter="${esc(cat)}">${esc(cat)}</button>`
  ).join('');

  container.addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    _activeFilter = chip.dataset.filter;
    _displayCount = BREAKING_DISPLAY;
    container.querySelectorAll('.filter-chip').forEach(c =>
      c.classList.toggle('is-active', c.dataset.filter === _activeFilter)
    );
    renderBreakingGrid(breaking);
  });
}

function initLoadMore(breaking) {
  const btn = document.getElementById('load-more-btn');
  if (!btn) return;

  const remaining = breaking.length - 1 - BREAKING_DISPLAY;
  btn.hidden = remaining <= 0;

  btn.addEventListener('click', () => {
    _displayCount += BREAKING_LOAD_MORE;
    renderBreakingGrid(breaking);
  });
}
