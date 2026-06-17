import SwiftUI

/// The Live-surface module: a layered glass card with an editorial content
/// region (status, headline, latest-update preview) stacked over a denser inner
/// "action bar" panel that groups metadata with the Follow / Live Activity
/// controls. Designed to read like a premium live-news terminal module rather
/// than a generic template card.
struct LiveStoryCard<Controls: View>: View {
    let story: LiveStory
    var onTap: () -> Void = {}
    @ViewBuilder var controls: () -> Controls

    private var statusColor: Color { NT.statusColor(story.status) }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            editorial
            actionBar
        }
        .ntGlassCard(urgent: NT.statusIsUrgent(story.status))
        .accessibilityElement(children: .contain)
    }

    // MARK: Editorial region (tappable → story detail)

    private var editorial: some View {
        Button(action: { Haptics.tap(); onTap() }) {
            VStack(alignment: .leading, spacing: Space.sm) {
                headerRow

                Text(story.title)
                    .font(.ntSoraSemiBold(17, relativeTo: .headline))
                    .ntTightTitle()
                    .foregroundStyle(NT.Palette.textPrimary)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)

                if let latest = story.latestHeadline, !latest.isEmpty {
                    HStack(alignment: .top, spacing: Space.sm) {
                        RoundedRectangle(cornerRadius: 1)
                            .fill(statusColor.opacity(0.9))
                            .frame(width: 2)
                        Text(latest)
                            .font(.ntDek)
                            .foregroundStyle(NT.Palette.textSecondary)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                    }
                    .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Space.md)
            .padding(.top, Space.md)
            .padding(.bottom, Space.sm)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var headerRow: some View {
        HStack(spacing: Space.sm) {
            StatusChip(status: story.status, style: .glass)
            Spacer(minLength: Space.sm)
            HStack(spacing: 6) {
                if let cat = story.category, !cat.isEmpty {
                    Text(cat).ntKickerStyle(NT.Palette.textTertiary)
                    if story.lastUpdateAt != nil {
                        Circle().fill(NT.Palette.textTertiary).frame(width: 2.5, height: 2.5)
                    }
                }
                if let last = story.lastUpdateAt {
                    Text(Formatters.relative(last))
                        .font(.ntMeta)
                        .foregroundStyle(NT.Palette.textTertiary)
                }
            }
        }
    }

    // MARK: Action bar (metadata + controls)

    private var actionBar: some View {
        HStack(alignment: .center, spacing: Space.md) {
            metaRow
            Spacer(minLength: Space.sm)
            controls()
        }
        .padding(.horizontal, Space.md)
        .padding(.vertical, Space.sm)
        .frame(maxWidth: .infinity)
        .background(
            NT.Palette.glassPanel
                .overlay(alignment: .top) {
                    Rectangle().fill(NT.Palette.border).frame(height: 1)
                }
        )
    }

    @ViewBuilder private var metaRow: some View {
        HStack(spacing: Space.md) {
            if let updates = story.updateCount, updates > 0 {
                metaItem(symbol: "list.bullet", text: "\(updates)")
            }
            if let followers = story.followerCount, followers > 0 {
                metaItem(symbol: "person.2.fill", text: Formatters.count(followers))
            }
        }
    }

    private func metaItem(symbol: String, text: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: symbol)
                .font(.system(size: 10, weight: .semibold))
            Text(text)
                .font(.ntInterSemiBold(11, relativeTo: .caption2))
                .monospacedDigit()
        }
        .foregroundStyle(NT.Palette.textSecondary)
    }
}

/// Small card for the Home "Developing Now" horizontal rail.
struct LiveRailCard: View {
    let story: LiveStory
    var onTap: () -> Void = {}

    var body: some View {
        Button(action: { Haptics.tap(); onTap() }) {
            VStack(alignment: .leading, spacing: Space.sm) {
                StatusChip(status: story.status)
                Text(story.title)
                    .font(.ntSoraSemiBold(15, relativeTo: .subheadline))
                    .foregroundStyle(NT.Palette.textPrimary)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
                HStack(spacing: Space.xs) {
                    LivePulse(size: 5)
                    Text(story.lastUpdateAt.map(Formatters.relative) ?? "Live")
                        .font(.ntMeta).foregroundStyle(NT.Palette.textTertiary)
                }
            }
            .padding(Space.md)
            .frame(width: 230, height: 150, alignment: .topLeading)
            .background(
                ZStack(alignment: .leading) {
                    NT.Palette.elevated
                    Rectangle().fill(NT.statusColor(story.status)).frame(width: 3)
                }
            )
            .clipShape(RoundedRectangle(cornerRadius: NT.Radius.card, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: NT.Radius.card, style: .continuous)
                    .strokeBorder(NT.statusIsUrgent(story.status) ? NT.Palette.red.opacity(0.5) : NT.Palette.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(NT.statusLabel(story.status)): \(story.title)")
        .accessibilityAddTraits(.isButton)
    }
}
