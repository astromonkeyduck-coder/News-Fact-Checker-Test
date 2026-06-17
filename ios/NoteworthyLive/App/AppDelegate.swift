import UIKit
import UserNotifications

/// App delegate: bootstraps the Live Activity manager, registers notification
/// categories, and routes notification taps to the right story. It does NOT
/// request notification authorization at launch, that prompt is shown at the
/// right moment during onboarding (or from the Notifications screen).
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        NotificationManager.shared.registerCategories()

        // If the user already granted notifications, keep the remote-notification
        // registration warm so Live Activity entitlements stay active.
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            if settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional {
                DispatchQueue.main.async { application.registerForRemoteNotifications() }
            }
        }

        Task { @MainActor in
            LiveActivityManager.shared.bootstrap()
            if DeviceIdentity.shared.isPaired {
                try? await APIClient.shared.heartbeat()
            }
        }
        return true
    }

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        // Standard APNs device token. M1 does not register it server-side
        // (standard breaking/story push dispatch is a Milestone 2 backend feature).
        // Live Activities use their own per-activity / push-to-start tokens.
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        print("[APNs] device token: \(hex.prefix(12))… (server registration is M2)")
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("[APNs] registration failed: \(error.localizedDescription)")
    }

    // MARK: UNUserNotificationCenterDelegate

    /// Show banners while the app is foregrounded.
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .badge]
    }

    /// Route a notification tap to the matching story.
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse) async {
        let info = response.notification.request.content.userInfo
        if let slug = (info["slug"] as? String) ?? slug(fromURL: info["url"]) {
            await MainActor.run { AppRouter.shared.openLiveStory(slug: slug) }
        }
        await MainActor.run { UIApplication.shared.applicationIconBadgeNumber = 0 }
    }

    private func slug(fromURL value: Any?) -> String? {
        guard let s = value as? String, let url = URL(string: s) else { return nil }
        // Accept noteworthylive://story/<slug> or https://…/story/<slug>
        let parts = url.pathComponents.filter { $0 != "/" }
        if let idx = parts.firstIndex(of: "story"), idx + 1 < parts.count { return parts[idx + 1] }
        return url.host == "story" ? parts.last : nil
    }
}
