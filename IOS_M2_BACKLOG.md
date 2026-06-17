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

## DONE — Milestone 2C (Standard APNs notifications, rich alerts, preference sync, hardening)
Real breaking/story alert notifications to the native app, alongside web push + Live Activities.

1. **Device token registration** — DONE
   - Migration [`008_ios_push.sql`](supabase/migrations/008_ios_push.sql): additive `apns_token` + `apns_token_updated_at` + 8 preference columns + `utc_offset_minutes` on `live_story_devices` (partial index on `apns_token`).
   - iOS: [`AppDelegate.didRegisterForRemoteNotificationsWithDeviceToken`](ios/NoteworthyLive/App/AppDelegate.swift) caches the hex token in [`DeviceIdentity`](ios/NoteworthyLive/App/DeviceIdentity.swift) and registers it via `device-register {action:"apns-token"}`; token also carried through `redeem` and every `heartbeat` ([`APIClient.swift`](ios/NoteworthyLive/App/APIClient.swift)).
2. **Dispatch path** — DONE
   - [`lib/apnsClient.js`](netlify/functions/lib/apnsClient.js) generalized: `topicFor(pushType)`, per-item `pushType`, `apns-collapse-id`, `sendAlertBatch`/`sendAlert` (Live Activity path byte-for-byte unchanged).
   - New [`lib/standardPushNotify.js`](netlify/functions/lib/standardPushNotify.js): targets followers' devices with a token, honors prefs/quiet-hours/time-sensitive, builds the alert payload (thread-id, category, deep link, optional image), dead-token cleanup, audit `detail.channel="ios_standard_push"`, best-effort dedupe.
   - Wired into [`admin-live-stories.addUpdate`](netlify/functions/admin-live-stories.js) `Promise.all` (fail-soft) + admin-auth `testStandardPush`.
3. **Notification Service Extension** — DONE
   - [`NotificationService.swift`](ios/NoteworthyLive/NotificationServiceExtension/NotificationService.swift) downloads the https `image` (10s timeout / 5MB cap), attaches it, applies `thread-id`, and fails soft to the original.
4. **Notification preferences sync** — DONE
   - 1:1 columns on `live_story_devices` (no extra table/join). [`NotificationPreferences`](ios/NoteworthyLive/App/Models/NotificationPreferences.swift) debounced sync via `device-register {action:"preferences"}`; honored at dispatch; honest Notifications UI (device-registered + synced/pending/failed, no "rolling out soon" copy).
5. **Hardening** — DONE: `device-register` rate-limited (60/min per IP); dead-token cleanup on `410`/`BadDeviceToken`/`Unregistered`/`DeviceTokenNotForTopic`.

Test surface stays inside the already-admin-authed function (`testStandardPush` / `testLiveActivity`) rather than new public endpoints. See [`IOS_NOTIFICATIONS_TESTING.md`](IOS_NOTIFICATIONS_TESTING.md).

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
