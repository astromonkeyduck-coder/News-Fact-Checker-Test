import SwiftUI

struct StoryDetailView: View {
    let source: StoryDetailSource

    @EnvironmentObject var saved: SavedStore
    @EnvironmentObject var live: LiveActivityManager
    @EnvironmentObject var identity: DeviceIdentity
    @EnvironmentObject var router: AppRouter
    @StateObject private var model: StoryDetailViewModel

    @State private var showShare = false
    @State private var showWeb = false
    @State private var showPairingPrompt = false

    init(source: StoryDetailSource) {
        self.source = source
        _model = StateObject(wrappedValue: StoryDetailViewModel(source: source))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                switch model.state {
                case .idle, .loading:
                    loadingSkeleton
                case .failed(let message):
                    ErrorStateView(message: message) { Task { await model.load() } }
                        .padding(.top, Space.xxxl)
                case .loaded:
                    if model.isLive { liveContent } else { postContent }
                }
            }
            .padding(.vertical, Space.lg)
            .ntScreenPadding()
        }
        .background(NT.Palette.ink)
        .scrollIndicators(.hidden)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(NT.Palette.ink, for: .navigationBar)
        .toolbar { toolbarContent }
        .task { await model.load() }
        .task(id: model.isLive) { await pollLoopIfLive() }
        .sheet(isPresented: $showShare) {
            if let url = model.webURL { ShareSheet(items: [url]) }
        }
        .sheet(isPresented: $showWeb) {
            if let url = model.webURL { SafariView(url: url) }
        }
        .alert("Link this iPhone", isPresented: $showPairingPrompt) {
            Button("Go to Profile") { router.selectedTab = .profile }
            Button("Not now", role: .cancel) { }
        } message: {
            Text("To follow this story from your phone and start a Live Activity, link this iPhone in Profile.")
        }
        .onChange(of: model.actionError) { err in
            if err != nil, !identity.isPaired { showPairingPrompt = true; model.actionError = nil }
        }
    }

    // MARK: Live story

    @ViewBuilder private var liveContent: some View {
        if let story = model.liveStory {
            VStack(alignment: .leading, spacing: Space.md) {
                HStack(spacing: Space.sm) {
                    StatusChip(status: story.status)
                    if let cat = story.category, !cat.isEmpty {
                        Text(cat).ntKickerStyle(NT.Palette.textTertiary)
                    }
                    Spacer()
                    if let last = story.lastUpdateAt {
                        Text("Updated \(Formatters.relative(last))")
                            .font(.ntMeta).foregroundStyle(NT.Palette.textTertiary)
                    }
                }

                Text(story.title)
                    .font(.ntSoraExtraBold(26, relativeTo: .title))
                    .foregroundStyle(NT.Palette.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)

                if let summary = story.summary, !summary.isEmpty {
                    Text(summary).font(.ntBody).foregroundStyle(NT.Palette.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                liveControls(story)

                Divider().overlay(NT.Palette.border)

                SectionHeader(title: "Live timeline", showsAccentBar: true)
                timeline
            }
            openWebButton
        }
    }

    private func liveControls(_ story: LiveStory) -> some View {
        VStack(spacing: Space.sm) {
            HStack(spacing: Space.sm) {
                Button(action: { Task { await model.toggleFollow() } }) {
                    Label(model.followed ? "Following" : "Follow Live",
                          systemImage: model.followed ? "checkmark" : "bell.fill")
                }
                .buttonStyle(NTButtonStyle(kind: model.followed ? .secondary : .primary, fullWidth: true))

                Button(action: { toggleActivity(story) }) {
                    Image(systemName: live.activeSlugs.contains(story.slug) ? "stop.fill" : "bolt.fill").frame(width: 20)
                }
                .buttonStyle(NTButtonStyle(kind: .secondary))
                .disabled(!live.areActivitiesEnabled)
                .accessibilityLabel(live.activeSlugs.contains(story.slug) ? "Stop Live Activity" : "Start Live Activity")
            }
            if !live.areActivitiesEnabled {
                Text("Enable Live Activities in Settings to show this on your Lock Screen.")
                    .font(.caption2).foregroundStyle(NT.Palette.textTertiary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private var timeline: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(model.updates.enumerated()), id: \.element.id) { idx, update in
                TimelineRow(update: update, isFirst: idx == 0, isLast: idx == model.updates.count - 1)
            }
            if model.updates.isEmpty {
                Text("No updates yet. We'll add them here as the story develops.")
                    .font(.ntDek).foregroundStyle(NT.Palette.textTertiary)
                    .padding(.vertical, Space.md)
            }
        }
    }

    private func toggleActivity(_ story: LiveStory) {
        if live.activeSlugs.contains(story.slug) { live.endActivity(slug: story.slug) }
        else { live.startActivity(for: story); Haptics.success() }
    }

    // MARK: Post

    @ViewBuilder private var postContent: some View {
        if let item = model.post {
            VStack(alignment: .leading, spacing: Space.md) {
                HStack(spacing: Space.sm) {
                    if item.isBreaking { StatusChip(status: "breaking") }
                    else if let cat = item.category, !cat.isEmpty { Text(cat).ntKickerStyle(NT.Palette.accent) }
                }
                Text(item.title)
                    .font(.ntDisplaySerif)
                    .foregroundStyle(NT.Palette.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: Space.sm) {
                    if let source = item.source, !source.isEmpty {
                        Text(source).font(.ntInterSemiBold(12, relativeTo: .caption))
                            .foregroundStyle(NT.Palette.textSecondary)
                        Circle().fill(NT.Palette.textTertiary).frame(width: 3, height: 3)
                    }
                    Text(Formatters.absolute(item.publishedAt)).font(.ntMeta).foregroundStyle(NT.Palette.textTertiary)
                }

                Rectangle().fill(NT.Palette.border).frame(height: 1)
                    .padding(.top, Space.xs)

                if item.isVideo {
                    Button { showWeb = true } label: {
                        ZStack {
                            RemoteImage(urlString: item.imageUrl)
                                .frame(height: 220).frame(maxWidth: .infinity).clipped()
                            ZStack {
                                Circle().fill(.black.opacity(0.55)).frame(width: 60, height: 60)
                                Image(systemName: "play.fill")
                                    .font(.system(size: 24, weight: .bold))
                                    .foregroundStyle(.white)
                            }
                        }
                        .clipShape(RoundedRectangle(cornerRadius: NT.Radius.card, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Play video")
                    .accessibilityHint("Opens the video on the web")
                    Text("Video plays on the web")
                        .font(.ntMeta).foregroundStyle(NT.Palette.textTertiary)
                } else if item.imageUrl != nil {
                    RemoteImage(urlString: item.imageUrl)
                        .frame(height: 220).frame(maxWidth: .infinity).clipped()
                        .clipShape(RoundedRectangle(cornerRadius: NT.Radius.card, style: .continuous))
                }

                if let body = item.bodyText, !body.isEmpty {
                    Text(body)
                        .font(.ntArticleBody)
                        .foregroundStyle(NT.Palette.textPrimary.opacity(0.92))
                        .lineSpacing(6)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, Space.xs)
                } else if let summary = item.summary {
                    Text(summary).font(.ntBody).foregroundStyle(NT.Palette.textSecondary)
                        .lineSpacing(5)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            openWebButton
        }
    }

    // MARK: Shared pieces

    private var openWebButton: some View {
        Button { showWeb = true } label: {
            Label("Open full story on the web", systemImage: "safari")
        }
        .buttonStyle(NTButtonStyle(kind: .secondary, fullWidth: true))
        .padding(.top, Space.sm)
    }

    @ToolbarContentBuilder private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button { toggleSave() } label: { Image(systemName: isSaved ? "bookmark.fill" : "bookmark") }
                .accessibilityLabel(isSaved ? "Remove from saved" : "Save")
        }
        ToolbarItem(placement: .topBarTrailing) {
            Button { showShare = true } label: { Image(systemName: "square.and.arrow.up") }
                .accessibilityLabel("Share")
        }
    }

    private var isSaved: Bool {
        if let story = model.liveStory { return saved.isSaved(slug: story.slug) }
        if let item = model.post { return saved.isSaved(id: item.id) }
        return false
    }

    private func toggleSave() {
        if let story = model.liveStory { saved.toggle(story) }
        else if let item = model.post { saved.toggle(item) }
    }

    private var loadingSkeleton: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            SkeletonBlock(height: 12, width: 90)
            SkeletonBlock(height: 28)
            SkeletonBlock(height: 28, width: 240)
            SkeletonBlock(height: 200, corner: NT.Radius.card)
            SkeletonBlock(height: 14)
            SkeletonBlock(height: 14)
            SkeletonBlock(height: 14, width: 200)
        }
    }

    private func pollLoopIfLive() async {
        guard model.isLive else { return }
        while !Task.isCancelled {
            try? await Task.sleep(nanoseconds: UInt64(AppConfig.liveStoryPollInterval * 1_000_000_000))
            if Task.isCancelled { break }
            await model.poll()
        }
    }
}

/// One row in the live timeline. A status dot connected by a vertical rail.
private struct TimelineRow: View {
    let update: LiveUpdate
    let isFirst: Bool
    let isLast: Bool

    private var status: String { update.statusAtTime ?? "developing" }
    /// Major/urgent/final updates read red, matching story.html `.ls-update[data-kind="major"]`.
    private var isMajor: Bool { update.kind == "major" || update.alertLevel == "urgent" || update.isFinal }
    private var markerColor: Color { isMajor ? NT.Palette.red : NT.statusColor(status) }
    private var kindLabel: String { update.isFinal ? "FINAL" : (update.kind == "correction" ? "CORRECTION" : NT.statusLabel(status)) }

    var body: some View {
        HStack(alignment: .top, spacing: Space.md) {
            VStack(spacing: 0) {
                Rectangle().fill(isFirst ? .clear : NT.Palette.border).frame(width: 2, height: 10)
                Circle()
                    .fill(markerColor)
                    .frame(width: isMajor ? 11 : 9, height: isMajor ? 11 : 9)
                    .overlay(Circle().stroke(NT.Palette.ink, lineWidth: 2))
                Rectangle().fill(isLast ? .clear : NT.Palette.border).frame(width: 2).frame(maxHeight: .infinity)
            }
            .frame(width: 12)

            VStack(alignment: .leading, spacing: Space.xs) {
                HStack(spacing: Space.sm) {
                    Text(kindLabel)
                        .font(.ntKicker).tracking(1.2).textCase(.uppercase)
                        .foregroundStyle(markerColor)
                    Text(Formatters.relative(update.createdAt)).font(.ntMeta).foregroundStyle(NT.Palette.textTertiary)
                }
                Text(update.body)
                    .font(.ntBody)
                    .foregroundStyle(NT.Palette.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                if let label = update.sourceLabel, !label.isEmpty {
                    Text(label).font(.caption2).foregroundStyle(NT.Palette.textTertiary)
                }
            }
            .padding(.bottom, Space.md)
        }
        .accessibilityElement(children: .combine)
    }
}
