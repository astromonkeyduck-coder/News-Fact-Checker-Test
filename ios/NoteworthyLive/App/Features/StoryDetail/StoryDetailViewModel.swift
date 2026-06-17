import Foundation
import Combine

/// What a Story Detail screen was opened with.
enum StoryDetailSource: Hashable {
    case post(FeedItem)
    case live(slug: String)
}

@MainActor
final class StoryDetailViewModel: ObservableObject {
    @Published var post: FeedItem?
    @Published var liveStory: LiveStory?
    @Published var updates: [LiveUpdate] = []
    @Published var state: LoadState<Bool> = .idle
    @Published var followed = false
    @Published var actionError: String?

    let source: StoryDetailSource

    var isLive: Bool {
        if case .live = source { return true }
        return false
    }

    /// A web URL for share / open-in-browser.
    var webURL: URL? {
        switch source {
        case .post(let item): return (post ?? item).absoluteWebURL
        case .live(let slug): return Config.storyWebURL(slug: slug)
        }
    }

    var slug: String? {
        switch source {
        case .live(let slug): return slug
        case .post: return liveStory?.slug
        }
    }

    init(source: StoryDetailSource) {
        self.source = source
        if case .post(let item) = source { self.post = item }
    }

    func load() async {
        if state.value == nil { state = .loading }
        switch source {
        case .post(let item):
            do {
                let full = try await ContentService.shared.story(id: item.id)
                post = full
                state = .loaded(true)
            } catch {
                // Fall back to the summary we already have from the feed.
                if post != nil { state = .loaded(true) }
                else { state = .failed("Couldn't load this story.") }
            }
        case .live(let slug):
            do {
                let detail = try await LiveService.shared.detail(slug: slug)
                liveStory = detail.story
                updates = detail.updates
                state = .loaded(true)
                followed = await LiveService.shared.followedSlugs().contains(slug)
            } catch {
                state = .failed("Couldn't load this live story.")
            }
        }
    }

    /// Lightweight refresh used by the live polling loop (no skeleton flash).
    func poll() async {
        guard case .live(let slug) = source else { return }
        if let detail = try? await LiveService.shared.detail(slug: slug) {
            liveStory = detail.story
            updates = detail.updates
        }
    }

    func toggleFollow() async {
        guard let slug = slug else { return }
        do {
            if followed {
                try await LiveService.shared.unfollow(slug: slug)
                followed = false
                Haptics.select()
            } else {
                try await LiveService.shared.follow(slug: slug)
                followed = true
                Haptics.success()
            }
        } catch {
            actionError = (error as? LocalizedError)?.errorDescription ?? "Couldn't update follow."
            Haptics.warning()
        }
    }
}
