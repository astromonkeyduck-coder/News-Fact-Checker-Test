/**
 * Sample data for the Noteworthy email preview bench.
 *
 * Fictional but plausible — written to exercise every module: a major
 * earthquake hero, a developing ceasefire story, a severe weather watch,
 * a source trail, and a non-empty correction log. Nothing here ships to
 * subscribers; real sends receive live props from the send pipeline.
 */

const PREVIEW_UNSUB = 'https://noteworthynews.co/unsubscribe.html?email=cHJldmlld0Bub3Rld29ydGh5';
const PREVIEW_PREFS = 'https://noteworthynews.co/newsletter-preferences.html?email=cHJldmlld0Bub3Rld29ydGh5';

const sampleVerify = {
  confirmUrl: 'https://noteworthynews.co/.netlify/functions/newsletter-confirm?token=SAMPLE_TOKEN',
  expiresHours: 48,
  requestedFrom: 'the homepage',
  unsubscribeUrl: PREVIEW_UNSUB,
  preferencesUrl: PREVIEW_PREFS,
};

const sampleWelcome = {
  greetingName: 'Reader',
  unsubscribeUrl: PREVIEW_UNSUB,
  preferencesUrl: PREVIEW_PREFS,
};

const sampleBreakingWelcome = {
  greetingName: 'Reader',
  story: {
    headline: 'M7.1 earthquake off the Sanriku coast; tsunami advisory in effect',
    statusKind: 'developing',
    url: 'https://noteworthynews.co/story/sanriku-earthquake',
    lastUpdate: '21:47 UTC',
  },
  unsubscribeUrl: PREVIEW_UNSUB,
  preferencesUrl: PREVIEW_PREFS,
};

const sampleWeeklyBrief = {
  issueNumber: 14,
  dateline: 'Sunday, July 5, 2026',
  weekOf: 'June 29 – July 5, 2026',

  hero: {
    severity: 'critical',
    statusKind: 'confirmed',
    kickerLabel: 'Top story · Earthquake',
    headline: 'M7.1 earthquake off the Sanriku coast: advisory lifted, damage limited',
    dek: 'A magnitude 7.1 earthquake struck 62 km east of Ishinomaki on Thursday night. The tsunami advisory was lifted after four hours. Two injuries confirmed; no structural collapses reported.',
    source: { name: 'USGS · JMA', url: 'https://earthquake.usgs.gov' },
    updatedAt: 'FRI 02:13 UTC',
    cta: { label: 'Read the full story', url: 'https://noteworthynews.co/story/sanriku-earthquake' },
  },

  atAGlance: [
    { severity: 'critical', text: 'M7.1 quake off Japan — advisory lifted, two injuries confirmed', time: 'THU' },
    { severity: 'monitor', text: 'Ceasefire talks enter a third day; draft terms still unsigned', time: 'SAT' },
    { severity: 'elevated', text: 'Derecho watch for the Upper Midwest into Monday evening', time: 'SUN' },
    { severity: 'stable', text: 'Cabo Verde ferry grounding: all 41 passengers accounted for', time: 'TUE' },
  ],

  whatChanged: [
    { time: 'THU 21:28', text: 'First shaking reports from Sendai; we opened a live story and held the magnitude until USGS posted.', status: 'developing' },
    { time: 'THU 21:33', text: 'USGS initial estimate M6.9. JMA issued a tsunami advisory for Miyagi and Iwate.', status: 'developing' },
    { time: 'THU 22:05', text: 'USGS revised the magnitude to 7.1 after review. We updated the headline and noted the revision inline.', status: 'corrected' },
    { time: 'FRI 01:58', text: 'JMA lifted the advisory. Utility crews confirmed grid stable across both prefectures.', status: 'confirmed' },
  ],

  sourceTrail: {
    claim: '“Draft ceasefire terms include a 72-hour humanitarian corridor.”',
    context: 'Reported Saturday by two agencies, attributed to officials in the mediating delegation. Neither party has published the draft. We carry it as reported, not confirmed.',
    sources: [
      { name: 'Reuters', role: 'First report, two unnamed officials', url: 'https://www.reuters.com' },
      { name: 'AP', role: 'Independent match within the hour', url: 'https://apnews.com' },
      { name: 'Mediating ministry', role: 'Declined to confirm terms on record', url: null },
    ],
  },

  developingNow: [
    { headline: 'Ceasefire talks: delegations reconvene Monday under the same mediators', lastUpdate: 'SAT 18:40 UTC', url: 'https://noteworthynews.co/story/ceasefire-talks' },
    { headline: 'Sanriku aftershocks: JMA advises elevated probability through the weekend', lastUpdate: 'SUN 09:12 UTC', url: 'https://noteworthynews.co/story/sanriku-earthquake' },
  ],

  confirmed: [
    { text: 'M7.1 magnitude, revised from the initial M6.9 estimate', source: 'USGS' },
    { text: 'Tsunami advisory lifted at 01:58 UTC Friday', source: 'JMA' },
    { text: 'Talks to resume Monday; both delegations remain in the capital', source: 'Joint statement' },
  ],

  notConfirmed: [
    { text: 'The 72-hour humanitarian corridor in the ceasefire draft', note: 'Two agencies, unnamed officials — no document published' },
    { text: 'Social video claiming port cranes collapsed in Ishinomaki', note: 'Geolocation does not match; footage predates the quake' },
  ],

  watchNext: [
    { when: 'MON', text: 'Ceasefire delegations reconvene; mediators say a draft could be initialed within 48 hours.' },
    { when: 'MON PM', text: 'Derecho window closes for the Upper Midwest — NWS updates at 18:00 UTC.' },
    { when: 'FRI', text: 'JMA aftershock advisory for the Sanriku coast expires unless renewed.' },
  ],

  corrections: [
    {
      date: 'THU 22:05 UTC',
      was: 'Initial alert stated M6.9 per the first USGS estimate.',
      now: 'USGS revised to M7.1 after review; headline and alert updated.',
      note: 'The original figure remains visible in the story timeline.',
    },
  ],

  followCta: { label: 'Follow live stories', url: 'https://noteworthynews.co/#live' },

  unsubscribeUrl: PREVIEW_UNSUB,
  preferencesUrl: PREVIEW_PREFS,
};

/** An empty-corrections variant to prove the log renders honestly when clean. */
const sampleWeeklyBriefNoCorrections = {
  ...sampleWeeklyBrief,
  corrections: [],
};

module.exports = {
  sampleVerify,
  sampleWelcome,
  sampleBreakingWelcome,
  sampleWeeklyBrief,
  sampleWeeklyBriefNoCorrections,
};
