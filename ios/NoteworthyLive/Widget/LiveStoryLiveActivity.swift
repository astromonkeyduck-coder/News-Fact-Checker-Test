import ActivityKit
import WidgetKit
import SwiftUI

/// Lock Screen banner + Dynamic Island presentations for a followed live story.
/// Tapping anywhere deep-links into noteworthylive://story/<slug>, which the app
/// turns into the web /story/<slug> page.
///
/// Design: a premium Noteworthy newswire card. Navy brand canvas, a compact
/// Noteworthy "N" badge for identity, a status chip with a signal dot, a clear
/// headline -> latest-update hierarchy, and a timeline footer (update count +
/// last-updated + category). RED is reserved for breaking/live; closed stories
/// read calm and final. SF Pro throughout (brand fonts aren't registered in the
/// widget process); identity comes from the mark, color, and layout.
struct LiveStoryLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: LiveStoryAttributes.self) { context in
            // ── Lock Screen / banner (also the StandBy baseline) ──
            LockScreenView(context: context)
                .widgetURL(LiveStoryDeepLink.url(slug: context.attributes.storySlug))
                .activityBackgroundTint(NWBrand.ink.opacity(0.92))
                .activitySystemActionForegroundColor(.white)

        } dynamicIsland: { context in
            let status = context.state.status
            return DynamicIsland {
                // ── Expanded ──
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 7) {
                        NoteworthyBadge(size: 20)
                        StatusChip(status: status, compact: true)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(StatusStyle.relativeTime(context.state.updatedAt))
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.55))
                        .monospacedDigit()
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(context.attributes.title)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        Text(context.state.headline)
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.72))
                            .lineLimit(2)
                        ExpandedMetaRow(context: context)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } compactLeading: {
                NoteworthyBadge(size: 19)
            } compactTrailing: {
                HStack(spacing: 4) {
                    SignalDot(status: status, size: 6)
                    Text(StatusStyle.relativeTime(context.state.updatedAt))
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(.white.opacity(0.7))
                        .monospacedDigit()
                }
            } minimal: {
                SignalDot(status: status, size: 7)
            }
            .widgetURL(LiveStoryDeepLink.url(slug: context.attributes.storySlug))
            .keylineTint(StatusStyle.color(status))
        }
    }
}

// MARK: - Lock Screen

private struct LockScreenView: View {
    let context: ActivityViewContext<LiveStoryAttributes>

    var body: some View {
        let state = context.state
        let status = state.status
        VStack(alignment: .leading, spacing: 9) {
            // Identity + status
            HStack(spacing: 8) {
                NoteworthyBadge(size: 22)
                Text("NOTEWORTHY")
                    .font(.system(size: 11, weight: .bold))
                    .tracking(1.6)
                    .foregroundStyle(.white.opacity(0.82))
                Spacer(minLength: 8)
                StatusChip(status: status)
            }

            // Headline (the story)
            Text(context.attributes.title)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)

            // Latest update
            if !state.headline.isEmpty {
                Text(state.headline)
                    .font(.system(size: 13))
                    .foregroundStyle(.white.opacity(0.72))
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }

            // Timeline footer
            footer(state: state, status: status)
        }
        .padding(16)
    }

    @ViewBuilder
    private func footer(state: LiveStoryAttributes.ContentState, status: String) -> some View {
        let updates = StatusStyle.updatesText(state.updateCount)
        let time = StatusStyle.relativeTime(state.updatedAt)
        let category = context.attributes.category

        if state.isFinal {
            HStack(spacing: 6) {
                Image(systemName: "flag.checkered")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.5))
                Text("Final update")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.6))
                Text("\u{00b7} Noteworthy News")
                    .font(.system(size: 11))
                    .foregroundStyle(.white.opacity(0.4))
                Spacer(minLength: 0)
                Text(time)
                    .font(.system(size: 11))
                    .foregroundStyle(.white.opacity(0.4))
                    .monospacedDigit()
            }
            .padding(.top, 1)
        } else {
            HStack(spacing: 7) {
                SignalDot(status: status, size: 6)
                metaText(updates.isEmpty ? StatusStyle.label(status) : updates)
                metaDivider()
                metaText(time)
                if !category.isEmpty {
                    metaDivider()
                    metaText(category).lineLimit(1)
                }
                Spacer(minLength: 0)
            }
            .padding(.top, 1)
        }
    }

    private func metaText(_ s: String) -> some View {
        Text(s)
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(.white.opacity(0.55))
            .monospacedDigit()
    }

    private func metaDivider() -> some View {
        Text("\u{00b7}").font(.system(size: 11)).foregroundStyle(.white.opacity(0.3))
    }
}

// MARK: - Expanded meta row (Dynamic Island bottom)

