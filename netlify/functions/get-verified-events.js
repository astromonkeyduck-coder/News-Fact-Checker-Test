/**
 * Get verified events from all engines
 * Returns events from verified_events table with all details
 * 
 * GET /.netlify/functions/get-verified-events
 * Query params:
 *   - engine: Filter by engine (usgs, nws, faa, uscg, volcano, embassy) - optional
 *   - event_type: Filter by event type (earthquake, weather, airspace, maritime, volcano, travel) - optional
 *   - limit: Max number of events (default: 100)
 *   - minSeverity: Minimum severity 1-5 (default: 1)
 *   - status: Filter by status (active, update, resolved) - optional
 */

const supabase = require('./lib/supabaseClient');

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    const queryParams = event.queryStringParameters || {};
    const engine = queryParams.engine; // Optional: usgs, nws, faa, uscg, volcano, embassy
    const eventType = queryParams.event_type; // Optional: earthquake, weather, airspace, maritime, volcano, travel
    const limit = parseInt(queryParams.limit || '100', 10);
    const minSeverity = parseInt(queryParams.minSeverity || '1', 10);
    const status = queryParams.status; // Optional: active, update, resolved

    // Build query
    let query = supabase
      .from('verified_events')
      .select('*')
      .gte('severity', minSeverity)
      .order('published_at', { ascending: false })
      .limit(limit);

    // Apply optional filters
    if (engine) {
      query = query.eq('engine', engine);
    }
    
    if (eventType) {
      query = query.eq('event_type', eventType);
    }
    
    if (status) {
      query = query.eq('status', status);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error('[get-verified-events] Database error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Database query failed',
          message: error.message
        }),
      };
    }

    // Transform events to consistent format
    const transformedEvents = (events || []).map(event => {
      // Extract engine-specific data
      let magnitude = null;
      let depth = null;
      
      if (event.engine === 'usgs' && event.event_type === 'earthquake') {
        magnitude = event.assets?.magnitude || event.raw?.properties?.mag || null;
        depth = event.assets?.depth || event.raw?.geometry?.coordinates?.[2] || null;
      }

      return {
        id: event.canonical_id || event.id,
        canonical_id: event.canonical_id,
        engine: event.engine,
        event_type: event.event_type,
        severity: event.severity,
        status: event.status,
        title: event.title,
        summary: event.summary,
        location_display: event.location_display,
        country_code: event.country_code,
        lat: event.lat,
        lon: event.lon,
        published_at: event.published_at,
        updated_at_source: event.updated_at_source,
        fetched_at: event.fetched_at,
        source_name: event.source_name,
        source_url: event.source_url,
        image_url: event.image_url,
        tags: event.tags || [],
        // Engine-specific fields
        magnitude: magnitude,
        depth: depth,
        // Include full assets and raw data for advanced features
        assets: event.assets || {},
        raw: event.raw || {}
      };
    });

    // Group by engine for summary
    const byEngine = {};
    transformedEvents.forEach(evt => {
      if (!byEngine[evt.engine]) {
        byEngine[evt.engine] = 0;
      }
      byEngine[evt.engine]++;
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        count: transformedEvents.length,
        events: transformedEvents,
        summary: {
          by_engine: byEngine,
          total_engines: Object.keys(byEngine).length
        },
        filters: {
          engine: engine || 'all',
          event_type: eventType || 'all',
          min_severity: minSeverity,
          status: status || 'all',
          limit: limit
        },
        fetched_at: new Date().toISOString()
      }),
    };

  } catch (error) {
    console.error('[get-verified-events] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error.message
      }),
    };
  }
};
