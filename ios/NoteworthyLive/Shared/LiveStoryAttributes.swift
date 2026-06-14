import Foundation
import ActivityKit

/// Shared between the app target and the widget extension.
///
/// IMPORTANT: the property names below must match the backend payloads in
/// `netlify/functions/lib/liveActivityNotify.js`:
///   - `attributes`     -> LiveStoryAttributes (static)
///   - `content-state`  -> LiveStoryAttributes.ContentState (dynamic)
/// Keep them in sync; APNs decodes by exact key names.
public struct LiveStoryAttributes: ActivityAttributes {
    public typealias LiveStoryStatus = String  // breaking | developing | verified | disputed | resolved | false_report

    public struct ContentState: Codable, Hashable {
        public var status: String
        public var headline: String
        public var severity: Int
        public var confidence: String
        public var updatedAt: Int      // epoch seconds
        public var isFinal: Bool

        public init(status: String, headline: String, severity: Int, confidence: String, updatedAt: Int, isFinal: Bool) {
            self.status = status
            self.headline = headline
            self.severity = severity
            self.confidence = confidence
            self.updatedAt = updatedAt
            self.isFinal = isFinal
        }
    }

    // Static (set when the activity starts; never change for its lifetime)
    public var storySlug: String
    public var storyId: String
    public var title: String
    public var category: String

    public init(storySlug: String, storyId: String, title: String, category: String) {
        self.storySlug = storySlug
        self.storyId = storyId
        self.title = title
        self.category = category
    }
}
