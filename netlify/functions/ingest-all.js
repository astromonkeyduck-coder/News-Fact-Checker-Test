/**
 * Verified Events Engine - Main Ingestion Runner
 * Scheduled function that runs all enabled engines sequentially
 * 
 * Schedule: Every 5 minutes (configure in Netlify Dashboard)
 * Cron expression: 0,5,10,15,20,25,30,35,40,45,50,55 * * * *
 * Configure in Netlify Dashboard → Functions → ingest-all → Schedule
 */

let supabase;
let createLogger;
let engines;
let initError = null; // Store initialization error for handler

// Try to load dependencies - handle errors gracefully
try {
  console.log('[ingest-all] Loading dependencies...');
  
  // Load Supabase client
  try {
    supabase = require('./lib/supabaseClient');
    console.log('[ingest-all] ✓ Supabase client loaded');
  } catch (supabaseError) {
    console.error('[ingest-all] ⚠️ Failed to load Supabase client:', supabaseError.message);
    throw new Error(`Supabase client load failed: ${supabaseError.message}`);
  }
  
  // Load logger
  try {
    const loggerModule = require('./lib/logger');
    createLogger = loggerModule.createLogger;
    if (typeof createLogger !== 'function') {
      throw new Error('createLogger is not a function - check lib/logger.js exports');
    }
    console.log('[ingest-all] ✓ Logger loaded');
  } catch (loggerError) {
    console.error('[ingest-all] ⚠️ Failed to load logger:', loggerError.message);
    throw new Error(`Logger load failed: ${loggerError.message}`);
  }
  
  // Explicitly require all engines so zisi bundler can find them
  // This helps zisi understand the dependencies at build time
  // NOTE: Must use static requires (not dynamic) for zisi bundler to work
  console.log('[ingest-all] Loading engines...');
  engines = {};
  
  // Load engines with individual error handling
  // CRITICAL: Use static requires (not template strings) for zisi bundler
  // Wrap each require in a function to allow zisi to statically analyze them
  const engineLoaders = [
    { name: 'usgs', loader: () => require('./engines/usgs') },
    { name: 'nws', loader: () => require('./engines/nws') },
    { name: 'faa', loader: () => require('./engines/faa') },
    { name: 'uscg', loader: () => require('./engines/uscg') },
    { name: 'volcano', loader: () => require('./engines/volcano') },
    { name: 'embassy', loader: () => require('./engines/embassy') },
  ];
  
  let enginesLoaded = 0;
  let enginesFailed = 0;
  
  for (const { name, loader } of engineLoaders) {
    try {
      console.log(`[ingest-all] Attempting to load engine: ${name}`);
      const engineModule = loader();
      if (engineModule) {
        engines[name] = engineModule;
        enginesLoaded++;
        console.log(`[ingest-all] ✓ Engine ${name} loaded successfully`);
      } else {
        console.error(`[ingest-all] ⚠️ Engine ${name} returned null/undefined`);
        enginesFailed++;
      }
    } catch (engineError) {
      enginesFailed++;
      console.error(`[ingest-all] ⚠️ Failed to load engine ${name}:`, {
        message: engineError.message,
        name: engineError.name,
        code: engineError.code,
        stack: engineError.stack?.substring(0, 500)
      });
      // Don't throw - continue loading other engines
      // The handler will check if engines are available
    }
  }
  
  console.log(`[ingest-all] Engine loading summary: ${enginesLoaded} loaded, ${enginesFailed} failed`);
  
  if (Object.keys(engines).length === 0) {
    throw new Error(`No engines loaded successfully (${enginesFailed} failed) - check engine files exist in netlify/functions/engines/ and dependencies are bundled`);
  }
  
  console.log(`[ingest-all] ✓ ${Object.keys(engines).length} engines loaded:`, Object.keys(engines));
  console.log('[ingest-all] ✓ All dependencies loaded');
} catch (error) {
  initError = error;
  console.error('[ingest-all] Initialization error:', error);
  console.error('[ingest-all] Error name:', error.name);
  console.error('[ingest-all] Error message:', error.message);
  console.error('[ingest-all] Error stack:', error.stack);
  // Will be handled in handler - don't throw here
}

const crypto = require('crypto');

/**
 * Check if an engine is enabled
 */
function isEngineEnabled(engine) {
  const envVar = `ENABLE_${engine.toUpperCase()}`;
  const value = process.env[envVar];
  return value === 'true' || value === '1';
}

/**
 * Check if we're in dry run mode
 */
function isDryRun() {
  return process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1';
}

/**
 * Run a single engine
 */
