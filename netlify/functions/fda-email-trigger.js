/**
 * Dedicated FDA / GovDelivery inbound-email trigger (latency backstop only).
 *
 * Security model (fail-closed, unlike the legacy generic inbound-email.js):
 *  - Feature-gated by FDA_EMAIL_TRIGGER_ENABLED (default off)
 *  - Svix-compatible webhook verification (svix-id.svix-timestamp.body signed
 *    with the whsec_ base64 secret; base64 signatures; 5-minute timestamp
 *    tolerance). Missing/invalid signature → 401. Missing secret while the
 *    feature is enabled → 500 configuration error.
 *  - Replay protection: duplicate svix-id / Message-ID acknowledged without
 *    reprocessing.
 *  - Recipient alias validation (FDA_EMAIL_RECIPIENT).
 *  - Sender/domain allowlist (FDA_EMAIL_ALLOWED_SENDERS / _DOMAINS);
 *    unexpected senders are quarantined (logged + 200, never processed).
 *  - Only official https://www.fda.gov URLs are extracted; the email body is
 *    NEVER published and attachments are NEVER used as product images.
 *  - No auto-replies to FDA/GovDelivery systems, ever.
 */

if (process.env.NETLIFY_DEV) {
  try {
    require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  } catch (e) { /* optional in dev */ }
}

const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');
const { config } = require('./lib/food-safety/config');
const { canonicalizeFdaUrl } = require('./lib/food-safety/providers/fda/rss');

const TIMESTAMP_TOLERANCE_SEC = 5 * 60;
const DEDUP_STORE = 'alert-dedup';
const DEDUP_TTL_SEC = 7 * 24 * 3600;

// ---------------------------------------------------------------------------
// Svix verification (official scheme: base64 whsec_ secret, id.timestamp.body)
// ---------------------------------------------------------------------------

