import SwiftUI

struct LiveView: View {
    @EnvironmentObject var router: AppRouter
    @EnvironmentObject var identity: DeviceIdentity
    @EnvironmentObject var live: LiveActivityManager
    @EnvironmentObject var reachability: Reachability
    @StateObject private var model = LiveViewModel()
    @State private var showPairingPrompt = false

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Space.lg) {
                if !reachability.isOnline { OfflineBanner() }

                switch model.state {
                case .idle, .loading:
                    ForEach(0..<3, id: \.self) { _ in StoryCardSkeleton() }
                        .ntScreenPadding()
                case .failed(let message):
                    ErrorStateView(message: message) { Task { await model.refresh() } }
                        .padding(.top, Space.xxxl)
                case .loaded(let stories):
                    if stories.isEmpty {
                        EmptyStateView(systemImage: "dot.radiowaves.left.and.right",
                                       title: "No live stories right now",
                                       message: "When the newsroom opens a developing story, it'll appear here. Follow one to get alerts and a Live Activity.")
                            .padding(.top, Space.xxl)
                    } else {
                        content
                    }
                }
            }
            .padding(.vertical, Space.lg)
        }
        .background(NT.Palette.ink)
        .scrollIndicators(.hidden)
        .refreshable { await model.refresh() }
        .navigationTitle("Live")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(NT.Palette.ink, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .task { await model.loadIfNeeded() }
        .onChange(of: model.actionError) { err in
            if err != nil, !identity.isPaired { showPairingPrompt = true }
        }
        .alert("Link this iPhone", isPresented: $showPairingPrompt) {
            Button("Go to Profile") { router.selectedTab = .profile; model.actionError = nil }
            Button("Not now", role: .cancel) { model.actionError = nil }
        } message: {
            Text("To follow live stories from your phone and start Live Activities, link this iPhone in Profile.")
        }
    }

    @ViewBuilder private var content: some View {
        if !model.followed.isEmpty {
            LiveSectionHeader(title: "Following").ntScreenPadding()
            ForEach(model.followed) { story in card(story) }
        }
        LiveSectionHeader(title: model.followed.isEmpty ? "Live Now" : "More Developing", isLive: true)
            .ntScreenPadding()
        ForEach(model.others) { story in card(story) }
    }

    private func card(_ story: LiveStory) -> some View {
        LiveStoryCard(story: story, onTap: { router.livePath.append(StoryRoute.live(slug: story.slug)) }) {
            LiveControls(story: story,
                         isFollowing: model.followedSlugs.contains(story.slug),
                         isActivityRunning: live.activeSlugs.contains(story.slug),
                         activitiesEnabled: live.areActivitiesEnabled,
                         onFollow: { Task { await model.toggleFollow(story) } },
                         onActivity: { toggleActivity(story) })
        }
        .ntScreenPadding()
    }

    private func toggleActivity(_ story: LiveStory) {
        if live.activeSlugs.contains(story.slug) {
            live.endActivity(slug: story.slug)
        } else {
            live.startActivity(for: story)
            Haptics.success()
        }
    }
}

/// Refined section header for the Live screen only: a compact, tracked editorial
/// kicker with a broadcast cue, a faint on-air pulse for the live feed, or a
/// thin accent tick for a calm group. Deliberately smaller and sharper than the
/// shared `SectionHeader` used elsewhere in the app.
private struct LiveSectionHeader: View {
    let title: String
    var isLive: Bool = false
    var accent: Color = NT.Palette.accent

    var body: some View {
        HStack(spacing: Space.sm) {
            if isLive {
                LivePulse(color: NT.Palette.red, size: 5)
                    .frame(width: 12, alignment: .leading)
            } else {
                RoundedRectangle(cornerRadius: 1)
                    .fill(accent)
                    .frame(width: 2, height: 12)
                    .frame(width: 12, alignment: .leading)
            }
            Text(title)
                .font(.ntInterSemiBold(12, relativeTo: .subheadline))
                .tracking(1.5)
                .textCase(.uppercase)
                .foregroundStyle(NT.Palette.textSecondary)
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(title)
        .accessibilityAddTraits(.isHeader)
    }
}

/// Follow + Live Activity controls embedded in a LiveStoryCard, rendered as one
/// compact segmented glass object: a blue primary Follow segment joined to an
/// integrated Live Activity (bolt/stop) segment by a hairline divider.
private struct LiveControls: View {
    let story: LiveStory
    let isFollowing: Bool
    let isActivityRunning: Bool
    let activitiesEnabled: Bool
    var onFollow: () -> Void
    var onActivity: () -> Void

    var body: some View {
        VStack(alignment: .trailing, spacing: 6) {
            HStack(spacing: 0) {
                followSegment
                Rectangle()
                    .fill(NT.Palette.borderStrong)
                    .frame(width: 1)
                    .frame(maxHeight: .infinity)
                activitySegment
            }
            .frame(height: 34)
            .fixedSize(horizontal: true, vertical: false)
            .background(NT.Palette.glassPanel)
            .clipShape(RoundedRectangle(cornerRadius: NT.Radius.control, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: NT.Radius.control, style: .continuous)
                    .strokeBorder(NT.Palette.borderStrong, lineWidth: 1)
            )

            if !activitiesEnabled {
                Text("Enable Live Activities in Settings to show this on your Lock Screen.")
                    .font(.caption2)
                    .foregroundStyle(NT.Palette.textTertiary)
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: 220, alignment: .trailing)
            }
        }
    }

    private var followSegment: some View {
        Button(action: { Haptics.tap(); onFollow() }) {
            HStack(spacing: 5) {
                Image(systemName: isFollowing ? "checkmark" : "bell.fill")
                    .font(.system(size: 11, weight: .semibold))
                Text(isFollowing ? "Following" : "Follow Live")
                    .font(.ntInterSemiBold(13, relativeTo: .subheadline))
            }
            .foregroundStyle(isFollowing ? NT.Palette.textPrimary : .white)
            .padding(.horizontal, Space.md)
            .frame(maxHeight: .infinity)
            .background(isFollowing ? Color.clear : NT.Palette.accent)
            .contentShape(Rectangle())
        }
        .buttonStyle(PressableSegment())
        .accessibilityLabel(isFollowing ? "Following live story" : "Follow live story")
    }

    private var activitySegment: some View {
        Button(action: onActivity) {
            Image(systemName: isActivityRunning ? "stop.fill" : "bolt.fill")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(activityTint)
                .frame(width: 40)
                .frame(maxHeight: .infinity)
                .background(isActivityRunning ? NT.Palette.red.opacity(0.14) : Color.clear)
                .contentShape(Rectangle())
        }
        .buttonStyle(PressableSegment())
        .disabled(!activitiesEnabled)
        .accessibilityLabel(isActivityRunning ? "Stop Live Activity" : "Start Live Activity")
    }

    private var activityTint: Color {
        if !activitiesEnabled { return NT.Palette.textTertiary }
        return isActivityRunning ? NT.Palette.red : NT.Palette.textSecondary
    }
}

/// Press feedback for a segment inside a clipped container (opacity only, a
/// scale effect would fight the container's clip shape).
private struct PressableSegment: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.72 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}
