#!/usr/bin/env node
/**
 * Check if specific posts are in the index
 */

const postIdsToCheck = [
  '1923928821088108804', // 8.2M views
  '1987315260559167965', // New post from CSV
  '1986963553153102019', // 480K views
  '1986966066753643016', // 56K views
];

async function checkPosts() {
  const response = await fetch('https://noteworthynews.co/.netlify/functions/posts-read?limit=200');
  const posts = await response.json();
  
  console.log(`📊 Total posts returned: ${posts.length}\n`);
  
  const foundPosts = [];
  const missingPosts = [];
  
  for (const postId of postIdsToCheck) {
    const post = posts.find(p => p.id === postId);
    if (post) {
      foundPosts.push({ id: postId, views: post.views || 0, title: (post.title || post.story || '').substring(0, 60) });
    } else {
      missingPosts.push(postId);
    }
  }
  
  if (foundPosts.length > 0) {
    console.log('✅ Posts found in index:');
    foundPosts.forEach(p => {
      console.log(`   ${p.id} - ${p.views.toLocaleString()} views - ${p.title}...`);
    });
    console.log('');
  }
  
  if (missingPosts.length > 0) {
    console.log('❌ Posts NOT in index:');
    missingPosts.forEach(id => console.log(`   ${id}`));
    console.log('');
  }
  
  // Show first 10 post IDs in index
  console.log('📋 First 10 post IDs in index:');
  posts.slice(0, 10).forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.id} - ${(p.views || 0).toLocaleString()} views`);
  });
}

checkPosts().catch(console.error);

