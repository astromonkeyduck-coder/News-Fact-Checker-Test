/**
 * USGS Engine - Earthquake Ingestion
 * Fetches earthquakes from USGS, normalizes into verified_events, generates images, sends alerts
 * 
 * Stage 3 Implementation
 */

const supabase = require('../lib/supabaseClient');
const { buildCanonicalId } = require('../lib/dedupe');
const { normalizeEarthquakeSeverity, cleanLocation, enhanceLocationWithGeocoding } = require('../lib/normalize');
const { createPostFromEvent } = require('../lib/createPost');
const { assessEarthquakeImpact } = require('../lib/impactAssessment');
const { assessTsunamiRisk } = require('../lib/tsunamiAssessment');
const { predictAftershocks } = require('../lib/aftershockModeling');
const { detectAnomalies } = require('../lib/anomalyDetection');

// USGS GeoJSON feed URLs
const USGS_FEEDS = {
  all_hour: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson',
  all_day: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
};

/**
 * Check if we're in dry run mode
 */
function isDryRun() {
  return process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1';
}

/**
 * Fetch USGS earthquake feed
 */
async function fetchUSGSFeed(feedType = 'all_hour', logger) {
  const url = USGS_FEEDS[feedType] || USGS_FEEDS.all_hour;
  logger.info('Fetching USGS feed', { feed_type: feedType, url });
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`USGS API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    logger.error('Failed to fetch USGS feed', error);
    throw error;
  }
}

/**
 * Fetch detailed event data from USGS GeoJSON detail endpoint
 * PHASE 1: Primary method for getting event data (replaces HTML scraping)
 */
async function fetchUsgsDetailGeoJson({ eventId, detailUrl, logger }) {
  // If detailUrl provided, use it; otherwise construct from eventId
  let url = detailUrl;
  if (!url && eventId) {
    url = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/${eventId}.geojson`;
  }
  
  if (!url) {
    if (logger) logger.warn('No detailUrl or eventId provided for GeoJSON fetch');
    return null;
  }
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NoteworthyNews/1.0)',
        'Accept': 'application/geo+json, application/json'
      }
    });
    
    if (!response.ok) {
      if (logger) logger.warn('Failed to fetch USGS detail GeoJSON', { url, status: response.status });
      return null;
    }
    
    const json = await response.json();
    if (logger) logger.info('✅ Fetched USGS detail GeoJSON', { eventId, url, hasProperties: !!json.properties });
    return json;
  } catch (error) {
    if (logger) logger.warn('Error fetching USGS detail GeoJSON', { error: error.message, url, eventId });
    return null;
  }
}

/**
 * Fetch detailed event data from USGS (legacy wrapper for backward compatibility)
 */
async function fetchEventDetail(detailUrl, logger) {
  if (!detailUrl) return null;
  return fetchUsgsDetailGeoJson({ detailUrl, logger });
}

/**
 * Extract USGS product images from GeoJSON detail
 * PHASE 1: Primary extraction method using products.contents
 * Returns array of image candidates with metadata for ranking
 * 
 * EXPORTED: Single source of truth for product extraction
 */
function extractUsgsProductImages(detailJson) {
  const candidates = [];
  
  if (!detailJson || !detailJson.properties || !detailJson.properties.products) {
    return candidates;
  }
  
  const products = detailJson.properties.products;
  
  // Priority order: shakemap > dyfi > losspager/pager > others
  const productPriority = {
    'shakemap': 1,
    'dyfi': 2,
    'losspager': 3,
    'pager': 3,
    'origin': 4,
    'location': 4,
    'moment-tensor': 5,
    'focal-mechanism': 5
  };
  
  // Path preference keywords (best first)
  const pathPreference = ['intensity', 'mmi', 'pga', 'pgv', 'map', 'plot'];
  
  // Helper to score a path
  function scorePath(path) {
    const lowerPath = path.toLowerCase();
    for (let i = 0; i < pathPreference.length; i++) {
      if (lowerPath.includes(pathPreference[i])) {
        return pathPreference.length - i; // Higher score = better
      }
    }
    return 0;
  }
  
  // Helper to check if content is an image
  function isImageContent(content) {
    if (!content || !content.url) return false;
    
    // Check contentType
    if (content.contentType && content.contentType.startsWith('image/')) {
      return true;
    }
    
    // Check URL extension
    const url = content.url.toLowerCase();
    if (/\.(png|jpg|jpeg|gif|webp)(\?|$)/.test(url)) {
      // Exclude known non-image patterns
      if (url.includes('.xml') || url.includes('.json') || url.includes('.txt') ||
          url.includes('/contents') || url.includes('/metadata') || url.includes('/attenuation')) {
        return false;
      }
      return true;
    }
    
    return false;
  }
  
  // Process each product type
  for (const [productType, productList] of Object.entries(products)) {
    if (!Array.isArray(productList) || productList.length === 0) continue;
    
    const priority = productPriority[productType] || 999;
    
    // For each product instance, find the "best" one
    for (const product of productList) {
      if (!product || !product.contents || typeof product.contents !== 'object') continue;
      
      // Get preferred weight and update time for ranking
      const preferredWeight = product.preferredWeight || 0;
      const updateTime = product.updateTime || 0;
      
      // Extract all image contents from this product
      for (const [path, content] of Object.entries(product.contents)) {
        if (!isImageContent(content)) continue;
        
        // Skip if we already have this exact URL
        const url = content.url;
        if (candidates.some(c => c.url === url)) continue;
        
        // Calculate score: priority (lower is better) + path preference + preferredWeight
        const pathScore = scorePath(path);
        const candidateScore = priority * 1000 - pathScore * 10 - preferredWeight;
        
        candidates.push({
          url: url,
          contentType: content.contentType || 'image/jpeg',
          productType: productType,
          path: path,
          updateTime: updateTime,
          weight: preferredWeight,
          score: candidateScore,
          productId: product.id
        });
      }
    }
  }
  
  // Sort by score (lower score = higher priority), then by updateTime (newer first)
  candidates.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return b.updateTime - a.updateTime;
  });
  
  // Return top 6 candidates (we only need 2, but want fallback options)
  return candidates.slice(0, 6);
}

/**
 * Extract USGS images from event detail (legacy wrapper for backward compatibility)
 * PHASE 1: Now uses extractUsgsProductImages internally
 */
