import Foundation
import Combine

/// User-facing notification preferences. In M1 these are stored locally and
/// drive the in-app UI; server-side sync (so the backend honors per-device
/// preferences) ships in M2 alongside standard-APNs device-token registration.
struct NotificationPreferences: Codable, Equatable {
    var masterEnabled: Bool = true
    var breakingNews: Bool = true
    var liveStoryUpdates: Bool = true
    /// Allow Time-Sensitive interruption for genuinely urgent/final updates only.
    var allowTimeSensitive: Bool = true
    var quietHoursEnabled: Bool = false
    var quietHoursStartHour: Int = 22  // 10 PM
    var quietHoursEndHour: Int = 7     // 7 AM
}

@MainActor
final class NotificationPreferencesStore: ObservableObject {
    static let shared = NotificationPreferencesStore()

    @Published var prefs: NotificationPreferences {
        didSet { persist() }
    }

    private let key = "notification_preferences_v1"

    init() {
        if let data = UserDefaults.standard.data(forKey: key),
           let decoded = try? JSONDecoder().decode(NotificationPreferences.self, from: data) {
            prefs = decoded
        } else {
            prefs = NotificationPreferences()
        }
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(prefs) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
}
