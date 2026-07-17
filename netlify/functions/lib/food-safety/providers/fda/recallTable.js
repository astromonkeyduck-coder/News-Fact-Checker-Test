/**
 * FDA structured recall index (Tier 1 discovery + reconciliation).
 *
 * https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts
 *
 * The page is a Drupal datatables view. The AJAX endpoint requires an
 * ephemeral `randparam` cache-buster and undocumented view arguments, so we
 * deliberately parse the server-rendered HTML table (#datatable), which is
 * stable, official, and contains the most recent rows with columns:
 *   Date | Brand Name(s) | Product Description | Product Type |
 *   Recall Reason Description | Company Name | Terminated Recall | Excerpt
 *
 * This is an index only. Consumer facts always come from the canonical
 * recall page linked in each row.
 */

const { safeFetchWithRetry } = require('../../httpClient');
const { stripTags, parseDateOnly, sha256 } = require('../../normalize');
const { RECALL_TABLE_URL } = require('../../config');
const { canonicalizeFdaUrl } = require('./rss');

async function fetchRecallTable({ etag = null, lastModified = null } = {}) {
  const res = await safeFetchWithRetry(RECALL_TABLE_URL, {
    accept: 'text/html',
    allowedContentTypes: ['html'],
    etag,
    lastModified,
  });
  if (res.notModified) return { notModified: true, rows: [] };
  const html = res.body.toString('utf8');
  return {
    notModified: false,
    etag: res.headers.get('etag') || null,
    lastModified: res.headers.get('last-modified') || null,
    bodyHash: sha256(html),
    rows: parseRecallTable(html),
  };
}

/**
 * Parse the server-rendered #datatable rows.
 * Returns [] with a thrown error only on structural drift (no table at all).
 */
function parseRecallTable(html) {
  const tableMatch = html.match(/<table[^>]*id="datatable"[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) {
    throw new Error('recall_table_parser_drift: #datatable not found');
  }
  const rowsHtml = [...tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const rows = [];
  let headers = null;

  for (const [, rowHtml] of rowsHtml) {
    const cells = [...rowHtml.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(([, c]) => c);
    if (cells.length === 0) continue;
    const textCells = cells.map((c) => stripTags(c).replace(/\s+/g, ' ').trim());

    if (!headers) {
      headers = textCells.map((h) => h.toLowerCase());
      continue;
    }
    if (cells.length < 6) continue;

    const get = (label) => {
      const idx = headers.findIndex((h) => h.includes(label));
      return idx >= 0 ? textCells[idx] : null;
    };
    const linkCell = cells[headers.findIndex((h) => h.includes('brand'))] || cells[1] || '';
    const link = (linkCell.match(/href="([^"]+)"/i) || [])[1] || null;
    const canonicalUrl = link
      ? canonicalizeFdaUrl(link.startsWith('http') ? link : `https://www.fda.gov${link}`)
      : null;
    if (!canonicalUrl) continue;

    rows.push({
      date: parseDateOnly(get('date')),
      brand: get('brand'),
      productDescription: get('product description'),
      productType: get('product type'),
      recallReason: get('recall reason') || get('reason'),
      company: get('company'),
      terminated: /terminated/i.test(get('terminated') || ''),
      excerpt: get('excerpt'),
      canonicalUrl,
    });
  }

  if (rows.length === 0) {
    throw new Error('recall_table_parser_drift: zero data rows parsed');
  }
  return rows;
}

module.exports = { fetchRecallTable, parseRecallTable };
