# Noteworthy iOS - Internal TestFlight Prep

First internal TestFlight build of the **NoteworthyLive** SwiftUI app (Milestone 1). This is **internal/private beta** readiness for you and a few trusted testers, not App Store public launch.

- App version: **0.1.0 (1)** (`MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` in [`project.yml`](ios/NoteworthyLive/project.yml))
- Minimum iOS: **16.2** (Live Activities)
- Targets / bundle IDs:
  - App: `co.noteworthynews.live`
  - Live Activity widget: `co.noteworthynews.live.LiveStoryWidget`
  - Notification Service Extension (pass-through in M1): `co.noteworthynews.live.NotificationService`
- Scheme: **NoteworthyLive** (shared, builds + embeds all three targets; archives Release)

> Setup, signing, and Live Activity testing detail live in [`IOS_APP_SETUP.md`](IOS_APP_SETUP.md). Milestone 2 scope is in [`IOS_M2_BACKLOG.md`](IOS_M2_BACKLOG.md). This file is the archive/upload runbook.

---

## A. Pre-archive checklist

Content / honesty:
- [ ] **Archive the production "TEST Live Story" row** in `/admin` ▸ Live Stories. It is real backend data (a Supabase row), not an app mock, so it WILL show on the Live tab and in the Home "Developing Now" rail until archived. Do this before inviting testers.
- [ ] Confirm real content loads: `curl -s "https://noteworthynews.co/.netlify/functions/mobile-feed?limit=3"` returns items (verified live, HTTP 200).
- [ ] Onboarding copy is honest: the permission screen reads "Turn on Live Activities" and frames breaking/story push alerts as "rolling out soon" (no overpromise).
- [ ] No mock leakage: a Release build never shows mock stories. Mock data only appears under `-UseMockData`, SwiftUI previews, or a **DEBUG-only** network-failure fallback - all disabled in Release.
- [ ] No DEBUG overlay in Release: the Profile ▸ "Developer (DEBUG)" data-mode section is compiled out of Release (`#if DEBUG`).

Project / signing (manual in Xcode):
- [ ] App icon appears: 1024x1024 opaque PNG (no alpha) at `App/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon1024.png`.
- [ ] Launch screen configured (navy `LaunchBackground` + `LaunchMark`), splash hands off seamlessly.
- [ ] Set your **Apple Developer Team** in Xcode ▸ Signing & Capabilities for **all three targets** (signing is Automatic; `DEVELOPMENT_TEAM` is intentionally empty in `project.yml` so no team is committed).
- [ ] **Push Notifications** capability enabled on the `co.noteworthynews.live` App ID (Live Activities need no separate App ID capability; they are enabled by the Info.plist `NSSupportsLiveActivities` key, already set).
- [ ] Live Activities Info.plist support present: `NSSupportsLiveActivities` = true (and `NSSupportsLiveActivitiesFrequentUpdates` = true) in [`SupportingFiles/Info.plist`](ios/NoteworthyLive/SupportingFiles/Info.plist).
- [ ] Bundle IDs match the three values above (widget + NSE App IDs are auto-created by Automatic signing).
- [ ] Version/build: `0.1.0 (1)`.

Export compliance:
- [ ] `ITSAppUsesNonExemptEncryption = false` is set in Info.plist, so there is no per-build export-compliance prompt.

---

## B. Xcode archive steps

1. Regenerate the project from `project.yml` (keeps the committed `.xcodeproj` in sync):
   ```bash
   cd /Users/richarda/breaking-news-game/ios/NoteworthyLive
   xcodegen generate
   open -a Xcode NoteworthyLive.xcodeproj
   ```
   (`xcodegen` install: `brew install xcodegen`.)
2. In Xcode:
   - Select the **NoteworthyLive** scheme.
   - Select destination **Any iOS Device (arm64)** / generic iOS device (archiving is disabled for simulators).
   - In Signing & Capabilities, set your **Team** for **NoteworthyLive**, **LiveStoryWidget**, and **NotificationServiceExtension** (Automatic signing will provision all three).
   - **Product ▸ Archive**.
   - When the Organizer opens, **Validate App** first (catches signing/icon/entitlement issues), then **Distribute App**.
   - Choose **TestFlight & App Store Connect** ▸ Upload.
   - Use **Internal Testing** first.

---

## C. App Store Connect setup checklist

- [ ] Create the app record (if it does not exist): My Apps ▸ + ▸ New App.
  - Platform: **iOS**
  - Bundle ID: **co.noteworthynews.live**
  - Name: **Noteworthy News** (store/listing brand name; the on-device home-screen name stays **Noteworthy** via `CFBundleDisplayName`).
  - SKU: any stable string, e.g. `noteworthy-live`.
- [ ] After the build finishes processing, it appears under **TestFlight**.
- [ ] Create/confirm an **Internal Testing** group and add yourself + trusted testers (internal testers must be users on your App Store Connect team; no Beta App Review required).
- [ ] Add the build to the internal group.
- [ ] Fill **Test Information ▸ What to Test** (paste section D).
- [ ] Internal testing needs no Beta App Review and no full privacy nutrition labels yet; complete those before any external testing or public release.

