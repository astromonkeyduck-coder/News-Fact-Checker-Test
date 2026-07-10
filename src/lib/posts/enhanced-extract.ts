/**
 * Enhanced extraction utilities for tweet data
 */

/**
 * Extract timestamp from Twitter Snowflake ID
 * Twitter IDs are Snowflake IDs: 64-bit integers with embedded timestamp
 * Formula: timestamp = (id >> 22) + 1288834974657
 * Where 1288834974657 is the Twitter epoch (2010-11-04)
 */
export function extractDateFromTweetId(tweetId: string): Date | null {
  try {
    // Twitter Snowflake ID timestamp extraction
    // Formula: timestamp = (id >> 22) + 1288834974657
    // Where 1288834974657 is the Twitter epoch (2010-11-04)
    const id = BigInt(tweetId);
    const twitterEpoch = BigInt(1288834974657);
    const shift = BigInt(22);
    const shifted = id >> shift;
    const timestamp = Number(shifted) + Number(twitterEpoch);
    const date = new Date(timestamp);
    
    // Validate: date should be reasonable (not in the future, not before Twitter existed)
    const now = Date.now();
    const twitterStartDate = new Date('2010-11-04').getTime();
    if (date.getTime() > now) {
      console.warn('[EnhancedExtract] Extracted date is in the future, likely invalid:', {
        tweetId,
        extractedDate: date.toISOString(),
        now: new Date().toISOString()
      });
      return null;
    }
    if (date.getTime() < twitterStartDate) {
      console.warn('[EnhancedExtract] Extracted date is before Twitter existed, likely invalid:', {
        tweetId,
        extractedDate: date.toISOString()
      });
      return null;
    }
    
    return date;
  } catch (error) {
    console.warn('[EnhancedExtract] Could not extract date from tweet ID:', tweetId, error);
    return null;
  }
}

/**
 * Extract images from oEmbed HTML
 */
export function extractImagesFromHtml(html: string): string[] {
  const images: string[] = [];
  
  // Match img tags
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match;
  
  while ((match = imgRegex.exec(html)) !== null) {
    const url = match[1];
    // Filter out Twitter's own images (logos, icons, etc.)
    if (url && !url.includes('twitter.com/images') && !url.includes('abs.twimg.com/')) {
      // Only include actual media images
      if (url.includes('pbs.twimg.com') || url.includes('media')) {
        images.push(url);
      }
    }
  }
  
  return images;
}

/**
 * Extract videos from oEmbed HTML
 */
export function extractVideosFromHtml(html: string): string[] {
  const videos: string[] = [];
  
  // Match video tags
  const videoRegex = /<video[^>]+src=["']([^"']+)["']/gi;
  let match;
  
  while ((match = videoRegex.exec(html)) !== null) {
    const url = match[1];
    if (url) {
      videos.push(url);
    }
  }
  
  // Also check for iframe embeds (X/Twitter video embeds)
  const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
  while ((match = iframeRegex.exec(html)) !== null) {
    const url = match[1];
    if (url && url.includes('video')) {
      videos.push(url);
    }
  }
  
  return videos;
}

/**
 * Extract all media (images and videos) from oEmbed HTML
 */
export function extractMediaFromHtml(html: string): { images: string[]; videos: string[] } {
  return {
    images: extractImagesFromHtml(html),
    videos: extractVideosFromHtml(html),
  };
}

/**
 * Parse engagement stats from oEmbed HTML (if available)
 * Note: X's oEmbed API doesn't provide stats, but we can try to extract from HTML
 * This is a best-effort extraction
 */
export function extractStatsFromHtml(html: string): {
  views?: number;
  likes?: number;
  reposts?: number;
  replies?: number;
} {
  const stats: { views?: number; likes?: number; reposts?: number; replies?: number } = {};
  
  // Try to find stats in data attributes or text
  // Format might be: "123 views", "1.2K likes", etc.
  const patterns = [
    { key: 'views' as const, regex: /(\d+(?:\.\d+)?[KMB]?)\s*(?:view|views)/i },
    { key: 'likes' as const, regex: /(\d+(?:\.\d+)?[KMB]?)\s*(?:like|likes|heart|hearts)/i },
    { key: 'reposts' as const, regex: /(\d+(?:\.\d+)?[KMB]?)\s*(?:repost|reposts|retweet|retweets)/i },
    { key: 'replies' as const, regex: /(\d+(?:\.\d+)?[KMB]?)\s*(?:reply|replies|comment|comments)/i },
  ];
  
  for (const { key, regex } of patterns) {
    const match = html.match(regex);
    if (match) {
      const value = parseAbbreviatedNumber(match[1]);
      if (value !== null) {
        stats[key] = value;
      }
    }
  }
  
  return stats;
}

/**
 * Parse abbreviated numbers (1.2K → 1200, 1.5M → 1500000)
 */
function parseAbbreviatedNumber(str: string): number | null {
  try {
    const cleaned = str.trim().toUpperCase();
    const num = parseFloat(cleaned);
    
    if (cleaned.includes('K')) {
      return Math.round(num * 1000);
    } else if (cleaned.includes('M')) {
      return Math.round(num * 1000000);
    } else if (cleaned.includes('B')) {
      return Math.round(num * 1000000000);
    }
    
    return Math.round(num);
  } catch {
    return null;
  }
}

/**
 * Enhanced tweet data with all extracted information
 */
export interface EnhancedTweetData {
  images: string[];
  videos: string[];
  datePosted?: string; // ISO string when Snowflake extraction succeeds
  views?: number;
  likes?: number;
  reposts?: number;
  replies?: number;
}

/**
 * Extract all enhanced data from tweet ID and oEmbed HTML
 */
export function extractEnhancedData(tweetId: string, oembedHtml: string): EnhancedTweetData {
  // Extract date from tweet ID (Snowflake timestamp)
  const dateFromId = extractDateFromTweetId(tweetId);
  
  // IMPORTANT: If date extraction fails, we should NOT use current time
  // Instead, we should return null/undefined and let the caller handle it
  // This prevents posts from getting incorrect "just now" timestamps
  let datePosted: string | undefined;
  if (dateFromId) {
    datePosted = dateFromId.toISOString();
    console.log('[EnhancedExtract] Successfully extracted date from tweet ID:', {
      tweetId,
      datePosted,
      age: Math.round((Date.now() - dateFromId.getTime()) / (1000 * 60 * 60)) + ' hours ago'
    });
  } else {
    console.warn('[EnhancedExtract] Failed to extract date from tweet ID, datePosted will be undefined:', tweetId);
    // Don't set datePosted - let the caller decide what to do
    // This prevents overwriting existing correct dates with "now"
  }
  
  // Extract media
  const media = extractMediaFromHtml(oembedHtml);
  
  // Extract stats (may not be available from oEmbed)
  const stats = extractStatsFromHtml(oembedHtml);
  
  return {
    images: media.images,
    videos: media.videos,
    datePosted, // May be undefined if extraction failed
    views: stats.views,
    likes: stats.likes,
    reposts: stats.reposts,
    replies: stats.replies,
  };
}

