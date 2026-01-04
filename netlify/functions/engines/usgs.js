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
 * Extract two DISTINCT USGS images from event detail
 * Ensures images are from different product types when possible
 * Priority order (for immediate availability):
 * 1. Immediate products (DYFI, basic maps) - available within 0-3 minutes
 * 2. Shakemap products - available within 5-10 minutes (best quality)
 * 3. Other products - fallback
 */
function extractUSGSImages(eventDetail) {
  const images = [];
  const usedProductTypes = new Set(); // Track which product types we've used
  const usedFilenames = new Set(); // Track filenames to avoid duplicates
  
  if (!eventDetail || !eventDetail.properties || !eventDetail.properties.products) {
    return images;
  }
  
  const products = eventDetail.properties.products;
  
  // Priority 1: Immediate products (DYFI, basic maps) - available within 0-3 minutes
  const immediateProductTypes = ['dyfi', 'origin', 'location', 'moment-tensor'];
  
  // Priority 2: Shakemap products - available within 5-10 minutes (best quality)
  const shakemapProducts = products.shakemap || [];
  
  // Priority 3: All other products (fallback)
  const otherProductTypes = Object.keys(products)
    .filter(key => !immediateProductTypes.includes(key) && key !== 'shakemap');
  
  // Strategy: Try to get one image from each product type to ensure they're different
  // First pass: Get one image from each immediate product type
  for (const productType of immediateProductTypes) {
    if (images.length >= 2) break;
    
    const productList = products[productType] || [];
    for (const product of productList) {
      if (images.length >= 2) break;
      
      if (product.contents && typeof product.contents === 'object') {
        for (const [key, content] of Object.entries(product.contents)) {
          if (content.url && /\.(png|jpg|jpeg|gif)$/i.test(key)) {
              // Skip if we already have an image from this product type (unless we only have 1 image)
            if (images.length === 0 || !usedProductTypes.has(productType)) {
              // Extract base filename (remove common variants like _geo, _geo_, etc.)
              let baseFilename = key
                .replace(/_geo\.(jpg|png|jpeg|gif)$/i, '.$1')
                .replace(/_geo_/gi, '_')
                .replace(/_(geo|map|plot|image)\./gi, '.')
                .toLowerCase();
              
              // Also check if any existing image has a similar base name
              const isSimilar = images.some(img => {
                const existingBase = img.filename
                  .replace(/_geo\.(jpg|png|jpeg|gif)$/i, '.$1')
                  .replace(/_geo_/gi, '_')
                  .replace(/_(geo|map|plot|image)\./gi, '.')
                  .toLowerCase();
                return existingBase === baseFilename || 
                       (baseFilename.includes(existingBase.split('_')[0]) && 
                        existingBase.includes(baseFilename.split('_')[0]));
              });
              
              if (!isSimilar && !usedFilenames.has(baseFilename) && !images.find(img => img.url === content.url)) {
                images.push({
                  url: content.url,
                  type: productType,
                  filename: key,
                });
                usedProductTypes.add(productType);
                usedFilenames.add(baseFilename);
                break; // Move to next product type
              }
            }
          }
        }
      }
    }
  }
  
  // Second pass: If we only have 1 image, try to get a shakemap (different type)
  if (images.length < 2) {
    for (const product of shakemapProducts) {
      if (images.length >= 2) break;
      
      if (product.contents && typeof product.contents === 'object') {
        for (const [key, content] of Object.entries(product.contents)) {
          if (content.url && /\.(png|jpg|jpeg|gif)$/i.test(key)) {
            let baseFilename = key
              .replace(/_geo\.(jpg|png|jpeg|gif)$/i, '.$1')
              .replace(/_geo_/gi, '_')
              .replace(/_(geo|map|plot|image)\./gi, '.')
              .toLowerCase();
            
            const isSimilar = images.some(img => {
              const existingBase = img.filename
                .replace(/_geo\.(jpg|png|jpeg|gif)$/i, '.$1')
                .replace(/_geo_/gi, '_')
                .replace(/_(geo|map|plot|image)\./gi, '.')
                .toLowerCase();
              return existingBase === baseFilename || 
                     (baseFilename.includes(existingBase.split('_')[0]) && 
                      existingBase.includes(baseFilename.split('_')[0]));
            });
            
            if (!isSimilar && !usedFilenames.has(baseFilename) && !images.find(img => img.url === content.url)) {
              images.push({
                url: content.url,
                type: 'shakemap',
                filename: key,
              });
              usedProductTypes.add('shakemap');
              usedFilenames.add(baseFilename);
              if (images.length >= 2) break;
            }
          }
        }
      }
    }
  }
  
  // Third pass: If we still don't have 2, look in other products (ensuring different types)
  if (images.length < 2) {
    for (const productType of otherProductTypes) {
      if (images.length >= 2) break;
      
      // Skip if we already have an image from this product type
      if (usedProductTypes.has(productType)) continue;
      
      const productList = products[productType] || [];
      for (const product of productList) {
        if (images.length >= 2) break;
        
        if (product.contents && typeof product.contents === 'object') {
          for (const [key, content] of Object.entries(product.contents)) {
            if (content.url && /\.(png|jpg|jpeg|gif)$/i.test(key)) {
              let baseFilename = key
                .replace(/_geo\.(jpg|png|jpeg|gif)$/i, '.$1')
                .replace(/_geo_/gi, '_')
                .replace(/_(geo|map|plot|image)\./gi, '.')
                .toLowerCase();
              
              const isSimilar = images.some(img => {
                const existingBase = img.filename
                  .replace(/_geo\.(jpg|png|jpeg|gif)$/i, '.$1')
                  .replace(/_geo_/gi, '_')
                  .replace(/_(geo|map|plot|image)\./gi, '.')
                  .toLowerCase();
                return existingBase === baseFilename || 
                       (baseFilename.includes(existingBase.split('_')[0]) && 
                        existingBase.includes(baseFilename.split('_')[0]));
              });
              
              if (!isSimilar && !usedFilenames.has(baseFilename) && !images.find(img => img.url === content.url)) {
                images.push({
                  url: content.url,
                  type: productType,
                  filename: key,
                });
                usedProductTypes.add(productType);
                usedFilenames.add(baseFilename);
                break;
              }
            }
          }
        }
      }
    }
  }
  
  // Final fallback: If we still only have 1 image, get a second one even if from same type
  // (but still avoid duplicate filenames)
  if (images.length === 1) {
    for (const productType of immediateProductTypes) {
      const productList = products[productType] || [];
      for (const product of productList) {
        if (images.length >= 2) break;
        
        if (product.contents && typeof product.contents === 'object') {
          for (const [key, content] of Object.entries(product.contents)) {
            if (content.url && /\.(png|jpg|jpeg|gif)$/i.test(key)) {
              let baseFilename = key
                .replace(/_geo\.(jpg|png|jpeg|gif)$/i, '.$1')
                .replace(/_geo_/gi, '_')
                .replace(/_(geo|map|plot|image)\./gi, '.')
                .toLowerCase();
              
              const isSimilar = images.some(img => {
                const existingBase = img.filename
                  .replace(/_geo\.(jpg|png|jpeg|gif)$/i, '.$1')
                  .replace(/_geo_/gi, '_')
                  .replace(/_(geo|map|plot|image)\./gi, '.')
                  .toLowerCase();
                return existingBase === baseFilename || 
                       (baseFilename.includes(existingBase.split('_')[0]) && 
                        existingBase.includes(baseFilename.split('_')[0]));
              });
              
              if (!isSimilar && !usedFilenames.has(baseFilename) && !images.find(img => img.url === content.url)) {
                images.push({
                  url: content.url,
                  type: productType,
                  filename: key,
                });
                usedFilenames.add(baseFilename);
                break;
              }
            }
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
  if (earthquake.alert_sent) {
    logger.info('Alert already sent for this event', { canonical_id: earthquake.canonical_id });
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
    
    const alertResponse = await fetch(functionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        earthquake: {
          event_id: earthquake.assets?.event_id || earthquake.raw?.id || earthquake.canonical_id?.split(':')[1] || 'unknown',
          magnitude: magnitude, // Use extracted magnitude
          location_display: earthquake.location_display,
          time: earthquake.published_at,
          time_ms: new Date(earthquake.published_at).getTime(),
          usgs_event_url: earthquake.source_url,
        },
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
    // Check if event already exists
    const { data: existing, error: checkError } = await supabase
      .from('verified_events')
      .select('id, alert_sent, alert_sent_at')
      .eq('canonical_id', event.canonical_id)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = not found
      throw checkError;
    }
    
    if (existing) {
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
      return { isNew: false, event: { ...event, ...existing, ...updateData } };
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
  
  // Filter out earthquakes below magnitude 2.5
  if (magnitude < 2.5) {
    logger.debug('Skipping earthquake below magnitude 2.5', { magnitude, eventId });
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
    // USGS images can take 5-10 minutes to appear after earthquake
    // For smaller earthquakes, we'll mark them for retry too (not just 6.0+)
    if (usgsImages.length === 0 && eventDetail) {
      const maxRetries = 3;
      const retryDelays = [5000, 10000, 15000]; // 5s, 10s, 15s (longer waits)
      
      for (let retry = 0; retry < maxRetries && usgsImages.length === 0; retry++) {
        logger.info(`No USGS images found, retry ${retry + 1}/${maxRetries} after ${retryDelays[retry]}ms...`, { eventId });
        await new Promise(resolve => setTimeout(resolve, retryDelays[retry]));
        eventDetail = await fetchEventDetail(detailUrl, logger);
        if (eventDetail) {
          usgsImages = extractUSGSImages(eventDetail);
          if (usgsImages.length > 0) {
            logger.info(`✅ USGS images found on retry ${retry + 1}`, { count: usgsImages.length, eventId });
            break;
          }
        }
      }
    }
    
    // Log final image count
    if (usgsImages.length === 0) {
      logger.warn('⚠️ No USGS images available for earthquake - image will be generated without USGS maps', { 
        eventId, 
        hasDetailUrl: !!detailUrl,
        hasEventDetail: !!eventDetail 
      });
      
      // For magnitude 6.0+, mark for continuous retry until USGS images are found
      // The retry function will check every minute and update the image when USGS images appear
    } else {
      logger.info('USGS images extracted', { count: usgsImages.length, eventId });
    }
  } else {
    logger.warn('⚠️ No detail URL available for earthquake - cannot fetch USGS images', { eventId });
  }
  
  // Generate branded image (will use template's baked-in images if usgsImages is empty)
  // Pass coordinates for instant fallback images when USGS images aren't available yet
  const coordinates = feature.geometry?.coordinates;
  const imageUrl = await generateBrandedImage(magnitude, locationDisplay, usgsImages, eventId, logger, coordinates);
  
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
      event_id: eventId, // Store event_id in assets for email alerts
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
  const { isNew, event: storedEvent } = await storeEvent(event, logger);
  
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
  const hasNewImage = imageUrl && imageUrl !== storedEvent.image_url;
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
    // If forcing email, temporarily reset alert_sent so sendEmailAlert will process it
    const originalAlertSent = storedEvent.alert_sent;
    if (forceEmail && storedEvent.alert_sent) {
      storedEvent.alert_sent = false;
      logger.info('Forcing email for most recent earthquake', { canonical_id: canonicalId });
    }
    
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