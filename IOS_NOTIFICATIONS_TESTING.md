# iOS Notifications - Real-Device Testing (Milestone 2C)

How to test **standard APNs push notifications** for the native NoteworthyLive app end to end, and how to read/triage failures. Standard push is separate from Live Activities (covered in [`IOS_TESTFLIGHT_PREP.md`](IOS_TESTFLIGHT_PREP.md) §G); both ride the same `.p8` key.

> **A real device is required.** The iOS Simulator cannot receive remote APNs pushes (Live Activity *or* alert). Use a physical iPhone.

---

## 1. What standard push is

When an editor posts an update in `/admin` ▸ Live Stories, `addUpdate` dispatches in parallel (all fail-soft):
- **web push** → followers' browsers (`lib/liveStoryNotify.js`)
- **Live Activities** → running/started ActivityKit activities (`lib/liveActivityNotify.js`)
- **standard push** → native app devices that follow the story (`lib/standardPushNotify.js`) ← **this doc**

Standard push uses `apns-push-type: alert`, topic = the plain bundle id `co.noteworthynews.live`.

Alert-level → behavior:

| `alert_level` | Banner? | Sound | Interruption level | Preference gate |
|---------------|---------|-------|--------------------|-----------------|
| `silent` | no (timeline only) | - | - | - |
| `badge` | no | - | - | - |
| `normal` | yes (quiet) | none | `active` | Live story updates |
| `urgent` | yes | default | `time-sensitive`\* | Breaking news |
| `final` (or status `resolved`/`false_report`) | yes | default | `time-sensitive`\* | Final & corrections |

\* Time-Sensitive only when the device's **Time-Sensitive** preference is on; otherwise `active`. Never `critical`.

Quiet hours suppress **non-urgent** (normal) pushes only; urgent/final always alert.

---

## 2. One-time backend setup

Same as Live Activities - set in Netlify ▸ Environment variables, then redeploy:
`APNS_KEY_P8_BASE64` (base64 of the `.p8`), `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID=co.noteworthynews.live`, `APNS_DEFAULT_ENVIRONMENT` (`sandbox` for debug-device testing, `production` for TestFlight/App Store).

Apply migrations through `008_ios_push.sql`.

Verify (signed into `/admin`):

```bash
curl -s "https://noteworthynews.co/.netlify/functions/admin-live-stories?action=apnsStatus" \
  -H "Authorization: Bearer <admin Auth0 token>"
# → { configured:true, environment, alertTopic:"co.noteworthynews.live",
#     liveActivityTopic:"co.noteworthynews.live.push-type.liveactivity", ... }
```

`configured:false` ⇒ one of `APNS_KEY_P8_BASE64 / APNS_KEY_ID / APNS_TEAM_ID / APNS_BUNDLE_ID` is missing.

---

## 3. Device setup

1. Build/run on a real iPhone. A **Debug** build registers the `sandbox` APNs environment; **TestFlight/App Store** registers `production`. The token must match the host or you get `BadDeviceToken`.
2. **Grant notifications** (onboarding or **Notifications** screen). This calls `registerForRemoteNotifications`; on success `AppDelegate.didRegisterForRemoteNotificationsWithDeviceToken` caches the hex token and (if paired) registers it via `device-register {action:"apns-token"}`.
3. **Pair** in Profile with a code from the website Notification settings. The token is also carried through `redeem`, and current preferences are pushed immediately.
4. On the **Notifications** screen confirm:
   - **Push notifications: On**
   - **Device registered: Yes** (a token reached the server)
   - **Preferences: Synced**
5. **Follow** at least one live story so the device has a follow row.

---

## 4. End-to-end test

