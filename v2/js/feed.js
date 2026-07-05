/**
 * Noteworthy News V4 - Feed Module
 *
 * Fetches posts from posts-read and renders the homepage editorial surfaces:
 *   - hero flagship story (unless a live story already owns the slot)
 *   - Top Stories lead + secondary media cells + load-more grid
 *   - Developing Now strip (engine alert updates; live stories render
 *     separately via live-rail.js)
 *   - The Wire compact list
 * Every timestamp, source, and category shown comes from real post data.
 * All media rendering goes through post-media.js: one component per card.
 */

import { UISounds } from './ui-sounds.js';
import { initPostMedia, mediaHtml } from './post-media.js';

const FEED_API = '/.netlify/functions/posts-read';
const FETCH_LIMIT = 100;
const SECONDARY_DISPLAY = 4;
const MORE_LOAD_STEP = 8;
const STRIP_DISPLAY = 8;
const WIRE_DISPLAY = 12;

const ENGINE_CATEGORIES = new Set([
  'Earthquake', 'Weather Alert',
  'Maritime Alert', 'Airspace Alert', 'Travel Advisory',
]);

function isVolcanoEnginePost(post) {
  if (!post) return false;
  const cat = (post.category || '').toLowerCase();
  const evt = (post.event_type || post.eventType || '').toLowerCase();
  if (cat === 'volcano alert' || evt === 'volcano') return true;
  const src = (post.source || '').toLowerCase();
  if (src === 'usgs' && cat.includes('volcano')) return true;
  return false;
}

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
  if (isVolcanoEnginePost(post)) return false;
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

function isEarthquakePost(post) {
  const cat = (post.category || '').toLowerCase();
  const src = (post.source || '').toLowerCase();
  const evt = (post.event_type || '').toLowerCase();
  return cat === 'earthquake' || evt === 'earthquake' || src.includes('usgs');
}

function isGraphicMapImage(imageUrl, post) {
  if (!imageUrl) return false;
  const u = String(imageUrl).toLowerCase();
  if (u.includes('/assets/alerts/')) return false;
  if (u.includes('earthquake') || u.includes('get-uploaded-image') || u.includes('earthquake.usgs.gov')) {
    return true;
  }
  return isEarthquakePost(post);
}

function getPostImage(post) {
  let primary =
    post.imageUrl || post.image_url || post.image || post.primary_image_url ||
    post.mediaUrl || post.media_url || null;

  if (isEarthquakePost(post)) {
    const fromAssets =
      post.assets?.standard_image ||
      post.assets?.image_url ||
      post.assets?.generated_image;
    if (fromAssets) primary = primary || fromAssets;
    if (!primary && post.images?.length) {
      const generated = post.images.find(
        (u) => u && typeof u === 'string' && u.includes('get-uploaded-image') && u.includes('earthquake')
      );
      if (generated) primary = generated;
    }
    if (!primary) {
      const usgsImages = post.assets?.usgs_images || post.usgs_images || [];
      const first = usgsImages[0];
      if (first) primary = typeof first === 'string' ? first : (first?.url || null);
    }
  }

  return primary || getVolcanoAlertFallbackImage(post) || null;
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
  const raw = getPostTitle(post);

  // Volcano engine titles arrive as "WATCH - Great Sitkin" / "ADVISORY - Kilauea".
  // Rewrite them into a readable headline instead of stripping the level away.
  if (String(post.category || '').toLowerCase().includes('volcano')) {
    const m = raw.match(/^(WATCH|WARNING|ADVISORY)\s*[-:|]\s*(.+)$/i);
    if (m) {
      const level = m[1].toLowerCase();
      return `Volcano ${level} in effect for ${m[2].trim()}`;
    }
  }

  const title = raw.replace(/^(?:BREAKING|VIDEO|WATCH|UPDATE|DEVELOPING|NEW|NOW)\s*:\s*/i, '').trim();
  return title || raw;
}

/** Excerpt with the same label prefixes stripped, so cards never repeat
 *  "VIDEO:" or "BREAKING:" ahead of body text. */
function cleanExcerpt(post) {
  const raw = stripUrls((post.text || post.content || '').replace(/<[^>]*>/g, ''));
  return raw.replace(/^(?:BREAKING|VIDEO|WATCH|UPDATE|DEVELOPING|NEW|NOW)\s*:\s*/i, '').trim();
}

