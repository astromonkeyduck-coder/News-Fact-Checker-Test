import Foundation
import Combine

@MainActor
final class HomeViewModel: ObservableObject {
    @Published var state: LoadState<[FeedItem]> = .idle
    @Published var liveStories: [LiveStory] = []
    @Published var loadingMore = false

    private var nextCursor: String?
    private var hasLoadedOnce = false

    var topBreaking: FeedItem? {
        state.value?.first { $0.isBreaking }
    }

    /// Feed minus the hero breaking item (so it doesn't appear twice).
    var latest: [FeedItem] {
        guard let items = state.value else { return [] }
        guard let hero = topBreaking else { return items }
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
