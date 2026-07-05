/**
 * Article Preview Router - Single Entry Point for All Article Requests
 * 
 * Handles:
 * - Crawlers (Twitter, Facebook, etc.) → Prerendered HTML with correct meta tags
 * - Regular users → Interactive article page
 * - Query params: id (required), mode (preview|page), card (summary|player)
 * 
 * CRITICAL: This function MUST be the single entry point for /article.html and /article
 * Netlify redirects with force=true ensure static files are overridden.
 */

const { getPostStore, readPost } = require("./lib/postStore");
const contentNormalize = require("../../lib/contentNormalize");

// Embedded article page shell template (for regular users)
// This is the full AP-style article.html template embedded to avoid fragile fs.readFileSync
// NOTE: The full template is 2600+ lines. We use fs.readFileSync at module load time
// (not in handler) which should work since article.html is in the published folder.
const fs = require('fs');
const path = require('path');

let ARTICLE_PAGE_SHELL = null;

function getArticlePageShell() {
  if (ARTICLE_PAGE_SHELL) return ARTICLE_PAGE_SHELL;
  
  try {
    // Try to read from published folder (works in Netlify Functions)
    const articlePath = path.join(__dirname, '../../article.html');
    ARTICLE_PAGE_SHELL = fs.readFileSync(articlePath, 'utf8');
    return ARTICLE_PAGE_SHELL;
  } catch (error) {
    // Fallback to minimal template if file not found
    // IMPORTANT: This template MUST include the same element IDs as article.html
    // so that article-loader.js can find them (article-heading, article-body, etc.)
    console.warn('[article-preview] Could not load article.html, using minimal template:', error.message);
    ARTICLE_PAGE_SHELL = `<!DOCTYPE html>
<html lang="en" class="article-page-active">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="app-version" content="Jul 5, 2026">

    <!-- Dynamic Meta Tags - Updated by article-loader.js -->
    <title id="article-title">Story - Noteworthy News</title>
    <meta name="description" id="article-description" content="Breaking news story from Noteworthy News">
    <meta name="robots" content="index, follow">

    <link rel="canonical" id="article-canonical" href="https://noteworthynews.co/article.html">

    <meta property="og:type" content="article">
    <meta property="og:url" id="og-url" content="https://noteworthynews.co/article.html">
    <meta property="og:title" id="og-title" content="Story - Noteworthy News">
    <meta property="og:description" id="og-description" content="Breaking news story">
    <meta property="og:image" id="og-image" content="https://noteworthynews.co/PREVIEWIMAGEBRUH.jpg">
    <meta property="og:site_name" content="Noteworthy News">

    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" id="twitter-url" content="https://noteworthynews.co/article.html">
    <meta name="twitter:title" id="twitter-title" content="Story - Noteworthy News">
    <meta name="twitter:description" id="twitter-description" content="Breaking news story">
    <meta name="twitter:image" id="twitter-image" content="https://noteworthynews.co/PREVIEWIMAGEBRUH.jpg">
    <meta name="twitter:site" content="@NoteworthyNews">

    <link rel="icon" href="/favicon.ico" sizes="48x48">
    <link rel="icon" type="image/png" href="/favicon-32x32.png" sizes="32x32">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">
    <meta name="theme-color" content="#04060B">

    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@600;700;800&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap">

    <link rel="stylesheet" href="/v2/styles/tokens.css">
    <link rel="stylesheet" href="/v2/styles/base.css">
    <link rel="stylesheet" href="/css/article-v4.css">
</head>
<body class="nn-article article-page">
    <div class="reading-progress" id="reading-progress" role="progressbar" aria-label="Reading progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <div class="reading-progress-bar" id="reading-progress-bar"></div>
    </div>

    <header class="nn-topbar" id="nn-topbar">
      <nav class="nn-topbar-row" aria-label="Primary">
        <a class="brand" href="/">
          <img class="brand-mark" src="/IMG_5794.PNG" alt="" width="24" height="24">
          <span class="brand-name">Noteworthy News</span>
        </a>
        <div class="nn-topbar-nav">
          <a class="nn-topbar-link nn-topbar-link--em" href="/archive.html">All stories</a>
        </div>
      </nav>
    </header>

    <main class="article-shell" data-template="loading" id="nn-article-shell">
        <div class="article-layout">
            <article class="article-main" id="nn-article" aria-busy="true">
                <div class="sk sk-chip" aria-hidden="true"></div>
                <div class="sk sk-headline" aria-hidden="true"></div>
                <div class="sk sk-media" aria-hidden="true"></div>
                <div class="sk sk-line" aria-hidden="true"></div>
                <div class="sk sk-line" aria-hidden="true" style="width:88%"></div>
                <div class="sk sk-line" aria-hidden="true" style="width:60%"></div>
            </article>
            <aside class="article-rail" id="nn-rail" aria-label="Story context">
                <section class="rail-card rail-card--trail" id="rail-trail">
                    <h2 class="rail-card__title">Source trail</h2>
                    <div id="rail-trail-body">
                        <p class="rail-note">Every source this story cites appears here, next to the claims it supports.</p>
                    </div>
                </section>
                <section class="rail-card" id="article-toc-wrap" style="display:none;">
                    <h2 class="rail-card__title">In this article</h2>
                    <nav id="article-toc" aria-label="Article contents"></nav>
                </section>
                <section class="rail-card" id="rail-related-wrap" style="display:none;">
                    <h2 class="rail-card__title">Related coverage</h2>
                    <div id="related-articles"></div>
                </section>
                <section class="rail-card" id="rail-latest-wrap" style="display:none;">
                    <h2 class="rail-card__title">Latest</h2>
                    <div id="latest-articles"></div>
                </section>
            </aside>
        </div>

        <section class="read-next" aria-label="Read next">
            <div class="read-next__head"><h2 class="read-next__title">Read next</h2></div>
            <div class="read-next-grid" id="more-coverage-grid"></div>
        </section>

        <section class="nn-comments" id="nn-comments-wrap">
            <h2 class="nn-comments__title">Comments</h2>
            <div data-article-id="" id="article-comments"></div>
        </section>
    </main>

    <span id="article-timestamp" class="sr-only"></span>
    <span id="alert-pill" class="sr-only"></span>
    <span id="article-timestamp-header" class="sr-only"></span>
    <div id="article-tags" style="display:none;"></div>

    <div class="lightbox" id="image-lightbox" role="dialog" aria-label="Image viewer" aria-hidden="true">
        <div class="lightbox-content">
            <button class="lightbox-close" id="lightbox-close" aria-label="Close image viewer">&times;</button>
            <img id="lightbox-image" src="" alt="">
            <p class="lightbox-caption" id="lightbox-caption" hidden></p>
        </div>
    </div>

    <!-- Article Page Scripts -->
    <script type="module" src="/v2/js/post-media.js"></script>
    <script src="/js/article-v4.js"></script>
    <script src="/src/components/comment-section.js"></script>
    <script src="/lib/contentNormalize.js"></script>
    <script src="/src/components/article-page-v4.js"></script>
    <script src="/src/components/article-loader.js"></script>
</body>
</html>`;
    return ARTICLE_PAGE_SHELL;
  }
}