function extractUSGSImages(eventDetail) {
  // Use new extraction method
  const candidates = extractUsgsProductImages(eventDetail);
  
  // Handle case where extractUsgsProductImages returns undefined or null
  if (!candidates || !Array.isArray(candidates)) {
    return [];
  }
  
  // Convert to legacy format
  const images = candidates.map(c => ({
    url: c.url,
    type: c.productType,
    filename: c.path || 'unknown'
  }));
  
  // Legacy code below kept for reference but now uses new method above
  /* LEGACY CODE - NOW USING extractUsgsProductImages ABOVE
  const images = [];
  const usedUrls = new Set(); // Track URLs to avoid exact duplicates
  
  if (!eventDetail || !eventDetail.properties || !eventDetail.properties.products) {
    return images;
  }
  
  const products = eventDetail.properties.products;
  
  // Helper function to check if a key looks like an image
  // STRICT: Must have actual image file extension
  const isImageKey = (key) => {
    const lowerKey = key.toLowerCase();
    // MUST have image extension - no exceptions
    if (!/\.(png|jpg|jpeg|gif|webp)$/i.test(key)) {
      return false;
    }
    // Exclude known non-image files even if they have image-like extensions
    if (lowerKey.includes('.xml') || lowerKey.includes('.json') || 
        lowerKey.includes('.txt') || lowerKey.includes('contents') ||
        lowerKey.includes('metadata') || lowerKey.includes('attenuation')) {
      return false;
    }
    return true;
  };
  
  // Helper function to check if URL is definitely an image
  const isDefinitelyImageUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    const lowerUrl = url.toLowerCase();
    
    // MUST have image file extension
    if (!/\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(url)) {
      return false;
    }
    
    // Exclude known non-image file patterns
    if (lowerUrl.includes('.xml') || lowerUrl.includes('.json') || 
        lowerUrl.includes('.txt') || lowerUrl.includes('/contents') ||
        lowerUrl.includes('/metadata') || lowerUrl.includes('/attenuation') ||
        lowerUrl.includes('contents.xml') || lowerUrl.includes('attenuation_curves')) {
      return false;
    }
    
    return true;
  };
  
  // Helper function to construct shakemap image URLs
  // USGS shakemap products often have images at predictable URLs
  const constructShakemapImageUrls = (product) => {
    const constructedUrls = [];
    if (!product || !product.id || !product.updateTime) return constructedUrls;
    
    // Extract event ID from product ID (format: us7000xxxxx)
    const eventIdMatch = product.id.match(/^(us|ak|ci|nc|nn|pr|tx)\d+/);
    if (!eventIdMatch) return constructedUrls;
    
    const eventId = eventIdMatch[0];
    const timestamp = product.updateTime;
    
    // Common shakemap image types
    const imageTypes = [
      'intensity.jpg',
      'pga.jpg',
      'pgv.jpg',
      'mmi.jpg',
      'intensity.png',
      'pga.png',
      'pgv.png',
      'mmi.png'
    ];
    
    // Try to construct URLs for common shakemap image paths
    const baseUrl = `https://earthquake.usgs.gov/realtime/product/shakemap/${eventId}/us/${timestamp}/download/`;
    
    for (const imageType of imageTypes) {
      const url = baseUrl + imageType;
      if (!usedUrls.has(url)) {
        constructedUrls.push({
          url: url,
          type: 'shakemap-constructed',
          filename: imageType,
          constructed: true
        });
      }
    }
    
    return constructedUrls;
  };
  
  // Helper function to extract images from a product
  const extractFromProduct = (product, productType) => {
    if (!product) return false;
    
    let foundAny = false;
    
    // Check if product has contents (most common case)
      if (product.contents && typeof product.contents === 'object') {
        for (const [key, content] of Object.entries(product.contents)) {
        if (!content || !content.url) continue;
        
        const url = content.url;
        
        // Skip if we already have this exact URL
        if (usedUrls.has(url)) continue;
        
        // STRICT: Must be a real image file - check both URL and key
        const isImageUrl = isDefinitelyImageUrl(url) && isImageKey(key);
        
        if (isImageUrl) {
                images.push({
            url: url,
                  type: productType,
                  filename: key,
                });
          usedUrls.add(url);
          foundAny = true;
          
          // Stop after finding 2 images
          if (images.length >= 2) return true;
        }
      }
    }
    
    // Also check if product has a direct URL (some products might have images at product level)
    if (!foundAny && product.url && typeof product.url === 'string') {
      const url = product.url;
      if (!usedUrls.has(url)) {
        // STRICT: Must be a real image file
        const isImageUrl = isDefinitelyImageUrl(url);
        
        if (isImageUrl) {
          images.push({
            url: url,
            type: productType,
            filename: 'product-url',
          });
          usedUrls.add(url);
          foundAny = true;
          if (images.length >= 2) return true;
        }
      }
    }
    
    return foundAny;
  };
  
  // Priority order: Shakemap first (best quality), then immediate products, then everything else
  // Strategy: Search ALL products comprehensively, just avoid exact duplicate URLs
  
  // Priority 1: Shakemap products (best quality maps)
  const shakemapProducts = products.shakemap || [];
    for (const product of shakemapProducts) {
    // First, try extracting from product contents
    if (extractFromProduct(product, 'shakemap')) {
      if (images.length >= 2) break;
    }
    
    // If we still need images, try constructing URLs from product ID
    // Constructed URLs are potential image locations - they'll be validated during download
    if (images.length < 2) {
      const constructedUrls = constructShakemapImageUrls(product);
      for (const constructedImage of constructedUrls) {
              if (images.length >= 2) break;
        // Only add constructed URLs that look like real image files
        if (isDefinitelyImageUrl(constructedImage.url)) {
          images.push(constructedImage);
          usedUrls.add(constructedImage.url);
        }
      }
      if (images.length >= 2) break;
    }
  }
  
  // Priority 2: Immediate products (available quickly)
  const immediateProductTypes = ['dyfi', 'origin', 'location', 'moment-tensor', 'focal-mechanism'];
  for (const productType of immediateProductTypes) {
              if (images.length >= 2) break;
    const productList = products[productType] || [];
    for (const product of productList) {
      if (extractFromProduct(product, productType)) break;
    }
  }
  
  // Priority 3: All other products (comprehensive search)
  if (images.length < 2) {
    const allProductTypes = Object.keys(products);
    for (const productType of allProductTypes) {
      if (images.length >= 2) break;
      // Skip if we already checked this type
      if (immediateProductTypes.includes(productType) || productType === 'shakemap') continue;
      
      const productList = products[productType] || [];
      for (const product of productList) {
        if (extractFromProduct(product, productType)) break;
      }
    }
  }
  
  // Final pass: If we still need more images, search everything again (STRICT - only real images)
  if (images.length < 2) {
    for (const productType of Object.keys(products)) {
        if (images.length >= 2) break;
      const productList = products[productType] || [];
      for (const product of productList) {
        if (!product || !product.contents) continue;
        
          for (const [key, content] of Object.entries(product.contents)) {
          if (images.length >= 2) break;
          if (!content || !content.url) continue;
          
          // STRICT: Must be a real image file
          if (isDefinitelyImageUrl(content.url) && isImageKey(key) && !usedUrls.has(content.url)) {
                images.push({
                  url: content.url,
                  type: productType,
                  filename: key,
                });
            usedUrls.add(content.url);
          }
        }
      }
    }
  }
  
  // Log what we found for debugging
  if (images.length > 0) {
    console.log(`[extractUSGSImages] ✅ Found ${images.length} USGS image(s):`, 
      images.map(img => ({ type: img.type, filename: img.filename || 'unknown', url: img.url.substring(0, 100) + '...' }))
    );
  } else {
    // Log available products for debugging
    const availableProducts = Object.keys(products);
    const productCounts = {};
    const productDetails = {};
    const productStructures = {};
    
    for (const [key, productList] of Object.entries(products)) {
      productCounts[key] = Array.isArray(productList) ? productList.length : 0;
      
      // Log detailed structure of first product to help debug
      if (Array.isArray(productList) && productList.length > 0) {
        const firstProduct = productList[0];
        productStructures[key] = {
          hasContents: !!firstProduct?.contents,
          contentsType: typeof firstProduct?.contents,
          contentsIsObject: firstProduct?.contents && typeof firstProduct?.contents === 'object',
          contentsKeys: firstProduct?.contents ? Object.keys(firstProduct?.contents).slice(0, 10) : [],
          productKeys: Object.keys(firstProduct).slice(0, 10),
          hasUrl: !!firstProduct?.url,
          hasId: !!firstProduct?.id,
          id: firstProduct?.id?.substring(0, 50)
        };
        
        // Log sample content keys and URLs from first product
        if (firstProduct?.contents && typeof firstProduct.contents === 'object') {
          const contentEntries = Object.entries(firstProduct.contents).slice(0, 10);
          productDetails[key] = {
            sampleKeys: contentEntries.map(([k]) => k),
            sampleUrls: contentEntries
              .filter(([, c]) => c?.url)
              .map(([, c]) => c.url.substring(0, 80))
          };
        }
      }
    }
    
    console.log(`[extractUSGSImages] ⚠️ No images found. Available products:`, {
      productTypes: availableProducts,
      productCounts: productCounts,
      productDetails: productDetails,
      productStructures: productStructures
    });
  }
  
  return images.slice(0, 2); // Return max 2 images
}

/**
 * Scrape USGS images directly from the event page HTML
 * This is a fallback when the API doesn't return images but they're visible on the website
 */
async function scrapeUSGSImagesFromPage(eventPageUrl, logger) {
  if (!eventPageUrl) return [];
  
  try {
    logger.info('🌐 Attempting to scrape images from USGS event page', { url: eventPageUrl });
    
    const response = await fetch(eventPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://earthquake.usgs.gov/'
      }
    });
    
    if (!response.ok) {
      logger.warn('Failed to fetch USGS event page', { url: eventPageUrl, status: response.status });
      return [];
    }
    
    const html = await response.text();
    const images = [];
    const usedUrls = new Set();
    
    logger.debug(`[scrapeUSGSImagesFromPage] HTML length: ${html.length} characters`);
    
    // Extract image URLs from HTML using regex patterns
    // USGS event pages typically have images in:
    // 1. <img> tags with src attributes
    // 2. Background images in style attributes
    // 3. Links to image files
    
    // Helper function to check if URL is definitely an image (same as extractUSGSImages)
    const isDefinitelyImageUrl = (url) => {
      if (!url || typeof url !== 'string') return false;
      const lowerUrl = url.toLowerCase();
      
      // MUST have image file extension
      if (!/\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(url)) {
        return false;
      }
      
      // Exclude known non-image file patterns
      if (lowerUrl.includes('.xml') || lowerUrl.includes('.json') || 
          lowerUrl.includes('.txt') || lowerUrl.includes('/contents') ||
          lowerUrl.includes('/metadata') || lowerUrl.includes('/attenuation') ||
          lowerUrl.includes('contents.xml') || lowerUrl.includes('attenuation_curves')) {
        return false;
      }
      
      return true;
    };
    
    // Pattern 1: <img src="..."> - MOST COMMON (IMPROVED: More flexible matching)
    const imgTagPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;
    let imgCount = 0;
    while ((match = imgTagPattern.exec(html)) !== null && images.length < 10) { // Check more images
      const url = match[1];
      if (url && !usedUrls.has(url)) {
        // More flexible: Accept any image URL that could be from USGS
        const isUSGSImage = url.includes('usgs.gov') || url.includes('earthquake.usgs.gov') || 
                           url.includes('shakemap') || url.includes('intensity') || 
                           url.includes('realtime') || url.includes('product');
        const isImageFile = isDefinitelyImageUrl(url);
        
        if (isUSGSImage && isImageFile) {
          // Convert relative URLs to absolute
          const absoluteUrl = url.startsWith('http') ? url : `https://earthquake.usgs.gov${url.startsWith('/') ? url : '/' + url}`;
          images.push({
            url: absoluteUrl,
            type: 'scraped-html-img',
            filename: `img-${++imgCount}`,
            scraped: true
          });
          usedUrls.add(absoluteUrl);
          logger.debug(`[scrapeUSGSImagesFromPage] Found image via <img> tag: ${absoluteUrl.substring(0, 100)}`);
        }
      }
    }
    
    // Pattern 2: Background images in style attributes (IMPROVED: More patterns)
    const stylePattern = /style=["'][^"']*background-image:\s*url\(["']?([^"')]+)["']?\)/gi;
    while ((match = stylePattern.exec(html)) !== null && images.length < 10) {
      const url = match[1];
      if (url && !usedUrls.has(url)) {
        const isUSGSImage = url.includes('usgs.gov') || url.includes('earthquake.usgs.gov');
        const isImageFile = /\.(png|jpg|jpeg|gif|webp)/i.test(url);
        const hasImageKeywords = /shakemap|intensity|map|plot/i.test(url);
        
        if (isUSGSImage && (isImageFile || hasImageKeywords)) {
          const absoluteUrl = url.startsWith('http') ? url : `https://earthquake.usgs.gov${url.startsWith('/') ? url : '/' + url}`;
          images.push({
            url: absoluteUrl,
            type: 'scraped-html-style',
            filename: 'scraped-from-style',
            scraped: true
          });
          usedUrls.add(absoluteUrl);
          logger.debug(`[scrapeUSGSImagesFromPage] Found image via style background: ${absoluteUrl.substring(0, 100)}`);
        }
      }
    }
    
    // Pattern 3: Direct links to image files in href attributes
    const linkPattern = /<a[^>]+href=["']([^"']+\.(png|jpg|jpeg|gif|webp|svg))["'][^>]*>/gi;
    while ((match = linkPattern.exec(html)) !== null && images.length < 2) {
      const url = match[1];
      if (url && !usedUrls.has(url)) {
        const isUSGSImage = url.includes('usgs.gov') || url.includes('earthquake.usgs.gov');
        if (isUSGSImage) {
          const absoluteUrl = url.startsWith('http') ? url : `https://earthquake.usgs.gov${url.startsWith('/') ? url : '/' + url}`;
          images.push({
            url: absoluteUrl,
            type: 'scraped-html-link',
            filename: 'scraped-from-link',
            scraped: true
          });
          usedUrls.add(absoluteUrl);
          logger.debug(`[scrapeUSGSImagesFromPage] Found image via <a> href: ${absoluteUrl.substring(0, 100)}`);
        }
      }
    }
    
    // Pattern 4: Look for ANY USGS image URLs in the HTML (very permissive)
    // This catches URLs that might be in JavaScript, comments, or anywhere in the HTML
    const usgsImagePattern = /https?:\/\/[^"'\s<>]+(?:usgs\.gov|earthquake\.usgs\.gov)[^"'\s<>]*(?:shakemap|intensity|pga|pgv|mmi|map|plot|image|download)[^"'\s<>]*\.(png|jpg|jpeg|gif|webp)/gi;
    while ((match = usgsImagePattern.exec(html)) !== null && images.length < 2) {
      const url = match[0];
      if (url && !usedUrls.has(url)) {
        images.push({
          url: url,
          type: 'scraped-pattern-match',
          filename: 'scraped-pattern',
          scraped: true
        });
        usedUrls.add(url);
        logger.debug(`[scrapeUSGSImagesFromPage] Found image via pattern match: ${url.substring(0, 100)}`);
      }
    }
    
    // Pattern 4b: Look for shakemap product URLs (IMPROVED: More comprehensive matching)
    const shakemapUrlPattern = /https?:\/\/[^"'\s<>]+(?:usgs\.gov|earthquake\.usgs\.gov)[^"'\s<>]*(?:\/realtime\/product\/shakemap\/|shakemap|intensity|mmi|pga|pgv)[^"'\s<>]*/gi;
    while ((match = shakemapUrlPattern.exec(html)) !== null && images.length < 10) {
      const baseUrl = match[0].replace(/\/$/, ''); // Remove trailing slash
      // EXPANDED: More image types and variations
      const imageExtensions = [
        'intensity.jpg', 'pga.jpg', 'pgv.jpg', 'mmi.jpg', 'psa03.jpg', 'psa10.jpg', 'psa30.jpg',
        'intensity.png', 'pga.png', 'pgv.png', 'mmi.png', 'psa03.png', 'psa10.png', 'psa30.png',
        'intensity_km.jpg', 'pga_km.jpg', 'pgv_km.jpg',
        'download/intensity.jpg', 'download/pga.jpg', 'download/pgv.jpg', 'download/mmi.jpg',
        'download/intensity.png', 'download/pga.png', 'download/pgv.png', 'download/mmi.png'
      ];
      for (const ext of imageExtensions) {
        // Try multiple URL patterns
        const urlPatterns = [
          baseUrl + '/' + ext,
          baseUrl + '/download/' + ext,
          baseUrl.replace(/\/product\/shakemap\/[^\/]+$/, '/product/shakemap/' + ext),
          baseUrl + ext
        ];
        for (const url of urlPatterns) {
          if (!usedUrls.has(url) && isDefinitelyImageUrl(url)) {
            images.push({
              url: url,
              type: 'scraped-shakemap-constructed',
              filename: ext,
              scraped: true,
              constructed: true
            });
            usedUrls.add(url);
            logger.debug(`[scrapeUSGSImagesFromPage] Found constructed shakemap image: ${url.substring(0, 100)}`);
            if (images.length >= 10) break;
          }
        }
        if (images.length >= 10) break;
      }
      if (images.length >= 10) break;
    }
    
    // Pattern 5: Look for data-src, data-lazy-src, data-original (lazy-loaded images)
    const lazyLoadPatterns = [
      /<img[^>]+data-src=["']([^"']+)["'][^>]*>/gi,
      /<img[^>]+data-lazy-src=["']([^"']+)["'][^>]*>/gi,
      /<img[^>]+data-original=["']([^"']+)["'][^>]*>/gi,
      /<img[^>]+data-url=["']([^"']+)["'][^>]*>/gi
    ];
    
    for (const pattern of lazyLoadPatterns) {
      while ((match = pattern.exec(html)) !== null && images.length < 2) {
        const url = match[1];
        if (url && !usedUrls.has(url)) {
          const isUSGSImage = url.includes('usgs.gov') || url.includes('earthquake.usgs.gov');
          const isImageFile = /\.(png|jpg|jpeg|gif|webp)/i.test(url);
          const hasImageKeywords = /shakemap|intensity|map|plot|pga|pgv|mmi/i.test(url);
          
          if (isUSGSImage && (isImageFile || hasImageKeywords)) {
            const absoluteUrl = url.startsWith('http') ? url : `https://earthquake.usgs.gov${url.startsWith('/') ? url : '/' + url}`;
            images.push({
              url: absoluteUrl,
              type: 'scraped-html-lazy',
              filename: 'scraped-from-lazy',
              scraped: true
            });
            usedUrls.add(absoluteUrl);
            logger.debug(`[scrapeUSGSImagesFromPage] Found lazy-loaded image: ${absoluteUrl.substring(0, 100)}`);
          }
        }
      }
    }
    
    // Pattern 6: Look for JSON-LD structured data and any JSON in <script> tags
    const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    while ((match = scriptPattern.exec(html)) !== null && images.length < 2) {
      const scriptContent = match[1];
      // Try to find image URLs in JavaScript/JSON
      const jsonImagePattern = /["'](https?:\/\/[^"']*usgs\.gov[^"']*(?:shakemap|intensity|map|plot|image|download)[^"']*\.(?:png|jpg|jpeg|gif|webp))["']/gi;
      let urlMatch;
      while ((urlMatch = jsonImagePattern.exec(scriptContent)) !== null && images.length < 2) {
        const url = urlMatch[1];
        if (url && !usedUrls.has(url)) {
          images.push({
            url: url,
            type: 'scraped-script-json',
            filename: 'scraped-from-script',
            scraped: true
          });
          usedUrls.add(url);
          logger.debug(`[scrapeUSGSImagesFromPage] Found image in script/JSON: ${url.substring(0, 100)}`);
        }
      }
      
      // Also try parsing as JSON-LD
      if (scriptContent.includes('application/ld+json') || scriptContent.trim().startsWith('{')) {
        try {
          const jsonData = JSON.parse(scriptContent);
          const findImagesInObject = (obj, depth = 0) => {
            if (depth > 10 || !obj || typeof obj !== 'object') return; // Prevent infinite recursion
            for (const [key, value] of Object.entries(obj)) {
              if (key === 'image' || key === 'url' || key === 'contentUrl' || key === 'src') {
                if (typeof value === 'string' && value.includes('usgs.gov')) {
                  const isImageFile = /\.(png|jpg|jpeg|gif|webp)/i.test(value);
                  const hasImageKeywords = /shakemap|intensity|map|plot|pga|pgv|mmi|image|download/i.test(value);
                  if (isImageFile || hasImageKeywords) {
                    const absoluteUrl = value.startsWith('http') ? value : `https://earthquake.usgs.gov${value.startsWith('/') ? value : '/' + value}`;
                    if (!usedUrls.has(absoluteUrl)) {
                      images.push({
                        url: absoluteUrl,
                        type: 'scraped-json-ld',
                        filename: 'scraped-from-json-ld',
                        scraped: true
                      });
                      usedUrls.add(absoluteUrl);
                      logger.debug(`[scrapeUSGSImagesFromPage] Found image in JSON-LD: ${absoluteUrl.substring(0, 100)}`);
                      if (images.length >= 2) return;
                    }
                  }
                }
              } else if (typeof value === 'object' && value !== null) {
                findImagesInObject(value, depth + 1);
              }
            }
          };
          findImagesInObject(jsonData);
          if (images.length >= 2) break;
        } catch (e) {
          // Not valid JSON, skip
        }
      }
    }
    
    // Pattern 7: Look for image URLs in any attribute (srcset, data-url, etc.)
    const anyAttributePattern = /(?:src|href|data-src|data-url|data-image|data-lazy|srcset)=["']([^"']*usgs\.gov[^"']*(?:shakemap|intensity|map|plot|image|download)[^"']*\.(?:png|jpg|jpeg|gif|webp))["']/gi;
    while ((match = anyAttributePattern.exec(html)) !== null && images.length < 2) {
      const url = match[1];
      if (url && !usedUrls.has(url)) {
        const absoluteUrl = url.startsWith('http') ? url : `https://earthquake.usgs.gov${url.startsWith('/') ? url : '/' + url}`;
        images.push({
          url: absoluteUrl,
          type: 'scraped-attribute',
          filename: 'scraped-from-attribute',
          scraped: true
        });
        usedUrls.add(absoluteUrl);
        logger.debug(`[scrapeUSGSImagesFromPage] Found image in attribute: ${absoluteUrl.substring(0, 100)}`);
      }
    }
    
    if (images.length > 0) {
      logger.info(`✅ Scraped ${images.length} image(s) from USGS event page`, {
        images: images.map(img => ({
          type: img.type,
          url: img.url.substring(0, 100)
        }))
      });
    } else {
      logger.debug('No images found in USGS event page HTML', { url: eventPageUrl });
    }
  
  // Return up to 10 images (we'll validate and pick the best 2 later)
  // This gives us more options to choose from
  return images.slice(0, 10);
  } catch (error) {
    logger.warn('Error scraping images from USGS event page', {
      error: error.message,
      url: eventPageUrl
    });
    return [];
  }
}

/**
 * Generate branded image for earthquake
 * BUG FIX: Added detailUrl parameter to pass GeoJSON detail URL
 */
async function generateBrandedImage(magnitude, location, usgsImages, eventId, logger, coordinates = null, detailUrl = null) {
  const dryRun = isDryRun();
  
  if (dryRun) {
    logger.info('DRY_RUN: Would generate branded image', { magnitude, location, eventId });
    return null;
  }
  
  try {
    // Try direct function call first (faster, more reliable, no HTTP overhead)
    let imageUrl = null;
    
    try {
      // Direct import and call (works within same Netlify deployment)
      const generateImageModule = require('../generate-earthquake-image');
      const { generateImage, storeImage } = generateImageModule;
      
      if (generateImage && storeImage) {
        logger.info('Using direct function call for image generation', { 
          magnitude,
          location: location.substring(0, 50),
          eventId,
          hasUsgsImages: usgsImages?.length > 0,
          usgsImageCount: usgsImages?.length || 0,
          usgsImagesPreview: usgsImages ? usgsImages.slice(0, 2).map(img => ({
            type: img.type,
            url: img.url?.substring(0, 80)
          })) : [],
          hasCoordinates: !!coordinates,
        });
        
        // Note: generateImage no longer accepts coordinates parameter (user removed fallback images)
        // CRITICAL: Ensure usgsImages is an array
        const usgsImagesArray = Array.isArray(usgsImages) ? usgsImages : (usgsImages ? [usgsImages] : []);
        logger.info('📤 Passing USGS images to generateImage', {
          eventId,
          imageCount: usgsImagesArray.length,
          isArray: Array.isArray(usgsImagesArray),
          images: usgsImagesArray.map(img => ({
            hasUrl: !!img?.url,
            url: img?.url?.substring(0, 100)
          }))
        });
        // PHASE 5: New signature - pass eventId/detailUrl instead of usgsImages
        // The function will fetch GeoJSON detail and extract products internally
        // BUG FIX: Use detailUrl parameter instead of accessing undefined feature
        const imageBuffer = await generateImage(magnitude, location, eventId, 'standard', coordinates, detailUrl);
        imageUrl = await storeImage(imageBuffer, eventId, 'standard');
        logger.info('Branded image generated via direct call', { 
          url: imageUrl,
          eventId,
          imageBufferSize: imageBuffer?.length || 0,
          hasImageUrl: !!imageUrl
        });
        
        // CRITICAL: Verify imageUrl is valid before returning
        if (!imageUrl || imageUrl.trim() === '') {
          logger.error('Image generation returned empty/null URL!', null, { eventId, magnitude });
          return null;
        }
        
        return imageUrl;
      } else {
        logger.info('Direct function call not available (missing exports), using HTTP', { 
          hasGenerateImage: !!generateImage,
          hasStoreImage: !!storeImage,
          magnitude,
          eventId,
        });
      }
    } catch (directCallError) {
      // If direct call fails, fall back to HTTP with detailed error logging
      logger.warn('Direct function call failed, falling back to HTTP', { 
        error: directCallError?.message,
        errorName: directCallError?.name,
        errorStack: directCallError?.stack?.substring(0, 500),
        magnitude,
        eventId,
      });
      console.error('[USGS Engine] Direct function call error:', directCallError);
    }
    
    // Fallback to HTTP call
    let baseUrl = process.env.URL || 'https://noteworthynews.co';
    const functionUrl = `${baseUrl}/.netlify/functions/generate-earthquake-image`;
    
    logger.info('Calling image generation function via HTTP', { 
      url: functionUrl,
      magnitude,
      location: location.substring(0, 50),
      eventId,
      hasUsgsImages: usgsImages?.length > 0,
      hasCoordinates: !!coordinates,
    });
    
    // Add timeout to prevent hanging (30 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    try {
      const imageResponse = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          magnitude,
          location,
          usgsImages,
          eventId,
          coordinates, // [lon, lat, depth] - for location map image generation (with epicenter marker)
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
    
      if (!imageResponse.ok) {
      const errorText = await imageResponse.text().catch(() => 'Unknown error');
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
        
        // Enhanced error logging with full details
        const errorDetails = {
        status: imageResponse.status, 
        statusText: imageResponse.statusText,
          error: errorData.error || errorText,
          errorDetails: errorData.details || errorData.name || errorData.message || null,
          fullError: errorText.substring(0, 1000), // First 1000 chars of error
          url: functionUrl,
          requestBody: {
            magnitude,
            location: location.substring(0, 50),
            eventId,
            hasUsgsImages: usgsImages?.length > 0,
            usgsImageCount: usgsImages?.length || 0,
            hasCoordinates: !!coordinates,
          }
        };
        
        // Log error with full details - use both logger and console for visibility
        logger.error('Image generation failed', null, errorDetails);
        console.error('[USGS Engine] ❌ Image generation failed:');
        console.error(JSON.stringify(errorDetails, null, 2));
        console.error('[USGS Engine] Full error response (first 2000 chars):', errorText.substring(0, 2000));
        return null;
      }
    
    const imageData = await imageResponse.json();
    logger.info('Branded image generated', { url: imageData.url });
    return imageData.url;
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        logger.error('Image generation timed out after 30 seconds', null, {
          url: functionUrl,
          magnitude,
          eventId,
        });
      } else {
        logger.error('Image generation fetch error', fetchError, {
          url: functionUrl,
          magnitude,
          eventId,
          errorMessage: fetchError?.message,
          errorName: fetchError?.name,
        });
      }
      return null;
    }
  } catch (error) {
    logger.error('Image generation error', error, { 
      message: error?.message,
      stack: error?.stack,
      magnitude,
      eventId,
    });
    return null;
  }
}

/**
 * Send email alert for ALL earthquakes
 * Uses HTTP call to send-earthquake-alert function which handles image attachments
 */
async function sendEmailAlert(earthquake, imageUrl, logger) {
  const dryRun = isDryRun();
  
  // Extract magnitude from event - it might be in earthquake.magnitude, assets.magnitude, or raw.properties.mag
  let magnitude = earthquake.magnitude;
  if (!magnitude && earthquake.assets?.magnitude) {
    magnitude = earthquake.assets.magnitude;
  }
  if (!magnitude && earthquake.raw?.properties?.mag) {
    magnitude = earthquake.raw.properties.mag;
  }
  if (!magnitude) {
    logger.error('Cannot send email: magnitude not found in event', null, { canonical_id: earthquake.canonical_id });
    return false;
  }
  
  // Send email for ALL earthquakes (user requested)
  // Removed magnitude >= 7.0 check - now sends for all
  
  // Check if alert already sent
  // CRITICAL: Always check alert_sent to prevent duplicates
  // This is a final safety check even if forceEmail was used
  logger.info('📧 sendEmailAlert called', {
    canonical_id: earthquake.canonical_id,
    alert_sent: earthquake.alert_sent,
    hasImageUrl: !!imageUrl
  });
  
  if (earthquake.alert_sent) {
    logger.warn('⚠️ Alert already sent for this event - preventing duplicate email', { 
      canonical_id: earthquake.canonical_id,
      alert_sent: earthquake.alert_sent,
      reason: 'duplicate_prevention_final_check'
    });
    return false;
  }
  
  if (dryRun) {
    logger.info('DRY_RUN: Would send email alert', {
      magnitude,
      location: earthquake.location_display,
      canonical_id: earthquake.canonical_id,
    });
    return false;
  }
  
  try {
    // Use the site URL or fallback to noteworthynews.co
    const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://noteworthynews.co';
    const functionUrl = `${baseUrl}/.netlify/functions/send-earthquake-alert`;
    
    logger.info('Sending email alert', { 
      url: functionUrl,
      magnitude,
      location: earthquake.location_display,
      has_image: !!imageUrl
    });
    
    // Extract depth from event (check multiple locations)
    const depth = earthquake.depth || earthquake.assets?.depth || earthquake.raw?.geometry?.coordinates?.[2] || null;
    
    // Extract coordinates if not at top level
    const lat = earthquake.lat || earthquake.raw?.geometry?.coordinates?.[1] || null;
    const lon = earthquake.lon || earthquake.raw?.geometry?.coordinates?.[0] || null;
    
    // Log what we're extracting for debugging
    logger.info('Extracting earthquake data for email', {
      canonical_id: earthquake.canonical_id,
      hasLat: !!lat,
      hasLon: !!lon,
      hasDepth: !!depth,
      hasAssets: !!earthquake.assets,
      assetKeys: earthquake.assets ? Object.keys(earthquake.assets) : [],
      hasRaw: !!earthquake.raw,
      rawGeometry: earthquake.raw?.geometry ? 'present' : 'missing'
    });
    
    // Build complete earthquake object with all data needed for email template
    const earthquakeData = {
          event_id: earthquake.assets?.event_id || earthquake.raw?.id || earthquake.canonical_id?.split(':')[1] || 'unknown',
          magnitude: magnitude, // Use extracted magnitude
          location_display: earthquake.location_display,
          time: earthquake.published_at,
          time_ms: new Date(earthquake.published_at).getTime(),
          usgs_event_url: earthquake.source_url,
      // Add coordinates for map generation (with fallback to raw geometry)
      lat: lat,
      lon: lon,
      // Add depth for display
      depth: depth,
      // Add assets for all Tier features (impact assessment, tsunami risk, etc.)
      assets: earthquake.assets || {},
    };
    
    logger.info('Sending email alert with full earthquake data', { 
      magnitude,
      location: earthquake.location_display,
      hasLat: !!earthquakeData.lat,
      hasLon: !!earthquakeData.lon,
      hasDepth: !!earthquakeData.depth,
      hasAssets: !!earthquakeData.assets && Object.keys(earthquakeData.assets).length > 0,
      assetKeys: earthquakeData.assets ? Object.keys(earthquakeData.assets) : [],
    });
    
    const alertResponse = await fetch(functionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        earthquake: earthquakeData,
        imageUrl,
      }),
    });
    
    if (!alertResponse.ok) {
      const errorText = await alertResponse.text();
      logger.error('Alert send failed', null, { 
        status: alertResponse.status, 
        statusText: alertResponse.statusText,
        error: errorText,
        url: functionUrl
      });
      return false;
    }
    
    const result = await alertResponse.json();
    logger.info('Email alert sent successfully', { 
      magnitude, 
      location: earthquake.location_display,
      result: result.message || 'success'
    });
    return true;
  } catch (error) {
    logger.error('Alert send error', error, { 
      canonical_id: earthquake.canonical_id,
      magnitude,
      location: earthquake.location_display
    });
    return false;
  }
}

