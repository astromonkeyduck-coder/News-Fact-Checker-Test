/**
 * Noteworthy News V4 - Post media
 *
 * One media component per post, card, gallery slide, or timeline item.
 * Every element gets its own state: no shared player, no duplicate IDs.
 *
 * Videos: native controls, playsinline, preload="metadata", poster when
 * available. Muted inline preview starts only while the video is in the
 * viewport and pauses as soon as it leaves. Nothing ever autoplays with
 * sound; unmuting is a user action through the native controls. Videos are
 * rendered outside anchor tags so the controls never fight link navigation.
 *
 * Galleries: scroll-snap tracks with per-instance controls, dots, a position
 * counter, and arrow-key support. State lives on the element, never in a
 * module-level variable, so any number of galleries coexist on one page.
 *
 * Call initPostMedia(root) after every render that can add media:
 * initial feed, article render, live story render, timeline updates,
 * archive render, load more, related stories, client-side refresh.
 *
 * Loaded as an ES module. Classic scripts (article loader, live story)
 * consume it through the window.PostMedia bridge set at the bottom.
 */

const VISIBLE_RATIO = 0.4;

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let _observer = null;

function markBroken(el) {
  const wrap = el.closest('.pm-media');
  if (wrap) wrap.classList.add('pm-broken');
}

function getObserver() {
  if (_observer) return _observer;
  _observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const video = entry.target;
      if (entry.isIntersecting && entry.intersectionRatio >= VISIBLE_RATIO) {
        if (video.dataset.src && !video.getAttribute('src')) {
          video.src = video.dataset.src;
        }
        // Quiet inline preview. Respect an explicit user pause and never
        // start playback for users who prefer reduced motion.
        if (!prefersReducedMotion && video.dataset.userPaused !== 'true' && video.paused) {
          const attempt = video.play();
          if (attempt) attempt.catch(() => {});
        }
      } else if (!entry.isIntersecting && !video.paused) {
        video.dataset.autoPause = 'true';
        video.pause();
      }
    });
  }, { threshold: [0, VISIBLE_RATIO] });
  return _observer;
}

function bindVideo(video) {
  if (video.dataset.pmBound === 'true') return;
  video.dataset.pmBound = 'true';

  // Preview defaults; unmuting stays a user decision via native controls.
  video.muted = true;
  video.playsInline = true;

  video.addEventListener('pause', () => {
    if (video.dataset.autoPause === 'true') {
      delete video.dataset.autoPause;
      return;
    }
    if (!video.ended) video.dataset.userPaused = 'true';
  });

  video.addEventListener('play', () => {
    delete video.dataset.userPaused;
  });

  video.addEventListener('error', () => markBroken(video), { once: true });

  getObserver().observe(video);
}

function bindImage(img) {
  if (img.dataset.pmBound === 'true') return;
  img.dataset.pmBound = 'true';
  if (img.complete && img.naturalWidth === 0) {
    markBroken(img);
    return;
  }
  img.addEventListener('error', () => markBroken(img), { once: true });
}

/* ── Gallery ─────────────────────────────────────── */

function galleryIndex(track) {
  const w = track.clientWidth;
  if (!w) return 0;
  return Math.round(track.scrollLeft / w);
}

function gallerySync(gallery) {
  const track = gallery.querySelector('.pm-gallery-track');
  if (!track) return;
  const items = track.children.length;
  const idx = Math.max(0, Math.min(items - 1, galleryIndex(track)));

  const pos = gallery.querySelector('.pm-gallery-pos');
  if (pos) pos.textContent = String(idx + 1);

  gallery.querySelectorAll('.pm-gallery-dot').forEach((dot, i) => {
    dot.classList.toggle('is-active', i === idx);
    dot.setAttribute('aria-current', i === idx ? 'true' : 'false');
  });

  const prev = gallery.querySelector('.pm-gallery-prev');
  const next = gallery.querySelector('.pm-gallery-next');
  if (prev) prev.disabled = idx <= 0;
  if (next) next.disabled = idx >= items - 1;

  // Pause any playing video on slides that scrolled out of the frame.
  track.querySelectorAll('video').forEach((video) => {
    const slide = video.closest('.pm-gallery-item');
    if (!slide) return;
    const slideIdx = Array.prototype.indexOf.call(track.children, slide);
    if (slideIdx !== idx && !video.paused) {
      video.dataset.autoPause = 'true';
      video.pause();
    }
  });
}

function galleryGo(gallery, delta, absolute) {
  const track = gallery.querySelector('.pm-gallery-track');
  if (!track) return;
  const items = track.children.length;
  const current = galleryIndex(track);
  const target = Math.max(0, Math.min(items - 1,
    typeof absolute === 'number' ? absolute : current + delta));
  track.scrollTo({
    left: target * track.clientWidth,
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
  });
}

function bindGallery(gallery) {
  if (gallery.dataset.pmBound === 'true') return;
  gallery.dataset.pmBound = 'true';

  const track = gallery.querySelector('.pm-gallery-track');
  if (!track) return;

  gallery.querySelector('.pm-gallery-prev')?.addEventListener('click', () => galleryGo(gallery, -1));
  gallery.querySelector('.pm-gallery-next')?.addEventListener('click', () => galleryGo(gallery, 1));

  gallery.querySelectorAll('.pm-gallery-dot').forEach((dot, i) => {
    dot.addEventListener('click', () => galleryGo(gallery, 0, i));
  });

  gallery.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); galleryGo(gallery, -1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); galleryGo(gallery, 1); }
  });

  let raf = 0;
  track.addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      gallerySync(gallery);
    });
  }, { passive: true });

  gallerySync(gallery);
}

