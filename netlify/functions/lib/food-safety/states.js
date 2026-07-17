/**
 * U.S. state and territory dictionary + safe state extraction.
 *
 * Extraction is deliberately conservative: postal abbreviations are only
 * accepted inside list-like contexts (comma/"and" separated groups) and
 * ambiguous words like "Washington" (state vs. D.C. vs. federal agency
 * phrasing) require contextual validation.
 */

const STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
  ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'],
  ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'],
  ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
  ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'],
  ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'],
  ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
  ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'],
  ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
];

const TERRITORIES = [
  ['DC', 'District of Columbia'],
  ['PR', 'Puerto Rico'],
  ['GU', 'Guam'],
  ['VI', 'U.S. Virgin Islands'],
  ['AS', 'American Samoa'],
  ['MP', 'Northern Mariana Islands'],
];

const ALL = [...STATES, ...TERRITORIES];

const ABBR_TO_NAME = new Map(ALL.map(([abbr, name]) => [abbr, name]));
const NAME_TO_ABBR = new Map(ALL.map(([abbr, name]) => [name.toLowerCase(), abbr]));
// Common aliases
NAME_TO_ABBR.set('washington, d.c.', 'DC');
NAME_TO_ABBR.set('washington d.c.', 'DC');
NAME_TO_ABBR.set('washington dc', 'DC');
NAME_TO_ABBR.set('d.c.', 'DC');
NAME_TO_ABBR.set('virgin islands', 'VI');
NAME_TO_ABBR.set('us virgin islands', 'VI');

const VALID_ABBRS = new Set(ABBR_TO_NAME.keys());

function isValidStateAbbr(abbr) {
  return VALID_ABBRS.has(String(abbr || '').toUpperCase());
}

function stateNameFromAbbr(abbr) {
  return ABBR_TO_NAME.get(String(abbr || '').toUpperCase()) || null;
}

function abbrFromStateName(name) {
  if (!name) return null;
  const clean = String(name).trim().toLowerCase().replace(/\.$/, '');
  return NAME_TO_ABBR.get(clean) || null;
}

/**
 * Normalize a single state token (abbr or full name) to a postal abbreviation.
 * Returns null when the token is not a safe state reference.
 */
function normalizeStateToken(token) {
  if (!token) return null;
  const t = String(token).trim().replace(/[.\u00a0]+$/, '').trim();
  if (!t) return null;
  if (/^[A-Za-z]{2}$/.test(t) && VALID_ABBRS.has(t.toUpperCase())) {
    // Only accept two-letter tokens that are ALREADY uppercase in source;
    // lowercase "in"/"or"/"me"/"hi" are English words.
    if (t !== t.toUpperCase()) return null;
    return t.toUpperCase();
  }
  return abbrFromStateName(t);
}

/**
 * Extract a state list from list-like prose such as:
 *   "AZ, CA, CO, HI, NJ, NV, OR, TX, WA"
 *   "Indiana, Kentucky, Michigan, Ohio, and West Virginia"
 * Returns { states: [abbr...], confident: boolean }.
 *
 * Refuses to guess when the text is not list-like ("distributed to
 * retailers in the Pacific Northwest and online").
 */
function extractStateList(text) {
  if (!text || typeof text !== 'string') return { states: [], confident: false };
  const cleaned = text
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(?:and|&)\b/gi, ',')
    .replace(/[–—;]/g, ',');

  const tokens = cleaned.split(',').map((s) => s.trim()).filter(Boolean);
  if (tokens.length === 0) return { states: [], confident: false };

  const states = [];
  let unknown = 0;
  for (const token of tokens) {
    const abbr = normalizeStateToken(token);
    if (abbr) {
      if (!states.includes(abbr)) states.push(abbr);
    } else {
      unknown += 1;
    }
  }

  // Confident only when the text is genuinely list-like: most tokens are
  // states and at least one state was found.
  const confident = states.length > 0 && unknown <= Math.max(1, Math.floor(tokens.length * 0.25));
  return { states: confident ? states : states, confident };
}

/**
 * Detect explicit nationwide distribution wording.
 */
function isExplicitNationwide(text) {
  if (!text) return false;
  return /\b(nationwide|nationally|throughout the (united states|u\.?s\.?a?\.?)|all (50 )?states)\b/i.test(text);
}

module.exports = {
  STATES,
  TERRITORIES,
  ALL_STATES: ALL,
  isValidStateAbbr,
  stateNameFromAbbr,
  abbrFromStateName,
  normalizeStateToken,
  extractStateList,
  isExplicitNationwide,
};
