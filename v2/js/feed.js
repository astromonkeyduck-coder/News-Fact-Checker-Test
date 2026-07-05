/**
 * Noteworthy News V4 - Feed Module
 *
 * Fetches posts from posts-read and renders the homepage editorial surfaces:
 *   - hero flagship card (unless a live story already owns the slot)
 *   - Developing Now strip (engine alert updates; live stories render
 *     separately via live-rail.js)
 *   - Top Stories lead + secondary rows
 *   - The Wire compact list
 * Every timestamp, source, and category shown comes from real post data.
 */

import { UISounds } from './ui-sounds.js';
import {
  cancelVideoFade,
  ensureVideoPlaying,
  ensureVideoSrc,
  fadeVideoIn,
  fadeVideoOut,
  DEFAULT_FADE_IN_MS,
  DEFAULT_FADE_OUT_MS,
} from './video-audio.js';
import {
  buildVideoToolbarHTML,
  initVideoToolbar,
  updateToolbarState,
  getPreferredVolume,
} from './video-controls.js';

const FEED_API = '/.netlify/functions/posts-read';
const FETCH_LIMIT = 100;
const SECONDARY_DISPLAY = 5;
const SECONDARY_LOAD_MORE = 8;
const STRIP_DISPLAY = 8;
const WIRE_DISPLAY = 12;

const ENGINE_CATEGORIES = new Set([
  'Earthquake', 'Weather Alert', 'Volcano Alert',
  'Maritime Alert', 'Airspace Alert', 'Travel Advisory',
]);

