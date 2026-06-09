#!/usr/bin/env node
/**
 * Backfill primary_image_url for volcano alert posts missing a curated image.
 *
 * Usage: node scripts/backfill-volcano-alert-images.js
 * Requires NETLIFY_SITE_ID + NETLIFY_BLOB_READ_WRITE_TOKEN (or netlify dev env).
 */

require('dotenv').config();

const {
  getPostStore,
  readIndex,
  readPost,
  writePost,
} = require('../netlify/functions/lib/postStore');
const { getVolcanoAlertFallbackFromPost } = require('../netlify/functions/lib/volcanoAlertImages');

const BASE_URL = process.env.URL || 'https://noteworthynews.co';

function hasImage(post) {
  return !!(post.primary_image_url || post.image_url || post.image);
}

function currentImageUrl(post) {
  return post.primary_image_url || post.image_url || post.image || '';
}

async function main() {
  const store = getPostStore();
  const ids = await readIndex(store);
  let updated = 0;

  for (const id of ids) {
    const post = await readPost(store, id);
    if (!post) continue;

    const relativePath = getVolcanoAlertFallbackFromPost(post);
    if (!relativePath) continue;

    const imageUrl = `${BASE_URL}${relativePath}`;
    if (currentImageUrl(post) === imageUrl) continue;

    // Set curated image when missing or when replacing a generated template
    const existing = currentImageUrl(post);
    if (existing && !existing.includes('get-uploaded-image') && hasImage(post)) continue;

    post.primary_image_url = imageUrl;
    post.image_url = imageUrl;
    post.image = imageUrl;
    await writePost(store, id, post);
    updated += 1;
    console.log(`Updated post ${id} with ${imageUrl}`);
  }

  console.log(updated ? `Done. Updated ${updated} post(s).` : 'No volcano posts needed updating.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
