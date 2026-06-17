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
        /// Number of timeline updates so far. Optional so APNs `content-state`
        /// payloads that predate this field still decode (decodes to nil).
        public var updateCount: Int?

        public init(status: String, headline: String, severity: Int, confidence: String,
                    updatedAt: Int, isFinal: Bool, updateCount: Int? = nil) {
            self.status = status
            self.headline = headline
            self.severity = severity
            self.confidence = confidence
            self.updatedAt = updatedAt
            self.isFinal = isFinal
            self.updateCount = updateCount
        }
    }

    // Static (set when the activity starts; never change for its lifetime)
    public var storySlug: String
    public var storyId: String
    public var title: String
    public var category: String
    /// When set (X-post Live Activities), tap opens `noteworthylive://post/<id>`.
    public var contentPostId: String?

    public init(storySlug: String, storyId: String, title: String, category: String,
                contentPostId: String? = nil) {
        self.storySlug = storySlug
        self.storyId = storyId
        self.title = title
        self.category = category
        self.contentPostId = contentPostId
    }
}

#if DEBUG
extension LiveStoryAttributes {
    /// Realistic sample for Xcode Live Activity previews + the DEBUG demo runner.
    static let preview = LiveStoryAttributes(
        storySlug: "senate-vote-infrastructure",
        storyId: "senate-vote-infrastructure",
        title: "Senate moves toward final vote on infrastructure bill",
        category: "Politics"
    )

    private static func epoch(_ minutesAgo: Int) -> Int {
        Int(Date().addingTimeInterval(TimeInterval(-minutesAgo * 60)).timeIntervalSince1970)
    }
}

extension LiveStoryAttributes.ContentState {
    static let breaking = LiveStoryAttributes.ContentState(
        status: "breaking",
        headline: "Leadership signals a floor vote could come within the hour as holdouts fall in line.",
        severity: 5, confidence: "high",
        updatedAt: Int(Date().addingTimeInterval(-90).timeIntervalSince1970),
        isFinal: false, updateCount: 9)

    static let developing = LiveStoryAttributes.ContentState(
        status: "developing",
        headline: "Negotiators report progress on the amendment package; a procedural vote is expected this afternoon.",
        severity: 3, confidence: "medium",
        updatedAt: Int(Date().addingTimeInterval(-6 * 60).timeIntervalSince1970),
        isFinal: false, updateCount: 5)

    static let verified = LiveStoryAttributes.ContentState(
        status: "verified",
        headline: "Confirmed: the chamber has the votes to advance the bill to a final reading.",
        severity: 4, confidence: "high",
        updatedAt: Int(Date().addingTimeInterval(-2 * 60).timeIntervalSince1970),
        isFinal: false, updateCount: 7)

    static let resolvedFinal = LiveStoryAttributes.ContentState(
        status: "resolved",
        headline: "Passed 68-32. The bill now heads to the President's desk. This story is closed.",
        severity: 4, confidence: "high",
        updatedAt: Int(Date().addingTimeInterval(-1 * 60).timeIntervalSince1970),
        isFinal: true, updateCount: 12)
}
#endif
