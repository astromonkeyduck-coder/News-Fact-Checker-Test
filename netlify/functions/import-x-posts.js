/**
 * Import X Posts — Scheduled Netlify Function
 *
 * Runs every 3 minutes (configured in netlify.toml).
 * Polls the X API v2 for new posts from the Noteworthy News account,
 * upserts into Supabase, and projects to Netlify Blobs so the
 * existing public site renders them automatically.
 *
 * Manual invocation is protected by CRON_SECRET.
 */

const { resolveUserId } = require('./lib/xApiClient');
const {
  importLatestPosts,
  getLatestImportedId,
} = require('./lib/xImportService');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  // For manual HTTP invocation, verify CRON_SECRET.
  // Netlify scheduled invocations don't send custom headers, so only
  // reject when a caller explicitly provides a wrong secret.
  const providedSecret =
    event.headers?.['x-cron-secret'] ||
    event.headers?.['X-Cron-Secret'] ||
    event.queryStringParameters?.secret;
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret && providedSecret && providedSecret !== expectedSecret) {
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
    console.log(`[import-x-posts] Polling since_id=${sinceId || '(none — first run)'}`);

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
