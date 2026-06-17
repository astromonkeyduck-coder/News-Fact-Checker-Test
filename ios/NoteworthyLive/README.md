# Noteworthy News, iOS app

The flagship native SwiftUI reader for Noteworthy News. Not a WebView, not React
Native, not a wrapper, a real Apple-native app. The website remains the
production content engine and newsroom; this app is the premium reader plus the
signature Live Activities / Dynamic Island experience.

Full setup, signing, and TestFlight steps: see [`../../IOS_APP_SETUP.md`](../../IOS_APP_SETUP.md).
Deferred work (standard APNs push, NSE, hardening): [`../../IOS_M2_BACKLOG.md`](../../IOS_M2_BACKLOG.md).

## What it does (Milestone 1)
- **Home**, breaking hero, "Developing Now" live rail, latest feed, pull-to-refresh, skeleton/empty/error/offline states.
- **Live**, active + followed live stories, status chips, Follow Live, Start/Stop Live Activity.
- **Story Detail**, headline, summary/body, source, live timeline (polls), Follow, Live Activity, Save, Share, Open on web.
- **Saved**, device-local saved stories.
- **Explore**, topic chips, client-side search, recent searches (server search is M2).
- **Notifications**, system permission + Live Activity availability, alert toggles, quiet hours (synced server-side in M2).
- **Profile / Pairing**, redeem a website pairing code, Keychain-stored device secret, paired state, unlink.
- **Live Activities**, Lock Screen + Dynamic Island for all story statuses, deep-linking into the exact story.

The app is fully usable **without pairing or APNs**, it falls back to realistic mock data so every screen looks shipped before the backend has content.

## How content flows
- Editorial feed/detail: `mobile-feed` / `mobile-story` (normalized, read-only) via `ContentService`.
- Live stories + timeline: public `live-stories` via `LiveService`.
- Following + Live Activity tokens (paired devices): `device-link` / `device-register` / `device-live-stories` via `APIClient`.
- Live Activity payloads share `Shared/LiveStoryAttributes.swift` with `netlify/functions/lib/liveActivityNotify.js` byte-for-byte.

## Source layout
```
ios/NoteworthyLive/
  project.yml                 XcodeGen project (app + LiveStoryWidget + NotificationServiceExtension)
  App/
    NoteworthyLiveApp.swift, AppDelegate.swift, RootView (gate)
    Config.swift, APIClient.swift, Keychain.swift, DeviceIdentity.swift, LiveActivityManager.swift
    DesignSystem/             Theme, Typography, Spacing, Haptics, Components/
    Models/                   FeedItem, LiveStory, SavedItem, NotificationPreferences
    Services/                 ContentService, LiveService, HTTP, MockData, SavedStore,
                              Reachability, NotificationManager, AppRouter, AppConfig
    Support/                  Formatters, LoadState, ShareSheet
    Features/                 Onboarding, Home, Live, StoryDetail, Saved, Search, Notifications, Profile
    Views/                    PairingView, SafariView
    Resources/                Assets.xcassets (AppIcon placeholder, AccentColor, LaunchBackground)
  Widget/                     Live Activity UI (LiveStoryWidgetBundle, LiveStoryLiveActivity)
  NotificationServiceExtension/  NSE scaffold (pass-through in M1; rich media in M2)
  Shared/                     In BOTH app + widget targets: LiveStoryAttributes, StatusStyle, DeepLink
  SupportingFiles/            Info.plist, Widget-Info.plist, NotificationService-Info.plist, entitlements
```

## Build
```bash
brew install xcodegen
cd ios/NoteworthyLive && xcodegen generate && open NoteworthyLive.xcodeproj
```
Bundle IDs: app `co.noteworthynews.live`, widget `co.noteworthynews.live.LiveStoryWidget`. Minimum iOS 16.2.

## Honest platform limits
- Live Activities require the installed app + Live Activities enabled in Settings; there's no web-only path.
- iOS 16.2-17.1: the app starts Live Activities locally; the backend updates/ends them remotely.
- iOS 17.2+: the backend can also remote-start via push-to-start.
- Standard breaking/story push notifications and rich (image) notifications are Milestone 2 (`APNS_*` env vars + Notification Service Extension).
