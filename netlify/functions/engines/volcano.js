/**
 * Volcano Engine - Volcanic Activity Alerts
 * Fetches volcano alerts from USGS Volcano Hazards Program
 * Creates posts and sends alerts for notable volcanic activity
 */

const supabase = require('../lib/supabaseClient');
const { buildCanonicalId, buildCanonicalIdFromHash } = require('../lib/dedupe');
const { normalizeAirspaceSeverity, cleanLocation } = require('../lib/normalize');
const { createPostFromEvent } = require('../lib/createPost');
const { sendEventAlert } = require('../lib/sendAlert');
const { generateVolcanoImage } = require('../generate-volcano-image');
const { getVolcanoAlertImageUrl } = require('../lib/volcanoAlertImages');
const Parser = require('rss-parser');

// USGS Volcano Notification Service (VNS) - uses RSS feeds
// Official RSS feed URL
const USGS_VOLCANO_FEED = 'https://volcanoes.usgs.gov/rss/vhpcaprss.xml';

const parser = new Parser({
  customFields: {
    item: [
      ['volcano:alertlevel', 'alertLevel'],
      ['volcano:colorcode', 'colorCode'],
      ['georss:point', 'geoPoint'],
    ],
  },
});

/**
 * Check if we're in dry run mode
 */
function isDryRun() {
  return process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1';
}

/**
 * Fetch USGS volcano alerts
 * Uses USGS Volcano Hazards Program RSS feed
 * Feed URL: https://volcanoes.usgs.gov/rss/vhpcaprss.xml
 */
async function fetchVolcanoAlerts(logger) {
  try {
    logger.info('Fetching USGS volcano alerts from RSS feed', { url: USGS_VOLCANO_FEED });
    
    const feed = await parser.parseURL(USGS_VOLCANO_FEED);
    
    if (!feed || !feed.items || feed.items.length === 0) {
      logger.warn('No items found in volcano RSS feed');
      return { features: [] };
    }
    
    logger.info('Successfully fetched volcano feed', { itemCount: feed.items.length });
    
    const alerts = [];
    
    // Convert RSS items to our format
    for (const item of feed.items) {
      const title = item.title || '';
      const content = item.content || item.contentSnippet || item.description || '';
      const pubDate = item.pubDate || item.isoDate || new Date().toISOString();
      
      // Extract alert level and color code from custom fields
      const alertLevel = item.alertLevel || 'NORMAL';
      const colorCode = item.colorCode || 'GREEN';
      
      // Parse volcano name from title
      // Format: "OBSERVATORY VOLCANO COLOR/LEVEL - Description"
      // Example: "HVO Kilauea ORANGE/WATCH - Episode 39..."
      let volcanoName = 'Unknown Volcano';
      const titleParts = title.split(' - ');
      if (titleParts.length > 0) {
        const firstPart = titleParts[0];
        // Remove observatory code (HVO, AVO, etc.) and alert info
        volcanoName = firstPart
          .replace(/^(HVO|AVO|CVO|CALVO|YVO|GVO)\s+/i, '')
          .replace(/\s+(ORANGE|YELLOW|RED|GREEN)\/(WATCH|WARNING|ADVISORY|NORMAL)/i, '')
          .trim();
        
        if (!volcanoName || volcanoName.length < 3) {
          // Fallback: use the full first part
          volcanoName = firstPart.replace(/^(HVO|AVO|CVO|CALVO|YVO|GVO)\s+/i, '').trim();
        }
      }
      
      // Extract location from geoPoint (format: "lat lon")
      let lat = null;
      let lon = null;
      if (item.geoPoint) {
        const coords = item.geoPoint.split(/\s+/);
        if (coords.length >= 2) {
          lat = parseFloat(coords[0]);
          lon = parseFloat(coords[1]);
        }
      }
      
      // Extract location name from content if available
      let location = volcanoName;
      const locationMatch = content.match(/(?:at|near|in)\s+([A-Z][A-Za-z\s]+?)(?:\s+volcano|\.|,)/);
      if (locationMatch) {
        location = locationMatch[1].trim();
      }
      
      // Create alert object
      const alert = {
        id: item.guid || item.link || `volcano-${Date.now()}-${Math.random()}`,
        volcano: volcanoName,
        name: volcanoName,
        alertLevel: alertLevel,
        level: alertLevel,
        location: location,
        description: content.substring(0, 500),
        summary: content.substring(0, 200),
        published: pubDate,
        url: item.link || 'https://volcanoes.usgs.gov/',
        lat: lat,
        lon: lon,
        aviationColorCode: colorCode,
      };
      
      alerts.push(alert);
    }
    
    logger.info('Processed volcano alerts', { count: alerts.length });
    
    return {
      features: alerts,
    };
  } catch (error) {
    logger.error('Failed to fetch volcano alerts', error);
    throw error;
  }
}

/**
 * Process a single volcano alert
 */
