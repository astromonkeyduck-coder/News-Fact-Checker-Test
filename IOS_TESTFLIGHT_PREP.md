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

- **Push alerts are not live yet.** Notification preferences can be set, but no breaking/story push is delivered in this build.
- **Standard APNs notifications** (breaking/story alerts, device-token registration, dispatch) are **Milestone 2**.
- **Remote Live Activity updates** (push-to-start, server-driven timeline updates) are **Milestone 2**. Live Activities you start locally work now and update only locally.
- **Notification Service Extension** is a safe pass-through (rich media / grouping is Milestone 2).
- **Notification preferences and quiet hours are device-local** for now and do not yet sync to the newsroom.
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
