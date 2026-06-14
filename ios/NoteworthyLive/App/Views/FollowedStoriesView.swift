import SwiftUI

/// The home screen once paired: the stories the user follows, each with a
/// Live Activity toggle. Tapping a row opens the web /story/<slug> page.
struct FollowedStoriesView: View {
    @EnvironmentObject var identity: DeviceIdentity
    @StateObject private var live = LiveActivityManager.shared

    @State private var stories: [FollowedStory] = []
    @State private var loading = true
    @State private var errorText: String?
    @Binding var openSlug: String?

    var body: some View {
        NavigationStack {
            Group {
                if loading {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let errorText {
                    ContentUnavailableViewCompat(title: "Couldn\u{2019}t load", message: errorText)
                } else if stories.isEmpty {
                    ContentUnavailableViewCompat(title: "No followed stories",
                                                 message: "Follow a live story on noteworthynews.com to see it here.")
                } else {
                    List(stories) { story in
                        row(story)
                    }
                    .listStyle(.insetGrouped)
                    .refreshable { await load() }
                }
            }
            .navigationTitle("Live")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("Refresh") { Task { await load() } }
                        Button("Unlink this device", role: .destructive) { identity.unpair() }
                    } label: { Image(systemName: "ellipsis.circle") }
                }
            }
        }
        .task { await load() }
        .sheet(item: Binding(get: { openSlug.map { IdentifiedSlug(slug: $0) } },
                             set: { openSlug = $0?.slug })) { item in
            SafariView(url: Config.storyWebURL(slug: item.slug))
        }
    }

    @ViewBuilder
    private func row(_ story: FollowedStory) -> some View {
        let isLive = live.activeSlugs.contains(story.slug)
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Label(StatusStyle.label(story.status), systemImage: StatusStyle.systemImage(story.status))
                    .font(.caption.bold())
                    .foregroundStyle(StatusStyle.color(story.status))
                Spacer()
                if !live.areActivitiesEnabled {
                    Text("Enable Live Activities in Settings").font(.caption2).foregroundStyle(.secondary)
                }
            }
            Text(story.title).font(.headline)
            if let head = story.latestHeadline, !head.isEmpty {
                Text(head).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
            }
            HStack {
                Button {
                    if isLive { live.endActivity(slug: story.slug) }
                    else { live.startActivity(for: story) }
                } label: {
                    Label(isLive ? "Stop Live Activity" : "Start Live Activity",
                          systemImage: isLive ? "stop.circle" : "bolt.circle")
                }
                .buttonStyle(.bordered)
                .disabled(!live.areActivitiesEnabled)

                Spacer()
                Button("Open") { openSlug = story.slug }
                    .buttonStyle(.borderless)
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .onTapGesture { openSlug = story.slug }
    }

    private func load() async {
        loading = stories.isEmpty
        do {
            let result = try await APIClient.shared.listFollows()
            await MainActor.run {
                stories = result
                live.refreshActiveSlugs()
                loading = false
                errorText = nil
            }
        } catch {
            await MainActor.run {
                loading = false
                errorText = "Please try again."
            }
        }
    }
}

private struct IdentifiedSlug: Identifiable { let slug: String; var id: String { slug } }

/// Back-compat wrapper so the project builds below iOS 17's ContentUnavailableView.
private struct ContentUnavailableViewCompat: View {
    let title: String
    let message: String
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "antenna.radiowaves.left.and.right").font(.largeTitle).foregroundStyle(.secondary)
            Text(title).font(.headline)
            Text(message).font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
