/**
 * Deterministic correlation of source documents to canonical events.
 *
 * Strong identifiers, in priority order:
 *   1. FDA CORE reference number  → fda:core:<ref>
 *   2. Canonical FDA page URL     → fda:page:<sha16(url)>
 *   3. Recall number (openFDA)    → matched against recall_numbers
 *
 * "Sounds related" is never sufficient; low-confidence relationships go to
 * review instead of merging. Recall expansions that publish a NEW canonical
 * page are linked as related events via explicit official links (e.g. the
 * "Link to Initial Press Release" anchor), not merged.
 */

const { sha256 } = require('./normalize');
const {
  getEventByCanonicalKey,
  getEventBySourceUrl,
  getEventByReferenceNumber,
} = require('./store');

function canonicalKeyForPage(canonicalUrl) {
  return `fda:page:${sha256(canonicalUrl).slice(0, 16)}`;
}

function canonicalKeyForCore(referenceNumber) {
  return `fda:core:${referenceNumber}`;
}

/**
 * Resolve the canonical event for a parsed source document.
 * Returns { event: existingEvent|null, canonicalKey, method, confidence,
 * needsReview, reviewReason }.
 */
async function correlateDocument({ sourceKind, canonicalUrl, referenceNumber, recallNumbers }) {
  // 1. CORE reference number (outbreak investigations)
  if (referenceNumber) {
    const key = canonicalKeyForCore(referenceNumber);
    const byRef = await getEventByCanonicalKey(key)
      || await getEventByReferenceNumber(referenceNumber);
    if (byRef) {
      return {
        event: byRef, canonicalKey: byRef.canonical_key, method: 'core_reference_number', confidence: 1, needsReview: false,
      };
    }
    return {
      event: null, canonicalKey: key, method: 'core_reference_number', confidence: 1, needsReview: false,
    };
  }

  // 2. Canonical page URL
  if (canonicalUrl) {
    const key = canonicalKeyForPage(canonicalUrl);
    const byKey = await getEventByCanonicalKey(key);
    if (byKey) {
      return {
        event: byKey, canonicalKey: key, method: 'canonical_url', confidence: 1, needsReview: false,
      };
    }
    const byUrl = await getEventBySourceUrl(canonicalUrl);
    if (byUrl) {
      return {
        event: byUrl, canonicalKey: byUrl.canonical_key, method: 'source_url', confidence: 1, needsReview: false,
      };
    }
    return {
      event: null, canonicalKey: key, method: 'canonical_url', confidence: 1, needsReview: false,
    };
  }

  // 3. Recall numbers only (openFDA reconciliation without canonical page):
  // this can only ENRICH an existing event; it must not create a public one.
  if (Array.isArray(recallNumbers) && recallNumbers.length > 0) {
    return {
      event: null,
      canonicalKey: `fda:recall:${recallNumbers[0]}`,
      method: 'recall_number',
      confidence: 0.6,
      needsReview: true,
      reviewReason: 'openfda_record_without_canonical_page',
    };
  }

  return {
    event: null,
    canonicalKey: null,
    method: 'none',
    confidence: 0,
    needsReview: true,
    reviewReason: 'no_strong_identifier',
  };
}

/**
 * Detect an official relationship to another event (e.g. an expansion
 * announcement linking its initial press release). Returns related canonical
 * page URLs found in the parsed page's official links.
 *
 * Intentionally excludes FDA section index / resource / about pages that appear
 * in every outbreak/recall sidebar — those polluted Source Trail with dozens of
 * identical "fda.gov" chips.
 */
const RELATED_URL_DENYLIST = [
  /^https?:\/\/(?:www\.)?fda\.gov\/safety\/recalls-market-withdrawals-safety-alerts\/?$/i,
  /^https?:\/\/(?:www\.)?fda\.gov\/food\/outbreaks-foodborne-illness\/?$/i,
  /^https?:\/\/(?:www\.)?fda\.gov\/food\/outbreaks-foodborne-illness\/investigations-foodborne-illness-outbreaks\/?$/i,
  /\/(recall-resources|enforcement-reports|industry-guidance-recalls|major-product-recalls)\/?$/i,
  /\/(about-core-network|core-annual-reports|core-publications|outbreak-investigation-reports)\/?$/i,
  /\/(post-outbreak-response|strengthening-food-safety|public-health-advisories|food-safety-tips|food-safety-resources|foodborne-illness-outbreak-executive|foodborne-outbreak-overview|foodborne-outbreak-response|foodborne-pathogens)(?:-[a-z0-9-]+)?\/?$/i,
];

function isPeerAnnouncementUrl(href) {
  if (!href || typeof href !== 'string') return false;
  const path = href.split('?')[0].split('#')[0];
  if (!/\/(safety\/recalls-market-withdrawals-safety-alerts|food\/outbreaks-foodborne-illness)\/[a-z0-9-]{20,}/i.test(path)) {
    return false;
  }
  if (RELATED_URL_DENYLIST.some((re) => re.test(path))) return false;
  // Peer announcements are long editorial slugs, not short section names.
  const slug = path.split('/').pop() || '';
  if (slug.split('-').length < 4) return false;
  return true;
}

function findRelatedOfficialUrls(parseResult, html) {
  const related = new Set();
  if (!html) return [];
  // "Link to Initial Press Release" and other recall/outbreak cross-links
  const re = /<a[^>]+href="(https?:\/\/(?:www\.)?fda\.gov[^"]+|\/(?:safety\/recalls-market-withdrawals-safety-alerts|food\/outbreaks-foodborne-illness)\/[^"]+)"[^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    let href = m[1];
    if (href.startsWith('/')) href = `https://www.fda.gov${href}`;
    href = href.split('?')[0].split('#')[0];
    if (href !== parseResult.canonicalUrl && isPeerAnnouncementUrl(href)) {
      related.add(href);
    }
  }
  return [...related];
}

module.exports = {
  canonicalKeyForPage,
  canonicalKeyForCore,
  correlateDocument,
  findRelatedOfficialUrls,
};
