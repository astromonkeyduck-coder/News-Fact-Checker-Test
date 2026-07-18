/**
 * Canonical FDA page parser (Tier 1 fact source).
 *
 * Handles two official page layouts:
 *  1. Recall / safety-alert announcements
 *     (/safety/recalls-market-withdrawals-safety-alerts/...)
 *     - JSON-LD Article block
 *     - lcds-description-list--grid summary fields
 *     - "Company Announcement" narrative
 *     - Product photo gallery (/files/styles/recall_image_small/...)
 *  2. Outbreak investigation advisories
 *     (/food/outbreaks-foodborne-illness/...)
 *     - callout action line
 *     - labeled sections (Product:, Status:, Recommendations:, Current Update)
 *     - "Case Counts" labeled block
 *
 * Deterministic extraction order: canonical URL/meta → JSON-LD → labeled
 * summary fields → headings/sections → narrative patterns. Never invents
 * absent values.
 */

const {
  stripTags, decodeEntities, parseDateOnly, parseTimestamp,
  extractOutcomeMetrics, extractUpcs, sha256, normalizedBodyHash,
} = require('../../normalize');
const { extractStateList, isExplicitNationwide } = require('../../states');
const { safeFetchWithRetry } = require('../../httpClient');
const { canonicalizeFdaUrl } = require('./rss');

const PARSER_VERSION = 'fda-canonical-1.0.0';

async function fetchCanonicalPage(url) {
  const canonicalUrl = canonicalizeFdaUrl(url);
  if (!canonicalUrl) throw new Error(`Not a canonical FDA URL: ${url}`);
  const res = await safeFetchWithRetry(canonicalUrl, {
    accept: 'text/html,application/xhtml+xml',
    allowedContentTypes: ['html'],
  });
  return {
    canonicalUrl,
    finalUrl: res.finalUrl,
    httpStatus: res.status,
    contentType: res.contentType,
    html: res.body.toString('utf8'),
  };
}

/** Extract the JSON-LD Article node when present. */
function parseJsonLd(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  for (const [, raw] of blocks) {
    try {
      const parsed = JSON.parse(raw.trim());
      const nodes = Array.isArray(parsed['@graph']) ? parsed['@graph']
        : Array.isArray(parsed) ? parsed : [parsed];
      const article = nodes.find((n) => n && (n['@type'] === 'Article' || n['@type'] === 'NewsArticle'));
      if (article) return article;
    } catch (_) { /* malformed JSON-LD; fall through */ }
  }
  return null;
}

/** Extract labeled dt/dd pairs from the lcds description list. */
function parseSummaryFields(html) {
  const out = {};
  const dl = html.match(/<dl class="lcds-description-list[^"]*">([\s\S]*?)<\/dl>/i);
  if (!dl) return out;
  const pairs = [...dl[1].matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi)];
  for (const [, dtRaw, ddRaw] of pairs) {
    const label = stripTags(dtRaw).replace(/:$/, '').trim().toLowerCase();
    // Prefer <time datetime="..."> when present for date fields
    const timeAttr = ddRaw.match(/<time[^>]+datetime="([^"]+)"/i);
    const value = stripTags(ddRaw).replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    out[label] = { text: value, datetime: timeAttr ? timeAttr[1] : null };
  }
  return out;
}

function summaryField(fields, name) {
  const f = fields[name.toLowerCase()];
  return f ? f.text : null;
}

/** Extract multi-item field values (Brand Name(s) style field--item lists). */
function parseFieldItems(html, fieldClass) {
  const block = html.match(new RegExp(`<div class="field field--name-${fieldClass}[^"]*"[\\s\\S]*?</div>\\s*</div>`, 'i'));
  if (!block) return [];
  const items = [...block[0].matchAll(/<div class="field--item">([\s\S]*?)<\/div>/gi)];
  return items.map(([, v]) => stripTags(v).trim()).filter(Boolean);
}

/** Extract the "Company Announcement" narrative text (recall pages). */
function parseAnnouncementText(html) {
  const start = html.search(/<h2[^>]*>\s*Company Announcement\s*<\/h2>/i);
  if (start === -1) return null;
  const rest = html.slice(start);
  const endIdx = rest.search(/<h2[^>]*>\s*(Product Photos|Company Contact Information)\s*<\/h2>|<aside/i);
  const section = endIdx > 0 ? rest.slice(0, endIdx) : rest.slice(0, 40000);
  return stripTags(section).replace(/^Company Announcement\s*/i, '').trim();
}

