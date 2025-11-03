#!/usr/bin/env node
/**
 * Find posts with high view counts
 * Usage: node scripts/find-high-view-post.js [minViews]
 */

const minViews = parseInt(process.argv[2]) || 1000000; // Default: 1M+

const { getStore } = require("@netlify/blobs");

async function findHighViewPosts() {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN;
  
  let store;
  try {
    if (siteID && token) {
      store = getStore({
        name: "x-posts",
        siteID: siteID,
        token: token,
      });
    } else {
      store = getStore({ name: "x-posts" });
    }
  } catch (err) {
    console.error('Failed to create store:', err.message);
    process.exit(1);
  }

  console.log(`🔍 Searching for posts with ${minViews.toLocaleString()}+ views...\n`);

  // First, get all post IDs from index
  let indexData = { ids: [] };
  try {
    const indexBlob = await store.get("index.json", { type: "json" });
    if (indexBlob && Array.isArray(indexBlob.ids)) {
      indexData = indexBlob;
      console.log(`📋 Index contains ${indexData.ids.length} posts`);
    }
  } catch (err) {
    console.log('⚠️  No index found');
  }

  // Get all post files (list all blobs starting with "post-")
  console.log('🔎 Scanning all posts in storage...\n');
  
  const allPosts = [];
  let scanned = 0;
  
  // Scan indexed posts first
  for (const id of indexData.ids) {
    try {
      const post = await store.get(`post-${id}.json`, { type: "json" });
      if (post && post.views && post.views >= minViews) {
        allPosts.push({
          id: post.id,
          views: post.views,
          likes: post.likes || 0,
          title: post.title || post.story?.substring(0, 60) || 'No title',
          link: post.link || `https://x.com/newsnoteworthy/status/${post.id}`,
          inIndex: true,
        });
      }
      scanned++;
    } catch (err) {
      // Post doesn't exist
    }
  }

  // Try to list all post-*.json files (if blob listing is available)
  // Note: Netlify Blobs doesn't have a built-in list function, so we'll search common IDs
  // For now, we'll check if there are posts in index that might have been pushed out
  
  console.log(`📊 Scanned ${scanned} indexed posts\n`);
  console.log(`🎯 Found ${allPosts.length} posts with ${minViews.toLocaleString()}+ views:\n`);

  if (allPosts.length === 0) {
    console.log('❌ No high-view posts found in index!');
    console.log('💡 The 8.2M view post may have been pushed out of the 200-post limit.');
    console.log('💡 Solution: We need to update the index system to keep high-performing posts.\n');
    return;
  }

  // Sort by views descending
  allPosts.sort((a, b) => b.views - a.views);

  allPosts.forEach((post, idx) => {
    const viewsStr = post.views.toLocaleString();
    const status = post.inIndex ? '✅' : '❌';
    console.log(`${idx + 1}. ${status} ${viewsStr} views - ${post.title}`);
    console.log(`   ID: ${post.id}`);
    console.log(`   Link: ${post.link}\n`);
  });

  // Check for 8.2M specifically
  const targetPost = allPosts.find(p => 
    p.views >= 8200000 && p.views <= 8300000
  );

  if (targetPost) {
    console.log(`\n✅ Found the 8.2M view post!`);
    console.log(`   ID: ${targetPost.id}`);
    console.log(`   Views: ${targetPost.views.toLocaleString()}`);
    console.log(`   In Index: ${targetPost.inIndex ? 'YES' : 'NO ❌'}`);
    console.log(`   Link: ${targetPost.link}`);
  } else {
    console.log(`\n❌ 8.2M view post not found in index.`);
    console.log(`💡 It may have been pushed out by the 200-post limit.`);
    console.log(`💡 We need to rebuild the index to include it.`);
  }
}

findHighViewPosts().catch(console.error);

