/**
 * FAA Engine - Airspace Alerts
 * Fetches NOTAMs and airspace restrictions from FAA
 * Creates posts and sends alerts for notable airspace events
 */

const supabase = require('../lib/supabaseClient');
const { buildCanonicalId, buildCanonicalIdFromHash } = require('../lib/dedupe');
const { normalizeAirspaceSeverity, cleanLocation } = require('../lib/normalize');
const { createPostFromEvent } = require('../lib/createPost');
const { sendEventAlert } = require('../lib/sendAlert');

// FAA NOTAM API (using public NOTAM feed)
// Note: FAA doesn't have a simple public JSON API, so we'll use a simplified approach
const FAA_NOTAM_URL = 'https://notams.aim.faa.gov/notamSearch/ns4.html';

/**
 * Check if we're in dry run mode
 */
function isDryRun() {
  return process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1';
}

/**
 * Fetch FAA NOTAMs
 * Uses Aviation Weather Center API for NOTAM data
 */
async function fetchFAANOTAMs(logger) {
  try {
    // Aviation Weather Center provides NOTAM data
    // For now, we'll use a simplified approach since FAA requires authentication
    // In production, integrate with FAA NOTAM API or Aviation Weather Center
    
    logger.info('Fetching FAA NOTAMs');
    
    // TODO: Implement actual FAA NOTAM API integration
    // Options:
    // 1. FAA NOTAM API (requires authentication)
    // 2. Aviation Weather Center API
    // 3. Parse NOTAM feeds
    
    // For now, return empty - this will work once API is configured
    return {
      features: [], // Will be populated when API is integrated
    };
  } catch (error) {
    logger.error('Failed to fetch FAA NOTAMs', error);
    throw error;
  }
}

/**
 * Process a single NOTAM
 */
async function processNOTAM(notam, logger) {
  // Process actual NOTAM data when available
  // NOTAMs typically include:
  // - NOTAM ID
  // - Location (airport/airspace)
  // - Type (closure, restriction, etc.)
  // - Effective dates
  // - Description
  
  if (!notam || !notam.id) {
    return null;
  }
  
  const notamId = notam.id;
  const location = notam.location || 'Unknown Location';
  const type = notam.type || 'Airspace Restriction';
  const description = notam.description || '';
  const effective = notam.effective || new Date().toISOString();
  
  // Only process notable NOTAMs (major closures, restrictions)
  const notableTypes = ['CLOSURE', 'RESTRICTION', 'EMERGENCY'];
  const isNotable = notableTypes.some(nt => 
    type.toUpperCase().includes(nt) || 
    description.toUpperCase().includes(nt)
  );
  
  if (!isNotable) {
    return null;
  }
  
  const normalizedSeverity = normalizeAirspaceSeverity(type);
  const locationDisplay = cleanLocation(location);
  const canonicalId = buildCanonicalId('faa', notamId);
  
  const event = {
    canonical_id: canonicalId,
    engine: 'faa',
    event_type: 'airspace',
    severity: normalizedSeverity,
    title: `${type} - ${locationDisplay}`,
    summary: `${type} issued for ${locationDisplay}. ${description.substring(0, 200)}...`,
    location_display: locationDisplay,
    country_code: 'US',
    lat: notam.lat || null,
    lon: notam.lon || null,
    geobox: null,
    source_name: 'FAA',
    source_url: notam.url || 'https://www.faa.gov/air_traffic/flight_info/aeronav/notams/',
    published_at: effective,
    updated_at_source: notam.updated ? new Date(notam.updated).toISOString() : null,
    fetched_at: new Date().toISOString(),
    status: 'active',
    tags: ['airspace', 'faa', type.toLowerCase().replace(/\s+/g, '_'), 'breaking'],
    assets: {},
    image_url: null,
    alert_sent: false,
    alert_sent_at: null,
    raw: notam,
  };
  
  const { isNew, event: storedEvent } = await storeEvent(event, logger);
  
  // Create website post
  if (isNew) {
    try {
      await createPostFromEvent(storedEvent, 'Airspace Alert', 'FAA');
      logger.info('Website post created', { canonical_id: canonicalId });
    } catch (postError) {
      logger.warn('Failed to create website post', postError);
    }
  }
  
  // Send email alert for notable events (severity >= 3)
  if (normalizedSeverity >= 3 && (!storedEvent.alert_sent || isNew)) {
    const alertSent = await sendEventAlert(storedEvent, 'Airspace Alert', 'FAA', null);
    if (alertSent) {
      await supabase
        .from('verified_events')
        .update({
          alert_sent: true,
          alert_sent_at: new Date().toISOString(),
        })
        .eq('canonical_id', canonicalId);
      
      storedEvent.alert_sent = true;
      storedEvent.alert_sent_at = new Date().toISOString();
    }
  }
  
  return { isNew, event: storedEvent };
}

