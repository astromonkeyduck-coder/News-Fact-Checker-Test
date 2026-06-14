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

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
const CODE_LENGTH = 6;

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse;
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const body = JSON.parse(event.body || "{}");
    if (body.action === "create-code") return await createCode(body);
    if (body.action === "redeem") return await redeem(body);
    return json(400, { error: "Invalid or missing action" });
  } catch (err) {
    console.error("[device-link] Error:", err.message);
    return json(500, { error: "Internal server error" });
  }
};

async function createCode(body) {
  const subscriberKey = getSubscriberKeyFromSubscription(body.subscription);
  if (!subscriberKey) return json(400, { error: "Missing or invalid subscription" });

  // Try a few times in the unlikely event of a code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
    const { error } = await supabase
      .from("device_pairing_codes")
      .insert({ code, subscriber_key: subscriberKey, expires_at: expiresAt });
    if (!error) {
      return json(200, { success: true, code, expiresAt, ttlSeconds: CODE_TTL_MS / 1000 });
    }
    if (error.code !== "23505") throw error; // not a unique-violation → real error
  }
  return json(500, { error: "Could not allocate a pairing code, try again" });
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
