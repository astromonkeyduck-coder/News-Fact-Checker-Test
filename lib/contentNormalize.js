/**
 * Content normalization — single source of truth for turning loosely-typed
 * post blobs into clean, publishable headlines, body text, and media.
 *
 * UMD: usable in the browser as `window.ContentNormalize` and in Node via
 * `require('./lib/contentNormalize')`. The web article page, the mobile APIs
 * (via netlify/functions/lib/postNormalize.js), and the crawler OG path
 * (article-preview.js) all delegate here so a story has ONE clean title and
 * ONE primary-media decision everywhere it appears.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = mod;
  }
  if (typeof window !== 'undefined') {
    window.ContentNormalize = mod;
  } else if (typeof globalThis !== 'undefined') {
    globalThis.ContentNormalize = mod;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const URL_PATTERN = /https?:\/\/[^\s]+/gi;
  const SHORTLINK_PATTERN = /\b(?:pic\.twitter\.com|t\.co)\/[^\s]+/gi;
  const TCO_PATTERN = /https?:\/\/t\.co\/\w+/gi;

  /**
   * Return every URL/shortlink found in the text (deduped, in order).
   * @param {string} text
   * @returns {string[]}
   */
  function extractUrls(text) {
    if (!text) return [];
    const str = String(text);
    const found = [];
    const seen = new Set();
    const push = (m) => {
      const u = m.trim().replace(/[)\].,;:!?]+$/, '');
      if (u && !seen.has(u)) {
        seen.add(u);
        found.push(u);
      }
    };
    (str.match(URL_PATTERN) || []).forEach(push);
    (str.match(SHORTLINK_PATTERN) || []).forEach((m) => {
      const u = m.startsWith('http') ? m : `https://${m}`;
      push(u);
    });
    return found;
  }

  /**
   * Extract only t.co links (legacy helper used by the article body cleaner).
   * @param {string} text
   * @returns {{ cleaned: string, links: string[] }}
   */
  function stripTcoLinks(text) {
    if (!text) return { cleaned: '', links: [] };
    const links = (String(text).match(TCO_PATTERN) || []).slice();
    const cleaned = String(text)
      .replace(TCO_PATTERN, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\s+([.,!?;:])/g, '$1')
      .trim();
    return { cleaned, links };
  }

  /**
   * Remove URLs/shortlinks from a string and tidy whitespace + punctuation.
   * Preserves legitimate punctuation and editorial prefixes (BREAKING:, WATCH:).
   * @param {string} text
   * @returns {string}
   */
  function stripUrls(text) {
    if (!text) return '';
    return String(text)
      .replace(URL_PATTERN, '')
      .replace(SHORTLINK_PATTERN, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\s+([.,!?;:])/g, '$1')
      .replace(/[\s\u2013\u2014\-|·:]+$/g, '')
      .replace(/^[\s\u2013\u2014\-|·]+/g, '')
      .trim();
  }

  /**
   * Collapse a social post body into clean, readable text:
   * strips URLs, removes trailing hashtag clutter lines, normalizes whitespace.
   * @param {string} text
   * @returns {string}
   */
  function normalizeSocialPostText(text) {
    if (!text) return '';
    let cleaned = stripUrls(text);
    // Normalize windows/odd newlines, collapse 3+ blank lines to a paragraph break.
    cleaned = cleaned
      .replace(/\r\n?/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+\n/g, '\n')
      .trim();
    return cleaned;
  }

  /**
   * Remove a duplicated leading source label like "Noteworthy News: ..." or
   * "BBC News - ..." that some social mirrors prepend, without nuking
   * editorial prefixes (BREAKING:, WATCH:, LIVE:, UPDATE:, DEVELOPING:).
   * @param {string} title
   * @returns {string}
   */
  function stripDuplicateSourceLabel(title) {
    if (!title) return '';
    const KEEP = /^(BREAKING|WATCH|LIVE|UPDATE|DEVELOPING|EXCLUSIVE|ALERT|JUST IN|CONFIRMED)\b/i;
    let t = String(title).trim();
    if (KEEP.test(t)) return t;
    // "Source Name: rest" or "Source Name - rest" where the label is short.
    const m = t.match(/^([^:|\-\u2013\u2014]{2,40})\s*[:|\u2013\u2014-]\s+(.{12,})$/);
    if (m) {
      const label = m[1].trim();
      const rest = m[2].trim();
      const labelWords = label.split(/\s+/).length;
      // Only treat as a source label if it's a short proper-noun-ish prefix.
      if (labelWords <= 4 && /[A-Za-z]/.test(label) && !/[.!?]$/.test(label)) {
        return rest;
      }
    }
    return t;
  }

  function firstNonEmpty() {
    for (let i = 0; i < arguments.length; i++) {
      const v = arguments[i];
      if (v != null && String(v).trim()) return String(v);
    }
    return '';
  }

  /**
   * Truncate on a word boundary with an ellipsis.
   * @param {string} str
   * @param {number} max
   * @returns {string}
   */
  function truncate(str, max) {
    if (!str) return '';
    const s = String(str).trim();
    if (s.length <= max) return s;
    const slice = s.slice(0, max - 1);
    const lastSpace = slice.lastIndexOf(' ');
    const base = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
    return base.replace(/[\s.,;:!?\u2013\u2014-]+$/, '') + '\u2026';
  }

  /**
   * Produce a real headline from a post: never a raw URL, never empty.
   * @param {Object} post
   * @param {Object} [opts]
   * @param {number} [opts.maxLength=140]
   * @returns {string}
   */
  function cleanHeadline(post, opts) {
    if (!post || typeof post !== 'object') return 'Untitled';
    const maxLength = (opts && opts.maxLength) || 140;

    const rawTitle = firstNonEmpty(post.title, post.headline);
    let candidate = stripUrls(rawTitle);
    candidate = stripDuplicateSourceLabel(candidate);

    if (!candidate) {
      const body = normalizeSocialPostText(
        firstNonEmpty(post.story, post.text, post.content, post.Content)
      );
      if (body) {
        const firstLine = body.split('\n').map((l) => l.trim()).find(Boolean) || '';
        candidate = stripDuplicateSourceLabel(stripUrls(firstLine));
      }
    }

    candidate = candidate.replace(/\s{2,}/g, ' ').trim();
    if (!candidate) return 'Untitled';
    return truncate(candidate, maxLength);
  }

  // ── Media ───────────────────────────────────────────────────────────────

  const VIDEO_EXT = /\.(mp4|webm|mov|m4v|m3u8)(\?|#|$)/i;

  function isVideoUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return (
      VIDEO_EXT.test(url) ||
      url.includes('video.twimg.com') ||
      url.includes('/media/video/') ||
      (url.includes('get-uploaded-image') && /format=(gif|mp4)/i.test(url))
    );
  }

  /**
   * Heuristic: does this image look like an avatar / brand logo / icon rather
   * than editorial media? Such images must never become the article hero.
   * @param {string} url
   * @returns {boolean}
   */
  function isLikelyLogo(url) {
    if (!url || typeof url !== 'string') return false;
    const u = url.toLowerCase();
    return (
      u.includes('profile_images') || // X/Twitter avatars
      u.includes('/profile_banners/') ||
      /\b(logo|avatar|favicon|icon|profile|pfp|default_profile)\b/.test(u) ||
      u.includes('abs.twimg.com') || // X UI/sprite assets
      u.endsWith('.svg')
    );
  }

  function ensureArray(v) {
    if (!v) return [];
    return Array.isArray(v) ? v : [v];
  }

  function dedupe(list) {
    const seen = new Set();
    const out = [];
    list.forEach((u) => {
      if (u && typeof u === 'string' && !seen.has(u)) {
        seen.add(u);
        out.push(u);
      }
    });
    return out;
  }

  /**
   * Resolve all media for a post into a normalized shape.
   * @param {Object} post
   * @returns {{ primary: (string|null), secondary: string[], videos: string[],
   *            hasVideo: boolean, isLikelyLogo: boolean, caption: (string|null) }}
   */
  function normalizeMedia(post) {
    const empty = {
      primary: null, secondary: [], videos: [],
      hasVideo: false, isLikelyLogo: false, caption: null,
    };
    if (!post || typeof post !== 'object') return empty;

    // Video candidates.
    const videoRaw = dedupe([
      post.video_url, post.video,
      post.assets && post.assets.video_url,
      ...ensureArray(post.videos),
    ]).filter((u) => u && (isVideoUrl(u) || Array.isArray(post.videos)));
    const videos = dedupe(
      videoRaw.map((u) => String(u).replace('https://video.twimg.com/', '/media/video/'))
    );

    // Primary image candidates (excluding videos + logos).
    let primaryCandidates = [
      post.primary_image_url, post.image_url, post.image,
      post.assets && post.assets.standard_image,
      post.assets && post.assets.image_url,
      post.assets && post.assets.generated_image,
      post.mediaUrl, post.media_url,
    ];
    if (post.category === 'Earthquake' || post.source === 'USGS') {
      const usgs = ensureArray(post.assets && post.assets.usgs_images)
        .concat(ensureArray(post.usgs_images));
      primaryCandidates = primaryCandidates.concat(
        usgs.map((x) => (typeof x === 'string' ? x : x && x.url))
      );
    }

    let primary = null;
    let logoFlagged = false;
    for (const c of primaryCandidates) {
      if (!c || typeof c !== 'string') continue;
      if (isVideoUrl(c)) continue;
      if (isLikelyLogo(c)) { logoFlagged = true; continue; }
      primary = c;
      break;
    }

    // Secondary images.
    const secondaryRaw = []
      .concat(ensureArray(post.secondary_images))
      .concat(ensureArray(post.images))
      .concat(ensureArray(post.assets && post.assets.images))
      .map((x) => (typeof x === 'string' ? x : x && x.url))
      .filter((u) => u && !isVideoUrl(u) && !isLikelyLogo(u) && u !== primary);

    return {
      primary,
      secondary: dedupe(secondaryRaw),
      videos,
      hasVideo: videos.length > 0,
      isLikelyLogo: logoFlagged && !primary,
      caption: firstNonEmpty(post.image_caption, post.image_credit) || null,
    };
  }

  /**
   * Just the primary media decision for OG/share/thumbnail use.
   * @param {Object} post
   * @returns {{ type: ('video'|'image'|null), url: (string|null), poster: (string|null) }}
   */
  function getPrimaryMedia(post) {
    const m = normalizeMedia(post);
    if (m.hasVideo) {
      return { type: 'video', url: m.videos[0], poster: m.primary || null };
    }
    if (m.primary) {
      return { type: 'image', url: m.primary, poster: null };
    }
    return { type: null, url: null, poster: null };
  }

  return {
    extractUrls,
    stripUrls,
    stripTcoLinks,
    normalizeSocialPostText,
    stripDuplicateSourceLabel,
    cleanHeadline,
    truncate,
    isVideoUrl,
    isLikelyLogo,
    normalizeMedia,
    getPrimaryMedia,
  };
});
