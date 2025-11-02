#!/usr/bin/env node
/**
 * Quick test script to verify batch setup is working
 * Tests with just 1-2 URLs to make sure everything is configured correctly
 */

const fs = require('fs');
const path = require('path');

const API_ENDPOINT = process.env.NETLIFY_FUNCTION_URL || 'https://your-site.netlify.app/.netlify/functions/fetch-profile-tweets';

async function testSetup() {
  console.log('🧪 Testing Batch Setup\n');
  
  // Check 1: API endpoint configured
  if (API_ENDPOINT.includes('your-site.netlify.app')) {
    console.error('❌ NETLIFY_FUNCTION_URL not set!');
    console.error('   Run: export NETLIFY_FUNCTION_URL=https://YOUR-SITE/.netlify/functions/fetch-profile-tweets');
    process.exit(1);
  }
  
  console.log('✅ API Endpoint:', API_ENDPOINT);
  
  // Check 2: Test a simple fetch
  console.log('\n📡 Testing API connection...');
  try {
    // Test with a dummy URL (will fail but shows if endpoint is reachable)
    const testUrl = 'https://x.com/newsnoteworthy/status/1234567890';
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tweetUrl: testUrl }),
    });
    
    const data = await response.json();
    
    if (response.status === 200 || response.status === 400 || response.status === 404) {
      console.log('✅ API is reachable and responding');
      console.log(`   Response status: ${response.status}`);
    } else {
      console.warn('⚠️  API returned unexpected status:', response.status);
      console.warn('   Response:', data);
    }
  } catch (error) {
    console.error('❌ Cannot reach API endpoint:', error.message);
    console.error('   Check that:');
    console.error('   1. Your Netlify site is deployed');
    console.error('   2. The URL is correct');
    console.error('   3. You have internet connection');
    process.exit(1);
  }
  
  // Check 3: Check if tweet-urls.txt exists
  const urlsFile = path.join(__dirname, '..', 'tweet-urls.txt');
  if (fs.existsSync(urlsFile)) {
    const content = fs.readFileSync(urlsFile, 'utf8');
    const urls = content.split('\n').filter(line => line.trim() && line.includes('/status/'));
    console.log(`\n✅ Found tweet-urls.txt with ${urls.length} URLs`);
    
    if (urls.length === 0) {
      console.warn('⚠️  File exists but contains no valid URLs');
    } else {
      console.log('   Sample URLs:');
      urls.slice(0, 3).forEach((url, i) => {
        console.log(`   ${i + 1}. ${url.substring(0, 60)}...`);
      });
    }
  } else {
    console.warn('\n⚠️  tweet-urls.txt not found');
    console.warn('   Create it with your tweet URLs (one per line)');
  }
  
  // Check 4: Node.js version
  const nodeVersion = process.version;
  console.log(`\n✅ Node.js version: ${nodeVersion}`);
  
  console.log('\n✨ Setup looks good! You can now run:');
  console.log('   node scripts/batch-add-posts.js tweet-urls.txt');
}

testSetup().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

