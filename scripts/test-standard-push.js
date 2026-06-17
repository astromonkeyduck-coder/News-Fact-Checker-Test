/**
 * Focused assertions for netlify/functions/lib/standardPushNotify.js
 * Run: node scripts/test-standard-push.js
 *
 * Covers the pure helpers (quiet-hours math, payload shape, url safety) and the
 * fail-soft path when APNs is not configured (no env vars).
 */
const assert = require("assert");

// Ensure APNs is treated as unconfigured for the fail-soft test.
delete process.env.APNS_KEY_P8_BASE64;
delete process.env.APNS_KEY_P8;
delete process.env.APNS_KEY_ID;
delete process.env.APNS_TEAM_ID;
delete process.env.APNS_BUNDLE_ID;

const sp = require("../netlify/functions/lib/standardPushNotify");

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \u2713 ${name}`);
  } catch (err) {
    console.error(`  \u2717 ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  \u2713 ${name}`);
  } catch (err) {
    console.error(`  \u2717 ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

(async () => {
  console.log("standardPushNotify");

  test("inQuietWindow same-day window", () => {
    assert.strictEqual(sp.inQuietWindow(2, 1, 5), true);
    assert.strictEqual(sp.inQuietWindow(5, 1, 5), false); // end exclusive
    assert.strictEqual(sp.inQuietWindow(0, 1, 5), false);
  });

  test("inQuietWindow wrapping past midnight", () => {
    assert.strictEqual(sp.inQuietWindow(23, 22, 7), true);
    assert.strictEqual(sp.inQuietWindow(3, 22, 7), true);
    assert.strictEqual(sp.inQuietWindow(7, 22, 7), false); // end exclusive
    assert.strictEqual(sp.inQuietWindow(12, 22, 7), false);
  });

  test("inQuietWindow start===end means no window", () => {
    assert.strictEqual(sp.inQuietWindow(5, 5, 5), false);
  });

  test("deviceLocalHour applies utc offset", () => {
    const now = new Date(Date.UTC(2026, 0, 1, 12, 0, 0)); // 12:00 UTC
    assert.strictEqual(sp.deviceLocalHour({ utc_offset_minutes: -240 }, now), 8); // EDT
    assert.strictEqual(sp.deviceLocalHour({ utc_offset_minutes: 60 }, now), 13);
    assert.strictEqual(sp.deviceLocalHour({}, now), 12); // fallback UTC
  });

  test("safeHttpsUrl rejects non-https", () => {
    assert.strictEqual(sp.safeHttpsUrl("http://x.com/a.jpg"), null);
    assert.strictEqual(sp.safeHttpsUrl("not a url"), null);
    assert.strictEqual(sp.safeHttpsUrl(""), null);
    assert.ok(sp.safeHttpsUrl("https://x.com/a.jpg"));
  });

  test("buildAlertPayload breaking shape", () => {
    const p = sp.buildAlertPayload({
      story: { id: "s1", slug: "quake", title: "Big Quake", severity: 5 },
      update: { body: "Magnitude 7.1 reported.", alert_level: "urgent" },
      status: "breaking",
      isFinal: false,
      isBreaking: true,
      timeSensitive: true,
      image: "https://x.com/p.jpg",
    });
    assert.strictEqual(p.aps.category, "BREAKING");
    assert.strictEqual(p.aps["thread-id"], "quake");
    assert.strictEqual(p.aps["interruption-level"], "time-sensitive");
    assert.strictEqual(p.aps.sound, "default");
    assert.strictEqual(p.aps["mutable-content"], 1);
    assert.strictEqual(p.url, "noteworthylive://story/quake");
    assert.strictEqual(p.image, "https://x.com/p.jpg");
    assert.ok(p.aps.alert.title.includes("Big Quake"));
    assert.ok(p.aps["relevance-score"] <= 1);
  });

  test("buildAlertPayload normal update stays quiet", () => {
    const p = sp.buildAlertPayload({
      story: { id: "s1", slug: "quake", title: "Big Quake", severity: 3 },
      update: { body: "Minor aftershock.", alert_level: "normal" },
      status: "developing",
      isFinal: false,
      isBreaking: false,
      timeSensitive: false,
      image: null,
    });
    assert.strictEqual(p.aps.category, "LIVE_STORY");
    assert.strictEqual(p.aps["interruption-level"], "active");
    assert.strictEqual(p.aps.sound, undefined);
    assert.strictEqual(p.aps["mutable-content"], undefined);
    assert.strictEqual(p.image, undefined);
  });

  await testAsync("notifyStandardPush fail-soft when APNs unconfigured", async () => {
    const out = await sp.notifyStandardPush({
      story: { id: "s1", slug: "quake", title: "Big Quake" },
      update: { id: "u1", body: "x", alert_level: "urgent" },
      logger: { warn() {}, log() {}, error() {} },
    });
    assert.strictEqual(out.configured, false);
    assert.strictEqual(out.reason, "apns not configured");
    assert.strictEqual(out.sent, 0);
  });

  await testAsync("notifyStandardPush skips silent/badge levels", async () => {
    for (const level of ["silent", "badge"]) {
      const out = await sp.notifyStandardPush({
        story: { id: "s1", slug: "q", title: "Q" },
        update: { id: "u", body: "x", alert_level: level },
        logger: { warn() {}, log() {}, error() {} },
      });
      assert.strictEqual(out.reason, level);
      assert.strictEqual(out.configured, false);
    }
  });

  console.log(`\n${passed} assertions passed`);
})();
