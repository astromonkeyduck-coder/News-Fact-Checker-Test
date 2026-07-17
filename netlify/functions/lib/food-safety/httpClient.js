/**
 * Hardened upstream HTTP client for the food-safety pipeline.
 *
 * - HTTPS-only
 * - explicit FDA hostname allowlist (including every redirect hop)
 * - AbortController timeouts
 * - response size caps
 * - content-type validation
 * - conditional requests (ETag / Last-Modified)
 * - bounded retries with exponential backoff + jitter
 */

const { USER_AGENT, ALLOWED_HOSTS } = require('./config');

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_BYTES = 3 * 1024 * 1024; // 3 MB for HTML/XML
const MAX_REDIRECTS = 5;

class FetchError extends Error {
  constructor(message, { permanent = false, status = null } = {}) {
    super(message);
    this.name = 'FetchError';
    this.permanent = permanent;
    this.status = status;
  }
}

function assertAllowedUrl(rawUrl, { allowedHosts = ALLOWED_HOSTS } = {}) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch (e) {
    throw new FetchError(`Invalid URL: ${rawUrl}`, { permanent: true });
  }
  if (url.protocol !== 'https:') {
    throw new FetchError(`Blocked non-HTTPS URL: ${rawUrl}`, { permanent: true });
  }
  if (!allowedHosts.has(url.hostname.toLowerCase())) {
    throw new FetchError(`Blocked disallowed hostname: ${url.hostname}`, { permanent: true });
  }
  return url;
}

function isAllowedUrl(rawUrl, opts = {}) {
  try {
    assertAllowedUrl(rawUrl, opts);
    return true;
  } catch (_) {
    return false;
  }
}

async function readBodyWithCap(res, maxBytes) {
  const reader = res.body && typeof res.body.getReader === 'function' ? res.body.getReader() : null;
  if (!reader) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) {
      throw new FetchError(`Response exceeded max size (${buf.length} > ${maxBytes})`, { permanent: true });
    }
    return buf;
  }
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try { await reader.cancel(); } catch (_) {}
      throw new FetchError(`Response exceeded max size (> ${maxBytes} bytes)`, { permanent: true });
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

/**
 * Fetch a URL with manual redirect validation. Every hop must remain on the
 * allowlist. Returns { status, headers, body (Buffer), finalUrl,
 * notModified }.
 */
async function safeFetch(rawUrl, {
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBytes = DEFAULT_MAX_BYTES,
  allowedContentTypes = null, // array of substrings, e.g. ['xml', 'html']
  etag = null,
  lastModified = null,
  accept = null,
  allowedHosts = ALLOWED_HOSTS,
} = {}) {
  let currentUrl = assertAllowedUrl(rawUrl, { allowedHosts }).toString();

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      const headers = { 'User-Agent': USER_AGENT };
      if (accept) headers.Accept = accept;
      if (etag) headers['If-None-Match'] = etag;
      if (lastModified) headers['If-Modified-Since'] = lastModified;
      res = await fetch(currentUrl, {
        headers,
        redirect: 'manual',
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      throw new FetchError(`Fetch failed for ${currentUrl}: ${e.message}`);
    }
    clearTimeout(timer);

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new FetchError(`Redirect without Location from ${currentUrl}`, { permanent: true });
      const nextUrl = new URL(location, currentUrl).toString();
      // Every redirect hop must stay on the allowlist (SSRF protection).
      assertAllowedUrl(nextUrl, { allowedHosts });
      currentUrl = nextUrl;
      continue;
    }

    if (res.status === 304) {
      return { status: 304, notModified: true, headers: res.headers, body: null, finalUrl: currentUrl };
    }

    if (res.status >= 400) {
      const permanent = res.status >= 400 && res.status < 500 && res.status !== 429;
      throw new FetchError(`HTTP ${res.status} from ${currentUrl}`, { permanent, status: res.status });
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (allowedContentTypes && !allowedContentTypes.some((t) => contentType.includes(t))) {
      throw new FetchError(`Unexpected content-type "${contentType}" from ${currentUrl}`, { permanent: true });
    }

    const body = await readBodyWithCap(res, maxBytes);
    return {
      status: res.status,
      notModified: false,
      headers: res.headers,
      contentType,
      body,
      finalUrl: currentUrl,
    };
  }
  throw new FetchError(`Too many redirects from ${rawUrl}`, { permanent: true });
}

/**
 * safeFetch with bounded retries + exponential backoff and jitter.
 * Permanent (4xx) errors are not retried.
 */
async function safeFetchWithRetry(rawUrl, opts = {}, { retries = 2, baseDelayMs = 500 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await safeFetch(rawUrl, opts);
    } catch (e) {
      lastError = e;
      if (e.permanent) throw e;
      if (attempt < retries) {
        const delay = baseDelayMs * 2 ** attempt + Math.random() * 250;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

module.exports = {
  FetchError,
  assertAllowedUrl,
  isAllowedUrl,
  safeFetch,
  safeFetchWithRetry,
  DEFAULT_MAX_BYTES,
};
