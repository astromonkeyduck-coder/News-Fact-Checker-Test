import Foundation

/// Reads normalized editorial content from `mobile-feed` / `mobile-story`.
/// Returns the same `FeedItem` model whether the data is live or mock, so the
/// UI never branches on the source. Records the actual source in `DataMode`.
struct ContentService {
    static let shared = ContentService()

    enum Section: String { case all, breaking, alerts }

    private func mark(_ source: DataMode.Source, _ endpoint: String = "", _ error: String? = nil) async {
        await MainActor.run { DataMode.shared.record(source, endpoint: endpoint, error: error) }
    }

    /// Fetch a page of the feed.
    func feed(section: Section = .all, category: String? = nil,
              cursor: String? = nil, limit: Int = 30) async throws -> FeedPage {
        if AppConfig.useMockData {
            await mark(.mock)
            return MockData.feedPage(section: section, category: category)
        }
        do {
            var q = [URLQueryItem(name: "limit", value: String(limit)),
                     URLQueryItem(name: "section", value: section.rawValue)]
            if let category { q.append(URLQueryItem(name: "category", value: category)) }
            if let cursor { q.append(URLQueryItem(name: "cursor", value: cursor)) }
            let page: FeedPage = try await HTTP.get("mobile-feed", query: q)
            if page.items.isEmpty && cursor == nil && AppConfig.allowMockFallback {
                await mark(.fallback, "mobile-feed", "empty response")
                return MockData.feedPage(section: section, category: category)
            }
            await mark(.live, "mobile-feed")
            return page
        } catch {
            if AppConfig.allowMockFallback && cursor == nil {
                await mark(.fallback, "mobile-feed", (error as? LocalizedError)?.errorDescription ?? "\(error)")
                return MockData.feedPage(section: section, category: category)
            }
            await mark(.live, "mobile-feed", "\(error)")
            throw error
        }
    }

    /// Fetch a single normalized post for Story Detail.
    func story(id: String) async throws -> FeedItem {
        if AppConfig.useMockData {
            if let m = MockData.post(id: id) { await mark(.mock); return m }
        }
        do {
            struct Wrapper: Decodable { var story: FeedItem }
            let w: Wrapper = try await HTTP.get("mobile-story", query: [URLQueryItem(name: "id", value: id)])
            await mark(.live, "mobile-story")
            return w.story
        } catch {
            if AppConfig.allowMockFallback, let m = MockData.post(id: id) {
                await mark(.fallback, "mobile-story", (error as? LocalizedError)?.errorDescription ?? "\(error)")
                return m
            }
            throw error
        }
    }
}
