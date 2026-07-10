'use strict';

const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

const RATE_LIMIT_STORE = 'public-mutation-rate-limits';
const memoryBuckets = new Map();

function getHeader(event, name) {
  const headers = event && event.headers ? event.headers : {};
  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || '';
}

function getAllowedOrigins() {
  const origins = new Set([
    'https://noteworthynews.co',
    'https://www.noteworthynews.co',
    process.env.URL,
    process.env.DEPLOY_URL,
    process.env.DEPLOY_PRIME_URL,
  ].filter(Boolean));

  if (process.env.NETLIFY_DEV) {
    origins.add('http://localhost:8888');
    origins.add('http://127.0.0.1:8888');
  }

  return origins;
}

function isDisallowedBrowserOrigin(event, allowedOrigins = getAllowedOrigins()) {
  const origin = getHeader(event, 'origin').trim();
  const fetchSite = getHeader(event, 'sec-fetch-site').trim().toLowerCase();

  if (origin && !allowedOrigins.has(origin)) return true;
  if (fetchSite === 'cross-site' && (!origin || !allowedOrigins.has(origin))) return true;
  return false;
}

function getClientFingerprint(event, scope) {
  const forwarded = getHeader(event, 'x-forwarded-for').split(',')[0].trim();
  const ip = getHeader(event, 'x-nf-client-connection-ip').trim()
    || getHeader(event, 'client-ip').trim()
    || forwarded
    || 'unknown';
  const userAgent = getHeader(event, 'user-agent').slice(0, 300);
  return crypto
    .createHash('sha256')
    .update(`${scope}\n${ip}\n${userAgent}`)
    .digest('hex');
}

function response(statusCode, headers, payload, retryAfterSeconds) {
  const responseHeaders = {
    ...headers,
    'Cache-Control': 'no-store',
  };
  if (retryAfterSeconds) responseHeaders['Retry-After'] = String(retryAfterSeconds);
  return {
    statusCode,
    headers: responseHeaders,
    body: JSON.stringify(payload),
  };
}

function consumeMemoryBucket(key, now, limit, windowMs) {
  const current = memoryBuckets.get(key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : current;

  if (bucket.count >= limit) {
    return { allowed: false, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  memoryBuckets.set(key, bucket);

  if (memoryBuckets.size > 5000) {
    for (const [candidateKey, value] of memoryBuckets) {
      if (value.resetAt <= now) memoryBuckets.delete(candidateKey);
    }
  }

  return { allowed: true, resetAt: bucket.resetAt };
}

async function consumeDurableBucket(key, now, limit, windowMs) {
  if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
    return null;
  }

  const store = getStore({
    name: RATE_LIMIT_STORE,
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
  });

  try {
    let bucket = null;
    try {
      bucket = await store.get(key, { type: 'json' });
    } catch {
      bucket = null;
    }

    if (!bucket || !Number.isFinite(bucket.resetAt) || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
    }

    if (bucket.count >= limit) {
      return { allowed: false, resetAt: bucket.resetAt };
    }

    bucket.count += 1;
    await store.set(key, JSON.stringify(bucket), { contentType: 'application/json' });
    return { allowed: true, resetAt: bucket.resetAt };
  } catch (error) {
    console.warn('[PublicGuard] Durable rate-limit storage unavailable; using instance-local fallback.');
    return null;
  }
}

/**
 * Best-effort abuse protection for anonymous mutation endpoints.
 *
 * The Netlify Blobs counter is shared across warm instances. It is intentionally
 * backed by an instance-local limiter when Blobs are unavailable so a storage
 * outage does not take the public site down. Provider-side quotas and bot
 * verification should remain the final backstop for high-value operations.
 */
async function enforcePublicRateLimit(event, options = {}) {
  const {
    scope = 'public-mutation',
    limit = 10,
    windowMs = 10 * 60 * 1000,
    maxBodyBytes = 32 * 1024,
    headers = { 'Content-Type': 'application/json' },
    enforceSameOrigin = true,
  } = options;

  const bodyBytes = Buffer.byteLength(event && event.body ? event.body : '', 'utf8');
  if (bodyBytes > maxBodyBytes) {
    return response(413, headers, { error: 'Request body too large' });
  }

  if (enforceSameOrigin && isDisallowedBrowserOrigin(event)) {
    return response(403, headers, { error: 'Cross-site request denied' });
  }

  const now = Date.now();
  const fingerprint = getClientFingerprint(event, scope);
  const key = `rate/${scope}/${fingerprint}`;
  const result = await consumeDurableBucket(key, now, limit, windowMs)
    || consumeMemoryBucket(key, now, limit, windowMs);

  if (!result.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - now) / 1000));
    return response(
      429,
      headers,
      { error: 'Too many requests. Please try again later.' },
      retryAfterSeconds,
    );
  }

  return null;
}

module.exports = {
  enforcePublicRateLimit,
  getAllowedOrigins,
  getClientFingerprint,
  isDisallowedBrowserOrigin,
};
