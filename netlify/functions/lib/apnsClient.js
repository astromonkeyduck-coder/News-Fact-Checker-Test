/**
 * APNs client for ActivityKit Live Activities and standard alert pushes.
 *
 * Token-based (.p8 JWT) auth, HTTP/2 transport via Node's built-in `http2`
 * (Node's global fetch/undici does not support HTTP/2, which APNs requires).
 * ES256 JWT is signed with `jose` (already a dependency, see middleware/requireAuth.js).
 *
 * Env:
 *   APNS_KEY_P8_BASE64      base64 of the .p8 PEM private key (primary)
 *   APNS_KEY_P8             legacy alias for APNS_KEY_P8_BASE64
 *   APNS_KEY_ID             10-char key id
 *   APNS_TEAM_ID            10-char team id
 *   APNS_BUNDLE_ID          app bundle id (topic base)
 *   APNS_DEFAULT_ENVIRONMENT  'sandbox' | 'production' (default 'production')
 *
 * Two push types are supported:
 *   - liveactivity: apns-push-type: liveactivity, apns-topic:
 *     <bundle>.push-type.liveactivity, aps.event in { 'start','update','end' }.
 *   - alert: apns-push-type: alert, apns-topic: <bundle> (the plain bundle id),
 *     standard UserNotifications payload (aps.alert, sound, etc.).
 */

const http2 = require("http2");
const crypto = require("crypto");

const HOSTS = {
  production: "https://api.push.apple.com",
  sandbox: "https://api.sandbox.push.apple.com",
};

let _signedToken = null;
let _signedAt = 0;
const TOKEN_TTL_MS = 50 * 60 * 1000; // APNs allows up to 60 min; refresh at 50.

/** Netlify env: APNS_KEY_P8_BASE64 (primary). APNS_KEY_P8 is a legacy alias. */
function apnsKeyP8() {
  return process.env.APNS_KEY_P8_BASE64 || process.env.APNS_KEY_P8 || "";
}

function isConfigured() {
  return !!(
    apnsKeyP8() &&
    process.env.APNS_KEY_ID &&
    process.env.APNS_TEAM_ID &&
    process.env.APNS_BUNDLE_ID
  );
}

function topic() {
  return `${process.env.APNS_BUNDLE_ID}.push-type.liveactivity`;
}

/**
 * APNs topic for a given push type.
 *   liveactivity → <bundle>.push-type.liveactivity
 *   alert (and anything else) → <bundle>
 */
function topicFor(pushType) {
  const base = process.env.APNS_BUNDLE_ID;
  return pushType === "liveactivity" ? `${base}.push-type.liveactivity` : base;
}

function defaultEnvironment() {
  return process.env.APNS_DEFAULT_ENVIRONMENT === "sandbox" ? "sandbox" : "production";
}

/**
 * Return a cached ES256 provider token, signing a new one when stale.
 */
async function getProviderToken() {
  if (_signedToken && Date.now() - _signedAt < TOKEN_TTL_MS) {
    return _signedToken;
  }
  const { importPKCS8, SignJWT } = require("jose");

  const raw = apnsKeyP8();
  let pem = Buffer.from(raw, "base64").toString("utf8");
  // Tolerate keys stored as raw PEM (not base64) as well.
  if (!pem.includes("BEGIN PRIVATE KEY") && raw.includes("BEGIN PRIVATE KEY")) {
    pem = raw;
  }

  const key = await importPKCS8(pem, "ES256");
  _signedToken = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.APNS_KEY_ID })
    .setIssuer(process.env.APNS_TEAM_ID)
    .setIssuedAt()
    .sign(key);
  _signedAt = Date.now();
  return _signedToken;
}

/**
 * Send one Live Activity push to a single APNs token.
 *
 * @param {Object} opts
 * @param {string} opts.deviceToken  per-activity update token OR push-to-start token (hex)
 * @param {Object} opts.payload      full APNs JSON payload ({ aps: { event, ... } })
 * @param {string} [opts.environment] 'sandbox' | 'production'
 * @param {number} [opts.priority]   10 (immediate) or 5 (throttled). Default 10.
 * @param {number} [opts.expirationEpoch] apns-expiration (seconds). Default 0 (best effort).
 * @returns {Promise<{ok:boolean, status:number, reason?:string}>}
 */
async function sendLiveActivity(opts) {
  const results = await sendLiveActivityBatch([opts]);
  return results[0];
}

