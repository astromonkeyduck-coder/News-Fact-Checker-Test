/**
 * Extract Twitter media using headless browser (Puppeteer)
 * This handles tweets that load media dynamically via JavaScript
 */

export interface TwitterMedia {
  images: string[];
  videos: string[];
  primary_image_url?: string;
  video_url?: string;
}

/**
 * Extract media from Twitter using headless browser
 * This executes JavaScript and can extract media from dynamically loaded content
 */
export async function extractTwitterMediaHeadless(tweetUrl: string): Promise<TwitterMedia> {
  const media: TwitterMedia = {
    images: [],
    videos: [],
  };

  try {
    // Check if Puppeteer is available
    let puppeteer: any;
    try {
      puppeteer = require('puppeteer');
    } catch (e) {
      console.warn('[extractTwitterMediaHeadless] Puppeteer not available, falling back to static extraction');
      return media;
    }

    // Launch browser with optimized settings
    const browser = await puppeteer.launch({
      headless: 'new', // Use new headless mode
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });

    try {
      const page = await browser.newPage();
      
      // Set viewport
      await page.setViewport({ width: 1280, height: 720 });
      
      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Navigate to tweet with retry logic
      let navigationSuccess = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await page.goto(tweetUrl, {
            waitUntil: 'domcontentloaded', // Faster than networkidle2
            timeout: 10000,
          });
          navigationSuccess = true;
          break;
        } catch (error: any) {
          if (attempt === 1) throw error;
          console.warn(`[extractTwitterMediaHeadless] Navigation attempt ${attempt + 1} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!navigationSuccess) {
        throw new Error('Failed to navigate to tweet page');
      }

      // Wait a bit for JavaScript to execute
      await page.waitForTimeout(2000);

      // Wait for media to load (check for img elements with pbs.twimg.com)
      // But don't fail if media isn't present
      try {
        await page.waitForFunction(
          () => {
            const imgs = Array.from(document.querySelectorAll('img'));
            return imgs.some(img => img.src && img.src.includes('pbs.twimg.com/media'));
          },
          { timeout: 5000 }
        );
      } catch (e) {
        // Media might not be present, continue anyway
        console.log('[extractTwitterMediaHeadless] No media found in timeout, continuing...');
      }

      // Extract media URLs from the rendered page
      const extractedMedia = await page.evaluate(() => {
        const images: string[] = [];
        const videos: string[] = [];
        const seen = new Set<string>();

        // Find all img elements
        const imgElements = Array.from(document.querySelectorAll('img'));
        for (const img of imgElements) {
          const src = img.src || img.getAttribute('src');
          if (src && src.includes('pbs.twimg.com/media')) {
            // Extract media ID and construct full URL
            const match = src.match(/pbs\.twimg\.com\/media\/([A-Za-z0-9_-]+)/);
            if (match) {
              const mediaId = match[1];
              const fullUrl = `https://pbs.twimg.com/media/${mediaId}?format=jpg&name=large`;
              if (!seen.has(fullUrl)) {
                images.push(fullUrl);
                seen.add(fullUrl);
              }
            } else if (!seen.has(src)) {
              // Use src directly if it's already a full URL
              images.push(src);
              seen.add(src);
            }
          }
        }

        // Find all video elements
        const videoElements = Array.from(document.querySelectorAll('video'));
        for (const video of videoElements) {
          const src = video.src || video.getAttribute('src');
          if (src && !seen.has(src)) {
            videos.push(src);
            seen.add(src);
          }
        }

        // Also check for video sources
        const sourceElements = Array.from(document.querySelectorAll('video source'));
        for (const source of sourceElements) {
          const src = source.src || source.getAttribute('src');
          if (src && !seen.has(src)) {
            videos.push(src);
            seen.add(src);
          }
        }

        // Look for media in data attributes
        const elementsWithData = Array.from(document.querySelectorAll('[data-image-url], [data-media-url], [data-src]'));
        for (const el of elementsWithData) {
          const url = el.getAttribute('data-image-url') || 
                     el.getAttribute('data-media-url') || 
                     el.getAttribute('data-src');
          if (url && url.includes('pbs.twimg.com/media') && !seen.has(url)) {
            const match = url.match(/pbs\.twimg\.com\/media\/([A-Za-z0-9_-]+)/);
            if (match) {
              const mediaId = match[1];
              const fullUrl = `https://pbs.twimg.com/media/${mediaId}?format=jpg&name=large`;
              if (!seen.has(fullUrl)) {
                images.push(fullUrl);
                seen.add(fullUrl);
              }
            }
          }
        }

        return { images, videos };
      });

      media.images = extractedMedia.images;
      media.videos = extractedMedia.videos;
      media.primary_image_url = extractedMedia.images[0];
      media.video_url = extractedMedia.videos[0];

    } finally {
      await browser.close();
    }

  } catch (error: any) {
    console.error('[extractTwitterMediaHeadless] Error:', error.message);
    // Return empty media on error
  }

  return media;
}
