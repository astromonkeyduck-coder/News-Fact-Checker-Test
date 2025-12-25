/**
 * Check if earthquake posts exist
 * GET /.netlify/functions/check-earthquake-posts
 */

const { getStore } = require("@netlify/blobs");
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
    const results = {
      database: {
        total: 0,
        earthquakes: [],
      },
      blob_storage: {
        total: 0,
        posts: [],
      },
    };

    // Check database (Supabase)
    try {
      const { data: dbEvents, error: dbError } = await supabase
        .from('verified_events')
        .select('*')
        .eq('engine', 'usgs')
        .eq('event_type', 'earthquake')
        .order('published_at', { ascending: false })
        .limit(10);

      if (dbError) {
        results.database.error = dbError.message;
      } else {
        results.database.total = dbEvents?.length || 0;
        results.database.earthquakes = (dbEvents || []).map(e => ({
          canonical_id: e.canonical_id,
          title: e.title,
          location: e.location_display,
          magnitude: e.assets?.magnitude || e.raw?.properties?.mag || 'unknown',
          image_url: e.image_url,
          published_at: e.published_at,
          created_at: e.created_at,
        }));
      }
    } catch (dbErr) {
      results.database.error = dbErr.message;
    }

    // Check blob storage (posts)
    try {
      const siteID = process.env.NETLIFY_SITE_ID;
      const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN;

      if (siteID && token) {
        const store = getStore({
          name: "x-posts",
          siteID: siteID,
          token: token,
        });

        // Read index
        let indexData = { ids: [] };
        try {
          const indexBlob = await store.get("index.json", { type: "json" });
          if (indexBlob && Array.isArray(indexBlob.ids)) {
            indexData = indexBlob;
          }
        } catch (err) {
          // No index
        }

        // Get earthquake posts
        const earthquakePostIds = indexData.ids.filter(id => id.startsWith('usgs-'));
        results.blob_storage.total = earthquakePostIds.length;

        // Get details for first 5
        for (const postId of earthquakePostIds.slice(0, 5)) {
          try {
            const post = await store.get(`post-${postId}.json`, { type: "json" });
            if (post) {
              results.blob_storage.posts.push({
                id: postId,
                title: post.title,
                category: post.category,
                source: post.source,
                image: post.image,
                datePosted: post.datePosted,
              });
            }
          } catch (err) {
            // Post not found
          }
        }
      } else {
        results.blob_storage.error = "Missing NETLIFY_SITE_ID or NETLIFY_BLOB_READ_WRITE_TOKEN";
      }
    } catch (blobErr) {
      results.blob_storage.error = blobErr.message;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(results, null, 2),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || "Internal server error",
      }),
    };
  }
};

