import SwiftUI

/// Primary feed card for a normalized post (FeedItem). Editorial density:
/// image, kicker, headline, one-line dek, and a tight meta row. Tapping anywhere
/// opens detail; the save control is a separate accessible button.
struct StoryCard: View {
    let item: FeedItem
    var isSaved: Bool = false
    var onTap: () -> Void = {}
    var onSave: () -> Void = {}

    var body: some View {
        Button(action: { Haptics.tap(); onTap() }) {
            VStack(alignment: .leading, spacing: Space.sm) {
                if item.imageUrl != nil || item.isVideo {
                    ZStack(alignment: .topLeading) {
                        RemoteImage(urlString: item.imageUrl)
                            .frame(height: 152)
                            .frame(maxWidth: .infinity)
                            .clipped()
                        if item.isVideo {
                            Image(systemName: "play.circle.fill")
                                .font(.system(size: 32))
                                .foregroundStyle(.white.opacity(0.95))
                                .shadow(radius: 6)
                                .frame(maxWidth: .infinity, maxHeight: .infinity)
                        }
                    }
                    .frame(height: 152)
                    .clipShape(RoundedRectangle(cornerRadius: NT.Radius.card, style: .continuous))
                }

                kicker

                Text(item.title)
                    .font(.ntCardTitle)
                    .foregroundStyle(NT.Palette.textPrimary)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)

                if let summary = item.summary, !summary.isEmpty {
                    Text(summary)
                        .font(.ntDek)
                        .foregroundStyle(NT.Palette.textSecondary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }

                metaRow
            }
            .padding(Space.md)
            .background(
                ZStack(alignment: .leading) {
                    NT.Palette.surface
                    if let stripe = stripeColor {
                        stripe.frame(width: 3)
                    }
                }
            )
            .clipShape(RoundedRectangle(cornerRadius: NT.Radius.card, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: NT.Radius.card, style: .continuous)
                    .strokeBorder(NT.Palette.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityText)
        .accessibilityHint("Opens the story")
        .accessibilityAddTraits(.isButton)
        .accessibilityAction(named: Text(isSaved ? "Remove from saved" : "Save story")) { onSave() }
    }

    /// Left edge stripe: red for breaking, amber for alerts, none otherwise
    /// (matches the website's `.post-card--alert` / breaking treatment).
    private var stripeColor: Color? {
        if item.isBreaking { return NT.Palette.red }
        if item.isAlert { return NT.Palette.amber }
        return nil
    }

    @ViewBuilder private var kicker: some View {
        HStack(spacing: Space.sm) {
            if item.isBreaking {
                StatusChip(status: "breaking")
            } else if let cat = item.category, !cat.isEmpty {
                Text(cat).ntKickerStyle(NT.Palette.accent)
            }
        }
    }

    private var metaRow: some View {
        HStack(spacing: Space.sm) {
            if let source = item.source, !source.isEmpty {
                Text(source)
                    .font(.ntMeta)
                    .foregroundStyle(NT.Palette.textSecondary)
                    .lineLimit(1)
                Circle().fill(NT.Palette.textTertiary).frame(width: 3, height: 3)
            }
            Text(Formatters.relative(item.publishedAt))
                .font(.ntMeta)
                .foregroundStyle(NT.Palette.textTertiary)
            Spacer()
            Button(action: { Haptics.select(); onSave() }) {
                Image(systemName: isSaved ? "bookmark.fill" : "bookmark")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(isSaved ? NT.Palette.accent : NT.Palette.textSecondary)
                    .padding(Space.xs)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(isSaved ? "Remove from saved" : "Save story")
        }
    }

    private var accessibilityText: String {
        var parts: [String] = []
        if item.isBreaking { parts.append("Breaking") }
        else if let c = item.category, !c.isEmpty { parts.append(c) }
        parts.append(item.title)
        if let s = item.source, !s.isEmpty { parts.append("from \(s)") }
        let t = Formatters.relative(item.publishedAt)
        if !t.isEmpty { parts.append(t) }
        return parts.joined(separator: ", ")
    }
}

/// Dense editorial "wire" row, the RSS/news-reader backbone of the Latest feed
/// and search results. Serif headline, mono meta, small thumbnail, status kicker.
/// Designed to sit between hairline dividers for high information density.
struct StoryRow: View {
    let item: FeedItem
    var onTap: () -> Void = {}

    var body: some View {
        Button(action: { Haptics.tap(); onTap() }) {
            HStack(alignment: .top, spacing: Space.md) {
                VStack(alignment: .leading, spacing: 5) {
                    kicker
                    Text(item.title)
                        .font(.ntSerifSemiBold(16, relativeTo: .subheadline))
                        .foregroundStyle(NT.Palette.textPrimary)
                        .lineLimit(3)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    HStack(spacing: Space.sm) {
                        if let source = item.source, !source.isEmpty {
                            Text(source).font(.ntMeta).foregroundStyle(NT.Palette.textSecondary).lineLimit(1)
                            Circle().fill(NT.Palette.textTertiary).frame(width: 2.5, height: 2.5)
                        }
                        Text(Formatters.relative(item.publishedAt))
                            .font(.ntMeta).foregroundStyle(NT.Palette.textTertiary)
                    }
                }
                Spacer(minLength: Space.sm)
                if item.imageUrl != nil || item.isVideo {
                    RemoteImage(urlString: item.imageUrl)
                        .frame(width: 76, height: 76)
                        .clipShape(RoundedRectangle(cornerRadius: NT.Radius.chip, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: NT.Radius.chip, style: .continuous)
                                .strokeBorder(NT.Palette.border, lineWidth: 1)
                        )
                }
            }
            .padding(.vertical, Space.md)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(item.isBreaking ? "Breaking, " : "")\(item.title)\(item.source.map { ", from \($0)" } ?? "")")
        .accessibilityAddTraits(.isButton)
    }

    @ViewBuilder private var kicker: some View {
        if item.isBreaking {
            Text("Breaking").ntKickerStyle(NT.Palette.red)
        } else if let cat = item.category, !cat.isEmpty {
            Text(cat).ntKickerStyle(NT.Palette.accent)
        }
    }
}
