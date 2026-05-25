/**
 * Noteworthy News V2 — Feed Module
 *
 * Fetches posts from posts-read, partitions into Breaking News vs
 * engine-sourced Alerts, and renders each into its own section.
 */

import { UISounds } from './ui-sounds.js';

const FEED_API = '/.netlify/functions/posts-read';
const FETCH_LIMIT = 100;
const BREAKING_DISPLAY = 8;
const BREAKING_LOAD_MORE = 12;
const ALERTS_DISPLAY = 6;

const ENGINE_CATEGORIES = new Set([
  'Earthquake', 'Weather Alert', 'Volcano Alert',
  'Maritime Alert', 'Airspace Alert', 'Travel Advisory',
]);

const MUTED_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
const UNMUTED_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';

function isLowMagEarthquake(post) {
  const cat = (post.category || '').toLowerCase();
  const src = (post.source || '').toLowerCase();
  const isQuake = cat === 'earthquake' || src.includes('usgs');
  if (!isQuake) return false;
  const mag = post.magnitude ?? post.mag ?? post.assets?.magnitude;
  const m = typeof mag === 'string' ? parseFloat(mag) : Number(mag);
  return !Number.isFinite(m) || m < 6.0;
}

function isNonWeatherNWSAlert(post) {
  const title = (post.title || post.text || '').toLowerCase();
  const blocked = ['child abduction', 'amber alert', 'silver alert', 'blue alert', 'missing person', 'civil emergency'];
  return blocked.some(t => title.includes(t));
}

