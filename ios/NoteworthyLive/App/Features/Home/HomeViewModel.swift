import Foundation
import Combine

@MainActor
final class HomeViewModel: ObservableObject {
    @Published var state: LoadState<[FeedItem]> = .idle
    @Published var liveStories: [LiveStory] = []
    @Published var loadingMore = false

    private var nextCursor: String?
    private var hasLoadedOnce = false

    /// Top-of-feed hero: always the newest post in the loaded feed.
    var heroPost: FeedItem? {
        state.value?.first
    }

    /// True when the feed loaded successfully but has nothing to show
    /// (no posts and no live stories) so Home can render an empty state
    /// instead of a bare masthead.
    var isEmpty: Bool {
        (state.value?.isEmpty ?? true) && liveStories.isEmpty
    }

    /// Feed minus the hero item (so it doesn't appear twice).
    var latest: [FeedItem] {
        guard let items = state.value else { return [] }
        guard let hero = heroPost else { return items }
        return items.filter { $0.id != hero.id }
    }

    func loadIfNeeded() async {
        guard !hasLoadedOnce else { return }
        await refresh()
    }

    func refresh() async {
        if state.value == nil { state = .loading }
        async let feedTask = ContentService.shared.feed(section: .all, limit: 30)
        async let liveTask = LiveService.shared.activeStories()

        do {
            let page = try await feedTask
            nextCursor = page.nextCursor
            state = .loaded(page.items)
            hasLoadedOnce = true
        } catch {
            if state.value == nil {
                state = .failed((error as? LocalizedError)?.errorDescription ?? "Couldn't load the feed.")
            }
        }
        // Live rail failure is non-fatal, just hide the rail.
        liveStories = (try? await liveTask) ?? []
    }

    func loadMore() async {
        guard let cursor = nextCursor, !loadingMore, var current = state.value else { return }
        loadingMore = true
        defer { loadingMore = false }
        do {
            let page = try await ContentService.shared.feed(section: .all, cursor: cursor, limit: 30)
            current.append(contentsOf: page.items)
            nextCursor = page.nextCursor
            state = .loaded(current)
        } catch {
            // Keep what we have; pagination errors are silent.
        }
    }
}
