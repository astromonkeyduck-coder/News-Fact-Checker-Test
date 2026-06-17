import SwiftUI

struct SavedView: View {
    @EnvironmentObject var saved: SavedStore
    @EnvironmentObject var router: AppRouter

    var body: some View {
        Group {
            if saved.items.isEmpty {
                ScrollView {
                    EmptyStateView(systemImage: "bookmark",
                                   title: "Nothing saved yet",
                                   message: "Tap the bookmark on any story to keep it here for later. Saved stories stay on this iPhone.",
                                   actionTitle: "Browse the feed",
                                   action: { router.selectedTab = .home })
                        .padding(.top, Space.xxxl)
                }
                .background(NT.Palette.ink)
            } else {
                List {
                    ForEach(saved.items) { item in
                        SavedRow(item: item) { open(item) }
                            .listRowBackground(NT.Palette.ink)
                            .listRowSeparatorTint(NT.Palette.border)
                    }
                    .onDelete { saved.remove(at: $0) }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
                .background(NT.Palette.ink)
            }
        }
        .navigationTitle("Saved")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(NT.Palette.ink, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
    }

    private func open(_ item: SavedItem) {
        switch item.kind {
        case .post: router.savedPath.append(StoryRoute.post(item.asFeedItemStub))
        case .live: if let slug = item.slug { router.savedPath.append(StoryRoute.live(slug: slug)) }
        }
    }
}

private struct SavedRow: View {
    let item: SavedItem
    var onTap: () -> Void

    var body: some View {
        Button(action: { Haptics.tap(); onTap() }) {
            HStack(alignment: .top, spacing: Space.md) {
                VStack(alignment: .leading, spacing: Space.xs) {
                    HStack(spacing: Space.sm) {
                        if item.kind == .live, let status = item.status {
                            StatusChip(status: status, showsPulse: false)
                        } else if let cat = item.category, !cat.isEmpty {
                            Text(cat).ntKickerStyle(NT.Palette.textSecondary)
                        }
                    }
                    Text(item.title)
                        .font(.system(.subheadline, design: .default).weight(.semibold))
                        .foregroundStyle(NT.Palette.textPrimary)
                        .lineLimit(3)
                        .multilineTextAlignment(.leading)
                    if let source = item.source {
                        Text(source).font(.ntMeta).foregroundStyle(NT.Palette.textTertiary)
                    }
                }
                Spacer(minLength: Space.sm)
                if item.imageUrl != nil {
                    RemoteImage(urlString: item.imageUrl)
                        .frame(width: 72, height: 72)
                        .clipShape(RoundedRectangle(cornerRadius: NT.Radius.chip, style: .continuous))
                }
            }
            .padding(.vertical, Space.xs)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