/**
 * Detect if request is from a crawler/bot
 */
function isCrawler(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return ua.includes('twitterbot') ||
         ua.includes('facebookexternalhit') ||
         ua.includes('facebot') ||
         ua.includes('linkedinbot') ||
         ua.includes('slackbot') ||
         ua.includes('whatsapp') ||
         ua.includes('telegrambot') ||
         ua.includes('discordbot') ||
         ua.includes('googlebot') ||
         ua.includes('bingbot') ||
         ua.includes('crawler') ||
         ua.includes('bot');
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Select image for social preview (platform-specific)
 * Twitter prefers PNG (doesn't animate GIFs), other platforms can use GIF
 */
function selectImageForPreview(post, userAgent, cardType = 'summary') {
  const isTwitter = userAgent && userAgent.toLowerCase().includes('twitterbot');
  const videoUrl = post.video_url || post.video || post.assets?.video_url || null;
  // Check if videoUrl is a GIF: ends with .gif extension, or is from get-uploaded-image with gif format parameter
  const isGIF = videoUrl && (
    videoUrl.toLowerCase().endsWith('.gif') || 
    videoUrl.toLowerCase().includes('.gif?') ||
    (videoUrl.includes('get-uploaded-image') && (
      videoUrl.includes('format=gif') || 
      videoUrl.toLowerCase().includes('&format=gif') ||
      videoUrl.toLowerCase().includes('?format=gif')
    ))
  );
  const isMP4 = videoUrl && (videoUrl.includes('.mp4') || videoUrl.includes('video'));
  
  // For Twitter summary cards, prefer PNG (GIFs don't animate and can be large)
  if (isTwitter && cardType === 'summary') {
    // Priority: PNG > GIF > Other > Default
    if (post.primary_image_url) {
      return {
        url: post.primary_image_url,
        source: 'primary_image_url (PNG)',
        type: 'png'
      };
    } else if (isGIF && videoUrl) {
      return {
        url: videoUrl,
        source: 'video_url (GIF fallback)',
        type: 'gif'
      };
    } else if (post.image_url) {
      return {
        url: post.image_url,
        source: 'image_url',
        type: 'unknown'
      };
    }
  } else {
    // For non-Twitter or player cards: GIF > PNG > Other > Default
    if (isGIF && videoUrl) {
      return {
        url: videoUrl,
        source: 'video_url (GIF)',
        type: 'gif'
      };
    } else if (post.primary_image_url) {
      return {
        url: post.primary_image_url,
        source: 'primary_image_url (PNG)',
        type: 'png'
      };
    } else if (post.image_url) {
      return {
        url: post.image_url,
        source: 'image_url',
        type: 'unknown'
      };
    }
  }
  
  // Fallback to default
  return {
    url: 'https://noteworthynews.co/PREVIEWIMAGEBRUH.jpg',
    source: 'default',
    type: 'default'
  };
}

/**
 * Generate stable cache key from post timestamp
 */
function getCacheKey(post) {
  const timestamp = post.updated_at || post.datePosted || post.createdAt || post.created_at || post.timestamp;
  if (timestamp) {
    // Use ISO string without milliseconds for stability
    const date = new Date(timestamp);
    return date.toISOString().split('.')[0] + 'Z';
  }
  return null;
}

/**
 * Generate prerendered HTML for crawlers
 */
function generatePrerenderedHTML(post, articleId, userAgent, cardType = 'summary') {
    const title = contentNormalize.cleanHeadline(post) || 'Breaking News Story';
    const story = contentNormalize.normalizeSocialPostText(
      post.story || post.text || post.title || ''
    );
  
  // Format relative time
    const datePosted = post.datePosted || post.createdAt || post.created_at || new Date().toISOString();
  const postedDate = new Date(datePosted);
  const now = new Date();
  const diffMs = now - postedDate;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  let relativeTime = '';
  if (diffDays > 0) {
    relativeTime = `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  } else if (diffHours > 0) {
    relativeTime = `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffMins > 0) {
    relativeTime = `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
  } else {
    relativeTime = 'just now';
  }
  
  const baseDescription = story.length > 150 ? story.substring(0, 150) + '...' : story;
  const description = baseDescription ? `${baseDescription} • Updated ${relativeTime}` : `Updated ${relativeTime}`;
  
  // Select image (platform-specific)
  const imageData = selectImageForPreview(post, userAgent, cardType);
  let imageUrl = imageData.url;
  
  // Ensure absolute URL
  if (!imageUrl.startsWith('http')) {
    imageUrl = `https://noteworthynews.co${imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl}`;
  }
  
  // Add stable cache key (not Date.now())
  const cacheKey = getCacheKey(post);
  if (cacheKey && !imageUrl.includes('?')) {
    imageUrl += `?_v=${encodeURIComponent(cacheKey)}`;
  }
  
  // Check for MP4 for player cards
  const videoUrl = post.video_url || post.video || post.assets?.video_url || null;
  const isMP4 = videoUrl && (videoUrl.includes('.mp4') || videoUrl.includes('video'));
  const hasMP4 = isMP4 && !videoUrl.includes('.gif');
  
  // Build article URL
  const articleUrl = `https://noteworthynews.co/article.html?id=${encodeURIComponent(articleId)}`;
  
  // Format title for earthquakes
    let formattedTitle = title;
    const isEarthquake = post.category === 'Earthquake' || post.event_type === 'earthquake' || post.source === 'USGS';
    if (isEarthquake && post.magnitude && (post.location_display || post.location)) {
      const magnitudeFormatted = typeof post.magnitude === 'number' ? post.magnitude.toFixed(1) : post.magnitude;
      const location = post.location_display || post.location;
    formattedTitle = `BREAKING: M${magnitudeFormatted} Earthquake Near ${location}`;
  }
  
  // Determine card type
  const usePlayerCard = cardType === 'player' && hasMP4;
  // Pass video URL directly to player.html for reliability
  let playerUrl = null;
  if (usePlayerCard && videoUrl) {
    const absoluteVideoUrl = videoUrl.startsWith('http') ? videoUrl : `https://noteworthynews.co${videoUrl.startsWith('/') ? videoUrl : '/' + videoUrl}`;
    playerUrl = `https://noteworthynews.co/player.html?url=${encodeURIComponent(absoluteVideoUrl)}`;
  }
  
  // Log image selection
  console.log('[article-preview] 📸 Image selection:', {
      articleId,
    userAgent: userAgent?.substring(0, 50),
    isTwitter: userAgent?.toLowerCase().includes('twitterbot'),
    cardType,
    usePlayerCard,
    imageSource: imageData.source,
    imageType: imageData.type,
    imageUrl: imageUrl.substring(0, 100),
    hasMP4,
    playerUrl
  });
  
  const storyText = (post.story || post.text || '').trim();
  const storyPreview = storyText.length > 500 ? storyText.slice(0, 497) + '…' : storyText;
  const sourceUrls = Array.isArray(post.source_urls) ? post.source_urls : [];
  let sourceChipsHtml = '';
  if (sourceUrls.length > 0) {
    const chips = sourceUrls.slice(0, 5).map((s, i) => {
      const href = escapeHtml(typeof s === 'string' ? s : s.url);
      const label = escapeHtml(
        typeof s === 'string' ? `Source ${i + 1}` : (s.display || s.title || `Source ${i + 1}`)
      );
      return `<a href="${href}" rel="noopener noreferrer">${label}</a>`;
    });
    sourceChipsHtml = `<p><strong>Sources:</strong> ${chips.join(' · ')}</p>`;
  }

  const heroImg =
    post.primary_image_url || post.image_url || post.image
      ? `<figure style="margin:1.5rem 0;"><img src="${escapeHtml(imageUrl.split('?')[0])}" alt="" style="max-width:100%;height:auto;border-radius:8px;" width="1200" height="675"></figure>`
      : '';

  const dek =
    post.dek && String(post.dek).trim()
      ? `<p style="font-size:1.125rem;color:#5b6573;">${escapeHtml(String(post.dek).trim().slice(0, 220))}</p>`
      : '';

  // Generate HTML
  return `<!DOCTYPE html>
<html lang="en" class="article-page-active">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(formattedTitle)} | Noteworthy News</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${escapeHtml(articleUrl)}">
    
    <!-- Open Graph -->
    <meta property="og:type" content="article">
    <meta property="og:url" content="${escapeHtml(articleUrl)}">
    <meta property="og:title" content="${escapeHtml(formattedTitle)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="${escapeHtml(imageUrl)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="675">
    <meta property="og:site_name" content="Noteworthy News">
    <meta property="og:locale" content="en_US">
    <meta property="article:published_time" content="${escapeHtml(datePosted)}">
    <meta property="article:author" content="Noteworthy News">
    ${usePlayerCard && playerUrl ? `
    <meta property="og:video" content="${escapeHtml(playerUrl)}">
    <meta property="og:video:url" content="${escapeHtml(playerUrl)}">
    <meta property="og:video:secure_url" content="${escapeHtml(playerUrl)}">
    <meta property="og:video:type" content="text/html">
    <meta property="og:video:width" content="1280">
    <meta property="og:video:height" content="720">
    ` : ''}
    
    <!-- Twitter Card -->
    ${usePlayerCard && playerUrl ? `
    <meta name="twitter:card" content="player">
    <meta name="twitter:player" content="${escapeHtml(playerUrl)}">
    <meta name="twitter:player:width" content="1280">
    <meta name="twitter:player:height" content="720">
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
    ` : `
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
    `}
    <meta name="twitter:url" content="${escapeHtml(articleUrl)}">
    <meta name="twitter:title" content="${escapeHtml(formattedTitle)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:site" content="@NoteworthyNews">
    <meta name="twitter:creator" content="@NoteworthyNews">

    <script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: formattedTitle,
      description: description,
      image: [imageUrl],
      datePublished: datePosted,
      dateModified: post.updated_at || datePosted,
      mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
      author: { '@type': 'Organization', name: 'Noteworthy News' },
      publisher: {
        '@type': 'Organization',
        name: 'Noteworthy News',
        logo: { '@type': 'ImageObject', url: 'https://noteworthynews.co/IMG_5794.PNG' },
      },
    })}</script>

    <style>
        body { font-family: Georgia, 'Times New Roman', serif; padding: 2rem; max-width: 720px; margin: 0 auto; color: #0b0d10; line-height: 1.75; }
        h1 { font-family: system-ui, sans-serif; font-size: 1.75rem; margin: 0 0 1rem; line-height: 1.2; }
        a { color: #1a4d8f; }
        .meta { font-family: system-ui, sans-serif; font-size: 0.875rem; color: #5b6573; margin-bottom: 1.5rem; }
    </style>
</head>
<body>
    <p class="meta">Noteworthy News · ${escapeHtml(relativeTime)}</p>
    <h1>${escapeHtml(formattedTitle)}</h1>
    ${dek}
    ${heroImg}
    ${storyPreview ? `<div>${escapeHtml(storyPreview).replace(/\n/g, '<br>')}</div>` : `<p>${escapeHtml(description)}</p>`}
    ${sourceChipsHtml}
    <p><a href="${escapeHtml(articleUrl)}">Read full article on Noteworthy News</a></p>
</body>
</html>`;
}

/**
 * Main handler
 */
exports.handler = async (event) => {
  // Parse query parameters
  const params = event.queryStringParameters || {};
  const articleId = params.id;
  const mode = params.mode || 'auto'; // preview|page|auto
  const cardType = params.card || 'summary'; // summary|player
  
  // Get user agent
  const userAgent = event.headers['user-agent'] || event.headers['User-Agent'] || '';
  const isBot = isCrawler(userAgent);
  
  // Log request
  console.log('[article-preview] Request:', {
    articleId,
    mode,
    cardType,
    isBot,
    userAgent: userAgent?.substring(0, 50)
  });
  
  // Missing article ID
  if (!articleId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Missing article ID (id parameter required)'
    };
  }
  
  // Determine response type
  const shouldPrerender = mode === 'preview' || (mode === 'auto' && isBot);
  
  // For regular users (not bots, mode=page), return interactive page
  if (!shouldPrerender) {
      return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=0, must-revalidate'
      },
            body: getArticlePageShell()
    };
  }
  
  // For crawlers: fetch post and generate prerendered HTML
  try {
    const siteID = process.env.NETLIFY_SITE_ID;
    const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN;
    
    if (!siteID || !token) {
      console.error('[article-preview] Missing NETLIFY_SITE_ID or NETLIFY_BLOB_READ_WRITE_TOKEN');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Server configuration error'
      };
    }

    const store = getPostStore();

    // Normalize article ID - strip leading "post-" and trailing ".json" so
    // postStore.readPost builds the canonical key.
    let cleanId = articleId;
    if (cleanId.startsWith('post-')) cleanId = cleanId.slice(5);
    if (cleanId.endsWith('.json')) cleanId = cleanId.slice(0, -5);

    // Try canonical ID first, then legacy eq- fallback for old earthquake posts
    const idsToTry = [cleanId];
    if (cleanId.startsWith('usgs-')) {
      const eventId = cleanId.replace(/^usgs-/, '');
      idsToTry.push(`eq-${eventId}`);
    }

    let postData;
    let lastError;
    for (const id of idsToTry) {
      try {
        const blobPromise = readPost(store, id);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Blob storage timeout')), 10000)
        );
        postData = await Promise.race([blobPromise, timeoutPromise]);
        if (postData) break;
      } catch (blobError) {
        lastError = blobError;
      }
    }
    if (!postData) {
      const blobError = lastError || new Error('Post not found');
      console.error('[article-preview] Blob storage error:', blobError.message);
      console.error('[article-preview] Tried keys:', idsToTry.join(', '));
      // Return prerendered HTML with default image
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300'
        },
        body: generatePrerenderedHTML({
          title: 'Post not found',
          story: 'The requested article could not be found.',
          datePosted: new Date().toISOString()
        }, articleId, userAgent, cardType)
      };
    }
    
    if (!postData) {
      console.error('[article-preview] Post data is null/undefined for key:', postKey);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300'
        },
        body: generatePrerenderedHTML({
          title: 'Post not found',
          story: 'The requested article could not be found.',
          datePosted: new Date().toISOString()
        }, articleId, userAgent, cardType)
      };
    }
    
    // postData is already parsed JSON (type: 'json' above)
    let post;
    if (typeof postData === 'string') {
      // Fallback: if somehow still a string, parse it
      try {
        post = JSON.parse(postData);
      } catch (parseError) {
        console.error('[article-preview] JSON parse error:', parseError.message);
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=300'
          },
          body: generatePrerenderedHTML({
            title: 'Post not found',
            story: 'The requested article could not be found.',
            datePosted: new Date().toISOString()
          }, articleId, userAgent, cardType)
        };
      }
    } else {
      post = postData;
    }
    
    if (!post || typeof post !== 'object') {
      console.error('[article-preview] Invalid post data format:', typeof postData);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300'
        },
        body: generatePrerenderedHTML({
          title: 'Post not found',
          story: 'The requested article could not be found.',
          datePosted: new Date().toISOString()
        }, articleId, userAgent, cardType)
      };
    }
    
    // Log post data structure (always log for debugging)
    console.log('[article-preview] Post data structure:', {
      hasPrimaryImageUrl: !!post.primary_image_url,
      primaryImageUrl: post.primary_image_url || null,
      hasVideoUrl: !!post.video_url,
      videoUrl: post.video_url || null,
      hasVideo: !!post.video,
      hasAssets: !!post.assets,
      hasAssetsVideoUrl: !!post.assets?.video_url,
      assetsVideoUrl: post.assets?.video_url || null,
      hasImageUrl: !!post.image_url,
      imageUrl: post.image_url || null,
      hasImage: !!post.image,
      hasImages: !!post.images,
      imageCount: post.images?.length || 0,
      keys: Object.keys(post).filter(k => k.includes('image') || k.includes('video') || k.includes('asset'))
    });
    
    // Generate prerendered HTML
    const html = generatePrerenderedHTML(post, articleId, userAgent, cardType);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      },
      body: html
    };
    
  } catch (error) {
    console.error('[article-preview] Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Internal server error'
    };
  }
};
