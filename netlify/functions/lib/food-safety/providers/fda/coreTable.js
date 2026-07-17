/**
 * FDA CORE outbreak-investigation table (Tier 1 discovery + versioning).
 *
 * https://www.fda.gov/food/outbreaks-foodborne-illness/investigations-foodborne-illness-outbreaks
 *
 * Columns observed on the live page:
 *   Date Posted | Reference # | Pathogen or Cause of Illness |
 *   Product(s) Linked to Illnesses (if any) | Total Case Count |
 *   Investigation Status | Outbreak/Event Status | Recall Initiated |
 *   FDA Traceback Initiated | FDA Inspection Initiated | FDA Sampling Initiated
 *
 * The FDA reference number is the primary identity for an investigation.
 * "Not Yet Identified" products must never be treated as product names.
 */

const { safeFetchWithRetry } = require('../../httpClient');
const { stripTags, parseDateOnly, sha256 } = require('../../normalize');
const { CORE_TABLE_URL } = require('../../config');
const { canonicalizeFdaUrl } = require('./rss');

const UNKNOWN_PRODUCT_RE = /^(not yet identified|unknown|tbd|pending|n\/?a|none)\.?$/i;

async function fetchCoreTable({ etag = null, lastModified = null } = {}) {
  const res = await safeFetchWithRetry(CORE_TABLE_URL, {
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
    rows: parseCoreTable(html),
  };
}

function parseCoreTable(html) {
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) throw new Error('core_table_parser_drift: no table found');

  const rowsHtml = [...tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const rows = [];
  let headers = null;

  for (const [, rowHtml] of rowsHtml) {
    const cells = [...rowHtml.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(([, c]) => c);
    if (cells.length === 0) continue;
    const textCells = cells.map((c) => stripTags(c).replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim());

    if (!headers) {
      headers = textCells.map((h) => h.toLowerCase().replace(/\s+/g, ''));
      continue;
    }
    if (cells.length < 6) continue;

    const col = (fragment) => {
      const idx = headers.findIndex((h) => h.includes(fragment));
      return idx >= 0 ? { text: textCells[idx], html: cells[idx] } : { text: null, html: '' };
    };

    const ref = (col('reference').text || '').replace(/\D/g, '') || null;
    if (!ref) continue;

    const productCell = col('product');
    const advisoryLink = (productCell.html.match(/href="([^"]+)"/i) || [])[1]
      || (col('outbreak').html.match(/href="([^"]+)"/i) || [])[1]
      || (col('casecount').html.match(/href="([^"]+)"/i) || [])[1]
      || null;
    const advisoryUrl = advisoryLink
      ? canonicalizeFdaUrl(advisoryLink.startsWith('http') ? advisoryLink : `https://www.fda.gov${advisoryLink}`)
      : null;

    const productRaw = (productCell.text || '').trim();
    const productKnown = productRaw && !UNKNOWN_PRODUCT_RE.test(productRaw);

    const caseCountRaw = (col('casecount').text || '').trim();
    let totalCaseCount = null;
    if (/^\d[\d,]*$/.test(caseCountRaw)) totalCaseCount = parseInt(caseCountRaw.replace(/,/g, ''), 10);

    const check = (fragment) => /✔|✓|yes/i.test(col(fragment).text || '');

    rows.push({
      referenceNumber: ref,
      datePosted: parseDateOnly(col('dateposted').text || col('date').text),
      pathogen: col('pathogen').text || null,
      productLinked: productKnown ? productRaw : null,
      productKnown,
      productRaw: productRaw || null,
      totalCaseCount,
      caseCountText: caseCountRaw || null,
      investigationStatus: col('investigationstatus').text || null,
      outbreakStatus: col('outbreak/eventstatus').text || col('eventstatus').text || null,
      recallInitiated: check('recall'),
      tracebackInitiated: check('traceback'),
      inspectionInitiated: check('inspection'),
      samplingInitiated: check('sampling'),
      advisoryUrl,
      rowHash: sha256(textCells.join('|')),
    });
  }

  if (rows.length === 0) throw new Error('core_table_parser_drift: zero data rows parsed');
  return rows;
}

module.exports = { fetchCoreTable, parseCoreTable, UNKNOWN_PRODUCT_RE };
