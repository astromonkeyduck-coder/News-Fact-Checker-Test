/**
 * Get verified earthquakes for Situation Monitor
 * Returns earthquakes from verified_events table with all details
 * 
 * GET /.netlify/functions/get-verified-earthquakes
 * Query params: minMagnitude (default: 0.5), limit (default: 50)
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
    const minMagnitude = parseFloat(queryParams.minMagnitude || '0.5');
    const limit = parseInt(queryParams.limit || '50', 10);

    // Fetch verified earthquakes from Supabase
    let query = supabase
      .from('verified_events')
      .select('*')
      .eq('engine', 'usgs')
      .eq('event_type', 'earthquake')
      .order('published_at', { ascending: false })
      .limit(limit);

    // Filter by magnitude if specified
    // Note: We'll filter in JavaScript since Supabase JSONB queries can be tricky
    // The magnitude is stored in assets.magnitude

    const { data: events, error } = await query;

    if (error) {
      console.error('[get-verified-earthquakes] Database error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Database query failed',
          message: error.message
        }),
      };
    }

    // Filter by magnitude in JavaScript (more reliable than JSONB query)
    let filteredEvents = events || [];
    if (minMagnitude > 0) {
      filteredEvents = filteredEvents.filter(event => {
        const magnitude = event.assets?.magnitude || event.raw?.properties?.mag || 0;
        return magnitude >= minMagnitude;
      });
    }

    // Transform events to match frontend expectations
    const earthquakes = filteredEvents.map(event => {
      const magnitude = event.assets?.magnitude || event.raw?.properties?.mag || 0;
      const coords = event.raw?.geometry?.coordinates || [];
      
      return {
        id: event.canonical_id || event.id,
        canonical_id: event.canonical_id,
        magnitude: magnitude,
        place: event.location_display || event.raw?.properties?.place || 'Unknown',
        time: event.published_at || event.raw?.properties?.time || event.created_at,
        time_ms: event.published_at ? new Date(event.published_at).getTime() : 
                 (event.raw?.properties?.time ? new Date(event.raw?.properties?.time).getTime() : Date.now()),
        updated: event.updated_at_source || event.updated_at,
        url: event.source_url || event.raw?.properties?.url || '',
        lon: event.lon || coords[0] || null,
        lat: event.lat || coords[1] || null,
        depth: event.assets?.depth || event.raw?.geometry?.coordinates?.[2] || 0,
        severity: event.severity || 1,
        image_url: event.image_url || null,
        video_url: event.video_url || event.assets?.video_url || null,
        // Include full event data for advanced features
        assets: event.assets || {},
        impact_assessment: event.assets?.impact_assessment || null,
        tsunami_risk: event.assets?.tsunami_risk || null,
        aftershock_forecast: event.assets?.aftershock_forecast || null,
        anomaly_detection: event.assets?.anomaly_detection || null,
        title: event.title,
        summary: event.summary
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        count: earthquakes.length,
        earthquakes: earthquakes,
        fetched_at: new Date().toISOString()
      }),
    };

  } catch (error) {
    console.error('[get-verified-earthquakes] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }),
    };
  }
};