/** Extract product photo candidates from an FDA page. */
function parseImages(html, canonicalUrl) {
  const images = [];
  const seen = new Set();
  const re = /<img[^>]+src="([^"]+)"[^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const src = decodeEntities(m[1]);
    if (!src || seen.has(src)) continue;
    seen.add(src);
    const alt = (tag.match(/alt="([^"]*)"/i) || [])[1] || '';
    images.push({
      src: absolutizeFdaUrl(src),
      alt: decodeEntities(alt).trim(),
      isRecallPhoto: /\/files\/styles\/recall_image/i.test(src),
      isFile: /^\/files\//i.test(src) || /\/files\//i.test(src),
      isThemeAsset: /\/themes\/|\/sites\/default\/files\/styles\/(?!recall)/i.test(src),
      sourcePage: canonicalUrl,
    });
  }
  return images.filter((img) => img.src);
}

function absolutizeFdaUrl(src) {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) {
    try {
      const u = new URL(src);
      if (!/(^|\.)fda\.gov$/i.test(u.hostname)) return null;
      u.protocol = 'https:';
      return u.toString();
    } catch (_) { return null; }
  }
  if (src.startsWith('/')) return `https://www.fda.gov${src}`;
  return null;
}

/** Derive the full-size /files/ URL from a Drupal style-derivative URL. */
function fullSizeImageUrl(src) {
  if (!src) return null;
  const m = src.match(/^(https:\/\/www\.fda\.gov)\/files\/styles\/[^/]+\/public\/(.+?)(\?.*)?$/i);
  if (m) return `${m[1]}/files/${m[2]}`;
  return src.split('?')[0];
}

/**
 * Parse the labeled "Case Counts" block used on outbreak advisory pages:
 *   Total Illnesses: 1,644
 *   Hospitalizations: 94
 *   Deaths: 0
 *   Last Illness Onset: July 13, 2026
 *   States with Cases: IN, KY, MI, OH, and WV
 *   Known Product Distribution*: MI, OH, WV, KY, and IN
 */
function parseCaseCountsBlock(text) {
  if (!text) return null;
  const idx = text.search(/Case Counts/i);
  if (idx === -1) return null;
  const block = text.slice(idx, idx + 1200);
  const out = { evidence: block.slice(0, 600).trim() };

  const grab = (label) => {
    const m = block.match(new RegExp(`${label}\\s*:?\\s*([^\\n]+)`, 'i'));
    return m ? m[1].trim() : null;
  };

  const ill = grab('Total Illnesses');
  if (ill) {
    const n = parseInt(ill.replace(/,/g, ''), 10);
    if (Number.isFinite(n)) out.illnesses = n;
  }
  const hosp = grab('Hospitalizations');
  if (hosp) {
    const n = parseInt(hosp.replace(/,/g, ''), 10);
    if (Number.isFinite(n)) out.hospitalizations = n;
  }
  const deaths = grab('Deaths');
  if (deaths) {
    const n = parseInt(deaths.replace(/,/g, ''), 10);
    if (Number.isFinite(n)) out.deaths = n;
  }
  const onset = grab('Last Illness Onset');
  if (onset) out.lastIllnessOnset = parseDateOnly(onset);

  const caseStates = grab('States with Cases');
  if (caseStates) {
    const { states, confident } = extractStateList(caseStates);
    if (confident) out.caseStates = states;
    out.caseStatesText = caseStates;
  }
  const dist = grab('Known Product Distribution\\*?');
  if (dist) {
    const clean = dist.replace(/\*.*$/, '').trim();
    const { states, confident } = extractStateList(clean);
    if (confident) out.distributionStates = states;
    out.distributionText = dist;
  }
  return out;
}

/** Extract labeled outbreak sections (Product:, Status:, Recommendations:, Current Update). */
function parseOutbreakSections(html) {
  const sections = {};
  const re = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const headings = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    headings.push({ label: stripTags(m[1]).replace(/:$/, '').trim(), end: re.lastIndex, start: m.index });
  }
  for (let i = 0; i < headings.length; i += 1) {
    const h = headings[i];
    const next = headings[i + 1];
    const body = html.slice(h.end, next ? next.start : h.end + 20000);
    const key = h.label.toLowerCase();
    if (!sections[key]) sections[key] = stripTags(body).trim();
  }
  return sections;
}

/** Extract the top "do not eat" style callout on advisory pages. */
function parseAdvisoryCallout(html) {
  const m = html.match(/<div[^>]*class="[^"]*(?:callout|lcds-banner|alert)[^"]*"[^>]*>([\s\S]{0,1200}?)<\/div>/i);
  if (m) {
    const text = stripTags(m[1]).trim();
    if (/do not (eat|consume|drink|use)/i.test(text)) return text;
  }
  // fallback: first strong "Do not eat..." sentence in page body
  const plain = stripTags(html);
  const s = plain.match(/Do not (?:eat|consume|drink)[^.]{5,220}\./i);
  return s ? s[0].trim() : null;
}

