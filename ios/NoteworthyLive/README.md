# Noteworthy Live — iOS companion app

A deliberately thin SwiftUI app. Its only job is to unlock native Apple surfaces
(ActivityKit Live Activities, Dynamic Island, Lock Screen) for stories the user
already follows on noteworthynews.com. It does **not** render articles — taps
open the website's `/story/<slug>` page in an in-app browser.

## What it does
1. User follows live stories on the web/PWA (anonymous, keyed by web-push endpoint).
2. User opens **Notification settings → Open in the iOS app** on the website to get a 6-char pairing code.
3. App redeems the code (`device-link`), which links the device to the same `subscriber_key` and returns the followed stories.
4. App registers APNs tokens (`device-register`): per-activity update tokens and, on iOS 17.2+, a push-to-start token.
5. When an editor posts an update, the backend updates web push subscribers **and** the iOS Live Activities (`lib/liveActivityNotify.js` → APNs).
6. Tapping the Live Activity opens `noteworthylive://story/<slug>` → the app shows `https://noteworthynews.co/story/<slug>`.

## Source layout
```
ios/NoteworthyLive/
  App/                     App target (SwiftUI)
    NoteworthyLiveApp.swift, AppDelegate.swift, Config.swift
    APIClient.swift, Keychain.swift, DeviceIdentity.swift, LiveActivityManager.swift
    Views/ (RootView, PairingView, FollowedStoriesView, SafariView)
  Widget/                  Widget extension (Live Activity UI only)
    LiveStoryWidgetBundle.swift, LiveStoryLiveActivity.swift
  Shared/                  Membership in BOTH targets
    LiveStoryAttributes.swift, StatusStyle.swift, DeepLink.swift
  SupportingFiles/         Info.plist keys + entitlements to merge in Xcode
```

## Xcode setup (one-time, project file is not committed)
1. Create an iOS App project named `NoteworthyLive`, SwiftUI lifecycle, minimum deployment **iOS 16.2**. Add the files in `App/`.
2. File → New → Target → **Widget Extension** named `LiveStoryWidget` (check "Include Live Activity"). Replace its template with the files in `Widget/`.
3. Add the three files in `Shared/` to **both** targets (Target Membership: app + widget).
4. Bundle IDs: app `co.noteworthynews.live`, widget `co.noteworthynews.live.LiveStoryWidget`. (If you change these, update `APNS_BUNDLE_ID`.)
5. Capabilities (app target): **Push Notifications**; merge `SupportingFiles/App-Info.plist` keys (`NSSupportsLiveActivities`, URL scheme, background mode) and add `SupportingFiles/NoteworthyLive.entitlements`.
6. Signing: automatic. Debug/TestFlight → APNs **sandbox**; App Store → production. `Config.apnsEnvironment` follows the build config and is sent to the backend, which routes to the matching APNs host.

## Backend dependency
Requires the Phase 2 backend (already in this repo):
`device-link.js`, `device-register.js`, `device-live-stories.js`, `lib/liveActivityNotify.js`, `lib/apnsClient.js`, migration `006_create_ios_devices.sql`, and the APNS_* env vars (see repo `ENV_KEYS.md`).

## Notes / limits (honest)
- iOS 16.2–17.1: the app starts Live Activities locally (when the user taps "Start Live Activity" or when paired). The backend updates/ends them remotely.
- iOS 17.2+: the backend can also remote-start a Live Activity for followed stories via the push-to-start token.
- Live Activities require the user to have the app installed and Live Activities enabled in Settings. There is no way to do this from the website alone.
