import Foundation

/// Reads public live stories and their timelines, and (when the device is
/// paired) manages follows through the device-auth endpoints. Following from
/// iOS requires pairing because follows are keyed to a web subscriber, we
/// surface `.notPaired` rather than faking it.
struct LiveService {
    static let shared = LiveService()

    enum LiveError: LocalizedError {
        case notPaired
        var errorDescription: String? {
            switch self {
            case .notPaired: return "Link this iPhone to follow live stories."
            }
        }
    }

    private func mark(_ source: DataMode.Source, _ endpoint: String = "", _ error: String? = nil) async {
        await MainActor.run { DataMode.shared.record(source, endpoint: endpoint, error: error) }
    }

    /// Active (non-resolved) live stories for the Live screen + Home rail.
    func activeStories(includeResolved: Bool = false) async throws -> [LiveStory] {
        if AppConfig.useMockData { await mark(.mock); return MockData.liveStories }
        do {
            struct Wrapper: Decodable { var stories: [LiveStory] }
            var q: [URLQueryItem] = []
            if includeResolved { q.append(URLQueryItem(name: "includeResolved", value: "true")) }
            let w: Wrapper = try await HTTP.get("live-stories", query: q)
            if w.stories.isEmpty && AppConfig.allowMockFallback {
                await mark(.fallback, "live-stories", "empty response")
                return MockData.liveStories
            }
            await mark(.live, "live-stories")
            return w.stories
        } catch {
            if AppConfig.allowMockFallback {
                await mark(.fallback, "live-stories", (error as? LocalizedError)?.errorDescription ?? "\(error)")
                return MockData.liveStories
            }
            throw error
        }
    }

    /// Story + timeline for Story Detail.
    func detail(slug: String) async throws -> LiveStoryDetail {
        if AppConfig.useMockData, let d = MockData.liveDetail(slug: slug) { await mark(.mock); return d }
        do {
            let d: LiveStoryDetail = try await HTTP.get("live-stories", query: [URLQueryItem(name: "slug", value: slug)])
            await mark(.live, "live-stories")
            return d
        } catch {
            if AppConfig.allowMockFallback, let d = MockData.liveDetail(slug: slug) {
                await mark(.fallback, "live-stories", (error as? LocalizedError)?.errorDescription ?? "\(error)")
                return d
            }
            throw error
        }
    }

    /// Slugs the paired device currently follows (empty if not paired).
    func followedSlugs() async -> Set<String> {
        guard DeviceIdentity.shared.isPaired else { return [] }
        do {
            let follows = try await APIClient.shared.listFollows()
            return Set(follows.map { $0.slug })
        } catch {
            return []
        }
    }

    func follow(slug: String) async throws {
        guard DeviceIdentity.shared.isPaired else { throw LiveError.notPaired }
        try await APIClient.shared.follow(slug: slug)
    }

    func unfollow(slug: String) async throws {
        guard DeviceIdentity.shared.isPaired else { throw LiveError.notPaired }
        try await APIClient.shared.unfollow(slug: slug)
    }
}
