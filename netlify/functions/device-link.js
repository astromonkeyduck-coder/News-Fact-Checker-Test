/**
 * Device Link — pair an iOS companion app to a web subscriber's follows
 *
 * POST { action: "create-code", subscription }
 *   (web/PWA) → returns a short, single-use pairing code tied to the caller's
 *   subscriber_key. The web page shows it to the user.
 *
 * POST { action: "redeem", code, deviceUuid, apnsEnvironment?, pushToStartToken?,
 *        platform?, appVersion?, locale? }
 *   (iOS) → validates the code, links the device to that subscriber_key, issues
 *   a device secret (returned ONCE, stored in the app Keychain), and returns the
 *   followed story slugs so the app can start Live Activities.
 *
 * Anonymous, like the existing push model. The pairing code is the shared secret.
 */

const crypto = require("crypto");
const supabase = require("./lib/supabaseClient");
const { corsHeaders, optionsResponse } = require("./lib/corsHeaders");
const { getSubscriberKeyFromSubscription } = require("./lib/subscriberKey");
const { verifyToken } = require("./middleware/requireAuth");
const { createRateLimiter } = require("./rate-limit");

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
const CODE_LENGTH = 6;

// Throttle pairing traffic per source IP. Legitimate pairing is one create-code
// + one redeem; 15/min leaves ample headroom while denying brute-force guessing
// of the 6-char pairing code (which would otherwise be unbounded).
const pairingLimiter = createRateLimiter({
  maxRequests: 15,
  windowMs: 60 * 1000,
  message: "Too many pairing requests. Please wait a moment and try again.",
});

exports.handler = pairingLimiter(async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse;
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const body = JSON.parse(event.body || "{}");
    // Opportunistic retention cleanup (no separate cron needed). Runs on a small
    // fraction of pairing requests and only removes already-dead rows, so it
    // never deletes an in-flight, unredeemed code.
    if (Math.random() < 0.15) await cleanupPairingCodes();
    if (body.action === "create-code") return await createCode(body, event);
    if (body.action === "redeem") return await redeem(body);
    return json(400, { error: "Invalid or missing action" });
  } catch (err) {
    console.error("[device-link] Error:", err.message);
    return json(500, { error: "Internal server error" });
  }
});

/**
 * Best-effort cleanup of expired and already-redeemed pairing codes.
 *
 * Pairing codes carry short-lived PII captured at creation (verified Auth0
 * email/name/picture). Once a code is expired or redeemed it serves no purpose,
 * so we delete it to minimize retention. Failures are swallowed — cleanup must
 * never break the pairing flow.
 */
async function cleanupPairingCodes() {
  try {
    const nowIso = new Date().toISOString();
    // Expired codes (covers expired-and-redeemed too).
    await supabase.from("device_pairing_codes").delete().lt("expires_at", nowIso);
    // Redeemed codes that have not yet expired — they are single-use and spent.
    await supabase.from("device_pairing_codes").delete().not("redeemed_at", "is", null);
  } catch (err) {
    console.warn("[device-link] pairing-code cleanup skipped:", err.message);
  }
}

async function createCode(body, event) {
  const subscriberKey = getSubscriberKeyFromSubscription(body.subscription);
  if (!subscriberKey) return json(400, { error: "Missing or invalid subscription" });

  // If the caller is a signed-in web user, capture their VERIFIED Auth0 profile
  // (sub/email/name/picture) from the ID token. Client-provided profile is never
  // trusted — only claims from the server-verified token are stored.
  const profile = await verifiedProfile(event);

  // Try a few times in the unlikely event of a code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
    const { error } = await supabase
      .from("device_pairing_codes")
      .insert({
        code,
        subscriber_key: subscriberKey,
        expires_at: expiresAt,
        auth0_sub: profile?.sub || null,
        email: profile?.email || null,
        name: profile?.name || null,
        picture_url: profile?.pictureUrl || null,
      });
    if (!error) {
      return json(200, {
        success: true,
        code,
        expiresAt,
        ttlSeconds: CODE_TTL_MS / 1000,
        linkType: profile ? "account" : "browser",
      });
    }
    if (error.code !== "23505") throw error; // not a unique-violation → real error
  }
  return json(500, { error: "Could not allocate a pairing code, try again" });
}

