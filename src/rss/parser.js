/**
 * RSS Parser Utilities
 * Shared parsing logic for RSS feeds
 */

const Parser = require('rss-parser');

// RSS parser with custom user agent
const parser = new Parser({
  timeout: 8000, // 8 second timeout
  maxRedirects: 3,
  customFields: {
    item: ['content:encoded', 'content:encodedSnippet']
  },
  headers: {
    'User-Agent': 'NoteworthyNewsRSSBot/1.0 (contact: contact@noteworthynews.co)'
  }
});

/**
 * Normalize snippet - clamp to max chars, remove HTML, discard if too long
 */
function normalizeSnippet(text, maxChars = 200) {
  if (!text) return null;
  
  // Remove HTML tags
  const stripped = text.replace(/<[^>]*>/g, '').trim();
  
  // If it looks like full article text (>500 chars), discard
  if (stripped.length > 500) {
    return null;
  }
  
  // Clamp to max chars
  if (stripped.length > maxChars) {
    return stripped.substring(0, maxChars).trim() + '…';
  }
  
  return stripped;
}

/**
 * Normalize date to ISO string
 */
function normalizeDate(dateStr) {
  if (!dateStr) return new Date().toISOString();
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

/**
 * Generate stable item ID
 */
function generateItemId(url, title) {
  const crypto = require('crypto');
  const hash = crypto
    .createHash('md5')
    .update((url || '') + (title || ''))
    .digest('hex')
    .substring(0, 12);
  return `rss_${hash}`;
}

/**
 * Parse and normalize RSS feed
 */
async function parseFeed(feedUrl, feedConfig) {
  try {
    const parsed = await parser.parseURL(feedUrl);
    
    const items = parsed.items
      .slice(0, 25) // Max 25 items per feed
      .map(item => {
        // Get snippet - prefer contentSnippet, then summary, then description
        let snippet = item.contentSnippet || item.summary || item.description || null;
        
        // Never use content:encoded (full article)
        if (item['content:encoded'] && item['content:encoded'].length > 500) {
          snippet = null; // Discard if it looks like full article
        }
        
        // Normalize snippet according to feed policy
        if (snippet && feedConfig.snippetPolicy.allowDescription) {
          snippet = normalizeSnippet(snippet, feedConfig.snippetPolicy.maxChars);
        } else {
          snippet = null;
        }
        
        // Validate URL
        let url = item.link || item.guid || null;
        if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
          url = null;
        }
        
        return {
          id: generateItemId(url, item.title),
          title: (item.title || '').trim(),
          url: url,
          publishedAt: normalizeDate(item.pubDate || item.isoDate),
          snippet: snippet,
          categories: item.categories || [],
          rawSourceName: feedConfig.name
        };
      })
      .filter(item => item.title && item.url); // Must have title and valid URL
    
    return items;
  } catch (error) {
    console.error(`[RSS Parser] Error parsing ${feedUrl}:`, error.message);
    throw error;
  }
}

module.exports = {
  parseFeed,
  normalizeSnippet,
  normalizeDate,
  generateItemId
};