/** Engine feeds repeat standing advisories daily (volcano watches etc).
 *  Keep only the most recent post per normalized headline. */
function dedupeByTitle(posts) {
  const seen = new Set();
  return posts.filter(p => {
    const key = normalizeTitle(p).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

function isVideoPost(post) {
  return post.postType === 'video' || !!post.video_url || (post.videos && post.videos.length > 0);
}

function getVideoUrl(post) {
  const raw = post.video_url || (post.videos && post.videos[0]) || null;
  if (!raw) return null;
  return raw.replace('https://video.twimg.com/', '/media/video/');
}

function hasMedia(post) {
  return isVideoPost(post) || !!getPostImage(post);
}

function postMedia(post) {
  return mediaHtml({
    videoSrc: isVideoPost(post) ? getVideoUrl(post) : null,
    image: getPostImage(post),
    alt: normalizeTitle(post),
    href: articleUrl(post),
  }, esc);
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

function renderHeroStory(post) {
  const title = normalizeTitle(post);
  const date = formatDate(getPostDate(post));
  const smart = getSmartLabel(post);
  const excerpt = cleanExcerpt(post);
  const short = excerpt.length > 150 ? excerpt.slice(0, 147) + '…' : excerpt;
  const showExcerpt = shouldShowExcerpt(title, short);

  return `
    ${postMedia(post)}
    <a class="hero-story-link" href="${esc(articleUrl(post))}" aria-label="${esc(title)}">
      <div class="hero-story-body">
        <div class="hero-story-top">
          <span class="badge ${smart ? smart.cls : 'badge-accent'}">${esc(smart ? smart.label : 'Latest')}</span>
          ${date ? `<span class="hero-story-time">${esc(date)}</span>` : ''}
        </div>
        <h2 class="hero-story-title">${esc(title)}</h2>
        ${showExcerpt ? `<p class="hero-story-summary">${esc(short)}</p>` : ''}
        <span class="hero-story-cta">Read the story
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </span>
      </div>
    </a>`;
}

function renderHeroFallback() {
  return `
    <div class="hero-story-body" role="status" style="padding-top:1.2rem">
      <div class="hero-story-top">
        <span class="badge badge-accent">Standby</span>
      </div>
      <h2 class="hero-story-title">Live feed reconnecting</h2>
      <p class="hero-story-summary">The latest stories are temporarily unavailable. Coverage continues in the archive.</p>
      <a class="hero-story-cta" href="/archive.html">Browse the archive
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      </a>
    </div>`;
}

function stripCardThumb(post) {
  const image = getPostImage(post);
  if (!image) return '';
  const graphic = isGraphicMapImage(image, post);
  return `
    <div class="dev-card-thumb${graphic ? ' dev-card-thumb--map' : ''}" aria-hidden="true">
      <img src="${esc(image)}" alt="" loading="lazy" decoding="async">
    </div>`;
}

function renderStripCard(post, i) {
  const title = normalizeTitle(post);
  const time = shortTime(getPostDate(post));
  const smart = getSmartLabel(post);
  const source = post.source || '';
  const magnitude = post.magnitude ?? post.mag ?? post.assets?.magnitude;
  const location = post.location || post.location_display || '';
  // Skip location when the headline already carries it.
  const locBit = location && !title.toLowerCase().includes(location.toLowerCase()) ? location : '';
  const foot = [magnitude ? `M${magnitude}` : '', locBit, source]
    .filter(Boolean).join(' · ');
  const thumb = stripCardThumb(post);
  const hasMedia = !!thumb;

  return `
    <a class="dev-card${hasMedia ? ' dev-card--has-media' : ''}" style="--i:${i}" href="${esc(articleUrl(post))}" aria-label="${esc(title)}">
      ${thumb}
      <div class="dev-card-body">
        <div class="dev-card-top">
          ${smart ? `<span class="badge ${smart.cls}">${esc(smart.label)}</span>` : '<span class="badge badge-accent">Update</span>'}
          ${time ? `<span class="dev-card-time">${esc(time)} ago</span>` : ''}
        </div>
        <h3 class="dev-card-title">${esc(title)}</h3>
        ${foot ? `<span class="dev-card-foot">${esc(foot)}</span>` : ''}
      </div>
    </a>`;
}

function renderLead(post) {
  const title = normalizeTitle(post);
  const smart = getSmartLabel(post);
  const excerpt = cleanExcerpt(post);
  const short = excerpt.length > 190 ? excerpt.slice(0, 187) + '…' : excerpt;
  const showExcerpt = shouldShowExcerpt(title, short);

  return `
    <article class="lead-card feed-in">
      ${postMedia(post)}
      <a class="lead-link" href="${esc(articleUrl(post))}" aria-label="${esc(title)}">
        <div class="lead-body">
          <div class="lead-top">
            ${smart ? `<span class="badge ${smart.cls}">${esc(smart.label)}</span>` : ''}
          </div>
          <h3 class="lead-title">${esc(title)}</h3>
          ${showExcerpt ? `<p class="lead-excerpt">${esc(short)}</p>` : ''}
          ${metaHtml(post)}
        </div>
      </a>
    </article>`;
}

function renderCell(post, i) {
  const title = normalizeTitle(post);
  const smart = getSmartLabel(post);

  return `
    <article class="story-cell feed-in" style="--i:${i}">
      ${postMedia(post)}
      <a class="story-cell-link" href="${esc(articleUrl(post))}" aria-label="${esc(title)}">
        <div class="story-cell-top">
          ${smart ? `<span class="badge ${smart.cls}">${esc(smart.label)}</span>` : ''}
        </div>
        <h3 class="story-cell-title">${esc(title)}</h3>
        ${metaHtml(post, { withSource: false })}
      </a>
    </article>`;
}

function renderWireItem(post, i) {
  const title = normalizeTitle(post);
  const time = shortTime(getPostDate(post));
  const smart = getSmartLabel(post);
  let catCls = 'wire-cat';
  if (smart && smart.cls === 'badge-live') catCls += ' wire-cat--live';
  if (smart && smart.cls === 'badge-warning') catCls += ' wire-cat--warning';

  return `
    <a href="${esc(articleUrl(post))}" class="wire-item feed-in" style="--i:${Math.min(i, 10)}" aria-label="${esc(title)}">
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

/** Hero wire ticker: latest headlines looping across the hero floor. */
function renderHeroWire(posts) {
  const wire = document.getElementById('hero-wire');
  const track = document.getElementById('hero-wire-track');
  if (!wire || !track) return;

  const items = posts.slice(0, 10).map((p) => {
    const t = shortTime(getPostDate(p));
    return (
      `<span class="hero-wire-item">` +
        (t ? `<span class="hw-time">${esc(t)}</span>` : '') +
        esc(normalizeTitle(p)) +
      `</span><span class="hw-sep"></span>`
    );
  }).join('');
  if (!items) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Content is doubled so translateX(-50%) loops seamlessly.
  track.innerHTML = reduced ? items : items + items;
  track.style.setProperty('--wire-dur', `${Math.max(36, Math.min(posts.length, 10) * 7)}s`);
  wire.hidden = false;
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

/** Write the flagship post into the hero slot unless a live story owns it. */
function fillHeroCard(html, status) {
  const slot = heroSlot();
  if (!slot || slot.dataset.heroSource === 'live') return;
  slot.innerHTML = html;
  slot.dataset.heroSource = 'post';
  slot.classList.remove('hero-story-live');
  if (status) slot.dataset.status = status;
  initPostMedia(slot);
}

function stripUpdated() {
  document.dispatchEvent(new CustomEvent('nn:strip-updated'));
}

export async function initFeed() {
  const leadEl = document.getElementById('lead-story');
  const secondaryEl = document.getElementById('secondary-stories');
  const moreEl = document.getElementById('stories-more');
  const wireEl = document.getElementById('wire-list');
  const stripPostsEl = document.getElementById('strip-posts');

  try {
    const posts = await fetchPosts();
    const visible = posts.filter(p => !isLowMagEarthquake(p) && !isNonWeatherNWSAlert(p) && !isVolcanoEnginePost(p));
    const breaking = visible.filter(p => !isAlertPost(p));
    const alerts = visible.filter(p => isAlertPost(p));

    // Hero flagship: latest breaking story that carries real media.
    const heroPost = breaking.find(hasMedia) || breaking[0] || alerts[0] || null;
    if (heroPost) {
      fillHeroCard(renderHeroStory(heroPost), isBreakingText(heroPost) ? 'breaking' : '');
    } else {
      fillHeroCard(renderHeroFallback());
    }

    // Developing Now strip: engine alert updates (skip one used as hero).
    const alertsDeduped = dedupeByTitle(alerts);
    if (stripPostsEl) {
      const stripSource = alertsDeduped.filter(p => p !== heroPost);
      const stripItems = stripSource.slice(0, STRIP_DISPLAY);
      stripPostsEl.innerHTML = stripItems.map((p, i) => renderStripCard(p, i)).join('');
      stripPostsEl.querySelectorAll('.dev-card-thumb img').forEach((img) => {
        img.addEventListener('error', () => {
          const card = img.closest('.dev-card');
          img.closest('.dev-card-thumb')?.remove();
          card?.classList.remove('dev-card--has-media');
        }, { once: true });
      });
      stripUpdated();
    }

    // Top Stories: pool excludes the hero post.
    _storyPool = breaking.filter(p => p !== heroPost);
    renderStoriesGrid();
    initFilters(_storyPool);
    initLoadMore();

    // Hero ticker: everything visible, by recency.
    renderHeroWire(
      dedupeByTitle(visible)
        .map(p => ({ p, t: new Date(getPostDate(p) || 0).getTime() }))
        .sort((a, b) => b.t - a.t)
        .map(x => x.p)
    );

    // The Wire: story depth plus alert depth, by recency.
    if (wireEl) {
      const wireBreaking = _storyPool.slice(1 + SECONDARY_DISPLAY);
      const wireAlerts = alertsDeduped.slice(STRIP_DISPLAY);
      const wirePool = dedupeByTitle([...wireBreaking, ...wireAlerts])
        .map(p => ({ p, t: new Date(getPostDate(p) || 0).getTime() }))
        .sort((a, b) => b.t - a.t)
        .map(x => x.p)
        .slice(0, WIRE_DISPLAY);
      if (wirePool.length > 0) {
        wireEl.innerHTML = wirePool.map((p, i) => renderWireItem(p, i)).join('');
        initPostMedia(wireEl);
      } else {
        wireEl.innerHTML = renderEmpty('No additional updates');
      }
    }

    UISounds.success();
  } catch (err) {
    console.error('[Feed] Failed to load:', err);
    UISounds.error();

    if (leadEl) leadEl.innerHTML = renderError();
    if (secondaryEl) secondaryEl.innerHTML = '';
    if (moreEl) moreEl.innerHTML = '';
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

// ── Top Stories grid (lead + cells + load more) ──

let _storyPool = [];
let _activeFilter = 'All';
let _moreCount = 0;

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
  const moreEl = document.getElementById('stories-more');
  if (!leadEl || !secondaryEl) return;

  const filtered = _activeFilter === 'All'
    ? _storyPool
    : _storyPool.filter(p => {
        const cat = getCategory(p) || (isBreakingText(p) ? 'Breaking' : 'News');
        return cat === _activeFilter;
      });

  const lead = filtered[0];
  const cells = filtered.slice(1, 1 + SECONDARY_DISPLAY);
  const more = filtered.slice(1 + SECONDARY_DISPLAY, 1 + SECONDARY_DISPLAY + _moreCount);

  if (lead) {
    leadEl.innerHTML = renderLead(lead);
  } else {
    leadEl.innerHTML = renderEmpty('No stories in this category');
  }

  secondaryEl.innerHTML = cells.map((p, i) => renderCell(p, i)).join('');
  if (moreEl) moreEl.innerHTML = more.map((p, i) => renderCell(p, i % MORE_LOAD_STEP)).join('');

  const loadMoreBtn = document.getElementById('load-more-btn');
  if (loadMoreBtn) {
    const remaining = filtered.length - 1 - SECONDARY_DISPLAY - _moreCount;
    loadMoreBtn.hidden = remaining <= 0;
    if (remaining > 0) loadMoreBtn.textContent = `Load more (${remaining})`;
  }

  initPostMedia(leadEl);
  initPostMedia(secondaryEl);
  if (moreEl) initPostMedia(moreEl);
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
    _moreCount = 0;
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
    _moreCount += MORE_LOAD_STEP;
    renderStoriesGrid();
  });
}