/**
 * Store or update event in verified_events
 */
async function storeEvent(event, logger) {
  try {
    // Check if event already exists - need image_url to detect new images
    const { data: existing, error: checkError } = await supabase
      .from('verified_events')
      .select('id, alert_sent, alert_sent_at, image_url')
      .eq('canonical_id', event.canonical_id)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = not found
      throw checkError;
    }
    
    if (existing) {
      // Check if image is new BEFORE updating
      const hasNewImage = event.image_url && event.image_url !== existing.image_url;
      
      // Update existing event
      const updateData = {
        title: event.title,
        summary: event.summary,
        severity: event.severity,
        location_display: event.location_display,
        lat: event.lat,
        lon: event.lon,
        geobox: event.geobox,
        updated_at_source: event.updated_at_source,
        fetched_at: event.fetched_at,
        status: event.status,
        tags: event.tags,
        assets: event.assets, // Includes magnitude
        raw: event.raw,
      };
      
      // Update image_url if we have a new one
      if (event.image_url) {
        updateData.image_url = event.image_url;
      }
      
      // Preserve alert_sent status (always preserve, whether true or false)
      updateData.alert_sent = existing.alert_sent || false;
      if (existing.alert_sent_at) {
        updateData.alert_sent_at = existing.alert_sent_at;
      }
      
      const { error: updateError } = await supabase
        .from('verified_events')
        .update(updateData)
        .eq('canonical_id', event.canonical_id);
      
      if (updateError) {
        throw updateError;
      }
      
      // Merge all fields: existing (from DB) + updateData + original event fields (for completeness)
      // Include hasNewImage flag for use in email logic
      return { isNew: false, hasNewImage, event: { ...event, ...existing, ...updateData } };
    } else {
      // Insert new event
      const { data: inserted, error: insertError } = await supabase
        .from('verified_events')
        .insert(event)
        .select()
        .single();
      
      if (insertError) {
        throw insertError;
      }
      
      return { isNew: true, event: inserted };
    }
  } catch (error) {
    logger.error('Failed to store event', error, { canonical_id: event.canonical_id });
    throw error;
  }
}
}

