/**
 * X API v2 Client
 *
 * App-only bearer-token access to the X (Twitter) API v2.
 * All network calls go through this module so rate-limit handling,
 * retries, and logging are centralised.
 */

const BASE = 'https://api.x.com/2';

const TWEET_FIELDS = [
  'created_at',
  'conversation_id',
  'entities',
  'referenced_tweets',
  'public_metrics',
  'attachments',
  'author_id',
  'in_reply_to_user_id',
].join(',');

const MEDIA_FIELDS = [
  'type',
  'url',
  'preview_image_url',
  'width',
  'height',
  'alt_text',
  'duration_ms',
  'variants',
].join(',');

const EXPANSIONS = [
  'attachments.media_keys',
  'referenced_tweets.id',
].join(',');

function getBearerToken() {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) throw new Error('X_BEARER_TOKEN is not set');
  return token;
}

async function xFetch(url, retries = 2) {
  const token = getBearerToken();

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 429) {
      const resetEpoch = res.headers.get('x-rate-limit-reset');
      const waitMs = resetEpoch
        ? Math.max(0, Number(resetEpoch) * 1000 - Date.now()) + 1000
        : (attempt + 1) * 15000;
      const cappedWait = Math.min(waitMs, 60000);
      console.warn(`[xApiClient] 429 rate-limited. Waiting ${Math.round(cappedWait / 1000)}s (attempt ${attempt + 1}/${retries + 1})`);
      await sleep(cappedWait);
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const msg = `X API ${res.status}: ${body.slice(0, 300)}`;
      if (attempt < retries && res.status >= 500) {
        console.warn(`[xApiClient] ${msg} - retrying`);
        await sleep((attempt + 1) * 2000);
        continue;
      }
      throw new Error(msg);
    }

    return res.json();
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Resolve an X username to a numeric user ID.
 */
async function resolveUserId(username) {
  const clean = username.replace(/^@/, '');
  const data = await xFetch(`${BASE}/users/by/username/${encodeURIComponent(clean)}`);
  if (!data?.data?.id) {
    throw new Error(`Could not resolve user ID for @${clean}`);
  }
  return data.data.id;
}

/**
 * Fetch recent tweets from a user timeline.
 *
 * @param {string} userId        Numeric X user ID
 * @param {object} [opts]
 * @param {string} [opts.sinceId]     Only tweets after this ID
 * @param {number} [opts.maxResults]  1–100, default 10
 * @param {string} [opts.paginationToken] For paginating large result sets
 * @returns {{ tweets: object[], includes: object, meta: object }}
 */
async function getUserTweets(userId, opts = {}) {
  const params = new URLSearchParams({
    'tweet.fields': TWEET_FIELDS,
    'media.fields': MEDIA_FIELDS,
    expansions: EXPANSIONS,
    max_results: String(opts.maxResults || 10),
  });

  if (opts.sinceId) params.set('since_id', opts.sinceId);
  if (opts.paginationToken) params.set('pagination_token', opts.paginationToken);

  // Exclude replies to other users but keep self-replies (threads)
  params.set('exclude', 'retweets');

  const url = `${BASE}/users/${encodeURIComponent(userId)}/tweets?${params}`;
  const data = await xFetch(url);

  const tweets = data?.data || [];
  const includes = data?.includes || {};
  const meta = data?.meta || {};

  return { tweets, includes, meta };
}

module.exports = {
  resolveUserId,
  getUserTweets,
};
