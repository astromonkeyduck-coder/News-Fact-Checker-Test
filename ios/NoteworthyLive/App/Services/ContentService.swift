import Foundation

/// Reads normalized editorial content from `mobile-feed` / `mobile-story`.
/// Returns the same `FeedItem` model whether the data is live or mock, so the
/// UI never branches on the source.
struct ContentService {
    static let shared = ContentService()

    enum Section: String { case all, breaking, alerts }

    /// Fetch a page of the feed.
    func feed(section: Section = .all, category: String? = nil,
              cursor: String? = nil, limit: Int = 30) async throws -> FeedPage {
        if AppConfig.useMockData {
            return MockData.feedPage(section: section, category: category)
        }
        do {
            var q = [URLQueryItem(name: "limit", value: String(limit)),
                     URLQueryItem(name: "section", value: section.rawValue)]
            if let category { q.append(URLQueryItem(name: "category", value: category)) }
            if let cursor { q.append(URLQueryItem(name: "cursor", value: cursor)) }
            let page: FeedPage = try await HTTP.get("mobile-feed", query: q)
            if page.items.isEmpty && cursor == nil && AppConfig.allowMockFallback {
                return MockData.feedPage(section: section, category: category)
            }
            return page
        } catch {
            if AppConfig.allowMockFallback && cursor == nil {
                return MockData.feedPage(section: section, category: category)
            }
            throw error
        }
    }

    /// Fetch a single normalized post for Story Detail.
    func story(id: String) async throws -> FeedItem {
        if AppConfig.useMockData {
            if let m = MockData.post(id: id) { return m }
        }
        do {
            struct Wrapper: Decodable { var story: FeedItem }
            let w: Wrapper = try await HTTP.get("mobile-story", query: [URLQueryItem(name: "id", value: id)])
            return w.story
        } catch {
            if AppConfig.allowMockFallback, let m = MockData.post(id: id) { return m }
            throw error
        }
    }
}
