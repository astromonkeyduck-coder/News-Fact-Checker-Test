#!/usr/bin/env node
/**
 * Remove the NBC Brown University post (ID: 2000243348691640646)
 * Usage: node remove-nbc-brown-post.js
 */

const { getStore } = require("@netlify/blobs");

const POST_ID = '2000243348691640646';

async function removePost() {
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
    console.error('❌ Failed to create store:', err.message);
    console.error('Make sure you have NETLIFY_SITE_ID and NETLIFY_BLOB_READ_WRITE_TOKEN set');
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
  if (!indexData.ids || !indexData.ids.includes(POST_ID)) {
    console.log(`⚠️  Post ${POST_ID} (NBC Brown University) is not in the index`);
    console.log('It may have already been removed.');
    return;
  }

  // Remove post from index
  const existingIds = indexData.ids || [];
  const existingUrls = indexData.urls || [];
  
  // Filter out the post ID
  const filteredIds = existingIds.filter(id => id !== POST_ID);
  const filteredUrls = existingUrls.filter((url, idx) => existingIds[idx] !== POST_ID);
  
  // Save updated index
  await store.set("index.json", JSON.stringify({ ids: filteredIds, urls: filteredUrls }), {
    contentType: "application/json",
  });

  console.log(`✅ Removed post ${POST_ID} (NBC Brown University) from index`);
  console.log(`📊 Index now contains ${filteredIds.length} posts (was ${existingIds.length})`);
}

removePost().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

