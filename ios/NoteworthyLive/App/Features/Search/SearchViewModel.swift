import Foundation
import Combine

/// Explore + Search. M1 search is client-side over a loaded slice of the feed
/// (the backend has no full-text search endpoint yet, that's a Milestone 2
/// addition). Topic chips filter by category; recent searches persist locally.
@MainActor
final class SearchViewModel: ObservableObject {
    @Published var query: String = ""
    @Published var selectedTopic: String? = nil
    @Published var state: LoadState<[FeedItem]> = .idle
    @Published var recents: [String] = []

    private var all: [FeedItem] = []
    private let recentsKey = "recent_searches_v1"
    private let maxRecents = 8

    /// Topics surfaced as chips (derived from loaded content + a curated base).
    var topics: [String] {
        let base = ["Politics", "Markets", "Weather", "Earthquake", "Technology", "Local", "Sports"]
        let fromData = Set(all.compactMap { $0.category })
        let merged = base + fromData.filter { !base.contains($0) }.sorted()
        return merged
    }

    var results: [FeedItem] {
        var items = all
        if let topic = selectedTopic {
            items = items.filter { ($0.category ?? "").caseInsensitiveCompare(topic) == .orderedSame }
        }
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if !q.isEmpty {
            items = items.filter {
                $0.title.lowercased().contains(q)
                || ($0.summary?.lowercased().contains(q) ?? false)
                || ($0.source?.lowercased().contains(q) ?? false)
                || ($0.category?.lowercased().contains(q) ?? false)
            }
        }
        return items
    }

    var isSearching: Bool {
        !query.trimmingCharacters(in: .whitespaces).isEmpty || selectedTopic != nil
    }

    init() { loadRecents() }

    func loadIfNeeded() async {
        guard all.isEmpty else { return }
        state = .loading
        do {
            let page = try await ContentService.shared.feed(section: .all, limit: 100)
            all = page.items
            state = .loaded(page.items)
        } catch {
            state = .failed((error as? LocalizedError)?.errorDescription ?? "Couldn't load Explore.")
        }
    }

    func selectTopic(_ topic: String) {
        selectedTopic = (selectedTopic == topic) ? nil : topic
    }

    func commitSearch() {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard q.count >= 2 else { return }
        recents.removeAll { $0.caseInsensitiveCompare(q) == .orderedSame }
        recents.insert(q, at: 0)
        if recents.count > maxRecents { recents = Array(recents.prefix(maxRecents)) }
        persistRecents()
    }

    func applyRecent(_ term: String) { query = term }

    func clearRecents() { recents = []; persistRecents() }

    private func loadRecents() {
        recents = UserDefaults.standard.stringArray(forKey: recentsKey) ?? []
    }
    private func persistRecents() {
        UserDefaults.standard.set(recents, forKey: recentsKey)
    }
}