---

## D. Internal TestFlight "What to Test" text

Paste into App Store Connect ▸ TestFlight ▸ Test Information ▸ What to Test:

> Welcome to the first internal beta of the Noteworthy iOS app.
>
> This build focuses on the native reader experience: Home, Live Stories, Story Detail, Saved, Explore, onboarding, and local Live Activity behavior. Breaking-news push alerts and remote Live Activity updates are rolling out in a later build, so you will not receive push notifications yet.
>
> Please check:
> - Onboarding reads clearly and the "Allow notifications" step makes sense.
> - Home loads real Noteworthy stories with images; tapping opens the full story.
> - Video stories show a play thumbnail and open playback on the web.
> - The Live tab loads developing stories; try Follow Live and starting a Live Activity (Lock Screen / Dynamic Island).
> - Save a story, then open the Saved tab; try Share.
> - Explore/search returns sensible results.
> - Profile opens without crashing; pairing-code entry works if you have a code.
> - Overall design, typography, spacing, dark-mode feel, and any rough edges.
>
> Please report: crashes, broken links, content that fails to load, confusing copy, or anything that feels off. Screenshots welcome. Thank you.

---

## E. Known beta limitations

- **Standard APNs push alerts are live (Milestone 2C)** once the `APNS_*` vars are configured in Netlify. A paired device that grants notifications registers its token and receives breaking/story/final alerts for stories it follows. Without the `APNS_*` vars, dispatch is a no-op (web push still works). See section H for the runbook.
- **Remote Live Activity updates** (push-to-start, server-driven timeline updates) work once the `APNS_*` vars are configured in Netlify (**Milestone 2B**). Without them, Live Activities still start locally and update locally. See section G for the remote test runbook.
- **Notification Service Extension** attaches rich images (https `image` payload) and groups by story (Milestone 2C). It fails soft to a plain alert on any download error/timeout.
- **Notification preferences and quiet hours now sync to the newsroom** (Milestone 2C) and are honored at dispatch. Quiet hours use the device's reported UTC offset.
- **Some videos open on the web** rather than playing inline; inline native playback is a future item.
- **Explore search is client-side** over a loaded slice of recent stories (full archive search is Milestone 2).
- **Saved stories are device-local** (no cross-device sync).
- **App icon / brand assets** are a real NW-monogram treatment and may be refined later.
- **The production "TEST Live Story"** will appear until you archive it in `/admin` (see section A).

---

## F. Smoke test after installing from TestFlight

- [ ] App opens to the splash, then Home (no crash on launch).
- [ ] Onboarding shows on first run; Continue/Skip and "Allow notifications" all work.
- [ ] Home loads real Noteworthy stories with images (not a blank screen, not mock).
- [ ] Tapping a story opens Story Detail with title, body/summary, and meta.
- [ ] Images display, or fall back to a clean newspaper placeholder.
- [ ] A video item shows a play thumbnail and opens web playback.
- [ ] Live tab loads developing stories (or a polished empty state if none).
- [ ] Follow Live and Start Live Activity behave (Live Activity appears on Lock Screen / Dynamic Island on supported devices).
- [ ] Save and Share work from a story.
- [ ] Explore/search returns results.
- [ ] Profile opens; pairing-code entry does not crash.
- [ ] Deep link opens the right story: `xcrun simctl openurl booted "noteworthylive://story/<slug>"` (app must be installed/launched first).
- [ ] After the `/admin` cleanup, **no "TEST Live Story"** is visible.

---

## G. Remote Live Activity test (Milestone 2B)

Remote update/end runs over APNs (`apns-push-type: liveactivity`). It requires the `APNS_*` Netlify vars (see `ENV_KEYS.md`) and a **real device** (the Simulator cannot receive APNs).

### One-time setup
1. Apple Developer ▸ Certificates, IDs & Profiles ▸ **Keys** ▸ create a key with **Apple Push Notifications service (APNs)**. Download the `.p8` (once).
2. Base64 it: `base64 -i AuthKey_XXXXXXXXXX.p8 | pbcopy` and set in Netlify ▸ Environment variables:
   - `APNS_KEY_P8_BASE64` (the base64), `APNS_KEY_ID` (10-char), `APNS_TEAM_ID` (10-char), `APNS_BUNDLE_ID=co.noteworthynews.live`, `APNS_DEFAULT_ENVIRONMENT=production`.
3. Redeploy. Verify (signed into `/admin`):
   `curl "…/.netlify/functions/admin-live-stories?action=apnsStatus" -H "Authorization: Bearer <admin token>"` → `configured:true`.

### Token type vs build
- A **Debug** build on a real device registers `sandbox`; **TestFlight/App Store** registers `production`. The backend dispatches to whichever host the device stored at pairing. Mismatched env ⇒ `BadDeviceToken`.

