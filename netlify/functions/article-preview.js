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
// This avoids fragile fs.readFileSync and ensures the interactive page always works
const ARTICLE_PAGE_SHELL = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="app-version" content="December 18, 2025">
    
    <!-- Dynamic Meta Tags - Updated by article-loader.js -->
    <title id="article-title">Article Title - Noteworthy News</title>
    <meta name="description" id="article-description" content="Article description for SEO">
    <meta name="keywords" content="breaking news, fact-checked journalism, media literacy, news analysis">
    <meta name="author" content="Noteworthy News">
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
    
    <!-- Canonical URL -->
    <link rel="canonical" id="article-canonical" href="https://noteworthynews.co/article.html">
    
    <!-- Open Graph -->
    <meta property="og:type" content="article">
    <meta property="og:url" id="og-url" content="https://noteworthynews.co/article.html">
    <meta property="og:title" id="og-title" content="Article Title - Noteworthy News">
    <meta property="og:description" id="og-description" content="Article description">
    <meta property="og:image" id="og-image" content="https://noteworthynews.co/PREVIEWIMAGEBRUH.jpg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name" content="Noteworthy News">
    <meta property="og:locale" content="en_US">
    <meta property="article:published_time" id="article-published" content="">
    <meta property="article:author" content="Noteworthy News">
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" id="twitter-url" content="https://noteworthynews.co/article.html">
    <meta name="twitter:title" id="twitter-title" content="Article Title - Noteworthy News">
    <meta name="twitter:description" id="twitter-description" content="Article description">
    <meta name="twitter:image" id="twitter-image" content="https://noteworthynews.co/PREVIEWIMAGEBRUH.jpg">
    <meta name="twitter:site" content="@NoteworthyNews">
    <meta name="twitter:creator" content="@NoteworthyNews">
    
    <!-- Favicon and Theme -->
    <link rel="icon" type="image/png" href="IMG_5794.PNG" sizes="32x32">
    <link rel="icon" type="image/png" href="IMG_5794.PNG" sizes="192x192">
    <link rel="shortcut icon" type="image/png" href="IMG_5794.PNG">
    <link rel="apple-touch-icon" href="IMG_5794.PNG" sizes="180x180">
    <link rel="mask-icon" href="IMG_5794.PNG" color="#0f234a">
    <meta name="theme-color" content="#07152a">
    
    <!-- Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&family=Georgia:wght@400;700&family=Charter:wght@400;700&display=swap" rel="stylesheet">
    
    <!-- Styles -->
    <link rel="stylesheet" href="styles.css">
    
    <!-- Christmas Theme -->
    <script src="christmas-config.js"></script>
    <script>
        if (typeof CHRISTMAS_CONFIG !== 'undefined') {
            window.CHRISTMAS_CONFIG = CHRISTMAS_CONFIG;
        }
    </script>
    <script src="christmas-theme-loader.js"></script>
    
    <!-- Google AdSense -->
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5427142458403577"
            crossorigin="anonymous"></script>
    
    <!-- Structured Data -->
    <script type="application/ld+json" id="article-structured-data">
    {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": "Article Title",
      "description": "Article description",
      "image": "https://noteworthynews.co/PREVIEWIMAGEBRUH.jpg",
      "datePublished": "",
      "dateModified": "",
      "author": {
        "@type": "Organization",
        "name": "Noteworthy News"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Noteworthy News",
        "logo": {
          "@type": "ImageObject",
          "url": "https://noteworthynews.co/IMG_5794.PNG"
        }
      }
    }
    </script>
    
    <style>
        html.article-page-active, html.article-page-active body, body.article-page {
            background: #ffffff !important;
            color: #1a1a1a !important;
        }
        .article-container { max-width: 800px; margin: 0 auto; padding: 2rem; }
    </style>
</head>
<body class="article-page">
    <div id="article-content" class="article-container">
        <div id="article-loader">Loading article...</div>
    </div>
    
    <!-- Article Loader Script -->
    <script src="https://noteworthynews.co/src/components/article-loader.js"></script>
</body>
</html>`;

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
  const isGIF = videoUrl && (videoUrl.includes('.gif') || videoUrl.includes('get-uploaded-image'));
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
      body: ARTICLE_PAGE_SHELL
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
    let postKey;
    if (articleId.startsWith('post-')) {
      postKey = articleId;
    } else if (articleId.startsWith('usgs-')) {
      postKey = `post-${articleId}`;
    } else {
      postKey = `post-${articleId}`;
    }
    
    // Fetch post with timeout
    let postData;
    try {
      const blobPromise = store.get(postKey, { type: 'text' });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Blob storage timeout')), 10000)
      );
      postData = await Promise.race([blobPromise, timeoutPromise]);
    } catch (blobError) {
      console.error('[article-preview] Blob storage error:', blobError.message);
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
    
    // Parse JSON
    let post;
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
    
    // Log post data structure (debug mode)
    if (process.env.DEBUG) {
      console.log('[article-preview] Post data structure:', {
        hasPrimaryImageUrl: !!post.primary_image_url,
        hasVideoUrl: !!post.video_url,
        hasVideo: !!post.video,
        hasAssets: !!post.assets,
        hasAssetsVideoUrl: !!post.assets?.video_url,
        hasImageUrl: !!post.image_url,
        hasImage: !!post.image,
        hasImages: !!post.images,
        imageCount: post.images?.length || 0,
        keys: Object.keys(post).filter(k => k.includes('image') || k.includes('video') || k.includes('asset'))
      });
    }
    
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
