import Foundation

/// A live story from the public `live-stories` endpoint (and device list).
/// Snake_case backend keys are mapped; optional aggregates (`updateCount`,
/// `latestHeadline`) come from different endpoints so they're all optional.
struct LiveStory: Identifiable, Codable, Hashable {
    let id: String
    var slug: String
    var title: String
    var summary: String?
    var status: String
    var category: String?
    var severity: Int
    var confidence: String?
    var pinned: Bool?
    var followerCount: Int?
    var lastUpdateAt: String?
    var createdAt: String?
    var latestHeadline: String?
    var updateCount: Int?

    enum CodingKeys: String, CodingKey {
        case id, slug, title, summary, status, category, severity, confidence, pinned
        case followerCount = "follower_count"
        case lastUpdateAt = "last_update_at"
        case createdAt = "created_at"
        case latestHeadline
        case updateCount
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        // id may arrive as a UUID string; slug is always present.
        self.slug = (try c.decodeIfPresent(String.self, forKey: .slug)) ?? ""
        self.id = (try c.decodeIfPresent(String.self, forKey: .id)) ?? slug
        self.title = (try c.decodeIfPresent(String.self, forKey: .title)) ?? "Live story"
        self.summary = try c.decodeIfPresent(String.self, forKey: .summary)
        self.status = (try c.decodeIfPresent(String.self, forKey: .status)) ?? "developing"
        self.category = try c.decodeIfPresent(String.self, forKey: .category)
        self.severity = (try c.decodeIfPresent(Int.self, forKey: .severity)) ?? 3
        self.confidence = try c.decodeIfPresent(String.self, forKey: .confidence)
        self.pinned = try c.decodeIfPresent(Bool.self, forKey: .pinned)
        self.followerCount = try c.decodeIfPresent(Int.self, forKey: .followerCount)
        self.lastUpdateAt = try c.decodeIfPresent(String.self, forKey: .lastUpdateAt)
        self.createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        self.latestHeadline = try c.decodeIfPresent(String.self, forKey: .latestHeadline)
        self.updateCount = try c.decodeIfPresent(Int.self, forKey: .updateCount)
    }

    init(id: String, slug: String, title: String, summary: String? = nil, status: String,
         category: String? = nil, severity: Int = 3, confidence: String? = "medium",
         pinned: Bool? = nil, followerCount: Int? = nil, lastUpdateAt: String? = nil,
         createdAt: String? = nil, latestHeadline: String? = nil, updateCount: Int? = nil) {
        self.id = id; self.slug = slug; self.title = title; self.summary = summary
        self.status = status; self.category = category; self.severity = severity
        self.confidence = confidence; self.pinned = pinned; self.followerCount = followerCount
        self.lastUpdateAt = lastUpdateAt; self.createdAt = createdAt
        self.latestHeadline = latestHeadline; self.updateCount = updateCount
    }

    var isClosed: Bool { status == "resolved" || status == "false_report" }
}

/// A single timeline update for a live story.
struct LiveUpdate: Identifiable, Codable, Hashable {
    let id: String
    var body: String
    var kind: String
    var statusAtTime: String?
    var alertLevel: String?
    var sourceUrl: String?
    var sourceLabel: String?
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, body, kind
        case statusAtTime = "status_at_time"
        case alertLevel = "alert_level"
        case sourceUrl = "source_url"
        case sourceLabel = "source_label"
        case createdAt = "created_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.id = (try c.decodeIfPresent(String.self, forKey: .id)) ?? UUID().uuidString
        self.body = (try c.decodeIfPresent(String.self, forKey: .body)) ?? ""
        self.kind = (try c.decodeIfPresent(String.self, forKey: .kind)) ?? "minor"
        self.statusAtTime = try c.decodeIfPresent(String.self, forKey: .statusAtTime)
        self.alertLevel = try c.decodeIfPresent(String.self, forKey: .alertLevel)
        self.sourceUrl = try c.decodeIfPresent(String.self, forKey: .sourceUrl)
        self.sourceLabel = try c.decodeIfPresent(String.self, forKey: .sourceLabel)
        self.createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
    }

    init(id: String, body: String, kind: String = "minor", statusAtTime: String? = nil,
         alertLevel: String? = "normal", sourceUrl: String? = nil, sourceLabel: String? = nil,
         createdAt: String? = nil) {
        self.id = id; self.body = body; self.kind = kind; self.statusAtTime = statusAtTime
        self.alertLevel = alertLevel; self.sourceUrl = sourceUrl; self.sourceLabel = sourceLabel
        self.createdAt = createdAt
    }

    var isFinal: Bool { kind == "final" || alertLevel == "final" }
}

/// Story + timeline payload from `live-stories?slug=`.
struct LiveStoryDetail: Codable {
    var story: LiveStory
    var updates: [LiveUpdate]
}
