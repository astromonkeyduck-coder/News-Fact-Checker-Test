import Foundation

/// A normalized feed/story item from `mobile-feed` / `mobile-story`.
/// Decoding is defensive: the backend normalizes the messy blob shape, but
/// `id` can still be null for some legacy posts, so we derive a stable fallback
/// so SwiftUI diffing and Saved matching stay consistent across reloads.
struct FeedItem: Identifiable, Codable, Hashable {
    let id: String
    var kind: String
    var title: String
    var summary: String?
    var imageUrl: String?
    var videoUrl: String?
    var category: String?
    var source: String?
    var sourceUrl: String?
    var webUrl: String?
    var publishedAt: String?
    var isBreaking: Bool
    var isAlert: Bool
    var isVideo: Bool
    var magnitude: Double?
    var bodyText: String?

    enum CodingKeys: String, CodingKey {
        case id, kind, title, summary, imageUrl, videoUrl, category, source
        case sourceUrl, webUrl, publishedAt, isBreaking, isAlert, isVideo, magnitude, bodyText
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let rawId = try c.decodeIfPresent(String.self, forKey: .id)
        let title = (try c.decodeIfPresent(String.self, forKey: .title)) ?? "Untitled"
        let web = try c.decodeIfPresent(String.self, forKey: .webUrl)
        self.title = title
        self.webUrl = web
        self.id = rawId ?? web ?? "feed-\(abs(title.hashValue))"
        self.kind = (try c.decodeIfPresent(String.self, forKey: .kind)) ?? "post"
        self.summary = try c.decodeIfPresent(String.self, forKey: .summary)
        self.imageUrl = try c.decodeIfPresent(String.self, forKey: .imageUrl)
        self.videoUrl = try c.decodeIfPresent(String.self, forKey: .videoUrl)
        self.category = try c.decodeIfPresent(String.self, forKey: .category)
        self.source = try c.decodeIfPresent(String.self, forKey: .source)
        self.sourceUrl = try c.decodeIfPresent(String.self, forKey: .sourceUrl)
        self.publishedAt = try c.decodeIfPresent(String.self, forKey: .publishedAt)
        self.isBreaking = (try c.decodeIfPresent(Bool.self, forKey: .isBreaking)) ?? false
        self.isAlert = (try c.decodeIfPresent(Bool.self, forKey: .isAlert)) ?? false
        self.isVideo = (try c.decodeIfPresent(Bool.self, forKey: .isVideo)) ?? false
        self.magnitude = try c.decodeIfPresent(Double.self, forKey: .magnitude)
        self.bodyText = try c.decodeIfPresent(String.self, forKey: .bodyText)
    }

    /// Memberwise init for mock data and previews.
    init(id: String, title: String, summary: String? = nil, imageUrl: String? = nil,
         videoUrl: String? = nil, category: String? = nil, source: String? = nil,
         sourceUrl: String? = nil, webUrl: String? = nil, publishedAt: String? = nil,
         isBreaking: Bool = false, isAlert: Bool = false, isVideo: Bool = false,
         magnitude: Double? = nil, bodyText: String? = nil, kind: String = "post") {
        self.id = id
        self.kind = kind
        self.title = title
        self.summary = summary
        self.imageUrl = imageUrl
        self.videoUrl = videoUrl
        self.category = category
        self.source = source
        self.sourceUrl = sourceUrl
        self.webUrl = webUrl
        self.publishedAt = publishedAt
        self.isBreaking = isBreaking
        self.isAlert = isAlert
        self.isVideo = isVideo
        self.magnitude = magnitude
        self.bodyText = bodyText
    }

    /// Absolute web URL for sharing / "Open web version".
    var absoluteWebURL: URL? {
        guard let web = webUrl else { return Config.webBaseURL }
        if web.hasPrefix("http") { return URL(string: web) }
        return URL(string: web, relativeTo: Config.webBaseURL)?.absoluteURL
    }
}

/// One page of feed results.
struct FeedPage: Codable {
    var items: [FeedItem]
    var nextCursor: String?
    var total: Int?
}
