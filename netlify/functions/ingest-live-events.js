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
 * Ingest from RSS feeds (optional, configurable)
 */
async function ingestRSSFeeds() {
  try {
    const rssFeedsJson = process.env.RSS_FEEDS_JSON;
    if (!rssFeedsJson) {
      return []; // No RSS feeds configured
    }

    const feeds = JSON.parse(rssFeedsJson);
    const events = [];

    for (const feed of feeds) {
      try {
        // Simple RSS parsing - in production, use a proper RSS parser
        const response = await fetch(feed.url);
        if (!response.ok) continue;

        const text = await response.text();
        // Basic RSS parsing (simplified - use a library like rss-parser in production)
        const items = parseRSSBasic(text);

        for (const item of items) {
          if (!item.guid && !item.link) continue;

          const identifier = item.guid || item.link;
          const canonicalId = generateCanonicalId(feed.name || 'rss', identifier);

          const event = {
            canonical_id: canonicalId,
            title: item.title || 'Untitled',
            summary: item.description || item.content || null,
            source_name: feed.name || 'RSS Feed',
            source_url: item.link || null,
            published_at: item.pubDate || new Date().toISOString(),
            fetched_at: new Date().toISOString(),
            tags: feed.tags || [],
            reliability: feed.reliability || 'unknown',
            raw_json: item
          };

          events.push(event);
        }
      } catch (error) {
        console.error(`[Ingest] Error ingesting RSS feed ${feed.url}:`, error);
      }
    }

    return events;
  } catch (error) {
    console.error('[Ingest] Error ingesting RSS feeds:', error);
    return [];
  }
}

/**
 * Basic RSS parser (simplified - use rss-parser library in production)
 */
function parseRSSBasic(xml) {
  const items = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const item = {};

    const titleMatch = itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) item.title = titleMatch[1].trim();

    const linkMatch = itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
    if (linkMatch) item.link = linkMatch[1].trim();

    const descMatch = itemXml.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
    if (descMatch) item.description = descMatch[1].trim();

    const guidMatch = itemXml.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
    if (guidMatch) item.guid = guidMatch[1].trim();

    const pubDateMatch = itemXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
    if (pubDateMatch) item.pubDate = pubDateMatch[1].trim();

    if (item.title || item.link) {
      items.push(item);
    }
  }

  return items;
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

