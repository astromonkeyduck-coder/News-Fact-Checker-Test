/**
 * Edge Function to route article.html requests
 * - Crawlers (Twitter, Facebook, etc.) → article-preview.js (pre-rendered HTML with correct meta tags)
 * - Regular users → static article.html (normal page)
 */

export default async (request: Request, context: any) => {
  const userAgent = request.headers.get('user-agent') || '';
  const url = new URL(request.url);
  
  // Detect social media crawlers
  const isCrawler = /twitterbot|facebookexternalhit|facebot|linkedinbot|slackbot|whatsapp|telegrambot|discordbot|googlebot|bingbot/i.test(userAgent);
  
  if (isCrawler) {
    // Route crawlers to article-preview function for pre-rendered HTML with correct meta tags
    const previewUrl = `https://noteworthynews.co/.netlify/functions/article-preview${url.search}`;
    const response = await fetch(previewUrl, {
      headers: {
        'User-Agent': userAgent,
        // Forward other important headers
        'Accept': request.headers.get('Accept') || '*/*',
        'Accept-Language': request.headers.get('Accept-Language') || 'en-US',
      },
    });
    return response;
  }
  
  // Regular users: serve static article.html
  // Use Netlify Edge Functions context.next() to serve the original static file
  // This bypasses the redirect and serves the file directly from the site
  // context.next() is the official Netlify way to serve the original request
  if (context && typeof context.next === 'function') {
    return context.next();
  }
  
  // Fallback: If context.next() not available, we need to fetch the static file
  // But we can't fetch /article.html (it will redirect to this Edge Function again)
  // Solution: Fetch from the Netlify CDN origin directly (bypasses redirect)
  // Netlify's origin URL format: https://{site-id}.netlify.app/article.html
  // Or use the site's domain with a special internal path
  
  // For now, return a simple HTML response that redirects client-side
  // This is not ideal but will work until we can properly serve the static file
  const redirectHtml = `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0;url=/article.html${url.search}&_bypass=1">
  <script>window.location.href = '/article.html${url.search}&_bypass=1';</script>
</head>
<body>Redirecting...</body>
</html>`;
  
  return new Response(redirectHtml, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
};
