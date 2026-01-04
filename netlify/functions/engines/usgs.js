/**
 * USGS Engine - Earthquake Ingestion
 * Fetches earthquakes from USGS, normalizes into verified_events, generates images, sends alerts
 * 
 * Stage 3 Implementation
 */

const supabase = require('../lib/supabaseClient');
const { buildCanonicalId } = require('../lib/dedupe');
const { normalizeEarthquakeSeverity, cleanLocation } = require('../lib/normalize');
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
 * Fetch detailed event data from USGS
 */
async function fetchEventDetail(detailUrl, logger) {
  if (!detailUrl) return null;
  
  try {
    const response = await fetch(detailUrl);
    if (!response.ok) {
      logger.warn('Failed to fetch event detail', { url: detailUrl, status: response.status });
      return null;
    }
    return await response.json();
  } catch (error) {
    logger.warn('Error fetching event detail', error, { url: detailUrl });
    return null;
  }
}

/**
 * Extract USGS images from event detail
 * IMPROVED: More comprehensive search, less restrictive matching
 * Priority order (for immediate availability):
 * 1. Shakemap products - best quality maps (available within 5-10 minutes)
 * 2. Immediate products (DYFI, origin, location) - available within 0-3 minutes
 * 3. All other products - comprehensive fallback
 */
