/**
 * Re-extract media for existing posts that don't have media
 * This function can be called to update all posts with media extraction
 */

const { getPostStore, readIndex, readPost } = require("./lib/postStore");
const { requireAdminAuth } = require("./middleware/requireAuth");
const { corsHeaders: headers, optionsResponse } = require("./lib/corsHeaders");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse;

  const auth = await requireAdminAuth(event);
  if (auth.statusCode) return auth;

  try {
    let store;
    try {
      store = getPostStore();
    } catch (storeErr) {
      console.error('[re-extract-media] Failed to create store:', storeErr);
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({
          error: "Storage configuration error",
          message: storeErr.message,
        }),
      };
    }

    const ids = await readIndex(store);
    const limit = parseInt(event.queryStringParameters?.limit || "10", 10);
    const postIds = ids.slice(0, limit);
    
    console.log(`[re-extract-media] Processing ${postIds.length} posts`);

    const results = {
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      details: [],
    };

    const fetchUrl = process.env.NETLIFY_FUNCTION_URL || 'https://noteworthynews.co/.netlify/functions/fetch-tweets-simple';

    for (const postId of postIds) {
      try {
        const post = await readPost(store, postId);
        
        if (!post) {
          results.skipped++;
          results.details.push({ postId, status: 'skipped', reason: 'Post not found' });
          continue;
        }
        
        // Check if post has a link (tweet URL)
        const tweetUrl = post.link || post.url;
        if (!tweetUrl || (!tweetUrl.includes('x.com') && !tweetUrl.includes('twitter.com'))) {
          results.skipped++;
          results.details.push({ postId, status: 'skipped', reason: 'No valid tweet URL' });
          continue;
        }
        
        // Check if media already exists
        const hasMedia = (post.primary_image_url || post.image || (post.images && post.images.length > 0) || (post.videos && post.videos.length > 0));
        
        if (hasMedia && event.queryStringParameters?.force !== 'true') {
          results.skipped++;
          results.details.push({ postId, status: 'skipped', reason: 'Already has media' });
          continue;
        }
        
        // Call fetch-tweets-simple to re-extract media
        console.log(`[re-extract-media] Re-extracting media for ${postId} from ${tweetUrl}`);
        
        const response = await fetch(fetchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tweetUrl }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[re-extract-media] Failed for ${postId}: ${response.status} ${errorText}`);
          results.errors++;
          results.details.push({ postId, status: 'error', reason: `HTTP ${response.status}` });
          continue;
        }
        
        const updatedPost = await readPost(store, postId);
        
        if (updatedPost && (updatedPost.primary_image_url || (updatedPost.images && updatedPost.images.length > 0) || (updatedPost.videos && updatedPost.videos.length > 0))) {
          console.log(`[re-extract-media] ✅ Media extracted for ${postId}:`, {
            images: updatedPost.images?.length || 0,
            videos: updatedPost.videos?.length || 0,
            primary_image: !!updatedPost.primary_image_url
          });
          results.updated++;
          results.details.push({ 
            postId, 
            status: 'updated', 
            images: updatedPost.images?.length || 0,
            videos: updatedPost.videos?.length || 0
          });
        } else {
          console.log(`[re-extract-media] ⚠️  No media found for ${postId} after extraction`);
          results.errors++;
          results.details.push({ postId, status: 'error', reason: 'No media found' });
        }
        
        results.processed++;
        
        // Rate limit: wait 200ms between requests
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`[re-extract-media] Error processing ${postId}:`, error.message);
        results.errors++;
        results.details.push({ postId, status: 'error', reason: error.message });
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: `Processed ${results.processed} posts`,
        summary: {
          processed: results.processed,
          updated: results.updated,
          skipped: results.skipped,
          errors: results.errors,
        },
        details: results.details,
      }),
    };
  } catch (error) {
    console.error('[re-extract-media] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error?.message || "Internal server error",
      }),
    };
  }
};
