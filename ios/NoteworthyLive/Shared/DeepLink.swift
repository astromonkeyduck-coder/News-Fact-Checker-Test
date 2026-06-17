import Foundation

/// Shared by the app target and the widget extension so Live Activity
/// `widgetURL`s and the app's `onOpenURL` handler agree on the scheme.
enum LiveStoryDeepLink {
    static let scheme = "noteworthylive"

    static func url(slug: String) -> URL {
        URL(string: "\(scheme)://story/\(slug)")!
    }

    static func post(id: String) -> URL {
        URL(string: "\(scheme)://post/\(id)")!
    }
}
