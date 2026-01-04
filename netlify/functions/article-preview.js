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
  if (!isCrawler) {
    // Redirect regular users to the actual article page
    const articleId = event.queryStringParameters?.id;
    if (articleId) {
      return {
        statusCode: 302,
        headers: {
          'Location': `https://noteworthynews.co/article.html?id=${encodeURIComponent(articleId)}`
        },
        body: ''
      };
    }
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

    // Get post from blob storage
    const store = getStore({
      name: 'x-posts',
      siteID: siteID,
      token: token,
    });

    const postKey = articleId.startsWith('post-') ? articleId : `post-${articleId}`;
    const postData = await store.get(postKey, { type: 'text' });
    
    if (!postData) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Article not found'
      };
    }

    const post = JSON.parse(postData);
    
    // Extract post metadata
    const title = post.title || post.story || post.text || 'Breaking News Story';
    const story = post.story || post.text || post.title || '';
    const description = story.length > 200 ? story.substring(0, 200) + '...' : story;
    const image = post.primary_image_url || post.image_url || post.image || post.images?.[0] || 'https://noteworthynews.co/PREVIEWIMAGEBRUH.jpg';
    const url = `https://noteworthynews.co/article.html?id=${encodeURIComponent(articleId)}`;
    const datePosted = post.datePosted || post.createdAt || post.created_at || new Date().toISOString();
    
    // Ensure image URL is absolute
    const imageUrl = image.startsWith('http') ? image : `https://noteworthynews.co${image.startsWith('/') ? image : '/' + image}`;

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
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="${escapeHtml(imageUrl)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name" content="Noteworthy News">
    <meta property="og:locale" content="en_US">
    <meta property="article:published_time" content="${datePosted}">
    <meta property="article:author" content="Noteworthy News">
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${escapeHtml(url)}">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
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

