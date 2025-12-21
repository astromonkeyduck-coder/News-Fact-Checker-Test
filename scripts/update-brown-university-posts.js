#!/usr/bin/env node
/**
 * Update Brown University posts with more recent timestamps
 * These posts were showing "18h" but should be more recent
 */

// The 5 posts from the image that need timestamp updates
const postsToUpdate = [
  {
    id: '1999957961507287238',
    text: 'BREAKING: Active shooter at Brown University engaged by police, neutralized following confrontation per scanner.',
    hoursAgo: 2 // Update to 2 hours ago
  },
  {
    id: '1999963719338692807',
    text: 'VIDEO: Several paramedics, ambulances seen staging as they wait to treat victims at Brown University in Providence, Rhode Island.',
    hoursAgo: 3 // Update to 3 hours ago
  },
  {
    id: '1999964397838709192',
    text: 'UPDATE: 1 suspect in custody following mass shooting at Brown University in Providence, Rhode Island, per Brown\'s alert system.',
    hoursAgo: 4 // Update to 4 hours ago
  },
  {
    id: '1999965944400191648',
    text: 'BREAKING: No suspect in custody at Brown University, law enforcement still searching for the shooter. — BrownUAlert',
    hoursAgo: 5 // Update to 5 hours ago
  },
  {
    id: '1999970302382711089',
    text: 'BrownUAlert: "Report of shots fired near Governor Street." Governor Street is several blocks away from Brown University.',
    hoursAgo: 6 // Update to 6 hours ago
  }
];

// Determine API endpoint
function getApiEndpoint() {
  // Check if we're in a Netlify environment
  if (process.env.NETLIFY_DEV) {
    return 'http://localhost:8888/.netlify/functions/update-post-data';
  }
  // For production, you'll need to set NETLIFY_SITE_URL or use the actual site URL
  const siteUrl = process.env.NETLIFY_SITE_URL || 'https://your-site.netlify.app';
  return `${siteUrl}/.netlify/functions/update-post-data`;
}

// Calculate timestamp N hours ago
function getTimestampHoursAgo(hours) {
  const now = new Date();
  const hoursAgo = new Date(now.getTime() - (hours * 60 * 60 * 1000));
  return hoursAgo.toISOString();
}

// Update a single post
async function updatePost(post) {
  const timestamp = getTimestampHoursAgo(post.hoursAgo);
  const endpoint = getApiEndpoint();
  
  console.log(`\n📝 Updating post ${post.id}...`);
  console.log(`   Text: ${post.text.substring(0, 80)}...`);
  console.log(`   New timestamp: ${timestamp} (${post.hoursAgo} hours ago)`);
  
  try {
    const response = await fetch(endpoint, {
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
    console.log(`   ✅ Successfully updated!`);
    return { success: true, postId: post.id };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return { success: false, postId: post.id, error: error.message };
  }
}

// Main function
async function main() {
  console.log('🚀 Starting Brown University posts timestamp update...\n');
  console.log(`📡 Using endpoint: ${getApiEndpoint()}\n`);
  
  const results = [];
  
  for (const post of postsToUpdate) {
    const result = await updatePost(post);
    results.push(result);
    
    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  console.log(`   ✅ Successfully updated: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  
  if (failCount > 0) {
    console.log('\n❌ Failed posts:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.postId}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 All posts updated successfully!');
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { updatePost, getTimestampHoursAgo };















