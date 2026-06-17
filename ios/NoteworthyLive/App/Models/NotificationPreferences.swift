import Foundation
import Combine

/// User-facing notification preferences. Stored locally for instant UI and
/// synced to the backend (Milestone 2C) so the newsroom honors them per device
/// when dispatching standard APNs pushes.
struct NotificationPreferences: Codable, Equatable {
    var masterEnabled: Bool = true
    var breakingNews: Bool = true
    var liveStoryUpdates: Bool = true
    /// Final / resolution updates (story closes, correction issued).
    var finalUpdates: Bool = true
    /// Allow Time-Sensitive interruption for genuinely urgent/final updates only.
    var allowTimeSensitive: Bool = true
    var quietHoursEnabled: Bool = false
    var quietHoursStartHour: Int = 22  // 10 PM
    var quietHoursEndHour: Int = 7     // 7 AM

    /// Payload sent to device-register {action:"preferences"}. Keys match the
    /// backend sanitizer in netlify/functions/device-register.js.
    var serverPayload: [String: Any] {
        [
            "masterEnabled": masterEnabled,
            "breakingEnabled": breakingNews,
            "liveUpdatesEnabled": liveStoryUpdates,
            "finalEnabled": finalUpdates,
            "timeSensitiveEnabled": allowTimeSensitive,
            "quietHoursEnabled": quietHoursEnabled,
            "quietHoursStart": quietHoursStartHour,
            "quietHoursEnd": quietHoursEndHour,
            "utcOffsetMinutes": TimeZone.current.secondsFromGMT() / 60,
        ]
    }
}

/// Result of the most recent server preference sync, surfaced honestly in the UI.
enum PrefSyncState: Equatable {
    case idle
    case pending
    case synced
    case failed
}

@MainActor
final class NotificationPreferencesStore: ObservableObject {
    static let shared = NotificationPreferencesStore()

    @Published var prefs: NotificationPreferences {
        didSet {
            persist()
            if prefs != oldValue { scheduleSync() }
        }
    }

    @Published private(set) var syncState: PrefSyncState = .idle

    private let key = "notification_preferences_v1"
    private var syncTask: Task<Void, Never>?

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

    /// Debounced sync: collapses rapid toggle changes into one network write.
    private func scheduleSync() {
        // deviceSecret is written synchronously at pairing (isPaired is published async).
        guard DeviceIdentity.shared.deviceSecret != nil else { return }
        syncState = .pending
        syncTask?.cancel()
        let snapshot = prefs
        syncTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 700_000_000) // 0.7s debounce
            if Task.isCancelled { return }
            await self?.send(snapshot)
        }
    }

    /// Force an immediate sync (e.g. right after pairing). No-op if unpaired.
    func syncNow() async throws {
        guard DeviceIdentity.shared.deviceSecret != nil else { return }
        syncTask?.cancel()
        await send(prefs)
    }

    private func send(_ snapshot: NotificationPreferences) async {
        syncState = .pending
        do {
            try await APIClient.shared.syncPreferences(snapshot)
            // Only mark synced if nothing changed while the request was in flight.
            syncState = (snapshot == prefs) ? .synced : .pending
        } catch {
            syncState = .failed
        }
    }
}