async function runEngine(engineName) {
  const runId = crypto.randomUUID();
  const logger = createLogger(engineName, runId);
  
  // Start engine run record
  const { data: runRecord, error: runError } = await supabase
    .from('engine_runs')
    .insert({
      engine: engineName,
      started_at: new Date().toISOString(),
      ok: false,
    })
    .select()
    .single();
  
  if (runError) {
    logger.error('Failed to create engine run record', runError);
    return { success: false, error: runError.message };
  }
  
  try {
    logger.info('Starting engine run');
    
    // Get engine module from pre-loaded engines object
    // This works better with zisi bundler than dynamic requires
    let engineModule;
    try {
      engineModule = engines[engineName];
      if (!engineModule) {
        throw new Error(`Engine ${engineName} not found in engines object`);
      }
    } catch (requireError) {
      logger.error('Engine module not found', requireError);
      await supabase
        .from('engine_runs')
        .update({
          finished_at: new Date().toISOString(),
          ok: false,
          error: `Engine module not found: ${requireError.message}`,
        })
        .eq('id', runRecord.id);
      return { success: false, error: 'Engine module not found' };
    }
    
    // Run the engine
    const result = await engineModule.run(logger);
    
    // Update engine run record
    await supabase
      .from('engine_runs')
      .update({
        finished_at: new Date().toISOString(),
        ok: result.success,
        count_new: result.count_new || 0,
        count_updated: result.count_updated || 0,
        count_total_seen: result.count_total_seen || 0,
        error: result.error || null,
      })
      .eq('id', runRecord.id);
    
    if (result.success) {
      logger.summary({
        count_ingested: result.count_total_seen || 0,
        count_new: result.count_new || 0,
        count_updated: result.count_updated || 0,
      });
    } else {
      logger.error('Engine run failed', null, { error: result.error });
    }
    
    return result;
  } catch (error) {
    logger.error('Fatal error in engine run', error);
    
    // Update engine run record with error
    await supabase
      .from('engine_runs')
      .update({
        finished_at: new Date().toISOString(),
        ok: false,
        error: error.message,
      })
      .eq('id', runRecord.id);
    
    return { success: false, error: error.message };
  }
}

/**
 * Main handler
 */
