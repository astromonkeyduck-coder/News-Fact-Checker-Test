import SwiftUI
import Combine

/// Central navigation state: which tab is selected and any pending deep link.
/// Deep links (noteworthylive://story/<slug>) route to the Live tab and push a
/// native Story Detail for that slug.
@MainActor
final class AppRouter: ObservableObject {
    static let shared = AppRouter()

    enum Tab: Hashable { case home, live, search, saved, profile }

    @Published var selectedTab: Tab = .home

    /// Per-tab navigation paths so deep links and in-app taps push natively.
    @Published var homePath = NavigationPath()
    @Published var livePath = NavigationPath()
    @Published var searchPath = NavigationPath()
    @Published var savedPath = NavigationPath()

    /// A live-story slug from a deep link, consumed by the Live tab.
    @Published var pendingLiveSlug: String?

    func openLiveStory(slug: String) {
        selectedTab = .live
        livePath = NavigationPath()
        livePath.append(StoryRoute.live(slug: slug))
    }

    func handleDeepLink(_ url: URL) {
        guard url.scheme == Config.urlScheme, url.host == "story" else { return }
        let slug = url.pathComponents.last(where: { $0 != "/" }) ?? ""
        guard !slug.isEmpty else { return }
        openLiveStory(slug: slug)
    }
}

/// Routes pushed onto a NavigationStack path.
enum StoryRoute: Hashable {
    case post(FeedItem)
    case live(slug: String)
}