/**
 * Extract recommendations list from an outbreak page's Recommendations
 * section or a recall announcement's consumer-instruction sentences.
 */
function extractRecommendations(text) {
  if (!text) return [];
  const recs = [];
  const sentences = text.split(/(?<=\.)\s+/);
  for (const s of sentences) {
    if (/\b(do not eat|do not consume|do not serve|do not sell|should not (be )?(consumed|eaten)|throw (it |them )?away|discard|return (it|them|the product)?|refund|contact (your )?health|wash|clean and sanitize|check (your|the))\b/i.test(s)
        && s.length > 20 && s.length < 400) {
      recs.push(s.trim());
    }
    if (recs.length >= 6) break;
  }
  return recs;
}

/**
 * Extract product detail rows from the announcement narrative, e.g.
 *   "(1) Glutinous Rice Balls with Black Sesame Filling; UPC 6908791000053;
 *    Date Codes ("Use By" on the back panel): 9/22/2027 and 10/19/2027"
 */
function extractProductRows(text, { fallbackBrand = null, fallbackProduct = null } = {}) {
  if (!text) return [];
  const rows = [];

  // Numbered product-detail entries
  const numbered = [...text.matchAll(/\((\d)\)\s*([^;\n]+);?\s*([^\n]*)/g)];
  for (const [, , namePart, restPart] of numbered) {
    const name = namePart.trim();
    if (!name || name.length < 4 || name.length > 160) continue;
    const rest = restPart || '';
    const upcs = extractUpcs(`${name}; ${rest}`);
    const row = {
      product_name: name.replace(/[.;]$/, ''),
      brand: fallbackBrand || null,
      upc: upcs[0] || null,
      source_evidence: { text: `(${name}; ${rest})`.slice(0, 400) },
    };
    const dates = [...`${rest}`.matchAll(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/g)].map((d) => d[1]);
    if (/use.by/i.test(rest) && dates.length) row.use_by_date = dates.join(', ');
    else if (/best.by/i.test(rest) && dates.length) row.best_by_date = dates.join(', ');
    else if (/expir/i.test(rest) && dates.length) row.expiration_date = dates.join(', ');
    const lot = extractLotCode(rest);
    if (lot) row.lot_code = lot;
    rows.push(row);
  }

  // Package size shared across rows ("14.1 oz flexible plastic bag ...")
  const size = text.match(/Size\/?Packaging:?\s*([^\n]{3,120}?)(?=\s+(?:Distribution|Lot|UPC|Best|Use)\b|\n|$)/i);
  if (size) {
    for (const row of rows) {
      if (!row.package_size) row.package_size = size[1].trim();
    }
  }

  // Fallback: single product from summary fields + any UPC/lot in the text
  if (rows.length === 0 && fallbackProduct) {
    const upcs = extractUpcs(text);
    const lot = extractLotCode(text);
    const row = {
      product_name: fallbackProduct,
      brand: fallbackBrand || null,
      upc: upcs[0] || null,
      source_evidence: { text: 'derived from summary fields' },
    };
    if (lot) row.lot_code = lot;
    if (upcs.length > 1) row.additional_codes = upcs.slice(1).map((u) => `UPC ${u}`);
    rows.push(row);
  }

  return rows;
}

/**
 * Extract a lot code near a "Lot"/"Lot Code"/"Lot Number" label.
 * A real code must contain a digit; prose like "lots of Product X" never
 * qualifies as a lot code.
 */