/**
 * Extract a safe profile from a server-verified Auth0 ID token, if present.
 * Returns null when no/invalid token (anonymous pairing). Never trusts the
 * request body for identity. The ID token (aud = client_id) carries
 * email/name/picture for scope `openid profile email`.
 */
async function verifiedProfile(event) {
  if (!event) return null;
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  try {
    const result = await verifyToken(event);
    if (!result || !result.payload) return null;
    const p = result.payload;
    if (!p.sub) return null;
    return {
      sub: p.sub,
      email: typeof p.email === "string" ? p.email : null,
      name: typeof p.name === "string" ? p.name : null,
      pictureUrl: typeof p.picture === "string" ? p.picture : null,
    };
  } catch (err) {
    console.warn("[device-link] ID token verify failed, pairing anonymously:", err.message);
    return null;
  }
}

async function redeem(body) {
  const { code, deviceUuid } = body;
  if (!code || !deviceUuid) return json(400, { error: "Missing code or deviceUuid" });

  const normalizedCode = String(code).trim().toUpperCase();

  const { data: row, error } = await supabase
    .from("device_pairing_codes")
    .select("*")
    .eq("code", normalizedCode)
    .maybeSingle();
  if (error) throw error;

  if (!row) return json(404, { error: "Invalid pairing code" });
  if (row.redeemed_at) return json(409, { error: "Pairing code already used" });
  if (new Date(row.expires_at).getTime() < Date.now()) return json(410, { error: "Pairing code expired" });

  // Mark single-use immediately.
  await supabase
    .from("device_pairing_codes")
    .update({ redeemed_at: new Date().toISOString() })
    .eq("code", normalizedCode);

  const subscriberKey = row.subscriber_key;

  // Issue a device secret (returned once; we store only its hash).
  const deviceSecret = crypto.randomBytes(32).toString("base64url");
  const deviceSecretHash = sha256(deviceSecret);
  const apnsEnvironment = body.apnsEnvironment === "sandbox" ? "sandbox" : "production";

  // Carry the verified web profile (captured at code creation) onto the device.
  const hasProfile = Boolean(row.auth0_sub);

  const { data: device, error: upErr } = await supabase
    .from("live_story_devices")
    .upsert(
      {
        device_uuid: deviceUuid,
        device_secret_hash: deviceSecretHash,
        subscriber_key: subscriberKey,
        apns_environment: apnsEnvironment,
        push_to_start_token: body.pushToStartToken || null,
        platform: body.platform || "ios",
        app_version: body.appVersion || null,
        locale: body.locale || null,
        last_seen_at: new Date().toISOString(),
        auth0_sub: row.auth0_sub || null,
        email: row.email || null,
        name: row.name || null,
        picture_url: row.picture_url || null,
        linked_at: new Date().toISOString(),
      },
      { onConflict: "device_uuid" }
    )
    .select("id")
    .single();
  if (upErr) throw upErr;

  const follows = await getFollows(subscriberKey);

  return json(200, {
    success: true,
    deviceId: device.id,
    deviceSecret, // returned ONCE
    subscriberKey,
    follows,
    linkType: hasProfile ? "account" : "browser",
    linkedProfile: hasProfile
      ? {
          sub: row.auth0_sub,
          email: row.email || null,
          name: row.name || null,
          pictureUrl: row.picture_url || null,
        }
      : null,
  });
}

async function getFollows(subscriberKey) {
  const { data, error } = await supabase
    .from("live_story_follows")
    .select("live_stories(slug, title, status, severity, archived)")
    .eq("subscriber_key", subscriberKey)
    .eq("muted", false);
  if (error) throw error;
  return (data || [])
    .filter((r) => r.live_stories && !r.live_stories.archived)
    .map((r) => ({
      slug: r.live_stories.slug,
      title: r.live_stories.title,
      status: r.live_stories.status,
      severity: r.live_stories.severity,
    }));
}

function generateCode() {
  let out = "";
  const bytes = crypto.randomBytes(CODE_LENGTH);
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function json(statusCode, payload) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(payload) };
}

module.exports.sha256 = sha256;
