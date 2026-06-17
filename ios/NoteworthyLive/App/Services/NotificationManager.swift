import Foundation
import UserNotifications
import UIKit
import Combine

/// Owns the system notification authorization state and the registration of
/// notification categories/actions. The actual APNs alert *dispatch* (standard
/// breaking/story pushes) is a Milestone 2 backend feature; this manager wires
/// the client side so the Notifications screen reflects true system state and
/// the right permission prompt timing.
@MainActor
final class NotificationManager: ObservableObject {
    static let shared = NotificationManager()

    @Published private(set) var authorizationStatus: UNAuthorizationStatus = .notDetermined

    private let center = UNUserNotificationCenter.current()

    /// Category identifiers used by rich notifications (M2 dispatch).
    enum Category {
        static let liveStory = "LIVE_STORY"
        static let breaking = "BREAKING"
    }

    func refresh() {
        center.getNotificationSettings { [weak self] settings in
            Task { @MainActor in self?.authorizationStatus = settings.authorizationStatus }
        }
    }

    /// Request authorization. Returns the granted result. Registers for remote
    /// notifications on success so the entitlement is active.
    @discardableResult
    func requestAuthorization() async -> Bool {
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
            await MainActor.run {
                if granted { UIApplication.shared.registerForRemoteNotifications() }
            }
            refresh()
            return granted
        } catch {
            refresh()
            return false
        }
    }

    /// Register notification categories + actions. Actions that require backend
    /// support not present in M1 (Follow/Save deep actions) are wired as
    /// foreground actions that open the app to the story; they are NOT faked as
    /// background mutations.
    func registerCategories() {
        let open = UNNotificationAction(identifier: "OPEN_STORY", title: "Read", options: [.foreground])
        let openLive = UNNotificationAction(identifier: "OPEN_LIVE", title: "Open Live Story", options: [.foreground])

        let live = UNNotificationCategory(identifier: Category.liveStory,
                                          actions: [openLive], intentIdentifiers: [], options: [])
        let breaking = UNNotificationCategory(identifier: Category.breaking,
                                              actions: [open], intentIdentifiers: [], options: [])
        center.setNotificationCategories([live, breaking])
    }

    func openSystemSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }
}
