#!/usr/bin/env node
/**
 * Batch update only posts that are missing stats
 * Fetches all posts, identifies which need stats, and updates them from TSV
 */

const fs = require('fs');
const path = require('path');
const { fetchAllPosts, checkPostStats } = require('./check-missing-stats');
const { updatePost, parseDate, parseNumber, parseTSV } = require('./batch-update-posts');

const API_ENDPOINT = process.env.NETLIFY_FUNCTION_URL || 'https://noteworthynews.co/.netlify/functions/update-post-data';

async function main() {
  // Step 1: Get all posts and find which ones need stats
  console.log('📡 Step 1: Checking which posts need stats...\n');
  const allPosts = await fetchAllPosts();
  
  if (allPosts.length === 0) {
    console.error('❌ No posts found');
    process.exit(1);
  }
  
  const postsNeedingStats = [];
  for (const post of allPosts) {
    const check = checkPostStats(post);
    if (!check.hasStats) {
      postsNeedingStats.push(post.id);
    }
  }
  
  if (postsNeedingStats.length === 0) {
    console.log('✅ All posts already have stats! No updates needed.\n');
    process.exit(0);
  }
  
  console.log(`📊 Found ${postsNeedingStats.length} posts that need stats updates\n`);
  
  // Step 2: Read TSV file
  const dataFile = process.argv[2] || 'posts-data.tsv';
  const dataPath = path.resolve(dataFile);
  
  if (!fs.existsSync(dataPath)) {
    console.error(`❌ Error: Data file not found at ${dataPath}`);
    console.log('\nUsage: node scripts/batch-update-missing-stats.js [data-file.tsv]');
    process.exit(1);
  }
  
  console.log(`📖 Step 2: Reading post data from ${dataPath}...\n`);
  const tsvContent = fs.readFileSync(dataPath, 'utf8');
  const tsvPosts = parseTSV(tsvContent);
  
  if (tsvPosts.length === 0) {
    console.error('❌ No valid posts found in data file');
    process.exit(1);
  }
  
  // Step 3: Filter TSV posts to only those that need updates
  const postsToUpdate = tsvPosts.filter(p => postsNeedingStats.includes(p.id));
  
  if (postsToUpdate.length === 0) {
    console.log('⚠️  No posts in TSV file match the posts that need stats updates.');
    console.log(`   TSV has ${tsvPosts.length} posts, but ${postsNeedingStats.length} posts need stats.`);
    console.log(`   This might mean all posts in the TSV have already been updated.\n`);
    process.exit(0);
  }
  
  console.log(`📊 Step 3: Found ${postsToUpdate.length} posts in TSV that need updates\n`);
  console.log('🚀 Starting batch update...\n');
  
  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
  };
  
  // Step 4: Update posts one by one
  for (let i = 0; i < postsToUpdate.length; i++) {
    const post = postsToUpdate[i];
    const result = await updatePost(post);
    
    if (result.success) {
      results.success++;
    } else if (result.skipped) {
      results.skipped++;
    } else {
      results.failed++;
    }
    
    // Small delay between requests (except for last one)
    if (i < postsToUpdate.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Progress indicator
    if ((i + 1) % 10 === 0) {
      console.log(`\n📈 Progress: ${i + 1}/${postsToUpdate.length} (${results.success} success, ${results.failed} failed, ${results.skipped} skipped)\n`);
    }
  }
  
  console.log('\n✅ Batch update complete!\n');
  console.log(`📊 Results:`);
  console.log(`   ✅ Success: ${results.success}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  console.log(`   ⚠ Skipped: ${results.skipped}`);
  console.log(`\n💡 Refresh your website to see the updated stats!`);
}

if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main };

