/**
 * Server-side rendering for article pages (for Facebook crawler)
 * Detects Facebook's crawler and serves pre-rendered HTML with correct meta tags
 */

const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const userAgent = (event.headers['user-agent'] || event.headers['User-Agent'] || '').toLowerCase();
  const isCrawler = userAgent.includes('facebookexternalhit') || 
                    userAgent.includes('facebot') ||
                    userAgent.includes('twitterbot') ||
                    userAgent.includes('linkedinbot') ||
                    userAgent.includes('slackbot') ||
                    userAgent.includes('whatsapp') ||
                    userAgent.includes('telegrambot') ||
                    userAgent.includes('discordbot') ||
                    userAgent.includes('googlebot') ||
                    userAgent.includes('bingbot');
  
  // Only serve pre-rendered content for crawlers
  // Regular users should access article.html directly
  // IMPORTANT: This function should ONLY be called for crawlers via redirect rules
  // If a regular user somehow reaches this function, redirect them to the actual article page
  if (!isCrawler) {
    // Redirect regular users to the actual article page
    const articleId = event.queryStringParameters?.id;
    
    // Always redirect non-crawlers to article.html if they have an article ID
    // This handles both direct access and any accidental routing to this function
    if (articleId) {
      return {
        statusCode: 302,
        headers: {
          'Location': `https://noteworthynews.co/article.html?id=${encodeURIComponent(articleId)}`
        },
        body: ''
      };
    }
    
    // If no article ID, return 404
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Not found'
    };
  }

  try {
    // Extract article ID from query string
    const articleId = event.queryStringParameters?.id;
    if (!articleId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Missing article ID'
      };
    }

    // Get siteID and token
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

    // Get post from blob storage with timeout protection
    const store = getStore({
      name: 'x-posts',
      siteID: siteID,
      token: token,
    });

    const postKey = articleId.startsWith('post-') ? articleId : `post-${articleId}`;
    
    // Add timeout protection for blob storage calls
    let postData;
    try {
      const blobPromise = store.get(postKey, { type: 'text' });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Blob storage timeout')), 10000) // 10 second timeout
      );
      postData = await Promise.race([blobPromise, timeoutPromise]);
    } catch (blobError) {
      console.error('[article-preview] Blob storage error:', blobError.message);
      // Return a basic HTML page with meta tags even if blob fetch fails
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        },
        body: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Breaking News | Noteworthy News</title>
    <meta property="og:type" content="article">
    <meta property="og:url" content="https://noteworthynews.co/article.html?id=${escapeHtml(articleId)}">
    <meta property="og:title" content="Breaking News | Noteworthy News">
    <meta property="og:description" content="Stay informed with the latest breaking news from Noteworthy News.">
    <meta property="og:image" content="https://noteworthynews.co/PREVIEWIMAGEBRUH.jpg">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Breaking News | Noteworthy News">
    <meta name="twitter:description" content="Stay informed with the latest breaking news from Noteworthy News.">
    <meta name="twitter:image" content="https://noteworthynews.co/PREVIEWIMAGEBRUH.jpg">
    <meta http-equiv="refresh" content="0;url=https://noteworthynews.co/article.html?id=${escapeHtml(articleId)}">
    <script>window.location.href = 'https://noteworthynews.co/article.html?id=${escapeHtml(articleId)}';</script>
</head>
<body>
    <p>Redirecting to <a href="https://noteworthynews.co/article.html?id=${escapeHtml(articleId)}">article</a>...</p>