1. In `/admin` ▸ Live Stories, open the followed story and **post a `normal` update** → a quiet banner arrives within seconds.
2. **Tap** the banner → the app opens that exact story (`noteworthylive://story/<slug>`).
3. Post an **urgent** update → it rings and (if Time-Sensitive is on) breaks through Focus.
4. Post a **final** update (or move status to `resolved`/`false_report`) → standard push fires **and** any Live Activity ends.
5. **Rich image:** use the test trigger with an `image` (below) → the Notification Service Extension downloads and attaches it (long-press/expand the banner to see the image).
6. **Preference gating:** turn off **Live story updates** (or enable **Quiet hours** spanning now), re-post a normal update → no banner; the audit row shows it under `skipped`/`reasons`.
7. **Dead-token cleanup:** delete the app (or turn notifications off in iOS Settings) and re-post → on the next dispatch the `410`/`Unregistered` token is nulled (`live_story_devices.apns_token`).

### Admin test triggers (no timeline write, no web push, no Live Activity)

```bash
# normal banner to a story's followers
curl -X POST "https://noteworthynews.co/.netlify/functions/admin-live-stories" \
  -H "Authorization: Bearer <admin token>" -H "Content-Type: application/json" \
  -d '{"action":"testStandardPush","slug":"<slug>","headline":"Test alert"}'

# urgent + rich image
curl -X POST "https://noteworthynews.co/.netlify/functions/admin-live-stories" \
  -H "Authorization: Bearer <admin token>" -H "Content-Type: application/json" \
  -d '{"action":"testStandardPush","slug":"<slug>","alert_level":"urgent","headline":"Breaking test","image":"https://…/photo.jpg"}'
```

`testStandardPush` targets the story's current followers (with a token). It skips the dedupe guard, never writes the timeline, and never sends web push.

---

## 5. Reading logs

- **Netlify ▸ Functions ▸ admin-live-stories**: each dispatch logs
  `[standardPushNotify] story=<slug> level=<level> sent=N failed=N skipped=N`.
  A `failed>0` line prints the APNs `status` + `reason`.
- **Audit table** `live_story_send_log` (query by `story_id`): standard-push rows have `actor = "ios_standard_push"` and `detail.channel = "ios_standard_push"`, with `detail.reasons` counting why devices were skipped:
  - `master_off` - device master switch off
  - `category_off` - that alert category disabled
  - `quiet_hours` - suppressed by quiet hours (non-urgent only)

---

## 6. APNs error reference

The `reason` comes straight from APNs (`results[].reason`). Common cases:

| reason / status | Meaning | Fix |
|-----------------|---------|-----|
| `apns not configured` (in our logs) | `APNS_*` env vars missing | Set the four vars; run `apnsStatus` |
| `BadDeviceToken` / 400 | Token doesn't match the host environment | Debug build = sandbox, TestFlight/App Store = production; re-pair on the matching build. Auto-nulled. |
| `DeviceTokenNotForTopic` / 400 | Token registered for a different topic/bundle | Confirm `APNS_BUNDLE_ID=co.noteworthynews.live`. Auto-nulled. |
| `Unregistered` / 410 | App uninstalled / token permanently invalid | Expected after uninstall; token auto-nulled. |
| `BadTopic` / 400 | Wrong `apns-topic` | Should be the plain bundle id for alerts; check `alertTopic` in `apnsStatus`. |
| `ExpiredProviderToken` / 403 | Provider JWT expired | Transient; client re-signs ES256 every ≤50 min. Retry. |
| `TooManyProviderTokenUpdates` / 429 | JWT regenerated too often | Transient; back off. |
| `PayloadTooLarge` / 413 | Payload > 4KB | Trim body/custom keys (we truncate the headline to 160 chars). |
| `Forbidden` / 403 (`InvalidProviderToken`) | Wrong `APNS_KEY_ID`/`APNS_TEAM_ID`/key | Re-check the key id, team id, and `.p8`. |

---

## 7. Device-side checks when nothing arrives

- iOS Settings ▸ Noteworthy ▸ Notifications **On** (and not in a Focus that filters it).
- **Notifications** screen shows **Device registered: Yes**. If **No**, notifications were never granted or the token POST failed - toggle notifications and check Netlify logs.
- The device actually **follows** the story (standard push only targets followers).
- The build's environment matches `apnsStatus.environment` / the device's stored env.
- Preferences/quiet hours aren't silently suppressing it (check the audit `reasons`).