/**
 * Process a single earthquake feature
 * @param {Object} feature - USGS GeoJSON feature
 * @param {Object} logger - Logger instance
 * @param {boolean} forceEmail - If true, send email even if alert_sent is true (for most recent earthquake)
 */
async function processEarthquake(feature, logger, forceEmail = false) {
  const props = feature.properties;
  const eventId = feature.id;
  
  if (!eventId || !props.title) {
    logger.warn('Skipping invalid earthquake feature', null, { eventId, hasTitle: !!props.title });
    return null;
  }
  
  const magnitude = props.mag || 0;
  
  // Process earthquakes >= 0.5
  // Images will only be generated if magnitude >= 0.5 (see below)
  if (magnitude < 0.5) {
    logger.debug('Skipping earthquake below magnitude 0.5', { magnitude, eventId });
    return null;
  }
  
  const place = props.place || 'Unknown Location';
  const time = props.time || Date.now();
  
  // Extract coordinates for enhanced location geocoding and location map generation
  const coordinates = feature.geometry?.coordinates; // [lon, lat, depth]
  // Use nullish coalescing to preserve valid 0 values (prime meridian/equator)
  const lat = coordinates?.[1] ?? null;
  const lon = coordinates?.[0] ?? null;
  const hasCoordinates = lat != null && lon != null;
  
  // Use enhanced location with reverse geocoding for more accurate location
  let locationDisplay = cleanLocation(place);
  let locationEnglishName = null;
  // Check for null/undefined, not falsy (0 is a valid coordinate)
  if (lat != null && lon != null) {
    try {
      const locationData = await enhanceLocationWithGeocoding(place, lat, lon);
      // Handle both old string format and new object format for backward compatibility
      if (typeof locationData === 'string') {
        locationDisplay = locationData;
      } else {
        locationDisplay = locationData.location;
        locationEnglishName = locationData.englishName;
      }
      logger.info('📍 Enhanced location with geocoding', {
        original: place,
        enhanced: locationDisplay,
        englishName: locationEnglishName,
        lat,
        lon
      });
    } catch (error) {
      logger.warn('⚠️ Location geocoding failed, using cleaned location', {
        error: error.message,
        fallback: locationDisplay
      });
    }
  }
  
  const severity = normalizeEarthquakeSeverity(magnitude);
  
  // Build canonical ID
  const canonicalId = buildCanonicalId('usgs', eventId);
  
  // Fetch event detail for images
  // CRITICAL: We MUST have at least one image, so retry if needed
  const detailUrl = props.detail;
  let eventDetail = null;
  
  // ARCHITECTURE CHANGE: HTML scraping REMOVED to prevent cross-event contamination
  // Images must come ONLY from eventId's GeoJSON detail products (event-locked)
  // This ensures no images from other earthquakes can leak in
  logger.info('🔒 EVENT-LOCKED: Using ONLY GeoJSON detail products (HTML scraping disabled)', { eventId, detailUrl });
  
  let usgsImages = [];
  
  // PRIORITY 1: Extract USGS images from API products ONLY (event-locked via detailUrl)
  if (detailUrl) {
    logger.info('🔄 PRIORITY 1: Extracting images from GeoJSON detail products (event-locked)');
    // Try fetching event detail (images may take a few minutes to appear)
    eventDetail = await fetchEventDetail(detailUrl, logger);
    if (eventDetail) {
      const extractedImages = extractUSGSImages(eventDetail);
      // Ensure usgsImages is always an array
      usgsImages = Array.isArray(extractedImages) ? extractedImages : [];
      logger.info('📸 USGS images extracted from API', {
        eventId,
        imageCount: usgsImages.length,
        images: usgsImages.map(img => ({
          type: img.type,
          filename: img.filename,
          url: img.url?.substring(0, 100),
          constructed: img.constructed || false
        }))
      });
    } else {
      logger.warn('⚠️ No event detail available for image extraction', { eventId, detailUrl });
    }
    
    // ARCHITECTURE CHANGE: No retries with HTML scraping fallback
    // If API products don't have images, use fallback maps (no cross-event contamination)
    // USGS images can take 5-15 minutes to appear, but we won't use wrong images
    if (usgsImages.length === 0) {
      const availableProducts = eventDetail?.properties?.products ? Object.keys(eventDetail.properties.products) : [];
      const productCounts = {};
      if (eventDetail?.properties?.products) {
        for (const [key, productList] of Object.entries(eventDetail.properties.products)) {
          productCounts[key] = Array.isArray(productList) ? productList.length : 0;
        }
      }
      
      logger.warn('⚠️ No USGS images available for earthquake - will use fallback maps', { 
        eventId, 
        hasDetailUrl: !!detailUrl,
        hasEventDetail: !!eventDetail,
        availableProducts: availableProducts,
        productCounts: productCounts,
        detailUrl: detailUrl,
        reason: 'No image products found in GeoJSON (event-locked)'
      });
    } else {
      // FORENSIC LOGGING: Log extracted images with event binding verification
      logger.info('✅ USGS images extracted (event-locked)', { 
        count: usgsImages.length, 
        eventId,
        imageDetails: usgsImages.map(img => ({
          type: img.type,
          url: img.url,
          filename: img.filename,
          eventIdInUrl: img.url?.toLowerCase().includes(eventId?.toLowerCase() || '')
        }))
      });
    }
  } else {
    logger.warn('⚠️ No detail URL available for earthquake - cannot fetch USGS images', { eventId });
  }
  
  // Check if event already exists to avoid regenerating images unnecessarily
  const { data: existingEvent } = await supabase
    .from('verified_events')
    .select('image_url, assets')
    .eq('canonical_id', canonicalId)
    .single();
  
  // Generate branded image ONLY if magnitude meets requirements (>= 0.5)
  // Lower magnitude earthquakes are processed but won't get images
  let imageUrl = null;
  // Coordinates already extracted above for geocoding
  
  // Threshold set to 0.5
  const IMAGE_GENERATION_THRESHOLD = 0.5;
  
  if (magnitude >= IMAGE_GENERATION_THRESHOLD) {
    // Only generate new image if:
    // 1. Event doesn't exist yet (new earthquake)
    // 2. Event exists but has no image
    // 3. USGS images are now available (were empty before, now have images)
      // 4. CRITICAL: If we have coordinates but no USGS images, regenerate to add location map (with epicenter marker)
    const existingUsgsImages = existingEvent?.assets?.usgs_images || [];
    // Use the hasCoordinates variable declared at line 791 (outer scope)
    const shouldGenerateNewImage = !existingEvent || 
                                   !existingEvent.image_url || 
                                   (existingUsgsImages.length === 0 && usgsImages.length > 0) ||
                                   // Regenerate if we have coordinates but no USGS images (to add location map with epicenter marker)
                                   (hasCoordinates && usgsImages.length === 0 && existingUsgsImages.length === 0);
    
    if (shouldGenerateNewImage) {
  // Generate branded image (will use template's baked-in images if usgsImages is empty)
      logger.info('🚀 Starting image generation', { 
        magnitude, 
        eventId, 
        location: locationDisplay.substring(0, 50),
        hasUsgsImages: usgsImages?.length > 0,
        usgsImageCount: usgsImages?.length || 0,
        reason: !existingEvent ? 'new_earthquake' : !existingEvent.image_url ? 'no_existing_image' : 'usgs_images_now_available'
      });
      
      // CRITICAL: Log what images we're passing to image generation
      logger.info('📤 Passing USGS images to image generator', {
        eventId,
        imageCount: usgsImages.length,
        hasImages: usgsImages.length > 0,
        images: usgsImages.map(img => ({
          type: img.type,
          url: img.url?.substring(0, 100),
          filename: img.filename,
          scraped: img.scraped || false,
          constructed: img.constructed || false
        })),
        hasCoordinates: !!coordinates,
        coordinates: coordinates ? [coordinates[0], coordinates[1]] : null
      });
      
      // BUG FIX: Pass detailUrl to generateBrandedImage (extracted at line 1303)
      imageUrl = await generateBrandedImage(magnitude, locationDisplay, usgsImages, eventId, logger, coordinates, detailUrl);
      
      // CRITICAL: Verify imageUrl was actually generated
      if (!imageUrl || imageUrl.trim() === '') {
        logger.error('❌ Image generation returned empty/null URL!', null, { 
          eventId, 
          magnitude,
          imageUrl,
          imageUrlType: typeof imageUrl,
          reason: 'generateBrandedImage returned invalid URL'
        });
        imageUrl = null; // Explicitly set to null if invalid
      } else {
        logger.info('✅ Image generation successful', { 
          eventId,
          magnitude,
          imageUrl: imageUrl.substring(0, 100),
          imageUrlLength: imageUrl.length,
          reason: !existingEvent ? 'new_earthquake' : !existingEvent.image_url ? 'no_existing_image' : 'usgs_images_now_available'
        });
        
        // Generate video with visual effects for social media (only for significant earthquakes)
        if (magnitude >= 4.0) {
          try {
            logger.info('🎬 Starting video generation for social media preview', { eventId, magnitude });
            const baseUrl = process.env.URL || 'https://noteworthynews.co';
            const videoResponse = await fetch(`${baseUrl}/.netlify/functions/generate-earthquake-video`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                magnitude,
                location: locationDisplay,
                eventId,
                lat,
                lon,
                usgsImages: usgsImages || []
              }),
            });
            
            if (videoResponse.ok) {
              const videoData = await videoResponse.json();
              if (videoData.url) {
                logger.info('✅ Video generation successful', { eventId, videoUrl: videoData.url });
                // Store video URL in event (will be added to post)
                event.video_url = videoData.url;
              }
            } else {
              logger.warn('⚠️ Video generation failed (non-critical)', { eventId, status: videoResponse.status });
            }
          } catch (videoError) {
            logger.warn('⚠️ Video generation error (non-critical)', videoError, { eventId });
            // Don't fail the entire process if video generation fails
          }
        }
      }
    } else {
      // Reuse existing image
      imageUrl = existingEvent.image_url;
      logger.info('Reusing existing image', { 
        magnitude, 
        eventId, 
        imageUrl: imageUrl?.substring(0, 100),
        hasImageUrl: !!imageUrl,
        imageUrlLength: imageUrl?.length || 0
      });
      
      // Validate existing image URL
      if (!imageUrl || imageUrl.trim() === '') {
        logger.warn('⚠️ Existing image URL is empty/null, will send email without image', { eventId });
        imageUrl = null;
      }
    }
  } else {
    logger.info(`Skipping image generation - magnitude below ${IMAGE_GENERATION_THRESHOLD} threshold`, { magnitude, eventId });
  }
  
  // Perform impact assessment, tsunami risk assessment, aftershock prediction, and anomaly detection
  let impactAssessment = null;
  let tsunamiAssessment = null;
  let aftershockForecast = null;
  let anomalyDetection = null;
  const depth = feature.geometry?.coordinates?.[2] || null;
  
  // Calculate aftershock forecast (doesn't require coordinates)
  try {
    const timeSinceMainShock = (Date.now() - time) / (1000 * 60 * 60); // hours
    aftershockForecast = predictAftershocks(magnitude, timeSinceMainShock);
    logger.info('Aftershock forecast generated', { 
      eventId, 
      probability24h: aftershockForecast.probability24h,
      expectedLargest: aftershockForecast.expectedLargestAftershock 
    });
  } catch (aftershockError) {
    logger.warn('Failed to generate aftershock forecast', aftershockError, { eventId });
  }
  
  if (coordinates && coordinates[1] && coordinates[0]) {
    try {
      logger.info('Assessing earthquake impact, tsunami risk, and anomalies', { eventId, magnitude, depth, lat: coordinates[1], lon: coordinates[0] });
      
      // Run assessments in parallel
      const [impact, tsunami, anomalies] = await Promise.allSettled([
        assessEarthquakeImpact(magnitude, depth, coordinates[1], coordinates[0]),
        assessTsunamiRisk(magnitude, depth, coordinates[1], coordinates[0]),
        detectAnomalies(magnitude, depth, coordinates[1], coordinates[0], time),
      ]);
      
      if (impact.status === 'fulfilled') {
        impactAssessment = impact.value;
        logger.info('Impact assessment completed', { 
          eventId, 
          riskScore: impactAssessment?.riskScore,
          severity: impactAssessment?.severity,
          affectedPopulation: impactAssessment?.affectedPopulation 
        });
      }
      
      if (tsunami.status === 'fulfilled') {
        tsunamiAssessment = tsunami.value;
        if (tsunamiAssessment?.riskLevel === 'HIGH') {
          logger.warn('⚠️ HIGH TSUNAMI RISK DETECTED', { 
            eventId, 
            riskLevel: tsunamiAssessment.riskLevel,
            riskScore: tsunamiAssessment.riskScore 
          });
        } else {
          logger.info('Tsunami risk assessment completed', { 
            eventId, 
            riskLevel: tsunamiAssessment?.riskLevel 
          });
        }
      }
      
      if (anomalies.status === 'fulfilled') {
        anomalyDetection = anomalies.value;
        if (anomalyDetection?.anomalyLevel === 'HIGH') {
          logger.warn('⚠️ HIGH ANOMALY LEVEL DETECTED', { 
            eventId, 
            anomalyLevel: anomalyDetection.anomalyLevel,
            anomalyScore: anomalyDetection.anomalyScore,
            anomalies: anomalyDetection.anomalies.map(a => a.type).join(', ')
          });
        } else if (anomalyDetection?.anomalies?.length > 0) {
          logger.info('Anomaly detection completed', { 
            eventId, 
            anomalyLevel: anomalyDetection.anomalyLevel,
            anomalyCount: anomalyDetection.anomalies.length
          });
        }
      }
    } catch (assessmentError) {
      logger.warn('Failed to assess earthquake', assessmentError, { eventId });
      // Continue without assessments
    }
  }
  
  // Build event object
  const event = {
    canonical_id: canonicalId,
    engine: 'usgs',
    event_type: 'earthquake',
    // Note: event_id is stored in raw JSONB and assets, not as a separate column
    severity,
    title: `M${magnitude.toFixed(1)} Earthquake Near ${locationDisplay}`,
    summary: `A magnitude ${magnitude.toFixed(1)} earthquake was detected by the U.S. Geological Survey near ${locationDisplay}.`,
    location_display: locationDisplay,
    // Note: location_english_name is stored in assets, not as a separate column (column doesn't exist in schema)
    country_code: null, // Can be enhanced with geocoding
    lat: coordinates ? coordinates[1] : null,
    lon: coordinates ? coordinates[0] : null,
    geobox: null, // Can be enhanced if available
    source_name: 'USGS',
    source_url: props.url || `https://earthquake.usgs.gov/earthquakes/eventpage/${eventId}`,
    published_at: new Date(time).toISOString(),
    updated_at_source: props.updated ? new Date(props.updated).toISOString() : null,
    fetched_at: new Date().toISOString(),
    status: 'active',
    tags: ['earthquake', `magnitude_${Math.floor(magnitude)}`, 'disaster', 'breaking'],
    assets: {
      usgs_images: usgsImages,
      magnitude: magnitude, // Store magnitude in assets for easy access
      depth: depth, // Store depth in assets for 3D visualization
      event_id: eventId, // Store event_id in assets for email alerts
      location_english_name: locationEnglishName || null, // English translation for non-English locations
      // Impact assessment data
      ...(impactAssessment ? {
        impact_assessment: impactAssessment,
      } : {}),
      // Tsunami risk assessment
      ...(tsunamiAssessment ? {
        tsunami_assessment: tsunamiAssessment,
      } : {}),
      // Aftershock forecast
      ...(aftershockForecast ? {
        aftershock_forecast: aftershockForecast,
      } : {}),
      // Anomaly detection
      ...(anomalyDetection ? {
        anomaly_detection: anomalyDetection,
      } : {}),
      // For magnitude 6.0+, mark for continuous retry if no USGS images found
      // This allows the retry-usgs-images function to check every minute until images appear
      ...(magnitude >= 6.0 && usgsImages.length === 0 && detailUrl ? {
        usgs_retry_pending: true,
        usgs_retry_started_at: new Date().toISOString(),
        usgs_retry_count: 0,
        usgs_detail_url: detailUrl,
      } : {}),
      // Store detail URL for all earthquakes so we can retry later if needed
      ...(detailUrl ? { usgs_detail_url: detailUrl } : {}),
    },
    image_url: imageUrl,
    alert_sent: false,
    alert_sent_at: null,
    raw: feature,
  };
  
  // Store event
  const { isNew, hasNewImage: imageWasNew, event: storedEvent } = await storeEvent(event, logger);
  
  // Create website post for earthquakes with images
  // Always create/update post if we have an image (for most recent earthquake or new earthquakes)
  if (imageUrl || isNew || forceEmail) {
    try {
      const postResult = await createPostFromEvent(storedEvent, 'Earthquake', 'USGS');
      if (postResult.exists) {
        if (postResult.updated) {
          logger.info('Website post updated with image', { canonical_id: canonicalId, image_url: storedEvent.image_url });
        } else {
          logger.info('Website post already exists', { canonical_id: canonicalId, has_image: !!storedEvent.image_url });
        }
      } else {
        logger.info('Website post created', { canonical_id: canonicalId, image_url: storedEvent.image_url });
      }
    } catch (postError) {
      logger.warn('Failed to create website post', postError);
    }
  }
  
  // Send email alert for ALL earthquakes (user requested)
  // Removed magnitude >= 7.0 check - now sends for all
  // Send if: it's new, OR alert hasn't been sent yet, OR if we just generated a new image
  // CRITICAL: forceEmail should ONLY send if it's a NEW earthquake, not re-send for existing ones
  // Use the hasNewImage flag from storeEvent which compares BEFORE updating
  const hasNewImage = imageWasNew || (imageUrl && !storedEvent.image_url);
  
  // Only send email if:
  // 1. It's a new earthquake (isNew)
  // 2. Alert hasn't been sent yet (!storedEvent.alert_sent) - forceEmail ensures we check this
  // 3. There's a new image (hasNewImage)
  // CRITICAL: Never send if alert_sent is true UNLESS there's a new image
  const shouldSendEmail = isNew || !storedEvent.alert_sent || hasNewImage;
  
  logger.info('Checking email alert conditions', {
    canonical_id: canonicalId,
    alert_sent: storedEvent.alert_sent,
    isNew,
    forceEmail,
    hasNewImage,
    hasImageUrl: !!imageUrl,
    storedImageUrl: storedEvent.image_url,
    will_send: shouldSendEmail,
    reason: isNew ? 'new_earthquake' : (!storedEvent.alert_sent ? 'not_sent_yet' : (hasNewImage ? 'new_image' : 'duplicate_prevented'))
  });
  
  if (shouldSendEmail) {
    // CRITICAL: Double-check to prevent duplicates
    // If alert was already sent and there's no new information, don't send again
    if (storedEvent.alert_sent && !isNew && !hasNewImage) {
      logger.info('Skipping duplicate email - already sent and no new information', {
        canonical_id: canonicalId,
        alert_sent: storedEvent.alert_sent,
        isNew,
        hasNewImage,
        forceEmail,
        reason: 'duplicate_prevention'
      });
      return storedEvent;
    }
    
    // Only force email if it hasn't been sent yet
    // This prevents duplicate emails for the same earthquake
    const originalAlertSent = storedEvent.alert_sent;
    
    // Note: forceEmail is now handled in shouldSendEmail condition above
    // This check is informational only - forceEmail ensures new earthquakes get emails
    if (forceEmail && !storedEvent.alert_sent) {
      logger.info('Forcing email for most recent earthquake (not sent yet)', { 
        canonical_id: canonicalId,
        reason: 'most_recent_earthquake_not_sent'
      });
    }
    
    logger.info('🚀 SENDING EMAIL ALERT', {
      canonical_id: canonicalId,
      forceEmail,
      isNew,
      hasNewImage,
      alert_sent_before: originalAlertSent,
      alert_sent_after_reset: storedEvent.alert_sent,
      hasImageUrl: !!imageUrl,
      storedEventHasLat: !!storedEvent.lat,
      storedEventHasLon: !!storedEvent.lon,
      storedEventHasDepth: !!(storedEvent.depth || storedEvent.assets?.depth),
      storedEventHasAssets: !!storedEvent.assets,
      storedEventAssetKeys: storedEvent.assets ? Object.keys(storedEvent.assets) : []
    });
    
    // Ensure storedEvent has all necessary fields (fallback to raw data if missing)
    // CRITICAL: send-earthquake-alert expects these fields at top level
    const enrichedEvent = {
      ...storedEvent,
      // Ensure magnitude is at top level (needed for email template)
      magnitude: storedEvent.assets?.magnitude || storedEvent.raw?.properties?.mag || magnitude || null,
      // Ensure lat/lon are present (fallback to raw geometry)
      lat: storedEvent.lat || storedEvent.raw?.geometry?.coordinates?.[1] || null,
      lon: storedEvent.lon || storedEvent.raw?.geometry?.coordinates?.[0] || null,
      // Ensure depth is at top level (fallback to assets or raw)
      depth: storedEvent.depth || storedEvent.assets?.depth || storedEvent.raw?.geometry?.coordinates?.[2] || null,
      // Ensure assets object exists
      assets: storedEvent.assets || {},
      // Ensure location_display exists
      location_display: storedEvent.location_display || storedEvent.raw?.properties?.place || 'Unknown Location',
      // Ensure published_at exists
      published_at: storedEvent.published_at || storedEvent.raw?.properties?.time ? new Date(storedEvent.raw.properties.time).toISOString() : new Date().toISOString(),
      // Ensure time_ms exists (needed for email time formatting)
      time_ms: storedEvent.published_at ? new Date(storedEvent.published_at).getTime() : (storedEvent.raw?.properties?.time ? new Date(storedEvent.raw.properties.time).getTime() : Date.now()),
      // Ensure time exists (fallback for email time formatting)
      time: storedEvent.published_at || (storedEvent.raw?.properties?.time ? new Date(storedEvent.raw.properties.time).toISOString() : new Date().toISOString()),
      // Ensure event_id exists (needed for image filename)
      event_id: storedEvent.assets?.event_id || storedEvent.raw?.id || eventId || 'unknown',
      // Ensure source_url exists
      source_url: storedEvent.source_url || storedEvent.raw?.properties?.url || null,
      // Ensure usgs_event_url exists (alias for source_url)
      usgs_event_url: storedEvent.source_url || storedEvent.raw?.properties?.url || null
    };
    
    logger.info('📦 Enriched event data for email', {
      canonical_id: canonicalId,
      hasMagnitude: !!enrichedEvent.magnitude,
      magnitude: enrichedEvent.magnitude,
      hasLat: !!enrichedEvent.lat,
      hasLon: !!enrichedEvent.lon,
      hasDepth: !!enrichedEvent.depth,
      hasAssets: !!enrichedEvent.assets,
      assetKeys: enrichedEvent.assets ? Object.keys(enrichedEvent.assets) : [],
      hasLocationDisplay: !!enrichedEvent.location_display,
      locationDisplay: enrichedEvent.location_display,
      hasPublishedAt: !!enrichedEvent.published_at,
      hasTimeMs: !!enrichedEvent.time_ms,
      hasEventId: !!enrichedEvent.event_id,
      eventId: enrichedEvent.event_id
    });
    
    // CRITICAL: Log imageUrl status before sending email
    logger.info('📧 About to send email alert', {
      canonical_id: canonicalId,
      hasImageUrl: !!imageUrl,
      imageUrl: imageUrl?.substring(0, 100) || 'null',
      imageUrlLength: imageUrl?.length || 0,
      imageUrlIsEmpty: !imageUrl || imageUrl.trim() === '',
      magnitude: enrichedEvent.magnitude,
      eventId: enrichedEvent.event_id
    });
    
    // If imageUrl is invalid, explicitly set to null
    if (imageUrl && imageUrl.trim() === '') {
      logger.warn('⚠️ imageUrl is empty string, setting to null', { eventId: enrichedEvent.event_id });
      imageUrl = null;
    }
    
    const alertSent = await sendEmailAlert(enrichedEvent, imageUrl, logger);
    if (alertSent) {
      // Update alert_sent status
      await supabase
        .from('verified_events')
        .update({
          alert_sent: true,
          alert_sent_at: new Date().toISOString(),
        })
        .eq('canonical_id', canonicalId);
      
      storedEvent.alert_sent = true;
      storedEvent.alert_sent_at = new Date().toISOString();
    } else if (forceEmail && originalAlertSent) {
      // Restore original status if email failed
      storedEvent.alert_sent = originalAlertSent;
    }
  } else {
    let reason = 'unknown';
    if (storedEvent.alert_sent && !hasNewImage) {
      reason = 'already_sent';
    } else if (!isNew && !hasNewImage) {
      reason = 'not_new';
    } else if (!forceEmail && !hasNewImage) {
      reason = 'not_forced';
    }
    
    logger.info('Email alert skipped', {
      canonical_id: canonicalId,
      reason,
      alert_sent: storedEvent.alert_sent,
      isNew,
      forceEmail,
      hasNewImage,
      hasImageUrl: !!imageUrl,
      storedImageUrl: storedEvent.image_url
    });
  }
  
  return { isNew, event: storedEvent };
}

