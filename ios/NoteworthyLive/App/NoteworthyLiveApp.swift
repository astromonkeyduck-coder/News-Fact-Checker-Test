import SwiftUI
import UIKit
import CoreText

@main
struct NoteworthyLiveApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    init() { BrandFonts.registerIfNeeded() }

    @StateObject private var identity = DeviceIdentity.shared
    @StateObject private var router = AppRouter.shared
    @StateObject private var saved = SavedStore.shared
    @StateObject private var prefs = NotificationPreferencesStore.shared
    @StateObject private var reachability = Reachability.shared
    @StateObject private var notifications = NotificationManager.shared
    @StateObject private var live = LiveActivityManager.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(identity)
                .environmentObject(router)
                .environmentObject(saved)
                .environmentObject(prefs)
                .environmentObject(reachability)
                .environmentObject(notifications)
                .environmentObject(live)
                .tint(NT.Palette.accent)
                .preferredColorScheme(.dark)
                .onOpenURL { router.handleDeepLink($0) }
                .task { notifications.refresh() }
        }
    }
}

/// Registers the Noteworthy brand fonts (Sora, Source Serif 4, Inter) at launch.
///
/// The .ttf files ship as Data Sets inside Assets.xcassets, so they're bundled
/// without any project/Info.plist changes, and we register them at runtime with
/// Core Text. After this runs, `Font.custom("<PostScript name>", …)` resolves.
/// PostScript names (verified from the shipped files): Sora-SemiBold, Sora-Bold,
/// Sora-ExtraBold, SourceSerif4-Regular, SourceSerif4-SemiBold, Inter-Medium,
/// Inter-SemiBold.
enum BrandFonts {
    private static let dataAssetNames = [
        "Sora-SemiBold", "Sora-Bold", "Sora-ExtraBold",
        "SourceSerif4-Regular", "SourceSerif4-SemiBold",
        "Inter-Medium", "Inter-SemiBold",
    ]
    private static var didRegister = false

    static func registerIfNeeded() {
        guard !didRegister else { return }
        didRegister = true
        for name in dataAssetNames {
            guard let asset = NSDataAsset(name: name),
                  let provider = CGDataProvider(data: asset.data as CFData),
                  let font = CGFont(provider) else { continue }
            var error: Unmanaged<CFError>?
            if !CTFontManagerRegisterGraphicsFont(font, &error) {
                error?.release()
            }
        }
    }
}
