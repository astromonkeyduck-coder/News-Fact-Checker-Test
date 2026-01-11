/**
 * Netlify Scheduled Function: Ingest Live Events
 * 
 * Runs every 5 minutes to pull fresh events from:
 * 1. Our own site posts (authoritative)
 * 2. USGS earthquake feed
 * 3. Optional RSS feeds
 * 
 * Stores normalized items in Supabase live_events table.
 * Deduplicates by canonical_id.
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[Ingest] Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Generate canonical ID from source and identifier
 */
function generateCanonicalId(sourceName, identifier) {
  const hash = crypto.createHash('sha256');
  hash.update(`${sourceName}:${identifier}`);
  return hash.digest('hex').substring(0, 32);
}

/**
 * Ingest from our own site posts
 */
async function ingestOwnSitePosts() {
  try {
    // Fetch from our own posts API/endpoint
    // This would be your existing posts feed
    const response = await fetch('https://noteworthynews.co/.netlify/functions/get-posts', {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn('[Ingest] Failed to fetch own site posts:', response.status);
      return [];
    }

    const posts = await response.json();
    const events = [];

    for (const post of posts || []) {
      if (!post.id || !post.title) continue;

      const canonicalId = generateCanonicalId('noteworthy_news', post.id);
      const event = {
        canonical_id: canonicalId,
        title: post.title,
        summary: post.excerpt || post.content?.substring(0, 500) || null,
        source_name: 'Noteworthy News',
        source_url: `https://noteworthynews.co/posts/${post.id}`,
        published_at: post.createdAt || post.datePosted || new Date().toISOString(),
        fetched_at: new Date().toISOString(),
        tags: post.tags || [],
        reliability: 'official',
        raw_json: post
      };

      events.push(event);
    }

    return events;
  } catch (error) {
    console.error('[Ingest] Error ingesting own site posts:', error);
    return [];
  }
}

/**
 * Ingest from USGS earthquake feed
 */
async function ingestUSGSEarthquakes() {
  try {
    // USGS Earthquake API - last 24 hours, magnitude 2.5+
    const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
    const response = await fetch(url);

    if (!response.ok) {
      console.warn('[Ingest] Failed to fetch USGS earthquakes:', response.status);
      return [];
    }

    const data = await response.json();
    const events = [];

    for (const feature of data.features || []) {
      const props = feature.properties;
      const id = feature.id;

      if (!id || !props.title) continue;

      const canonicalId = generateCanonicalId('usgs', id);
      const magnitude = props.mag || 0;
      const location = props.place || 'Unknown location';

      const event = {
        canonical_id: canonicalId,
        title: `Earthquake: ${magnitude.toFixed(1)} magnitude at ${location}`,
        summary: `Magnitude ${magnitude.toFixed(1)} earthquake occurred at ${location}. Time: ${new Date(props.time).toISOString()}`,
        source_name: 'USGS',
        source_url: props.url || `https://earthquake.usgs.gov/earthquakes/eventpage/${id}`,
        published_at: new Date(props.time).toISOString(),
        fetched_at: new Date().toISOString(),
        tags: ['earthquake', `magnitude_${Math.floor(magnitude)}`],
        reliability: 'official',
        raw_json: feature
      };

      events.push(event);
    }

    return events;
  } catch (error) {
    console.error('[Ingest] Error ingesting USGS earthquakes:', error);
    return [];
  }
}

/**
 * Ingest from RSS feeds using existing RSS infrastructure
 */
async function ingestRSSFeeds() {
  try {
    // Load RSS feeds from our existing configuration
    // Use lazy loading pattern (same as rss-aggregate.js and rss-feed.js)
    let RSS_FEEDS;
    let parseFeed;
    let moduleLoadError = null;
    
    // Lazy load modules to prevent bundling issues
    function loadModules() {
      if (RSS_FEEDS && parseFeed) {
        return { RSS_FEEDS, parseFeed };
      }
      
      if (moduleLoadError) {
        throw moduleLoadError;
      }
      
      try {
        const feedsModule = require('../../src/rss/feeds.js');
        RSS_FEEDS = feedsModule.RSS_FEEDS || feedsModule.default?.RSS_FEEDS;
        if (!RSS_FEEDS || !Array.isArray(RSS_FEEDS)) {
          throw new Error('RSS_FEEDS is not an array');
        }
      } catch (error) {
        moduleLoadError = new Error(`Failed to load RSS feeds: ${error.message}`);
        console.error('[Ingest] Failed to load RSS feeds module:', error);
        throw moduleLoadError;
      }
      
      try {
        const parserModule = require('../../src/rss/parser.js');
        parseFeed = parserModule.parseFeed || parserModule.default?.parseFeed;
        if (typeof parseFeed !== 'function') {
          throw new Error('parseFeed is not a function');
        }
      } catch (error) {
        moduleLoadError = new Error(`Failed to load RSS parser: ${error.message}`);
        console.error('[Ingest] Failed to load RSS parser module:', error);
        throw moduleLoadError;
      }
      
      return { RSS_FEEDS, parseFeed };
    }
    
    try {
      loadModules();
    } catch (error) {
      // Log error clearly instead of silently returning empty array
      console.error('[Ingest] RSS module loading failed - RSS ingestion disabled:', error.message);
      console.error('[Ingest] This may be due to bundling configuration. Check netlify.toml included_files.');
      return [];
    }

    if (!RSS_FEEDS || !Array.isArray(RSS_FEEDS) || RSS_FEEDS.length === 0) {
      console.warn('[Ingest] No RSS feeds configured');
      return [];
    }

    if (!parseFeed || typeof parseFeed !== 'function') {
      console.error('[Ingest] parseFeed is not a function');
      return [];
    }

    const events = [];
    
    // Process enabled feeds (limit to 20 feeds to avoid timeout)
    const enabledFeeds = RSS_FEEDS.filter(feed => feed.enabledByDefault).slice(0, 20);
    console.log(`[Ingest] Processing ${enabledFeeds.length} RSS feeds...`);

    for (const feed of enabledFeeds) {
      try {
        if (!feed.feedUrl || !feed.id) {
          console.warn(`[Ingest] Skipping feed ${feed.name || 'unknown'}: missing feedUrl or id`);
          continue;
        }

        // Use rss-parser to fetch and parse the feed
        // parseFeed expects (feedUrl, feedConfig)
        const parsed = await parseFeed(feed.feedUrl, feed);
        
        if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
          console.warn(`[Ingest] No items found in feed ${feed.name || feed.id}`);
          continue;
        }

        console.log(`[Ingest] Parsed ${parsed.length} items from ${feed.name || feed.id}`);

        // Process each item (limit to 50 items per feed to avoid overwhelming the database)
        const itemsToProcess = parsed.slice(0, 50);
        
        for (const item of itemsToProcess) {
          if (!item.url) {
            continue; // Skip items without URLs
          }

          const itemUrl = item.url;
          const itemId = item.id || itemUrl;
          const canonicalId = generateCanonicalId(feed.id || feed.name || 'rss', itemId);

          // Extract published date (already normalized by parseFeed)
          const publishedAt = item.publishedAt || new Date().toISOString();

          // Build tags from feed regions and topics
          const tags = [];
          if (feed.regions && Array.isArray(feed.regions)) {
            tags.push(...feed.regions.map(r => r.toLowerCase()));
          }
          if (feed.topics && Array.isArray(feed.topics)) {
            tags.push(...feed.topics.map(t => t.toLowerCase()));
          }
          if (item.categories && Array.isArray(item.categories)) {
            tags.push(...item.categories.map(c => c.toLowerCase()));
          }
          tags.push('rss', feed.id || 'rss-feed');

          const event = {
            canonical_id: canonicalId,
            title: item.title || 'Untitled',
            summary: item.snippet || null,
            source_name: feed.name || 'RSS Feed',
            source_url: itemUrl,
            published_at: publishedAt,
            fetched_at: new Date().toISOString(),
            tags: tags,
            reliability: 'major_media', // RSS feeds are generally major media sources
            raw_json: {
              feed_id: feed.id,
              feed_name: feed.name,
              feed_homepage: feed.homepage,
              item: item
            }
          };

          events.push(event);
        }
      } catch (error) {
        console.error(`[Ingest] Error ingesting RSS feed ${feed.name || feed.id}:`, error.message);
        // Continue with other feeds
      }
    }

    console.log(`[Ingest] Processed ${events.length} RSS events from ${enabledFeeds.length} feeds`);
    return events;
  } catch (error) {
    console.error('[Ingest] Error ingesting RSS feeds:', error);
    return [];
  }
}

