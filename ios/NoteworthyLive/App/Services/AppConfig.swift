import Foundation

/// Runtime configuration for data sourcing. The app talks to the real public
/// endpoints by default; mock data exists so every screen looks shipped before
/// the backend has content (and for SwiftUI previews / demos).
enum AppConfig {
    /// Force mock data for the whole app. Toggle by launching with the
    /// `-UseMockData` argument (Scheme > Run > Arguments) or flip the DEBUG
    /// default below while iterating on UI.
    static var useMockData: Bool {
        if ProcessInfo.processInfo.arguments.contains("-UseMockData") { return true }
        if ProcessInfo.processInfo.arguments.contains("-UseLiveData") { return false }
        return false
    }

    /// When a live fetch fails or returns empty, fall back to mock so the UI is
    /// never a dead end during development. Off in release builds.
    static var allowMockFallback: Bool {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }

    /// Polling cadence for an open live story timeline (seconds).
    static let liveStoryPollInterval: TimeInterval = 20
}
