import Foundation
import Combine

/// Safe, verified profile of the linked Noteworthy web account, captured during
/// pairing from the server-verified Auth0 ID token. Never contains tokens.
struct LinkedProfile: Codable, Equatable {
    var sub: String?
    var email: String?
    var name: String?
    var pictureUrl: String?

    var hasDisplayableInfo: Bool {
        (name?.isEmpty == false) || (email?.isEmpty == false) || (pictureUrl?.isEmpty == false)
    }
}

/// How this device is linked: to a signed-in web account, or just to the
/// browser's anonymous follows (no Auth0 identity available at pairing time).
enum LinkType: String { case account, browser }

/// Holds the device's anonymous identity plus any linked web-account profile.
/// `deviceUuid` is created once and kept in the Keychain. `deviceSecret` is
/// issued by the backend at pairing time. Linked profile fields (email/name/
/// picture URL) are stored in the Keychain too — they are mildly sensitive and
/// never belong in UserDefaults. No Auth0 tokens are ever stored.
final class DeviceIdentity: ObservableObject {
    static let shared = DeviceIdentity()

    private enum Keys {
        static let uuid = "device_uuid"
        static let secret = "device_secret"
        static let subscriberKey = "subscriber_key"
        static let linkType = "link_type"
        static let authSub = "linked_auth0_sub"
        static let email = "linked_email"
        static let name = "linked_name"
        static let pictureUrl = "linked_picture_url"
        static let apnsToken = "apns_standard_token"
    }

    @Published private(set) var isPaired: Bool
    @Published private(set) var linkType: LinkType
    @Published private(set) var linkedProfile: LinkedProfile?
    /// Whether a standard-push APNs device token has been cached for this install.
    @Published private(set) var hasApnsToken: Bool

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
        linkType = LinkType(rawValue: Keychain.get(Keys.linkType) ?? "") ?? .browser
        linkedProfile = DeviceIdentity.loadProfile()
        hasApnsToken = Keychain.get(Keys.apnsToken) != nil
    }

    var deviceSecret: String? { Keychain.get(Keys.secret) }
    var subscriberKey: String? { Keychain.get(Keys.subscriberKey) }
    /// The cached standard-push APNs device token (hex), if registered.
    var apnsToken: String? { Keychain.get(Keys.apnsToken) }

    /// Cache the latest standard-push APNs token. Returns true when the value
    /// changed (so the caller can avoid redundant server writes).
    @discardableResult
    func cacheApnsToken(_ token: String) -> Bool {
        let normalized = token.lowercased()
        guard !normalized.isEmpty else { return false }
        let changed = Keychain.get(Keys.apnsToken) != normalized
        Keychain.set(normalized, for: Keys.apnsToken)
        if !hasApnsToken { DispatchQueue.main.async { self.hasApnsToken = true } }
        return changed
    }

    private static func loadProfile() -> LinkedProfile? {
        let sub = Keychain.get(Keys.authSub)
        let email = Keychain.get(Keys.email)
        let name = Keychain.get(Keys.name)
        let picture = Keychain.get(Keys.pictureUrl)
        if sub == nil && email == nil && name == nil && picture == nil { return nil }
        return LinkedProfile(sub: sub, email: email, name: name, pictureUrl: picture)
    }

    func storePairing(secret: String, subscriberKey: String,
                      linkType: LinkType, profile: LinkedProfile?) {
        Keychain.set(secret, for: Keys.secret)
        Keychain.set(subscriberKey, for: Keys.subscriberKey)
        Keychain.set(linkType.rawValue, for: Keys.linkType)
        Keychain.set(profile?.sub, for: Keys.authSub)
        Keychain.set(profile?.email, for: Keys.email)
        Keychain.set(profile?.name, for: Keys.name)
        Keychain.set(profile?.pictureUrl, for: Keys.pictureUrl)
        DispatchQueue.main.async {
            self.isPaired = true
            self.linkType = linkType
            self.linkedProfile = (linkType == .account) ? profile : nil
        }
    }

    /// Refresh the linked profile from a later server response (e.g. heartbeat)
    /// without re-pairing. No-ops if not paired.
    func updateLinkedProfile(linkType: LinkType, profile: LinkedProfile?) {
        guard Keychain.get(Keys.secret) != nil else { return }
        Keychain.set(linkType.rawValue, for: Keys.linkType)
        Keychain.set(profile?.sub, for: Keys.authSub)
        Keychain.set(profile?.email, for: Keys.email)
        Keychain.set(profile?.name, for: Keys.name)
        Keychain.set(profile?.pictureUrl, for: Keys.pictureUrl)
        DispatchQueue.main.async {
            self.linkType = linkType
            self.linkedProfile = (linkType == .account) ? profile : nil
        }
    }

    func unpair() {
        Keychain.set(nil, for: Keys.secret)
        Keychain.set(nil, for: Keys.subscriberKey)
        Keychain.set(nil, for: Keys.linkType)
        Keychain.set(nil, for: Keys.authSub)
        Keychain.set(nil, for: Keys.email)
        Keychain.set(nil, for: Keys.name)
        Keychain.set(nil, for: Keys.pictureUrl)
        DispatchQueue.main.async {
            self.isPaired = false
            self.linkType = .browser
            self.linkedProfile = nil
        }
    }
}
