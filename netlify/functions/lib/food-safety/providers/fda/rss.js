/**
 * FDA RSS discovery (Tier 1 low-latency).
 *
 * Feeds (see ../../config.js FEEDS):
 * - Food Safety Recalls RSS
 * - FDA Outbreaks RSS
 * - Recalls RSS (filtered safety net)
 * - Food Allergies RSS (filtered safety net)
 *
 * Uses conditional requests (ETag / If-Modified-Since) and returns
 * normalized feed items. Never fabricates data: only feed-provided fields.
 */

const Parser = require('rss-parser');
const { safeFetchWithRetry } = require('../../httpClient');
const { sha256 } = require('../../normalize');

const parser = new Parser({
  customFields: { item: [['dc:creator', 'creator']] },
});

/**
 * Canonicalize an FDA URL: force https + www.fda.gov, strip tracking params
 * and fragments so the same page discovered via different feeds correlates.
 */
function canonicalizeFdaUrl(rawUrl) {
  if (!rawUrl) return null;
  let url;
  try {
    url = new URL(String(rawUrl).trim());
  } catch (_) {
    return null;
  }
  if (!/(^|\.)fda\.gov$/i.test(url.hostname)) return null;
  url.protocol = 'https:';
  if (url.hostname.toLowerCase() === 'fda.gov') url.hostname = 'www.fda.gov';
  url.hash = '';
  const params = new URLSearchParams();
  // Drop every query param: FDA canonical article URLs are path-based; feed
  // links sometimes carry utm_* or randparam cache busters.
  url.search = params.toString();
  let s = url.toString();
  if (s.endsWith('/')) s = s.slice(0, -1);
  return s;
}

/**
 * Fetch and parse one FDA RSS feed.
 * @returns {Promise<{notModified: boolean, etag, lastModified, items: Array}>}
 */
async function fetchFeed(feed, { etag = null, lastModified = null } = {}) {
  const res = await safeFetchWithRetry(feed.url, {
    accept: 'application/rss+xml, application/xml, text/xml',
    allowedContentTypes: ['xml', 'text/plain'],
    etag,
    lastModified,
  });

  if (res.notModified) {
    return { notModified: true, etag, lastModified, items: [] };
  }

  const xml = res.body.toString('utf8');
  const parsed = await parser.parseString(xml);
  const items = (parsed.items || []).map((item) => normalizeFeedItem(item, feed)).filter(Boolean);

  return {
    notModified: false,
    etag: res.headers.get('etag') || null,
    lastModified: res.headers.get('last-modified') || null,
    httpStatus: res.status,
    contentType: res.contentType || null,
    bodyHash: sha256(xml),
    items,
  };
}

function normalizeFeedItem(item, feed) {
  const link = canonicalizeFdaUrl(item.link || item.guid);
  if (!link) return null;
  const guid = item.guid || item.link;
  const title = (item.title || '').trim();
  const description = (item.contentSnippet || item.content || item.description || '').trim();
  const publishedAt = item.isoDate || (item.pubDate ? safeIso(item.pubDate) : null);

  return {
    sourceKind: feed.kind,
    feedUrl: feed.url,
    filtered: Boolean(feed.filtered),
    externalId: link, // canonical URL is the stable identity for FDA feed items
    feedGuid: guid || null,
    canonicalUrl: link,
    title,
    description,
    publishedAt,
    contentHash: sha256(`${title}\n${description}\n${publishedAt || ''}`),
  };
}

function safeIso(s) {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

module.exports = { fetchFeed, canonicalizeFdaUrl };
