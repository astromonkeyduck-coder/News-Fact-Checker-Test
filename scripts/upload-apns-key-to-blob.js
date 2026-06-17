#!/usr/bin/env node
/**
 * One-time upload of the APNs .p8 key to Netlify Blobs so it can be removed
 * from function env vars (Netlify's 4KB combined env limit).
 *
 * Usage (with Netlify creds in env or .env):
 *   APNS_KEY_P8_BASE64="$(base64 -i AuthKey_XXXX.p8)" \
 *   NETLIFY_SITE_ID=... NETLIFY_BLOB_READ_WRITE_TOKEN=... \
 *   node scripts/upload-apns-key-to-blob.js
 *
 * Then in Netlify Dashboard:
 *   1. Set APNS_KEY_STORE=blob
 *   2. Delete APNS_KEY_P8_BASE64 and APNS_KEY_P8 (legacy)
 *   3. Redeploy
 */

const { getStore } = require("@netlify/blobs");

const key =
  process.env.APNS_KEY_P8_BASE64 ||
  process.env.APNS_KEY_P8 ||
  "";

async function main() {
  if (!key) {
    console.error("Set APNS_KEY_P8_BASE64 (or APNS_KEY_P8) before running.");
    process.exit(1);
  }
  if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
    console.error("Set NETLIFY_SITE_ID and NETLIFY_BLOB_READ_WRITE_TOKEN (netlify env:list --json).");
    process.exit(1);
  }

  const store = getStore({
    name: "server-secrets",
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
  });

  await store.set("apns-key-p8", key);
  console.log("Uploaded apns-key-p8 to Netlify Blobs store server-secrets.");
  console.log("Next: set APNS_KEY_STORE=blob, delete APNS_KEY_P8_BASE64/APNS_KEY_P8, redeploy.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
