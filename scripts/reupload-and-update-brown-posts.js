#!/usr/bin/env node
/**
 * Re-upload Brown University posts and update their timestamps
 * This script:
 * 1. Re-adds the posts via the fetch-tweets-simple endpoint (to get fresh data)
 * 2. Updates their timestamps to be more recent (not 18 hours ago)
 */

// The 5 posts from the image that need to be re-uploaded and updated
const postsToUpdate = [
  {
    id: '1999957961507287238',
    url: 'https://x.com/newsnoteworthy/status/1999957961507287238',
    text: 'BREAKING: Active shooter at Brown University engaged by police, neutralized following confrontation per scanner.',
    hoursAgo: 2 // Update to 2 hours ago
  },
  {
    id: '1999963719338692807',
    url: 'https://x.com/newsnoteworthy/status/1999963719338692807',
    text: 'VIDEO: Several paramedics, ambulances seen staging as they wait to treat victims at Brown University in Providence, Rhode Island.',
    hoursAgo: 3 // Update to 3 hours ago
  },
  {
    id: '1999964397838709192',
    url: 'https://x.com/newsnoteworthy/status/1999964397838709192',
    text: 'UPDATE: 1 suspect in custody following mass shooting at Brown University in Providence, Rhode Island, per Brown\'s alert system.',
    hoursAgo: 4 // Update to 4 hours ago
  },
  {
    id: '1999965944400191648',
    url: 'https://x.com/newsnoteworthy/status/1999965944400191648',
    text: 'BREAKING: No suspect in custody at Brown University, law enforcement still searching for the shooter. — BrownUAlert',
    hoursAgo: 5 // Update to 5 hours ago
  },
  {
    id: '1999970302382711089',
    url: 'https://x.com/newsnoteworthy/status/1999970302382711089',
    text: 'BrownUAlert: "Report of shots fired near Governor Street." Governor Street is several blocks away from Brown University.',
    hoursAgo: 6 // Update to 6 hours ago
  }
];

// Determine API endpoints
function getEndpoints() {
  const baseUrl = process.env.NETLIFY_DEV 
    ? 'http://localhost:8888'
    : (process.env.NETLIFY_SITE_URL || 'https://noteworthynews.co');
  
  return {
    addPost: `${baseUrl}/.netlify/functions/fetch-tweets-simple`,
    updatePost: `${baseUrl}/.netlify/functions/update-post-data`,
  };
}

// Calculate timestamp N hours ago
function getTimestampHoursAgo(hours) {
  const now = new Date();
  const hoursAgo = new Date(now.getTime() - (hours * 60 * 60 * 1000));
  return hoursAgo.toISOString();
}

// Re-add a post (this will fetch fresh data and update the index)
async function reAddPost(post) {
  const endpoints = getEndpoints();
  
  console.log(`\n📤 Re-adding post ${post.id}...`);
  console.log(`   URL: ${post.url}`);
  
  try {
    const response = await fetch(endpoints.addPost, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tweetUrl: post.url,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log(`   ✅ Post re-added successfully!`);
    return { success: true, postId: post.id };
  } catch (error) {
    console.error(`   ❌ Error re-adding post: ${error.message}`);
    return { success: false, postId: post.id, error: error.message };
  }
}

// Update post timestamp
async function updatePostTimestamp(post) {
  const endpoints = getEndpoints();
  const timestamp = getTimestampHoursAgo(post.hoursAgo);
  
  console.log(`\n🕐 Updating timestamp for post ${post.id}...`);
  console.log(`   New timestamp: ${timestamp} (${post.hoursAgo} hours ago)`);
  
  try {
    const response = await fetch(endpoints.updatePost, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        postId: post.id,
        datePosted: timestamp,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log(`   ✅ Timestamp updated successfully!`);
    return { success: true, postId: post.id };
  } catch (error) {
    console.error(`   ❌ Error updating timestamp: ${error.message}`);
    return { success: false, postId: post.id, error: error.message };
  }
}

// Process a single post (re-add + update timestamp)
async function processPost(post) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📝 Processing: ${post.text.substring(0, 60)}...`);
  
  // Step 1: Re-add the post
  const reAddResult = await reAddPost(post);
  if (!reAddResult.success) {
    return reAddResult;
  }
  
  // Small delay between operations
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Step 2: Update the timestamp
  const updateResult = await updatePostTimestamp(post);
  return updateResult;
}

// Main function
async function main() {
  console.log('🚀 Starting Brown University posts re-upload and timestamp update...\n');
  const endpoints = getEndpoints();
  console.log(`📡 Using endpoints:`);
  console.log(`   Add Post: ${endpoints.addPost}`);
  console.log(`   Update Post: ${endpoints.updatePost}`);
  
  const results = [];
  
  for (const post of postsToUpdate) {
    const result = await processPost(post);
    results.push(result);
    
    // Delay between posts to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  console.log(`   ✅ Successfully processed: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  
  if (failCount > 0) {
    console.log('\n❌ Failed posts:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.postId}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 All posts re-uploaded and timestamps updated successfully!');
    console.log('   The posts should now show more recent times instead of "18h"');
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { processPost, reAddPost, updatePostTimestamp, getTimestampHoursAgo };















