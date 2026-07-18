/**
 * Article Page V4 - "Dispatch Spine" templates
 *
 * Builds the premium dark article layout used by article-loader.js:
 * story header (kicker, headline, dek, meta, actions), spine sections
 * (media, body, panels), source attribution, and the source-trail rail.
 *
 * Exposed on window.ArticlePageV4. Media markup is delegated to
 * window.PostMedia (v2/js/post-media.js) so every image, video, and
 * gallery gets its own working component.
 */
(function (global) {
  'use strict';

  const X_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
  const ICON_LINK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
  const ICON_SHARE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>';
  const ICON_SPARK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/></svg>';
  const ICON_LIST = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>';

  function classify(post) {
    const isEarthquake =
      post.category === 'Earthquake' ||
      post.event_type === 'earthquake' ||
      post.source === 'USGS';
    const isFoodSafety =
      post.category === 'Food Safety' ||
      post.event_type === 'food_recall' ||
      post.event_type === 'food_outbreak';
    const verifiedSources = ['USGS', 'NWS', 'FAA', 'FDA'];
    const isVerifiedEvent =
      isEarthquake ||
      isFoodSafety ||
      !!post.event_type ||
      (post.source && verifiedSources.includes(post.source)) ||
      ['Earthquake', 'Weather', 'Airspace', 'Volcano', 'Food Safety'].includes(post.category);
    const postXUrl = post.x_url || post.link || '';
    const isXPost =
      !isVerifiedEvent &&
      (postXUrl.includes('x.com') || postXUrl.includes('twitter.com'));
    const template = isXPost ? 'breaking-brief' : 'longform';
    return { template, isXPost, isEarthquake, isFoodSafety, isVerifiedEvent };
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
    const cn = getContentNormalize();
    let title = String(rawTitle || '').trim();
    if (cn && cn.cleanHeadline) {
      title = cn.cleanHeadline({ ...post, title: title || post.title }) || title;
    }
    // Volcano engine titles arrive as "WATCH - Great Sitkin"; present them as
    // readable headlines, matching the homepage cards.
    if (String(post.category || '').toLowerCase().includes('volcano')) {
      const m = title.match(/^(WATCH|WARNING|ADVISORY)\s*[-:|]\s*(.+)$/i);
      if (m) title = `Volcano ${m[1].toLowerCase()} in effect for ${m[2].trim()}`;
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

  function getKickerLabel(post, classification, presentation) {
    if (classification.isXPost) return 'News update';
    if (classification.isEarthquake) return 'Earthquake';
    if (classification.isFoodSafety) return 'Food Safety';
    const cat = (post.category || '').trim();
    if (!cat || /breaking/i.test(cat)) return presentation.isBreaking ? '' : 'News';
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
      return `${datePart}, ${timePart}`;
    } catch {
      return formatDate ? formatDate(dateString) : 'Recently';
    }
  }

  function isoDate(dateString) {
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return '';
      return d.toISOString();
    } catch {
      return '';
    }
  }

  function hostOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  function sourceLabel(s, index) {
    if (typeof s === 'string') {
      return hostOf(s) || `Source ${index + 1}`;
    }
    return s.display || s.title || (s.url ? sourceLabel(s.url, index) : `Source ${index + 1}`);
  }

  function sourceHref(s) {
    return typeof s === 'string' ? s : (s && s.url) || '';
  }

  function dedupeSourceEntries(sourceUrls) {
    const urls = Array.isArray(sourceUrls) ? sourceUrls : [];
    const seen = new Set();
    const out = [];
    for (const s of urls) {
      const href = sourceHref(s);
      if (!href) continue;
      const key = href.split('?')[0].split('#')[0];
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  }

  function buildSourceChipsHTML(sourceUrls, opts, escapeHtml) {
    const { xUrl, includeX = false } = opts || {};
    const urls = dedupeSourceEntries(sourceUrls);
    if (urls.length === 0 && !includeX) return '';

    const chips = urls.map((s, i) => {
      const href = escapeHtml(sourceHref(s));
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

  function getPostMedia() {
    return (typeof window !== 'undefined' && window.PostMedia) || null;
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
      .map((x) => (typeof x === 'string' ? x : x && x.url))
      .filter(Boolean)
      .filter((u) => !isVideoUrl(u))
      .filter(notLogo);

    const primaryNorm = primary ? normalizeUrl(ensureAbsoluteImageUrl(primary)) : null;
    const secondary = secondaryCandidates
      .map((url) => ensureAbsoluteImageUrl(url))
      .filter((url) => normalizeUrl(url) !== primaryNorm)
      .filter((url, i, arr) => arr.findIndex((u) => normalizeUrl(u) === normalizeUrl(url)) === i);

    const normalized = cn && cn.normalizeMedia ? cn.normalizeMedia(post) : null;
    const videoCandidates = normalized && normalized.videos.length > 0
      ? normalized.videos
      : [
          ...(post.video_url || post.video || post.assets?.video_url
            ? [post.video_url || post.video || post.assets?.video_url]
            : []),
          ...(post.videos || []),
        ].filter(Boolean).filter(isVideoUrl)
          .map((u) => String(u).replace('https://video.twimg.com/', '/media/video/'));
    const videoUrls = videoCandidates
      .map((u) => ensureAbsoluteImageUrl(u))
      .map((u) => u.replace('https://video.twimg.com/', '/media/video/'))
      .filter((url, i, arr) => arr.findIndex((u) => normalizeUrl(u) === normalizeUrl(url)) === i);

    return { primary, secondary, videoUrls, hasVideoHero: videoUrls.length > 0 };
  }

  /**
   * Hero media block: single figure or swipeable gallery.
   * Every item is a real media component (video controls, lazy image,
   * broken-media fallback) bound later by PostMedia.initPostMedia.
   */
  function buildMediaHTML(post, title, helpers) {
    const pm = getPostMedia();
    const { escapeHtml, ensureAbsoluteImageUrl } = helpers;
    const { primary, secondary, videoUrls, hasVideoHero } = resolveImages(post, helpers);
    const caption = post.image_caption || post.image_credit || null;

    const items = [];
    videoUrls.forEach((vUrl) => {
      items.push({
        type: 'video',
        url: vUrl,
        poster: primary ? ensureAbsoluteImageUrl(primary) : null,
        alt: title ? `Video: ${title}` : 'Story video',
      });
    });
    if (!hasVideoHero && primary) {
      items.push({
        type: 'image',
        url: ensureAbsoluteImageUrl(primary),
        alt: title || 'Story image',
        caption: caption,
      });
    }
    secondary.forEach((url, i) => {
      items.push({
        type: 'image',
        url: url,
        alt: `${title || 'Story image'} (${items.length + 1})`,
      });
    });

    if (items.length === 0) return '';

    if (pm && pm.mediaSetHtml) {
      return pm.mediaSetHtml(items, escapeHtml, {
        className: 'article-hero',
        label: `Story media, ${items.length} item${items.length === 1 ? '' : 's'}`,
      });
    }

    // Fallback markup if the media module failed to load: still one working
    // element per item, no shared state.
    return items.map((item) => {
      if (item.type === 'video') {
        return `<figure class="pm-figure article-hero"><div class="pm-media pm-media--video"><video src="${escapeHtml(item.url)}" ${item.poster ? `poster="${escapeHtml(item.poster)}"` : ''} controls muted playsinline preload="metadata" aria-label="${escapeHtml(item.alt)}"></video></div></figure>`;
      }
      return `<figure class="pm-figure article-hero"><div class="pm-media"><img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.alt)}" loading="lazy" decoding="async"></div>${item.caption ? `<figcaption class="pm-caption">${escapeHtml(item.caption)}</figcaption>` : ''}</figure>`;
    }).join('');
  }

  function deriveBriefFacts(post) {
    const maxItems = 5;
    const maxLineLen = 120;
    if (post.key_takeaways && Array.isArray(post.key_takeaways) && post.key_takeaways.length > 0) {
      return post.key_takeaways
        .slice(0, maxItems)
        .map((s) => (typeof s === 'string' ? s.trim() : String(s).trim()))
        .filter(Boolean)
        .map((s) => (s.length > maxLineLen ? s.substring(0, maxLineLen).trim() + '\u2026' : s));
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
    const { stripTcoLinks, escapeHtml } = helpers;
    const items = deriveBriefFacts(post);
    if (items.length === 0) return '';

    const cleanedItems = [];
    items.forEach((item) => {
      const { cleaned } = stripTcoLinks(item);
      if (cleaned) cleanedItems.push(cleaned);
    });
    if (cleanedItems.length === 0) return '';

    const list = cleanedItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    return `<section class="nn-module nn-what-we-know" role="region" aria-label="What we know">
      <h2 class="nn-module__title">What we know</h2>
      <ul class="nn-module__list">${list}</ul>
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

  /** Header action row: copy, share, ask AI, all stories, text size. */
  function buildActionsHTML(post, articleId, siteUrl, escapeHtml) {
    let html = '<div class="story-actions" role="group" aria-label="Story actions">';
    html += `<button type="button" class="utility-btn" id="copy-link-btn" aria-label="Copy link to this story">${ICON_LINK}<span>Copy link</span></button>`;
    html += `<button type="button" class="utility-btn" id="share-menu-btn" aria-label="Share this story" aria-haspopup="true" aria-expanded="false">${ICON_SHARE}<span>Share</span></button>`;
    html += `<button type="button" class="utility-btn utility-btn--primary" data-open-chat aria-label="Ask Noteworthy News AI about this story">${ICON_SPARK}<span>Ask about this story</span></button>`;
    html += `<a href="/archive.html" class="utility-btn" aria-label="Back to all stories">${ICON_LIST}<span class="label-optional">All stories</span></a>`;
    html += `<div class="share-menu" id="share-menu" role="menu" aria-hidden="true">
      <a href="#" class="share-option" id="share-twitter" target="_blank" rel="noopener" role="menuitem">${X_ICON}<span>Share on X</span></a>
      <a href="#" class="share-option" id="share-facebook" target="_blank" rel="noopener" role="menuitem"><span>Facebook</span></a>
      <a href="#" class="share-option" id="share-linkedin" target="_blank" rel="noopener" role="menuitem"><span>LinkedIn</span></a>
      <a href="#" class="share-option" id="share-reddit" target="_blank" rel="noopener" role="menuitem"><span>Reddit</span></a>
      <a href="#" class="share-option" id="share-email" role="menuitem"><span>Email</span></a>
    </div>`;
    html += '</div>';
    return html;
  }

  function getDek(post) {
    if (post.dek && typeof post.dek === 'string' && post.dek.trim()) {
      const d = post.dek.trim();
      return d.length > 220 ? d.slice(0, 217) + '\u2026' : d;
    }
    if (post.summary && typeof post.summary === 'string') {
      const s = post.summary.trim();
      if (s.length > 40 && s.length <= 280) {
        return s.length > 220 ? s.slice(0, 217) + '\u2026' : s;
      }
    }
    return '';
  }

  /**
   * X attribution card. Doubles as the lead visual when a post has no
   * usable media, so a giant X logo never becomes the hero.
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
      <a href="${escapeHtml(xUrl)}" target="_blank" rel="noopener noreferrer" class="nn-source-card__link">View the original post</a>
    </aside>`;
  }

  /* ── Header ──────────────────────────────────────── */

  function buildHeaderHTML(post, ctx, options) {
    const { title, datePosted, articleId, helpers } = ctx;
    const { escapeHtml, formatDate, calculateReadTime } = helpers;
    const { displayTitle, urgencyPill } = resolveArticlePresentation(post, title);
    const classification = classify(post);
    const presentation = { displayTitle, urgencyPill, isBreaking: !!(urgencyPill && urgencyPill.cls === 'nn-pill--breaking') };
    const kicker = getKickerLabel(post, classification, presentation);
    const dek = options.showDek ? getDek(post) : '';
    const published = formatPublishedFull(datePosted, formatDate);
    const publishedISO = isoDate(datePosted);
    const updatedAt = post.updated_at || post.dateModified;

    let metaBits = '';
    if (options.showByline) {
      const author = post.author || 'Noteworthy News';
      metaBits += `<span>By <b>${escapeHtml(author)}</b></span><span class="nn-meta__sep" aria-hidden="true">&middot;</span>`;
    }
    metaBits += `<time id="article-date" ${publishedISO ? `datetime="${publishedISO}"` : ''}>${escapeHtml(published)}</time>`;
    if (updatedAt && updatedAt !== datePosted) {
      try {
        const u = new Date(updatedAt);
        if (!isNaN(u.getTime())) {
          const uLabel = u.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
          metaBits += `<span class="nn-meta__sep" aria-hidden="true">&middot;</span><span class="meta-updated">Updated ${escapeHtml(uLabel)}</span>`;
        }
      } catch (_) { /* ignore */ }
    }
    if (options.readFrom) {
      const readMin = calculateReadTime(options.readFrom);
      metaBits += `<span class="nn-meta__sep" aria-hidden="true">&middot;</span><span id="article-read-time">${readMin} min read</span>`;
    }

    let html = '<header class="story-header" id="story-header">';
    html += '<div class="story-kicker">';
    if (urgencyPill) {
      html += `<span class="nn-pill ${urgencyPill.cls}"><span class="dot" aria-hidden="true"></span>${escapeHtml(urgencyPill.label)}</span>`;
    }
    if (kicker) {
      html += `<span class="story-kicker-cat">${escapeHtml(kicker)}</span>`;
    }
    html += '</div>';
    html += `<h1 class="story-headline" id="article-heading" tabindex="-1">${escapeHtml(displayTitle)}</h1>`;
    if (dek) {
      html += `<p class="story-dek">${escapeHtml(dek)}</p>`;
    }
    html += `<div class="story-meta">${metaBits}</div>`;
    html += buildActionsHTML(post, articleId, ctx.siteUrl, escapeHtml);
    html += '</header>';
    return html;
  }

  function spineNode(inner, modifier, label, escapeHtml) {
    if (!inner) return '';
    const labelHtml = label ? `<span class="spine-label">${escapeHtml(label)}</span>` : '';
    return `<section class="spine-node ${modifier || ''} reveal-item">${labelHtml}${inner}</section>`;
  }

  /* ── Templates ───────────────────────────────────── */

  function buildBreakingBriefHTML(post, ctx) {
    const { title, story, helpers } = ctx;
    const { escapeHtml, formatPostText, stripTcoLinks } = helpers;
    const { displayTitle } = resolveArticlePresentation(post, title);

    let html = buildHeaderHTML(post, ctx, { showByline: false, showDek: false, readFrom: null });

    html += '<div class="story-spine">';

    const mediaHTML = buildMediaHTML(post, displayTitle, helpers);
    if (mediaHTML) {
      html += spineNode(mediaHTML, 'spine-node--media', '', escapeHtml);
    }

    // When there's no real media, the source card carries the lead visual.
    const sourceCard = buildSourceCardHTML(post, helpers, { showQuote: !mediaHTML });
    if (sourceCard && !mediaHTML) {
      html += spineNode(sourceCard, 'spine-node--panel', '', escapeHtml);
    }

    const whatWeKnow = buildWhatWeKnowHTML(post, helpers);
    if (whatWeKnow) {
      html += spineNode(whatWeKnow, 'spine-node--panel', '', escapeHtml);
    }

    const { cleaned } = stripTcoLinks(story);
    const bodyHTML = `<div class="nn-body article-body" id="article-body">${formatPostText(cleaned)}</div>`;
    html += spineNode(bodyHTML, 'spine-node--body', 'Original update', escapeHtml);

    if (sourceCard && mediaHTML) {
      html += spineNode(sourceCard, 'spine-node--panel', '', escapeHtml);
    }

    const sourceUrls = Array.isArray(post.source_urls) ? post.source_urls : [];
    if (sourceUrls.length > 0) {
      html += spineNode(buildSourceChipsHTML(sourceUrls, {}, escapeHtml), '', 'Sources', escapeHtml);
    }

    html += '</div>';
    return html;
  }

  function buildLongformHTML(post, ctx) {
    const { title, story, helpers } = ctx;
    const { escapeHtml, formatPostText } = helpers;
    const { displayTitle } = resolveArticlePresentation(post, title);

    let html = buildHeaderHTML(post, ctx, { showByline: true, showDek: true, readFrom: story });

    html += '<div class="story-spine">';

    const mediaHTML = buildMediaHTML(post, displayTitle, helpers);
    if (mediaHTML) {
      html += spineNode(mediaHTML, 'spine-node--media', '', escapeHtml);
    }

    const bodyClass = post.lead_paragraph ? 'nn-body article-body lead-cap' : 'nn-body article-body';
    const bodyHTML = `<div class="${bodyClass}" id="article-body">${formatPostText(story)}</div>`;
    html += spineNode(bodyHTML, 'spine-node--body', '', escapeHtml);

    const keyPoints = buildKeyPointsHTML(post, helpers);
    if (keyPoints) {
      html += spineNode(keyPoints, 'spine-node--panel', '', escapeHtml);
    }

    const sourceUrls = Array.isArray(post.source_urls) ? post.source_urls : [];
    const xUrl = post.x_url || post.link || '';
    const hasX = xUrl && (xUrl.includes('x.com') || xUrl.includes('twitter.com'));
    if (sourceUrls.length > 0 || hasX) {
      html += spineNode(
        buildSourceChipsHTML(sourceUrls, { xUrl: hasX ? xUrl : null, includeX: hasX }, escapeHtml),
        '',
        'Sources',
        escapeHtml
      );
    }

    html += '</div>';
    return html;
  }

  /* ── Source trail (rail) ─────────────────────────── */

  /**
   * Build the "Source trail" rail card body from real post data only.
   * Returns '' when the post has no source information at all; the shell
   * then keeps its honest standards note instead.
   */
  function buildSourceTrailHTML(post, helpers) {
    const { escapeHtml } = helpers;
    const rows = [];
    const seen = new Set();

    const push = (href, label, meta) => {
      if (!href || seen.has(href)) return;
      seen.add(href);
      const host = hostOf(href);
      rows.push(`<li class="trail-item">
        <a class="trail-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">
          <span class="trail-label">${escapeHtml(label)}</span>
          ${host ? `<span class="trail-host">${escapeHtml(host)}</span>` : ''}
        </a>
        ${meta ? `<span class="trail-meta">${escapeHtml(meta)}</span>` : ''}
      </li>`);
    };

    const sourceUrls = dedupeSourceEntries(post.source_urls);
    sourceUrls.forEach((s, i) => {
      push(sourceHref(s), sourceLabel(s, i), '');
    });

    const xUrl = post.x_url || post.link || '';
    if (xUrl && (xUrl.includes('x.com') || xUrl.includes('twitter.com'))) {
      push(xUrl, 'Original post on X', post.author ? `Posted by ${post.author}` : '');
    } else if (post.source_url || post.url || post.link) {
      const href = post.source_url || post.url || post.link;
      if (href && !href.includes('noteworthynews.co')) {
        push(href, post.source ? `${post.source} (original)` : 'Original source', '');
      }
    }

    if (post.source === 'USGS' || post.category === 'Earthquake') {
      const eventId = post.eventId || post.event_id;
      if (eventId) {
        push(`https://earthquake.usgs.gov/earthquakes/eventpage/${encodeURIComponent(eventId)}`, 'USGS event page', 'Official seismic data');
      }
    }

    if (rows.length === 0) return '';
    return `<ul class="trail-list">${rows.join('')}</ul>`;
  }

  global.ArticlePageV4 = {
    classify,
    getUrgencyPill,
    resolveArticlePresentation,
    getKickerLabel,
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
    buildHeaderHTML,
    buildBreakingBriefHTML,
    buildLongformHTML,
    buildSourceTrailHTML,
    getDek,
  };
})(typeof window !== 'undefined' ? window : globalThis);
