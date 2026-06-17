import SwiftUI

/// Async image with a graphite shimmer placeholder and a graceful failure state.
/// Resolves site-relative paths (e.g. "/assets/...") against the website base so
/// normalized feed images load without extra plumbing.
struct RemoteImage: View {
    let urlString: String?
    var contentMode: ContentMode = .fill

    private var resolvedURL: URL? {
        guard let s = urlString, !s.isEmpty else { return nil }
        if s.hasPrefix("http://") || s.hasPrefix("https://") { return URL(string: s) }
        if s.hasPrefix("/") { return URL(string: s, relativeTo: Config.webBaseURL) }
        return URL(string: s)
    }

    var body: some View {
        if let url = resolvedURL {
            AsyncImage(url: url, transaction: Transaction(animation: .easeOut(duration: 0.25))) { phase in
                switch phase {
                case .empty:
                    placeholder
                case .success(let image):
                    image.resizable().aspectRatio(contentMode: contentMode)
                case .failure:
                    fallback
                @unknown default:
                    fallback
                }
            }
        } else {
            fallback
        }
    }

    private var placeholder: some View {
        Rectangle().fill(NT.Palette.surfaceRaised).shimmer()
    }

    private var fallback: some View {
        ZStack {
            Rectangle().fill(NT.Palette.surfaceRaised)
            Image(systemName: "newspaper")
                .font(.title2)
                .foregroundStyle(NT.Palette.textTertiary)
        }
    }
}
