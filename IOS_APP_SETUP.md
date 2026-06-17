# Noteworthy News, iOS App Setup (Milestone 1)

The native SwiftUI reader app lives in [`ios/NoteworthyLive/`](ios/NoteworthyLive/). It is a full Noteworthy News app, Home, Live stories, Story Detail, Saved, Explore, Notifications, Profile/Pairing, plus the signature Live Activities / Dynamic Island. The website remains the production content engine and newsroom.

This is **Milestone 1**: the complete app on **real public endpoints** (verified live — see [Real content status](#15-real-content-status--test-commands)), an openable Xcode project, and the new backend content API. Standard-APNs push notifications, the Notification Service Extension dispatch, and backend hardening are **Milestone 2** (see [`IOS_M2_BACKLOG.md`](IOS_M2_BACKLOG.md)). Future design/polish ideas are tracked in [`IOS_FUTURE_DESIGN_BACKLOG.md`](IOS_FUTURE_DESIGN_BACKLOG.md). The first internal TestFlight runbook is [`IOS_TESTFLIGHT_PREP.md`](IOS_TESTFLIGHT_PREP.md).

---

## 1. Open & run the app

The Xcode project is generated from a committed [`project.yml`](ios/NoteworthyLive/project.yml) with [XcodeGen](https://github.com/yonsei/XcodeGen) so the target setup is reproducible and reviewable.

```bash
brew install xcodegen          # one-time
cd ios/NoteworthyLive
xcodegen generate              # writes NoteworthyLive.xcodeproj
open NoteworthyLive.xcodeproj
```

Then in Xcode: select the **NoteworthyLive** scheme and a simulator or device, and Run.

### Data source modes
- **Default**: the app hits the real endpoints at `https://noteworthynews.co`. In **DEBUG** only, if a call fails or returns empty it falls back to mock so the screen is never blank.
- `-UseLiveData` (Scheme ▸ Run ▸ Arguments): **strict live** — disables the mock fallback so you see real data or a real empty/error state. Use this to confirm the live path.
- `-UseMockData`: force mock everywhere (offline demos / UI work).
- Mock never silently masquerades as live: in DEBUG a fallback logs a loud `⚠️ [DataMode] FALLBACK` console warning, and **Profile ▸ Developer (DEBUG)** shows the current source (Live / Mock / Fallback), the base URL, and the last API error. None of this ships in Release.
- SwiftUI previews work per-file (many views ship `#Preview`s).

### Targets
| Target | Bundle ID | Purpose |
|--------|-----------|---------|
| `NoteworthyLive` | `co.noteworthynews.live` | The SwiftUI reader app |
| `LiveStoryWidget` | `co.noteworthynews.live.LiveStoryWidget` | Live Activity (Lock Screen + Dynamic Island) |
| `NotificationServiceExtension` | `co.noteworthynews.live.NotificationService` | NSE scaffold, pass-through in M1; rich media (image attachments, grouping) is wired in M2 |

> The NSE is a real target now (matches the planned 3-target structure) but is a safe pass-through: it only runs for pushes sent with `mutable-content: 1`, and M1 sends no such pushes. It needs its own App ID (`co.noteworthynews.live.NotificationService`), automatic signing creates it. No M2 dispatch logic lives in it yet.

Minimum deployment: **iOS 16.2** (Live Activities). Push-to-start remote Live Activities require **iOS 17.2+**; on 16.2-17.1 the app starts them locally.

---

## 1.5 Real content status & test commands

Verified live in production (Jun 2026):

| Surface | Endpoint | Real? |
|---------|----------|-------|
| Home feed (Latest, breaking, alerts) | `mobile-feed` / `/api/mobile/feed` | **Real** — NWS alerts, breaking news, video posts |
| Story Detail (posts) | `mobile-story?id=<postId>` | **Real** — includes `bodyText` |
| Live stories + timeline | `live-stories` (+ `?slug=`) | **Real** — Supabase-backed |
| Feed/story images | `imageUrl` | **Real where available** (e.g. twimg thumbnails); null images render a clean fallback, no ugly gaps |
| Video posts | `videoUrl` + `imageUrl` + `isVideo` | **Real metadata** — thumbnail + video badge shown; inline playback is a future-backlog item (video opens via the source/web) |

Still mock-only: nothing on the happy path. Mock appears only in `-UseMockData`, SwiftUI previews, or a DEBUG fallback when the network/endpoint is down.

Test the backend directly:
```bash
# Feed (grab a real id from the output):
curl -s "https://noteworthynews.co/.netlify/functions/mobile-feed?limit=3" | head
# Single story detail — NOTE: mobile-story takes ?id=<postId>, NOT ?slug=
curl -s "https://noteworthynews.co/.netlify/functions/mobile-story?id=<postId-from-feed>" | head
# Live stories:
curl -s "https://noteworthynews.co/.netlify/functions/live-stories" | head
```
Live stories use `?slug=` (`live-stories?slug=test-live-story`); editorial posts use `mobile-story?id=`.

> The "TEST Live Story" you may see is **real backend data** (a Supabase row), not an app mock. Archive it in `/admin` ▸ Live Stories when you want it gone.

---

## 2. Apple Developer setup (requires the Apple Developer GUI)

These steps need the Apple Developer portal and Xcode, they cannot be scripted here.

1. **App Identifier**: create `co.noteworthynews.live` with capabilities **Push Notifications**. (Live Activities need no separate App ID capability, they're enabled by the Info.plist `NSSupportsLiveActivities` key, already set.)
2. **Widget App ID**: `co.noteworthynews.live.LiveStoryWidget`.
3. **Signing**: in Xcode, select each target ▸ Signing & Capabilities ▸ set your Team. Signing is Automatic. Leave `DEVELOPMENT_TEAM` empty in `project.yml`; Xcode manages it.
4. **Capabilities** (app target): Push Notifications (the entitlements file [`SupportingFiles/NoteworthyLive.entitlements`](ios/NoteworthyLive/SupportingFiles/NoteworthyLive.entitlements) sets `aps-environment` to `development` for local debug device builds; **TestFlight and App Store distribution builds use `production`**, applied automatically by distribution signing).
5. **APNs auth key (.p8)**: Certificates, IDs & Profiles ▸ Keys ▸ new key with "Apple Push Notifications service (APNs)". Download once. Needed only for M2 remote push / remote Live Activity testing.

---

## 3. Backend env vars (Netlify)

| Variable | Needed for | Status |
|----------|-----------|--------|
| (none) | `mobile-feed` / `mobile-story` content API | Works today, read-only, no new keys |
| `VAPID_*` | Web push | Already set |
| `APNS_KEY_P8` (base64) | Live Activity / push dispatch | **M2**, not set yet (dispatch no-ops) |
| `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID` | APNs auth/topic | **M2** |
| `APNS_DEFAULT_ENVIRONMENT` | `sandbox` (local development/debug device) / `production` (TestFlight + App Store) | **M2** |

See [`ENV_KEYS.md`](ENV_KEYS.md) for the full list. `APNS_BUNDLE_ID` must equal `co.noteworthynews.live`.

---

## 4. Supabase migrations

Already applied in production: `005_create_live_stories.sql`, `006_create_ios_devices.sql`. No new migration in M1.

---

## 5. Real-device testing (M1)

1. Run on a device. The app is fully usable unpaired (browse Home/Live/Story/Saved/Explore).
2. **Deep links**: the app must be **installed and launched** on the booted simulator first (Run from Xcode, or `xcrun simctl install`). Then:
   ```bash
   xcrun simctl openurl booted "noteworthylive://story/election-night"
   ```
   It should open the Live tab and push native Story Detail for that slug.
   > If you just ran `xcrun simctl uninstall booted co.noteworthynews.live`, `openurl` will fail with `LSApplicationWorkspaceErrorDomain error 115` — there's no app to handle the scheme. Reinstall/run first, then deep-link.
3. **Pairing** (unlocks following + Live Activities from the phone):
   - On noteworthynews.co ▸ Notification settings ▸ generate a pairing code.
   - In the app ▸ Profile ▸ Enter pairing code.
4. **Live Activity (local start)**: Live tab ▸ a story ▸ tap the bolt to start a Live Activity. Confirm it appears on the Lock Screen and (on supported devices) the Dynamic Island. This works without APNs.

---

## 6. Push & remote Live Activity testing (after M2 APNs setup)

1. Set `APNS_*` env vars in Netlify; redeploy.
2. Pair the device, follow a live story, start a Live Activity.
3. In `/admin` ▸ Live Stories, post an update.
4. Verify the Lock Screen + Dynamic Island update, tapping opens the exact story, and a `final` update ends the activity.

---

## 7. Live Activity / Dynamic Island testing

- The Live Activity UI lives in [`Widget/LiveStoryLiveActivity.swift`](ios/NoteworthyLive/Widget/LiveStoryLiveActivity.swift) and shares `LiveStoryAttributes` / `ContentState` with the backend byte-for-byte.
- Preview the Live Activity in Xcode: open `LiveStoryLiveActivity.swift` and use the Live Activity preview, or run on device and start one from the Live tab.
- Dynamic Island states (compact/minimal/expanded) are all defined; test on an iPhone 14 Pro+ simulator or device.

---

## 8. Common failures

| Symptom | Cause / fix |
|---------|-------------|
| `xcodegen: command not found` | `brew install xcodegen` |
| Build fails on signing | Set your Team on all three targets (app, widget, NSE) in Signing & Capabilities |
| App icon | Real icon shipped: bold "NW" monogram (Sora ExtraBold, white) on a navy gradient at `App/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon1024.png`. Regenerate with `swift /tmp/mkmark.swift <Sora-ExtraBold.ttf> <icon.png> <mark1x> <mark2x> <mark3x>`, or drop your own opaque 1024px PNG (no alpha) in its place. The launch/splash mark lives in `LaunchMark.imageset`. |
| Empty feed in Release | Release builds don't mock-fallback; ensure `mobile-feed` is deployed and the blob store has posts |
| Live Activity won't start | Live Activities are disabled in iOS Settings ▸ Noteworthy, or the device is < iOS 16.2 |
| Remote updates don't arrive | `APNS_*` not set (M2), or device not paired, or wrong APNs environment vs build |

---

## 9. What still requires manual Apple setup

- Apple Developer App IDs + capabilities, signing Team, APNs `.p8` key.
- Marketing screenshots (the app icon is already a real NW-monogram treatment; swap in a designer mark later if desired).
- TestFlight upload (Xcode ▸ Archive ▸ Distribute).

### TestFlight checklist
> Full archive/upload runbook: [`IOS_TESTFLIGHT_PREP.md`](IOS_TESTFLIGHT_PREP.md).
- [x] App icon added (1024px NW monogram on navy, opaque)
- [x] Version/build set for first internal beta (`MARKETING_VERSION` 0.1.0 / `CURRENT_PROJECT_VERSION` 1 in `project.yml`)
- [ ] Team + signing set on all three targets (app, widget, NSE)
- [ ] `APNS_*` env vars set in Netlify (for push features, Milestone 2)
- [ ] Archive the `NoteworthyLive` scheme (Release) and validate
- [ ] Export compliance: app sets `ITSAppUsesNonExemptEncryption = false`
- [ ] Privacy nutrition labels filled in App Store Connect
- [ ] Distribute to TestFlight, smoke-test pairing + a live update end-to-end
