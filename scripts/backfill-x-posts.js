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
 *
 * Requires .env with:
 *   X_BEARER_TOKEN, NOTEWORTHY_X_USER_ID (or NOTEWORTHY_X_USERNAME),
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   NETLIFY_SITE_ID, NETLIFY_BLOB_READ_WRITE_TOKEN
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { resolveUserId } = require('../netlify/functions/lib/xApiClient');
const { importLatestPosts } = require('../netlify/functions/lib/xImportService');

async function main() {
  const countArg = process.argv.find((a) => a.startsWith('--count='));
  const count = countArg ? Math.min(parseInt(countArg.split('=')[1], 10) || 50, 100) : 50;

  console.log(`\n=== Backfill X Posts (count=${count}) ===\n`);

  let userId = process.env.NOTEWORTHY_X_USER_ID;

  if (!userId) {
    const username = process.env.NOTEWORTHY_X_USERNAME;
    if (!username) {
      console.error('Set NOTEWORTHY_X_USER_ID or NOTEWORTHY_X_USERNAME in .env');
      process.exit(1);
    }
    console.log(`Resolving @${username} to user ID...`);
    userId = await resolveUserId(username);
    console.log(`Resolved: ${userId}  (add NOTEWORTHY_X_USER_ID=${userId} to .env to skip this step)\n`);
  }

  // X API max_results caps at 100; for larger counts, paginate
  const perPage = Math.min(count, 100);
  const pages = Math.ceil(count / perPage);

  const result = await importLatestPosts({
    userId,
    maxResults: perPage,
    pages,
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
