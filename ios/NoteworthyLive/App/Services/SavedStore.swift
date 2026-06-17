import Foundation
import Combine

/// Local persistence for saved stories. Writes a JSON file to Application
/// Support so saves survive launches without any account or backend. M1 keeps
/// saves device-local by design.
@MainActor
final class SavedStore: ObservableObject {
    static let shared = SavedStore()

    @Published private(set) var items: [SavedItem] = []

    private let fileURL: URL

    init() {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        fileURL = dir.appendingPathComponent("saved-stories.json")
        load()
    }

    func isSaved(id: String) -> Bool { items.contains { $0.id == id } }
    func isSaved(slug: String) -> Bool { items.contains { $0.id == "live:\(slug)" } }

    func toggle(_ item: FeedItem) {
        if isSaved(id: item.id) { remove(id: item.id) }
        else { insert(SavedItem(from: item)) }
    }

    func toggle(_ story: LiveStory) {
        let key = "live:\(story.slug)"
        if isSaved(id: key) { remove(id: key) }
        else { insert(SavedItem(from: story)) }
    }

    func remove(id: String) {
        items.removeAll { $0.id == id }
        persist()
    }

    func remove(at offsets: IndexSet) {
        items.remove(atOffsets: offsets)
        persist()
    }

    private func insert(_ item: SavedItem) {
        items.insert(item, at: 0)
        Haptics.success()
        persist()
    }

    private func load() {
        guard let data = try? Data(contentsOf: fileURL) else { return }
        if let decoded = try? JSONDecoder().decode([SavedItem].self, from: data) {
            items = decoded.sorted { $0.savedAt > $1.savedAt }
        }
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(items) else { return }
        try? data.write(to: fileURL, options: .atomic)
    }
}