function isLowMagEarthquake(post) {
  const cat = (post.category || '').toLowerCase();
  const evtType = (post.event_type || '').toLowerCase();
  const isQuake = cat === 'earthquake' || evtType === 'earthquake';
  if (!isQuake) return false;
  const mag = post.magnitude ?? post.mag ?? post.assets?.magnitude;
  const m = typeof mag === 'string' ? parseFloat(mag) : Number(mag);
  return !Number.isFinite(m) || m < 4.5;
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

function shortTime(raw) {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// Remove URLs (http/https, t.co, pic.twitter.com) so raw links never render in cards.
function stripUrls(str) {
  if (!str) return '';
  return String(str)
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\b(?:pic\.twitter\.com|t\.co)\/\S+/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .trim();
}

function getPostTitle(post) {
  if (post.title && post.title.trim()) {
    const cleaned = stripUrls(post.title);
    if (cleaned) return cleaned;
  }
  const text = stripUrls(post.text || post.content || post.Content || '');
  if (!text) return 'Untitled';
  const first = text.split('\n')[0].trim();
  return first.length <= 140 ? first : first.slice(0, 137) + '…';
}

function getVolcanoAlertFallbackImage(post) {
  const cat = String(post.category || '').toLowerCase();
  const title = String(post.title || post.text || post.story || '').toLowerCase();
  if (!cat.includes('volcano') && !title.includes('volcano')) return null;
  if (title.includes('kilauea')) return '/assets/alerts/kilauea-volcano.jpg';
  if (title.includes('great sitkin')) return '/assets/alerts/great-sitkin-volcano.jpg';
  return null;
}

function getPostImage(post) {
  return post.imageUrl || post.image_url || post.image || post.primary_image_url || post.mediaUrl || post.media_url || getVolcanoAlertFallbackImage(post) || null;
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

function isBreakingText(post) {
  const t = (post.text || post.title || post.story || '').toUpperCase();
  return t.startsWith('BREAKING');
}

function normalizeTitle(post) {
  let title = getPostTitle(post);
  title = title.replace(/^(?:BREAKING|VIDEO|WATCH|UPDATE|DEVELOPING)\s*:?\s*/i, '').trim();
  return title || getPostTitle(post);
}

function shouldShowExcerpt(title, excerpt) {
  if (!excerpt || !title) return false;
  const norm = (s) =>
    s
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const a = norm(title);
  const b = norm(excerpt);
  if (!b || a === b) return false;
  if (b.startsWith(a) || a.startsWith(b.slice(0, Math.min(a.length, 72)))) return false;
  return true;
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

// ── Video handling (lead card) ───────────────────

function isVideoPost(post) {
  return post.postType === 'video' || !!post.video_url || (post.videos && post.videos.length > 0);
}

function getVideoUrl(post) {
  const raw = post.video_url || (post.videos && post.videos[0]) || null;
  if (!raw) return null;
  return raw.replace('https://video.twimg.com/', '/media/video/');
}

function isUserMuted(video) {
  return video.dataset.userMuted === 'true';
}

function updateMuteButton(video) {
  updateToolbarState(video);
}

function loadAndPlay(video) {
  ensureVideoSrc(video);
  if (video.readyState >= 2) {
    return ensureVideoPlaying(video);
  }
  return new Promise((resolve) => {
    video.addEventListener('canplay', () => {
      ensureVideoPlaying(video).then(resolve).catch(resolve);
    }, { once: true });
  });
}

let _videoObserver = null;
const _videoVisibility = new Map();
let _audibleVideo = null;

function setVideoAudible(video, { fadeInMs = DEFAULT_FADE_IN_MS } = {}) {
  if (!video || isUserMuted(video)) return;
  if (_audibleVideo && _audibleVideo !== video) {
    fadeVideoOut(_audibleVideo, { pause: false, resetMuted: true, duration: DEFAULT_FADE_OUT_MS });
  }
  _audibleVideo = video;
  loadAndPlay(video).then(() => {
    fadeVideoIn(video, {
      duration: fadeInMs,
      targetVolume: getPreferredVolume(),
      onComplete: () => updateMuteButton(video),
    });
  });
}

function silenceVideo(video, { pause = true } = {}) {
  if (!video) return;
  cancelVideoFade(video);
  fadeVideoOut(video, {
    duration: DEFAULT_FADE_OUT_MS,
    pause,
    resetMuted: true,
    onComplete: () => {
      if (_audibleVideo === video) _audibleVideo = null;
      updateMuteButton(video);
    },
  });
}

function syncMobileAudible() {
  const visible = [..._videoVisibility.entries()]
    .filter(([, ratio]) => ratio > 0)
    .sort((a, b) => b[1] - a[1]);

  const winner = visible[0]?.[0];

  for (const [video] of visible) {
    if (video === winner) {
      if (!isUserMuted(video)) setVideoAudible(video);
    } else {
      silenceVideo(video, { pause: false });
    }
  }

  if (!winner && _audibleVideo) {
    silenceVideo(_audibleVideo, { pause: false });
  }
}

function handleVideoEnter(video, isMobile) {
  loadAndPlay(video).then(() => {
    video.volume = 0;
    video.muted = true;
    if (!isMobile) updateMuteButton(video);
  });
}

function handleVideoLeave(video, isMobile) {
  if (isMobile && _audibleVideo === video) _audibleVideo = null;
  silenceVideo(video, { pause: true });
}

function bindVideoControls(video) {
  if (video.dataset.videoBound === 'true') return;
  video.dataset.videoBound = 'true';
  video.volume = 0;
  video.muted = true;

  video.addEventListener('mouseenter', () => {
    if (isUserMuted(video)) return;
    if (_videoVisibility.get(video) <= 0) return;
    loadAndPlay(video).then(() => {
      fadeVideoIn(video, {
        duration: DEFAULT_FADE_IN_MS,
        targetVolume: getPreferredVolume(),
        onComplete: () => updateMuteButton(video),
      });
    });
  });
  video.addEventListener('mouseleave', () => {
    fadeVideoOut(video, {
      duration: DEFAULT_FADE_OUT_MS,
      pause: false,
      resetMuted: true,
      onComplete: () => updateMuteButton(video),
    });
  });

  initVideoToolbar(video, {
    isHero: false,
    onMuteClick: (_e, v) => {
      const willMute = !isUserMuted(v);
      v.dataset.userMuted = willMute ? 'true' : 'false';
      if (willMute) {
        cancelVideoFade(v);
        fadeVideoOut(v, {
          pause: false,
          resetMuted: true,
          onComplete: () => updateMuteButton(v),
        });
        if (_audibleVideo === v) _audibleVideo = null;
      } else {
        loadAndPlay(v).then(() => {
          fadeVideoIn(v, {
            targetVolume: getPreferredVolume(),
            onComplete: () => updateMuteButton(v),
          });
          _audibleVideo = v;
        });
      }
    },
  });
}

function playVisibleVideos() {
  if (_videoObserver) {
    _videoObserver.disconnect();
    _videoObserver = null;
  }
  _videoVisibility.clear();
  _audibleVideo = null;

  const videos = document.querySelectorAll('.post-card-video video');
  if (!videos.length) return;

  _videoObserver = new IntersectionObserver((entries) => {
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    let needsMobileSync = false;

    entries.forEach(entry => {
      const video = entry.target;
      const wasVisible = (_videoVisibility.get(video) || 0) > 0;
      const ratio = entry.isIntersecting ? entry.intersectionRatio : 0;
      _videoVisibility.set(video, ratio);

      if (entry.isIntersecting && !wasVisible) {
        handleVideoEnter(video, isMobile);
        if (isMobile) needsMobileSync = true;
      } else if (!entry.isIntersecting && wasVisible) {
        handleVideoLeave(video, isMobile);
        if (isMobile) needsMobileSync = true;
      } else if (entry.isIntersecting && isMobile) {
        needsMobileSync = true;
      }
    });

    if (needsMobileSync) syncMobileAudible();
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] });

  videos.forEach(video => {
    _videoVisibility.set(video, 0);
    bindVideoControls(video);
    _videoObserver.observe(video);
  });
}

// ── Renderers ────────────────────────────────────

function metaHtml(post, { withSource = true } = {}) {
  const date = formatDate(getPostDate(post));
  const source = withSource ? (post.source || '') : '';
  const parts = [];
  if (source) parts.push(`<span>${esc(source)}</span>`);
  if (date) parts.push(`<time>${esc(date)}</time>`);
  return parts.length
    ? `<div class="card-meta">${parts.join('<span class="meta-sep" aria-hidden="true">&middot;</span>')}</div>`
    : '';
}

function renderHeroCard(post) {
  const title = normalizeTitle(post);
  const image = getPostImage(post);
  const date = formatDate(getPostDate(post));
  const smart = getSmartLabel(post);
  const excerpt = stripUrls((post.text || post.content || '').replace(/<[^>]*>/g, ''));
  const short = excerpt.length > 150 ? excerpt.slice(0, 147) + '…' : excerpt;
  const showExcerpt = shouldShowExcerpt(title, short);

  return `
    <a class="hero-card-link" href="${esc(articleUrl(post))}" aria-label="${esc(title)}">
      <div class="hero-card-top">
        <span class="badge ${smart ? smart.cls : 'badge-accent'}">${esc(smart ? smart.label : 'Latest')}</span>
        ${date ? `<span class="hero-card-meta">${esc(date)}</span>` : ''}
      </div>
      <div class="hero-card-row">
        <h3 class="hero-card-title">${esc(title)}</h3>
        ${image ? `<img class="hero-card-thumb" src="${esc(image)}" alt="" loading="eager" decoding="async" onerror="this.remove()">` : ''}
      </div>
      ${showExcerpt ? `<p class="hero-card-summary">${esc(short)}</p>` : ''}
      <span class="hero-card-cta">Read the story
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      </span>
    </a>`;
}

function renderHeroFallback() {
  return `
    <div class="hero-card-link" role="status">
      <div class="hero-card-top">
        <span class="badge badge-accent">Standby</span>
      </div>
      <h3 class="hero-card-title">Live feed reconnecting</h3>
      <p class="hero-card-summary">The latest stories are temporarily unavailable. Coverage continues in the archive.</p>
      <a class="hero-card-cta" href="/archive.html">Browse the archive
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      </a>
    </div>`;
}

function renderStripCard(post, i) {
  const title = normalizeTitle(post);
  const time = shortTime(getPostDate(post));
  const smart = getSmartLabel(post);
  const source = post.source || getCategory(post) || '';
  const magnitude = post.magnitude;
  const foot = [magnitude ? `M${magnitude}` : '', post.location || post.location_display || source]
    .filter(Boolean).join(' · ');

  return `
    <a class="dev-card" style="--i:${i}" href="${esc(articleUrl(post))}" aria-label="${esc(title)}">
      <div class="dev-card-top">
        ${smart ? `<span class="badge ${smart.cls}">${esc(smart.label)}</span>` : '<span class="badge badge-accent">Update</span>'}
        ${time ? `<span class="dev-card-time">${esc(time)} ago</span>` : ''}
      </div>
      <h3 class="dev-card-title">${esc(title)}</h3>
      ${foot ? `<span class="dev-card-foot">${esc(foot)}</span>` : ''}
    </a>`;
}

function renderLead(post) {
  const title = normalizeTitle(post);
  const image = getPostImage(post);
  const smart = getSmartLabel(post);
  const excerpt = stripUrls((post.text || post.content || '').replace(/<[^>]*>/g, ''));
  const short = excerpt.length > 190 ? excerpt.slice(0, 187) + '…' : excerpt;
  const showExcerpt = shouldShowExcerpt(title, short);
  const videoSrc = isVideoPost(post) ? getVideoUrl(post) : null;

  let media = '';
  if (videoSrc) {
    media = `<div class="lead-media post-card-video"><video data-src="${esc(videoSrc)}" muted loop playsinline disablepictureinpicture preload="none" poster="${image ? esc(image) : ''}"></video>${buildVideoToolbarHTML()}</div>`;
  } else if (image) {
    media = `<div class="lead-media"><img src="${esc(image)}" alt="" loading="lazy" decoding="async" onerror="this.parentElement.classList.add('lead-media--broken')"></div>`;
  }

  return `
    <a href="${esc(articleUrl(post))}" class="lead-card feed-in" aria-label="${esc(title)}">
      ${media}
      <div class="lead-body">
        <div class="lead-top">
          ${smart ? `<span class="badge ${smart.cls}">${esc(smart.label)}</span>` : ''}
        </div>
        <h3 class="lead-title">${esc(title)}</h3>
        ${showExcerpt ? `<p class="lead-excerpt">${esc(short)}</p>` : ''}
        ${metaHtml(post)}
      </div>
    </a>`;
}

function renderRow(post, i) {
  const title = normalizeTitle(post);
  const image = getPostImage(post);
  const smart = getSmartLabel(post);

  return `
    <a href="${esc(articleUrl(post))}" class="story-row feed-in" style="--i:${i}" aria-label="${esc(title)}">
      <div class="story-row-body">
        <div class="story-row-top">
          ${smart ? `<span class="badge ${smart.cls}">${esc(smart.label)}</span>` : ''}
        </div>
        <h3 class="story-row-title">${esc(title)}</h3>
        ${metaHtml(post)}
      </div>
      ${image ? `<img class="story-row-thumb" src="${esc(image)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''}
    </a>`;
}

function renderWireItem(post, i) {
  const title = normalizeTitle(post);
  const time = shortTime(getPostDate(post));
  const smart = getSmartLabel(post);
  let catCls = 'wire-cat';
  if (smart && smart.cls === 'badge-live') catCls += ' wire-cat--live';
  if (smart && smart.cls === 'badge-warning') catCls += ' wire-cat--warning';

  return `
    <a href="${esc(articleUrl(post))}" class="wire-item feed-in" style="--i:${i}" aria-label="${esc(title)}">
      <span class="wire-time">${time ? esc(time) : '&middot;'}</span>
      <span class="wire-body">
        <span class="wire-headline">${esc(title)}</span>
        ${smart ? `<span class="${catCls}">${esc(smart.label)}</span>` : ''}
      </span>
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
      <button class="btn btn-outline btn-sm feed-retry-btn" type="button">Retry</button>
    </div>`;
}

// ── Public API ───────────────────────────────────

let _cachedPosts = null;

const IS_LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

async function fetchPostsFrom(base) {
  const res = await fetch(`${base}?limit=${FETCH_LIMIT}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const posts = await res.json();
  if (!Array.isArray(posts)) throw new Error('Invalid response');
  return posts;
}

async function fetchPosts() {
  if (_cachedPosts) return _cachedPosts;
  try {
    _cachedPosts = await fetchPostsFrom(FEED_API);
  } catch (err) {
    // Local dev: posts-read depends on Netlify Blobs, which `netlify dev`
    // often cannot reach. Fall back to the production feed (CORS is open).
    if (!IS_LOCAL) throw err;
    _cachedPosts = await fetchPostsFrom(`https://noteworthynews.co${FEED_API}`);
  }
  return _cachedPosts;
}

function heroSlot() {
  return document.getElementById('hero-card');
}

/** Write the flagship post into the hero card unless a live story owns it. */
function fillHeroCard(html, status) {
  const slot = heroSlot();
  if (!slot || slot.dataset.heroSource === 'live') return;
  slot.innerHTML = html;
  slot.dataset.heroSource = 'post';
  if (status) slot.dataset.status = status;
}

function stripUpdated() {
  document.dispatchEvent(new CustomEvent('nn:strip-updated'));
}

export async function initFeed() {
  const leadEl = document.getElementById('lead-story');
  const secondaryEl = document.getElementById('secondary-stories');
  const wireEl = document.getElementById('wire-list');
  const stripPostsEl = document.getElementById('strip-posts');

  try {
    const posts = await fetchPosts();
    const visible = posts.filter(p => !isLowMagEarthquake(p) && !isNonWeatherNWSAlert(p));
    const breaking = visible.filter(p => !isAlertPost(p));
    const alerts = visible.filter(p => isAlertPost(p));

    // Hero flagship: latest breaking post, else latest alert.
    const heroPost = breaking[0] || alerts[0] || null;
    if (heroPost) {
      fillHeroCard(renderHeroCard(heroPost), isBreakingText(heroPost) ? 'breaking' : '');
    } else {
      fillHeroCard(renderHeroFallback());
    }

    // Developing Now strip: engine alert updates (skip one used as hero).
    if (stripPostsEl) {
      const stripSource = breaking.length > 0 ? alerts : alerts.slice(1);
      const stripItems = stripSource.slice(0, STRIP_DISPLAY);
      stripPostsEl.innerHTML = stripItems.map((p, i) => renderStripCard(p, i)).join('');
      stripUpdated();
    }

    // Top Stories: pool excludes the hero post.
    _storyPool = breaking.length > 0 ? breaking.slice(1) : [];
    renderStoriesGrid();
    initFilters(_storyPool);
    initLoadMore();

    // The Wire: everything after lead/secondary, plus alert depth, by recency.
    if (wireEl) {
      const wireBreaking = _storyPool.slice(1 + SECONDARY_DISPLAY);
      const wireAlerts = alerts.slice(STRIP_DISPLAY);
      const wirePool = [...wireBreaking, ...wireAlerts]
        .map(p => ({ p, t: new Date(getPostDate(p) || 0).getTime() }))
        .sort((a, b) => b.t - a.t)
        .map(x => x.p)
        .slice(0, WIRE_DISPLAY);
      if (wirePool.length > 0) {
        wireEl.innerHTML = wirePool.map((p, i) => renderWireItem(p, i)).join('');
      } else {
        wireEl.innerHTML = renderEmpty('No additional updates');
      }
    }

    playVisibleVideos();
    UISounds.success();
  } catch (err) {
    console.error('[Feed] Failed to load:', err);
    UISounds.error();

    if (leadEl) leadEl.innerHTML = renderError();
    if (secondaryEl) secondaryEl.innerHTML = '';
    if (wireEl) wireEl.innerHTML = renderEmpty('Updates unavailable');
    if (stripPostsEl) {
      stripPostsEl.innerHTML = '';
      stripUpdated();
    }

    // Never leave the hero slot on an infinite skeleton.
    const slot = heroSlot();
    if (slot && slot.dataset.heroSource === 'none') {
      fillHeroCard(renderHeroFallback());
    }

    const retryBtn = leadEl?.querySelector('.feed-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        UISounds.tap();
        _cachedPosts = null;
        initFeed();
      }, { once: true });
    }
  }
}

// ── Top Stories grid (lead + secondary rows) ─────

let _storyPool = [];
let _activeFilter = 'All';
let _displayCount = SECONDARY_DISPLAY;

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

function renderStoriesGrid() {
  const leadEl = document.getElementById('lead-story');
  const secondaryEl = document.getElementById('secondary-stories');
  if (!leadEl || !secondaryEl) return;

  const filtered = _activeFilter === 'All'
    ? _storyPool
    : _storyPool.filter(p => {
        const cat = getCategory(p) || (isBreakingText(p) ? 'Breaking' : 'News');
        return cat === _activeFilter;
      });

  const lead = filtered[0];
  const rows = filtered.slice(1, 1 + _displayCount);

  if (lead) {
    leadEl.innerHTML = renderLead(lead);
  } else {
    leadEl.innerHTML = renderEmpty('No stories in this category');
  }

  secondaryEl.innerHTML = rows.map((p, i) => renderRow(p, i)).join('');

  const loadMoreBtn = document.getElementById('load-more-btn');
  if (loadMoreBtn) {
    const remaining = filtered.length - 1 - _displayCount;
    loadMoreBtn.hidden = remaining <= 0;
    if (remaining > 0) loadMoreBtn.textContent = `Load more (${remaining})`;
  }
  playVisibleVideos();
}

function initFilters(pool) {
  const container = document.getElementById('breaking-filters');
  if (!container || pool.length <= 2) return;

  const cats = getFilterCategories(pool);
  const chips = ['All', ...cats];

  container.innerHTML = chips.map(cat =>
    `<button class="filter-chip${cat === 'All' ? ' is-active' : ''}" type="button" data-filter="${esc(cat)}">${esc(cat)}</button>`
  ).join('');

  container.addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    UISounds.tap();
    _activeFilter = chip.dataset.filter;
    _displayCount = SECONDARY_DISPLAY;
    container.querySelectorAll('.filter-chip').forEach(c =>
      c.classList.toggle('is-active', c.dataset.filter === _activeFilter)
    );
    renderStoriesGrid();
  });
}

function initLoadMore() {
  const btn = document.getElementById('load-more-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    UISounds.tap();
    _displayCount += SECONDARY_LOAD_MORE;
    renderStoriesGrid();
  });
}
