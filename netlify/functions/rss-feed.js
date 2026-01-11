/**
 * RSS Feed Fetcher - Single Feed
 * GET /.netlify/functions/rss-feed?feedId=<id> OR ?feedUrl=<url>
 * 
 * Fetches a single RSS feed server-side to avoid CORS.
 * Only allows feeds from the registry (SSRF protection).
 */

// Lazy load RSS feeds and parser to avoid bundling issues
let RSS_FEEDS;
let parseFeed;

function loadModules() {
  if (RSS_FEEDS && parseFeed) {
    return; // Already loaded
  }
  
  try {
    const feedsModule = require('../../src/rss/feeds.js');
    RSS_FEEDS = feedsModule.RSS_FEEDS;
    if (!RSS_FEEDS || !Array.isArray(RSS_FEEDS)) {
      throw new Error('RSS_FEEDS not found or invalid');
    }
  } catch (error) {
    console.error('[RSS Feed] Failed to load feeds.js:', error);
    throw new Error(`Failed to load RSS feeds: ${error.message}`);
  }

  try {
    const parserModule = require('../../src/rss/parser.js');
    parseFeed = parserModule.parseFeed;
    if (typeof parseFeed !== 'function') {
      throw new Error('parseFeed not found or not a function');
    }
  } catch (error) {
    console.error('[RSS Feed] Failed to load parser.js:', error);
    throw new Error(`Failed to load RSS parser: ${error.message}`);
  }
}

// In-memory cache (TTL: 10 minutes)
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Get feed from registry
 */
function getFeed(feedId, feedUrl) {
  // Ensure modules are loaded
  if (!RSS_FEEDS) {
    loadModules();
  }
  if (feedId) {
    return RSS_FEEDS.find(f => f.id === feedId);
  }
  if (feedUrl) {
    // SSRF protection: only allow URLs from registry
    return RSS_FEEDS.find(f => f.feedUrl === feedUrl);
  }
  return null;
}

/**
 * Parse and normalize RSS feed
 */
async function fetchAndParseFeed(feed) {
  const cacheKey = `feed_${feed.id}`;
  const cached = cache.get(cacheKey);
  
  if (cached && (Date.now() - cached.fetchedAt < CACHE_TTL)) {
    return cached.data;
  }
  
  try {
    const items = await parseFeed(feed.feedUrl, feed);
    
    const result = {
      source: {
        id: feed.id,
        name: feed.name,
        homepage: feed.homepage,
        feedUrl: feed.feedUrl
      },
      items: items,
      fetchedAt: new Date().toISOString()
    };
    
    // Cache result
    cache.set(cacheKey, {
      data: result,
      fetchedAt: Date.now()
    });
    
    return result;
  } catch (error) {
    console.error(`[RSS Feed] Error fetching ${feed.id}:`, error.message);
    throw error;
  }
}

/**
 * Main handler
 */
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  
  // Handle OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }
  
  // Only allow GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  try {
    // Load modules on first request (lazy loading to avoid bundling issues)
    loadModules();
    
    const { feedId, feedUrl } = event.queryStringParameters || {};
    
    if (!feedId && !feedUrl) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing feedId or feedUrl parameter' })
      };
    }
    
    const feed = getFeed(feedId, feedUrl);

    if (!feed) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Feed not found in registry' })
      };
    }

    // Check if feed is disabled
    // (In production, check against user config)
    
    const result = await fetchAndParseFeed(feed);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('[RSS Feed] Handler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Internal server error'
      })
    };
  }
};