function isAlertPost(post) {
  if (isLowMagEarthquake(post)) return false;
  if (isNonWeatherNWSAlert(post)) return false;
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
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 6) return `${hours}h ago`;
  const opts = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  const dateStr = d.toLocaleDateString('en-US', opts);
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${dateStr} · ${timeStr}`;
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

function getSmartLabel(post) {
  const text = (post.text || post.title || post.story || '').toUpperCase();
  if (text.startsWith('UPDATE:') || text.startsWith('UPDATE |')) return { label: 'Update', cls: 'badge-accent' };
  if (text.startsWith('DEVELOPING:') || text.startsWith('DEVELOPING |')) return { label: 'Developing', cls: 'badge-warning' };
  if (text.startsWith('WATCH:') || text.startsWith('VIDEO:')) return { label: 'Watch', cls: 'badge-accent' };
  if (post.postType === 'video' || post.video_url) return { label: 'Video', cls: 'badge-accent' };
  const cat = getCategory(post);
  if (cat) return { label: cat, cls: badgeClass(post) };
  if (isBreakingText(post)) return { label: 'Breaking', cls: 'badge-live' };
  return null;
}

// ── Card renderers ───────────────────────────────

let _allBreaking = [];

function getXUrl(post) {
  const u = post.x_url || post.link || '';
  return (u.includes('x.com') || u.includes('twitter.com')) ? u : '';
}

function isVideoPost(post) {
  return post.postType === 'video' || !!post.video_url || (post.videos && post.videos.length > 0);
}

function getVideoUrl(post) {
  const raw = post.video_url || (post.videos && post.videos[0]) || null;
  if (!raw) return null;
  return raw.replace('https://video.twimg.com/', '/media/video/');
}

function playVisibleVideos() {
  const videos = document.querySelectorAll('.post-card-video video, .featured-story-image video');
  if (!videos.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video = entry.target;
      if (entry.isIntersecting) {
        if (!video.src && video.dataset.src) {
          video.src = video.dataset.src;
          video.load();
        }
        video.addEventListener('canplay', () => video.play().catch(() => {}), { once: true });
        if (video.readyState >= 2) video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, { threshold: 0.1 });

  videos.forEach(video => {
    video.muted = true;
    observer.observe(video);

    video.addEventListener('mouseenter', () => { video.muted = false; });
    video.addEventListener('mouseleave', () => { video.muted = true; });
  });
}

function renderCard(post, large) {
  const title = getPostTitle(post);
  const image = getPostImage(post);
  const date = formatDate(getPostDate(post));
  const source = post.source || '';
  const url = articleUrl(post);
  const excerpt = (post.text || post.content || post.Content || '').replace(/<[^>]*>/g, '').trim();
  const short = excerpt.length > 160 ? excerpt.slice(0, 157) + '…' : excerpt;
  const hasVideo = isVideoPost(post);
  const smart = getSmartLabel(post);

  const classes = ['post-card'];
  if (large) classes.push('post-card--large');
  if (!image) classes.push('post-card--text-only');

  const videoSrc = hasVideo ? getVideoUrl(post) : null;

  let mediaHtml = '';
  if (videoSrc) {
    mediaHtml = `<div class="post-card-image post-card-video"><video data-src="${esc(videoSrc)}" muted loop playsinline disablepictureinpicture preload="none" poster="${image ? esc(image) : ''}"></video><button class="video-mute-btn" aria-label="Unmute" onclick="event.preventDefault();event.stopPropagation();const v=this.parentElement.querySelector('video');v.muted=!v.muted;this.innerHTML=v.muted?'${MUTED_SVG}':'${UNMUTED_SVG}';this.setAttribute('aria-label',v.muted?'Unmute':'Mute')"></button></div>`;
  } else if (image) {
    mediaHtml = `<div class="post-card-image"><img src="${esc(image)}" alt="" loading="lazy" decoding="async" onerror="this.parentElement.classList.add('post-card-image--broken')"></div>`;
  }

  return `
    <a href="${esc(url)}" class="${classes.join(' ')}" aria-label="${esc(title)}">
      ${mediaHtml}
      <div class="post-card-body">
        ${smart ? `<span class="badge ${smart.cls}">${esc(smart.label)}</span>` : ''}
        <h3 class="post-card-title">${esc(title)}</h3>
        ${short ? `<p class="post-card-excerpt">${esc(short)}</p>` : ''}
        <div class="post-card-meta">
          ${source ? `<span class="post-card-source">${esc(source)}</span>` : ''}
          ${date ? `<time class="post-card-date">${esc(date)}</time>` : ''}
        </div>
      </div>
    </a>`;
}

function renderFeatured(post) {
  const title = getPostTitle(post);
  const image = getPostImage(post);
  const date = formatDate(getPostDate(post));
  const url = articleUrl(post);
  const excerpt = (post.text || post.content || '').replace(/<[^>]*>/g, '').trim();
  const short = excerpt.length > 180 ? excerpt.slice(0, 177) + '…' : excerpt;
  const isBreaking = isBreakingText(post);
  const xLink = getXUrl(post);
  const hasVideo = isVideoPost(post);

  const videoSrc = hasVideo ? getVideoUrl(post) : null;

  let featuredMedia = '';
  if (videoSrc) {
    featuredMedia = `<div class="featured-story-image post-card-video"><video data-src="${esc(videoSrc)}" muted loop playsinline disablepictureinpicture preload="none" poster="${image ? esc(image) : ''}"></video></div>`;
  } else if (image) {
    featuredMedia = `<div class="featured-story-image"><img src="${esc(image)}" alt="" loading="lazy" decoding="async" onerror="this.parentElement.classList.add('post-card-image--broken')"></div>`;
  }

  return `
    <a href="${esc(url)}" class="featured-story${isBreaking ? ' featured-story--breaking' : ''}" aria-label="${esc(title)}">
      ${featuredMedia}
      <div class="featured-story-content">
        <div class="featured-story-badges">
          ${(() => { const s = getSmartLabel(post); return s ? `<span class="badge ${s.cls}">${esc(s.label)}</span>` : '<span class="badge badge-accent">Latest</span>'; })()}
          ${date ? `<time class="featured-story-date">${esc(date)}</time>` : ''}
        </div>
        <h2 class="featured-story-title">${esc(title)}</h2>
        ${short ? `<p class="featured-story-excerpt">${esc(short)}</p>` : ''}
        ${xLink ? `<span class="featured-story-source" data-href="${esc(xLink)}" onclick="event.preventDefault();event.stopPropagation();window.open(this.dataset.href,'_blank');" role="link" tabindex="0">Originally posted on X</span>` : ''}
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
      ${image ? `<div class="post-card-image"><img src="${esc(image)}" alt="" loading="lazy" decoding="async" onerror="this.parentElement.classList.add('post-card-image--broken')"></div>` : ''}
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

