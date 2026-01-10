/**
 * RSS Proxy - Server-side RSS fetcher
 * GET /.netlify/functions/rssProxy?source=<feedId>
 * 
 * Fetches RSS feeds server-side to avoid CORS.
 * Only allows feeds from the registry (SSRF protection).
 */

const RSS_FEEDS = require('../../src/rss/feeds.js').RSS_FEEDS;
const { parseFeed } = require('../../src/rss/parser.js');

// In-memory cache (TTL: 10 minutes)
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Get feed from registry by ID
 */
function getFeedById(feedId) {
  return RSS_FEEDS.find(f => f.id === feedId);
}

/**
 * Fetch and parse RSS feed
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
    console.error(`[RSS Proxy] Error fetching ${feed.id}:`, error.message);
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
    const { source } = event.queryStringParameters || {};
    
    if (!source) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing source parameter (feedId)' })
      };
    }
    
    const feed = getFeedById(source);
    
    if (!feed) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: `Feed "${source}" not found in registry` })
      };
    }
    
    const result = await fetchAndParseFeed(feed);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('[RSS Proxy] Handler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Internal server error'
      })
    };
  }
};