/**
 * Store events in database with deduplication
 */
async function storeEvents(events) {
  if (events.length === 0) {
    return { inserted: 0, updated: 0, skipped: 0 };
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const event of events) {
    try {
      // Check if event already exists
      const { data: existing } = await supabase
        .from('live_events')
        .select('canonical_id')
        .eq('canonical_id', event.canonical_id)
        .single();

      if (existing) {
        // Update existing event (refresh fetched_at)
        const { error } = await supabase
          .from('live_events')
          .update({
            fetched_at: event.fetched_at,
            updated_at: new Date().toISOString(),
            // Optionally update other fields if source data changed
            title: event.title,
            summary: event.summary,
            raw_json: event.raw_json
          })
          .eq('canonical_id', event.canonical_id);

        if (error) {
          console.error(`[Ingest] Error updating event ${event.canonical_id}:`, error);
          skipped++;
        } else {
          updated++;
        }
      } else {
        // Insert new event
        const { error } = await supabase
          .from('live_events')
          .insert(event);

        if (error) {
          console.error(`[Ingest] Error inserting event ${event.canonical_id}:`, error);
          skipped++;
        } else {
          inserted++;
        }
      }
    } catch (error) {
      console.error(`[Ingest] Error processing event ${event.canonical_id}:`, error);
      skipped++;
    }
  }

  return { inserted, updated, skipped };
}

/**
 * Main handler
 */
exports.handler = async (event, context) => {
  console.log('[Ingest] Starting live events ingestion...');

  try {
    // Ingest from all sources
    const [ownSiteEvents, usgsEvents, rssEvents] = await Promise.all([
      ingestOwnSitePosts(),
      ingestUSGSEarthquakes(),
      ingestRSSFeeds()
    ]);

    const allEvents = [...ownSiteEvents, ...usgsEvents, ...rssEvents];
    console.log(`[Ingest] Fetched ${allEvents.length} events total`);

    // Store in database
    const result = await storeEvents(allEvents);
    console.log(`[Ingest] Stored: ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        fetched: allEvents.length,
        stored: result.inserted + result.updated,
        details: result
      })
    };
  } catch (error) {
    console.error('[Ingest] Fatal error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

// Note: For Netlify Scheduled Functions, the schedule is configured in netlify.toml
// This function should be called every 5 minutes

