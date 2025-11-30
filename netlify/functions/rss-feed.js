/**
 * RSS Feed Generator
 * GET /.netlify/functions/rss-feed
 * Optional query params: ?category=breaking-news&limit=20
 */

const { getStore } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  const headers = {
    "Content-Type": "application/rss+xml; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=300" // Cache for 5 minutes
  };

  try {
    // Get query parameters
    const category = event.queryStringParameters?.category || null;
    const limit = Math.min(parseInt(event.queryStringParameters?.limit || "20", 10), 50);

    // Fetch posts from API
    const postsEndpoint = process.env.POSTS_ENDPOINT || "/.netlify/functions/posts-read";
    const baseUrl = event.headers["x-forwarded-host"] 
      ? `https://${event.headers["x-forwarded-host"]}`
      : (event.headers.host ? `https://${event.headers.host}` : "https://noteworthynews.co");

    // Fetch posts
    let posts = [];
    try {
      // Try to get from Netlify Blobs first (if available)
      if (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
        const store = getStore({
          name: "analytics-data",
          siteID: process.env.NETLIFY_SITE_ID,
          token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
        });
        
        // Try to get cached posts
        try {
          const cached = await store.get("posts-cache", { type: "json" });
          if (cached && Array.isArray(cached) && cached.length > 0) {
            posts = cached;
          }
        } catch (e) {
          // Cache miss, continue to fetch
        }
      }

      // If no cached posts, fetch from API
      if (posts.length === 0) {
        const apiUrl = baseUrl + postsEndpoint + `?limit=${limit * 2}`; // Get more to filter
        const response = await fetch(apiUrl, {
          headers: {
            "User-Agent": "Noteworthy-News-RSS/1.0"
          }
        });

        if (response.ok) {
          posts = await response.json();
        }
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
      // Continue with empty posts array
    }

    // Filter by category if specified
    if (category && posts.length > 0) {
      posts = posts.filter(post => {
        const postCategory = (post.category || "").toLowerCase().replace(/\s+/g, "-");
        return postCategory === category.toLowerCase();
      });
    }

    // Limit results
    posts = posts.slice(0, limit);

    // Generate RSS XML
    const rss = generateRSS(posts, baseUrl, category);

    return {
      statusCode: 200,
      headers,
      body: rss
    };
  } catch (error) {
    console.error("RSS Feed Error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Origin": "*"
      },
      body: `Error generating RSS feed: ${error.message}`
    };
  }
};

/**
 * Generate RSS XML from posts
 */
function generateRSS(posts, baseUrl, category) {
  const siteTitle = "Noteworthy News";
  const siteDescription = "Fact-checked journalism, breaking news, and media literacy education";
  const siteUrl = baseUrl;
  const feedTitle = category 
    ? `${siteTitle} - ${category.charAt(0).toUpperCase() + category.slice(1).replace(/-/g, " ")}`
    : siteTitle;
  const feedUrl = category
    ? `${siteUrl}/.netlify/functions/rss-feed?category=${category}`
    : `${siteUrl}/.netlify/functions/rss-feed`;

  const now = new Date().toUTCString();

  // Escape XML special characters
  function escapeXml(unsafe) {
    if (!unsafe) return "";
    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  // Format date for RSS
  function formatRSSDate(dateString) {
    try {
      return new Date(dateString).toUTCString();
    } catch {
      return new Date().toUTCString();
    }
  }

  // Generate item XML
  const items = posts.map(post => {
    const title = escapeXml(post.title || post.story || post.text || "Breaking News");
    const description = escapeXml(
      (post.story || post.text || post.title || "").substring(0, 500)
    );
    const link = `${siteUrl}/article.html?id=${encodeURIComponent(post.id || "")}`;
    const pubDate = formatRSSDate(post.datePosted || post.createdAt || post.created_at);
    const guid = `${siteUrl}/article.html?id=${encodeURIComponent(post.id || "")}`;
    const category = escapeXml(post.category || "Breaking News");
    const author = "Noteworthy News <news@noteworthynews.co>";

    // Image if available
    const image = post.image || post.images?.[0] || null;
    const imageXml = image 
      ? `<enclosure url="${escapeXml(image)}" type="image/jpeg" />`
      : "";

    return `    <item>
      <title>${title}</title>
      <link>${link}</link>
      <description>${description}</description>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="true">${guid}</guid>
      <category>${category}</category>
      <author>${author}</author>
      ${imageXml}
    </item>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(feedTitle)}</title>
    <link>${siteUrl}</link>
    <description>${escapeXml(siteDescription)}</description>
    <language>en-US</language>
    <lastBuildDate>${now}</lastBuildDate>
    <pubDate>${now}</pubDate>
    <ttl>60</ttl>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />
    <image>
      <url>${siteUrl}/IMG_5794.PNG</url>
      <title>${escapeXml(siteTitle)}</title>
      <link>${siteUrl}</link>
    </image>
${items}
  </channel>
</rss>`;
}

