/**
 * NWS Engine - Weather Alerts
 * Fetches weather alerts from National Weather Service
 * Creates posts and sends alerts for notable weather events
 */

const supabase = require('../lib/supabaseClient');
const { buildCanonicalId, buildCanonicalIdFromHash } = require('../lib/dedupe');
const { normalizeWeatherSeverity, cleanLocation } = require('../lib/normalize');
const { createPostFromEvent } = require('../lib/createPost');
// const { sendEventAlert } = require('../lib/sendAlert'); // Disabled - no weather alert emails

// NWS Alert Feed URLs (CAP format - GeoJSON)
const NWS_ALERT_FEEDS = {
  // Active alerts for all US states (GeoJSON format)
  active: 'https://api.weather.gov/alerts/active',
  // You can also filter by state: https://api.weather.gov/alerts/active?area=CA
  // Or by severity: https://api.weather.gov/alerts/active?severity=extreme,severe
};

/**
 * Check if we're in dry run mode
 */
function isDryRun() {
  return process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1';
}

/**
 * Send push notification for severe weather alert
 */
async function sendPushNotificationForWeather(event, logger) {
  try {
    const { sendPushNotification } = require('../send-push-notification');
    
    // Get severity icon
    const severityIcons = {
      5: '🚨', // Extreme
      4: '⛈️', // Severe
      3: '🌧️', // Moderate
      2: '☁️', // Minor
      1: '📢', // Advisory
    };
    const icon = severityIcons[event.severity] || '⛈️';
    
    const result = await sendPushNotification({
      type: 'weather',
      title: `${icon} ${event.title || 'Weather Alert'}`,
      body: event.summary || event.location_display || 'Severe weather alert in your area',
      url: event.source_url || '/situation-monitor.html',
      tag: `weather-${event.canonical_id}`,
      id: event.canonical_id,
    });
    
    if (result.success) {
      logger.info('📲 Push notification sent for weather alert', {
        canonical_id: event.canonical_id,
        sent: result.sent,
        failed: result.failed,
      });
    } else {
      logger.warn('Push notification not sent:', result.error);
    }
    
    return result;
  } catch (error) {
    logger.error('Error sending weather push notification:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch NWS active alerts
 */
async function fetchNWSAlerts(logger) {
  try {
    const url = NWS_ALERT_FEEDS.active;
    logger.info('Fetching NWS alerts', { url });
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'NoteworthyNews/1.0 (contact@noteworthynews.co)',
        'Accept': 'application/geo+json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`NWS API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    logger.error('Failed to fetch NWS alerts', error);
    throw error;
  }
}

/**
 * Process a single NWS alert feature
 */
async function processAlert(feature, logger) {
  const props = feature.properties;
  
  if (!props || !props.id) {
    logger.warn('Skipping invalid NWS alert', null, { hasId: !!props?.id });
    return null;
  }
  
  // Extract alert information
  const alertId = props.id;
  const eventType = props.event || 'Weather Alert';
  const headline = props.headline || props.summary || eventType;
  const description = props.description || props.summary || '';
  const severity = props.severity || 'Unknown';
  const urgency = props.urgency || 'Unknown';
  const areaDesc = props.areaDesc || 'Unknown Location';
  const effective = props.effective || new Date().toISOString();
  const expires = props.expires;
  const status = props.status || 'Actual';
  const messageType = props.msgType || 'Alert';
  const sourceUrl = props.senderName ? `https://www.weather.gov/${props.senderName.toLowerCase()}` : 'https://www.weather.gov';
  
  // Only process actual alerts (not tests, cancellations, etc.)
  if (status !== 'Actual' || messageType === 'Cancel') {
    return null;
  }
  
  // Skip non-weather alerts that NWS distributes (AMBER, civil, law enforcement)
  const nonWeatherTypes = [
    'child abduction', 'amber alert', 'civil emergency',
    'law enforcement', 'missing person', 'blue alert',
    'silver alert', 'local area emergency',
  ];
  const evtLower = eventType.toLowerCase();
  const headLower = headline.toLowerCase();
  if (nonWeatherTypes.some(t => evtLower.includes(t) || headLower.includes(t))) {
    return null;
  }
  
  // CRITICAL FILTER: Only process EXTREMELY SEVERE alerts
  // User requirement: Only Tornado, Flash Flood in major cities, or other truly severe events
  // NO random blizzards, minor warnings, or alerts in small cities
  
  // Normalize severity FIRST (before using it in checks)
  const normalizedSeverity = normalizeWeatherSeverity(severity);
  const locationDisplay = cleanLocation(areaDesc);
  
  // STRICT: Only these alert types are allowed (most severe only)
  const criticalTypes = [
    'Tornado Warning', // Always critical
    'Tornado Watch', // Always critical
    'Flash Flood Warning', // Only in major cities (filtered below)
    'Extreme Wind Warning', // Always critical
    'Hurricane Warning', // Always critical
    'Tropical Storm Warning', // Only if severe
  ];
  
  // Check if this is a critical alert type
  const isCriticalType = criticalTypes.some(type => 
    eventType.toLowerCase().includes(type.toLowerCase()) ||
    headline.toLowerCase().includes(type.toLowerCase())
  );
  
  // STRICT SEVERITY REQUIREMENT: Only severity 4+ (Severe/Extreme)
  // Severity levels: 1=Unknown, 2=Minor, 3=Moderate, 4=Severe, 5=Extreme
  if (normalizedSeverity < 4) {
    return null; // Skip anything below Severe
  }
  
  // For Flash Flood Warning, only allow in major cities
  if (eventType.toLowerCase().includes('flash flood') || headline.toLowerCase().includes('flash flood')) {
    const majorCities = [
      'new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia',
      'san antonio', 'san diego', 'dallas', 'san jose', 'austin', 'jacksonville',
      'fort worth', 'columbus', 'charlotte', 'san francisco', 'indianapolis',
      'seattle', 'denver', 'washington', 'boston', 'el paso', 'detroit', 'nashville',
      'portland', 'oklahoma city', 'las vegas', 'memphis', 'louisville', 'baltimore',
      'milwaukee', 'albuquerque', 'tucson', 'fresno', 'sacramento', 'kansas city',
      'mesa', 'atlanta', 'omaha', 'colorado springs', 'raleigh', 'virginia beach',
      'miami', 'oakland', 'minneapolis', 'tulsa', 'cleveland', 'wichita', 'arlington'
    ];
    
    const locationLower = locationDisplay.toLowerCase();
    const isMajorCity = majorCities.some(city => locationLower.includes(city));
    
    if (!isMajorCity) {
      logger.debug('Skipping Flash Flood Warning - not in major city', { location: locationDisplay });
      return null; // Skip flash floods in small cities
    }
  }
  
  // Final check: Must be critical type OR Extreme severity
  if (!isCriticalType && normalizedSeverity < 5) {
    return null; // Skip non-critical types unless Extreme severity
  }
  
  // Build canonical ID from alert ID
  const canonicalId = buildCanonicalId('nws', alertId);
  
  // Extract coordinates if available
  let lat = null;
  let lon = null;
  if (feature.geometry && feature.geometry.coordinates) {
    // GeoJSON Polygon - use centroid or first point
    const coords = feature.geometry.coordinates[0];
    if (coords && coords.length > 0) {
      lon = coords[0][0];
      lat = coords[0][1];
    }
  }
  
  // Truncate location if too long (NWS areaDesc can be extremely long)
  const shortLocation = locationDisplay.length > 100 
    ? locationDisplay.substring(0, 100).trim() + '...'
    : locationDisplay;
  
  // Create concise summary (max 200 chars total)
  const summaryParts = [
    eventType,
    shortLocation !== locationDisplay ? shortLocation : locationDisplay.split(',')[0], // Use first location if truncated
    headline.length > 80 ? headline.substring(0, 80) + '...' : headline
  ].filter(Boolean);
  
  // Build event object
  const event = {
    canonical_id: canonicalId,
    engine: 'nws',
    event_type: 'weather',
    severity: normalizedSeverity,
    title: `${eventType} - ${shortLocation}`,
    summary: summaryParts.join('. ').substring(0, 200),
    location_display: shortLocation,
    country_code: 'US', // NWS is US-only
    lat: lat,
    lon: lon,
    geobox: null,
    source_name: 'NWS',
    source_url: sourceUrl,
    published_at: effective,
    updated_at_source: props.updated ? new Date(props.updated).toISOString() : null,
    fetched_at: new Date().toISOString(),
    status: 'active',
    tags: ['weather', eventType.toLowerCase().replace(/\s+/g, '_'), severity.toLowerCase(), 'breaking'],
    assets: {},
    image_url: null, // No image generation for now
    alert_sent: false,
    alert_sent_at: null,
    raw: feature,
  };
  
  // Store event
  const { isNew, event: storedEvent } = await storeEvent(event, logger);
  
  // Create website post
  if (isNew) {
    try {
      await createPostFromEvent(storedEvent, 'Weather Alert', 'NWS');
      logger.info('Website post created', { canonical_id: canonicalId });
    } catch (postError) {
      logger.warn('Failed to create website post', postError);
    }
    
    // Send location-based alerts for new events (non-blocking)
    sendLocationAlertsForEvent(storedEvent, logger).catch(err => {
      logger.error('Error sending location alerts:', err);
    });
    
    // Send push notifications for severe weather (non-blocking)
    if (normalizedSeverity >= 4) {
      sendPushNotificationForWeather(storedEvent, logger).catch(err => {
        logger.error('Error sending push notification for weather:', err);
      });
    }
  }
  
  // WEATHER ALERT EMAILS DISABLED - User requested no weather alert emails
  // Posts will still be created, but no emails will be sent
  // if (normalizedSeverity >= 4 && (!storedEvent.alert_sent || isNew)) {
  //   const alertSent = await sendEventAlert(storedEvent, 'Weather Alert', 'NWS', null);
  //   if (alertSent) {
  //     // Update alert_sent status
  //     await supabase
  //       .from('verified_events')
  //       .update({
  //         alert_sent: true,
  //         alert_sent_at: new Date().toISOString(),
  //       })
  //       .eq('canonical_id', canonicalId);
  //     
  //     storedEvent.alert_sent = true;
  //     storedEvent.alert_sent_at = new Date().toISOString();
  //   }
  // }
  
  return { isNew, event: storedEvent };
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
    
    if (checkError && checkError.code !== 'PGRST116') {
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
        updated_at_source: event.updated_at_source,
        fetched_at: event.fetched_at,
        status: event.status,
        tags: event.tags,
        assets: event.assets,
        raw: event.raw,
      };
      
      // Preserve alert_sent status
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
 * Send location-based alerts for new events (non-blocking)
 */
async function sendLocationAlertsForEvent(event, logger) {
  // Only send for new events with location data
  if (!event.lat || !event.lon) {
    return;
  }

  try {
    const { getUsersNearEvent } = require('../lib/getLocationAlertUsers');
    const { checkAndSendLocationAlert } = require('../send-location-alert');

    // Get users near this event
    const nearbyUsers = await getUsersNearEvent(event, 'weather');

    if (nearbyUsers.length === 0) {
      return;
    }

    logger.info(`Found ${nearbyUsers.length} user(s) near weather event ${event.canonical_id}`);

    // Send alerts to nearby users (non-blocking, don't wait)
    const alertPromises = nearbyUsers.map(user => 
      checkAndSendLocationAlert(
        user.email,
        user.userName,
        {
          ...event,
          latitude: event.lat,
          longitude: event.lon,
        },
        'Weather Alert'
      ).catch(err => {
        logger.error(`Failed to send location alert to ${user.email}:`, err);
      })
    );

    // Don't wait for all alerts - fire and forget
    Promise.all(alertPromises).catch(err => {
      logger.error('Error sending location alerts:', err);
    });
  } catch (error) {
    // Don't fail event storage if location alerts fail
    logger.error('Error processing location alerts:', error);
  }
}

/**
 * Run NWS engine
 */
async function run(logger) {
  try {
    logger.info('Starting NWS engine run');
    
    // Fetch NWS alerts
    const alertData = await fetchNWSAlerts(logger);
    
    if (!alertData || !alertData.features || !Array.isArray(alertData.features)) {
      logger.warn('No alerts found in NWS feed');
  return {
    success: true,
    count_new: 0,
    count_updated: 0,
    count_total_seen: 0,
  };
}

    logger.info('Processing NWS alerts', { count: alertData.features.length });
    
    let countNew = 0;
    let countUpdated = 0;
    let countErrors = 0;
    let countSkipped = 0;
    const notifiableEvents = [];
    
    // Process each alert
    for (const feature of alertData.features) {
      try {
        const result = await processAlert(feature, logger);
        if (result) {
          if (result.isNew) {
            countNew++;
            if (result.event) {
              notifiableEvents.push({
                id: result.event.canonical_id,
                source: 'nws',
                type: 'weather',
                severity: result.event.severity || 1,
                title: result.event.title || '',
                summary: result.event.summary || '',
                location: {
                  display: result.event.location_display || '',
                  lat: result.event.lat || result.event.latitude || null,
                  lon: result.event.lon || result.event.longitude || null,
                },
                publishedAt: result.event.published_at || new Date().toISOString(),
                sourceUrl: result.event.source_url || null,
                assets: {},
              });
            }
          } else {
            countUpdated++;
          }
        } else {
          countSkipped++;
        }
      } catch (error) {
        logger.error('Error processing alert', error, { alertId: feature.properties?.id });
        countErrors++;
      }
    }
    
    logger.info('NWS engine run completed', {
      total_seen: alertData.features.length,
      new: countNew,
      updated: countUpdated,
      skipped: countSkipped,
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
    logger.error('Fatal error in NWS engine', error);
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