function verifySvixSignature({ secret, svixId, svixTimestamp, svixSignature, body }) {
  if (!secret || !svixId || !svixTimestamp || !svixSignature || body === undefined) return false;

  const ts = parseInt(svixTimestamp, 10);
  if (!Number.isFinite(ts)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > TIMESTAMP_TOLERANCE_SEC) return false; // replay window

  let secretBytes;
  try {
    const raw = secret.startsWith('whsec_') ? secret.slice(6) : secret;
    secretBytes = Buffer.from(raw, 'base64');
  } catch (_) {
    return false;
  }
  if (!secretBytes || secretBytes.length === 0) return false;

  const signedContent = `${svixId}.${svixTimestamp}.${body}`;
  const expected = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64');

  // Header may contain multiple space-delimited signatures: "v1,<sig> v1,<sig>"
  const candidates = String(svixSignature).split(/\s+/);
  for (const candidate of candidates) {
    const sig = candidate.includes(',') ? candidate.split(',')[1] : candidate;
    if (!sig) continue;
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}

function header(event, name) {
  const headers = event.headers || {};
  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || null;
}

// ---------------------------------------------------------------------------
// Dedup (svix-id + Message-ID)
// ---------------------------------------------------------------------------

function getDedupStore() {
  try {
    const siteID = process.env.NETLIFY_SITE_ID;
    const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN;
    if (siteID && token) return getStore({ name: DEDUP_STORE, siteID, token });
    return getStore({ name: DEDUP_STORE });
  } catch (_) {
    return null;
  }
}

async function isDuplicate(keys) {
  const store = getDedupStore();
  if (!store) return false; // no store: proceed (source-doc identity still dedupes)
  for (const key of keys) {
    if (!key) continue;
    try {
      const existing = await store.get(`fda-email-${hashKey(key)}`);
      if (existing) return true;
    } catch (_) { /* treat as not duplicate */ }
  }
  return false;
}

async function recordSeen(keys) {
  const store = getDedupStore();
  if (!store) return;
  for (const key of keys) {
    if (!key) continue;
    try {
      await store.set(`fda-email-${hashKey(key)}`, new Date().toISOString(), {
        metadata: { ttl: DEDUP_TTL_SEC },
      });
    } catch (_) { /* best effort */ }
  }
}

function hashKey(key) {
  return crypto.createHash('sha256').update(String(key)).digest('hex').slice(0, 32);
}

// ---------------------------------------------------------------------------
// Payload helpers
// ---------------------------------------------------------------------------

function extractEmailFields(payload) {
  const data = payload && payload.data ? payload.data : payload || {};
  const from = String(data.from || data.sender || (Array.isArray(data.from) ? data.from[0] : '') || '').toLowerCase();
  const toRaw = data.to || data.recipient || [];
  const to = (Array.isArray(toRaw) ? toRaw : [toRaw]).map((t) => String(t || '').toLowerCase());
  const subject = String(data.subject || '');
  const text = String(data.text || data['body-plain'] || '');
  const html = String(data.html || data['body-html'] || '');
  const messageId = String(
    (data.headers && (data.headers['message-id'] || data.headers['Message-Id']))
    || data.message_id || data.messageId || '',
  );
  return { from, to, subject, text, html, messageId };
}

function extractSenderAddress(from) {
  const m = String(from).match(/<([^>]+)>/);
  return (m ? m[1] : from).trim().toLowerCase();
}

function senderAllowed(fromAddress) {
  const allowedSenders = config.emailAllowedSenders;
  const allowedDomains = config.emailAllowedDomains;
  if (allowedSenders.includes(fromAddress)) return true;
  const domain = fromAddress.split('@')[1] || '';
  return allowedDomains.some((d) => domain === d || domain.endsWith(`.${d}`));
}

/** Extract only official FDA URLs from the email content. */
function extractFdaUrls(text, html) {
  const urls = new Set();
  const combined = `${text}\n${html}`;
  const re = /https?:\/\/(?:www\.)?fda\.gov\/[^\s"'<>)\]]+/gi;
  let m;
  while ((m = re.exec(combined)) !== null) {
    const canonical = canonicalizeFdaUrl(m[0]);
    if (canonical
        && /\/(safety\/recalls-market-withdrawals-safety-alerts|food\/outbreaks-foodborne-illness)\/[a-z0-9-]{10,}/i.test(canonical)) {
      urls.add(canonical);
    }
  }
  return [...urls].slice(0, 10);
}

async function triggerProcessor() {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL;
  const token = config.internalToken;
  if (!base || !token) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${base}/.netlify/functions/process-food-safety-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-token': token },
      body: JSON.stringify({ reason: 'fda-email-trigger' }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.status === 202 || res.ok;
  } catch (_) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

exports.handler = async (event) => {
  const respond = (statusCode, body) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'method not allowed' });
  }

  if (!config.emailTriggerEnabled) {
    // Feature off: acknowledge so the provider does not retry, do nothing.
    return respond(200, { status: 'disabled' });
  }

  // --- signature verification (fail-closed) --------------------------------
  const secret = config.emailWebhookSecret;
  if (!secret) {
    console.error('[fda-email-trigger] FDA_EMAIL_TRIGGER_ENABLED but FDA_EMAIL_WEBHOOK_SECRET missing');
    return respond(500, { error: 'webhook secret not configured' });
  }
  const svixId = header(event, 'svix-id');
  const svixTimestamp = header(event, 'svix-timestamp');
  const svixSignature = header(event, 'svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    console.warn('[fda-email-trigger] rejected: missing signature headers');
    return respond(401, { error: 'missing signature' });
  }
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : (event.body || '');
  if (!verifySvixSignature({ secret, svixId, svixTimestamp, svixSignature, body: rawBody })) {
    console.warn('[fda-email-trigger] rejected: invalid signature');
    return respond(401, { error: 'invalid signature' });
  }

  // --- parse ---------------------------------------------------------------
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (_) {
    console.warn('[fda-email-trigger] quarantined: malformed JSON payload');
    return respond(200, { status: 'quarantined', reason: 'malformed_payload' });
  }
  const email = extractEmailFields(payload);

  // --- replay / duplicate protection ---------------------------------------
  const dedupKeys = [svixId, email.messageId];
  if (await isDuplicate(dedupKeys)) {
    return respond(200, { status: 'duplicate', reprocessed: false });
  }

  // --- recipient validation --------------------------------------------------
  const expectedRecipient = config.emailRecipient.toLowerCase();
  const recipientMatch = email.to.some((t) => t.includes(expectedRecipient));
  if (!recipientMatch) {
    await recordSeen(dedupKeys);
    return respond(200, { status: 'ignored', reason: 'recipient_mismatch' });
  }

  // --- sender allowlist -------------------------------------------------------
  const fromAddress = extractSenderAddress(email.from);
  if (!senderAllowed(fromAddress)) {
    // Quarantine: log domain only (not full headers/body), acknowledge.
    console.warn(`[fda-email-trigger] quarantined sender domain: ${fromAddress.split('@')[1] || 'unknown'}`);
    await recordSeen(dedupKeys);
    return respond(200, { status: 'quarantined', reason: 'sender_not_allowlisted' });
  }

  // --- extract official URLs and enqueue -----------------------------------
  await recordSeen(dedupKeys);
  const urls = extractFdaUrls(email.text, email.html);

  const { upsertSourceDocument } = require('./lib/food-safety/store');
  let enqueued = 0;
  try {
    for (const url of urls) {
      const { isNew, changed } = await upsertSourceDocument({
        provider: 'fda',
        source_kind: 'fda_email_trigger',
        external_id: url,
        canonical_url: url,
        email_message_id: email.messageId || svixId,
        published_at: new Date().toISOString(),
        parsed_payload: {
          title: email.subject.slice(0, 300),
          via: 'email',
        },
      });
      if (isNew || changed) enqueued += 1;
    }
  } catch (e) {
    console.error(`[fda-email-trigger] enqueue failed: ${e.message}`);
    // 500 → provider retries; dedup keys were recorded, so use 200 to avoid
    // reprocessing loops while surfacing the failure in logs.
    return respond(200, { status: 'error', enqueued });
  }

  // No valid official URL → refresh discovery instead (never publish from email)
  let refreshed = false;
  if (urls.length === 0) {
    try {
      const { runDiscovery } = require('./lib/food-safety/discovery');
      await runDiscovery({ logger: console });
      refreshed = true;
    } catch (e) {
      console.error(`[fda-email-trigger] discovery refresh failed: ${e.message}`);
    }
  }

  const triggered = enqueued > 0 ? await triggerProcessor() : false;

  console.log(`[fda-email-trigger] processed: urls=${urls.length} enqueued=${enqueued} refreshed=${refreshed} triggered=${triggered}`);
  return respond(200, {
    status: 'accepted', urls: urls.length, enqueued, refreshed, triggered,
  });
};
