#!/usr/bin/env node

/**
 * Backfill X post Blobs with source_urls (and urgency) from Supabase x_posts.
 * Safe to rerun — merges fields onto existing blob cards without re-fetching X API.
 *
 * Usage:
 *   node scripts/backfill-x-blob-projection.js
 *   node scripts/backfill-x-blob-projection.js --limit=100
 *
 * Requires .env / .env.local with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * and NETLIFY_SITE_ID + NETLIFY_BLOB_READ_WRITE_TOKEN (or netlify dev:exec).
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local'), override: false });

const supabase = require('../netlify/functions/lib/supabaseClient');
const { getPostStore, readPost, writePost } = require('../netlify/functions/lib/postStore');
const { enrichCardPost } = require('../netlify/functions/lib/xImportService');

function preflight() {
  const fatal = [];
  if (!process.env.SUPABASE_URL) fatal.push('SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) fatal.push('SUPABASE_SERVICE_ROLE_KEY');
  if (fatal.length > 0) {
    console.error('\nMissing required env vars:\n  ' + fatal.join('\n  '));
    process.exit(1);
  }
  if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
    console.warn('WARN: NETLIFY_SITE_ID / NETLIFY_BLOB_READ_WRITE_TOKEN not set.');
    console.warn('      Try: npx netlify dev:exec -- node scripts/backfill-x-blob-projection.js\n');
  }
}

async function main() {
  preflight();

  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) || 500 : 500;

  console.log(`\n=== Backfill X Blob projection (limit=${limit}) ===\n`);

  const { data: rows, error } = await supabase
    .from('x_posts')
    .select('x_post_id, source_urls, urgency, category')
    .order('created_at_x', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Supabase error:', error.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log('No x_posts rows found.');
    return;
  }

  const store = getPostStore();
  let updated = 0;
  let skipped = 0;
  let missing = 0;

  for (const row of rows) {
    const id = row.x_post_id;
    if (!id) continue;

    const existing = await readPost(store, id);
    if (!existing) {
      missing++;
      continue;
    }

    const sourceUrls = Array.isArray(row.source_urls) ? row.source_urls : [];
    const hasSources = sourceUrls.length > 0;
    const hasUrgency = !!row.urgency;
    const alreadyHas =
      (!hasSources || (Array.isArray(existing.source_urls) && existing.source_urls.length > 0)) &&
      (!hasUrgency || existing.urgency);

    if (alreadyHas && !hasSources && !hasUrgency) {
      skipped++;
      continue;
    }

    const merged = enrichCardPost(existing, sourceUrls, row.urgency || null);
    if (row.category && !merged.category) {
      merged.category = row.category;
    }

    await writePost(store, id, merged);
    updated++;
    if (updated % 25 === 0) {
      console.log(`  Updated ${updated} blobs...`);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`  Rows scanned : ${rows.length}`);
  console.log(`  Blobs updated: ${updated}`);
  console.log(`  Skipped      : ${skipped}`);
  console.log(`  Blob missing : ${missing}`);
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
