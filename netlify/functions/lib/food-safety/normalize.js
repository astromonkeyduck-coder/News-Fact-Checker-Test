/**
 * Deterministic normalization helpers: HTML → text, dates, numeric truth
 * rules, and material hashing.
 *
 * Numeric truth rules:
 * - Absent numbers stay null. Never coerce absent to zero.
 * - "No illnesses have been reported" → 0 (explicit official zero).
 * - "at least 12" keeps the qualifier in evidence and stores 12 as the floor.
 */

const crypto = require('crypto');

// ---------------------------------------------------------------------------
// HTML helpers (regex-based; we never render this HTML, we only extract text)
// ---------------------------------------------------------------------------

function decodeEntities(str) {
  if (!str) return str;
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&rsquo;|&#8217;/g, '\u2019')
    .replace(/&lsquo;|&#8216;/g, '\u2018')
    .replace(/&rdquo;|&#8221;/g, '\u201d')
    .replace(/&ldquo;|&#8220;/g, '\u201c')
    .replace(/&ndash;|&#8211;/g, '\u2013')
    .replace(/&mdash;|&#8212;/g, '\u2014')
    .replace(/&#(\d+);/g, (_, code) => {
      const n = parseInt(code, 10);
      return n > 31 && n < 65536 ? String.fromCharCode(n) : ' ';
    });
}

function stripTags(html) {
  if (!html) return '';
  return decodeEntities(
    String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h[1-6]|dt|dd)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n+ */g, '\n')
    .trim();
}

/** Escape text for safe inclusion in generated HTML. */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** Parse a date-ish string into ISO date (YYYY-MM-DD) or null. */
function parseDateOnly(str) {
  if (!str) return null;
  const s = String(str).trim();
  // MM/DD/YYYY
  let m = s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (m) {
    const [, mo, d, y] = m;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  // Month DD, YYYY
  m = s.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\.?\s+(\d{1,2}),?\s+(\d{4})\b/i);
  if (m) {
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
      'august', 'september', 'october', 'november', 'december'];
    const mo = months.indexOf(m[1].toLowerCase()) + 1;
    return `${m[3]}-${String(mo).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
  }
  // ISO
  m = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return m[0];
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

/** Parse a timestamp string into ISO timestamptz or null. */
function parseTimestamp(str) {
  if (!str) return null;
  const d = new Date(String(str).trim());
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  // Drupal-style "Wed, 07/15/2026 - 20:08"
  const m = String(str).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*-\s*(\d{1,2}):(\d{2})/);
  if (m) {
    const [, mo, day, y, h, min] = m;
    const dt = new Date(Date.UTC(+y, +mo - 1, +day, +h, +min));
    if (!Number.isNaN(dt.getTime())) return dt.toISOString();
  }
  const dateOnly = parseDateOnly(str);
  return dateOnly ? `${dateOnly}T00:00:00.000Z` : null;
}

// ---------------------------------------------------------------------------
// Numeric truth
// ---------------------------------------------------------------------------

const NUMBER_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

function parseCountToken(token) {
  if (token === undefined || token === null) return null;
  const t = String(token).replace(/,/g, '').trim().toLowerCase();
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  if (t in NUMBER_WORDS) return NUMBER_WORDS[t];
  return null;
}

/**
 * Extract outcome metrics from official prose.
 * Returns { illnesses, hospitalizations, deaths, husCases, qualifiers,
 * evidence } where each metric is number|null. Null means "not reported".
 */
function extractOutcomeMetrics(text) {
  const out = {
    illnesses: null,
    hospitalizations: null,
    deaths: null,
    husCases: null,
    qualifiers: {},
    evidence: {},
  };
  if (!text) return out;
  const t = String(text).replace(/\s+/g, ' ');

  // Explicit zero illnesses
  const zeroIll = t.match(/\bno (?:illnesses?|adverse (?:events?|reactions?)|cases)\b[^.]{0,80}?\breported\b[^.]{0,40}\./i)
    || t.match(/\bno (?:illnesses?|adverse (?:events?|reactions?))\s+(?:have been|were|has been)\s+reported\b[^.]*\./i);
  if (zeroIll) {
    out.illnesses = 0;
    out.evidence.illnesses = zeroIll[0].trim().slice(0, 240);
  }

  // Illness totals: "a total of 1,644 people infected with X ... have been reported"
  const totalIll = t.match(/\btotal of ([\d,]+) (?:people|persons|individuals|cases)[^.]{0,160}?\breported\b[^.]*\./i)
    || t.match(/\b([\d,]+|at least [\d,]+) (?:people|persons|individuals)[^.]{0,60}?\b(?:infected|sickened|ill(?:nesses)?)\b[^.]{0,120}\./i)
    || t.match(/\b([\d,]+) (?:illnesses|cases)\s+(?:have been|were|has been)\s+(?:reported|identified|confirmed)\b[^.]*\./i);
  if (totalIll && out.illnesses === null) {
    const raw = totalIll[1];
    const atLeast = /at least/i.test(raw) || /at least/i.test(totalIll[0]);
    const n = parseCountToken(raw.replace(/at least/i, ''));
    if (n !== null) {
      out.illnesses = n;
      if (atLeast) out.qualifiers.illnesses = 'at_least';
      out.evidence.illnesses = totalIll[0].trim().slice(0, 240);
    }
  }

  // Hospitalizations
  const zeroHosp = t.match(/\bno hospitalizations?\b[^.]{0,60}\breported\b[^.]*\./i);
  if (zeroHosp) {
    out.hospitalizations = 0;
    out.evidence.hospitalizations = zeroHosp[0].trim().slice(0, 240);
  } else {
    const hosp = t.match(/\b(?:there (?:have|has) been |including )?([\d,]+|at least [\d,]+|\w+) hospitalizations?\b[^.]*/i)
      || t.match(/\b([\d,]+) (?:people|persons|individuals)[^.]{0,40}?\bhospitalized\b[^.]*/i);
    if (hosp) {
      const raw = hosp[1];
      const atLeast = /at least/i.test(hosp[0]);
      const n = parseCountToken(String(raw).replace(/at least/i, ''));
      if (n !== null) {
        out.hospitalizations = n;
        if (atLeast) out.qualifiers.hospitalizations = 'at_least';
        out.evidence.hospitalizations = hosp[0].trim().slice(0, 240);
      }
    }
  }

  // Deaths
  const zeroDeath = t.match(/\bno deaths?\b[^.]{0,80}\breported\b[^.]*\./i)
    || t.match(/\bno deaths? (?:have|has) been (?:reported|attributed)\b[^.]*\./i);
  if (zeroDeath) {
    out.deaths = 0;
    out.evidence.deaths = zeroDeath[0].trim().slice(0, 240);
  } else {
    const death = t.match(/\b([\d,]+|\w+) deaths?\s+(?:have been|has been|were|was)\s+(?:reported|confirmed|attributed)\b[^.]*/i)
      || t.match(/\bincluding ([\d,]+|\w+) deaths?\b[^.]*/i);
    if (death) {
      const n = parseCountToken(death[1]);
      if (n !== null && !/no/i.test(death[1])) {
        out.deaths = n;
        out.evidence.deaths = death[0].trim().slice(0, 240);
      }
    }
  }

  // HUS
  const hus = t.match(/\b([\d,]+|\w+) (?:cases? of )?(?:hemolytic uremic syndrome|HUS)\b[^.]*/i);
  if (hus) {
    const n = parseCountToken(hus[1]);
    if (n !== null) {
      out.husCases = n;
      out.evidence.husCases = hus[0].trim().slice(0, 240);
    }
  }

  // Last illness onset: "Illnesses started on dates ranging from X to Y"
  const onset = t.match(/illness(?:es)? (?:started|onset)[^.]{0,120}?\bto ((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/i);
  if (onset) {
    out.lastIllnessOnset = parseDateOnly(onset[1]);
    out.evidence.lastIllnessOnset = onset[0].trim().slice(0, 240);
  }

  return out;
}

// ---------------------------------------------------------------------------
// UPC / lot extraction
// ---------------------------------------------------------------------------

function extractUpcs(text) {
  if (!text) return [];
  const upcs = new Set();
  const re = /\bUPC[:#]?\s*(?:code\s*)?([0-9][0-9 -]{6,18}[0-9])\b/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const digits = m[1].replace(/[ -]/g, '');
    if (digits.length >= 8 && digits.length <= 14) upcs.add(digits);
  }
  return [...upcs];
}

// ---------------------------------------------------------------------------
// Material hash
// ---------------------------------------------------------------------------

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Hash of the material consumer-facing facts of an event. Excludes fetch
 * timestamps, navigation markup, tracking params, and CDN query strings so
 * cosmetic upstream changes do not create new public versions.
 */
function materialHash(event, products = []) {
  const stable = {
    event_kind: event.event_kind,
    title: event.title || null,
    company: event.company || null,
    brands: sortedOrNull(event.brands),
    product_name: event.product_name || null,
    product_description: event.product_description || null,
    hazard_category: event.hazard_category || null,
    hazard_name: event.hazard_name || null,
    organism: event.organism || null,
    serotype: event.serotype || null,
    allergens: sortedOrNull(event.allergens),
    status: event.status || null,
    fda_recall_classification: event.fda_recall_classification || null,
    illnesses: nullableNumber(event.illnesses),
    hospitalizations: nullableNumber(event.hospitalizations),
    deaths: nullableNumber(event.deaths),
    hus_cases: nullableNumber(event.hus_cases),
    geographic_scope: event.geographic_scope || null,
    case_states: sortedOrNull(event.case_states),
    distribution_states: sortedOrNull(event.distribution_states),
    case_counts_by_state: event.case_counts_by_state || null,
    distribution_text: normalizeWhitespace(event.distribution_text),
    retailers: sortedOrNull(event.retailers),
    public_action: event.public_action || null,
    recommendations: event.recommendations || null,
    last_illness_onset: event.last_illness_onset || null,
    company_announcement_date: event.company_announcement_date || null,
    products: products
      .map((p) => ({
        brand: p.brand || null,
        product_name: p.product_name || null,
        variety: p.variety || null,
        package_size: p.package_size || null,
        upc: p.upc || null,
        lot_code: p.lot_code || null,
        additional_codes: sortedOrNull(p.additional_codes),
        best_by_date: p.best_by_date || null,
        use_by_date: p.use_by_date || null,
        expiration_date: p.expiration_date || null,
      }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
  return sha256(JSON.stringify(stable));
}

function sortedOrNull(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return [...arr].sort();
}

function nullableNumber(n) {
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function normalizeWhitespace(s) {
  if (!s) return null;
  return String(s).replace(/\s+/g, ' ').trim() || null;
}

/**
 * Normalize a source body for hashing: drop scripts, styles, nav, footer,
 * form tokens, cache-busting params.
 */
function normalizedBodyHash(html) {
  if (!html) return null;
  const cleaned = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/\?itok=[A-Za-z0-9_-]+/g, '')
    .replace(/randparam=\d+/g, '')
    .replace(/js-view-dom-id-[a-f0-9]+/g, '')
    .replace(/\s+/g, ' ');
  return sha256(cleaned);
}

module.exports = {
  decodeEntities,
  stripTags,
  escapeHtml,
  parseDateOnly,
  parseTimestamp,
  parseCountToken,
  extractOutcomeMetrics,
  extractUpcs,
  sha256,
  materialHash,
  normalizedBodyHash,
  normalizeWhitespace,
};