private struct ExpandedMetaRow: View {
    let context: ActivityViewContext<LiveStoryAttributes>

    var body: some View {
        let updates = StatusStyle.updatesText(context.state.updateCount)
        let category = context.attributes.category
        HStack(spacing: 6) {
            if context.state.isFinal {
                Image(systemName: "flag.checkered")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.45))
                Text("Story closed")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(.white.opacity(0.5))
            } else {
                if !category.isEmpty {
                    Text(category)
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(.white.opacity(0.5))
                        .lineLimit(1)
                }
                if !updates.isEmpty {
                    if !category.isEmpty {
                        Text("\u{00b7}").font(.system(size: 10)).foregroundStyle(.white.opacity(0.3))
                    }
                    Text(updates)
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(.white.opacity(0.5))
                        .monospacedDigit()
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.top, 1)
    }
}

// MARK: - Brand components (widget-local; navy/blue, no app theme dependency)

private enum NWBrand {
    static let ink   = Color(red: 0.031, green: 0.055, blue: 0.102) // #080E1A
    static let blue  = Color(red: 0.231, green: 0.545, blue: 0.949) // #3B8BF2
}

/// Compact Noteworthy mark: the real NW app-icon tile (squircle, white N /
/// black W on brand blue), shipped in the widget's own asset catalog so it loads
/// inside the extension process. Reads cleanly down to Dynamic Island scale.
private struct NoteworthyBadge: View {
    var size: CGFloat = 22

    var body: some View {
        Image("NWMark")
            .resizable()
            .interpolation(.high)
            .scaledToFit()
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

/// Status signal dot with a soft concentric ring (a "live pulse" look rendered
/// statically — Live Activities don't run continuous animations on the Lock
/// Screen). Closed states render a calm, ringless dot.
private struct SignalDot: View {
    let status: String
    var size: CGFloat = 6

    var body: some View {
        let color = StatusStyle.color(status)
        ZStack {
            if StatusStyle.isLive(status) {
                Circle()
                    .fill(color.opacity(0.28))
                    .frame(width: size * 2.2, height: size * 2.2)
            }
            Circle()
                .fill(color)
                .frame(width: size, height: size)
        }
        .frame(width: size * 2.2, height: size * 2.2)
        .accessibilityHidden(true)
    }
}

/// Status chip: a signal dot + label in the status color, on a tinted pill.
private struct StatusChip: View {
    let status: String
    var compact: Bool = false

    var body: some View {
        let color = StatusStyle.color(status)
        HStack(spacing: 5) {
            SignalDot(status: status, size: compact ? 5 : 6)
            Text(StatusStyle.label(status).uppercased())
                .font(.system(size: compact ? 10 : 11, weight: .bold))
                .tracking(0.8)
                .foregroundStyle(color)
                .lineLimit(1)
        }
        .padding(.horizontal, compact ? 6 : 8)
        .padding(.vertical, compact ? 3 : 4)
        .background(
            Capsule(style: .continuous)
                .fill(color.opacity(0.14))
                .overlay(Capsule(style: .continuous).strokeBorder(color.opacity(0.34), lineWidth: 1))
        )
    }
}

// MARK: - Previews

#if DEBUG
@available(iOS 17.0, *)
#Preview("Lock Screen", as: .content, using: LiveStoryAttributes.preview) {
    LiveStoryLiveActivity()
} contentStates: {
    LiveStoryAttributes.ContentState.breaking
    LiveStoryAttributes.ContentState.developing
    LiveStoryAttributes.ContentState.verified
    LiveStoryAttributes.ContentState.resolvedFinal
}

@available(iOS 17.0, *)
#Preview("Dynamic Island (expanded)", as: .dynamicIsland(.expanded), using: LiveStoryAttributes.preview) {
    LiveStoryLiveActivity()
} contentStates: {
    LiveStoryAttributes.ContentState.breaking
    LiveStoryAttributes.ContentState.verified
    LiveStoryAttributes.ContentState.resolvedFinal
}

@available(iOS 17.0, *)
#Preview("Dynamic Island (compact)", as: .dynamicIsland(.compact), using: LiveStoryAttributes.preview) {
    LiveStoryLiveActivity()
} contentStates: {
    LiveStoryAttributes.ContentState.breaking
    LiveStoryAttributes.ContentState.developing
    LiveStoryAttributes.ContentState.resolvedFinal
}

@available(iOS 17.0, *)
#Preview("Dynamic Island (minimal)", as: .dynamicIsland(.minimal), using: LiveStoryAttributes.preview) {
    LiveStoryLiveActivity()
} contentStates: {
    LiveStoryAttributes.ContentState.breaking
    LiveStoryAttributes.ContentState.resolvedFinal
}
#endif
