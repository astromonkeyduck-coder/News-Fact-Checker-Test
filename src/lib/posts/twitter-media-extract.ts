/**
 * Extract media from Twitter/X posts by scraping the tweet page
 * This replicates how Discord bots like Xiri extract media
 * 
 * Method: Fetch tweet page HTML and parse for:
 * - Open Graph meta tags (og:image, og:video)
 * - Twitter Card meta tags (twitter:image, twitter:player)
 * - Direct media URLs in HTML
 */

export interface TwitterMedia {
  images: string[];
  videos: string[];
  primary_image_url?: string;
  video_url?: string;
}

/**
 * Extract media from a Twitter/X tweet URL by scraping the page
 */
/**
 * Extract image from tweet photo page (Xiri method - this is how Discord bots do it!)
 * When pic.twitter.com redirects to /photo/1, we fetch that page and extract the image
 */
async function extractFromPhotoPage(tweetUrl: string, photoIndex: number = 1): Promise<string | null> {
  try {
    // Construct photo page URL
    const photoPageUrl = tweetUrl.replace(/\/status\/(\d+).*$/, `/status/$1/photo/${photoIndex}`);
    
    const response = await fetch(photoPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://x.com/',
      },
      redirect: 'follow',
    });
    
    if (!response.ok) {
      return null;
    }
    
    const html = await response.text();
    
    // Method 1: Open Graph (most reliable on photo pages)
    const ogMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                   html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);
    if (ogMatch && ogMatch[1]) {
      const url = ogMatch[1];
      // Clean URL (remove query params that might break it)
      return url.split('?')[0];
    }
    
    // Method 2: Twitter Card
    const twMatch = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i) ||
                  html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']twitter:image["']/i);
    if (twMatch && twMatch[1]) {
      return twMatch[1].split('?')[0];
    }
    
    // Method 3: Extract media IDs and construct URLs (Xiri method!)
    // Look for pbs.twimg.com/media/{ID} patterns
    const pbsMediaPattern = /pbs\.twimg\.com\/media\/([A-Za-z0-9_-]+)/gi;
    const pbsMatches = [...html.matchAll(pbsMediaPattern)];
    if (pbsMatches.length > 0) {
      const mediaId = pbsMatches[0][1];
      return `https://pbs.twimg.com/media/${mediaId}?format=jpg&name=large`;
    }
    
    // Method 3b: Look for standalone media IDs (G_9r_6VWcAAess7 format)
    const mediaIdPattern = /\b([A-Z]_[A-Za-z0-9_-]{10,})\b/g;
    const idMatches = [...html.matchAll(mediaIdPattern)];
    if (idMatches.length > 0) {
      // Use the first valid media ID
      for (const match of idMatches) {
        const potentialId = match[1];
        if (potentialId.match(/^[A-Z]_[A-Za-z0-9_-]+$/)) {
          return `https://pbs.twimg.com/media/${potentialId}?format=jpg&name=large`;
        }
      }
    }
    
    // Method 3c: Direct pbs.twimg.com URLs in HTML (fallback)
    const pbsMatches2 = html.match(/https?:\/\/pbs\.twimg\.com\/media\/[^\s"']+/gi);
    if (pbsMatches2) {
      for (const url of pbsMatches2) {
        if (!url.includes('profile_images') && !url.includes('ext_tw_video_thumb')) {
          // Ensure format/name params
          let cleanUrl = url.split('"')[0].split("'")[0];
          if (!cleanUrl.includes('format=')) {
            cleanUrl = cleanUrl.split('?')[0] + '?format=jpg&name=large';
          }
          return cleanUrl;
        }
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Follow pic.twitter.com or t.co link to get actual image URL
 */
async function followPicTwitterLink(picUrl: string, tweetUrl?: string): Promise<string | null> {
  try {
    const response = await fetch(picUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      redirect: 'follow',
    });
    
    // The redirect should go to the actual image or tweet photo page
    const finalUrl = response.url;
    
    // If it redirects to a tweet photo page (/photo/1), extract from that
    if (finalUrl.includes('/photo/')) {
      if (tweetUrl) {
        // Extract from the photo page using our dedicated function
        const photoIndex = finalUrl.match(/\/photo\/(\d+)/)?.[1] || '1';
        return await extractFromPhotoPage(tweetUrl, parseInt(photoIndex));
      } else {
        // Fallback: try to extract from the redirected page
        const html = await response.text();
        const ogMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
        if (ogMatch && ogMatch[1]) {
          return ogMatch[1].split('?')[0];
        }
      }
    }
    
    // If it's already an image URL, return it
    if (finalUrl.match(/\.(jpg|jpeg|png|gif|webp)/i)) {
      return finalUrl;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

export async function extractTwitterMedia(tweetUrl: string, tweetText?: string, useHeadless: boolean = false): Promise<TwitterMedia> {
  const media: TwitterMedia = {
    images: [],
    videos: [],
  };

  try {
    // HEADLESS BROWSER METHOD: If enabled and available, use Puppeteer
    if (useHeadless) {
      try {
        const { extractTwitterMediaHeadless } = await import('./twitter-media-extract-headless');
        const headlessMedia = await extractTwitterMediaHeadless(tweetUrl);
        if (headlessMedia.images.length > 0 || headlessMedia.videos.length > 0) {
          console.log('[extractTwitterMedia] Headless browser found media:', {
            images: headlessMedia.images.length,
            videos: headlessMedia.videos.length
          });
          return headlessMedia;
        }
      } catch (error: any) {
        console.warn('[extractTwitterMedia] Headless browser failed, falling back to static methods:', error.message);
        // Fall through to static methods
      }
    }

    // XIRI METHOD: Try photo pages directly first (this is how Discord bots do it!)
    const tweetIdMatch = tweetUrl.match(/\/status\/(\d+)/);
    if (tweetIdMatch) {
      // Try photo pages directly (photo/1, photo/2, etc.)
      // Discord bots know this pattern and check photo pages
      for (let i = 1; i <= 4; i++) {
        const imageUrl = await extractFromPhotoPage(tweetUrl, i);
        if (imageUrl && !media.images.includes(imageUrl)) {
          media.images.push(imageUrl);
        } else {
          // If we don't get an image, stop trying more photos
          if (i === 1) break; // Only break if first photo fails
        }
      }
    }

    // Method 1: Try to extract pic.twitter.com or t.co links from tweet text and follow them
    if (tweetText && media.images.length === 0) {
      // Look for pic.twitter.com links
      const picMatches = tweetText.match(/pic\.twitter\.com\/([A-Za-z0-9]+)/gi);
      if (picMatches) {
        for (const picMatch of picMatches) {
          const picUrl = `https://${picMatch}`;
          const imageUrl = await followPicTwitterLink(picUrl);
          if (imageUrl && !media.images.includes(imageUrl)) {
            media.images.push(imageUrl);
          }
        }
      }
      
      // Also look for t.co links that might be media (they often redirect to pic.twitter.com)
      const tcoMatches = tweetText.match(/https?:\/\/t\.co\/[A-Za-z0-9]+/gi);
      if (tcoMatches) {
        for (const tcoUrl of tcoMatches) {
          // Check if it redirects to a photo page
          const imageUrl = await followPicTwitterLink(tcoUrl);
          if (imageUrl && !media.images.includes(imageUrl)) {
            media.images.push(imageUrl);
          }
        }
      }
    }

    // Method 2: Fetch the tweet page HTML with proper headers (like a browser)
    const response = await fetch(tweetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://x.com/',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      console.warn(`[extractTwitterMedia] Failed to fetch tweet page: ${response.status}`);
      // Return whatever we found from pic.twitter.com links
      media.primary_image_url = media.images[0];
      return media;
    }

    const html = await response.text();
    
    // Extract media from HTML
    const extracted = parseMediaFromHTML(html);
    
    // Combine with pic.twitter.com results
    media.images = [...new Set([...media.images, ...extracted.images])];
    media.videos = [...new Set([...extracted.videos])];
    media.primary_image_url = media.images[0];
    media.video_url = media.videos[0];

    return media;
  } catch (error) {
    console.error('[extractTwitterMedia] Error:', error);
    // Return whatever we found from pic.twitter.com links
    media.primary_image_url = media.images[0];
    return media;
  }
}

/**
 * Parse media URLs from tweet page HTML
 */
function parseMediaFromHTML(html: string): { images: string[]; videos: string[] } {
  const images: string[] = [];
  const videos: string[] = [];
  const seenUrls = new Set<string>();

  // Method 1: Open Graph meta tags (most reliable)
  const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  if (ogImageMatch && ogImageMatch[1]) {
    const url = cleanMediaUrl(ogImageMatch[1]);
    if (url && !seenUrls.has(url)) {
      images.push(url);
      seenUrls.add(url);
    }
  }

  const ogVideoMatch = html.match(/<meta\s+property=["']og:video["']\s+content=["']([^"']+)["']/i);
  if (ogVideoMatch && ogVideoMatch[1]) {
    const url = cleanMediaUrl(ogVideoMatch[1]);
    if (url && !seenUrls.has(url)) {
      videos.push(url);
      seenUrls.add(url);
    }
  }

  // Method 2: Twitter Card meta tags
  const twitterImageMatch = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
  if (twitterImageMatch && twitterImageMatch[1]) {
    const url = cleanMediaUrl(twitterImageMatch[1]);
    if (url && !seenUrls.has(url)) {
      images.push(url);
      seenUrls.add(url);
    }
  }

  const twitterPlayerMatch = html.match(/<meta\s+name=["']twitter:player["']\s+content=["']([^"']+)["']/i);
  if (twitterPlayerMatch && twitterPlayerMatch[1]) {
    const url = cleanMediaUrl(twitterPlayerMatch[1]);
    if (url && !seenUrls.has(url) && !url.includes('youtube.com') && !url.includes('youtu.be')) {
      videos.push(url);
      seenUrls.add(url);
    }
  }

  // Method 3: Extract from embedded JSON data (Twitter often embeds tweet data in JSON-LD)
  const jsonLdMatches = html.matchAll(/<script\s+type=["']application\/ld\+json["']>(.*?)<\/script>/gis);
  for (const match of jsonLdMatches) {
    try {
      const jsonData = JSON.parse(match[1]);
      if (jsonData.image) {
        const url = cleanMediaUrl(Array.isArray(jsonData.image) ? jsonData.image[0] : jsonData.image);
        if (url && !seenUrls.has(url)) {
          images.push(url);
          seenUrls.add(url);
        }
      }
    } catch (e) {
      // Invalid JSON, skip
    }
  }

  // Method 3b: Extract from window.__INITIAL_STATE__ (Twitter's main data store)
  const initialStateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});/s);
  if (initialStateMatch) {
    try {
      const initialState = JSON.parse(initialStateMatch[1]);
      // Navigate through Twitter's data structure to find media
      // Media is typically in entities.media or tweets entities
      const extractMediaFromState = (obj: any, depth = 0): void => {
        if (depth > 10) return; // Prevent infinite recursion
        if (!obj || typeof obj !== 'object') return;

        // Check for media arrays
        if (Array.isArray(obj)) {
          obj.forEach(item => extractMediaFromState(item, depth + 1));
          return;
        }

        // Look for media_url_https
        if (obj.media_url_https && typeof obj.media_url_https === 'string') {
          const url = cleanMediaUrl(obj.media_url_https);
          if (url && !seenUrls.has(url) && isValidMediaUrl(url)) {
            images.push(url);
            seenUrls.add(url);
          }
        }

        // Look for video_info
        if (obj.video_info && obj.video_info.variants) {
          obj.video_info.variants.forEach((variant: any) => {
            if (variant.url) {
              const url = cleanMediaUrl(variant.url);
              if (url && !seenUrls.has(url)) {
                videos.push(url);
                seenUrls.add(url);
              }
            }
          });
        }

        // Recursively search nested objects
        for (const key in obj) {
          if (key === 'media' || key === 'media_entities' || key === 'extended_entities' || 
              key === 'media_url_https' || key === 'video_info' || key === 'entities') {
            extractMediaFromState(obj[key], depth + 1);
          }
        }
      };

      extractMediaFromState(initialState);
    } catch (e) {
      // Failed to parse, try regex extraction instead
    }
  }

  // Method 3c: Extract from any script tag containing media URLs (fallback)
  const allScriptMatches = html.matchAll(/<script[^>]*>(.*?)<\/script>/gis);
  for (const match of allScriptMatches) {
    const scriptContent = match[1];
    // Look for media_url_https patterns in JSON-like structures
    const mediaUrlMatches = scriptContent.matchAll(/"media_url_https"\s*:\s*"([^"]+)"/gi);
    for (const urlMatch of mediaUrlMatches) {
      const url = cleanMediaUrl(urlMatch[1]);
      if (url && !seenUrls.has(url) && isValidMediaUrl(url)) {
        images.push(url);
        seenUrls.add(url);
      }
    }
    // Look for video URLs
    const videoUrlMatches = scriptContent.matchAll(/"video_url"\s*:\s*"([^"]+)"/gi);
    for (const urlMatch of videoUrlMatches) {
      const url = cleanMediaUrl(urlMatch[1]);
      if (url && !seenUrls.has(url)) {
        videos.push(url);
        seenUrls.add(url);
      }
    }
    // Look for pbs.twimg.com in script content
    const scriptPbsMatches = scriptContent.match(/https?:\/\/pbs\.twimg\.com\/media\/[^\s"']+/gi);
    if (scriptPbsMatches) {
      for (const url of scriptPbsMatches) {
        const cleaned = cleanMediaUrl(url);
        if (cleaned && !seenUrls.has(cleaned) && !cleaned.includes('profile_images') && !cleaned.includes('ext_tw_video_thumb')) {
          images.push(cleaned);
          seenUrls.add(cleaned);
        }
      }
    }
  }

  // Method 4: Extract media IDs and construct URLs (Xiri method - THIS IS THE KEY!)
  // Twitter uses: pbs.twimg.com/media/{MEDIA_ID} where MEDIA_ID is like "G_9r_6VWcAAess7"
  // Pattern: Look for media IDs in the format: letter_underscore_alphanumeric (e.g., G_9r_6VWcAAess7)
  
  // First, try to find full pbs.twimg.com/media/{ID} patterns
  const pbsMediaPattern = /pbs\.twimg\.com\/media\/([A-Za-z0-9_-]+)/gi;
  const pbsMatches = [...html.matchAll(pbsMediaPattern)];
  if (pbsMatches.length > 0) {
    const mediaIds = [...new Set(pbsMatches.map(m => m[1]))];
    for (const mediaId of mediaIds) {
      const constructedUrl = `https://pbs.twimg.com/media/${mediaId}?format=jpg&name=large`;
      if (!seenUrls.has(constructedUrl)) {
        images.push(constructedUrl);
        seenUrls.add(constructedUrl);
      }
    }
  }
  
  // Second, look for media ID patterns in the HTML (even without full URL)
  // Pattern: [A-Z]_[A-Za-z0-9_-]{10,} (e.g., G_9r_6VWcAAess7)
  const mediaIdPattern = /\b([A-Z]_[A-Za-z0-9_-]{10,})\b/g;
  const mediaIdMatches = [...html.matchAll(mediaIdPattern)];
  if (mediaIdMatches.length > 0) {
    const potentialIds = [...new Set(mediaIdMatches.map(m => m[1]))];
    for (const potentialId of potentialIds) {
      // Only use IDs that look like Twitter media IDs (start with letter_underscore)
      if (potentialId.match(/^[A-Z]_[A-Za-z0-9_-]+$/)) {
        const constructedUrl = `https://pbs.twimg.com/media/${potentialId}?format=jpg&name=large`;
        if (!seenUrls.has(constructedUrl)) {
          images.push(constructedUrl);
          seenUrls.add(constructedUrl);
        }
      }
    }
  }
  
  // Method 4b: Direct pbs.twimg.com URLs in HTML (fallback)
  const pbsImageRegex = /https?:\/\/pbs\.twimg\.com\/media\/[^\s"']+/gi;
  let match;
  while ((match = pbsImageRegex.exec(html)) !== null) {
    let url = cleanMediaUrl(match[0]);
    // Ensure format/name params are present
    if (url && !url.includes('format=')) {
      url = url.split('?')[0] + '?format=jpg&name=large';
    }
    if (url && !seenUrls.has(url) && !url.includes('profile_images') && !url.includes('ext_tw_video_thumb')) {
      images.push(url);
      seenUrls.add(url);
    }
  }

  // Look for video.twimg.com URLs
  const videoRegex = /https?:\/\/video\.twimg\.com\/[^\s"']+/gi;
  while ((match = videoRegex.exec(html)) !== null) {
    const url = cleanMediaUrl(match[0]);
    if (url && !seenUrls.has(url)) {
      videos.push(url);
      seenUrls.add(url);
    }
  }

  // Method 5: Extract from data attributes (Twitter embeds media in data attributes)
  const dataImageMatches = html.matchAll(/data-image-url=["']([^"']+)["']/gi);
  for (const match of dataImageMatches) {
    const url = cleanMediaUrl(match[1]);
    if (url && !seenUrls.has(url) && (url.includes('pbs.twimg.com') || url.includes('media'))) {
      images.push(url);
      seenUrls.add(url);
    }
  }

  // Remove duplicates and filter out invalid URLs
  return {
    images: [...new Set(images)].filter(url => isValidMediaUrl(url)),
    videos: [...new Set(videos)].filter(url => isValidMediaUrl(url)),
  };
}

/**
 * Clean and normalize media URL
 */
function cleanMediaUrl(url: string): string | null {
  if (!url) return null;
  
  // Remove query parameters that might cause issues
  // Keep :orig or :large for better quality
  let cleaned = url.trim();
  
  // Remove tracking parameters but keep quality parameters
  cleaned = cleaned.replace(/[?&](utm_|ref_|source=)[^&]*/gi, '');
  
  // Ensure it's a full URL
  if (cleaned.startsWith('//')) {
    cleaned = 'https:' + cleaned;
  } else if (cleaned.startsWith('/')) {
    return null; // Relative URLs not supported
  }
  
  return cleaned;
}

/**
 * Validate that URL is a valid media URL
 */
function isValidMediaUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  
  // Must be HTTP/HTTPS
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return false;
  }
  
  // Must be from Twitter CDN or known media domains
  const validDomains = [
    'pbs.twimg.com',
    'video.twimg.com',
    'abs.twimg.com',
    'ton.twimg.com',
  ];
  
  const isValidDomain = validDomains.some(domain => url.includes(domain));
  
  // Exclude profile images, avatars, etc.
  const excludePatterns = [
    'profile_images',
    'ext_tw_video_thumb',
    'default_profile',
    'default_profile_normal',
  ];
  
  const isExcluded = excludePatterns.some(pattern => url.includes(pattern));
  
  return isValidDomain && !isExcluded;
}
