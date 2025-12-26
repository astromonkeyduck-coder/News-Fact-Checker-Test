/**
 * Verified Events Engine - Main Ingestion Runner
 * Scheduled function that runs all enabled engines sequentially
 * 
 * Schedule: Every 5 minutes (configure in Netlify Dashboard)
 * Cron expression: 0,5,10,15,20,25,30,35,40,45,50,55 * * * *
 * Configure in Netlify Dashboard → Functions → ingest-all → Schedule
 */

const supabase = require('./lib/supabaseClient');
const { createLogger } = require('./lib/logger');
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
    
    // Dynamically require the engine module
    let engineModule;
    try {
      engineModule = require(`./engines/${engineName}.js`);
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
 * CRITICAL: Add lock mechanism to prevent concurrent runs
 */
exports.handler = async (event, context) => {
  const dryRun = isDryRun();
  const runId = crypto.randomUUID();
  console.log(`[ingest-all] Starting ingestion run (DRY_RUN=${dryRun}, runId=${runId})`);
  
  // CRITICAL: Check if another run is already in progress
  // This prevents multiple concurrent runs from processing the same events
  try {
    const { data: activeRuns } = await supabase
      .from('engine_runs')
      .select('id, engine, started_at')
      .is('finished_at', null) // Only active runs
      .gte('started_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()) // Last 10 minutes
      .order('started_at', { ascending: false })
      .limit(5);
    
    if (activeRuns && activeRuns.length > 0) {
      const recentRun = activeRuns[0];
      const runAge = Date.now() - new Date(recentRun.started_at).getTime();
      // If there's a run that started less than 2 minutes ago, skip this run to prevent duplicates
      if (runAge < 2 * 60 * 1000) {
        console.log(`[ingest-all] ⚠️ Another run is in progress (started ${Math.round(runAge / 1000)}s ago) - skipping to prevent duplicates`, {
          activeRunId: recentRun.id,
          activeRunEngine: recentRun.engine,
          currentRunId: runId
        });
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            skipped: true,
            reason: 'Another run in progress',
            activeRunId: recentRun.id,
            runId: runId
          }),
        };
      }
    }
  } catch (lockError) {
    // If lock check fails, log but continue (don't block ingestion)
    console.warn('[ingest-all] ⚠️ Could not check for concurrent runs:', lockError.message);
  }
  
  const engines = ['usgs', 'nws', 'faa', 'uscg', 'volcano', 'embassy'];
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
  for (const engine of engines) {
    const enabled = isEngineEnabled(engine);
    results.summary.total_engines++;
    
    if (!enabled) {
      console.log(`[ingest-all] Engine ${engine} is disabled (ENABLE_${engine.toUpperCase()}=false)`);
      results.engines[engine] = { enabled: false, skipped: true };
      continue;
    }
    
    results.summary.enabled_engines++;
    console.log(`[ingest-all] Running engine: ${engine}`);
    
    try {
      const result = await runEngine(engine);
      results.engines[engine] = {
        enabled: true,
        success: result.success,
        count_new: result.count_new || 0,
        count_updated: result.count_updated || 0,
        count_total_seen: result.count_total_seen || 0,
        error: result.error || null,
      };
      
      if (result.success) {
        results.summary.successful++;
      } else {
        results.summary.failed++;
      }
    } catch (error) {
      console.error(`[ingest-all] Fatal error running engine ${engine}:`, error);
      results.engines[engine] = {
        enabled: true,
        success: false,
        error: error.message,
      };
      results.summary.failed++;
    }
  }
  
  results.finished_at = new Date().toISOString();
  results.runId = runId;
  console.log(`[ingest-all] Completed: ${results.summary.successful} successful, ${results.summary.failed} failed (runId=${runId})`);
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(results, null, 2),
  };
};

// Scheduled function configuration
exports.config = {
  schedule: '*/5 * * * *', // Every 5 minutes
};