function extractLotCode(text) {
  if (!text) return null;
  const m = text.match(/\blot(?:\s*(?:code|number|#))?s?[:\s]+([A-Z0-9][A-Z0-9 ,/-]{1,59})/i);
  if (!m) return null;
  const value = m[1].trim().replace(/[.,]$/, '').trim();
  if (!/\d/.test(value)) return null;
  return value;
}

/** Extract distribution info from the announcement narrative. */
function extractDistribution(text) {
  if (!text) return { distributionStates: [], distributionText: null, nationwide: false, confident: false };
  const m = text.match(/Distribut(?:ion|ed)[^:.]{0,40}[:.]?\s*([^\n]{3,400})/i)
    || text.match(/\b(?:sold|available|distributed)\s+(?:in|to|at|through)\s+([^\n.]{3,300})/i);
  const distributionText = m ? m[1].trim() : null;
  if (!distributionText) {
    return { distributionStates: [], distributionText: null, nationwide: false, confident: false };
  }
  const nationwide = isExplicitNationwide(distributionText) || isExplicitNationwide(text.slice(0, 4000));
  const { states, confident } = extractStateList(distributionText.split(/[–—-]\s|\(/)[0]);
  return {
    distributionStates: confident ? states : [],
    distributionText,
    nationwide,
    confident,
  };
}

/** Extract retailer names explicitly present in text. */
function extractRetailers(text) {
  if (!text) return [];
  const retailers = new Set();
  const known = [
    'Walmart', 'Target', 'Costco', 'Kroger', 'Albertsons', 'Safeway', 'Publix',
    'Whole Foods', "Trader Joe's", 'Aldi', 'Wegmans', 'H-E-B', 'Meijer',
    'Taco Bell', 'Sprouts', 'Food Lion', 'Giant', 'Stop & Shop', 'WinCo',
    'Sam\u2019s Club', "Sam's Club", 'BJ\u2019s', "BJ's Wholesale", 'Dollar General', 'Dollar Tree',
    '7-Eleven', 'Circle K', 'Amazon',
  ];
  for (const r of known) {
    if (text.includes(r)) retailers.add(r.replace('\u2019', "'"));
  }
  return [...retailers];
}

/**
 * Main parse entry. Returns a normalized "parse result" the pipeline can
 * validate and correlate. Every field is either from the page or null.
 */
function parseCanonicalPage(html, canonicalUrl) {
  const isRecallPage = /\/safety\/recalls-market-withdrawals-safety-alerts\//i.test(canonicalUrl);
  const isOutbreakPage = /\/food\/outbreaks-foodborne-illness\//i.test(canonicalUrl);

  const jsonLd = parseJsonLd(html);
  const summary = parseSummaryFields(html);
  const bodyText = stripTags(html);

  const title = (jsonLd && (jsonLd.headline || jsonLd.name))
    || stripTags((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '')
    || null;

  const result = {
    parserVersion: PARSER_VERSION,
    layout: isRecallPage ? 'recall_announcement' : isOutbreakPage ? 'outbreak_advisory' : 'unknown',
    canonicalUrl,
    title: title ? title.trim() : null,
    fdaPublishDate: null,
    sourceUpdatedAt: null,
    companyAnnouncementDate: null,
    company: null,
    brands: [],
    productType: null,
    recallReason: null,
    productDescription: null,
    announcementText: null,
    recommendations: [],
    publicActionText: null,
    products: [],
    images: [],
    metrics: null,
    caseCounts: null,
    caseStates: [],
    distributionStates: [],
    distributionText: null,
    nationwide: false,
    distributionConfident: false,
    retailers: [],
    status: null,
    isInitialPressReleaseLinked: /Link to Initial Press Release/i.test(bodyText),
    bodyHash: normalizedBodyHash(html),
    rawTextHash: sha256(bodyText),
    // Plain text of the page for geography-context extraction (not persisted raw).
    fullText: bodyText,
    warnings: [],
  };

  // Dates from JSON-LD / summary
  if (jsonLd) {
    result.fdaPublishDate = parseTimestamp(jsonLd.datePublished) || null;
    result.sourceUpdatedAt = parseTimestamp(jsonLd.dateModified) || result.fdaPublishDate;
  }
  const fdaPub = summary['fda publish date'];
  if (fdaPub && fdaPub.datetime) result.fdaPublishDate = parseTimestamp(fdaPub.datetime) || result.fdaPublishDate;
  const annDate = summary['company announcement date'];
  if (annDate) {
    result.companyAnnouncementDate = parseDateOnly(annDate.datetime || annDate.text);
  }

  // Summary fields (recall layout)
  result.company = summaryField(summary, 'company name');
  result.productType = summaryField(summary, 'product type');
  const reason = summaryField(summary, 'reason for announcement');
  result.recallReason = reason ? reason.replace(/^Recall Reason Description\s*/i, '').trim() : null;
  const brandItems = parseFieldItems(html, 'field-brand-name');
  result.brands = brandItems.length ? brandItems
    : (summaryField(summary, 'brand name') ? [summaryField(summary, 'brand name').replace(/^Brand Name\(s\)\s*/i, '').trim()] : []);
  const desc = summaryField(summary, 'product description');
  result.productDescription = desc ? desc.replace(/^Product Description\s*/i, '').trim() : null;

  // Images
  result.images = parseImages(html, canonicalUrl).map((img) => ({
    ...img,
    fullSizeUrl: img.isRecallPhoto || img.isFile ? fullSizeImageUrl(img.src) : img.src,
  }));

  if (isRecallPage || result.layout === 'unknown') {
    result.announcementText = parseAnnouncementText(html);
    const text = result.announcementText || bodyText;
    result.metrics = extractOutcomeMetrics(text);
    result.products = extractProductRows(text, {
      fallbackBrand: result.brands[0] || null,
      fallbackProduct: result.productDescription,
    });
    const dist = extractDistribution(text);
    result.distributionStates = dist.distributionStates;
    result.distributionText = dist.distributionText;
    result.nationwide = dist.nationwide;
    result.distributionConfident = dist.confident;
    result.retailers = extractRetailers(text);
    result.recommendations = extractRecommendations(text);
    result.publicActionText = result.recommendations.join(' ') || null;
  }

  if (isOutbreakPage) {
    const sections = parseOutbreakSections(html);
    const callout = parseAdvisoryCallout(html);
    result.publicActionText = callout
      || sections.recommendations
      || null;
    result.recommendations = extractRecommendations(sections.recommendations || callout || '');
    const statusText = sections.status || '';
    if (/ongoing|active/i.test(statusText)) result.status = 'ongoing';
    else if (/ended|closed|completed/i.test(statusText)) result.status = 'ended';

    // Case counts labeled block (preferred source of numbers)
    result.caseCounts = parseCaseCountsBlock(bodyText);
    if (result.caseCounts) {
      result.metrics = {
        illnesses: numOrNull(result.caseCounts.illnesses),
        hospitalizations: numOrNull(result.caseCounts.hospitalizations),
        deaths: numOrNull(result.caseCounts.deaths),
        husCases: null,
        lastIllnessOnset: result.caseCounts.lastIllnessOnset || null,
        qualifiers: {},
        evidence: { caseCounts: result.caseCounts.evidence },
      };
      result.caseStates = result.caseCounts.caseStates || [];
      result.distributionStates = result.caseCounts.distributionStates || [];
      result.distributionText = result.caseCounts.distributionText || null;
      result.distributionConfident = Boolean(result.caseCounts.distributionStates
        && result.caseCounts.distributionStates.length);
    } else {
      // Fall back to narrative metrics from the Current Update section
      const updateText = sections['current update'] || bodyText;
      result.metrics = extractOutcomeMetrics(updateText);
      if (result.metrics.lastIllnessOnset) {
        // keep
      }
    }
    result.retailers = extractRetailers(bodyText);
    // FDA advisory titles follow "Investigation of <...> Illnesses:
    // <Product> (<Month Year>)" — the most reliable product signal.
    const titleProduct = (result.title || '').match(/:\s*([^:()]{3,80}?)\s*(?:\(|$)/);
    if (titleProduct && !/unknown food|not yet identified/i.test(titleProduct[1])) {
      result.productDescription = titleProduct[1].trim();
    } else {
      const productSection = sections['product'] || '';
      const firstLine = productSection.split('\n')[0].trim();
      // Only use the section when it names a product, not when it is a
      // consumer instruction sentence.
      if (firstLine && firstLine.length < 120 && !/consumers should|do not eat/i.test(firstLine)) {
        result.productDescription = firstLine.slice(0, 300) || null;
      }
    }
    // Cross-check: narrative "no deaths have been reported" when the block
    // lacked deaths.
    if (result.metrics && result.metrics.deaths === null) {
      const nar = extractOutcomeMetrics(bodyText);
      if (nar.deaths !== null) {
        result.metrics.deaths = nar.deaths;
        result.metrics.evidence = { ...result.metrics.evidence, deaths: nar.evidence.deaths };
      }
    }
  }

  // Conflict detection: labeled block vs narrative totals
  if (result.caseCounts && result.caseCounts.illnesses !== undefined) {
    const narrative = extractOutcomeMetrics(bodyText);
    if (narrative.illnesses !== null
        && result.caseCounts.illnesses !== undefined
        && narrative.illnesses !== result.caseCounts.illnesses) {
      result.warnings.push(
        `conflicting_illness_totals:block=${result.caseCounts.illnesses},narrative=${narrative.illnesses}`,
      );
    }
  }

  if (!result.title) result.warnings.push('missing_title');

  return result;
}

function numOrNull(n) {
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

module.exports = {
  PARSER_VERSION,
  fetchCanonicalPage,
  parseCanonicalPage,
  parseJsonLd,
  parseSummaryFields,
  parseCaseCountsBlock,
  extractProductRows,
  extractDistribution,
  extractRecommendations,
  fullSizeImageUrl,
};
