import Foundation
import Network
import Combine

/// Lightweight network reachability used to show an offline banner and to keep
/// cached content visible instead of error states when the device drops off.
@MainActor
final class Reachability: ObservableObject {
    static let shared = Reachability()

    @Published private(set) var isOnline: Bool = true

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "co.noteworthynews.reachability")

    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            let online = path.status == .satisfied
            Task { @MainActor in self?.isOnline = online }
        }
        monitor.start(queue: queue)
    }

    deinit { monitor.cancel() }
}
