/**
 * Embassy Engine - Travel Advisories
 * Fetches travel advisories from State Department
 * Creates posts and sends alerts for notable travel warnings
 */

const supabase = require('../lib/supabaseClient');
const { buildCanonicalId, buildCanonicalIdFromHash } = require('../lib/dedupe');
const { normalizeAirspaceSeverity, cleanLocation } = require('../lib/normalize');
const { createPostFromEvent } = require('../lib/createPost');
const { sendEventAlert } = require('../lib/sendAlert');
const Parser = require('rss-parser');

// State Department Travel Advisories and Related Feeds
// Primary feed for Travel Advisories and Travel Warnings
const STATE_DEPT_TRAVEL_FEED = 'https://travel.state.gov/_res/rss/TAsTWs.xml';

// All State Department RSS feeds - each contains different types of alerts
const STATE_DEPT_FEEDS = [
  // Primary travel advisories feed
  { url: 'https://travel.state.gov/_res/rss/TAsTWs.xml', type: 'travel_advisory' },
  
  // Security and diplomatic feeds
  { url: 'https://www.state.gov/rss-feed/diplomatic-security/feed/', type: 'security' },
  
  // Regional feeds (may contain travel warnings and security alerts)
  { url: 'https://www.state.gov/rss-feed/africa/feed/', type: 'regional' },
  { url: 'https://www.state.gov/rss-feed/east-asia-and-the-pacific/feed/', type: 'regional' },
  { url: 'https://www.state.gov/rss-feed/europe-and-eurasia/feed/', type: 'regional' },
  { url: 'https://www.state.gov/rss-feed/near-east/feed/', type: 'regional' },
  { url: 'https://www.state.gov/rss-feed/south-and-central-asia/feed/', type: 'regional' },
  { url: 'https://www.state.gov/rss-feed/western-hemisphere/feed/', type: 'regional' },
  
  // Press and announcement feeds (may contain travel warnings)
  { url: 'https://www.state.gov/rss-feed/press-releases/feed/', type: 'press' },
  { url: 'https://www.state.gov/rss-feed/department-press-briefings/feed/', type: 'press' },
  { url: 'https://www.state.gov/rss-feed/collected-department-releases/feed/', type: 'press' },
];

