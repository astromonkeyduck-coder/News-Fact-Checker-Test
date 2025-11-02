#!/usr/bin/env node
/**
 * Check which posts are missing stats
 * Fetches all posts and identifies which ones need stats updates
 */

const API_ENDPOINT = process.env.NETLIFY_FUNCTION_URL || 'https://noteworthynews.co/.netlify/functions/posts-read';

async function fetchAllPosts() {
  try {
    console.log('📡 Fetching all posts...\n');
    const response = await fetch(`${API_ENDPOINT}?limit=500`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const posts = await response.json();
    return Array.isArray(posts) ? posts : [];
  } catch (error) {
    console.error('❌ Error fetching posts:', error.message);
    process.exit(1);
  }
}

function checkPostStats(post) {
  const hasViews = post.views !== undefined && post.views !== null && post.views > 0;
  const hasLikes = post.likes !== undefined && post.likes !== null && post.likes > 0;
  const hasReposts = post.reposts !== undefined && post.reposts !== null && post.reposts >= 0;
  const hasReplies = post.replies !== undefined && post.replies !== null && post.replies >= 0;
  const hasDate = post.datePosted && post.datePosted !== post.createdAt;
  
  const hasStats = hasViews || hasLikes || hasReposts || hasReplies;
  
  return {
    id: post.id,
    hasStats,
    hasViews,
    hasLikes,
    hasReposts,
    hasReplies,
    hasDate,
    views: post.views,
    likes: post.likes,
    reposts: post.reposts,
    replies: post.replies,
    datePosted: post.datePosted,
    createdAt: post.createdAt,
  };
}

async function main() {
  const posts = await fetchAllPosts();
  
  if (posts.length === 0) {
    console.log('❌ No posts found');
    process.exit(1);
  }
  
  console.log(`📊 Analyzing ${posts.length} posts...\n`);
  
  const stats = {
    total: posts.length,
    withStats: 0,
    withoutStats: 0,
    withViews: 0,
    withLikes: 0,
    withReposts: 0,
    withReplies: 0,
    withDate: 0,
  };
  
  const postsNeedingStats = [];
  
  for (const post of posts) {
    const check = checkPostStats(post);
    
    if (check.hasStats) {
      stats.withStats++;
      if (check.hasViews) stats.withViews++;
      if (check.hasLikes) stats.withLikes++;
      if (check.hasReposts) stats.withReposts++;
      if (check.hasReplies) stats.withReplies++;
    } else {
      stats.withoutStats++;
      postsNeedingStats.push(check);
    }
    
    if (check.hasDate) {
      stats.withDate++;
    }
  }
  
  console.log('📈 Statistics:\n');
  console.log(`   Total posts: ${stats.total}`);
  console.log(`   ✅ Posts with stats: ${stats.withStats} (${Math.round(stats.withStats/stats.total*100)}%)`);
  console.log(`   ❌ Posts missing stats: ${stats.withoutStats} (${Math.round(stats.withoutStats/stats.total*100)}%)`);
  console.log(`   📅 Posts with correct date: ${stats.withDate} (${Math.round(stats.withDate/stats.total*100)}%)`);
  console.log(`\n   Breakdown:`);
  console.log(`   👁️  Posts with views: ${stats.withViews}`);
  console.log(`   ❤️  Posts with likes: ${stats.withLikes}`);
  console.log(`   🔄 Posts with reposts: ${stats.withReposts}`);
  console.log(`   💬 Posts with replies: ${stats.withReplies}`);
  
  if (postsNeedingStats.length > 0) {
    console.log(`\n⚠️  ${postsNeedingStats.length} posts need stats updates:\n`);
    
    // Show first 20 posts needing stats
    const toShow = postsNeedingStats.slice(0, 20);
    toShow.forEach((post, i) => {
      console.log(`   ${i + 1}. Post ${post.id}`);
      console.log(`      Views: ${post.views || 'missing'}`);
      console.log(`      Likes: ${post.likes || 'missing'}`);
      console.log(`      Reposts: ${post.reposts || 'missing'}`);
      console.log(`      Replies: ${post.replies || 'missing'}`);
      console.log('');
    });
    
    if (postsNeedingStats.length > 20) {
      console.log(`   ... and ${postsNeedingStats.length - 20} more posts\n`);
    }
    
    console.log(`💡 To update these posts, run:`);
    console.log(`   node scripts/batch-update-posts.js [your-tsv-file.tsv]\n`);
  } else {
    console.log(`\n✅ All posts have stats! 🎉\n`);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { fetchAllPosts, checkPostStats };

