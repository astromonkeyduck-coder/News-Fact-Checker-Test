/**
 * RSS Feed Aggregator
 * GET /.netlify/functions/rss-aggregate?region=<region>&topic=<topic>&source=<source>&timeWindowHours=<hours>&limit=<limit>
 * 
 * Aggregates multiple RSS feeds in parallel with concurrency control.
 * Returns combined, deduplicated, sorted items.
 */

const RSS_FEEDS = require('../../src/rss/feeds.js').RSS_FEEDS;
const { parseFeed } = require('../../src/rss/parser.js');

// Concurrency limit for parallel fetches
const CONCURRENCY_LIMIT = 4;

// In-memory cache (TTL: 10 minutes)
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch single feed
 */
async function fetchFeed(feed) {
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
    console.error(`[RSS Aggregate] Error fetching ${feed.id}:`, error.message);
    return null;
  }
}

/**
 * Process feeds with concurrency control
 */
async function fetchFeedsInParallel(feeds) {
  const results = [];
  const chunks = [];
  
  // Split into chunks
  for (let i = 0; i < feeds.length; i += CONCURRENCY_LIMIT) {
    chunks.push(feeds.slice(i, i + CONCURRENCY_LIMIT));
  }
  
  // Process chunks sequentially, items in parallel
  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(feed => fetchFeed(feed))
    );
    results.push(...chunkResults.filter(r => r !== null));
  }
  
  return results;
}

/**
 * Deduplicate items by URL + title hash
 */
function deduplicateItems(allItems) {
  const seen = new Set();
  const unique = [];
  
  for (const item of allItems) {
    const key = `${item.url}_${item.title}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }
  
  return unique;
}

/**
 * Filter items by criteria
 */
function filterItems(items, filters) {
  let filtered = items;
  
  if (filters.region) {
    // Items don't have region directly, but we can filter by source
    // This would require source metadata in items
  }
  
  if (filters.topic) {
    // Filter by categories if available
    filtered = filtered.filter(item => {
      if (!item.categories || item.categories.length === 0) return true;
      return item.categories.some(cat => 
        cat.toLowerCase().includes(filters.topic.toLowerCase())
      );
    });
  }
  
  if (filters.source) {
    filtered = filtered.filter(item => 
      item.rawSourceName && 
      item.rawSourceName.toLowerCase().includes(filters.source.toLowerCase())
    );
  }
  
  if (filters.timeWindowHours) {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - filters.timeWindowHours);
    
    filtered = filtered.filter(item => {
      const published = new Date(item.publishedAt);
      return published >= cutoff;
    });
  }
  
  return filtered;
}

/**
 * Get enabled feeds (respects config)
 */
function getEnabledFeeds() {
  // In production, check localStorage config from request
  // For now, return all enabledByDefault feeds
  return RSS_FEEDS.filter(feed => feed.enabledByDefault);
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
    const params = event.queryStringParameters || {};
    const filters = {
      region: params.region,
      topic: params.topic,
      source: params.source,
      timeWindowHours: params.timeWindowHours ? parseInt(params.timeWindowHours) : null,
      limit: params.limit ? parseInt(params.limit) : 200
    };
    
    // Get enabled feeds
    const enabledFeeds = getEnabledFeeds();
    
    if (enabledFeeds.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          items: [],
          sources: [],
          fetchedAt: new Date().toISOString()
        })
      };
    }
    
    // Fetch all feeds in parallel (with concurrency limit)
    const feedResults = await fetchFeedsInParallel(enabledFeeds);
    
    // Combine all items
    const allItems = [];
    const sources = [];
    
    for (const result of feedResults) {
      if (result && result.items) {
        allItems.push(...result.items);
        sources.push(result.source);
      }
    }
    
    // Deduplicate
    const uniqueItems = deduplicateItems(allItems);
    
    // Apply filters
    const filteredItems = filterItems(uniqueItems, filters);
    
    // Sort by publishedAt (newest first)
    filteredItems.sort((a, b) => {
      const dateA = new Date(a.publishedAt);
      const dateB = new Date(b.publishedAt);
      return dateB - dateA;
    });
    
    // Apply limit
    const limitedItems = filteredItems.slice(0, filters.limit);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        items: limitedItems,
        sources: sources,
        totalItems: limitedItems.length,
        fetchedAt: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('[RSS Aggregate] Handler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Internal server error'
      })
    };
  }
};
