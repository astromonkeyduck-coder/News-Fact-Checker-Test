/**
 * Import X Posts - Scheduled Netlify Function
 *
 * Runs every 3 minutes (configured in netlify.toml).
 * Polls the X API v2 for new posts from the Noteworthy News account,
 * upserts into Supabase, and projects to Netlify Blobs so the
 * existing public site renders them automatically.
 *
 * Manual invocation is protected by CRON_SECRET.
 */

const crypto = require('crypto');
const { resolveUserId } = require('./lib/xApiClient');
const {
  importLatestPosts,
  getLatestImportedId,
} = require('./lib/xImportService');

// Constant-time secret comparison (avoids leaking the secret via timing).
function secretsMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  // Auth model - this is a Netlify SCHEDULED function (see netlify.toml:
  // [functions."import-x-posts"].schedule). Per Netlify, a function with a
  // `schedule` "does not accept incoming web requests": direct public HTTP
  // calls return 500 and never reach this code, so in production the cron
  // schedule is the ONLY path that runs. The checks below are defense-in-depth
  // for local dev / branch deploys / any future change that drops the schedule:
  //   • the genuine scheduled invocation arrives with a { next_run } body and
  //     carries no secret, so it is allowed;
  //   • EVERY other (manual/HTTP) caller MUST present a matching CRON_SECRET.
  // FAIL-CLOSED: a manual call without the secret is rejected even when
  // CRON_SECRET is unset (previously this path failed OPEN). A "forged
  // { next_run }" body cannot originate from a public caller in production
  // because the platform refuses to route HTTP to a scheduled function.
  const providedSecret =
    event.headers?.['x-cron-secret'] ||
    event.headers?.['X-Cron-Secret'] ||
    event.queryStringParameters?.secret;
  const expectedSecret = process.env.CRON_SECRET;
  const isScheduledInvocation = (() => {
    try { return !!JSON.parse(event.body || '{}').next_run; } catch { return false; }
  })();
  const secretOk = secretsMatch(providedSecret, expectedSecret);
  if (!isScheduledInvocation && !secretOk) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  try {
    let userId = process.env.NOTEWORTHY_X_USER_ID;

    if (!userId) {
      const username = process.env.NOTEWORTHY_X_USERNAME;
      if (!username) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: 'NOTEWORTHY_X_USER_ID or NOTEWORTHY_X_USERNAME must be set',
          }),
        };
      }
      console.log(`[import-x-posts] Resolving @${username}...`);
      userId = await resolveUserId(username);
      console.log(`[import-x-posts] Resolved to ${userId}`);
    }

    const sinceId = await getLatestImportedId();
    console.log(`[import-x-posts] Polling since_id=${sinceId || '(none - first run)'}`);

    const result = await importLatestPosts({
      userId,
      sinceId: sinceId || undefined,
      maxResults: sinceId ? 20 : 50,
      pages: sinceId ? 1 : 3,
    });

    console.log(
      `[import-x-posts] Complete: imported=${result.imported_count} skipped=${result.skipped_count} failed=${result.failed_count}`
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error('[import-x-posts] Fatal error:', err);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        imported_count: 0,
        skipped_count: 0,
        failed_count: 0,
        latest_x_post_id: null,
        errors: [err.message],
      }),
    };
  }
};

exports.config = {
  schedule: '*/3 * * * *',
};