async function processVolcanoAlert(alert, logger) {
  // Process actual volcano alert data when available
  // Volcano alerts typically include:
  // - Volcano name
  // - Alert level (Normal, Advisory, Watch, Warning)
  // - Location
  // - Activity description
  // - Aviation color code
  
  if (!alert || !alert.id) {
    return null;
  }
  
  const alertId = alert.id;
  const volcanoName = alert.volcano || alert.name || 'Unknown Volcano';
  const alertLevel = alert.alertLevel || alert.level || 'Normal';
  const location = alert.location || volcanoName;
  const description = alert.description || alert.summary || '';
  const published = alert.published || alert.effective || new Date().toISOString();
  
  // Only process notable alerts (Watch, Warning, or elevated activity)
  const notableLevels = ['WARNING', 'WATCH', 'ADVISORY'];
  const isNotable = notableLevels.some(level => 
    alertLevel.toUpperCase().includes(level)
  ) || alert.aviationColorCode === 'RED' || alert.aviationColorCode === 'ORANGE';
  
  if (!isNotable) {
    return null;
  }
  
  // Map alert level to severity
  let normalizedSeverity = 2; // Default moderate
  if (alertLevel.toUpperCase().includes('WARNING')) normalizedSeverity = 5;
  else if (alertLevel.toUpperCase().includes('WATCH')) normalizedSeverity = 4;
  else if (alertLevel.toUpperCase().includes('ADVISORY')) normalizedSeverity = 3;
  
  const locationDisplay = cleanLocation(location);
  const canonicalId = buildCanonicalId('volcano', alertId);
  
  // Use curated photo for known volcanoes; otherwise generate branded template image.
  let imageUrl = getVolcanoAlertImageUrl(volcanoName);
  if (!imageUrl) {
    try {
      const eventIdForImage = canonicalId.replace('volcano:', '');
      imageUrl = await generateVolcanoImage(
        volcanoName, alertLevel,
        alert.lat || null, alert.lon || null,
        eventIdForImage
      );
      logger.info('Volcano image generated', { canonical_id: canonicalId, imageUrl });
    } catch (imgErr) {
      logger.warn('Failed to generate volcano image (continuing without)', imgErr.message || imgErr);
    }
  } else {
    logger.info('Using curated volcano alert image', { canonical_id: canonicalId, volcanoName, imageUrl });
  }

  const event = {
    canonical_id: canonicalId,
    engine: 'volcano',
    event_type: 'volcano',
    severity: normalizedSeverity,
    title: `${alertLevel} - ${volcanoName}`,
    summary: `${alertLevel} issued for ${volcanoName}. ${description.substring(0, 150).trim()}${description.length > 150 ? '...' : ''}`,
    location_display: locationDisplay,
    country_code: null,
    lat: alert.lat || null,
    lon: alert.lon || null,
    geobox: null,
    source_name: 'USGS',
    source_url: alert.url || `https://volcanoes.usgs.gov/volcanoes/${volcanoName.toLowerCase().replace(/\s+/g, '_')}/`,
    published_at: published,
    updated_at_source: alert.updated ? new Date(alert.updated).toISOString() : null,
    fetched_at: new Date().toISOString(),
    status: 'active',
    tags: ['volcano', volcanoName.toLowerCase().replace(/\s+/g, '_'), alertLevel.toLowerCase(), 'breaking'],
    assets: {},
    image_url: imageUrl,
    alert_sent: false,
    alert_sent_at: null,
    raw: alert,
  };
  
  const { isNew, event: storedEvent } = await storeEvent(event, logger);
  
  // Create or update website post (also triggers on image backfill for existing events)
  if (isNew || storedEvent.image_url) {
    try {
      await createPostFromEvent(storedEvent, 'Volcano Alert', 'USGS');
      logger.info(isNew ? 'Website post created' : 'Website post updated with image', { canonical_id: canonicalId });
    } catch (postError) {
      logger.warn('Failed to create/update website post', postError);
    }
  }
  
  // Send email alert for notable events (severity >= 3)
  if (normalizedSeverity >= 3 && (!storedEvent.alert_sent || isNew)) {
    const alertSent = await sendEventAlert(storedEvent, 'Volcano Alert', 'USGS', null);
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
      .select('id, alert_sent, alert_sent_at, image_url')
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
      
      // Backfill image if missing, or replace generated template with curated static asset
      if (event.image_url) {
        const isCuratedStatic = String(event.image_url).startsWith('/assets/alerts/');
        if (!existing.image_url || isCuratedStatic) {
          updateData.image_url = event.image_url;
        }
      }
      
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
 * Run Volcano engine
 */
async function run(logger) {
  try {
    logger.info('Starting Volcano engine run');
    
    const alertData = await fetchVolcanoAlerts(logger);
  
    if (!alertData || !alertData.features || alertData.features.length === 0) {
      logger.info('No volcano alerts found (USGS Volcano API requires proper integration)');
  return {
    success: true,
    count_new: 0,
    count_updated: 0,
    count_total_seen: 0,
  };
}

    logger.info('Processing volcano alerts', { count: alertData.features.length });
    
    let countNew = 0;
    let countUpdated = 0;
    let countErrors = 0;
    const notifiableEvents = [];
    
    for (const alert of alertData.features) {
      try {
        const result = await processVolcanoAlert(alert, logger);
        if (result) {
          if (result.isNew) {
            countNew++;
            if (result.event) {
              notifiableEvents.push({
                id: result.event.canonical_id,
                source: 'volcano',
                type: 'volcanic',
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
        logger.error('Error processing volcano alert', error);
        countErrors++;
      }
    }
    
    logger.info('Volcano engine run completed', {
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
    logger.error('Fatal error in Volcano engine', error);
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
