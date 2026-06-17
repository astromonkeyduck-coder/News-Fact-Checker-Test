import Foundation
import Combine

@MainActor
final class LiveViewModel: ObservableObject {
    @Published var state: LoadState<[LiveStory]> = .idle
    @Published var followedSlugs: Set<String> = []
    @Published var actionError: String?

    private var hasLoadedOnce = false

    /// Followed stories float to the top.
    var followed: [LiveStory] {
        (state.value ?? []).filter { followedSlugs.contains($0.slug) }
    }
    var others: [LiveStory] {
        (state.value ?? []).filter { !followedSlugs.contains($0.slug) }
    }

    func loadIfNeeded() async {
        guard !hasLoadedOnce else { return }
        await refresh()
    }

    func refresh() async {
        if state.value == nil { state = .loading }
        do {
            let stories = try await LiveService.shared.activeStories()
            state = .loaded(stories)
            hasLoadedOnce = true
        } catch {
            if state.value == nil {
                state = .failed((error as? LocalizedError)?.errorDescription ?? "Couldn't load live stories.")
            }
        }
        followedSlugs = await LiveService.shared.followedSlugs()
    }

    func toggleFollow(_ story: LiveStory) async {
        let isFollowing = followedSlugs.contains(story.slug)
        do {
            if isFollowing {
                try await LiveService.shared.unfollow(slug: story.slug)
                followedSlugs.remove(story.slug)
                Haptics.select()
            } else {
                try await LiveService.shared.follow(slug: story.slug)
                followedSlugs.insert(story.slug)
                Haptics.success()
            }
        } catch {
            actionError = (error as? LocalizedError)?.errorDescription ?? "Couldn't update follow."
            Haptics.warning()
        }
    }
}
