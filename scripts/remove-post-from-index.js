#!/usr/bin/env node
/**
 * Remove a post from the index
 * Usage: node scripts/remove-post-from-index.js <postId>
 */

const { getStore } = require("@netlify/blobs");

async function removePostFromIndex(postId) {
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

  // Get current index
  let indexData = { ids: [], urls: [] };
  try {
    const indexBlob = await store.get("index.json", { type: "json" });
    if (indexBlob) {
      indexData = indexBlob;
    }
  } catch (err) {
    console.error('❌ No index found');
    process.exit(1);
  }

  // Check if post is in index
  if (!indexData.ids || !indexData.ids.includes(postId)) {
    console.log(`⚠️  Post ${postId} is not in the index`);
    return;
  }

  // Remove post from index
  const existingIds = indexData.ids || [];
  const existingUrls = indexData.urls || [];
  
  // Filter out the post ID
  const filteredIds = existingIds.filter(id => id !== postId);
  const filteredUrls = existingUrls.filter((url, idx) => existingIds[idx] !== postId);
  
  // Save updated index
  await store.set("index.json", JSON.stringify({ ids: filteredIds, urls: filteredUrls }), {
    contentType: "application/json",
  });

  console.log(`✅ Removed post ${postId} from index`);
  console.log(`📊 Index now contains ${filteredIds.length} posts (was ${existingIds.length})`);
}

const postId = process.argv[2];
if (!postId) {
  console.error('Usage: node scripts/remove-post-from-index.js <postId>');
  process.exit(1);
}

removePostFromIndex(postId).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});













