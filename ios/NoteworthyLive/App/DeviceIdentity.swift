import Foundation
import Combine

/// Holds the device's anonymous identity. `deviceUuid` is created once and kept
/// in the Keychain. `deviceSecret` is issued by the backend at pairing time.
final class DeviceIdentity: ObservableObject {
    static let shared = DeviceIdentity()

    private enum Keys {
        static let uuid = "device_uuid"
        static let secret = "device_secret"
        static let subscriberKey = "subscriber_key"
    }

    @Published private(set) var isPaired: Bool

    let deviceUuid: String

    private init() {
        if let existing = Keychain.get(Keys.uuid) {
            deviceUuid = existing
        } else {
            let new = UUID().uuidString
            Keychain.set(new, for: Keys.uuid)
            deviceUuid = new
        }
        isPaired = Keychain.get(Keys.secret) != nil
    }

    var deviceSecret: String? { Keychain.get(Keys.secret) }
    var subscriberKey: String? { Keychain.get(Keys.subscriberKey) }

    func storePairing(secret: String, subscriberKey: String) {
        Keychain.set(secret, for: Keys.secret)
        Keychain.set(subscriberKey, for: Keys.subscriberKey)
        DispatchQueue.main.async { self.isPaired = true }
    }

    func unpair() {
        Keychain.set(nil, for: Keys.secret)
        Keychain.set(nil, for: Keys.subscriberKey)
        DispatchQueue.main.async { self.isPaired = false }
    }
}