function extractUSGSImages(eventDetail) {
  const images = [];
  const usedUrls = new Set(); // Track URLs to avoid exact duplicates
  
  if (!eventDetail || !eventDetail.properties || !eventDetail.properties.products) {
    return images;
  }
  
  const products = eventDetail.properties.products;
  
  // Helper function to check if a key looks like an image
  const isImageKey = (key) => {
    const lowerKey = key.toLowerCase();
    return /\.(png|jpg|jpeg|gif|webp)$/i.test(key) || 
           lowerKey.includes('image') || 
           lowerKey.includes('map') || 
           lowerKey.includes('plot') ||
           lowerKey.includes('shakemap') ||
           lowerKey.includes('intensity') ||
           lowerKey.includes('contour');
  };
  
  // Helper function to extract images from a product
  const extractFromProduct = (product, productType) => {
    if (!product || !product.contents) return;
    
    for (const [key, content] of Object.entries(product.contents)) {
      if (!content || !content.url) continue;
      
      // Check if this looks like an image
      if (isImageKey(key)) {
        const url = content.url;
        
        // Skip if we already have this exact URL
        if (usedUrls.has(url)) continue;
        
        // Skip if URL doesn't look like an image
        if (!/\.(png|jpg|jpeg|gif|webp)/i.test(url)) continue;
        
                images.push({
          url: url,
                  type: productType,
                  filename: key,
                });
        usedUrls.add(url);
        
        // Stop after finding 2 images
        if (images.length >= 2) return true;
      }
    }
    return false;
  };
  
  // Priority order: Shakemap first (best quality), then immediate products, then everything else
  // Strategy: Search ALL products comprehensively, just avoid exact duplicate URLs
  
  // Priority 1: Shakemap products (best quality maps)
  const shakemapProducts = products.shakemap || [];
    for (const product of shakemapProducts) {
    if (extractFromProduct(product, 'shakemap')) break;
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
  
  // Final pass: If we still need more images, search everything again (less restrictive)
  if (images.length < 2) {
    for (const productType of Object.keys(products)) {
      if (images.length >= 2) break;
      const productList = products[productType] || [];
      for (const product of productList) {
        if (!product || !product.contents) continue;
        
          for (const [key, content] of Object.entries(product.contents)) {
          if (images.length >= 2) break;
          if (!content || !content.url) continue;
          
          // Very permissive: any image-like URL
          if (/\.(png|jpg|jpeg|gif|webp)/i.test(content.url) && !usedUrls.has(content.url)) {
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
  
  return images.slice(0, 2); // Return max 2 images
}

/**
 * Generate branded image for earthquake
 */
async function generateBrandedImage(magnitude, location, usgsImages, eventId, logger, coordinates = null) {
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
          hasCoordinates: !!coordinates,
        });
        
        // Note: generateImage no longer accepts coordinates parameter (user removed fallback images)
        const imageBuffer = await generateImage(magnitude, location, usgsImages || [], eventId);
        imageUrl = await storeImage(imageBuffer, eventId);
        logger.info('Branded image generated via direct call', { url: imageUrl });
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
          // Note: coordinates removed - user removed fallback image generation
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
  // NOTE: This check is bypassed when forceEmail is true (alert_sent is reset before calling this function)
  logger.info('📧 sendEmailAlert called', {
    canonical_id: earthquake.canonical_id,
    alert_sent: earthquake.alert_sent,
    hasImageUrl: !!imageUrl
  });
  
  if (earthquake.alert_sent) {
    logger.warn('⚠️ Alert already sent for this event - returning early', { 
      canonical_id: earthquake.canonical_id,
      alert_sent: earthquake.alert_sent
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
    
    // Extract depth from event
    const depth = earthquake.depth || earthquake.assets?.depth || earthquake.raw?.geometry?.coordinates?.[2] || null;
    
    // Build complete earthquake object with all data needed for email template
    const earthquakeData = {
          event_id: earthquake.assets?.event_id || earthquake.raw?.id || earthquake.canonical_id?.split(':')[1] || 'unknown',
          magnitude: magnitude, // Use extracted magnitude
          location_display: earthquake.location_display,
          time: earthquake.published_at,
          time_ms: new Date(earthquake.published_at).getTime(),
          usgs_event_url: earthquake.source_url,
      // Add coordinates for map generation
      lat: earthquake.lat || null,
      lon: earthquake.lon || null,
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
  const locationDisplay = cleanLocation(place);
  const severity = normalizeEarthquakeSeverity(magnitude);
  
  // Build canonical ID
  const canonicalId = buildCanonicalId('usgs', eventId);
  
  // Fetch event detail for images
  // CRITICAL: We MUST have at least one image, so retry if needed
  const detailUrl = props.detail;
  let eventDetail = null;
  let usgsImages = [];
  
  if (detailUrl) {
    // Try fetching event detail (images may take a few minutes to appear)
    eventDetail = await fetchEventDetail(detailUrl, logger);
    if (eventDetail) {
      usgsImages = extractUSGSImages(eventDetail);
    }
    
    // If no images found, retry multiple times with increasing delays
    // USGS images can take 5-15 minutes to appear after earthquake, especially for smaller ones
    // For smaller earthquakes (< 5.0), use shorter retries to avoid timeout
    // For larger earthquakes (>= 5.0), use longer retries as images are more likely
    if (usgsImages.length === 0 && eventDetail) {
      const isLargeEarthquake = magnitude >= 5.0;
      const maxRetries = isLargeEarthquake ? 3 : 2; // Fewer retries for small earthquakes
      const retryDelays = isLargeEarthquake 
        ? [5000, 10000, 15000]  // 5s, 10s, 15s for large earthquakes (total: 30s)
        : [3000, 5000];          // 3s, 5s for small earthquakes (total: 8s)
      
      // Calculate total retry time to ensure we don't timeout
      const totalRetryTime = retryDelays.reduce((sum, delay) => sum + delay, 0);
      const maxFunctionTime = 55000; // Leave 5s buffer before 60s timeout
      
      if (totalRetryTime > maxFunctionTime) {
        logger.warn('Retry delays too long, reducing to prevent timeout', { 
          eventId, 
          magnitude, 
          totalRetryTime,
          maxFunctionTime 
        });
        // Use shorter delays if calculated time is too long
        const adjustedDelays = isLargeEarthquake ? [5000, 10000] : [3000, 5000];
        retryDelays.splice(0, retryDelays.length, ...adjustedDelays);
      }
      
      for (let retry = 0; retry < maxRetries && usgsImages.length === 0; retry++) {
        logger.info(`No USGS images found, retry ${retry + 1}/${maxRetries} after ${retryDelays[retry]/1000}s...`, { eventId, magnitude });
        await new Promise(resolve => setTimeout(resolve, retryDelays[retry]));
        
        // Try fetching again
        eventDetail = await fetchEventDetail(detailUrl, logger);
        if (eventDetail) {
          usgsImages = extractUSGSImages(eventDetail);
          if (usgsImages.length > 0) {
            logger.info(`✅ USGS images found on retry ${retry + 1}`, { count: usgsImages.length, eventId });
            break;
          } else {
            // Log what products are available for debugging
            const availableProducts = eventDetail?.properties?.products ? Object.keys(eventDetail.properties.products) : [];
            logger.debug(`Retry ${retry + 1}: Still no images, available products: ${availableProducts.join(', ')}`, { eventId });
          }
        }
      }
    }
    
    // Log final image count with detailed diagnostics
    if (usgsImages.length === 0) {
      // Log what products are available for debugging
      const availableProducts = eventDetail?.properties?.products ? Object.keys(eventDetail.properties.products) : [];
      const productCounts = {};
      if (eventDetail?.properties?.products) {
        for (const [key, productList] of Object.entries(eventDetail.properties.products)) {
          productCounts[key] = Array.isArray(productList) ? productList.length : 0;
        }
      }
      
      logger.warn('⚠️ No USGS images available for earthquake - image will be generated without USGS maps', { 
        eventId, 
        hasDetailUrl: !!detailUrl,
        hasEventDetail: !!eventDetail,
        availableProducts: availableProducts,
        productCounts: productCounts,
        detailUrl: detailUrl
      });
      
      // For magnitude 6.0+, mark for continuous retry until USGS images are found
      // The retry function will check every minute and update the image when USGS images appear
    } else {
      logger.info('USGS images extracted', { count: usgsImages.length, eventId });
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
  const coordinates = feature.geometry?.coordinates;
  
  // Threshold set to 0.5
  const IMAGE_GENERATION_THRESHOLD = 0.5;
  
  if (magnitude >= IMAGE_GENERATION_THRESHOLD) {
    // Only generate new image if:
    // 1. Event doesn't exist yet (new earthquake)
    // 2. Event exists but has no image
    // 3. USGS images are now available (were empty before, now have images)
    const existingUsgsImages = existingEvent?.assets?.usgs_images || [];
    const shouldGenerateNewImage = !existingEvent || 
                                   !existingEvent.image_url || 
                                   (existingUsgsImages.length === 0 && usgsImages.length > 0);
    
    if (shouldGenerateNewImage) {
  // Generate branded image (will use template's baked-in images if usgsImages is empty)
      imageUrl = await generateBrandedImage(magnitude, locationDisplay, usgsImages, eventId, logger, coordinates);
      logger.info('Image generation completed', { magnitude, hasImage: !!imageUrl, eventId, reason: !existingEvent ? 'new_earthquake' : !existingEvent.image_url ? 'no_existing_image' : 'usgs_images_now_available' });
    } else {
      // Reuse existing image
      imageUrl = existingEvent.image_url;
      logger.info('Reusing existing image', { magnitude, eventId, imageUrl: imageUrl?.substring(0, 100) });
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
  // Send if: it's new, OR alert hasn't been sent yet, OR it's the most recent earthquake (forceEmail)
  // OR if we just generated a new image (imageUrl exists and is different from stored)
  // Use the hasNewImage flag from storeEvent which compares BEFORE updating
  const hasNewImage = imageWasNew || (imageUrl && !storedEvent.image_url);
  const shouldSendEmail = isNew || !storedEvent.alert_sent || forceEmail || hasNewImage;
  
  logger.info('Checking email alert conditions', {
    canonical_id: canonicalId,
    alert_sent: storedEvent.alert_sent,
    isNew,
    forceEmail,
    hasNewImage,
    hasImageUrl: !!imageUrl,
    storedImageUrl: storedEvent.image_url,
    will_send: shouldSendEmail
  });
  
  if (shouldSendEmail) {
    // If forceEmail is true, always send (even if already sent)
    // This ensures the most recent earthquake always gets an email
    const originalAlertSent = storedEvent.alert_sent;
    
    if (forceEmail && storedEvent.alert_sent) {
      // Temporarily reset alert_sent to allow email to be sent
      storedEvent.alert_sent = false;
      logger.info('Forcing email for most recent earthquake', { 
        canonical_id: canonicalId,
        reason: forceEmail ? 'most_recent_earthquake' : (isNew ? 'new_earthquake' : 'new_image')
      });
    }
    
    logger.info('🚀 SENDING EMAIL ALERT', {
      canonical_id: canonicalId,
      forceEmail,
      isNew,
      hasNewImage,
      alert_sent_before: originalAlertSent,
      alert_sent_after_reset: storedEvent.alert_sent,
      hasImageUrl: !!imageUrl
    });
    
    const alertSent = await sendEmailAlert(storedEvent, imageUrl, logger);
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

module.exports = {
  run,
  fetchEventDetail,
  extractUSGSImages,
};