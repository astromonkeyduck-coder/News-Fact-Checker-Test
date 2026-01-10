/**
 * RSS Feed Fetcher - Single Feed
 * GET /.netlify/functions/rss-feed?feedId=<id> OR ?feedUrl=<url>
 * 
 * Fetches a single RSS feed server-side to avoid CORS.
 * Only allows feeds from the registry (SSRF protection).
 */

const RSS_FEEDS = require('../../src/rss/feeds.js').RSS_FEEDS;
const { parseFeed } = require('../../src/rss/parser.js');

// In-memory cache (TTL: 10 minutes)
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Get feed from registry
 */
function getFeed(feedId, feedUrl) {
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
