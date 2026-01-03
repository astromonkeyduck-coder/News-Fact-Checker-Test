/**
 * Retry USGS Images for High-Magnitude Earthquakes
 * 
 * This function runs every minute to check for earthquakes >= 6.0 that don't have USGS images yet.
 * When USGS images become available, it regenerates the image and updates the post.
 * 
 * Schedule: Every minute (configure in Netlify Dashboard)
 * Cron: * * * * * (every minute)
 */

const supabase = require('./lib/supabaseClient');
const { createLogger } = require('./lib/logger');

// Import USGS image extraction functions
const usgsEngine = require('./engines/usgs');
const fetchEventDetail = usgsEngine.fetchEventDetail;
const extractUSGSImages = usgsEngine.extractUSGSImages;

/**
 * Retry fetching USGS images for pending earthquakes
 */
async function retryUSGSImages() {
  const logger = createLogger('usgs-retry');
  logger.info('Starting USGS image retry check');
  
  try {
    // Find earthquakes >= 6.0 that are pending USGS image retry
    // Fetch all earthquakes >= 6.0 and filter in JavaScript for retry_pending flag
    const { data: allEvents, error: fetchError } = await supabase
      .from('verified_events')
      .select('*')
      .eq('engine', 'usgs')
      .eq('event_type', 'earthquake')
      .gte('assets->magnitude', 6.0)
      .order('published_at', { ascending: false })
      .limit(50); // Fetch more to filter
    
    if (fetchError) {
      logger.error('Failed to fetch events', fetchError);
      return { success: false, error: fetchError.message };
    }
    
    // Filter for events that are pending retry and not yet completed
    const pendingEvents = (allEvents || []).filter(event => {
      const assets = event.assets || {};
      return assets.usgs_retry_pending === true && 
             !assets.usgs_retry_completed_at &&
             assets.magnitude >= 6.0;
    }).slice(0, 10); // Limit to 10 for processing
    
    if (fetchError) {
      logger.error('Failed to fetch pending events', fetchError);
      return { success: false, error: fetchError.message };
    }
    
    if (!pendingEvents || pendingEvents.length === 0) {
      logger.info('No earthquakes pending USGS image retry');
      return { success: true, processed: 0 };
    }
    
    logger.info(`Found ${pendingEvents.length} earthquake(s) pending USGS image retry`);
    
    let processed = 0;
    let updated = 0;
    let errors = 0;
    
    for (const event of pendingEvents) {
      try {
        const eventId = event.assets?.event_id || event.raw?.id;
        const magnitude = event.assets?.magnitude || event.raw?.properties?.mag;
        const detailUrl = event.assets?.usgs_detail_url || event.raw?.properties?.detail;
        const retryCount = (event.assets?.usgs_retry_count || 0) + 1;
        const retryStartedAt = event.assets?.usgs_retry_started_at;
        
        // Check if we've been retrying for too long (max 30 minutes = 30 retries)
        const maxRetries = 30;
        if (retryCount > maxRetries) {
          logger.warn('Max retries reached, stopping retry', { 
            eventId, 
            canonical_id: event.canonical_id,
            retryCount 
          });
          
          // Mark as no longer pending
          await supabase
            .from('verified_events')
            .update({
              assets: {
                ...event.assets,
                usgs_retry_pending: false,
                usgs_retry_stopped_at: new Date().toISOString(),
              }
            })
            .eq('canonical_id', event.canonical_id);
          
          continue;
        }
        
        if (!detailUrl) {
          logger.warn('No detail URL available for retry', { eventId, canonical_id: event.canonical_id });
          continue;
        }
        
        logger.info(`Retry ${retryCount}: Checking for USGS images`, { 
          eventId, 
          canonical_id: event.canonical_id,
          magnitude 
        });
        
        // Fetch event detail
        const eventDetail = await fetchEventDetail(detailUrl, logger);
        if (!eventDetail) {
          logger.warn('Could not fetch event detail', { eventId, detailUrl });
          // Update retry count but keep pending
          await supabase
            .from('verified_events')
            .update({
              assets: {
                ...event.assets,
                usgs_retry_count: retryCount,
              }
            })
            .eq('canonical_id', event.canonical_id);
          continue;
        }
        
        // Extract USGS images
        const usgsImages = extractUSGSImages(eventDetail);
        
        if (usgsImages.length === 0) {
          logger.info(`No USGS images found yet (retry ${retryCount})`, { eventId });
          // Update retry count but keep pending
          await supabase
            .from('verified_events')
            .update({
              assets: {
                ...event.assets,
                usgs_retry_count: retryCount,
              }
            })
            .eq('canonical_id', event.canonical_id);
          continue;
        }
        
        // USGS images found! Regenerate image and update
        logger.info(`✅ USGS images found! Regenerating image with ${usgsImages.length} image(s)`, { 
          eventId, 
          canonical_id: event.canonical_id,
          imageCount: usgsImages.length 
        });
        
        // Get location and coordinates for image generation
        const location = event.location_display || 'Unknown Location';
        const coordinates = event.lon && event.lat ? [event.lon, event.lat] : null;
        
        // Regenerate image with USGS images
        const baseUrl = process.env.URL || 'https://noteworthynews.co';
        const imageResponse = await fetch(`${baseUrl}/.netlify/functions/generate-earthquake-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            magnitude,
            location,
            usgsImages,
            eventId,
            coordinates,
          }),
        });
        
        if (!imageResponse.ok) {
          const errorText = await imageResponse.text().catch(() => 'Unknown error');
          logger.warn('Failed to regenerate image with USGS images', { 
            eventId, 
            status: imageResponse.status,
            error: errorText.substring(0, 200)
          });
          errors++;
          continue;
        }
        
        const imageData = await imageResponse.json();
        const newImageUrl = imageData.url;
        
        logger.info('Image regenerated with USGS images', { 
          eventId, 
          canonical_id: event.canonical_id,
          imageUrl: newImageUrl 
        });
        
        // Update event with new image and mark retry as complete
        await supabase
          .from('verified_events')
          .update({
            image_url: newImageUrl,
            assets: {
              ...event.assets,
              usgs_images: usgsImages,
              usgs_retry_pending: false,
              usgs_retry_completed_at: new Date().toISOString(),
              usgs_retry_count: retryCount,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('canonical_id', event.canonical_id);
        
        // Update the website post with new image
        try {
          const { createPostFromEvent } = require('./lib/createPost');
          await createPostFromEvent(
            { ...event, image_url: newImageUrl, assets: { ...event.assets, usgs_images: usgsImages } },
            'Earthquake',
            'USGS'
          );
          logger.info('Website post updated with USGS images', { 
            eventId, 
            canonical_id: event.canonical_id 
          });
        } catch (postError) {
          logger.warn('Failed to update website post', postError, { eventId });
        }
        
        updated++;
        processed++;
        
      } catch (error) {
        logger.error('Error processing retry', error, { 
          eventId: event.assets?.event_id,
          canonical_id: event.canonical_id 
        });
        errors++;
      }
    }
    
    logger.info('USGS image retry complete', { 
      processed, 
      updated, 
      errors,
      total: pendingEvents.length 
    });
    
    return { 
      success: true, 
      processed, 
      updated, 
      errors,
      total: pendingEvents.length 
    };
    
  } catch (error) {
    logger.error('Fatal error in USGS image retry', error);
    return { success: false, error: error.message };
  }
}

/**
 * Main handler
 */
exports.handler = async (event, context) => {
  const logger = createLogger('usgs-retry');
  
  try {
    const result = await retryUSGSImages();
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: result.success,
        processed: result.processed || 0,
        updated: result.updated || 0,
        errors: result.errors || 0,
        message: result.error || 'Retry check complete',
      }),
    };
  } catch (error) {
    logger.error('Handler error', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
      }),
    };
  }
};

// Scheduled function configuration
exports.config = {
  schedule: '* * * * *', // Every minute
};

