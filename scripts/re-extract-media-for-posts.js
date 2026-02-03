/**
 * Re-extract media for existing posts
 * This script fetches all posts and re-runs media extraction for each one
 */

const { getStore } = require("@netlify/blobs");

async function reExtractMediaForPosts() {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN;
  
  if (!siteID || !token) {
    console.error('Missing NETLIFY_SITE_ID or NETLIFY_BLOB_READ_WRITE_TOKEN');
    process.exit(1);
  }
  
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
    console.error('Failed to read index:', err);
    process.exit(1);
  }
  
  console.log(`Found ${indexData.ids.length} posts in index`);
  
  // Process each post
  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const postId of indexData.ids) {
    try {
      const postKey = `post-${postId}.json`;
      const post = await store.get(postKey, { type: "json" });
      
      if (!post) {
        console.log(`[${postId}] Post not found, skipping`);
        skipped++;
        continue;
      }
      
      // Check if post has a link (tweet URL)
      const tweetUrl = post.link || post.url;
      if (!tweetUrl || !tweetUrl.includes('x.com') && !tweetUrl.includes('twitter.com')) {
        console.log(`[${postId}] No valid tweet URL, skipping`);
        skipped++;
        continue;
      }
      
      // Check if media already exists
      const hasMedia = (post.primary_image_url || post.image || post.images?.length > 0 || post.videos?.length > 0);
      
      if (hasMedia) {
        console.log(`[${postId}] Already has media, skipping`);
        skipped++;
        continue;
      }
      
      // Call fetch-tweets-simple to re-extract media
      console.log(`[${postId}] Re-extracting media from ${tweetUrl}`);
      
      const fetchUrl = process.env.NETLIFY_FUNCTION_URL || 'https://noteworthynews.co/.netlify/functions/fetch-tweets-simple';
      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tweetUrl }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[${postId}] Failed to re-extract media: ${response.status} ${errorText}`);
        errors++;
        continue;
      }
      
      // Re-read the post to get updated media
      const updatedPost = await store.get(postKey, { type: "json" });
      
      if (updatedPost && (updatedPost.primary_image_url || updatedPost.images?.length > 0 || updatedPost.videos?.length > 0)) {
        console.log(`[${postId}] ✅ Media extracted:`, {
          images: updatedPost.images?.length || 0,
          videos: updatedPost.videos?.length || 0,
          primary_image: !!updatedPost.primary_image_url
        });
        updated++;
      } else {
        console.log(`[${postId}] ⚠️  No media found after extraction`);
        errors++;
      }
      
      processed++;
      
      // Rate limit: wait 500ms between requests
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`[${postId}] Error:`, error.message);
      errors++;
    }
  }
  
  console.log('\n=== Summary ===');
  console.log(`Processed: ${processed}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
}

// Run if called directly
if (require.main === module) {
  reExtractMediaForPosts().catch(console.error);
}

module.exports = { reExtractMediaForPosts };
