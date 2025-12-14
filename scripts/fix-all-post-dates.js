#!/usr/bin/env node
/**
 * Fix all post dates by re-extracting from Twitter Snowflake IDs
 * This script:
 * 1. Fetches all posts from the API
 * 2. For each post, extracts the correct date from its tweet ID
 * 3. Updates the post with the correct datePosted value
 */

// Extract date from Twitter Snowflake ID
function extractDateFromTweetId(tweetId) {
  try {
    const id = BigInt(tweetId);
    const twitterEpoch = BigInt(1288834974657);
    const shift = BigInt(22);
    const shifted = id >> shift;
    const timestamp = Number(shifted) + Number(twitterEpoch);
    const date = new Date(timestamp);
    
    // Validate: date should be reasonable
    const now = Date.now();
    const twitterStartDate = new Date('2010-11-04').getTime();
    if (date.getTime() > now) {
      console.warn(`  ⚠️  Extracted date is in the future for ${tweetId}`);
      return null;
    }
    if (date.getTime() < twitterStartDate) {
      console.warn(`  ⚠️  Extracted date is before Twitter existed for ${tweetId}`);
      return null;
    }
    
    return date.toISOString();
  } catch (error) {
    console.warn(`  ⚠️  Could not extract date from tweet ID ${tweetId}:`, error.message);
    return null;
  }
}

// Determine API endpoints
function getEndpoints() {
  const baseUrl = process.env.NETLIFY_DEV 
    ? 'http://localhost:8888'
    : (process.env.NETLIFY_SITE_URL || 'https://noteworthynews.co');
  
  return {
    fetchPosts: `${baseUrl}/.netlify/functions/posts-read?limit=200`,
    updatePost: `${baseUrl}/.netlify/functions/update-post-data`,
  };
}

// Update a single post's date
async function fixPostDate(post) {
  const endpoints = getEndpoints();
  
  // Extract correct date from tweet ID
  const correctDate = extractDateFromTweetId(post.id);
  
  if (!correctDate) {
    console.log(`  ⏭️  Skipping ${post.id} - could not extract date from ID`);
    return { success: false, skipped: true, reason: 'Could not extract date from ID' };
  }
  
  // Check if date needs updating
  const currentDate = post.datePosted || post.createdAt || post.created_at;
  if (currentDate === correctDate) {
    console.log(`  ✓ ${post.id} - date already correct (${correctDate})`);
    return { success: true, skipped: true, reason: 'Date already correct' };
  }
  
  // Calculate time difference
  const currentDateObj = currentDate ? new Date(currentDate) : null;
  const correctDateObj = new Date(correctDate);
  const diffHours = currentDateObj 
    ? Math.round((currentDateObj.getTime() - correctDateObj.getTime()) / (1000 * 60 * 60))
    : 'unknown';
  
  console.log(`  🔧 ${post.id}`);
  console.log(`     Current: ${currentDate || 'missing'}`);
  console.log(`     Correct: ${correctDate}`);
  if (currentDateObj) {
    console.log(`     Difference: ${Math.abs(diffHours)} hours ${diffHours > 0 ? 'in the past' : 'in the future'}`);
  }
  
  try {
    const response = await fetch(endpoints.updatePost, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        postId: post.id,
        datePosted: correctDate,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log(`     ✅ Updated successfully!`);
    return { success: true, postId: post.id, oldDate: currentDate, newDate: correctDate };
  } catch (error) {
    console.error(`     ❌ Error updating: ${error.message}`);
    return { success: false, postId: post.id, error: error.message };
  }
}

// Main function
async function main() {
  console.log('🚀 Starting post date fix...\n');
  const endpoints = getEndpoints();
  console.log(`📡 Using endpoints:`);
  console.log(`   Fetch Posts: ${endpoints.fetchPosts}`);
  console.log(`   Update Post: ${endpoints.updatePost}\n`);
  
  try {
    // Fetch all posts
    console.log('📥 Fetching all posts...');
    const response = await fetch(endpoints.fetchPosts);
    if (!response.ok) {
      throw new Error(`Failed to fetch posts: ${response.status}`);
    }
    
    const posts = await response.json();
    console.log(`   Found ${posts.length} posts\n`);
    
    if (posts.length === 0) {
      console.log('No posts to fix.');
      return;
    }
    
    // Process each post
    const results = [];
    let fixedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      console.log(`[${i + 1}/${posts.length}] Processing post ${post.id}...`);
      
      const result = await fixPostDate(post);
      results.push(result);
      
      if (result.success && !result.skipped) {
        fixedCount++;
      } else if (result.skipped) {
        skippedCount++;
      } else {
        errorCount++;
      }
      
      // Small delay to avoid overwhelming the API
      if (i < posts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`   ✅ Fixed: ${fixedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📝 Total: ${posts.length}`);
    
    if (fixedCount > 0) {
      console.log('\n🎉 Successfully fixed dates for', fixedCount, 'posts!');
      console.log('   Refresh your feed to see the updated timestamps.');
    }
    
    if (errorCount > 0) {
      console.log('\n❌ Failed posts:');
      results.filter(r => !r.success && !r.skipped).forEach(r => {
        console.log(`   - ${r.postId}: ${r.error}`);
      });
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { fixPostDate, extractDateFromTweetId, getEndpoints };
