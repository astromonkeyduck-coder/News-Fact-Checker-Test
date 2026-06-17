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
              headline: story.latestHeadline ?? story.summary ?? "",
              updateCount: nil)
    }

    /// Start a Live Activity for a public LiveStory (Live screen / Story Detail).
    func startActivity(for story: LiveStory) {
        start(slug: story.slug, title: story.title, category: story.category ?? "",
              status: story.status, severity: story.severity,
              confidence: story.confidence ?? "medium",
              headline: story.latestHeadline ?? story.summary ?? "",
              updateCount: story.updateCount)
    }

    /// Shared start path. Local start works on iOS 16.2+ even without pairing;
    /// the backend takes over remote updates once the per-activity token is
    /// registered (which requires the device to be paired).
    private func start(slug: String, title: String, category: String,
                       status: String, severity: Int, confidence: String,
                       headline: String, updateCount: Int?) {
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
            isFinal: false,
            updateCount: updateCount
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

    // MARK: Local update (testing + future local-driven updates)

    /// Update a running activity in place. `isFinal == true` ends it with a short
    /// dismissal window so the closed card lingers briefly on the Lock Screen.
    func update(slug: String, status: String, headline: String,
                updateCount: Int? = nil, severity: Int = 3,
                confidence: String = "medium", isFinal: Bool = false) {
        Task {
            let state = LiveStoryAttributes.ContentState(
                status: status, headline: headline, severity: severity,
                confidence: confidence, updatedAt: Int(Date().timeIntervalSince1970),
                isFinal: isFinal, updateCount: updateCount
            )
            for activity in Activity<LiveStoryAttributes>.activities where activity.attributes.storySlug == slug {
                if #available(iOS 16.2, *) {
                    let content = ActivityContent(state: state,
                                                  staleDate: Date().addingTimeInterval(30 * 60))
                    if isFinal {
                        await activity.end(content, dismissalPolicy: .after(Date().addingTimeInterval(60 * 60)))
                    } else {
                        await activity.update(content)
                    }
                } else {
                    if isFinal {
                        await activity.end(using: state, dismissalPolicy: .default)
                    } else {
                        await activity.update(using: state)
                    }
                }
            }
            if isFinal {
                activeSlugs.remove(slug)
                try? await APIClient.shared.activityEnded(slug: slug)
            }
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

    #if DEBUG
    // MARK: Demo (DEBUG-only local walkthrough)

    static let demoSlug = "senate-vote-infrastructure"

    /// Local demo: starts a sample Live Activity and walks it through developing
    /// -> breaking -> verified -> resolved (final) on a timer, so the Lock Screen
    /// and Dynamic Island can be demoed before remote APNs is live.
    func runDemo() {
        guard areActivitiesEnabled else {
            print("[LiveActivity] demo skipped: activities not enabled in Settings")
            return
        }
        endActivity(slug: Self.demoSlug) // reset any prior demo

        Task {
            try? await Task.sleep(nanoseconds: 300_000_000)
            start(slug: Self.demoSlug,
                  title: "Senate moves toward final vote on infrastructure bill",
                  category: "Politics", status: "developing", severity: 3,
                  confidence: "medium",
                  headline: "Negotiators report progress on the amendment package; a procedural vote is expected this afternoon.",
                  updateCount: 4)

            try? await Task.sleep(nanoseconds: 4_000_000_000)
            update(slug: Self.demoSlug, status: "breaking",
                   headline: "Leadership signals a floor vote could come within the hour as holdouts fall in line.",
                   updateCount: 7, severity: 5, confidence: "high")

            try? await Task.sleep(nanoseconds: 5_000_000_000)
            update(slug: Self.demoSlug, status: "verified",
                   headline: "Confirmed: the chamber has the votes to advance the bill to a final reading.",
                   updateCount: 9, severity: 4, confidence: "high")

            try? await Task.sleep(nanoseconds: 5_000_000_000)
            update(slug: Self.demoSlug, status: "resolved",
                   headline: "Passed 68-32. The bill now heads to the President's desk. This story is closed.",
                   updateCount: 12, severity: 4, confidence: "high", isFinal: true)
        }
    }

    func endDemo() { endActivity(slug: Self.demoSlug) }
    #endif
}