/**
 * Store or update event in verified_events
 */
async function storeEvent(event, logger) {
  try {
    const { data: existing, error: checkError } = await supabase
      .from('verified_events')
      .select('id, alert_sent, alert_sent_at')
      .eq('canonical_id', event.canonical_id)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }
    
    if (existing) {
      const updateData = {
        title: event.title,
        summary: event.summary,
        severity: event.severity,
        location_display: event.location_display,
        lat: event.lat,
        lon: event.lon,
        updated_at_source: event.updated_at_source,
        fetched_at: event.fetched_at,
        status: event.status,
        tags: event.tags,
        assets: event.assets,
        raw: event.raw,
      };
      
      if (existing.alert_sent) {
        updateData.alert_sent = true;
        updateData.alert_sent_at = existing.alert_sent_at;
      }
      
      const { error: updateError } = await supabase
        .from('verified_events')
        .update(updateData)
        .eq('canonical_id', event.canonical_id);
      
      if (updateError) {
        throw updateError;
      }
      
      return { isNew: false, event: { ...existing, ...updateData } };
    } else {
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
 * Run FAA engine
 */
async function run(logger) {
  try {
    logger.info('Starting FAA engine run');
    
    // Fetch NOTAMs
    const notamData = await fetchFAANOTAMs(logger);
    
    if (!notamData || !notamData.features || notamData.features.length === 0) {
      logger.info('No notable NOTAMs found (FAA API requires proper authentication)');
  return {
    success: true,
    count_new: 0,
    count_updated: 0,
    count_total_seen: 0,
  };
}

    logger.info('Processing FAA NOTAMs', { count: notamData.features.length });
    
    let countNew = 0;
    let countUpdated = 0;
    let countErrors = 0;
    const notifiableEvents = [];
    
    // Process each NOTAM
    for (const notam of notamData.features) {
      try {
        const result = await processNOTAM(notam, logger);
        if (result) {
          if (result.isNew) {
            countNew++;
            if (result.event) {
              notifiableEvents.push({
                id: result.event.canonical_id,
                source: 'faa',
                type: 'airspace',
                severity: result.event.severity || 1,
                title: result.event.title || '',
                summary: result.event.summary || '',
                location: {
                  display: result.event.location_display || '',
                  lat: result.event.lat || null,
                  lon: result.event.lon || null,
                },
                publishedAt: result.event.published_at || new Date().toISOString(),
                sourceUrl: result.event.source_url || null,
                assets: {},
              });
            }
          } else {
            countUpdated++;
          }
        }
      } catch (error) {
        logger.error('Error processing NOTAM', error);
        countErrors++;
      }
    }
    
    logger.info('FAA engine run completed', {
      total_seen: notamData.features.length,
      new: countNew,
      updated: countUpdated,
      errors: countErrors,
      notifiable: notifiableEvents.length,
    });
    
    return {
      success: true,
      count_new: countNew,
      count_updated: countUpdated,
      count_total_seen: notamData.features.length,
      notifiableEvents,
    };
  } catch (error) {
    logger.error('Fatal error in FAA engine', error);
    return {
      success: false,
      error: error.message,
      count_new: 0,
      count_updated: 0,
      count_total_seen: 0,
      notifiableEvents: [],
    };
  }
}

module.exports = {
  run,
};
