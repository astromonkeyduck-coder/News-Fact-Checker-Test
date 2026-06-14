import Foundation

/// Thin networking layer over the existing Netlify Functions. No article CMS —
/// just pairing, token registration, and the followed-stories list.
struct FollowedStory: Codable, Identifiable {
    var slug: String
    var title: String
    var summary: String?
    var status: String
    var severity: Int
    var confidence: String?
    var category: String?
    var latestHeadline: String?
    var id: String { slug }
}

enum APIError: Error { case http(Int, String), decoding, notPaired }

final class APIClient {
    static let shared = APIClient()
    private let session = URLSession.shared
    private let identity = DeviceIdentity.shared

    // MARK: Pairing

    struct RedeemResponse: Codable {
        var deviceId: String
        var deviceSecret: String
        var subscriberKey: String
        var follows: [FollowedStory]
    }

    /// Redeem a pairing code shown on the website. Stores the issued secret.
    func redeem(code: String, pushToStartToken: String?) async throws -> [FollowedStory] {
        let body: [String: Any?] = [
            "action": "redeem",
            "code": code,
            "deviceUuid": identity.deviceUuid,
            "apnsEnvironment": Config.apnsEnvironment,
            "pushToStartToken": pushToStartToken,
            "platform": "ios",
            "appVersion": Config.appVersion,
            "locale": Locale.current.identifier,
        ]
        let res: RedeemResponse = try await post("device-link", body: body)
        identity.storePairing(secret: res.deviceSecret, subscriberKey: res.subscriberKey)
        return res.follows
    }

    // MARK: Device register

    func registerPushToStart(token: String) async throws {
        try await authedVoid("device-register", extra: ["action": "push-to-start", "pushToStartToken": token])
    }

    func activityStarted(slug: String, token: String) async throws {
        try await authedVoid("device-register", extra: ["action": "activity-start", "storySlug": slug, "activityPushToken": token])
    }

    func activityEnded(slug: String) async throws {
        try await authedVoid("device-register", extra: ["action": "activity-end", "storySlug": slug])
    }

    func heartbeat() async throws {
        try await authedVoid("device-register", extra: ["action": "heartbeat", "apnsEnvironment": Config.apnsEnvironment, "appVersion": Config.appVersion])
    }

    // MARK: Followed stories

    struct ListResponse: Codable { var stories: [FollowedStory] }

    func listFollows() async throws -> [FollowedStory] {
        let res: ListResponse = try await authed("device-live-stories", extra: ["action": "list"])
        return res.stories
    }

    func follow(slug: String) async throws {
        try await authedVoid("device-live-stories", extra: ["action": "follow", "slug": slug])
    }

    func unfollow(slug: String) async throws {
        try await authedVoid("device-live-stories", extra: ["action": "unfollow", "slug": slug])
    }

    // MARK: Plumbing

    private func authed<T: Decodable>(_ path: String, extra: [String: Any]) async throws -> T {
        guard let secret = identity.deviceSecret else { throw APIError.notPaired }
        var body = extra
        body["deviceUuid"] = identity.deviceUuid
        body["deviceSecret"] = secret
        return try await post(path, body: body)
    }

    private func authedVoid(_ path: String, extra: [String: Any]) async throws {
        let _: EmptyResponse = try await authed(path, extra: extra)
    }

    private struct EmptyResponse: Codable { var success: Bool? }

    private func post<T: Decodable>(_ path: String, body: [String: Any?]) async throws -> T {
        var req = URLRequest(url: Config.functionsBase.appendingPathComponent(path))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let clean = body.compactMapValues { $0 }
        req.httpBody = try JSONSerialization.data(withJSONObject: clean)

        let (data, response) = try await session.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let msg = String(data: data, encoding: .utf8) ?? ""
            throw APIError.http(status, msg)
        }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.decoding
        }
    }
}
