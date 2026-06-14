import UIKit
import UserNotifications

/// Minimal app delegate: registers for remote notifications (required so the
/// Push Notifications / Live Activities entitlement is active) and bootstraps
/// the Live Activity manager + a heartbeat.
final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in
            DispatchQueue.main.async { application.registerForRemoteNotifications() }
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
        // Standard APNs device token is not required for Live Activities, which
        // use their own per-activity / push-to-start tokens. Kept for entitlement.
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("[APNs] registration failed: \(error.localizedDescription)")
    }
}