/**
 * Run USGS engine
 */
async function run(logger) {
  try {
    logger.info('Starting USGS engine run');
    
    // Fetch USGS feed (use all_hour for recent events)
    const feedData = await fetchUSGSFeed('all_hour', logger);
    
    if (!feedData || !feedData.features || !Array.isArray(feedData.features)) {
      logger.warn('No earthquakes found in feed');
      return {
        success: true,
        count_new: 0,
        count_updated: 0,
        count_total_seen: 0,
      };
    }
    
    logger.info('Processing earthquakes', { count: feedData.features.length });
    
    let countNew = 0;
    let countUpdated = 0;
    let countErrors = 0;
    
    // Process each earthquake
    // Always send email for the first (most recent) earthquake, even if alert_sent is true
    for (let i = 0; i < feedData.features.length; i++) {
      const feature = feedData.features[i];
      const isMostRecent = i === 0; // First earthquake is most recent
      const magnitude = feature.properties?.mag || 0;
      
      try {
        // Log before processing to see what we're working with
        logger.info('Processing earthquake', { 
          eventId: feature.id, 
          magnitude, 
          isMostRecent,
          index: i,
          total: feedData.features.length,
          hasTitle: !!feature.properties?.title 
        });
        
        const result = await processEarthquake(feature, logger, isMostRecent);
        if (result) {
          if (result.isNew) {
            countNew++;
            logger.info('New earthquake processed', { 
              canonical_id: result.event.canonical_id,
              magnitude,
              eventId: feature.id 
            });
          } else {
            countUpdated++;
            logger.debug('Earthquake updated', { 
              canonical_id: result.event.canonical_id,
              magnitude,
              eventId: feature.id 
            });
          }
        } else {
          logger.debug('Earthquake not processed (filtered or skipped)', { 
            eventId: feature.id,
            magnitude 
          });
        }
      } catch (error) {
        logger.error('Error processing earthquake', error, { eventId: feature.id });
        countErrors++;
      }
    }
    
    logger.info('USGS engine run completed', {
      total_seen: feedData.features.length,
      new: countNew,
      updated: countUpdated,
      errors: countErrors,
    });
    
    return {
      success: true,
      count_new: countNew,
      count_updated: countUpdated,
      count_total_seen: feedData.features.length,
    };
  } catch (error) {
    logger.error('Fatal error in USGS engine', error);
    return {
      success: false,
      error: error.message,
      count_new: 0,
      count_updated: 0,
      count_total_seen: 0,
    };
  }
}

// PHASE 1: Export new functions
module.exports = {
  fetchUsgsDetailGeoJson,
  extractUsgsProductImages,
  run,
  fetchEventDetail,
  extractUSGSImages,
};
