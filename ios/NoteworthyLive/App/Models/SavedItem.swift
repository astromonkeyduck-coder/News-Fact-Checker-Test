import Foundation

/// A locally-saved story. Can represent either a normalized post or a live
/// story, so the Saved screen can show both in one list. Stored as JSON in the
/// app's Application Support directory (see SavedStore).
struct SavedItem: Identifiable, Codable, Hashable {
    enum Kind: String, Codable { case post, live }

    let id: String          // post id, or "live:<slug>"
    var kind: Kind
    var title: String
    var summary: String?
    var imageUrl: String?
    var category: String?
    var source: String?
    var status: String?     // live only
    var slug: String?       // live only
    var webUrl: String?
    var savedAt: Date

    init(from item: FeedItem) {
        self.id = item.id
        self.kind = .post
        self.title = item.title
        self.summary = item.summary
        self.imageUrl = item.imageUrl
        self.category = item.category
        self.source = item.source
        self.status = nil
        self.slug = nil
        self.webUrl = item.webUrl
        self.savedAt = Date()
    }

    init(from story: LiveStory) {
        self.id = "live:\(story.slug)"
        self.kind = .live
        self.title = story.title
        self.summary = story.latestHeadline ?? story.summary
        self.imageUrl = nil
        self.category = story.category
        self.source = "Noteworthy Live"
        self.status = story.status
        self.slug = story.slug
        self.webUrl = "/story/\(story.slug)"
        self.savedAt = Date()
    }

    /// Reconstruct a minimal FeedItem so a saved post can open Story Detail,
    /// which then refetches the full body by id.
    var asFeedItemStub: FeedItem {
        FeedItem(id: id, title: title, summary: summary, imageUrl: imageUrl,
                 category: category, source: source, webUrl: webUrl)
    }
}
