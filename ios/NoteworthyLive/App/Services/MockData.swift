import Foundation

/// Realistic seed content so the app looks shipped before the backend has data
/// (and for SwiftUI previews). Mirrors the real `FeedItem` / `LiveStory` shapes.
enum MockData {

    private static func ago(_ seconds: TimeInterval) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f.string(from: Date().addingTimeInterval(-seconds))
    }

    // MARK: Posts

    static let posts: [FeedItem] = [
        FeedItem(
            id: "mock-1",
            title: "Senate passes sweeping infrastructure package after marathon overnight session",
            summary: "The bill clears a final procedural hurdle 68-31, sending record transit and grid funding to the president's desk.",
            imageUrl: nil, category: "Politics", source: "Noteworthy Desk",
            webUrl: "/article?id=mock-1", publishedAt: ago(60 * 7), isBreaking: true,
            bodyText: "The Senate passed the long-negotiated infrastructure package early Tuesday after an overnight session that stretched past 3 a.m. The 68-31 vote sends the measure to the president, who has pledged to sign it within the week.\n\nThe package directs the largest single investment in public transit in a generation, alongside grid modernization and broadband expansion for rural counties."),
        FeedItem(
            id: "mock-2",
            title: "Markets steady as central bank holds rates, signals patience on cuts",
            summary: "Equities edged higher after policymakers left the benchmark unchanged and emphasized incoming data.",
            imageUrl: nil, category: "Markets", source: "Wire",
            webUrl: "/article?id=mock-2", publishedAt: ago(60 * 34),
            bodyText: "Stocks closed modestly higher after the central bank held its benchmark rate steady, citing a need to see further progress on inflation before easing."),
        FeedItem(
            id: "mock-3",
            title: "Magnitude 5.8 earthquake strikes off the coast; no tsunami threat issued",
            summary: "The USGS reported the quake at a depth of 10 km. There were no immediate reports of damage.",
            imageUrl: nil, category: "Earthquake", source: "USGS",
            webUrl: "/article?id=mock-3", publishedAt: ago(60 * 52), isAlert: true, magnitude: 5.8,
            bodyText: "A magnitude 5.8 earthquake struck offshore on Tuesday afternoon at a depth of about 10 kilometers, the U.S. Geological Survey reported. No tsunami threat was issued and there were no immediate reports of damage."),
        FeedItem(
            id: "mock-4",
            title: "City council approves overnight transit pilot for three downtown lines",
            summary: "The six-month trial begins next month and will run on weekends to start.",
            imageUrl: nil, category: "Local", source: "Metro",
            webUrl: "/article?id=mock-4", publishedAt: ago(60 * 90)),
        FeedItem(
            id: "mock-5",
            title: "Severe thunderstorm warning issued for three counties until 9 p.m.",
            summary: "Forecasters warn of damaging winds and quarter-sized hail across the region.",
            imageUrl: nil, category: "Weather", source: "NWS",
            webUrl: "/article?id=mock-5", publishedAt: ago(60 * 120), isAlert: true,
            bodyText: "The National Weather Service issued a severe thunderstorm warning for three counties through 9 p.m., citing the potential for damaging winds and quarter-sized hail."),
        FeedItem(
            id: "mock-6",
            title: "Tech giant unveils on-device AI features at developer conference",
            summary: "The company emphasized privacy, saying most processing now happens on the phone.",
            imageUrl: nil, category: "Technology", source: "Noteworthy Desk",
            webUrl: "/article?id=mock-6", publishedAt: ago(60 * 180), isVideo: true),
        FeedItem(
            id: "mock-7",
            title: "Wildfire containment reaches 60% as crews gain ground overnight",
            summary: "Cooler temperatures and lighter winds aided the effort, officials said.",
            imageUrl: nil, category: "Wildfire", source: "CAL FIRE",
            webUrl: "/article?id=mock-7", publishedAt: ago(60 * 240), isAlert: true),
        FeedItem(
            id: "mock-8",
            title: "National team advances to the final after extra-time winner",
            summary: "A late goal sealed a 2-1 victory in front of a sold-out crowd.",
            imageUrl: nil, category: "Sports", source: "Wire",
            webUrl: "/article?id=mock-8", publishedAt: ago(60 * 320)),
    ]

    static func post(id: String) -> FeedItem? {
        posts.first { $0.id == id }
    }

    static func feedPage(section: ContentService.Section, category: String?) -> FeedPage {
        var items = posts
        switch section {
        case .breaking: items = items.filter { $0.isBreaking && !$0.isAlert }
        case .alerts: items = items.filter { $0.isAlert }
        case .all: break
        }
        if let category, !category.isEmpty {
            items = items.filter { ($0.category ?? "").caseInsensitiveCompare(category) == .orderedSame }
        }
        return FeedPage(items: items, nextCursor: nil, total: items.count)
    }

    // MARK: Live stories

    static let liveStories: [LiveStory] = [
        LiveStory(id: "live-mock-1", slug: "capital-evacuation", title: "Evacuation underway near the capitol after gas leak report",
                  summary: "Authorities have cordoned off several blocks.", status: "breaking", category: "Public Safety",
                  severity: 5, confidence: "high", pinned: true, followerCount: 12840,
                  lastUpdateAt: ago(60 * 3), latestHeadline: "Fire officials confirm a controlled venting is in progress; no injuries reported.",
                  updateCount: 9),
        LiveStory(id: "live-mock-2", slug: "election-night", title: "Election night: results coming in across battleground districts",
                  summary: "Live tallies as polls close.", status: "developing", category: "Politics",
                  severity: 4, confidence: "medium", followerCount: 30210,
                  lastUpdateAt: ago(60 * 11), latestHeadline: "Two key districts too close to call as 70% of precincts report.",
                  updateCount: 22),
        LiveStory(id: "live-mock-3", slug: "storm-landfall", title: "Tropical storm expected to make landfall before dawn",
                  summary: "Coastal residents urged to finalize preparations.", status: "verified", category: "Weather",
                  severity: 4, confidence: "high", followerCount: 8760,
                  lastUpdateAt: ago(60 * 26), latestHeadline: "Storm surge warnings extended north along the coast.",
                  updateCount: 14),
        LiveStory(id: "live-mock-4", slug: "transit-outage", title: "Citywide transit outage strands commuters during evening rush",
                  summary: "Service suspended on all lines.", status: "disputed", category: "Local",
                  severity: 3, confidence: "low", followerCount: 4120,
                  lastUpdateAt: ago(60 * 48), latestHeadline: "Operator and union give conflicting accounts of the cause.",
                  updateCount: 6),
    ]

    static func liveDetail(slug: String) -> LiveStoryDetail? {
        guard let story = liveStories.first(where: { $0.slug == slug }) else { return nil }
        let updates: [LiveUpdate] = [
            LiveUpdate(id: "u1", body: story.latestHeadline ?? "Latest update from the newsroom.", kind: "major",
                       statusAtTime: story.status, alertLevel: "urgent", sourceLabel: "Noteworthy Desk", createdAt: ago(60 * 3)),
            LiveUpdate(id: "u2", body: "Officials hold a briefing; we're monitoring for new details.", kind: "minor",
                       statusAtTime: story.status, alertLevel: "normal", sourceLabel: "Wire", createdAt: ago(60 * 18)),
            LiveUpdate(id: "u3", body: "Initial reports emerge; details still being verified.", kind: "minor",
                       statusAtTime: "developing", alertLevel: "normal", sourceLabel: "Noteworthy Desk", createdAt: ago(60 * 40)),
            LiveUpdate(id: "u4", body: "Story opened. Following developments live.", kind: "minor",
                       statusAtTime: "developing", alertLevel: "silent", createdAt: ago(60 * 65)),
        ]
        var s = story
        s.updateCount = updates.count
        return LiveStoryDetail(story: s, updates: updates)
    }
}
