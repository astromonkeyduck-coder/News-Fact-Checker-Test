/**
 * Health endpoint for Verified Events Engine
 * Returns status of all engines and last run information
 * 
 * GET /.netlify/functions/health
 */

const supabase = require('./lib/supabaseClient');

/**
 * Check if an engine is enabled via environment variable
 */
function isEngineEnabled(engine) {
  const envVar = `ENABLE_${engine.toUpperCase()}`;
  const value = process.env[envVar];
  return value === 'true' || value === '1';
}

/**
 * Get last successful run for an engine
 */
async function getLastRun(engine) {
  try {
    const { data, error } = await supabase
      .from('engine_runs')
      .select('*')
      .eq('engine', engine)
      .eq('ok', true)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return {
      started_at: data.started_at,
      finished_at: data.finished_at,
      count_new: data.count_new,
      count_updated: data.count_updated,
      count_total_seen: data.count_total_seen,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Get last error for an engine
 */
async function getLastError(engine) {
  try {
    const { data, error } = await supabase
      .from('engine_runs')
      .select('error, started_at')
      .eq('engine', engine)
      .eq('ok', false)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return {
      error: data.error,
      started_at: data.started_at,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Main handler
 */
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
  
  // Handle OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  
  try {
    const engines = ['usgs', 'nws', 'faa', 'uscg', 'volcano', 'embassy'];
    const health = {
      dry_run: process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1',
      engines: {},
      timestamp: new Date().toISOString(),
    };
    
    // Check each engine
    for (const engine of engines) {
      const enabled = isEngineEnabled(engine);
      const lastSuccess = await getLastRun(engine);
      const lastError = await getLastError(engine);
      
      health.engines[engine] = {
        enabled,
        last_success: lastSuccess,
        last_error: lastError,
      };
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(health, null, 2),
    };
  } catch (error) {
    console.error('[health] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
    };
  }
};





