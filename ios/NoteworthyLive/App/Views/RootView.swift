import SwiftUI

struct RootView: View {
    @EnvironmentObject var identity: DeviceIdentity
    @Binding var deepLinkStorySlug: String?

    var body: some View {
        if identity.isPaired {
            FollowedStoriesView(openSlug: $deepLinkStorySlug)
        } else {
            PairingView { _ in
                // After pairing, register the push-to-start token (if observed)
                // and let the followed list load on appear.
                Task { try? await APIClient.shared.heartbeat() }
            }
        }
    }
}
