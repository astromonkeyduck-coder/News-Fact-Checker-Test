import UserNotifications

/// Notification Service Extension (Milestone 2C).
///
/// Runs ONLY for pushes sent with `mutable-content: 1`. It enriches a standard
/// alert with a hero image (downloaded from the payload `image` https URL) and
/// applies thread grouping. Everything is fail-soft: any error, timeout, or
/// missing field delivers the original notification unchanged. No dispatch or
/// business logic lives here.
final class NotificationService: UNNotificationServiceExtension {
    private var contentHandler: ((UNNotificationContent) -> Void)?
    private var bestAttempt: UNMutableNotificationContent?
    private var downloadTask: URLSessionDataTask?

    private let maxBytes = 5 * 1024 * 1024        // 5 MB cap
    private let timeout: TimeInterval = 10          // hard ceiling under the ~30s budget

    override func didReceive(_ request: UNNotificationRequest,
                             withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        let content = request.content.mutableCopy() as? UNMutableNotificationContent
        bestAttempt = content

        guard let content else { contentHandler(request.content); return }

        // Thread grouping from the payload (story slug). Harmless if absent.
        if let thread = content.userInfo["thread-id"] as? String, !thread.isEmpty {
            content.threadIdentifier = thread
        }

        // Only attempt media when an https image URL is present.
        guard
            let raw = content.userInfo["image"] as? String,
            let url = URL(string: raw),
            url.scheme == "https"
        else {
            contentHandler(content)
            return
        }

        var config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = timeout
        config.timeoutIntervalForResource = timeout
        let session = URLSession(configuration: config)

        downloadTask = session.dataTask(with: url) { [weak self] data, response, _ in
            guard let self else { return }
            defer { session.finishTasksAndInvalidate() }

            guard
                let data, data.count > 0, data.count <= self.maxBytes,
                let attachment = Self.makeAttachment(from: data, response: response, sourceURL: url)
            else {
                self.deliver(content)
                return
            }
            content.attachments = [attachment]
            self.deliver(content)
        }
        downloadTask?.resume()
    }

    override func serviceExtensionTimeWillExpire() {
        // The system is about to terminate us — deliver the best content we have.
        downloadTask?.cancel()
        if let handler = contentHandler, let content = bestAttempt {
            handler(content)
        }
    }

    /// Deliver once and clear the handler to avoid double-calling.
    private func deliver(_ content: UNNotificationContent) {
        guard let handler = contentHandler else { return }
        contentHandler = nil
        handler(content)
    }

    /// Write the downloaded bytes to a temp file with a clean extension and wrap
    /// them as an attachment. Returns nil on any failure.
    private static func makeAttachment(from data: Data,
                                       response: URLResponse?,
                                       sourceURL: URL) -> UNNotificationAttachment? {
        let ext = fileExtension(response: response, sourceURL: sourceURL)
        let dir = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            let fileURL = dir.appendingPathComponent("media").appendingPathExtension(ext)
            try data.write(to: fileURL)
            return try UNNotificationAttachment(identifier: "media", url: fileURL, options: nil)
        } catch {
            return nil
        }
    }

    private static func fileExtension(response: URLResponse?, sourceURL: URL) -> String {
        if let mime = response?.mimeType {
            switch mime {
            case "image/jpeg": return "jpg"
            case "image/png": return "png"
            case "image/gif": return "gif"
            case "image/webp": return "webp"
            default: break
            }
        }
        let pathExt = sourceURL.pathExtension.lowercased()
        return ["jpg", "jpeg", "png", "gif", "webp"].contains(pathExt) ? pathExt : "jpg"
    }
}