export function initPostMedia(root = document) {
  if (!root) return;
  root.querySelectorAll('.pm-media video').forEach(bindVideo);
  root.querySelectorAll('.pm-media img').forEach(bindImage);
  root.querySelectorAll('.pm-gallery').forEach(bindGallery);
}

/**
 * Markup helper shared by every card renderer.
 * Image media links to the story; video media stays link-free so the
 * native controls own every click.
 */
export function mediaHtml({ videoSrc, image, alt = '', href = '' }, esc) {
  if (videoSrc) {
    return `
      <div class="pm-media">
        <video data-src="${esc(videoSrc)}" controls muted playsinline disablepictureinpicture
          controlslist="nodownload noremoteplayback" preload="metadata"
          ${image ? `poster="${esc(image)}"` : ''} aria-label="${esc(alt || 'Story video')}"></video>
      </div>`;
  }
  if (image) {
    const img = `<img src="${esc(image)}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
    return href
      ? `<a class="pm-media" href="${esc(href)}" tabindex="-1" aria-hidden="true">${img}</a>`
      : `<div class="pm-media">${img}</div>`;
  }
  return '';
}

/**
 * One media item as inner .pm-media markup (no wrapping figure).
 * item: { type: 'image'|'video', url, poster, alt }
 */
function mediaItemHtml(item, esc, { eager = false } = {}) {
  if (!item || !item.url) return '';
  if (item.type === 'video') {
    return `
      <div class="pm-media pm-media--video">
        <video data-src="${esc(item.url)}" controls muted playsinline disablepictureinpicture
          controlslist="nodownload noremoteplayback" preload="metadata"
          ${item.poster ? `poster="${esc(item.poster)}"` : ''}
          aria-label="${esc(item.alt || 'Story video')}"></video>
      </div>`;
  }
  return `
    <div class="pm-media">
      <img src="${esc(item.url)}" alt="${esc(item.alt || '')}"
        loading="${eager ? 'eager' : 'lazy'}" decoding="async">
    </div>`;
}

/**
 * A single editorial figure: media plus optional caption.
 * item: { type, url, poster, alt, caption }
 */
export function figureHtml(item, esc, opts = {}) {
  if (!item || !item.url) return '';
  const media = mediaItemHtml(item, esc, opts);
  if (!media) return '';
  const caption = item.caption
    ? `<figcaption class="pm-caption">${esc(item.caption)}</figcaption>`
    : '';
  return `<figure class="pm-figure${opts.className ? ' ' + esc(opts.className) : ''}">${media}${caption}</figure>`;
}

/**
 * Swipeable gallery for two or more media items.
 * items: [{ type, url, poster, alt, caption }]
 * Scroll-snap based: native touch swiping, buttons, dots, arrow keys.
 */
export function galleryHtml(items, esc, opts = {}) {
  const list = (items || []).filter((it) => it && it.url);
  if (list.length === 0) return '';
  if (list.length === 1) return figureHtml(list[0], esc, opts);

  const slides = list.map((item, i) => {
    const caption = item.caption
      ? `<figcaption class="pm-caption">${esc(item.caption)}</figcaption>`
      : '';
    return `<figure class="pm-gallery-item" data-idx="${i}">
      ${mediaItemHtml(item, esc, { eager: i === 0 && opts.eager })}
      ${caption}
    </figure>`;
  }).join('');

  const dots = list.map((_, i) =>
    `<button type="button" class="pm-gallery-dot${i === 0 ? ' is-active' : ''}" aria-label="Go to item ${i + 1} of ${list.length}"></button>`
  ).join('');

  const arrow = (dir) => dir === 'prev'
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>';

  return `
    <div class="pm-gallery${opts.className ? ' ' + esc(opts.className) : ''}" role="group"
      aria-roledescription="carousel" aria-label="${esc(opts.label || `Story media, ${list.length} items`)}" tabindex="0">
      <div class="pm-gallery-track">${slides}</div>
      <button type="button" class="pm-gallery-btn pm-gallery-prev" aria-label="Previous item" disabled>${arrow('prev')}</button>
      <button type="button" class="pm-gallery-btn pm-gallery-next" aria-label="Next item">${arrow('next')}</button>
      <span class="pm-gallery-count" aria-hidden="true"><span class="pm-gallery-pos">1</span>&thinsp;/&thinsp;${list.length}</span>
      <div class="pm-gallery-dots" aria-hidden="true">${dots}</div>
    </div>`;
}

/**
 * Render a media set (from ContentNormalize-style data) as either a single
 * figure or a gallery. Convenience for article, live story, and archive.
 * set: { items: [{type,url,poster,alt,caption}] }
 */
export function mediaSetHtml(items, esc, opts = {}) {
  const list = (items || []).filter((it) => it && it.url);
  if (list.length === 0) return '';
  if (list.length === 1) return figureHtml(list[0], esc, { ...opts, eager: true });
  return galleryHtml(list, esc, { ...opts, eager: true });
}

/* Bridge for classic (non-module) scripts: article loader, live story. */
if (typeof window !== 'undefined') {
  window.PostMedia = { initPostMedia, mediaHtml, figureHtml, galleryHtml, mediaSetHtml };
}
