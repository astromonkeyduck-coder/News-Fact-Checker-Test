import SwiftUI

struct SearchView: View {
    @EnvironmentObject var router: AppRouter
    @StateObject private var model = SearchViewModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                topicRail

                if model.isSearching {
                    resultsSection
                } else {
                    if !model.recents.isEmpty { recentsSection }
                    browseSection
                }
            }
            .padding(.vertical, Space.lg)
        }
        .background(NT.Palette.ink)
        .scrollIndicators(.hidden)
        .navigationTitle("Explore")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(NT.Palette.ink, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .searchable(text: $model.query, placement: .navigationBarDrawer(displayMode: .always),
                    prompt: "Search stories and topics")
        .onSubmit(of: .search) { model.commitSearch() }
        .task { await model.loadIfNeeded() }
    }

    private var topicRail: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Space.sm) {
                TopicChip(title: "All", isSelected: model.selectedTopic == nil) { model.selectedTopic = nil }
                ForEach(model.topics, id: \.self) { topic in
                    TopicChip(title: topic, isSelected: model.selectedTopic == topic) { model.selectTopic(topic) }
                }
            }
            .padding(.horizontal, Space.lg)
        }
    }

    @ViewBuilder private var recentsSection: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            SectionHeader(title: "Recent") {
                Button("Clear") { model.clearRecents() }
                    .font(.ntMeta).foregroundStyle(NT.Palette.textSecondary)
            }
            FlowChips(items: model.recents) { term in
                Button(action: { model.applyRecent(term) }) {
                    Label(term, systemImage: "clock.arrow.circlepath")
                        .font(.ntMeta).foregroundStyle(NT.Palette.textPrimary)
                        .padding(.horizontal, Space.md).padding(.vertical, Space.sm)
                        .background(RoundedRectangle(cornerRadius: NT.Radius.chip).fill(NT.Palette.elevated))
                }
                .buttonStyle(.plain)
            }
        }
        .ntScreenPadding()
    }

    @ViewBuilder private var browseSection: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            SectionHeader(title: "Trending now").ntScreenPadding()
            switch model.state {
            case .idle, .loading:
                VStack { ForEach(0..<5, id: \.self) { _ in SkeletonBlock(height: 64, corner: NT.Radius.chip) } }
                    .ntScreenPadding()
            case .failed(let m):
                ErrorStateView(message: m) { Task { await model.loadIfNeeded() } }
            case .loaded(let items):
                LazyVStack(spacing: 0) {
                    ForEach(items.prefix(20)) { item in
                        StoryRow(item: item) { router.searchPath.append(StoryRoute.post(item)) }
                        Divider().overlay(NT.Palette.border)
                    }
                }
                .ntScreenPadding()
            }
        }
    }

    @ViewBuilder private var resultsSection: some View {
        let results = model.results
        if results.isEmpty {
            EmptyStateView(systemImage: "magnifyingglass",
                           title: "No matches",
                           message: "Try a different term or topic. Full search across the archive is coming soon.")
                .padding(.top, Space.xl)
        } else {
            LazyVStack(spacing: 0) {
                ForEach(results) { item in
                    StoryRow(item: item) { router.searchPath.append(StoryRoute.post(item)) }
                    Divider().overlay(NT.Palette.border)
                }
            }
            .ntScreenPadding()
        }
    }
}

/// Simple wrapping chip layout for recent searches.
private struct FlowChips<Content: View>: View {
    let items: [String]
    @ViewBuilder var content: (String) -> Content

    var body: some View {
        // A lightweight wrap using a vertical stack of horizontal runs.
        let rows = chunk(items, perRow: 2)
        VStack(alignment: .leading, spacing: Space.sm) {
            ForEach(rows.indices, id: \.self) { r in
                HStack(spacing: Space.sm) {
                    ForEach(rows[r], id: \.self) { content($0) }
                    Spacer(minLength: 0)
                }
            }
        }
    }

    private func chunk(_ arr: [String], perRow: Int) -> [[String]] {
        stride(from: 0, to: arr.count, by: perRow).map { Array(arr[$0..<min($0 + perRow, arr.count)]) }
    }
}
