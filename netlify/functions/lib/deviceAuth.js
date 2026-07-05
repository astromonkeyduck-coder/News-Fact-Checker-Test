/**
 * Device authentication for the iOS companion app.
 *
 * Devices authenticate with the opaque deviceUuid they generated plus the
 * deviceSecret issued (once) at pairing time. We store only sha256(secret).
 * This is a lightweight bearer for anonymous devices - not an account system.
 */

const crypto = require("crypto");

function sha256(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

function timingSafeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/**
 * @returns {Promise<Object|null>} the device row on success, null otherwise.
 */
async function authenticateDevice(supabase, deviceUuid, deviceSecret) {
  if (!deviceUuid || !deviceSecret) return null;
  const { data, error } = await supabase
    .from("live_story_devices")
    .select("*")
    .eq("device_uuid", deviceUuid)
    .maybeSingle();
  if (error || !data) return null;
  if (!timingSafeEqualHex(data.device_secret_hash, sha256(deviceSecret))) return null;
  return data;
}

module.exports = { sha256, authenticateDevice };
