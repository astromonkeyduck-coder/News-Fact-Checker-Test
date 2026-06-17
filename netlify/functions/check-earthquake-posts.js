/**
 * Check if earthquake posts exist
 * GET /.netlify/functions/check-earthquake-posts
 */

const { getPostStore, readIndex, readPost } = require("./lib/postStore");
const supabase = require('./lib/supabaseClient');
const { corsHeaders: headers, optionsResponse } = require("./lib/corsHeaders");

exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse;

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
      const store = getPostStore();
      const ids = await readIndex(store);

      const earthquakePostIds = ids.filter(id => id.startsWith('usgs-'));
      results.blob_storage.total = earthquakePostIds.length;

      for (const postId of earthquakePostIds.slice(0, 5)) {
        try {
          const post = await readPost(store, postId);
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

