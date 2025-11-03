#!/usr/bin/env node
/**
 * Quick script to add a single post from command line
 * Usage: node scripts/quick-add-post.js <tweet-url-or-id>
 * 
 * Examples:
 *   node scripts/quick-add-post.js https://x.com/newsnoteworthy/status/1234567890
 *   node scripts/quick-add-post.js 1234567890
 */

const tweetArg = process.argv[2];

if (!tweetArg) {
  console.error('❌ Please provide a tweet URL or ID');
  console.log('\nUsage:');
  console.log('  node scripts/quick-add-post.js <tweet-url-or-id>');
  console.log('\nExamples:');
  console.log('  node scripts/quick-add-post.js https://x.com/newsnoteworthy/status/1234567890');
  console.log('  node scripts/quick-add-post.js 1234567890');
  process.exit(1);
}

// Extract tweet ID from URL or use as-is if it's just an ID
let tweetUrl;
if (tweetArg.includes('http')) {
  tweetUrl = tweetArg;
} else {
  // Assume it's just an ID
  tweetUrl = `https://x.com/newsnoteworthy/status/${tweetArg}`;
}

const API_ENDPOINT = process.env.NETLIFY_FUNCTION_URL || 'https://noteworthynews.co/.netlify/functions/fetch-tweets-simple';

async function addPost() {
  console.log(`📝 Adding post: ${tweetUrl}\n`);
  
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tweetUrl }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    
    if (result.error) {
      console.error(`❌ Error: ${result.error}`);
      if (result.message) {
        console.error(`   ${result.message}`);
      }
      process.exit(1);
    }
    
    if (result.success || result.id) {
      console.log(`✅ Post added successfully!`);
      console.log(`   Post ID: ${result.id || 'unknown'}`);
      console.log(`\n💡 Refresh your website to see the new post!`);
    } else {
      console.log(`✅ Response:`, result);
    }
  } catch (error) {
    console.error(`❌ Error adding post:`, error.message);
    process.exit(1);
  }
}

addPost();

