/**
 * RSS Proxy - Server-side RSS fetcher
 * GET /.netlify/functions/rssProxy?source=<feedId>
 * 
 * Fetches RSS feeds server-side to avoid CORS.
 * Only allows feeds from the registry (SSRF protection).
 */

// Load RSS feeds and parser (lazy load in handler to prevent function crash)
// Netlify Functions run from repo root, so relative paths work
let RSS_FEEDS = null;
let parseFeed = null;
let moduleLoadError = null;

/**
 * Lazy load modules - only load when first request comes in
 * This prevents function initialization failures from crashing the entire function
 */
async function loadModules() {
  if (RSS_FEEDS && parseFeed) {
    return { RSS_FEEDS, parseFeed }; // Already loaded
  }
  
  if (moduleLoadError) {
    throw moduleLoadError; // Re-throw previous error
  }
  
  try {
    const feedsModule = await import('../../src/rss/feeds.js');
    RSS_FEEDS = feedsModule.RSS_FEEDS;
    if (!RSS_FEEDS || !Array.isArray(RSS_FEEDS)) {
      throw new Error('RSS_FEEDS is not an array');
    }
  } catch (error) {
    moduleLoadError = new Error(`Failed to load RSS feeds: ${error.message}`);
    console.error('[RSS Proxy] Error loading feeds.js:', error);
    throw moduleLoadError;
  }

  try {
    const parserModule = require('../../src/rss/parser.js');
    parseFeed = parserModule.parseFeed;
    if (typeof parseFeed !== 'function') {
      throw new Error('parseFeed is not a function');
    }
  } catch (error) {
    moduleLoadError = new Error(`Failed to load RSS parser: ${error.message}`);
    console.error('[RSS Proxy] Error loading parser.js:', error);
    throw moduleLoadError;
  }
  
  return { RSS_FEEDS, parseFeed };
}

// In-memory cache (TTL: 10 minutes)
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Validate feed URL for SSRF protection
 */
function validateFeedUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  try {
    const parsed = new URL(url);
    
    // Block internal/private network addresses
    const hostname = parsed.hostname.toLowerCase();
    
    // Block localhost variants
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return false;
    }
    
    // Block private IP ranges
    if (hostname.startsWith('10.') || 
        hostname.startsWith('172.16.') || hostname.startsWith('172.17.') || 
        hostname.startsWith('172.18.') || hostname.startsWith('172.19.') ||
        hostname.startsWith('172.20.') || hostname.startsWith('172.21.') ||
        hostname.startsWith('172.22.') || hostname.startsWith('172.23.') ||
        hostname.startsWith('172.24.') || hostname.startsWith('172.25.') ||
        hostname.startsWith('172.26.') || hostname.startsWith('172.27.') ||
        hostname.startsWith('172.28.') || hostname.startsWith('172.29.') ||
        hostname.startsWith('172.30.') || hostname.startsWith('172.31.') ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('169.254.')) {
      return false;
    }
    
    // Only allow http/https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Get feed from registry by ID (call after await loadModules() in handler)
 */
function getFeedById(feedId) {
  if (!RSS_FEEDS) throw new Error('RSS feeds not loaded');
  const feed = RSS_FEEDS.find(f => f.id === feedId);
  
  // Validate feed URL for SSRF protection
  if (feed && !validateFeedUrl(feed.feedUrl)) {
    console.error(`[RSS Proxy] Invalid feed URL for ${feedId}: ${feed.feedUrl}`);
    return null;
  }
  
  return feed;
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
    if (!parseFeed) throw new Error('RSS parser not loaded');
    // Parse feed (rss-parser handles fetching internally)
    const items = await parseFeed(feed.feedUrl, feed);
    
    // Size check on parsed items (max 5MB)
    const resultSize = JSON.stringify(items).length;
    if (resultSize > 5 * 1024 * 1024) {
      throw new Error('Parsed feed too large (max 5MB)');
    }
    
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
    // Lazy load modules in handler (not at module level) to prevent function crash
    await loadModules();
    
    const { source } = event.queryStringParameters || {};
    
    if (!source) {
      // CRITICAL: Return 200 with empty items array (never crash UI)
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          source: { id: 'unknown', name: 'Unknown', homepage: '', feedUrl: '' },
          items: [],
          fetchedAt: new Date().toISOString(),
          error: 'Missing source parameter (feedId)'
        })
      };
    }
    
    const feed = getFeedById(source);
    
    if (!feed) {
      // CRITICAL: Return 200 with empty items array (never crash UI)
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          source: { id: source, name: 'Unknown Feed', homepage: '', feedUrl: '' },
          items: [],
          fetchedAt: new Date().toISOString(),
          error: `Feed "${source}" not found in registry`
        })
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
    
    // CRITICAL: Always return 200 with items array to prevent UI crashes
    // Return empty result structure so frontend can handle gracefully
    const { source } = event.queryStringParameters || {};
    let feed = null;
    let cacheKey = null;
    
    // Only try to get feed if modules loaded successfully
    try {
      if (source && !moduleLoadError) {
        try {
          feed = getFeedById(source);
          cacheKey = `feed_${source}`;
        } catch (e) {
          // Ignore errors in getting feed (feed not found or module error)
        }
      }
    } catch (e) {
      // Ignore errors in getting feed (already failed)
    }
    
    // Try to get cached data even if fetch failed
    let cached = null;
    if (cacheKey) {
      try {
        cached = cache.get(cacheKey);
      } catch (e) {
        // Ignore cache errors
      }
    }
    
    if (cached && cached.data) {
      console.log(`[RSS Proxy] Serving cached data for ${source} due to error`);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(cached.data)
      };
    }
    
    // Return empty result structure (never crash the UI)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        source: feed ? {
          id: feed.id,
          name: feed.name,
          homepage: feed.homepage || '',
          feedUrl: feed.feedUrl
        } : {
          id: source || 'unknown',
          name: source || 'Unknown Feed',
          homepage: '',
          feedUrl: ''
        },
        items: [], // Empty array - UI can handle this
        fetchedAt: new Date().toISOString(),
        error: error.message || 'Feed fetch failed'
      })
    };
  }
};