### End-to-end test (real iPhone)
1. Build/run on the device (Debug = sandbox). Pair in **Profile** (code from the website Notification settings). Pairing now also uploads the push-to-start token.
2. On the **Live** tab or a Story Detail, tap the bolt to **start a Live Activity** locally (Lock Screen + Dynamic Island show it). This registers the per-activity update token with the backend.
3. In `/admin` ▸ Live Stories, open that story and **post an update** (or use the silent test trigger below). The Lock Screen / Dynamic Island should update within a few seconds.
4. **Tap** the Lock Screen / Island → the app opens that exact story (`noteworthylive://story/<slug>`). A missing slug falls back to a graceful error on the Live tab (no crash).
5. Post a **final** update (alert level `final`) or move the story to `resolved`/`false_report` → the activity **ends** and dismisses.

### Silent test trigger (no timeline write, no web push)
Send a synthetic update/end straight to the running activities + push-to-start followers:

```bash
# update
curl -X POST "…/.netlify/functions/admin-live-stories" -H "Authorization: Bearer <admin token>" \
  -H "Content-Type: application/json" \
  -d '{"action":"testLiveActivity","slug":"<slug>","status":"breaking","headline":"Test from newsroom"}'
# end
curl -X POST "…/.netlify/functions/admin-live-stories" -H "Authorization: Bearer <admin token>" \
  -H "Content-Type: application/json" \
  -d '{"action":"testLiveActivity","slug":"<slug>","final":true}'
```

### Inspect logs / triage
- **Netlify ▸ Functions ▸ admin-live-stories / lib logs**: each dispatch logs `[liveActivityNotify] story=… updated=N started=N ended=N failed=N`. A `failed>0` line prints the APNs `status` + `reason`.
- Every dispatch is also audited in `live_story_send_log` with `detail.channel = "live_activity"` (query by `story_id`).
- `reason:"apns not configured"` ⇒ env vars missing (run `apnsStatus`). `BadDeviceToken`/`Unregistered`/410 ⇒ stale or wrong-environment token (auto-marked stale; re-pair / restart the activity). No `updated/started` but `configured:true` ⇒ no running activity and no push-to-start follower for that story.

---

## H. Standard push test (Milestone 2C)

Standard alert notifications run over APNs (`apns-push-type: alert`, topic `co.noteworthynews.live`). Same `APNS_*` vars and `.p8` key as Live Activities; requires a **real device** (Simulator cannot receive remote APNs). Verify `apnsStatus` returns `configured:true` and note `alertTopic` = the plain bundle id.

### End-to-end test (real iPhone)
1. Build/run on the device (Debug = sandbox). In onboarding (or **Notifications**), **grant notifications** — this registers the standard APNs token (`device-register {action:"apns-token"}`).
2. Pair in **Profile** with a code from the website (the token is also carried through `redeem`). In **Notifications**, confirm **Device registered: Yes** and **Preferences: Synced**.
3. **Follow** a live story (so the device has a follow row for it).
4. In `/admin` ▸ Live Stories, **post an update** to that story → a banner arrives within seconds. Normal updates are quiet; urgent/final ring and (if enabled) arrive Time-Sensitive.
5. **Tap** the banner → the app opens that exact story (`noteworthylive://story/<slug>`).
6. Toggle a preference (e.g. turn off **Live story updates**, or enable **Quiet hours** spanning now) and re-post → the suppressed category is skipped (see `skipped` + `reasons` in the audit row).
7. Delete the app (or disable notifications) and re-post → the dead token is cleared on `410`/`Unregistered` (the device row's `apns_token` is nulled).

### Silent test trigger (no timeline write, no web push, no Live Activity)
Send a synthetic standard push to a story's followers (optionally a rich image):

```bash
# normal banner
curl -X POST "…/.netlify/functions/admin-live-stories" -H "Authorization: Bearer <admin token>" \
  -H "Content-Type: application/json" \
  -d '{"action":"testStandardPush","slug":"<slug>","headline":"Test alert from newsroom"}'
# urgent + rich image
curl -X POST "…/.netlify/functions/admin-live-stories" -H "Authorization: Bearer <admin token>" \
  -H "Content-Type: application/json" \
  -d '{"action":"testStandardPush","slug":"<slug>","alert_level":"urgent","headline":"Breaking test","image":"https://…/photo.jpg"}'
```

### Inspect logs / triage
- **Netlify ▸ Functions ▸ admin-live-stories**: each dispatch logs `[standardPushNotify] story=… sent=N failed=N skipped=N`.
- Audited in `live_story_send_log` with `detail.channel = "ios_standard_push"` (incl. a `reasons` breakdown: `master_off`, `category_off`, `quiet_hours`).
- Full APNs error reference + device-side checks: [`IOS_NOTIFICATIONS_TESTING.md`](IOS_NOTIFICATIONS_TESTING.md).
