#!/usr/bin/env node
/**
 * Remove NBC Brown University post via API call
 * This will work if the site is deployed or running locally with netlify dev
 */

const POST_ID = '2000243348691640646';

// Try to determine the base URL
function getBaseUrl() {
  // If NETLIFY_DEV is set, use localhost
  if (process.env.NETLIFY_DEV) {
    return 'http://localhost:8888';
  }
  
  // Try to get from environment or use production
  return process.env.NETLIFY_SITE_URL || 'https://noteworthynews.co';
}

async function removePost() {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/.netlify/functions/remove-post`;
  
  console.log(`🔗 Calling: ${url}`);
  console.log(`📝 Post ID: ${POST_ID}`);
  console.log('');
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ postId: POST_ID }),
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      if (data.removed) {
        console.log('✅ SUCCESS: Post removed from index!');
        console.log(`📊 Previous count: ${data.previousCount}`);
        console.log(`📊 New count: ${data.newCount}`);
        console.log('');
        console.log('⚠️  Note: The post may still appear cached in the browser.');
        console.log('   Clear your browser cache or wait a few minutes for the cache to expire.');
      } else {
        console.log(`ℹ️  ${data.message}`);
        console.log('   The post may have already been removed.');
      }
    } else {
      console.error('❌ ERROR:', data.error || 'Failed to remove post');
      console.error('   Response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
    console.error('');
    console.error('💡 Try one of these options:');
    console.error('   1. Make sure the site is deployed or netlify dev is running');
    console.error('   2. Use the admin interface: open admin-remove-post.html in your browser');
    console.error('   3. Run: node remove-nbc-brown-post.js (requires Netlify credentials)');
  }
}

removePost();




