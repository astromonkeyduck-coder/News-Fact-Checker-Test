import UserNotifications

/// Notification Service Extension, Milestone 1 scaffold.
///
/// This target exists so the project ships the full 3-target structure
/// (app + Live Activity widget + NSE) and remote pushes can be mutated on the
/// device. It runs ONLY for pushes sent with `mutable-content: 1`.
///
/// In M1 it is a safe pass-through: it delivers the notification unchanged.
/// Milestone 2 adds the *content* (rich image attachments from a payload
/// `image`/`media-url`, thread-id grouping) here, paired with the standard-APNs
/// dispatch backend. See IOS_M2_BACKLOG.md. Do not add dispatch logic here in M1.
final class NotificationService: UNNotificationServiceExtension {
    private var contentHandler: ((UNNotificationContent) -> Void)?
    private var bestAttempt: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest,
                             withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        bestAttempt = request.content.mutableCopy() as? UNMutableNotificationContent

        // M1: pass through unchanged. (M2 attaches rich media here.)
        contentHandler(bestAttempt ?? request.content)
    }

    override func serviceExtensionTimeWillExpire() {
        // Deliver whatever we have if the system is about to terminate us.
        if let handler = contentHandler, let content = bestAttempt {
            handler(content)
        }
    }
}
