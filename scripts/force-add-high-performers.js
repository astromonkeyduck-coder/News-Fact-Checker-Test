#!/usr/bin/env node
/**
 * Force add high-performing posts to the front of the index
 */

const highPerformingPosts = [
  '1923928821088108804', // 8.2M views
  '1986963553153102019', // 480K views  
  '1986966066753643016', // 56K views
  '1987315260559167965', // New post
];

// Get current index
async function getIndex() {
  const response = await fetch('https://noteworthynews.co/.netlify/functions/posts-read?limit=200');
  const posts = await response.json();
  return posts.map(p => p.id);
}

// Add posts to front of index via fetch-tweets-simple
async function addToIndex(postId) {
  const response = await fetch('https://noteworthynews.co/.netlify/functions/fetch-tweets-simple', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tweetUrl: `https://x.com/newsnoteworthy/status/${postId}` })
  });
  return response.json();
}

async function main() {
  console.log('🔍 Getting current index...');
  const currentIds = await getIndex();
  console.log(`📊 Current index has ${currentIds.length} posts\n`);
  
  console.log('➕ Adding high-performing posts to index...\n');
  
  for (const postId of highPerformingPosts) {
    console.log(`Adding ${postId}...`);
    const result = await addToIndex(postId);
    console.log(`  ${result.message || result.success || 'Done'}`);
    await new Promise(r => setTimeout(r, 400));
  }
  
  console.log('\n✅ All posts added!');
  console.log('\n🔄 Verifying they are in index...\n');
  
  const newIds = await getIndex();
  const found = highPerformingPosts.filter(id => newIds.includes(id));
  const missing = highPerformingPosts.filter(id => !newIds.includes(id));
  
  if (found.length > 0) {
    console.log('✅ Found in index:');
    found.forEach(id => console.log(`   ${id}`));
  }
  
  if (missing.length > 0) {
    console.log('\n❌ Still missing:');
    missing.forEach(id => console.log(`   ${id}`));
  }
  
  console.log(`\n📊 Index now has ${newIds.length} posts`);
  console.log(`\n💡 First 5 posts in index:`);
  newIds.slice(0, 5).forEach((id, i) => console.log(`   ${i + 1}. ${id}`));
}

main().catch(console.error);

