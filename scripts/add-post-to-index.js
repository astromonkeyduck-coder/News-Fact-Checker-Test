#!/usr/bin/env node
/**
 * Add a post to the index if it's not already there
 * Usage: node scripts/add-post-to-index.js <postId>
 */

const { getStore } = require("@netlify/blobs");

async function addPostToIndex(postId) {
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

  // Check if post exists
  try {
    const post = await store.get(`post-${postId}.json`, { type: "json" });
    if (!post) {
      console.error(`❌ Post ${postId} not found in storage`);
      process.exit(1);
    }
    console.log(`✓ Post ${postId} found in storage`);
  } catch (err) {
    console.error(`❌ Post ${postId} not found in storage:`, err.message);
    process.exit(1);
  }

  // Get current index
  let indexData = { ids: [], urls: [] };
  try {
    const indexBlob = await store.get("index.json", { type: "json" });
    if (indexBlob) {
      indexData = indexBlob;
    }
  } catch (err) {
    console.log('⚠️  No index found, creating new one');
  }

  // Check if already in index
  if (indexData.ids && indexData.ids.includes(postId)) {
    console.log(`✓ Post ${postId} is already in the index`);
    return;
  }

  // Add to beginning of index
  const existingIds = indexData.ids || [];
  const existingUrls = indexData.urls || [];
  
  // Remove if it exists elsewhere (shouldn't happen, but just in case)
  const filteredIds = existingIds.filter(id => id !== postId);
  const filteredUrls = existingUrls.filter((url, idx) => existingIds[idx] !== postId);
  
  // Prepend new post
  const newIds = [postId, ...filteredIds].slice(0, 200);
  const newUrls = indexData.urls ? [post.link || `https://x.com/newsnoteworthy/status/${postId}`, ...filteredUrls].slice(0, 200) : newIds.map(id => `https://x.com/newsnoteworthy/status/${id}`);
  
  // Save updated index
  await store.set("index.json", JSON.stringify({ ids: newIds, urls: newUrls }), {
    contentType: "application/json",
  });

  console.log(`✅ Added post ${postId} to index`);
  console.log(`📊 Index now contains ${newIds.length} posts`);
}

const postId = process.argv[2];
if (!postId) {
  console.error('Usage: node scripts/add-post-to-index.js <postId>');
  process.exit(1);
}

addPostToIndex(postId).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

