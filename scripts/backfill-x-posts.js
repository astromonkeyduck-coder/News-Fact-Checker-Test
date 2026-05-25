#!/usr/bin/env node

/**
 * Backfill X Posts
 *
 * One-time (safe-to-rerun) script that imports the most recent posts
 * from the Noteworthy News X account into Supabase + Netlify Blobs.
 *
 * Usage:
 *   node scripts/backfill-x-posts.js              # imports last 50
 *   node scripts/backfill-x-posts.js --count=20   # imports last 20
 *   node scripts/backfill-x-posts.js --force       # re-import even if in Supabase
 *
 * Requires .env / .env.local with:
 *   X_BEARER_TOKEN, NOTEWORTHY_X_USER_ID (or NOTEWORTHY_X_USERNAME),
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   NETLIFY_SITE_ID, NETLIFY_BLOB_READ_WRITE_TOKEN
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local'), override: false });

const { resolveUserId } = require('../netlify/functions/lib/xApiClient');
const { importLatestPosts } = require('../netlify/functions/lib/xImportService');

function preflight() {
  const fatal = [];
  if (!process.env.X_BEARER_TOKEN) fatal.push('X_BEARER_TOKEN');
  if (!process.env.NOTEWORTHY_X_USER_ID && !process.env.NOTEWORTHY_X_USERNAME) fatal.push('NOTEWORTHY_X_USER_ID or NOTEWORTHY_X_USERNAME');
  if (!process.env.SUPABASE_URL) fatal.push('SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) fatal.push('SUPABASE_SERVICE_ROLE_KEY');

  if (fatal.length > 0) {
    console.error('\nMissing required env vars:\n  ' + fatal.join('\n  '));
    console.error('\nAdd them to .env or .env.local.\n');
    process.exit(1);
  }

  if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
    console.warn('WARN: NETLIFY_SITE_ID / NETLIFY_BLOB_READ_WRITE_TOKEN not found in env.');
    console.warn('      Run via: npx netlify dev:exec -- node scripts/backfill-x-posts.js');
    console.warn('      Netlify auto-detection will be used if available.\n');
  }
}

async function main() {
  preflight();

  const countArg = process.argv.find((a) => a.startsWith('--count='));
  const count = countArg ? Math.min(parseInt(countArg.split('=')[1], 10) || 50, 100) : 50;
  const force = process.argv.includes('--force');

  console.log(`\n=== Backfill X Posts (count=${count}${force ? ', force=true' : ''}) ===\n`);

  let userId = process.env.NOTEWORTHY_X_USER_ID;

  if (!userId) {
    const username = process.env.NOTEWORTHY_X_USERNAME;
    console.log(`Resolving @${username} to user ID...`);
    userId = await resolveUserId(username);
    console.log(`Resolved: ${userId}  (add NOTEWORTHY_X_USER_ID=${userId} to .env to skip this step)\n`);
  }

  const perPage = Math.min(count, 100);
  const pages = Math.ceil(count / perPage);

  const result = await importLatestPosts({
    userId,
    maxResults: perPage,
    pages,
    force,
  });

  console.log('\n=== Backfill Summary ===');
  console.log(`  Imported : ${result.imported_count}`);
  console.log(`  Skipped  : ${result.skipped_count} (already existed)`);
  console.log(`  Failed   : ${result.failed_count}`);
  if (result.latest_x_post_id) {
    console.log(`  Latest ID: ${result.latest_x_post_id}`);
  }
  if (result.errors.length > 0) {
    console.log('\n  Errors:');
    result.errors.forEach((e) => console.log(`    - ${e}`));
  }
  console.log('');
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
