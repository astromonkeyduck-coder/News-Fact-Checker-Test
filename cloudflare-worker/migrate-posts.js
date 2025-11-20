/**
 * Migration Script: Netlify Blobs → Cloudflare KV
 * 
 * This script migrates existing posts from Netlify Blobs to Cloudflare KV
 * 
 * Usage:
 *   node migrate-posts.js
 * 
 * Or run via curl if you have an endpoint:
 *   curl -X POST https://your-migration-endpoint.com/migrate
 */

const WORKER_URL = 'https://x-feed-worker.pangpangpangismysubdomainbrutha.workers.dev';
const NETLIFY_ENDPOINT = 'https://noteworthynews.co/.netlify/functions/posts-read?limit=200';

/**
 * Fetch posts from Netlify
 */
async function fetchNetlifyPosts() {
  try {
    console.log('📥 Fetching posts from Netlify...');
    const response = await fetch(NETLIFY_ENDPOINT);
    
    if (!response.ok) {
      throw new Error(`Netlify endpoint returned ${response.status}`);
    }
    
    const posts = await response.json();
    console.log(`✅ Found ${posts.length} posts in Netlify`);
    return posts;
  } catch (error) {
    console.error('❌ Error fetching Netlify posts:', error);
    throw error;
  }
}

/**
 * Transform Netlify post format to Cloudflare format
 */
function transformPost(netlifyPost) {
  // Netlify format might have different fields - adapt as needed
  const cloudflarePost = {
    id: netlifyPost.id || netlifyPost.tweetId || extractIdFromUrl(netlifyPost.url),
    url: netlifyPost.url || netlifyPost.link || '',
    author: netlifyPost.author || netlifyPost.authorName || 'Unknown',
    html: netlifyPost.html || netlifyPost.oembedHtml || '',
    text: netlifyPost.text || netlifyPost.title || netlifyPost.summary || '',
    image: netlifyPost.image || netlifyPost.thumbnail || '',
    category: mapCategory(netlifyPost.category || netlifyPost.postType || 'Update'),
    created_at: parseTimestamp(netlifyPost.created_at || netlifyPost.datePosted || netlifyPost.timestamp),
  };
  
  return cloudflarePost;
}

/**
 * Extract tweet ID from URL
 */
function extractIdFromUrl(url) {
  if (!url) return null;
  const match = url.match(/\/status\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Map Netlify category to Cloudflare category
 */
function mapCategory(category) {
  const cat = String(category || '').toLowerCase();
  if (cat.includes('breaking')) return 'Breaking';
  if (cat.includes('developing')) return 'Developing';
  return 'Update';
}

/**
 * Parse timestamp to unix milliseconds
 */
function parseTimestamp(timestamp) {
  if (!timestamp) return Date.now();
  
  // If it's already a number (unix timestamp)
  if (typeof timestamp === 'number') {
    // If it's in seconds, convert to milliseconds
    return timestamp < 1000000000000 ? timestamp * 1000 : timestamp;
  }
  
  // If it's a string, try to parse
  const date = new Date(timestamp);
  return isNaN(date.getTime()) ? Date.now() : date.getTime();
}

/**
 * Add post to Cloudflare Worker
 */
async function addToCloudflare(post) {
  try {
    // If we have a URL, use the /add endpoint which will fetch oEmbed
    if (post.url && post.url.match(/x\.com|twitter\.com/)) {
      const response = await fetch(`${WORKER_URL}/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: post.url }),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.message || error.error || `HTTP ${response.status}`);
      }
      
      return await response.json();
    } else {
      // Direct KV write via a custom endpoint (would need to add this to worker)
      console.warn(`⚠️  Post ${post.id} has no valid URL, skipping`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error adding post ${post.id}:`, error.message);
    throw error;
  }
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('🚀 Starting migration from Netlify to Cloudflare...\n');
  
  try {
    // Step 1: Fetch posts from Netlify
    const netlifyPosts = await fetchNetlifyPosts();
    
    if (netlifyPosts.length === 0) {
      console.log('ℹ️  No posts to migrate');
      return;
    }
    
    // Step 2: Transform and migrate each post
    console.log('\n📤 Migrating posts to Cloudflare...\n');
    
    let success = 0;
    let failed = 0;
    const errors = [];
    
    for (let i = 0; i < netlifyPosts.length; i++) {
      const post = netlifyPosts[i];
      const transformed = transformPost(post);
      
      console.log(`[${i + 1}/${netlifyPosts.length}] Migrating: ${transformed.id || 'unknown'}`);
      
      try {
        await addToCloudflare(transformed);
        success++;
        
        // Rate limit: wait 100ms between requests to avoid hitting rate limits
        if (i < netlifyPosts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        failed++;
        errors.push({ id: transformed.id, error: error.message });
        console.error(`  ❌ Failed: ${error.message}`);
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary:');
    console.log(`  ✅ Success: ${success}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  📦 Total: ${netlifyPosts.length}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.forEach(({ id, error }) => {
        console.log(`  - ${id}: ${error}`);
      });
    }
    
    console.log('\n✅ Migration complete!');
    console.log(`\n🔗 Check your feed: ${WORKER_URL}/feed`);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
if (require.main === module) {
  migrate();
}

module.exports = { migrate, fetchNetlifyPosts, transformPost };




