import ActivityKit
import WidgetKit
import SwiftUI

/// Lock Screen banner + Dynamic Island presentations for a followed live story.
/// Tapping anywhere deep-links into noteworthylive://story/<slug>, which the app
/// turns into the web /story/<slug> page.
struct LiveStoryLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: LiveStoryAttributes.self) { context in
            // ── Lock Screen / banner (also the StandBy baseline) ──
            LockScreenView(context: context)
                .widgetURL(LiveStoryDeepLink.url(slug: context.attributes.storySlug))
                .activityBackgroundTint(Color.black.opacity(0.85))
                .activitySystemActionForegroundColor(.white)

        } dynamicIsland: { context in
            let status = context.state.status
            return DynamicIsland {
                // Expanded
                DynamicIslandExpandedRegion(.leading) {
                    Label(StatusStyle.label(status), systemImage: StatusStyle.systemImage(status))
                        .font(.caption2.bold())
                        .foregroundStyle(StatusStyle.color(status))
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(StatusStyle.relativeTime(context.state.updatedAt))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(context.attributes.title)
                            .font(.subheadline.bold())
                            .lineLimit(1)
                        Text(context.state.headline)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } compactLeading: {
                Image(systemName: StatusStyle.systemImage(status))
                    .foregroundStyle(StatusStyle.color(status))
            } compactTrailing: {
                Text(StatusStyle.label(status))
                    .font(.caption2.bold())
                    .foregroundStyle(StatusStyle.color(status))
                    .lineLimit(1)
            } minimal: {
                Image(systemName: StatusStyle.systemImage(status))
                    .foregroundStyle(StatusStyle.color(status))
            }
            .widgetURL(LiveStoryDeepLink.url(slug: context.attributes.storySlug))
            .keylineTint(StatusStyle.color(status))
        }
    }
}

private struct LockScreenView: View {
    let context: ActivityViewContext<LiveStoryAttributes>

    var body: some View {
        let status = context.state.status
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: StatusStyle.systemImage(status))
                    .foregroundStyle(StatusStyle.color(status))
                Text(StatusStyle.label(status).uppercased())
                    .font(.caption2.bold())
                    .tracking(1.2)
                    .foregroundStyle(StatusStyle.color(status))
                Spacer()
                Text(StatusStyle.relativeTime(context.state.updatedAt))
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.6))
            }

            Text(context.attributes.title)
                .font(.headline)
                .foregroundStyle(.white)
                .lineLimit(2)

            if !context.state.headline.isEmpty {
                Text(context.state.headline)
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.78))
                    .lineLimit(3)
            }

            if context.state.isFinal {
                Text("Final update \u{00b7} Noteworthy News")
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.5))
            }
        }
        .padding(16)
    }
}
