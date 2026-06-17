import SwiftUI

struct HomeView: View {
    @EnvironmentObject var router: AppRouter
    @EnvironmentObject var saved: SavedStore
    @EnvironmentObject var reachability: Reachability
    @StateObject private var model = HomeViewModel()
    @State private var showNotifications = false

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Space.lg) {
                mastheadHeader

                if !reachability.isOnline { OfflineBanner() }

                switch model.state {
                case .idle, .loading:
                    loadingContent
                case .failed(let message):
                    ErrorStateView(message: message) { Task { await model.refresh() } }
                        .padding(.top, Space.xxxl)
                case .loaded:
                    if model.isEmpty {
                        EmptyStateView(systemImage: "newspaper",
                                       title: "No stories yet",
                                       message: "There's nothing in the feed right now. Pull to refresh, or check back in a moment.",
                                       actionTitle: "Refresh",
                                       action: { Task { await model.refresh() } })
                            .padding(.top, Space.xxxl)
                    } else {
                        loadedContent.transition(.opacity)
                    }
                }
            }
            .padding(.bottom, Space.lg)
            .animation(.easeOut(duration: 0.35), value: model.state.isLoading)
        }
        .background(NT.Palette.ink)
        .scrollIndicators(.hidden)
        .refreshable { await model.refresh() }
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $showNotifications) {
            NavigationStack { NotificationsView() }
        }
        .task { await model.loadIfNeeded() }
    }

    /// Custom newsroom masthead: clean wordmark + a hairline rule, no toolbar
    /// pill. Scrolls with the feed like a print masthead.
    private var mastheadHeader: some View {
        VStack(spacing: Space.md) {
            HStack(alignment: .center) {
                Masthead(size: 20)
                Spacer(minLength: Space.sm)
                Button { showNotifications = true } label: {
                    Image(systemName: "bell")
                        .font(.system(size: 17, weight: .regular))
                        .foregroundStyle(NT.Palette.textSecondary)
                }
                .accessibilityLabel("Notification settings")
            }
            Rectangle().fill(NT.Palette.border).frame(height: 1)
        }
        .ntScreenPadding()
        .padding(.top, Space.sm)
    }

    // MARK: Loaded

    @ViewBuilder private var loadedContent: some View {
        if let hero = model.topBreaking {
            HeroBreakingCard(item: hero,
                             isSaved: saved.isSaved(id: hero.id),
                             onTap: { open(hero) },
                             onSave: { saved.toggle(hero) })
                .ntScreenPadding()
        }

        if !model.liveStories.isEmpty {
            VStack(alignment: .leading, spacing: Space.md) {
                SectionHeader(title: "Developing Now") {
                    Button("See all") { router.selectedTab = .live }
                        .font(.ntMeta).foregroundStyle(NT.Palette.accent)
                }
                .ntScreenPadding()

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Space.md) {
                        ForEach(model.liveStories) { story in
                            LiveRailCard(story: story) { openLive(story.slug) }
                        }
                    }
                    .padding(.horizontal, Space.lg)
                }
            }
        }

        if !model.latest.isEmpty {
        VStack(alignment: .leading, spacing: Space.md) {
            SectionHeader(title: "Latest").ntScreenPadding()

            // Lead story as a full card for visual anchor...
            if let lead = model.latest.first {
                StoryCard(item: lead,
                          isSaved: saved.isSaved(id: lead.id),
                          onTap: { open(lead) },
                          onSave: { saved.toggle(lead) })
                    .ntScreenPadding()
            }

            // ...then a dense, RSS-style wire list separated by hairlines.
            let wire = Array(model.latest.dropFirst())
            LazyVStack(spacing: 0) {
                ForEach(wire) { item in
                    StoryRow(item: item) { open(item) }
                        .onAppear { if item.id == wire.last?.id { Task { await model.loadMore() } } }
                    if item.id != wire.last?.id {
                        Rectangle().fill(NT.Palette.border).frame(height: 1)
                    }
                }
                if model.loadingMore {
                    ProgressView().tint(NT.Palette.textSecondary).padding(.vertical, Space.lg)
                }
            }
            .ntScreenPadding()
        }
        }
    }

    // MARK: Loading skeleton

    private var loadingContent: some View {
        VStack(spacing: Space.lg) {
            ForEach(0..<4, id: \.self) { _ in StoryCardSkeleton() }
        }
        .ntScreenPadding()
    }

    // MARK: Navigation

    private func open(_ item: FeedItem) { router.homePath.append(StoryRoute.post(item)) }
    private func openLive(_ slug: String) { router.homePath.append(StoryRoute.live(slug: slug)) }
}

/// Large, urgent hero treatment for the top breaking story.
struct HeroBreakingCard: View {
    let item: FeedItem
    var isSaved: Bool
    var onTap: () -> Void
    var onSave: () -> Void

    var body: some View {
        Button(action: { Haptics.impact(.medium); onTap() }) {
            VStack(alignment: .leading, spacing: Space.md) {
                ZStack(alignment: .bottomLeading) {
                    RemoteImage(urlString: item.imageUrl)
                        .frame(height: 200)
                        .frame(maxWidth: .infinity)
                        .clipped()
                        .overlay(
                            LinearGradient(colors: [.clear, .black.opacity(0.85)],
                                           startPoint: .center, endPoint: .bottom)
                        )
                    HStack(spacing: Space.sm) {
                        StatusChip(status: "breaking")
                        if let cat = item.category, !cat.isEmpty {
                            Text(cat).ntKickerStyle(.white.opacity(0.9))
                        }
                    }
                    .padding(Space.md)
                }
                .clipShape(RoundedRectangle(cornerRadius: NT.Radius.card, style: .continuous))

                Text(item.title)
                    .font(.ntSerifSemiBold(23, relativeTo: .title2))
                    .foregroundStyle(NT.Palette.textPrimary)
                    .lineLimit(4)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)

                if let summary = item.summary, !summary.isEmpty {
                    Text(summary)
                        .font(.ntBody)
                        .foregroundStyle(NT.Palette.textSecondary)
                        .lineLimit(3)
                }

                HStack(spacing: Space.sm) {
                    if let source = item.source { Text(source).font(.ntMeta).foregroundStyle(NT.Palette.textSecondary) }
                    Text(Formatters.relative(item.publishedAt)).font(.ntMeta).foregroundStyle(NT.Palette.textTertiary)
                    Spacer()
                    Button(action: { Haptics.select(); onSave() }) {
                        Image(systemName: isSaved ? "bookmark.fill" : "bookmark")
                            .foregroundStyle(isSaved ? NT.Palette.accent : NT.Palette.textSecondary)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(isSaved ? "Remove from saved" : "Save story")
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Breaking. \(item.title)")
        .accessibilityAddTraits(.isButton)
        .accessibilityAction(named: Text(isSaved ? "Remove from saved" : "Save story")) { onSave() }
    }
}
