# iOS App, Milestone 2 Backlog

Milestone 1 shipped the full native reader app, the Live Activities surface, and a normalized content API. M2 covers the deferred backend hardening and the superior native notification layer. Each item lists the exact files/tables affected.

## DONE — Milestone 2A (Live Activity / Dynamic Island product pass)
Polished Lock Screen + Dynamic Island (NW badge, status chips, signal dot, update count, decisive final state), local start/update/end + demo helpers, previews, and backend `updateCount` content-state prep.

## DONE — Milestone 2B (Remote Live Activity / Dynamic Island updates)
Remote ActivityKit start/update/end from the `/admin` `addUpdate` flow over APNs:
- Reliable iOS token registration after pairing (cache push-to-start + per-activity tokens, re-register on redeem) — [`LiveActivityManager.swift`](ios/NoteworthyLive/App/LiveActivityManager.swift), [`PairingView.swift`](ios/NoteworthyLive/App/Views/PairingView.swift).
- Server-side `updateCount` (counts `live_story_updates`) + end-on-terminal-status (`resolved`/`false_report` or `alert_level:final`) — [`lib/liveActivityNotify.js`](netlify/functions/lib/liveActivityNotify.js).
- Per-dispatch audit row in `live_story_send_log` (`detail.channel="live_activity"`).
- Admin-auth `apnsStatus` diagnostic (secret-safe) + `testLiveActivity` trigger — [`admin-live-stories.js`](netlify/functions/admin-live-stories.js).
- Docs: [`ENV_KEYS.md`](ENV_KEYS.md) (verify), [`IOS_TESTFLIGHT_PREP.md`](IOS_TESTFLIGHT_PREP.md) section G (runbook).

## A. Standard APNs notifications — Milestone 2C (the big one)
Today only Live Activity pushes exist. Add real breaking/story alerts to the device.

1. **Device token registration**
   - Migration: add `apns_token` (+ `apns_token_updated_at`) to `live_story_devices`, or a new `ios_device_tokens` table keyed by `device_id`.
   - iOS: in [`AppDelegate.didRegisterForRemoteNotificationsWithDeviceToken`](ios/NoteworthyLive/App/AppDelegate.swift) send the hex token to a new `device-register` action (`action: "apns-token"`).
2. **Dispatch path**
   - New `netlify/functions/lib/standardPushNotify.js`: alert payload (`apns-push-type: alert`, topic = bundle id, thread-id per story, interruption-level `time-sensitive` only for urgent/final), reusing the JWT-signing approach in [`lib/apnsClient.js`](netlify/functions/lib/apnsClient.js) (generalize it beyond `liveactivity`).
   - Wire into `admin-live-stories.addUpdate` alongside web push + Live Activities.
3. **Notification Service Extension** (target already scaffolded in M1: `NotificationServiceExtension/NotificationService.swift`)
   - Implement rich image attachments from a payload `image`/`media-url` URL and thread-id grouping inside the existing pass-through `didReceive`; requires the dispatch backend to send `mutable-content: 1`.
4. **Notification preferences sync**
   - Persist [`NotificationPreferences`](ios/NoteworthyLive/App/Models/NotificationPreferences.swift) server-side (new `ios_notification_preferences` table) via a `device-register` action; honor master/breaking/live/quiet-hours/time-sensitive at dispatch time.
5. **iOS test push** endpoints: `ios-test-push`, `ios-test-live-activity` (admin-auth) so the Notifications screen test buttons are real.

## B. Hardening (from the audit "can wait until after first TestFlight")
1. **Rate limiting** on public mutation endpoints: [`follow-live-story.js`](netlify/functions/follow-live-story.js), [`device-link.js`](netlify/functions/device-link.js) (per-IP/subscriber token-bucket in Netlify Blobs, mirroring `lib/alertRateLimit.js`).
2. **Pairing-code sweeper**: scheduled function to delete expired `device_pairing_codes` (TTL is checked at redeem but rows accumulate).
3. **Stale token cleanup**: scheduled job to mark `live_activity_tokens` stale/ended and clear dead `push_to_start_token`s (currently only opportunistic on 410).
4. ~~**iOS dispatch audit**: persist Live Activity dispatch results to `live_story_send_log`~~ — DONE in 2B (writes a row with `detail.channel="live_activity"`). A dedicated `channel` column / sibling table is still optional if cleaner querying is wanted.
5. **APNs HTTP/2 session reuse** across dispatches within a warm Lambda (today one session per `sendLiveActivityBatch` call), minor.

## C. Content API extensions
1. **Server-side search**: `mobile-search` endpoint (the M1 Explore search is client-side over a loaded slice). Back it with a real index when available.
2. **Saved sync** (optional): server-side saved stories if cross-device sync is desired (M1 saves are device-local by design).
3. **Topic/category preferences**: `app_topic_preferences` if per-topic mute is wanted.

## D. Auth / misc
1. Auth0 login redirect is hardcoded to site root `/`, revisit if the app ever needs web SSO.
2. Possible duplicate notification UIs on web (`src/components/notification-preferences.js` vs `notification-settings.html`), consolidate.
3. Associated Domains / Universal Links for `https://noteworthynews.co/story/<slug>` to open the app (M1 uses the custom `noteworthylive://` scheme).

## E. Live Activity ContentState enrichment (optional, lockstep change)
The plan's richer `ContentState` (latestUpdate, updateCount, shortSource, deepLinkURL, progressLabel, isVerified) requires editing BOTH [`lib/liveActivityNotify.js`](netlify/functions/lib/liveActivityNotify.js) and [`Shared/LiveStoryAttributes.swift`](ios/NoteworthyLive/Shared/LiveStoryAttributes.swift) together (APNs decodes by exact key names). M1 keeps the existing proven contract.