function renderWireItem(post) {
  const title = getPostTitle(post);
  const date = formatDate(getPostDate(post));
  const url = articleUrl(post);
  const smart = getSmartLabel(post);
  const isLive = smart && smart.cls === 'badge-live';

  return `
    <a href="${esc(url)}" class="wire-item" aria-label="${esc(title)}">
      <span class="wire-dot${isLive ? ' wire-dot--live' : ''}"></span>
      ${smart ? `<span class="badge ${smart.cls} wire-badge">${esc(smart.label)}</span>` : ''}
      <span class="wire-headline">${esc(title)}</span>
      ${date ? `<time class="wire-time">${esc(date)}</time>` : ''}
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
    const visible = posts.filter(p => !isLowMagEarthquake(p) && !isNonWeatherNWSAlert(p));
    const breaking = visible.filter(p => !isAlertPost(p));
    const alerts = visible.filter(p => isAlertPost(p));

    const allForTicker = [...breaking.slice(0, 8), ...alerts.slice(0, 8)];
    populateTicker(allForTicker);

    // Featured story: prefer breaking, fall back to most recent alert
    if (heroEl) {
      const featuredPost = breaking.length > 0 ? breaking[0] : alerts[0];
      if (featuredPost) {
        heroEl.innerHTML = renderFeatured(featuredPost);
        heroEl.classList.add('feed-loaded');
      }
    }

    // Breaking news grid: skip the featured post
    const gridSource = breaking.length > 0 ? breaking : [];
    if (breakingEl) {
      const grid = gridSource.slice(1, BREAKING_DISPLAY + 1);
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

    // Wire feed: remaining posts beyond the grid
    const wireEl = document.getElementById('wire-container');
    if (wireEl && gridSource.length > BREAKING_DISPLAY + 1) {
      const wireItems = gridSource.slice(BREAKING_DISPLAY + 1, BREAKING_DISPLAY + 1 + 12);
      if (wireItems.length > 0) {
        wireEl.innerHTML = wireItems.map(renderWireItem).join('');
        wireEl.classList.add('wire-loaded');
        const wireSection = wireEl.closest('.wire-section');
        if (wireSection) wireSection.hidden = false;
      }
    }

    // Alerts grid: skip featured if an alert was used there
    const alertStart = (breaking.length === 0 && alerts.length > 0) ? 1 : 0;
    if (alertsEl) {
      const alertSlice = alerts.slice(alertStart, alertStart + ALERTS_DISPLAY);
      if (alertSlice.length > 0) {
        alertsEl.innerHTML = alertSlice.map(renderAlertCard).join('');
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

    _allBreaking = gridSource;
    initFilters(gridSource);
    initLoadMore(gridSource);
    playVisibleVideos();
    UISounds.success();
  } catch (err) {
    console.error('[Feed] Failed to load:', err);
    UISounds.error();
    const errorHtml = renderError();
    if (breakingEl) {
      breakingEl.innerHTML = errorHtml;
      breakingEl.classList.add('feed-loaded');
    }

    const retryBtn = breakingEl?.querySelector('.feed-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        UISounds.tap();
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
    loadMoreBtn.hidden = visible.length === 0 || filtered.length <= _displayCount;
  }
  playVisibleVideos();
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
    UISounds.tap();
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

  function updateBtn() {
    const total = breaking.length - 1;
    const remaining = total - _displayCount;
    btn.hidden = remaining <= 0;
    if (remaining > 0) btn.textContent = `Load More (${remaining})`;
  }

  updateBtn();

  btn.addEventListener('click', () => {
    UISounds.tap();
    _displayCount += BREAKING_LOAD_MORE;
    renderBreakingGrid(breaking);
    updateBtn();
  });
}
