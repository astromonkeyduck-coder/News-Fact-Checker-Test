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

// Try to load dependencies - handle errors gracefully
try {
  console.log('[ingest-all] Loading dependencies...');
  supabase = require('./lib/supabaseClient');
  console.log('[ingest-all] ✓ Supabase client loaded');
  
  const loggerModule = require('./lib/logger');
  createLogger = loggerModule.createLogger;
  console.log('[ingest-all] ✓ Logger loaded');
  
  // Explicitly require all engines so zisi bundler can find them
  // This helps zisi understand the dependencies at build time
  console.log('[ingest-all] Loading engines...');
  engines = {};
  
  const engineList = ['usgs', 'nws', 'faa', 'uscg', 'volcano', 'embassy'];
  for (const engineName of engineList) {
    try {
      engines[engineName] = require(`./engines/${engineName}`);
      console.log(`[ingest-all] ✓ Engine ${engineName} loaded`);
    } catch (engineError) {
      console.error(`[ingest-all] ✗ Failed to load engine ${engineName}:`, engineError.message);
      // Continue loading other engines
    }
  }
  
  console.log('[ingest-all] ✓ All dependencies loaded');
} catch (initError) {
  console.error('[ingest-all] Initialization error:', initError);
  console.error('[ingest-all] Error stack:', initError.stack);
  // Will be handled in handler
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
  
  // Check if dependencies loaded successfully
  if (!supabase) {
    const errorMsg = 'Supabase client not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.';
    console.error(`[ingest-all] ${errorMsg}`);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: errorMsg,
        hint: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Netlify environment variables',
      }),
    };
  }
  
  if (!engines || !createLogger) {
    const errorMsg = 'Engines or logger not initialized. Check function dependencies.';
    console.error(`[ingest-all] ${errorMsg}`);
    console.error('[ingest-all] engines:', !!engines, 'createLogger:', !!createLogger);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: errorMsg,
      }),
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
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        error_type: error.name,
        stack: process.env.NETLIFY_DEV ? error.stack : undefined,
      }),
    };
  }
};

// Scheduled function configuration
exports.config = {
  schedule: '*/5 * * * *', // Every 5 minutes
};