exports.handler = async (event, context) => {
  const startTime = Date.now();
  const getRemainingTime = () => {
    if (context && typeof context.getRemainingTimeInMillis === 'function') {
      return context.getRemainingTimeInMillis();
    }
    // Fallback: assume 26 seconds for pro tier, 10 seconds for free tier
    const elapsed = Date.now() - startTime;
    return Math.max(2000, 26000 - elapsed); // Leave 2 seconds buffer
  };
  
  console.log('[ingest-all] Handler invoked');
  console.log('[ingest-all] Remaining time:', getRemainingTime(), 'ms');

  // CRITICAL: Check if dependencies loaded successfully with detailed error info
  if (!supabase) {
    const errorMsg = 'Supabase client not initialized';
    const errorDetails = {
      success: false,
      error: errorMsg,
      hint: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Netlify environment variables',
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      initError: initError ? {
        message: initError.message,
        name: initError.name
      } : null
    };
    console.error(`[ingest-all] ${errorMsg}:`, errorDetails);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errorDetails),
    };
  }
  
  if (!createLogger) {
    const errorMsg = 'Logger not initialized';
    const errorDetails = {
      success: false,
      error: errorMsg,
      hint: 'Check lib/logger.js exists and exports createLogger',
      initError: initError ? {
        message: initError.message,
        name: initError.name
      } : null
    };
    console.error(`[ingest-all] ${errorMsg}:`, errorDetails);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errorDetails),
    };
  }
  
  // CRITICAL: Check if engines loaded
  if (!engines || Object.keys(engines).length === 0) {
    const errorMsg = 'No engines loaded';
    const errorDetails = {
      success: false,
      error: errorMsg,
      hint: 'Check that engine files exist in netlify/functions/engines/',
      initError: initError ? {
        message: initError.message,
        name: initError.name
      } : null,
      enginesDir: 'netlify/functions/engines/'
    };
    console.error(`[ingest-all] ${errorMsg}:`, errorDetails);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errorDetails),
    };
  }
  
  try {
    const dryRun = isDryRun();
    console.log(`[ingest-all] Starting ingestion run (DRY_RUN=${dryRun})`);
    console.log(`[ingest-all] Available engines:`, Object.keys(engines));
    
    const engineList = ['usgs', 'nws', 'faa', 'uscg', 'volcano', 'embassy'];
    const results = {
      started_at: new Date().toISOString(),
      dry_run: dryRun,
      engines: {},
      summary: {
        total_engines: 0,
        enabled_engines: 0,
        successful: 0,
        failed: 0,
      },
    };
    
    // Run each enabled engine sequentially
    for (const engine of engineList) {
      // Check timeout before each engine
      const remaining = getRemainingTime();
      if (remaining < 5000) {
        console.warn(`[ingest-all] ⚠️ Low time remaining (${remaining}ms), skipping remaining engines`);
        results.summary.timeout_warning = true;
        break;
      }
      
      const enabled = isEngineEnabled(engine);
      results.summary.total_engines++;
      
      if (!enabled) {
        console.log(`[ingest-all] Engine ${engine} is disabled (ENABLE_${engine.toUpperCase()}=false)`);
        results.engines[engine] = { enabled: false, skipped: true };
        continue;
      }
      
      // Check if engine module exists
      if (!engines[engine]) {
        console.error(`[ingest-all] Engine ${engine} module not found`);
        results.engines[engine] = {
          enabled: true,
          success: false,
          error: 'Engine module not loaded',
        };
        results.summary.failed++;
        continue;
      }
      
      results.summary.enabled_engines++;
      console.log(`[ingest-all] Running engine: ${engine} (${remaining}ms remaining)`);
      
      try {
        const engineStartTime = Date.now();
        const result = await runEngine(engine);
        const engineDuration = Date.now() - engineStartTime;
        console.log(`[ingest-all] Engine ${engine} completed in ${engineDuration}ms`);
        
        results.engines[engine] = {
          enabled: true,
          success: result.success,
          count_new: result.count_new || 0,
          count_updated: result.count_updated || 0,
          count_total_seen: result.count_total_seen || 0,
          error: result.error || null,
          duration_ms: engineDuration,
        };
        
        if (result.success) {
          results.summary.successful++;
        } else {
          results.summary.failed++;
        }
      } catch (error) {
        console.error(`[ingest-all] Fatal error running engine ${engine}:`, error);
        console.error(`[ingest-all] Error stack:`, error.stack);
        results.engines[engine] = {
          enabled: true,
          success: false,
          error: error.message,
          error_type: error.name,
        };
        results.summary.failed++;
      }
    }
    
    // Ingest RSS feeds and store in live_events table
    try {
      const remaining = getRemainingTime();
      if (remaining > 10000) { // Only if we have at least 10 seconds left
        console.log('[ingest-all] Ingesting RSS feeds to live_events...');
        const rssStartTime = Date.now();
        
        // Import RSS ingestion functions from ingest-live-events
        const { createClient } = require('@supabase/supabase-js');
        const crypto = require('crypto');
        
        // Use the same Supabase client
        const rssSupabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        // RSS ingestion logic (extracted from ingest-live-events.js)
        // Try local config file first, then fall back to environment variable
        let feeds = [];
        try {
          feeds = require('./rss-feeds-config.js');
          if (feeds.length > 0) {
            console.log('[ingest-all] Loaded RSS feeds from config file');
          }
        } catch (e) {
          // Config file not found or empty, try env var
        }
        
        // Fall back to environment variable if config file is empty
        if (feeds.length === 0 && process.env.RSS_FEEDS_JSON) {
          feeds = JSON.parse(process.env.RSS_FEEDS_JSON);
          console.log('[ingest-all] Loaded RSS feeds from environment variable');
        }
        
        if (feeds.length > 0) {
          const events = [];
          
          // Simple RSS parser function
          function parseRSSBasic(xml) {
            const items = [];
            const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
            let match;
            
            while ((match = itemRegex.exec(xml)) !== null) {
              const itemXml = match[1];
              const titleMatch = itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
              const linkMatch = itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
              const guidMatch = itemXml.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
              const descMatch = itemXml.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
              const pubDateMatch = itemXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
              
              if (titleMatch || linkMatch) {
                items.push({
                  title: titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : 'Untitled',
                  link: linkMatch ? linkMatch[1].trim() : null,
                  guid: guidMatch ? guidMatch[1].trim() : null,
                  description: descMatch ? descMatch[1].replace(/<[^>]*>/g, '').trim() : null,
                  pubDate: pubDateMatch ? pubDateMatch[1].trim() : null
                });
              }
            }
            return items;
          }
          
          function generateCanonicalId(sourceName, identifier) {
            const hash = crypto.createHash('sha256');
            hash.update(`${sourceName}:${identifier}`);
            return hash.digest('hex').substring(0, 32);
          }
          
          // Fetch and parse RSS feeds
          // Support both optimized format (n/u) and full format (name/url) for backward compatibility
          for (const feed of feeds) {
            try {
              // Handle optimized format: {n: "Name", u: "url"} or full format: {name: "Name", url: "url"}
              const feedUrl = feed.u || feed.url;
              const feedName = feed.n || feed.name || 'RSS Feed';
              const feedTags = feed.tags || [];
              const feedReliability = feed.reliability || 'high';
              
              if (!feedUrl) {
                console.warn(`[ingest-all] Skipping feed without URL: ${feedName}`);
                continue;
              }
              
              const response = await fetch(feedUrl, { 
                headers: { 'User-Agent': 'NoteworthyNewsRSSBot/1.0' },
                signal: AbortSignal.timeout(8000) // 8 second timeout
              });
              if (!response.ok) continue;
              
              const text = await response.text();
              const items = parseRSSBasic(text);
              
              for (const item of items) {
                if (!item.guid && !item.link) continue;
                
                const identifier = item.guid || item.link;
                const canonicalId = generateCanonicalId(feedName, identifier);
                
                events.push({
                  canonical_id: canonicalId,
                  title: item.title || 'Untitled',
                  summary: item.description || null,
                  source_name: feedName,
                  source_url: item.link || null,
                  published_at: item.pubDate || new Date().toISOString(),
                  fetched_at: new Date().toISOString(),
                  tags: feedTags,
                  reliability: feedReliability,
                  raw_json: item
                });
              }
            } catch (error) {
              const feedUrl = feed.u || feed.url || 'unknown';
              console.error(`[ingest-all] Error ingesting RSS feed ${feedUrl}:`, error.message);
            }
          }
          
          // Store events in live_events table
          if (events.length > 0) {
            let inserted = 0;
            let updated = 0;
            let skipped = 0;
            
            for (const event of events) {
              try {
                const { data: existing } = await rssSupabase
                  .from('live_events')
                  .select('canonical_id')
                  .eq('canonical_id', event.canonical_id)
                  .single();
                
                if (existing) {
                  const { error } = await rssSupabase
                    .from('live_events')
                    .update({
                      fetched_at: event.fetched_at,
                      updated_at: new Date().toISOString(),
                      title: event.title,
                      summary: event.summary,
                      raw_json: event.raw_json
                    })
                    .eq('canonical_id', event.canonical_id);
                  
                  if (error) {
                    skipped++;
                  } else {
                    updated++;
                  }
                } else {
                  const { error } = await rssSupabase
                    .from('live_events')
                    .insert(event);
                  
                  if (error) {
                    skipped++;
                  } else {
                    inserted++;
                  }
                }
              } catch (error) {
                skipped++;
              }
            }
            
            const rssDuration = Date.now() - rssStartTime;
            console.log(`[ingest-all] RSS ingestion: ${inserted} inserted, ${updated} updated, ${skipped} skipped in ${rssDuration}ms`);
            
            results.rss_ingestion = {
              success: true,
              duration_ms: rssDuration,
              inserted,
              updated,
              skipped,
              total: events.length
            };
          } else {
            results.rss_ingestion = {
              success: true,
              skipped: true,
              reason: 'no_events_fetched'
            };
          }
        } else {
          console.log('[ingest-all] No RSS feeds configured (check rss-feeds-config.js or RSS_FEEDS_JSON env var)');
          results.rss_ingestion = {
            skipped: true,
            reason: 'not_configured'
          };
        }
      } else {
        console.log('[ingest-all] Skipping RSS ingestion (low time remaining)');
        results.rss_ingestion = { skipped: true, reason: 'low_time_remaining' };
      }
    } catch (rssError) {
      console.error('[ingest-all] RSS ingestion error:', rssError);
      results.rss_ingestion = {
        success: false,
        error: rssError.message
      };
    }
    
    results.finished_at = new Date().toISOString();
    results.duration_ms = Date.now() - startTime;
    console.log(`[ingest-all] Completed in ${results.duration_ms}ms: ${results.summary.successful} successful, ${results.summary.failed} failed`);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(results, null, 2),
    };
  } catch (error) {
    console.error('[ingest-all] Fatal error in handler:', error);
    console.error('[ingest-all] Error name:', error.name);
    console.error('[ingest-all] Error message:', error.message);
    console.error('[ingest-all] Error stack:', error.stack);
    
    // CRITICAL: Return detailed error info for debugging
    const errorResponse = {
      success: false,
      error: error.message || 'Internal server error',
      error_type: error.name || 'Error',
      timestamp: new Date().toISOString(),
      hasSupabase: !!supabase,
      hasLogger: !!createLogger,
      enginesLoaded: engines ? Object.keys(engines).length : 0,
      initError: initError ? {
        message: initError.message,
        name: initError.name
      } : null
    };
    
    // Only include stack in dev mode
    if (process.env.NETLIFY_DEV || process.env.NODE_ENV === 'development') {
      errorResponse.stack = error.stack;
      errorResponse.initErrorStack = initError?.stack;
    }
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errorResponse),
    };
  }
};

// Scheduled function configuration
exports.config = {
  schedule: '*/5 * * * *', // Every 5 minutes
};