const parser = new Parser({
  customFields: {
    item: [
      ['category', 'categories', { keepArray: true }],
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
 * Fetch State Department travel advisories and alerts
 * Uses all State Department RSS feeds - each contains different types of alerts
 */
async function fetchTravelAdvisories(logger) {
  try {
    const advisories = [];
    
    logger.info('Fetching from all State Department RSS feeds', { count: STATE_DEPT_FEEDS.length });
    
    // Fetch from all feeds
    for (const feedConfig of STATE_DEPT_FEEDS) {
      try {
        logger.info('Fetching from feed', { url: feedConfig.url, type: feedConfig.type });
        const feed = await parser.parseURL(feedConfig.url);
        
        if (!feed || !feed.items || feed.items.length === 0) {
          logger.warn('No items found in feed', { url: feedConfig.url });
          continue;
        }
        
        logger.info('Successfully fetched feed', { 
          url: feedConfig.url, 
          type: feedConfig.type,
          itemCount: feed.items.length 
        });
    
        // Process items based on feed type
        for (const item of feed.items) {
          const title = item.title || '';
          const content = item.content || item.contentSnippet || item.description || '';
          const pubDate = item.pubDate || item.isoDate || new Date().toISOString();
          
          // For travel advisory feed, use structured parsing
          if (feedConfig.type === 'travel_advisory') {
            // Extract level from category tags
            let level = 1;
            let levelText = 'Exercise Normal Precautions';
            
            const categories = item.categories || [];
            for (const cat of categories) {
              if (cat && typeof cat === 'string') {
                const levelMatch = cat.match(/Level\s*(\d)/i);
                if (levelMatch) {
                  level = parseInt(levelMatch[1], 10);
                  const textMatch = cat.match(/Level\s*\d:\s*(.+)/i);
                  if (textMatch) {
                    levelText = textMatch[1].trim();
                  } else {
                    levelText = getAdvisoryLevelText(level);
                  }
                  break;
                }
              }
            }
            
            // Fallback: extract from title
            if (level === 1) {
              const titleLevelMatch = title.match(/Level\s*(\d)/i);
              if (titleLevelMatch) {
                level = parseInt(titleLevelMatch[1], 10);
                levelText = getAdvisoryLevelText(level);
              }
            }
            
            // Extract country name
            let country = 'Unknown Country';
            const titleParts = title.split(' - ');
            if (titleParts.length > 0) {
              country = titleParts[0].trim();
            }
            
            // Extract country code
            let countryCode = null;
            for (const cat of categories) {
              if (cat && typeof cat === 'string' && cat.length === 2 && /^[A-Z]{2}$/.test(cat)) {
                countryCode = cat;
                break;
              }
            }
            
            if (!countryCode && item['dc:identifier']) {
              const parts = item['dc:identifier'].split(',');
              if (parts.length > 0 && parts[0].length === 2) {
                countryCode = parts[0];
              }
            }
            
            const advisory = {
              id: item.guid || item.link || `embassy-${Date.now()}-${Math.random()}`,
              country: country,
              region: country,
              level: level,
              advisoryLevel: level,
              levelText: levelText,
              summary: content.substring(0, 500).replace(/<[^>]*>/g, ''),
              description: content,
              published: pubDate,
              issued: pubDate,
              url: item.link || 'https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html',
              countryCode: countryCode,
            };
            
            // CRITICAL FILTER: Skip routine updates/reissues that are NOT breaking news
            const upperSummary = (advisory.summary || '').toUpperCase();
            const upperDescription = (content || '').toUpperCase();
            const isRoutineUpdate = 
              upperSummary.includes('NO CHANGE TO THE ADVISORY LEVEL') ||
              upperSummary.includes('REISSUED') ||
              upperSummary.includes('MINOR EDIT') ||
              upperSummary.includes('PERIODIC REVIEW') ||
              upperSummary.includes('OBSOLETE') ||
              upperDescription.includes('NO CHANGE TO THE ADVISORY LEVEL') ||
              upperDescription.includes('REISSUED AFTER PERIODIC REVIEW') ||
              upperDescription.includes('MINOR EDITS') ||
              (upperSummary.includes('REISSUED') && !upperSummary.includes('LEVEL'));
            
            if (isRoutineUpdate) {
              logger.debug('Skipping routine travel advisory update', { 
                country, 
                level,
                reason: 'routine update/reissue with no level change'
              });
              continue; // Skip this advisory - not breaking news
            }
            
            advisories.push(advisory);
          } else {
            // For other feeds (security, regional, press), look for travel/security-related content
            const upperTitle = title.toUpperCase();
            const upperContent = (content || '').toUpperCase();
            
            const isRelevant = 
              upperTitle.includes('TRAVEL') ||
              upperTitle.includes('ADVISORY') ||
              upperTitle.includes('WARNING') ||
              upperTitle.includes('SECURITY') ||
              upperTitle.includes('ALERT') ||
              upperTitle.includes('THREAT') ||
              upperContent.includes('TRAVEL ADVISORY') ||
              upperContent.includes('DO NOT TRAVEL') ||
              upperContent.includes('RECONSIDER TRAVEL') ||
              upperContent.includes('SECURITY ALERT') ||
              upperContent.includes('EMBASSY');
            
            if (isRelevant) {
              // Try to extract country and level
              let country = 'Unknown Country';
              let level = 1;
              
              // Extract country name
              const countryMatch = title.match(/^([^-:–—]+)/);
              if (countryMatch) {
                country = countryMatch[1].trim();
              }
              
              // Try to extract level
              const levelMatch = title.match(/Level\s*(\d)/i) || content.match(/Level\s*(\d)/i);
              if (levelMatch) {
                level = parseInt(levelMatch[1], 10);
              } else {
                // Infer level from keywords
                if (upperTitle.includes('DO NOT TRAVEL') || upperContent.includes('DO NOT TRAVEL')) {
                  level = 4;
                } else if (upperTitle.includes('RECONSIDER') || upperContent.includes('RECONSIDER')) {
                  level = 3;
                } else if (upperTitle.includes('INCREASED CAUTION') || upperContent.includes('INCREASED CAUTION')) {
                  level = 2;
                }
              }
              
              // STRICT: Only process Level 4 (Do Not Travel) - skip Level 3 and security alerts
              // Level 3 is too common and includes routine advisories
              if (level >= 4) {
                const advisory = {
                  id: item.guid || item.link || `embassy-${Date.now()}-${Math.random()}`,
                  country: country,
                  region: country,
                  level: level, // Only Level 4 reaches here
                  advisoryLevel: level,
                  levelText: getAdvisoryLevelText(level),
                  summary: content.substring(0, 500).replace(/<[^>]*>/g, ''),
                  description: content,
                  published: pubDate,
                  issued: pubDate,
                  url: item.link || 'https://travel.state.gov/',
                  countryCode: null,
                };
                
                advisories.push(advisory);
              }
            }
          }
        }
      } catch (feedError) {
        logger.warn('Failed to fetch from feed', { url: feedConfig.url, error: feedError.message });
        // Continue to next feed
        continue;
      }
    }
    
    logger.info('Total travel advisories processed', { count: advisories.length });
    
    return {
      features: advisories,
    };
  } catch (error) {
    logger.error('Failed to fetch travel advisories', error);
    throw error;
  }
}

/**
 * Process a single travel advisory
 */
async function processTravelAdvisory(advisory, logger) {
  // Process actual travel advisory data when available
  // Travel advisories typically include:
  // - Country/region
  // - Advisory level (1-4: Exercise Normal Precautions, Exercise Increased Caution, Reconsider Travel, Do Not Travel)
  // - Summary
  // - Date issued/updated
  // - Specific warnings
  
  if (!advisory || !advisory.id) {
    return null;
  }
  
  const advisoryId = advisory.id;
  const country = advisory.country || advisory.region || 'Unknown Country';
  const level = advisory.level || advisory.advisoryLevel || 1;
  const levelText = advisory.levelText || getAdvisoryLevelText(level);
  const summary = advisory.summary || advisory.description || '';
  const published = advisory.published || advisory.issued || new Date().toISOString();
  
  // CRITICAL FILTER: Skip routine updates/reissues that are NOT breaking news
  const upperSummary = (summary || '').toUpperCase();
  const upperDescription = (advisory.description || '').toUpperCase();
  const isRoutineUpdate = 
    upperSummary.includes('NO CHANGE TO THE ADVISORY LEVEL') ||
    upperSummary.includes('REISSUED') ||
    upperSummary.includes('MINOR EDIT') ||
    upperSummary.includes('PERIODIC REVIEW') ||
    upperSummary.includes('OBSOLETE') ||
    upperDescription.includes('NO CHANGE TO THE ADVISORY LEVEL') ||
    upperDescription.includes('REISSUED AFTER PERIODIC REVIEW') ||
    upperDescription.includes('MINOR EDITS') ||
    (upperSummary.includes('REISSUED') && !upperSummary.includes('LEVEL'));
  
  if (isRoutineUpdate) {
    logger.debug('Skipping routine travel advisory update', { 
      level, 
      country,
      reason: 'routine update/reissue with no level change'
    });
    return null; // Skip - not breaking news
  }
  
  // CRITICAL FILTER: Only process EXTREMELY SEVERE advisories
  // User requirement: Only truly newsworthy travel advisories, not routine/obvious ones
  
  // STRICT: Only Level 4 (Do Not Travel) - skip Level 3 (Reconsider Travel)
  // Level 3 is too common and includes routine advisories
  if (level < 4) {
    logger.debug('Skipping travel advisory - below Level 4', { level, country });
    return null; // Skip Level 1, 2, and 3 (normal/increased caution/reconsider)
  }
  
  // Map advisory level to severity (Level 4 = severity 5)
  const normalizedSeverity = 5; // Only Level 4 reaches here
  const locationDisplay = cleanLocation(country);
  const canonicalId = buildCanonicalId('embassy', advisoryId);
  
  const event = {
    canonical_id: canonicalId,
    engine: 'embassy',
    event_type: 'travel',
    severity: normalizedSeverity,
    title: `Travel Advisory Level ${level} - ${locationDisplay}`,
    summary: `${levelText} issued for ${locationDisplay}. ${summary.substring(0, 200)}...`,
    location_display: locationDisplay,
    country_code: advisory.countryCode || null,
    lat: advisory.lat || null,
    lon: advisory.lon || null,
    geobox: null,
    source_name: 'State Department',
    source_url: advisory.url || `https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html`,
    published_at: published,
    updated_at_source: advisory.updated ? new Date(advisory.updated).toISOString() : null,
    fetched_at: new Date().toISOString(),
    status: 'active',
    tags: ['travel', 'embassy', `level_${level}`, country.toLowerCase().replace(/\s+/g, '_'), 'breaking'],
    assets: {},
    image_url: null,
    alert_sent: false,
    alert_sent_at: null,
    raw: advisory,
  };
  
  // Check for existing event to detect level changes
  // Use maybeSingle() instead of single() to avoid throwing on "no rows found"
  // This properly handles new advisories and doesn't mask database errors
  const { data: existingEvent, error: queryError } = await supabase
    .from('verified_events')
    .select('severity, alert_sent')
    .eq('canonical_id', canonicalId)
    .maybeSingle();
  
  // Log query errors (but don't fail - might be a new advisory)
  if (queryError && queryError.code !== 'PGRST116') {
    logger.warn('Error querying existing event', queryError, { canonicalId });
  }
  
  // Determine previous level from existing event
  // Severity mapping: Level 3 = severity 4, Level 4 = severity 5
  let previousLevel = null;
  if (existingEvent && existingEvent.severity) {
    previousLevel = existingEvent.severity === 5 ? 4 : (existingEvent.severity === 4 ? 3 : null);
  }
  
  const { isNew, event: storedEvent } = await storeEvent(event, logger);
  
  // Create website post
  if (isNew) {
    try {
      await createPostFromEvent(storedEvent, 'Travel Advisory', 'State Department');
      logger.info('Website post created', { canonical_id: canonicalId });
    } catch (postError) {
      logger.warn('Failed to create website post', postError);
    }
  }
  
  // CRITICAL EMAIL FILTER: Only send emails when level CHANGES
  // User requirement: Only alert when level changes from 3→4 or 4→3
  // Skip if country stays at same level (even if it's Level 4)
  const levelChanged = previousLevel !== null && previousLevel !== level;
  const isSignificantChange = levelChanged && (
    (previousLevel === 3 && level === 4) || // Upgraded to Do Not Travel
    (previousLevel === 4 && level === 3) || // Downgraded from Do Not Travel
    (previousLevel === 2 && level === 4) ||  // Jumped from Level 2 to 4
    (previousLevel === 1 && level === 4)    // Jumped from Level 1 to 4
  );
  
  // CRITICAL: Only send email if:
  // 1. Level changed significantly (3→4, 4→3, 2→4, 1→4) - this is the PRIMARY condition
  // 2. OR it's a brand new Level 4 advisory (no previous level) - only for truly new advisories
  // 3. NEVER send if level didn't change (even if it's Level 4 and isNew)
  // 4. NEVER send if already sent
  // CRITICAL FIX: If previousLevel === level, NEVER send email (even if isNew)
  const shouldSendEmail = (
    !storedEvent.alert_sent && // Must not have sent already
    (
      isSignificantChange || // Level changed significantly (PRIMARY condition)
      (isNew && level === 4 && previousLevel === null) // OR brand new Level 4 (no previous record)
    ) &&
    !(previousLevel !== null && previousLevel === level) // NEVER send if level stayed the same
  );
  
  if (shouldSendEmail) {
    logger.info('Sending travel advisory email - level changed or new Level 4', {
      country,
      previousLevel,
      currentLevel: level,
      isNew,
      levelChanged,
      isSignificantChange
    });
    
    // CRITICAL: Mark as sent BEFORE calling sendEventAlert to prevent race conditions
    const markSentResult = await supabase
      .from('verified_events')
      .update({
        alert_sent: true,
        alert_sent_at: new Date().toISOString(),
      })
      .eq('canonical_id', canonicalId)
      .eq('alert_sent', false); // Only update if still false (atomic check-and-set)
    
    // If update affected 0 rows, another process already marked it as sent
    if (markSentResult.data === null || (markSentResult.data && markSentResult.data.length === 0)) {
      const { data: checkData } = await supabase
        .from('verified_events')
        .select('alert_sent')
        .eq('canonical_id', canonicalId)
        .single();
      
      if (checkData && checkData.alert_sent) {
        logger.info('Skipping email - another process already sent it', { canonical_id: canonicalId });
        return { isNew, event: storedEvent };
      }
    }
    
    const alertSent = await sendEventAlert(storedEvent, 'Travel Advisory', 'State Department', null);
    if (alertSent) {
      storedEvent.alert_sent = true;
      storedEvent.alert_sent_at = new Date().toISOString();
    } else {
      // If email failed, reset alert_sent so we can retry
      await supabase
        .from('verified_events')
        .update({
          alert_sent: false,
          alert_sent_at: null,
        })
        .eq('canonical_id', canonicalId);
      logger.warn('Failed to send email - will retry on next run', { canonical_id: canonicalId });
    }
  } else {
    const reason = !isNew ? 'not a new event' :
                   storedEvent.alert_sent ? 'already sent' :
                   !isSignificantChange && previousLevel !== null ? 'no level change' :
                   level !== 4 || previousLevel !== null ? 'not a new Level 4' :
                   'unknown';
    logger.debug('Skipping travel advisory email', { 
      country,
      previousLevel,
      currentLevel: level,
      normalizedSeverity, 
      isNew, 
      levelChanged,
      isSignificantChange,
      alert_sent: storedEvent.alert_sent,
      reason
    });
  }
  
  return { isNew, event: storedEvent };
}

/**
 * Get advisory level text
 */
function getAdvisoryLevelText(level) {
  const levels = {
    1: 'Exercise Normal Precautions',
    2: 'Exercise Increased Caution',
    3: 'Reconsider Travel',
    4: 'Do Not Travel',
  };
  return levels[level] || `Level ${level} Advisory`;
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
 * Run Embassy engine
 */
async function run(logger) {
  try {
    logger.info('Starting Embassy engine run');
    
    const advisoryData = await fetchTravelAdvisories(logger);
  
    if (!advisoryData || !advisoryData.features || advisoryData.features.length === 0) {
      logger.info('No travel advisories found (State Department API requires proper integration)');
  return {
    success: true,
    count_new: 0,
    count_updated: 0,
    count_total_seen: 0,
  };
}

    logger.info('Processing travel advisories', { count: advisoryData.features.length });
    
    let countNew = 0;
    let countUpdated = 0;
    let countErrors = 0;
    
    for (const advisory of advisoryData.features) {
      try {
        const result = await processTravelAdvisory(advisory, logger);
        if (result) {
          if (result.isNew) {
            countNew++;
          } else {
            countUpdated++;
          }
        }
      } catch (error) {
        logger.error('Error processing travel advisory', error);
        countErrors++;
      }
    }
    
    logger.info('Embassy engine run completed', {
      total_seen: advisoryData.features.length,
      new: countNew,
      updated: countUpdated,
      errors: countErrors,
    });
    
    return {
      success: true,
      count_new: countNew,
      count_updated: countUpdated,
      count_total_seen: advisoryData.features.length,
    };
  } catch (error) {
    logger.error('Fatal error in Embassy engine', error);
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
};