</body>
</html>`
      };
    }
    
    if (!postData) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Article not found'
      };
    }

    // Parse JSON with error handling
    let post;
    try {
      post = JSON.parse(postData);
    } catch (parseError) {
      console.error('[article-preview] JSON parse error:', parseError.message);
      // Return fallback HTML if JSON is invalid
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
        },
        body: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Breaking News | Noteworthy News</title>
    <meta property="og:type" content="article">
    <meta property="og:url" content="https://noteworthynews.co/article.html?id=${escapeHtml(articleId)}">
    <meta property="og:title" content="Breaking News | Noteworthy News">
    <meta property="og:description" content="Stay informed with the latest breaking news from Noteworthy News.">
    <meta property="og:image" content="https://noteworthynews.co/PREVIEWIMAGEBRUH.jpg">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Breaking News | Noteworthy News">
    <meta name="twitter:description" content="Stay informed with the latest breaking news from Noteworthy News.">
    <meta name="twitter:image" content="https://noteworthynews.co/PREVIEWIMAGEBRUH.jpg">
    <meta http-equiv="refresh" content="0;url=https://noteworthynews.co/article.html?id=${escapeHtml(articleId)}">
    <script>window.location.href = 'https://noteworthynews.co/article.html?id=${escapeHtml(articleId)}';</script>
</head>
<body>
    <p>Redirecting to <a href="https://noteworthynews.co/article.html?id=${escapeHtml(articleId)}">article</a>...</p>
</body>
</html>`
      };
    }
    
    // Extract post metadata
    const title = post.title || post.story || post.text || 'Breaking News Story';
    const story = post.story || post.text || post.title || '';
    const description = story.length > 200 ? story.substring(0, 200) + '...' : story;
    
    // CRITICAL: Prioritize primary_image_url (generated earthquake images) for social media previews
    // This ensures the generated branded earthquake images appear in social media cards
    const image = post.primary_image_url || 
                 post.image_url || 
                 post.image || 
                 post.images?.[0] || 
                 'https://noteworthynews.co/PREVIEWIMAGEBRUH.jpg';
    const url = `https://noteworthynews.co/article.html?id=${encodeURIComponent(articleId)}`;
    const datePosted = post.datePosted || post.createdAt || post.created_at || new Date().toISOString();
    
    // Ensure image URL is absolute
    let imageUrl = image.startsWith('http') ? image : `https://noteworthynews.co${image.startsWith('/') ? image : '/' + image}`;
    
    // Check for video URL for Player Cards
    const videoUrl = post.video_url || post.video || null;
    const hasVideo = videoUrl && (videoUrl.includes('.gif') || videoUrl.includes('.mp4') || videoUrl.includes('video') || videoUrl.includes('get-uploaded-image'));
    let playerUrl = null;
    if (hasVideo) {
      const absoluteVideoUrl = videoUrl.startsWith('http') ? videoUrl : `https://noteworthynews.co${videoUrl.startsWith('/') ? videoUrl : '/' + videoUrl}`;
      playerUrl = `https://noteworthynews.co/video-player.html?url=${encodeURIComponent(absoluteVideoUrl)}`;
    }
    
    // For earthquakes, format title as "BREAKING: M___ Earthquake Near ___."
    let formattedTitle = title;
    const isEarthquake = post.category === 'Earthquake' || post.event_type === 'earthquake' || post.source === 'USGS';
    if (isEarthquake && post.magnitude && post.location_display) {
      const magnitudeFormatted = typeof post.magnitude === 'number' ? post.magnitude.toFixed(1) : post.magnitude;
      formattedTitle = `BREAKING: M${magnitudeFormatted} Earthquake Near ${post.location_display}.`;
    }
    
    // Log image selection for debugging social media previews
    console.log('[article-preview] Image selected for social preview:', {
      articleId,
      source: post.primary_image_url ? 'primary_image_url' : 
              post.image_url ? 'image_url' : 
              post.image ? 'image' : 
              post.images?.[0] ? 'images[0]' : 'default',
      url: imageUrl.substring(0, 100),
      isGenerated: imageUrl.includes('get-uploaded-image') && imageUrl.includes('earthquake'),
      hasPrimary: !!post.primary_image_url,
      hasVideo: !!hasVideo,
      videoUrl: videoUrl ? videoUrl.substring(0, 100) : null,
      formattedTitle
    });

    // Generate HTML with pre-rendered meta tags
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)} | Noteworthy News</title>
    <meta name="description" content="${escapeHtml(description)}">
    
    <!-- Open Graph -->
    <meta property="og:type" content="article">
    <meta property="og:url" content="${escapeHtml(url)}">
    <meta property="og:title" content="${escapeHtml(formattedTitle)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="${escapeHtml(imageUrl)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name" content="Noteworthy News">
    <meta property="og:locale" content="en_US">
    <meta property="article:published_time" content="${datePosted}">
    <meta property="article:author" content="Noteworthy News">
    ${hasVideo && playerUrl ? `
    <!-- Open Graph Video (for Player Cards) -->
    <meta property="og:video" content="${escapeHtml(playerUrl)}">
    <meta property="og:video:url" content="${escapeHtml(playerUrl)}">
    <meta property="og:video:secure_url" content="${escapeHtml(playerUrl)}">
    <meta property="og:video:type" content="text/html">
    <meta property="og:video:width" content="1280">
    <meta property="og:video:height" content="720">
    ` : ''}
    
    <!-- Twitter Card -->
    ${hasVideo && playerUrl ? `
    <meta name="twitter:card" content="player">
    <meta name="twitter:player" content="${escapeHtml(playerUrl)}">
    <meta name="twitter:player:width" content="1280">
    <meta name="twitter:player:height" content="720">
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
    ` : `
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
    `}
    <meta name="twitter:url" content="${escapeHtml(url)}">
    <meta name="twitter:title" content="${escapeHtml(formattedTitle)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:site" content="@NoteworthyNews">
    <meta name="twitter:creator" content="@NoteworthyNews">
    
    <!-- Redirect to actual article page -->
    <meta http-equiv="refresh" content="0;url=${escapeHtml(url)}">
    <script>window.location.href = '${escapeHtml(url)}';</script>
</head>
<body>
    <p>Redirecting to <a href="${escapeHtml(url)}">${escapeHtml(title)}</a>...</p>
</body>
</html>`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
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