/**
 * Send many Live Activity pushes, reusing one HTTP/2 session per environment.
 * Live Activity behavior is unchanged (apns-push-type: liveactivity,
 * apns-topic: <bundle>.push-type.liveactivity).
 *
 * @param {Array<Object>} items  see sendLiveActivity opts
 * @returns {Promise<Array<{ok:boolean, status:number, reason?:string, deviceToken:string}>>}
 */
async function sendLiveActivityBatch(items) {
  return sendBatch(items, "liveactivity");
}

/**
 * Send one standard alert push to a single APNs token.
 * @param {Object} opts  { deviceToken, payload, environment?, priority?, expirationEpoch?, collapseId?, headers? }
 */
async function sendAlert(opts) {
  const results = await sendAlertBatch([opts]);
  return results[0];
}

/**
 * Send many standard alert pushes, reusing one HTTP/2 session per environment.
 * Uses apns-push-type: alert and apns-topic: <bundle>.
 *
 * @param {Array<Object>} items  per-item opts (see sendAlert)
 * @returns {Promise<Array<{ok:boolean, status:number, reason?:string, deviceToken:string}>>}
 */
async function sendAlertBatch(items) {
  return sendBatch(items, "alert");
}

/**
 * Shared batch sender. Each item may override `pushType`; otherwise the batch
 * default is used. The apns-topic is derived per item from its push type so a
 * mixed batch is possible, but callers normally use one type per batch.
 *
 * @param {Array<Object>} items
 * @param {string} defaultPushType  'liveactivity' | 'alert'
 */
async function sendBatch(items, defaultPushType) {
  if (!isConfigured()) {
    throw new Error("APNs not configured");
  }
  if (!items.length) return [];

  const jwt = await getProviderToken();

  // Group by environment so each host gets a single multiplexed session.
  const byEnv = { sandbox: [], production: [] };
  items.forEach((it, idx) => {
    const env = it.environment === "sandbox" ? "sandbox" : "production";
    byEnv[env].push({ it, idx });
  });

  const results = new Array(items.length);

  for (const env of Object.keys(byEnv)) {
    const group = byEnv[env];
    if (!group.length) continue;

    const session = http2.connect(HOSTS[env]);
    const sessionErr = new Promise((_, reject) => session.on("error", reject));

    try {
      await Promise.all(
        group.map(({ it, idx }) =>
          Promise.race([
            sendOne(session, jwt, it.pushType || defaultPushType, it),
            sessionErr,
          ])
            .then((r) => { results[idx] = { ...r, deviceToken: it.deviceToken }; })
            .catch((err) => {
              results[idx] = { ok: false, status: 0, reason: err.message, deviceToken: it.deviceToken };
            })
        )
      );
    } finally {
      try { session.close(); } catch (_) { /* noop */ }
    }
  }

  return results;
}

function sendOne(session, jwt, pushType, opts) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(opts.payload));
    const headers = {
      ":method": "POST",
      ":path": `/3/device/${opts.deviceToken}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": topicFor(pushType),
      "apns-push-type": pushType,
      "apns-priority": String(opts.priority || 10),
      "apns-expiration": String(opts.expirationEpoch || 0),
      "apns-id": crypto.randomUUID(),
      "content-type": "application/json",
      "content-length": Buffer.byteLength(body),
    };
    if (opts.collapseId) headers["apns-collapse-id"] = String(opts.collapseId).slice(0, 64);
    // Optional pass-through extra headers (never overrides reserved ones above).
    if (opts.headers && typeof opts.headers === "object") {
      for (const [k, v] of Object.entries(opts.headers)) {
        if (!(k in headers)) headers[k] = String(v);
      }
    }

    const req = session.request(headers);
    let status = 0;
    let data = "";

    req.on("response", (h) => { status = h[":status"]; });
    req.setEncoding("utf8");
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => {
      if (status === 200) {
        resolve({ ok: true, status });
      } else {
        let reason = data;
        try { reason = JSON.parse(data).reason || reason; } catch (_) { /* keep raw */ }
        resolve({ ok: false, status, reason });
      }
    });
    req.on("error", reject);

    req.write(body);
    req.end();
  });
}

module.exports = {
  isConfigured,
  defaultEnvironment,
  topic,
  topicFor,
  sendLiveActivity,
  sendLiveActivityBatch,
  sendAlert,
  sendAlertBatch,
};
