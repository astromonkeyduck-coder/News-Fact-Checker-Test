import Foundation
import Combine

/// Runtime configuration for data sourcing. The app talks to the real public
/// endpoints by default; mock data exists only for SwiftUI previews, an explicit
/// `-UseMockData` mode, and (DEBUG only) a fallback so the UI is never a dead end
/// while the backend is unreachable. Mock never silently masquerades as live.
enum AppConfig {
    /// Force mock data for the whole app: launch with `-UseMockData`.
    static var useMockData: Bool {
        ProcessInfo.processInfo.arguments.contains("-UseMockData")
    }

    /// Strict live mode: launch with `-UseLiveData`. Disables the mock fallback
    /// so you see real data or a real empty/error state, never silent mock.
    static var strictLive: Bool {
        ProcessInfo.processInfo.arguments.contains("-UseLiveData")
    }

    /// When a live fetch fails or returns empty, fall back to mock so the UI is
    /// never a dead end during development. DEBUG-only, and never in strict-live.
    static var allowMockFallback: Bool {
        #if DEBUG
        return !strictLive
        #else
        return false
        #endif
    }

    /// Polling cadence for an open live story timeline (seconds).
    static let liveStoryPollInterval: TimeInterval = 20
}

/// DEBUG-only observable that records which data source the app is actually
/// showing (Live / Mock / Fallback), the API base URL, and the last error when
/// a fallback occurs. Surfaced in the Profile > Developer section under `#if DEBUG`
/// so mock content can never be mistaken for live. Compiled in all configs (the
/// type is tiny and inert in Release), but only read by DEBUG UI.
@MainActor
final class DataMode: ObservableObject {
    static let shared = DataMode()

    enum Source: String { case live = "Live", mock = "Mock", fallback = "Fallback (mock)" }

    @Published private(set) var source: Source = .live
    @Published private(set) var lastError: String?
    let baseURL: String = Config.functionsBase.absoluteString

    /// Record the outcome of a fetch. `loud` triggers a console warning in DEBUG.
    func record(_ source: Source, endpoint: String = "", error: String? = nil) {
        self.source = source
        if let error { self.lastError = "\(endpoint): \(error)" }
        #if DEBUG
        if source == .fallback {
            print("⚠️ [DataMode] FALLBACK to mock — \(endpoint) failed at \(baseURL): \(error ?? "empty"). " +
                  "Showing MOCK data (DEBUG only). Launch with -UseLiveData to disable fallback.")
        }
        #endif
    }
}
