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

    // Unified alert dispatch: if USE_UNIFIED_ALERTS is enabled,
    // route new events through the central notification pipeline.
    // This runs alongside (not instead of) each engine's own notification
    // logic until the migration is complete.
    if (process.env.USE_UNIFIED_ALERTS === 'true' && result.success && result.notifiableEvents?.length > 0) {
      try {
        const { createAlertEvent } = require('./lib/alertEvent');
        const { notifyForEvent } = require('./lib/notifyForEvent');

        for (const raw of result.notifiableEvents) {
          try {
            const alertEvent = createAlertEvent(raw);
            const notifyResult = await notifyForEvent(alertEvent, { logger, dryRun: isDryRun() });
            logger.info('[unified-alert] Dispatched', {
              id: alertEvent.id,
              type: alertEvent.type,
              email: notifyResult.email?.sent || false,
              push: notifyResult.push?.sent || 0,
            });
          } catch (notifyErr) {
            logger.warn('[unified-alert] Dispatch failed for event', {
              id: raw.id,
              error: notifyErr.message,
            });
          }
        }
      } catch (unifiedErr) {
        logger.error('[unified-alert] Module load failed', unifiedErr);
      }
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
          count_notifiable: result.notifiableEvents?.length || 0,
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
    
    // RSS ingestion is handled by the separate ingest-live-events function,
    // which uses the shared src/rss/parser.js and src/rss/feeds.js.
    // This orchestrator focuses solely on hazard engine runs.
    results.rss_ingestion = {
      skipped: true,
      reason: 'handled_by_ingest_live_events'
    };
    
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

// Scheduled + background: returns 202 immediately, runs up to 15 min (avoids 499 from client timeout)
exports.config = {
  schedule: '*/5 * * * *',
  background: true,
};

