/**
 * USCG Engine - Maritime Alerts
 * Fetches maritime alerts from US Coast Guard
 * Creates posts and sends alerts for notable maritime events
 */

const supabase = require('../lib/supabaseClient');
const { buildCanonicalId, buildCanonicalIdFromHash } = require('../lib/dedupe');
const { normalizeAirspaceSeverity, cleanLocation } = require('../lib/normalize');
const { createPostFromEvent } = require('../lib/createPost');
const { sendEventAlert } = require('../lib/sendAlert');

// USCG Maritime Information Exchange (MIX) - placeholder
// USCG doesn't have a simple public JSON API
const USCG_ALERTS_URL = 'https://www.navcen.uscg.gov/';

/**
 * Check if we're in dry run mode
 */
function isDryRun() {
  return process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1';
}

/**
 * Fetch USCG maritime alerts
 * Uses US Coast Guard navigation warnings and notices
 */
async function fetchUSCGAlerts(logger) {
  try {
    // USCG maritime alerts are typically available through:
    // - Local Notice to Mariners (LNM)
    // - Broadcast Notice to Mariners
    // - Navigation warnings
    // - USCG Navigation Center
    
    logger.info('Fetching USCG maritime alerts');
    
    // TODO: Implement actual USCG API/RSS integration
    // USCG provides alerts at: https://www.navcen.uscg.gov/
    // Navigation warnings and notices available through various feeds
    
    return {
      features: [], // Will be populated when API/RSS is integrated
    };
  } catch (error) {
    logger.error('Failed to fetch USCG alerts', error);
    throw error;
  }
}

/**
 * Process a single maritime alert
 */
async function processMaritimeAlert(alert, logger) {
  // Process actual maritime alert data when available
  // Maritime alerts typically include:
  // - Alert ID
  // - Location (waterway, port, etc.)
  // - Type (navigation warning, search & rescue, etc.)
  // - Description
  // - Effective dates
  
  if (!alert || !alert.id) {
    return null;
  }
  
  const alertId = alert.id;
  const alertType = alert.type || 'Maritime Alert';
  const location = alert.location || 'Unknown Location';
  const description = alert.description || alert.summary || '';
  const published = alert.published || alert.effective || new Date().toISOString();
  
  // Only process notable alerts (search & rescue, major navigation warnings, etc.)
  const notableTypes = ['SEARCH AND RESCUE', 'NAVIGATION WARNING', 'EMERGENCY', 'HAZARD'];
  const isNotable = notableTypes.some(nt => 
    alertType.toUpperCase().includes(nt) || 
    description.toUpperCase().includes(nt)
  );
  
  if (!isNotable) {
    return null;
  }
  
  const normalizedSeverity = normalizeAirspaceSeverity(alertType);
  const locationDisplay = cleanLocation(location);
  const canonicalId = buildCanonicalId('uscg', alertId);
  
  const event = {
    canonical_id: canonicalId,
    engine: 'uscg',
    event_type: 'maritime',
    severity: normalizedSeverity,
    title: `${alertType} - ${locationDisplay}`,
    summary: `${alertType} issued for ${locationDisplay}. ${description.substring(0, 200)}...`,
    location_display: locationDisplay,
    country_code: 'US',
    lat: alert.lat || null,
    lon: alert.lon || null,
    geobox: null,
    source_name: 'USCG',
    source_url: alert.url || 'https://www.navcen.uscg.gov/',
    published_at: published,
    updated_at_source: alert.updated ? new Date(alert.updated).toISOString() : null,
    fetched_at: new Date().toISOString(),
    status: 'active',
    tags: ['maritime', 'uscg', alertType.toLowerCase().replace(/\s+/g, '_'), 'breaking'],
    assets: {},
    image_url: null,
    alert_sent: false,
    alert_sent_at: null,
    raw: alert,
  };
  
  const { isNew, event: storedEvent } = await storeEvent(event, logger);
  
  // Create website post
  if (isNew) {
    try {
      await createPostFromEvent(storedEvent, 'Maritime Alert', 'USCG');
      logger.info('Website post created', { canonical_id: canonicalId });
    } catch (postError) {
      logger.warn('Failed to create website post', postError);
    }
  }
  
  // Send email alert for notable events (severity >= 3)
  if (normalizedSeverity >= 3 && (!storedEvent.alert_sent || isNew)) {
    const alertSent = await sendEventAlert(storedEvent, 'Maritime Alert', 'USCG', null);
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
 * Run USCG engine
 */
async function run(logger) {
  try {
    logger.info('Starting USCG engine run');
    
    const alertData = await fetchUSCGAlerts(logger);
    
    if (!alertData || !alertData.features || alertData.features.length === 0) {
      logger.info('No maritime alerts found (USCG API requires proper integration)');
      return {
        success: true,
        count_new: 0,
        count_updated: 0,
        count_total_seen: 0,
      };
    }
    
    logger.info('Processing USCG alerts', { count: alertData.features.length });
    
    let countNew = 0;
    let countUpdated = 0;
    let countErrors = 0;
    const notifiableEvents = [];
    
    for (const alert of alertData.features) {
      try {
        const result = await processMaritimeAlert(alert, logger);
        if (result) {
          if (result.isNew) {
            countNew++;
            if (result.event) {
              notifiableEvents.push({
                id: result.event.canonical_id,
                source: 'uscg',
                type: 'maritime',
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
        logger.error('Error processing maritime alert', error);
        countErrors++;
      }
    }
    
    logger.info('USCG engine run completed', {
      total_seen: alertData.features.length,
      new: countNew,
      updated: countUpdated,
      errors: countErrors,
      notifiable: notifiableEvents.length,
    });
    
    return {
      success: true,
      count_new: countNew,
      count_updated: countUpdated,
      count_total_seen: alertData.features.length,
      notifiableEvents,
    };
  } catch (error) {
    logger.error('Fatal error in USCG engine', error);
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
