import Foundation
import ActivityKit

/// Owns the lifecycle of `LiveStoryAttributes` Live Activities and forwards APNs
/// tokens to the backend so updates/ends can be pushed remotely.
@MainActor
final class LiveActivityManager: ObservableObject {
    static let shared = LiveActivityManager()

    @Published private(set) var activeSlugs: Set<String> = []

    private var pushToStartObserved = false

    var areActivitiesEnabled: Bool {
        ActivityAuthorizationInfo().areActivitiesEnabled
    }

    /// Call once at launch. Refreshes active state and (iOS 17.2+) registers the
    /// push-to-start token so the backend can remote-start future activities.
    func bootstrap() {
        refreshActiveSlugs()
        observeExistingActivityTokens()
        observePushToStartTokenUpdates()
    }

    func refreshActiveSlugs() {
        activeSlugs = Set(Activity<LiveStoryAttributes>.activities.map { $0.attributes.storySlug })
    }

    // MARK: Start / end

    func startActivity(for story: FollowedStory) {
        start(slug: story.slug, title: story.title, category: story.category ?? "",
              status: story.status, severity: story.severity,
              confidence: story.confidence ?? "medium",
              headline: story.latestHeadline ?? story.summary ?? "")
    }

    /// Start a Live Activity for a public LiveStory (Live screen / Story Detail).
    func startActivity(for story: LiveStory) {
        start(slug: story.slug, title: story.title, category: story.category ?? "",
              status: story.status, severity: story.severity,
              confidence: story.confidence ?? "medium",
              headline: story.latestHeadline ?? story.summary ?? "")
    }

    /// Shared start path. Local start works on iOS 16.2+ even without pairing;
    /// the backend takes over remote updates once the per-activity token is
    /// registered (which requires the device to be paired).
    private func start(slug: String, title: String, category: String,
                       status: String, severity: Int, confidence: String, headline: String) {
        guard areActivitiesEnabled else { return }
        guard !activeSlugs.contains(slug) else { return }

        let attributes = LiveStoryAttributes(
            storySlug: slug,
            storyId: slug, // storyId not needed client-side; slug is the key
            title: title,
            category: category
        )
        let state = LiveStoryAttributes.ContentState(
            status: status,
            headline: headline,
            severity: severity,
            confidence: confidence,
            updatedAt: Int(Date().timeIntervalSince1970),
            isFinal: false
        )

        do {
            let activity: Activity<LiveStoryAttributes>
            if #available(iOS 16.2, *) {
                activity = try Activity.request(
                    attributes: attributes,
                    content: .init(state: state, staleDate: Date().addingTimeInterval(30 * 60)),
                    pushType: .token
                )
            } else {
                activity = try Activity.request(attributes: attributes, contentState: state, pushType: .token)
            }
            activeSlugs.insert(slug)
            observeToken(of: activity)
        } catch {
            print("[LiveActivity] start failed: \(error)")
        }
    }

    func endActivity(slug: String) {
        Task {
            for activity in Activity<LiveStoryAttributes>.activities where activity.attributes.storySlug == slug {
                if #available(iOS 16.2, *) {
                    await activity.end(nil, dismissalPolicy: .immediate)
                } else {
                    await activity.end(dismissalPolicy: .immediate)
                }
            }
            activeSlugs.remove(slug)
            try? await APIClient.shared.activityEnded(slug: slug)
        }
    }

    // MARK: Token observation

    private func observeExistingActivityTokens() {
        for activity in Activity<LiveStoryAttributes>.activities {
            observeToken(of: activity)
        }
    }

    private func observeToken(of activity: Activity<LiveStoryAttributes>) {
        let slug = activity.attributes.storySlug
        Task {
            for await tokenData in activity.pushTokenUpdates {
                let hex = tokenData.map { String(format: "%02x", $0) }.joined()
                try? await APIClient.shared.activityStarted(slug: slug, token: hex)
            }
        }
    }

    private func observePushToStartTokenUpdates() {
        guard !pushToStartObserved else { return }
        pushToStartObserved = true
        if #available(iOS 17.2, *) {
            Task {
                for await tokenData in Activity<LiveStoryAttributes>.pushToStartTokenUpdates {
                    let hex = tokenData.map { String(format: "%02x", $0) }.joined()
                    try? await APIClient.shared.registerPushToStart(token: hex)
                }
            }
        }
    }
}
