/**
 * Central feature flags and configuration for the FDA food-safety subsystem.
 * Every flag defaults to OFF so the site behaves identically until the
 * operator explicitly enables features (see docs/fda-food-safety-runbook.md).
 */

function flag(name, fallback = false) {
  const v = process.env[name];
  if (v === undefined || v === null || v === '') return fallback;
  return v === 'true' || v === '1';
}

function intEnv(name, fallback) {
  const v = parseInt(process.env[name] || '', 10);
  return Number.isFinite(v) ? v : fallback;
}

function floatEnv(name, fallback) {
  const v = parseFloat(process.env[name] || '');
  return Number.isFinite(v) ? v : fallback;
}

const config = {
  get enabled() { return flag('ENABLE_FDA'); },
  get autoPublish() { return flag('FDA_AUTO_PUBLISH'); },
  get aiExtractionEnabled() { return flag('FDA_AI_EXTRACTION_ENABLED'); },
  get pushNotificationsEnabled() { return flag('FDA_PUSH_NOTIFICATIONS_ENABLED'); },
  get emailTriggerEnabled() { return flag('FDA_EMAIL_TRIGGER_ENABLED'); },
  get heroEligible() { return flag('FDA_HERO_ELIGIBLE'); },
  get dryRun() { return flag('DRY_RUN'); },

  get openFdaApiKey() { return process.env.OPENFDA_API_KEY || null; },
  get internalToken() { return process.env.FOOD_SAFETY_INTERNAL_TOKEN || null; },

  get emailRecipient() { return process.env.FDA_EMAIL_RECIPIENT || 'fda-alerts@noteworthynews.co'; },
  get emailAllowedSenders() {
    return (process.env.FDA_EMAIL_ALLOWED_SENDERS || '')
      .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  },
  get emailAllowedDomains() {
    const raw = process.env.FDA_EMAIL_ALLOWED_DOMAINS
      || 'fda.gov,fda.hhs.gov,public.govdelivery.com,govdelivery.com,subscriptions.fda.gov';
    return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  },
  get emailWebhookSecret() { return process.env.FDA_EMAIL_WEBHOOK_SECRET || null; },

  // Processing limits
  get maxDocsPerRun() { return intEnv('FDA_MAX_DOCS_PER_RUN', 8); },
  get maxBackfillItems() { return intEnv('FDA_MAX_BACKFILL_ITEMS', 100); },
  get confidenceThreshold() { return floatEnv('FDA_CONFIDENCE_THRESHOLD', 0.75); },
  get maxAttempts() { return intEnv('FDA_MAX_ATTEMPTS', 5); },
  get lockTtlMs() { return intEnv('FDA_LOCK_TTL_MS', 10 * 60 * 1000); },

  // Cadences (minutes)
  get recallTableIntervalMin() { return intEnv('FDA_RECALL_TABLE_INTERVAL_MIN', 30); },
  get coreTableIntervalMin() { return intEnv('FDA_CORE_TABLE_INTERVAL_MIN', 60); },

  // Alerting
  get adminAlertEmail() {
    return process.env.FDA_ADMIN_ALERT_EMAIL || process.env.ALERT_TO_EMAIL || null;
  },
};

const USER_AGENT = 'NoteworthyNewsFoodSafetyBot/1.0 (+https://noteworthynews.co/contact.html)';

// Hosts we are allowed to fetch canonical facts and images from.
const ALLOWED_HOSTS = new Set([
  'www.fda.gov',
  'fda.gov',
  'api.fda.gov',
]);

const FEEDS = [
  {
    kind: 'fda_rss_recall',
    url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/food-safety-recalls/rss.xml',
    filtered: false,
  },
  {
    kind: 'fda_rss_outbreak',
    url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/fda-outbreaks/rss.xml',
    filtered: false,
  },
  {
    kind: 'fda_rss_general',
    url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/recalls/rss.xml',
    filtered: true, // safety net; strict scope filter applies
  },
  {
    kind: 'fda_rss_allergy',
    url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/food-allergies/rss.xml',
    filtered: true, // safety net; strict scope filter applies
  },
];

const RECALL_TABLE_URL = 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts';
const CORE_TABLE_URL = 'https://www.fda.gov/food/outbreaks-foodborne-illness/investigations-foodborne-illness-outbreaks';
const OPENFDA_ENFORCEMENT_URL = 'https://api.fda.gov/food/enforcement.json';

module.exports = {
  config,
  USER_AGENT,
  ALLOWED_HOSTS,
  FEEDS,
  RECALL_TABLE_URL,
  CORE_TABLE_URL,
  OPENFDA_ENFORCEMENT_URL,
};
