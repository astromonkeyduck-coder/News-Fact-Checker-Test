// RSS Feeds Configuration
// Edit this file to add/remove RSS feeds for ingestion
// This replaces the RSS_FEEDS_JSON environment variable to save space

module.exports = [
  // Example format:
  // { name: 'Feed Name', url: 'https://example.com/rss', tags: ['news'], reliability: 'high' }
  
  // Add your RSS feeds here
  // You can copy the contents from your RSS_FEEDS_JSON environment variable
  // and paste them here (convert from JSON to JavaScript array format)
];

// Note: If RSS_FEEDS_JSON env var is set, it will be used instead of this file
// To use this file, remove RSS_FEEDS_JSON from your Netlify environment variables
