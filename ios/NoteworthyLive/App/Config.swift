import Foundation

enum Config {
    /// Public website that hosts the live story pages and Netlify Functions.
    static let webBaseURL = URL(string: "https://noteworthynews.co")!
    static var functionsBase: URL { webBaseURL.appendingPathComponent(".netlify/functions") }

    /// Custom URL scheme used by Live Activity deep links so taps reopen the app
    /// and show the matching /story/<slug> page in an in-app browser.
    /// Defined in Shared/DeepLink.swift so the widget extension shares it.
    static let urlScheme = LiveStoryDeepLink.scheme

    static func storyWebURL(slug: String) -> URL {
        webBaseURL.appendingPathComponent("story").appendingPathComponent(slug)
    }

    static func deepLink(slug: String) -> URL {
        LiveStoryDeepLink.url(slug: slug)
    }

    /// APNs environment must match the build: debug builds use sandbox.
    static var apnsEnvironment: String {
        #if DEBUG
        return "sandbox"
        #else
        return "production"
        #endif
    }

    static var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0"
    }
}
