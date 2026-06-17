import SwiftUI

/// Shimmering placeholder used for loading states. Honors Reduce Motion by
/// falling back to a static graphite block.
struct Shimmer: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var phase: CGFloat = -1

    func body(content: Content) -> some View {
        content
            .overlay(alignment: .leading) {
                if !reduceMotion {
                    GeometryReader { geo in
                        LinearGradient(
                            colors: [.clear, Color.white.opacity(0.06), .clear],
                            startPoint: .leading, endPoint: .trailing
                        )
                        .frame(width: geo.size.width * 0.6)
                        .offset(x: phase * geo.size.width * 1.6)
                    }
                }
            }
            .clipped()
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.linear(duration: 1.3).repeatForever(autoreverses: false)) {
                    phase = 1
                }
            }
    }
}

extension View {
    func shimmer() -> some View { modifier(Shimmer()) }
}

/// A single graphite block used to compose skeletons.
struct SkeletonBlock: View {
    var height: CGFloat = 14
    var width: CGFloat? = nil
    var corner: CGFloat = 6

    var body: some View {
        RoundedRectangle(cornerRadius: corner, style: .continuous)
            .fill(NT.Palette.surfaceRaised)
            .frame(width: width, height: height)
            .frame(maxWidth: width == nil ? .infinity : nil, alignment: .leading)
            .shimmer()
    }
}

/// Skeleton card matching the StoryCard layout for the feed loading state.
struct StoryCardSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            SkeletonBlock(height: 150, corner: NT.Radius.card)
            SkeletonBlock(height: 12, width: 80)
            SkeletonBlock(height: 18)
            SkeletonBlock(height: 18, width: 220)
            SkeletonBlock(height: 12, width: 140)
        }
        .padding(Space.md)
        .background(RoundedRectangle(cornerRadius: NT.Radius.card, style: .continuous).fill(NT.Palette.surface))
        .accessibilityHidden(true)
    }
}

#Preview {
    StoryCardSkeleton().padding().background(NT.Palette.ink)
}
