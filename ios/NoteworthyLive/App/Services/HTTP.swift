import Foundation

/// Minimal typed GET helper for the public read endpoints. POST/device-auth
/// requests stay in APIClient. Decodes JSON with sensible defaults.
enum HTTP {
    static let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15
        config.waitsForConnectivity = false
        config.requestCachePolicy = .reloadRevalidatingCacheData
        return URLSession(configuration: config)
    }()

    enum HTTPError: LocalizedError {
        case status(Int)
        case decoding
        case transport(String)

        var errorDescription: String? {
            switch self {
            case .status(let code): return "Server returned \(code)."
            case .decoding: return "Couldn't read the response."
            case .transport(let m): return m
            }
        }
    }

    /// GET a function by name with optional query items, decode into `T`.
    static func get<T: Decodable>(_ function: String, query: [URLQueryItem] = []) async throws -> T {
        var comps = URLComponents(url: Config.functionsBase.appendingPathComponent(function),
                                  resolvingAgainstBaseURL: true)!
        if !query.isEmpty { comps.queryItems = query }
        guard let url = comps.url else { throw HTTPError.transport("Bad URL") }

        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        req.setValue("application/json", forHTTPHeaderField: "Accept")

        do {
            let (data, response) = try await session.data(for: req)
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            guard (200..<300).contains(code) else { throw HTTPError.status(code) }
            do {
                return try JSONDecoder().decode(T.self, from: data)
            } catch {
                throw HTTPError.decoding
            }
        } catch let e as HTTPError {
            throw e
        } catch {
            throw HTTPError.transport(error.localizedDescription)
        }
    }
}
