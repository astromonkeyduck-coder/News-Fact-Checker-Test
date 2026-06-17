/**
 * Article Page V3 — Breaking Brief & Longform templates
 * Used by article-loader.js (attach helpers to window.ArticlePageV3)
 */
(function (global) {
  'use strict';

  const X_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
  const ICON_LINK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
  const ICON_SHARE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>';
  const ICON_FLAG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>';

  function classify(post) {
    const isEarthquake =
      post.category === 'Earthquake' ||
      post.event_type === 'earthquake' ||
      post.source === 'USGS';
    const verifiedSources = ['USGS', 'NWS', 'FAA'];
    const isVerifiedEvent =
      isEarthquake ||
      !!post.event_type ||
      (post.source && verifiedSources.includes(post.source)) ||
      ['Earthquake', 'Weather', 'Airspace', 'Volcano'].includes(post.category);
    const postXUrl = post.x_url || post.link || '';
    const isXPost =
      !isVerifiedEvent &&
      (postXUrl.includes('x.com') || postXUrl.includes('twitter.com'));
    const template = isXPost ? 'breaking-brief' : 'longform';
    return { template, isXPost, isEarthquake, isVerifiedEvent };
  }

  const BREAKING_PILL = { label: 'Breaking', cls: 'nn-pill--breaking' };

  function titleHasBreakingPrefix(title) {
    return /^BREAKING\s*(?:NEWS)?\s*:?\s*/i.test(String(title || '').trim());
  }

  function stripBreakingPrefix(title) {
    return String(title || '')
      .replace(/^BREAKING\s*(?:NEWS)?\s*:?\s*/i, '')
      .trim();
  }

  function categoryImpliesBreaking(post) {
    const cat = (post.category || post.urgency || '').toUpperCase();
    return cat.includes('BREAKING') || post.breaking === true;
  }

  function getUrgencyPill(post) {
    const cat = (post.category || post.urgency || '').toUpperCase();
    const map = [
      { keys: ['BREAKING'], label: 'Breaking', cls: 'nn-pill--breaking' },
      { keys: ['WATCH', 'MONITOR'], label: 'Watch', cls: 'nn-pill--watch' },
      { keys: ['DEVELOPING'], label: 'Developing', cls: 'nn-pill--developing' },
      { keys: ['UPDATE'], label: 'Update', cls: 'nn-pill--update' },
    ];
    for (const m of map) {
      if (m.keys.some((k) => cat.includes(k))) {
        return { label: m.label, cls: m.cls };
      }
    }
    return null;
  }

  /** One visible breaking indicator: badge OR title prefix, never both. */
  function resolveArticlePresentation(post, rawTitle) {
    // Always run through the shared headline cleaner so a raw t.co URL or
    // duplicated source label never reaches the <h1>.
    const cn = (typeof window !== 'undefined' && window.ContentNormalize) ||
      (typeof global !== 'undefined' && global.ContentNormalize) || null;
    let title = String(rawTitle || '').trim();
    if (cn && cn.cleanHeadline) {
      title = cn.cleanHeadline({ ...post, title: title || post.title }) || title;
    }
    const pillFromCategory = getUrgencyPill(post);
    const isBreaking =
      categoryImpliesBreaking(post) ||
      titleHasBreakingPrefix(title) ||
      pillFromCategory?.cls === 'nn-pill--breaking';

    let urgencyPill = pillFromCategory;
    if (isBreaking) {
      urgencyPill = BREAKING_PILL;
    }

    const displayTitle = isBreaking ? stripBreakingPrefix(title) || title : title;

    return { displayTitle, urgencyPill, isBreaking };
  }

  function getToolbarLabel(post, classification, presentation) {
    if (classification.isXPost) return 'News update';
    if (classification.isEarthquake) return 'Earthquake';
    if (presentation.isBreaking) return 'News';
    const cat = (post.category || 'News').trim();
    if (/breaking/i.test(cat)) return 'News';
    return cat;
  }

  function formatPublishedFull(dateString, formatDate) {
    if (!dateString) return 'Recently';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return 'Recently';
      const datePart = d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const timePart = d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      return `Published ${datePart} · ${timePart}`;
    } catch {
      return formatDate ? formatDate(dateString) : 'Recently';
    }
  }

  function sourceLabel(s, index) {
    if (typeof s === 'string') {
      try {
        const host = new URL(s).hostname.replace(/^www\./, '');
        return host || `Source ${index + 1}`;
      } catch {
        return `Source ${index + 1}`;
      }
    }
    return s.display || s.title || (s.url ? sourceLabel(s.url, index) : `Source ${index + 1}`);
  }

  function buildSourceChipsHTML(sourceUrls, opts, escapeHtml) {
    const { xUrl, includeX = false } = opts || {};
    const urls = Array.isArray(sourceUrls) ? sourceUrls : [];
    if (urls.length === 0 && !includeX) return '';

    const chips = urls.map((s, i) => {
      const href = escapeHtml(typeof s === 'string' ? s : s.url);
      const label = escapeHtml(sourceLabel(s, i));
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="nn-chip nn-chip--source">${label}</a>`;
    });

    if (includeX && xUrl) {
      chips.push(
        `<a href="${escapeHtml(xUrl)}" target="_blank" rel="noopener noreferrer" class="nn-chip nn-chip--x">${X_ICON}<span>View original on X</span></a>`
      );
    }

    return `<div class="nn-chips" role="navigation" aria-label="Sources">${chips.join('')}</div>`;
  }

  function getContentNormalize() {
    return (typeof window !== 'undefined' && window.ContentNormalize) ||
      (typeof global !== 'undefined' && global.ContentNormalize) || null;
  }

  function resolveImages(post, helpers) {
    const { normalizeUrl, ensureAbsoluteImageUrl, isVideoUrl } = helpers;
    const cn = getContentNormalize();
    let primary = post.primary_image_url || post.image_url || post.image || null;
    // Never let an avatar / brand logo (e.g. an X profile image) become the hero.
    if (primary && cn && cn.isLikelyLogo && cn.isLikelyLogo(primary)) primary = null;
    if (post.category === 'Earthquake' || post.source === 'USGS') {
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
        const firstUsgs = usgsImages[0];
        primary = firstUsgs ? (typeof firstUsgs === 'string' ? firstUsgs : firstUsgs?.url) : null;
      }
    }
    if (primary && isVideoUrl(primary)) primary = null;
    if (primary && cn && cn.isLikelyLogo && cn.isLikelyLogo(primary)) primary = null;

    const notLogo = (u) => !(cn && cn.isLikelyLogo && cn.isLikelyLogo(u));
    const secondaryCandidates = [
      ...(post.secondary_images || []),
      ...(post.images || []),
      ...(post.assets?.images || []),
      ...(post.usgs_images || []),
      ...(post.assets?.usgs_images || []),
    ]
      .filter(Boolean)
      .filter((u) => !isVideoUrl(u))
      .filter(notLogo);

    const primaryNorm = primary ? normalizeUrl(ensureAbsoluteImageUrl(primary)) : null;
    const secondary = secondaryCandidates
      .map((url) => ensureAbsoluteImageUrl(url))
      .filter((url) => normalizeUrl(url) !== primaryNorm)
      .filter((url, i, arr) => arr.findIndex((u) => normalizeUrl(u) === normalizeUrl(url)) === i);

    const videoUrls = [
      ...(post.video_url || post.video || post.assets?.video_url
        ? [post.video_url || post.video || post.assets?.video_url]
        : []),
      ...(post.videos || []),
    ]
      .filter(Boolean)
      .filter(isVideoUrl)
      .map((u) => ensureAbsoluteImageUrl(u))
      .map((u) => u.replace('https://video.twimg.com/', '/media/video/'))
      .filter((url, i, arr) => arr.findIndex((u) => normalizeUrl(u) === normalizeUrl(url)) === i);

    return { primary, secondary, videoUrls, hasVideoHero: videoUrls.length > 0 };
  }

  function buildMediaHTML(post, title, helpers) {
    const { escapeHtml, isVideoUrl } = helpers;
    const { primary, secondary, videoUrls, hasVideoHero } = resolveImages(post, helpers);
    let html = '';

    if (primary && !hasVideoHero) {
      const url = helpers.ensureAbsoluteImageUrl(primary);
      const isUploaded = url.includes('get-uploaded-image');
      const err = isUploaded
        ? `onerror="this.style.display='none';"`
        : `onerror="this.style.display='none';"`;
      html += `<div class="nn-media-block"><div class="nn-media nn-media--hero article-media article-media-hero"><img src="${escapeHtml(url)}" alt="${escapeHtml(title)}" loading="eager" ${err}></div>`;
      if (post.image_caption || post.image_credit) {
        html += `<p class="nn-media__caption">${escapeHtml(post.image_caption || post.image_credit)}</p>`;
      }
      html += '</div>';
    }

    if (secondary.length > 0) {
      const galleryClass =
        secondary.length >= 3 ? 'nn-gallery--3' : secondary.length === 2 ? 'nn-gallery--2' : '';
      html += `<div class="nn-gallery ${galleryClass}">`;
      secondary.forEach((imgUrl, idx) => {
        const url = helpers.ensureAbsoluteImageUrl(imgUrl);
        html += `<div class="nn-media article-media"><img src="${escapeHtml(url)}" alt="${escapeHtml(title)} — image ${idx + 2}" loading="lazy"></div>`;
      });
      html += '</div>';
    }

    const xLink = post.x_url || post.link || '';
    const hasX = xLink.includes('x.com') || xLink.includes('twitter.com');

    videoUrls.forEach((vUrl, idx) => {
      const poster = primary ? ` poster="${escapeHtml(helpers.ensureAbsoluteImageUrl(primary))}"` : '';
      const isHero = idx === 0;
      const cls = isHero ? 'nn-media nn-media--hero article-media article-media-hero' : 'nn-media article-media';
      const fallbackBlock = hasX
        ? `<div class="nn-video-fallback"><a href="${escapeHtml(xLink)}" target="_blank" rel="noopener noreferrer" class="nn-chip nn-chip--x">${X_ICON}<span>Watch on X</span></a></div>`
        : '<div class="nn-video-fallback"><p>Video could not be loaded</p></div>';
      html += `<div class="nn-media-block"><div class="${cls}" data-video-fallback="${escapeHtml(fallbackBlock)}"><video src="${escapeHtml(vUrl)}"${poster} controls playsinline preload="metadata" class="nn-video-el"></video></div></div>`;
    });

    return html;
  }

  function deriveBriefFacts(post) {
    const maxItems = 5;
    const maxLineLen = 120;
    if (post.key_takeaways && Array.isArray(post.key_takeaways) && post.key_takeaways.length > 0) {
      return post.key_takeaways
        .slice(0, maxItems)
        .map((s) => (typeof s === 'string' ? s.trim() : String(s).trim()))
        .filter(Boolean)
        .map((s) => (s.length > maxLineLen ? s.substring(0, maxLineLen).trim() + '…' : s));
    }
    if (post.summary && typeof post.summary === 'string') {
      const trimmed = post.summary.trim();
      if (!trimmed) return [];
      const byNewline = trimmed.split(/\n+/).map((s) => s.trim()).filter(Boolean);
      if (byNewline.length >= 2) {
        return byNewline.slice(0, maxItems);
      }
    }
    return [];
  }

  function buildWhatWeKnowHTML(post, helpers) {
    const { stripTcoLinks, escapeHtml, buildSourceChipsHTML } = helpers;
    const items = deriveBriefFacts(post);
    if (items.length === 0) return '';

    const cleanedItems = [];
    const tcoFallback = [];
    items.forEach((item) => {
      const { cleaned, links } = stripTcoLinks(item);
      if (cleaned) cleanedItems.push(cleaned);
      tcoFallback.push(...links);
    });
    if (cleanedItems.length === 0) return '';

    const list = cleanedItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    const sourceUrls = Array.isArray(post.source_urls) && post.source_urls.length > 0
      ? post.source_urls
      : null;
    const chips = sourceUrls
      ? buildSourceChipsHTML(sourceUrls, {}, escapeHtml)
      : '';

    return `<section class="nn-module nn-what-we-know" role="region" aria-label="What we know">
      <h2 class="nn-module__title">What we know</h2>
      <ul class="nn-module__list">${list}</ul>
      ${chips}
    </section>`;
  }

  function buildKeyPointsHTML(post, helpers) {
    const { escapeHtml } = helpers;
    const items = (post.key_takeaways || [])
      .filter((s) => typeof s === 'string' && s.trim())
      .map((s) => helpers.stripTcoLinks(s.trim()).cleaned)
      .filter(Boolean);
    if (items.length < 3) return '';

    const list = items.slice(0, 5).map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    return `<section class="nn-module nn-key-points" role="region" aria-label="Key points">
      <h2 class="nn-module__title">Key points</h2>
      <ul class="nn-module__list">${list}</ul>
    </section>`;
  }

  function buildActionsHTML(post, articleId, siteUrl, escapeHtml) {
    const xUrl = post.x_url || post.link || '';
    const isX = xUrl.includes('x.com') || xUrl.includes('twitter.com');
    const sourceUrls = Array.isArray(post.source_urls) ? post.source_urls : [];

    let html = '<div class="nn-actions">';
    if (isX) {
      html += `<a href="${escapeHtml(xUrl)}" target="_blank" rel="noopener noreferrer" class="nn-chip nn-chip--x">${X_ICON}<span>View original on X</span></a>`;
    }
    html += `<button type="button" class="utility-btn" id="copy-link-btn" aria-label="Copy article link">${ICON_LINK}<span>Copy link</span></button>`;
    html += `<button type="button" class="utility-btn" id="share-menu-btn" aria-label="Share article" aria-haspopup="true" aria-expanded="false">${ICON_SHARE}<span>Share</span></button>`;
    html += `<div class="share-menu" id="share-menu" role="menu" aria-hidden="true" style="display:none;">
      <a href="#" class="share-option" id="share-twitter" target="_blank" rel="noopener" role="menuitem">${X_ICON}<span>X (Twitter)</span></a>
      <a href="#" class="share-option" id="share-facebook" target="_blank" rel="noopener" role="menuitem"><span>Facebook</span></a>
      <a href="#" class="share-option" id="share-linkedin" target="_blank" rel="noopener" role="menuitem"><span>LinkedIn</span></a>
      <a href="#" class="share-option" id="share-email" role="menuitem"><span>Email</span></a>
      <a href="#" class="share-option" id="share-reddit" target="_blank" rel="noopener" role="menuitem"><span>Reddit</span></a>
    </div>`;
    html += `<a href="mailto:richard@noteworthynews.co?subject=Correction%20Request" class="utility-btn" aria-label="Report correction">${ICON_FLAG}<span>Report correction</span></a>`;
    html += '</div>';

    if (sourceUrls.length > 0) {
      html += buildSourceChipsHTML(sourceUrls, { xUrl: isX ? null : xUrl, includeX: false }, escapeHtml);
    }
    return html;
  }

  function getDek(post) {
    if (post.dek && typeof post.dek === 'string' && post.dek.trim()) {
      const d = post.dek.trim();
      return d.length > 220 ? d.slice(0, 217) + '…' : d;
    }
    if (post.summary && typeof post.summary === 'string') {
      const s = post.summary.trim();
      if (s.length > 40 && s.length <= 280) {
        return s.length > 220 ? s.slice(0, 217) + '…' : s;
      }
    }
    return '';
  }

  /**
   * Refined X/source attribution card. Doubles as the lead visual when a post
   * has no usable media, so a giant X logo never becomes the hero.
   */
  function buildSourceCardHTML(post, helpers, opts) {
    const { escapeHtml, stripTcoLinks } = helpers;
    const xUrl = post.x_url || post.link || '';
    if (!xUrl) return '';
    const showQuote = opts && opts.showQuote;
    const author = post.author || 'Noteworthy News';

    let quote = '';
    if (showQuote) {
      const raw = post.story || post.text || '';
      const { cleaned } = stripTcoLinks(raw);
      const trimmed = (cleaned || '').trim();
      if (trimmed) {
        const snippet = trimmed.length > 200 ? trimmed.slice(0, 199).trim() + '\u2026' : trimmed;
        quote = `<p class="nn-source-card__quote">${escapeHtml(snippet)}</p>`;
      }
    }

    return `<aside class="nn-source-card" aria-label="Original source">
      <div class="nn-source-card__head">
        <span class="nn-source-card__mark">${X_ICON}</span>
        <span class="nn-source-card__by">Originally posted by <strong>${escapeHtml(author)}</strong> on X</span>
      </div>
      ${quote}
      <a href="${escapeHtml(xUrl)}" target="_blank" rel="noopener noreferrer" class="nn-source-card__link">View original on X</a>
    </aside>`;
  }

  function buildBreakingBriefHTML(post, ctx) {
    const { title, story, datePosted, articleId, helpers } = ctx;
    const { escapeHtml, formatPostText, stripTcoLinks, formatPublishedFull, formatDate } = helpers;
    const { displayTitle, urgencyPill } = resolveArticlePresentation(post, title);
    const published = formatPublishedFull(datePosted, formatDate);

    let html = '<header class="nn-header">';
    if (urgencyPill) {
      html += `<span class="nn-pill ${urgencyPill.cls}">${escapeHtml(urgencyPill.label)}</span>`;
    }
    html += `<h1 class="nn-headline" id="article-heading" tabindex="-1">${escapeHtml(displayTitle)}</h1>`;
    html += `<div class="nn-meta nn-meta--brief">`;
    html += `<span>${escapeHtml(published)}</span>`;
    html += '</div>';
    html += '</header>';

    const mediaHTML = buildMediaHTML(post, displayTitle, helpers);
    html += mediaHTML;
    // When there's no real media, the source card carries the lead visual.
    html += buildSourceCardHTML(post, helpers, { showQuote: !mediaHTML });
    html += buildWhatWeKnowHTML(post, helpers);

    const { cleaned } = stripTcoLinks(story);
    html += `<section class="nn-original-update" aria-label="Original update">`;
    html += `<h2 class="nn-original-update__label">Original update</h2>`;
    html += `<div class="nn-body article-body" id="article-body">${formatPostText(cleaned)}</div>`;
    html += '</section>';

    html += buildActionsHTML(post, articleId, ctx.siteUrl, escapeHtml);
    return html;
  }

  function buildLongformHTML(post, ctx) {
    const { title, story, datePosted, articleId, helpers, isEarthquake } = ctx;
    const {
      escapeHtml,
      formatPostText,
      formatPublishedFull,
      formatDate,
      calculateReadTime,
      buildSourceChipsHTML,
    } = helpers;
    const { displayTitle, urgencyPill } = resolveArticlePresentation(post, title);
    const dek = getDek(post);
    const author = post.author || 'Noteworthy News';
    const published = formatPublishedFull(datePosted, formatDate);
    const updatedAt = post.updated_at || post.dateModified;
    const readMin = calculateReadTime(story);

    let html = '<header class="nn-header">';
    if (urgencyPill) {
      html += `<span class="nn-pill ${urgencyPill.cls}">${escapeHtml(urgencyPill.label)}</span>`;
    }
    html += `<h1 class="nn-headline" id="article-heading" tabindex="-1">${escapeHtml(displayTitle)}</h1>`;
    if (dek) {
      html += `<p class="nn-dek">${escapeHtml(dek)}</p>`;
    }
    html += '<div class="nn-meta">';
    html += `<span>By ${escapeHtml(author)}</span>`;
    html += `<span class="nn-meta__sep">·</span>`;
    html += `<span id="article-date">${escapeHtml(published.replace(/^Published /, ''))}</span>`;
    if (updatedAt && updatedAt !== datePosted) {
      try {
        const u = new Date(updatedAt);
        if (!isNaN(u.getTime())) {
          html += `<span class="nn-meta__sep">·</span><span>Updated ${escapeHtml(u.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}</span>`;
        }
      } catch (_) { /* ignore */ }
    }
    html += `<span class="nn-meta__sep">·</span>`;
    html += `<span id="article-read-time">${readMin} min read</span>`;
    html += '</div></header>';

    html += buildMediaHTML(post, displayTitle, helpers);

    const bodyClass = post.lead_paragraph ? 'nn-body article-body lead-cap' : 'nn-body article-body';
    html += `<div class="${bodyClass}" id="article-body">`;
    html += formatPostText(story);
    html += '</div>';

    html += buildKeyPointsHTML(post, helpers);

    const sourceUrls = Array.isArray(post.source_urls) ? post.source_urls : [];
    if (sourceUrls.length > 0) {
      html += buildSourceChipsHTML(sourceUrls, {}, escapeHtml);
    }

    const xUrl = post.x_url || post.link || '';
    if (xUrl && (xUrl.includes('x.com') || xUrl.includes('twitter.com'))) {
      html += `<div class="nn-chips"><a href="${escapeHtml(xUrl)}" target="_blank" rel="noopener noreferrer" class="nn-chip nn-chip--x">${X_ICON}<span>Originally on X</span></a></div>`;
    }

    html += buildActionsHTML(post, articleId, ctx.siteUrl, escapeHtml);
    return html;
  }

  global.ArticlePageV3 = {
    classify,
    getUrgencyPill,
    resolveArticlePresentation,
    getToolbarLabel,
    stripBreakingPrefix,
    titleHasBreakingPrefix,
    formatPublishedFull,
    buildSourceChipsHTML,
    resolveImages,
    buildMediaHTML,
    buildWhatWeKnowHTML,
    buildKeyPointsHTML,
    buildActionsHTML,
    buildSourceCardHTML,
    buildBreakingBriefHTML,
    buildLongformHTML,
    getDek,
  };
})(typeof window !== 'undefined' ? window : global);
