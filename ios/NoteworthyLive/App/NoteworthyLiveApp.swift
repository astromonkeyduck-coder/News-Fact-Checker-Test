import SwiftUI

@main
struct NoteworthyLiveApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var identity = DeviceIdentity.shared
    @State private var deepLinkStorySlug: String?

    var body: some Scene {
        WindowGroup {
            RootView(deepLinkStorySlug: $deepLinkStorySlug)
                .environmentObject(identity)
                .onOpenURL { url in
                    // noteworthylive://story/<slug>  → open the matching web page
                    if url.scheme == Config.urlScheme, url.host == "story" {
                        let slug = url.pathComponents.last(where: { $0 != "/" }) ?? ""
                        if !slug.isEmpty { deepLinkStorySlug = slug }
                    }
                }
        }
    }
}
