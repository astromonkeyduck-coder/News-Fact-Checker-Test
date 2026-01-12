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

const { getStore } = require("@netlify/blobs");

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
    console.warn('[article-preview] Could not load article.html, using minimal template:', error.message);
    ARTICLE_PAGE_SHELL = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Article - Noteworthy News</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body class="article-page">
    <div id="article-content" class="article-container">
        <div id="article-loader">Loading article...</div>
    </div>
    <script src="https://noteworthynews.co/src/components/article-loader.js"></script>
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
    const title = post.title || post.story || post.text || 'Breaking News Story';
    const story = post.story || post.text || post.title || '';
  
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
  
  // Generate HTML
  return `<!DOCTYPE html>
<html lang="en">
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
    <meta property="article:published_time" content="${datePosted}">
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
    
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; }
        h1 { margin: 0 0 1rem 0; }
        p { line-height: 1.6; }
    </style>
</head>
<body>
    <h1>${escapeHtml(formattedTitle)}</h1>
    <p>${escapeHtml(description)}</p>
    <p><a href="${escapeHtml(articleUrl)}">Read full article</a></p>
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

    const store = getStore({
      name: 'x-posts',
      siteID: siteID,
      token: token,
    });

    // Handle different article ID formats
    // Posts are stored with .json extension (see createPost.js: postKey = `post-${postId}.json`)
    let postKey;
    if (articleId.startsWith('post-')) {
      // If it already has .json, use as-is; otherwise add it
      postKey = articleId.endsWith('.json') ? articleId : `${articleId}.json`;
    } else if (articleId.startsWith('usgs-')) {
      postKey = `post-${articleId}.json`;
    } else {
      postKey = `post-${articleId}.json`;
    }
    
    // Fetch post with timeout
    let postData;
    try {
      // Posts are stored as JSON, so use type: 'json' for automatic parsing
      const blobPromise = store.get(postKey, { type: 'json' });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Blob storage timeout')), 10000)
      );
      postData = await Promise.race([blobPromise, timeoutPromise]);
    } catch (blobError) {
      console.error('[article-preview] Blob storage error:', blobError.message);
      console.error('[article-preview] Looking for key:', postKey);
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
