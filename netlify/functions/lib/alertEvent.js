/**
 * Unified Alert Event Model
 *
 * Every alert-worthy event in the system - earthquake, weather, airspace,
 * maritime, volcanic, embassy, or manual breaking news - is normalized
 * into this shape before storage or notification.
 *
 * Engines produce raw data.  This module turns it into a consistent
 * contract that the notification layer, Situation Monitor, feed, and
 * any future consumer can rely on.
 */

// Severity 1-5 maps to a human-readable priority label.
const PRIORITY_MAP = {
  5: 'critical',
  4: 'high',
  3: 'normal',
  2: 'background',
  1: 'background',
};

const VALID_SOURCES = new Set([
  'usgs', 'nws', 'faa', 'uscg', 'volcano', 'embassy', 'admin',
]);

const VALID_TYPES = new Set([
  'earthquake', 'weather', 'airspace', 'maritime', 'volcanic',
  'embassy', 'breaking-news',
]);

/**
 * Create a normalized AlertEvent from raw engine output.
 *
 * @param {Object} raw - Engine-specific event data.
 * @param {string} raw.id - Canonical event ID (e.g. "usgs-us7000abcd").
 * @param {string} raw.source - Engine name.
 * @param {string} raw.type - Event type.
 * @param {number} raw.severity - 1-5 severity scale.
 * @param {string} raw.title
 * @param {string} [raw.summary]
 * @param {Object} [raw.location]
 * @param {string} [raw.publishedAt]
 * @param {string} [raw.sourceUrl]
 * @param {Object} [raw.assets] - Type-specific enrichment data.
 * @returns {Object} Normalized AlertEvent.
 */
function createAlertEvent(raw) {
  if (!raw || !raw.id) {
    throw new Error('AlertEvent requires an id');
  }

  const severity = clampSeverity(raw.severity);
  const priority = PRIORITY_MAP[severity] || 'background';

  return {
    id: String(raw.id),
    source: VALID_SOURCES.has(raw.source) ? raw.source : 'admin',
    type: VALID_TYPES.has(raw.type) ? raw.type : 'breaking-news',
    severity,
    priority,
    title: String(raw.title || 'Untitled Event'),
    summary: raw.summary ? String(raw.summary) : '',
    location: normalizeLocation(raw.location),
    publishedAt: raw.publishedAt || new Date().toISOString(),
    sourceUrl: raw.sourceUrl || null,
    assets: raw.assets && typeof raw.assets === 'object' ? { ...raw.assets } : {},
    alertState: {
      emailSent: false,
      pushSent: false,
      imagePending: false,
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Convert a Supabase verified_event row into an AlertEvent.
 */
function fromVerifiedEvent(row) {
  if (!row) return null;

  const sourceMap = {
    earthquake: 'usgs',
    weather_alert: 'nws',
    faa_notam: 'faa',
    uscg_alert: 'uscg',
    volcanic_activity: 'volcano',
    embassy_alert: 'embassy',
  };

  const typeMap = {
    earthquake: 'earthquake',
    weather_alert: 'weather',
    faa_notam: 'airspace',
    uscg_alert: 'maritime',
    volcanic_activity: 'volcanic',
    embassy_alert: 'embassy',
  };

  return createAlertEvent({
    id: row.canonical_id,
    source: sourceMap[row.event_type] || 'admin',
    type: typeMap[row.event_type] || 'breaking-news',
    severity: row.severity || 1,
    title: row.title || row.summary || '',
    summary: row.summary || '',
    location: {
      display: row.location_display || '',
      lat: row.latitude,
      lon: row.longitude,
    },
    publishedAt: row.published_at || row.created_at,
    sourceUrl: row.source_url,
    assets: row.assets || {},
  });
}

/**
 * Determine which notification channels this event should use.
 *
 * @param {Object} alertEvent - Normalized AlertEvent.
 * @returns {{ email: boolean, push: boolean, locationEmail: boolean }}
 */
function getNotificationChannels(alertEvent) {
  const { type, severity, assets } = alertEvent;

  const channels = {
    email: false,
    push: false,
    locationEmail: false,
  };

  switch (type) {
    case 'earthquake': {
      const mag = assets?.magnitude || 0;
      // Push for all significant earthquakes (M >= 4.5)
      channels.push = mag >= 4.5;
      // Global email for M >= 6.0 (per-user threshold checked at delivery time)
      channels.email = mag >= 6.0;
      // Location-based email for M >= 4.5
      channels.locationEmail = mag >= 4.5;
      break;
    }
    case 'weather':
      channels.push = severity >= 4;
      channels.locationEmail = severity >= 3;
      break;
    case 'breaking-news':
      channels.push = true;
      channels.email = severity >= 4;
      break;
    default:
      // FAA, USCG, Volcano, Embassy - internal email only for high severity
      channels.email = severity >= 3;
      break;
  }

  return channels;
}

/**
 * Check whether an event should trigger any notifications at all.
 */
function shouldNotify(alertEvent) {
  const channels = getNotificationChannels(alertEvent);
  return channels.email || channels.push || channels.locationEmail;
}

/**
 * Determine the push notification type string for the service worker.
 */
function getPushType(alertEvent) {
  const typeMap = {
    earthquake: 'earthquake',
    weather: 'weather',
    'breaking-news': 'breaking-news',
  };
  return typeMap[alertEvent.type] || 'breaking-news';
}

/* ── Internal helpers ───────────────────────────────── */

function clampSeverity(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(5, Math.round(n)));
}

function normalizeLocation(loc) {
  if (!loc || typeof loc !== 'object') {
    return { display: '', lat: null, lon: null };
  }
  return {
    display: loc.display || loc.location_display || '',
    lat: typeof loc.lat === 'number' ? loc.lat : (typeof loc.latitude === 'number' ? loc.latitude : null),
    lon: typeof loc.lon === 'number' ? loc.lon : (typeof loc.longitude === 'number' ? loc.longitude : null),
  };
}

module.exports = {
  createAlertEvent,
  fromVerifiedEvent,
  getNotificationChannels,
  shouldNotify,
  getPushType,
  VALID_SOURCES,
  VALID_TYPES,
  PRIORITY_MAP,
};
