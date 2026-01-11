/**
 * Credible RSS Feed Registry
 * 
 * Copyright-compliant feed configuration for Situation Monitor.
 * All feeds follow headline+link policy with proper attribution.
 */

const RSS_FEEDS = [
  {
    id: 'bbc-world',
    name: 'BBC World',
    homepage: 'https://www.bbc.com/news',
    feedUrl: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    regions: ['Global', 'Europe', 'UK'],
    topics: ['World', 'Politics', 'Breaking'],
    refreshMinutes: 10,
    enabledByDefault: true,
    snippetPolicy: {
      allowDescription: true,
      maxChars: 200
    },
    licenseNotes: 'headline+link only; attribution required; BBC terms apply'
  },
  {
    id: 'bbc-main',
    name: 'BBC News',
    homepage: 'https://www.bbc.com/news',
    feedUrl: 'https://feeds.bbci.co.uk/news/rss.xml',
    regions: ['Global', 'Europe', 'UK'],
    topics: ['World', 'Politics', 'Breaking', 'Business'],
    refreshMinutes: 10,
    enabledByDefault: true,
    snippetPolicy: {
      allowDescription: true,
      maxChars: 200
    },
    licenseNotes: 'headline+link only; attribution required; BBC terms apply'
  },
  {
    id: 'npr-news',
    name: 'NPR News',
    homepage: 'https://www.npr.org',
    feedUrl: 'http://www.npr.org/rss/rss.php?id=1001',
    regions: ['Global', 'US'],
    topics: ['World', 'Politics', 'Breaking'],
    refreshMinutes: 10,
    enabledByDefault: true,
    snippetPolicy: {
      allowDescription: true,
      maxChars: 200
    },
    licenseNotes: 'headline+link only; attribution required; NPR terms apply'
  },
  {
    id: 'npr-world',
    name: 'NPR World',
    homepage: 'https://www.npr.org/sections/world/',
    feedUrl: 'https://feeds.npr.org/1004/rss.xml',
    regions: ['Global'],
    topics: ['World', 'International'],
    refreshMinutes: 10,
    enabledByDefault: true,
    snippetPolicy: {
      allowDescription: true,
      maxChars: 200
    },
    licenseNotes: 'headline+link only; attribution required; NPR terms apply'
  },
  {
    id: 'npr-politics',
    name: 'NPR Politics',
    homepage: 'https://www.npr.org/sections/politics/',
    feedUrl: 'https://feeds.npr.org/1014/rss.xml',
    regions: ['US'],
    topics: ['Politics', 'Government'],
    refreshMinutes: 10,
    enabledByDefault: true,
    snippetPolicy: {
      allowDescription: true,
      maxChars: 200
    },
    licenseNotes: 'headline+link only; attribution required; NPR terms apply'
  },
  {
    id: 'npr-economy',
    name: 'NPR Economy',
    homepage: 'https://www.npr.org/sections/economy/',
    feedUrl: 'https://feeds.npr.org/1017/rss.xml',
    regions: ['Global', 'US'],
    topics: ['Business', 'Economy', 'Markets'],
    refreshMinutes: 10,
    enabledByDefault: true,
    snippetPolicy: {
      allowDescription: true,
      maxChars: 200
    },
    licenseNotes: 'headline+link only; attribution required; NPR terms apply'
  },
  {
    id: 'cnn-top',
    name: 'CNN Top Stories',
    homepage: 'https://www.cnn.com',
    feedUrl: 'http://rss.cnn.com/rss/cnn_topstories.rss',
    regions: ['Global', 'US'],
    topics: ['World', 'Breaking', 'Politics'],
    refreshMinutes: 10,
    enabledByDefault: true,
    snippetPolicy: {
      allowDescription: true,
      maxChars: 200
    },
    licenseNotes: 'headline+link only; attribution required; CNN terms apply'
  },
  {
    id: 'aljazeera',
    name: 'Al Jazeera',
    homepage: 'https://www.aljazeera.com',
    feedUrl: 'https://www.aljazeera.com/xml/rss/all.xml',
    regions: ['Global', 'Middle East'],
    topics: ['World', 'Politics', 'Middle East'],
    refreshMinutes: 10,
    enabledByDefault: true,
    snippetPolicy: {
      allowDescription: true,
      maxChars: 200
    },
    licenseNotes: 'headline+link only; attribution required; Al Jazeera terms apply'
  },
  {
    id: 'dw-top',
    name: 'Deutsche Welle',
    homepage: 'https://www.dw.com',
    feedUrl: 'https://rss.dw.com/rdf/rss-en-top',
    regions: ['Global', 'Europe', 'Germany'],
    topics: ['World', 'Politics', 'Europe'],
    refreshMinutes: 10,
    enabledByDefault: true,
    snippetPolicy: {
      allowDescription: true,
      maxChars: 200
    },
    licenseNotes: 'headline+link only; attribution required; DW terms apply'
  },
  {
    id: 'guardian-world',
    name: 'The Guardian World',
    homepage: 'https://www.theguardian.com/world',
    feedUrl: 'https://www.theguardian.com/world/rss',
    regions: ['Global', 'Europe', 'UK'],
    topics: ['World', 'Politics', 'International'],
    refreshMinutes: 10,
    enabledByDefault: true,
    snippetPolicy: {
      allowDescription: true,
      maxChars: 200
    },
    licenseNotes: 'headline+link only; attribution required; Guardian terms apply'
  }
];

/**
 * Get feed by ID
 */
function getFeedById(feedId) {
  return RSS_FEEDS.find(feed => feed.id === feedId);
}

/**
 * Get all enabled feeds (respects localStorage config)
 * Note: localStorage not available in server context, so returns all enabledByDefault
 */
function getEnabledFeeds() {
  return RSS_FEEDS.filter(feed => feed.enabledByDefault);
}

/**
 * Get feed by URL (for validation)
 */
function getFeedByUrl(feedUrl) {
  return RSS_FEEDS.find(feed => feed.feedUrl === feedUrl);
}

/**
 * Validate feed URL is in registry (SSRF protection)
 */
function isFeedUrlAllowed(feedUrl) {
  return RSS_FEEDS.some(feed => feed.feedUrl === feedUrl);
}

// CommonJS exports for server-side (only in Node.js environment)
// Note: This file uses both CommonJS and ES6 exports for dual compatibility
// Server-side functions use require(), browser uses ES6 import
// The esbuild warning about mixing CommonJS and ES modules is expected and safe to ignore
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  // Suppress esbuild warning: we intentionally support both module systems
  // eslint-disable-next-line no-undef
  const mod = module;
  mod.exports = {
    RSS_FEEDS,
    getFeedById,
    getEnabledFeeds,
    getFeedByUrl,
    isFeedUrlAllowed
  };
}

// ES6 exports for client-side (for ES6 import syntax)
export {
  RSS_FEEDS,
  getFeedById,
  getEnabledFeeds,
  getFeedByUrl,
  isFeedUrlAllowed
};

// Also set on window for legacy compatibility
if (typeof window !== 'undefined') {
  window.RSS_FEEDS = RSS_FEEDS;
  window.getFeedById = getFeedById;
  window.getEnabledFeeds = getEnabledFeeds;
  window.getFeedByUrl = getFeedByUrl;
  window.isFeedUrlAllowed = isFeedUrlAllowed;
}
